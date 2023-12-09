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
 * Use the Router.get(), Router.post(), Router.put(), Router.patch(), Router.delete() methods to define your routes..
 * Use the Router.group() method to group routes under a common prefix.
 * Use the Router.route() method to define a route using a custom HTTP method.
 *
 * Beware of trailing slashes! The Dispatcher Middleware will NOT remove nor add trailing slashes to the request path
 * `GET /foo` and `GET /foo/` are different routes and will be dispatched to different handlers.
 *
 * You can add an parameter to the path by using the {parameterName} syntax. The parameter will be available in the params property of the Request.
 *
 * Example:
 * Router.get('/user/{id}', UserHandler.Show).withName('user.show');
 */

Router.get('/login', AuthHandler.Login).withName('auth.login');
Router.get('/auth/callback', AuthHandler.Callback).withName('auth.callback');

Router.group('/api', () => {
    Router.group('/games', () => {
        Router.get('', GamesHandler.List).withName('api.games.list');
        Router.get('/played', GamesHandler.Played).withName('api.games.played');
    });
});

export default Router;
