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

import { HTTPError } from "midori/errors";
import { EStatusCode, Middleware, Request, Response } from "midori/http";
import { Constructor } from "midori/util/types.js";

export default function OauthScopeMiddlewareFactory(options: { scopes: string[]; }): Constructor<Middleware> {
    return class extends Middleware {
        async process(req: Request, next: (req: Request) => Promise<Response>): Promise<Response> {
            if (req.container.get('::jwt')) {
                const userScopes = (req.container.get('::jwt').scope ?? '').split(' ');
                for (const scope of options.scopes) {
                    if (!userScopes.includes(scope)) {
                        throw new HTTPError(`Insufficient permissions: ${scope}`, EStatusCode.FORBIDDEN);
                    }
                }
            }

            return await next(req);
        }
    };
}
