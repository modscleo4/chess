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

import { Application } from "midori/app";
import { HTTPError } from "midori/errors";
import { Hash } from "midori/hash";
import { EStatusCode, Handler, Request, Response } from "midori/http";
import { generateUUID } from "midori/util/uuid.js";

import UserDAO from "@core/dao/UserDAO.js";
import { Auth } from "midori/auth";
import { OpenIDServiceProvider } from "@app/providers/OpenIDServiceProvider.js";
import OpenIDService from "@app/services/OpenIDService.js";

export class Login extends Handler {
    #openID: OpenIDService;

    constructor(app: Application) {
        super(app);

        this.#openID = app.services.get(OpenIDServiceProvider);
    }

    async handle(req: Request): Promise<Response> {
        const state = generateUUID();
        this.#openID.setState(state);

        return Response.redirect(this.#openID.authURL + '?' + new URLSearchParams({ response_type: 'code', client_id: this.#openID.clientID, redirect_uri: this.#openID.redirectURL, scope: 'openid profile', state }).toString());
    }
}

export class Callback extends Handler {
    #openID: OpenIDService;

    constructor(app: Application) {
        super(app);

        this.#openID = app.services.get(OpenIDServiceProvider);
    }

    async handle(req: Request): Promise<Response> {
        const state = req.query.get('state');
        const session_state = req.query.get('session_state');
        const code = req.query.get('code');

        if (!state || !session_state || !code || !this.#openID.hasState(state)) {
            return Response.redirect('/');
        }

        const token_response = await fetch(this.#openID.tokenURL, {
            method: 'POST',
            headers: {
                Authorization: `Basic ${Buffer.from(`${this.#openID.clientID}:${this.#openID.clientSecret}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: this.#openID.redirectURL,
            }),
        });

        if (!token_response.ok) {
            return Response.redirect('/');
        }

        const { access_token, id_token } = await token_response.json();

        const identity_response = await fetch(this.#openID.identityURL, {
            headers: {
                Authorization: `Bearer ${access_token}`,
            },
        });

        if (!identity_response.ok) {
            return Response.redirect('/');
        }

        const user = await identity_response.json();

        return Response.send(Buffer.from(`<script>localStorage.setItem('logged', 'true'); localStorage.setItem('oauth_user', '${JSON.stringify(user)}'); location.href = '/';</script>`));
    }
}
