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
import { Handler, Request, Response } from "midori/http";

import GamesServiceProvider from "@app/providers/GamesServiceProvider.js";
import GamesService from "@app/services/GamesService.js";

export class Played extends Handler {
    #games: GamesService;

    constructor(app: Application) {
        super(app);

        this.#games = app.services.get(GamesServiceProvider);
    }

    async handle(req: Request): Promise<Response> {
        const username = req.headers['x-username'];
        const secret = req.headers['x-secret'];

        if (!username || !secret) {
            return Response.status(400).json({ error: 'Missing username or secret' });
        }

        const gamesFormatted = [];
        for (const [gameId, game] of this.#games) {
            if (
                game.player1Name !== username
                || game.player1Secret !== secret
                || game.player2Name !== username
                || game.player2Secret !== secret
            ) {
                continue;
            }

            gamesFormatted.push({
                gameId,
                player1: game.player1Name,
                player2: game.player2Name,
                createdAt: game.createdAt,
            });
        }

        return Response.json(gamesFormatted);
    }
}

export class List extends Handler {
    #games: GamesService;

    constructor(app: Application) {
        super(app);

        this.#games = app.services.get(GamesServiceProvider);
    }

    async handle(req: Request): Promise<Response> {
        const gamesFormatted = [];
        for (const [gameId, game] of this.#games) {
            if (!GamesService.isGameStarted(game)) {
                continue;
            }

            gamesFormatted.push({
                gameId,
                player1: game.player1Name,
                player2: game.player2Name,
                createdAt: game.createdAt,
            });
        }

        return Response.json(gamesFormatted);
    }
}
