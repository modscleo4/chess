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

export default class OpenIDService {
    #authURL: string;
    #tokenURL: string;
    #identityURL: string;
    #redirectURL: string;
    #clientID: string;
    #clientSecret: string;
    #states: Map<string, boolean> = new Map();

    constructor(authURL: string, tokenURL: string, identityURL: string, redirectURL: string, clientID: string, clientSecret: string) {
        this.#authURL = authURL;
        this.#tokenURL = tokenURL;
        this.#identityURL = identityURL;
        this.#redirectURL = redirectURL;
        this.#clientID = clientID;
        this.#clientSecret = clientSecret;
    }

    get authURL() {
        return this.#authURL;
    }

    get tokenURL() {
        return this.#tokenURL;
    }

    get identityURL() {
        return this.#identityURL;
    }

    get redirectURL() {
        return this.#redirectURL;
    }

    get clientID() {
        return this.#clientID;
    }

    get clientSecret() {
        return this.#clientSecret;
    }

    hasState(state: string) {
        return this.#states.has(state);
    }

    setState(state: string) {
        this.#states.set(state, true);
    }
}
