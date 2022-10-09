/**
 * Copyright 2022 Dhiego Cassiano Fogaça Barbosa
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Server } from "midori/app";
import { Scrypt } from "midori/hash";
import { JWT } from "midori/jwt";
import { ConsoleLogger, LogLevel } from "midori/log";
import {
    AuthServiceProvider,
    HashServiceProvider,
    HashServiceProviderFactory,
    JWTServiceProviderFactory,
    LoggerServiceProviderFactory,
    RouterServiceProviderFactory,
    UserServiceProviderFactory
} from "midori/providers";

import PrismaUserService from "@app/services/PrismaUserService.js";
import router from '@app/routes/index.js';
import OpenIDServiceProvider from "@app/providers/OpenIDServiceProvider.js";
import GamesServiceProvider from "@app/providers/GamesServiceProvider.js";
import OpenIDService from "@app/services/OpenIDService.js";

export default function providers(server: Server): void {
    server.install(RouterServiceProviderFactory(router));
    server.install(LoggerServiceProviderFactory(new ConsoleLogger({ colorsEnabled: true, minLevel: LogLevel.DEBUG })));

    // Add providers here
    // Recover the provider with server.services.get(ServiceProvider) in your handlers and middleware constructors
    server.install(JWTServiceProviderFactory(new JWT({ alg: process.env.JWS_ALGORITHM || 'HS256', secret: process.env.JWS_SECRET || 'secret', privateKeyFile: process.env.JWS_PRIVATE_KEY }, { alg: process.env.JWE_ALGORITHM || 'RSA-OAEP', enc: process.env.JWE_ENCRYPTION || 'A256GCM', secret: process.env.JWE_SECRET, privateKeyFile: process.env.JWE_PRIVATE_KEY || '' })));
    server.install(HashServiceProviderFactory(new Scrypt()));
    server.install(UserServiceProviderFactory(new PrismaUserService(server.services.get(HashServiceProvider))));
    server.install(AuthServiceProvider);

    server.install(OpenIDServiceProvider(new OpenIDService(process.env.OPENID_AUTH_URL ?? '', process.env.OPENID_TOKEN_URL ?? '', process.env.OPENID_IDENTITY_URL ?? '', process.env.OPENID_REDIRECT_URL ?? '', process.env.OPENID_CLIENT_ID ?? '', process.env.OPENID_CLIENT_SECRET ?? '')));
    server.install(GamesServiceProvider);
}
