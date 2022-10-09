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

import { Router as RouterWrapper } from "midori/router";

import * as AuthHandler from "@app/handler/AuthHandler.js";
import * as GamesHandler from "@app/handler/GamesHandler.js";

const Router = new RouterWrapper();

/**
 * Routing
 *
 * Define your routes here
 * Use the Router.get(), Router.post(), Router.put(), Router.patch(), Router.delete() methods to define your routes
 * Use the Router.group() method to group routes under a common prefix
 * Use the Router.usePublicPath() method to define a public path to serve static files from
 */

Router.get('/login', AuthHandler.Login).withName('auth.login');
Router.get('/auth/callback', AuthHandler.Callback).withName('auth.callback');

Router.group('/api', () => {
    Router.group('/games', () => {
        Router.get('/', GamesHandler.List).withName('api.games.list');
        Router.get('/played', GamesHandler.Played).withName('api.games.played');
    });
});

export default Router;
