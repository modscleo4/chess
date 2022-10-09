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

import WebSocket from 'ws';

import { Piece, PlayerColor } from "@core/lib/chess.js";

export type Game = {
    won: string | null;
    draw: boolean;
    board: (Piece | null)[][];

    timePlayer: number;
    timeInc: number;

    player1: WebSocket | null;
    player1Name: string;
    player1Connected: boolean;
    player1Timer: number;
    player1TimerFn: NodeJS.Timeout | null;
    player1Color: string;
    player1Secret: string | null;

    player2: WebSocket | null;
    player2Name: string;
    player2Connected: boolean;
    player2Timer: number;
    player2TimerFn: NodeJS.Timeout | null;
    player2Color: string;
    player2Secret: string | null;

    lastRequestUndo: PlayerColor | null;
    lastRequestDraw: PlayerColor | null;

    currPlayer: PlayerColor;
    lastMoved: Piece | null;

    movements: string[];
    pureMovements: {
        i: number;
        j: number;
        newI: number;
        newJ: number;
    }[];
    fen: string[];
    takenPieces: Piece[][];
    currentMove: any[];
    currMove: number;

    result: string | null;
    noCaptureOrPawnsQ: number;

    timeout: NodeJS.Timeout | null;

    spectators: Set<WebSocket>;

    createdAt: Date;
};

export default class GamesService extends Map<string, Game> {
    static isGameStarted(game: Game): boolean {
        return game.player1Connected && game.player2Connected;
    }
}
