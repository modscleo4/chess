/**
 * Copyright 2023 Dhiego Cassiano Fogaça Barbosa
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
import {
    CORSConfigProviderFactory,
    ErrorConfigProviderFactory,
    JWTConfigProviderFactory,
    RequestConfigProviderFactory,
    ResponseConfigProviderFactory
} from "midori/providers";

/**
 * Configuration Providers
 *
 * Define your configuration providers here.
 * Use the server.configure() method to add configuration providers to the application.
 * Use the app.config.get() method to recover the configuration in your handlers and/or middleware constructors.
 */

export default function config(server: Server): void {
    // Add configs here using `server.configure(ConfigProviderFactory(config))`
    // Recover the config with app.config.get(ConfigProvider) in your handlers and middleware constructors

    server.configure(CORSConfigProviderFactory({
        origin: process.env.CORS_ORIGIN || '*',
        methods: '*',
        headers: '*',
        maxAge: 86400,
        openerPolicy: 'same-origin',
        embedderPolicy: 'unsafe-none'
    }));

    server.configure(ErrorConfigProviderFactory({
        exposeErrors: process.env.EXPOSE_ERRORS?.toUpperCase() === 'TRUE',
    }));

    server.configure(JWTConfigProviderFactory({
        sign: {
            alg: process.env.JWS_ALGORITHM || 'HS256',
            secret: process.env.JWS_SECRET,
            privateKeyFile: process.env.JWS_PRIVATE_KEY
        },
        encrypt: {
            alg: process.env.JWE_ALGORITHM || 'RSA-OAEP-256',
            enc: process.env.JWE_ENCRYPTION || 'A256GCM',
            secret: process.env.JWE_SECRET,
            privateKeyFile: process.env.JWE_PRIVATE_KEY,
            ephemeralPrivateKeyFile: process.env.JWE_EPHEMERAL_KEY,
        },
    }));

    server.configure(RequestConfigProviderFactory({
        maxBodySize: 1024 * 1024,
    }));

    server.configure(ResponseConfigProviderFactory({
        compression: {
            enabled: false,
            contentTypes: ['*/*'],
        },
    }));
}
