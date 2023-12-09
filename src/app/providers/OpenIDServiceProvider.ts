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

import { Application, ServiceProvider } from "midori/app";
import { Constructor } from "midori/util/types.js";

import OpenIDService from "@app/services/OpenIDService.js";

export abstract class OpenIDServiceProvider extends ServiceProvider<OpenIDService> {
    static service: string = 'OpenID';
}

export default function (openIDService: OpenIDService): Constructor<OpenIDServiceProvider> & { [K in keyof typeof OpenIDServiceProvider]: typeof OpenIDServiceProvider[K] } {
    return class extends OpenIDServiceProvider {
        register(app: Application): OpenIDService {
            return openIDService;
        }
    };
}
