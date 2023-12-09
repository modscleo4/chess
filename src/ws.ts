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

import WebSocket, { WebSocketServer } from 'ws';

import { Server } from 'midori/app';
import { JWTServiceProvider, LoggerServiceProvider } from 'midori/providers';

import GamesServiceProvider from '@app/providers/GamesServiceProvider.js';
import { Game } from '@app/services/GamesService.js';
import * as Chess from '@core/lib/chess.js';
import { generateUUID } from 'midori/util/uuid.js';

type Socket = WebSocket & {
    gameID: string;
};

function regenerateArray(game: Game, fen: string = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
    game.lastMoved = null;
    game.board = Chess.generateArray(fen);
    game.currPlayer = / (?<CurrPlayer>[wb])/.exec(fen)?.groups?.CurrPlayer === 'w' ? 'white' : 'black';

    const enPassant = / [wb] K?Q?k?q? (?<EnPassant>(?:-|[a-z]\d))/.exec(fen)?.groups?.EnPassant;
    if (enPassant && enPassant !== '-') {
        const i = (8 - parseInt(enPassant[enPassant.length - 1])) === 5 ? 4 : 3;
        const j = 'abcdefgh'.indexOf(enPassant[0]);

        game.lastMoved = game.board[i][j];
    }
}

function boardAt(game: Game, n: number) {
    if (n < 0 || n > game.movements.length - 1) {
        return;
    }

    regenerateArray(game, game.fen[n]);

    const { i, j, newI, newJ } = Chess.pgnToCoord(game.movements[n], game.board, game.currPlayer, game.lastMoved);
    game.currentMove = [{ i, j, newI, newJ }];
    game.currMove = n;
}

/**
 * WebSocket
 *
 * Define your WebSocket handler here.
 * Use the WebSocketServer class to create a WebSocket server and attach it to the application.
 */

export default function ws(server: Server): void {
    const logger = server.services.get(LoggerServiceProvider);
    const games = server.services.get(GamesServiceProvider);
    const jwt = server.services.get(JWTServiceProvider);
    const wss = new WebSocketServer({ server });

    function generateToken() {
        const id = generateUUID();

        return jwt.encrypt(Buffer.from(JSON.stringify({ sub: id })), 'JWT');
    }

    const commands: { [command: string]: (socket: Socket, data: any) => Promise<void>; } = {
        async createGame(socket: Socket, data: { playerColor: string, timePlayer: number, timeInc: number, playerName: string; }) {
            data.timePlayer === -1 && (data.timePlayer = Infinity);

            let gameid;
            while (games.has(gameid = (Math.random() * 10).toString().replace('.', '')));

            const game: Game = {
                won: null,
                draw: false,

                timePlayer: data.timePlayer,
                timeInc: data.timeInc,

                board: Chess.generateArray(),

                player1: (data.playerColor === 'white' && socket) || null,
                player1Name: (data.playerColor === 'white' && data.playerName) || '',
                player1Connected: (data.playerColor === 'white' && true) || false,
                player1Timer: 0,
                player1TimerFn: null,
                player1Color: 'white',
                player1Secret: (data.playerColor === 'white' && generateToken()) || null,

                player2: (data.playerColor === 'black' && socket) || null,
                player2Name: (data.playerColor === 'black' && data.playerName) || '',
                player2Connected: (data.playerColor === 'black' && true) || false,
                player2Timer: 0,
                player2TimerFn: null,
                player2Color: 'black',
                player2Secret: (data.playerColor === 'black' && generateToken()) || null,

                lastRequestUndo: null,
                lastRequestDraw: null,

                currPlayer: 'white',
                lastMoved: null,

                movements: [],
                pureMovements: [],
                fen: ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'],
                takenPieces: [],
                currentMove: [],
                currMove: 0,

                result: null,
                noCaptureOrPawnsQ: 0,

                timeout: null,

                spectators: new Set(),

                createdAt: new Date(),
            };

            logger.debug(`New Game: ${gameid}: ${data.timePlayer} - ${data.timeInc}`);
            games.set(gameid, game);

            socket.send(JSON.stringify({
                command: 'createGame',
                gameid,
                game: {
                    playerColor: game.player1 === socket ? game.player1Color : game.player2Color,
                    currPlayer: game.currPlayer,
                    secret: game.player1 === socket ? game.player1Secret : game.player2Secret,
                }
            }));

            socket.gameID = gameid;
        },

        async joinGame(socket: Socket, data: { gameid: string, playerName: string, secret: string; }) {
            const game = games.get(data.gameid);

            if (!game || game.result) {
                socket.send(JSON.stringify({
                    command: 'gameNotFound',
                    gameid: data.gameid,
                }));

                return;
            } else if (game.player1Connected && game.player2Connected
                && game.player1 !== socket && game.player2 !== socket
                && game.player1Secret !== data.secret && game.player2Secret !== data.secret) {
                socket.send(JSON.stringify({
                    command: 'gameFull',
                    gameid: data.gameid,
                }));

                return;
            }

            if (!game.player1Connected && (!game.player1Secret || game.player1Secret === data.secret)) {
                game.player1 = socket;
                game.player1Name = data.playerName;
                game.player1Connected = true;
                game.player1Secret = generateToken();
            } else if (!game.player2Connected && (!game.player2Secret || game.player2Secret === data.secret)) {
                game.player2 = socket;
                game.player2Name = data.playerName;
                game.player2Connected = true;
                game.player2Secret = generateToken();
            } else {
                socket.send(JSON.stringify({
                    command: 'alreadyConnected',
                    gameid: data.gameid,
                }));

                return;
            }

            if (game.timeout) {
                clearTimeout(game.timeout);
                game.timeout = null;
            }

            socket.send(JSON.stringify({
                command: 'joinGame',
                gameid: data.gameid,
                game: {
                    movements: game.pureMovements,
                    playerColor: game.player1 === socket ? game.player1Color : game.player2Color,
                    currPlayer: game.currPlayer,

                    player1Timer: game.player1Timer,
                    player2Timer: game.player2Timer,

                    timePlayer: game.timePlayer === Infinity ? -1 : game.timePlayer,
                    timeInc: game.timeInc,

                    secret: game.player1 === socket ? game.player1Secret : game.player2Secret,
                },
            }));

            socket.gameID = data.gameid;

            if (game.player1Connected && game.player2Connected) {
                game.player1?.send(JSON.stringify({
                    command: 'start',
                    game: {
                        player1Name: game.player1Name,
                        player2Name: game.player2Name,
                    },
                }));

                game.player2?.send(JSON.stringify({
                    command: 'start',
                    game: {
                        player1Name: game.player1Name,
                        player2Name: game.player2Name,
                    },
                }));

                game.spectators.forEach(spectator => {
                    spectator.send(JSON.stringify({
                        command: 'start',
                        game: {
                            player1Name: game.player1Name,
                            player2Name: game.player2Name,
                        },
                    }));
                });
            }
        },

        async spectate(socket: Socket, data: { gameid: string; }) {
            const game = games.get(data.gameid);

            if (!game) {
                socket.send(JSON.stringify({
                    command: 'gameNotFound',
                    gameid: data.gameid,
                }));

                return;
            }

            game.spectators.add(socket);

            socket.send(JSON.stringify({
                command: 'joinGame',
                gameid: data.gameid,
                game: {
                    movements: game.pureMovements,
                    playerColor: 'white',
                    currPlayer: game.currPlayer,

                    player1Timer: game.player1Timer,
                    player2Timer: game.player2Timer,

                    timePlayer: game.timePlayer === Infinity ? -1 : game.timePlayer,
                    timeInc: game.timeInc,
                },
            }));

            if (game.player1Connected && game.player2Connected) {
                socket.send(JSON.stringify({
                    command: 'start',
                    game: {
                        player1Name: game.player1Name,
                        player2Name: game.player2Name,
                    },
                }));
            }
        },

        async commitMovement(socket: Socket, data: { i: number, j: number, newI: number, newJ: number, promoteTo: 'Q' | 'R' | 'B' | 'N'; }) {
            const game = games.get(socket.gameID);
            if (!game) {
                return;
            }

            if (game.won || game.draw) {
                return;
            }

            if (game.player1 === socket && game.player1Color !== game.currPlayer) {
                return;
            } else if (game.player2 === socket && game.player2Color !== game.currPlayer) {
                return;
            }

            const piece = game.board[data.i][data.j];
            if (!piece) {
                return;
            }

            const move = Chess.move(data.i, data.j, data.newI, data.newJ, game.board, game.currPlayer, game.lastMoved, data.promoteTo);
            if (!move) {
                return;
            }

            const { capture = false, enPassant = false, promotion = false, castling = 0, check = false, takenPiece = null } = move;

            const King_i = game.board.findIndex(row => row.find(p => p?.char === 'K' && p?.color !== game.currPlayer));
            const King_j = game.board[King_i].findIndex(p => p?.char === 'K' && p?.color !== game.currPlayer);
            const King = game.board[King_i][King_j];

            King && ((<Chess.King> King).checked = check);

            game.takenPieces.push(<Chess.Piece[]>[...(game.takenPieces[game.takenPieces.length - 1] ?? []), takenPiece].filter(p => p !== null));

            const fen = Chess.boardToFEN(game.board, false, piece, game.currPlayer === 'white' ? 'black' : 'white', data.newI, data.newJ, true, game.noCaptureOrPawnsQ, game.movements);

            game.fen.push(fen);

            const { won, draw, result, reason } = Chess.result(game.board, game.currPlayer, game.lastMoved, game.noCaptureOrPawnsQ, game.fen);
            game.won = won;
            game.draw = draw;
            result && (game.result = result);

            const duplicate = Chess.findDuplicateMovement(piece, data.i, data.j, data.newI, data.newJ, game.board, game.lastMoved);
            let mov = `${piece.char !== 'P' ? piece.char : ''}`;

            if (duplicate) {
                if (!duplicate.sameFile) {
                    mov += ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'][data.j];
                } else if (!duplicate.sameRank) {
                    mov += 8 - data.i;
                } else {
                    mov += `${['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'][data.j]}${8 - data.i}`;
                }
            }

            if (capture) {
                if (piece.char === 'P') {
                    mov += ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'][data.j];
                }

                mov += 'x';
            }

            mov += `${['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'][data.newJ]}${8 - data.newI}`;

            if (promotion) {
                mov += data.promoteTo;
            }

            if (reason === 'checkmate') {
                mov += '#';
            } else if (check) {
                mov += '+';
            } else if (castling) {
                mov = ['0-0', '0-0-0'][castling - 1];
            }

            if (enPassant) {
                mov += ' e.p.';
            }

            game.movements.push(mov);

            game.pureMovements.push({ i: data.i, j: data.j, newI: data.newI, newJ: data.newJ });

            if (!capture && piece.char !== 'P') {
                game.noCaptureOrPawnsQ++;
            } else {
                game.noCaptureOrPawnsQ = 0;
            }

            game.currPlayer = (game.currPlayer === 'white' ? 'black' : 'white');
            game.currMove++;

            game.lastMoved = piece;

            game.player1TimerFn && clearInterval(game.player1TimerFn);
            game.player2TimerFn && clearInterval(game.player2TimerFn);
            game.player1TimerFn = null;
            game.player2TimerFn = null;

            if (game.movements.length >= 2 && !game.result) {
                if (game.currPlayer === 'white') {
                    game.player1TimerFn = setInterval(() => {
                        game.player1Timer++;
                        if (game.player1Timer >= game.timePlayer * 60 * 100) {
                            if (Chess.semiInsufficientMaterial(game.board, 'black')) {
                                game.won = null;
                                game.result = '½-½';

                                return;
                            }

                            game.won = 'black';
                            game.result = '0–1';
                        }
                    }, 10);

                    game.movements.length > 2 && (game.player1Timer -= game.timeInc);
                } else {
                    game.player2TimerFn = setInterval(() => {
                        game.player2Timer++;
                        if (game.player2Timer >= game.timePlayer * 60 * 100) {
                            if (Chess.semiInsufficientMaterial(game.board, 'white')) {
                                game.won = null;
                                game.result = '½-½';

                                return;
                            }

                            game.won = 'white';
                            game.result = '1–0';
                        }
                    }, 10);

                    game.movements.length > 2 && (game.player1Timer -= game.timeInc);
                }
            }

            game.player1?.send(JSON.stringify({
                command: 'commitMovement',
                i: data.i,
                j: data.j,
                newI: data.newI,
                newJ: data.newJ,
                game: {
                    currPlayer: game.currPlayer,
                    promoteTo: data.promoteTo,
                    player1Timer: game.player1Timer,
                    player2Timer: game.player2Timer,
                },
            }));

            game.player2?.send(JSON.stringify({
                command: 'commitMovement',
                i: data.i,
                j: data.j,
                newI: data.newI,
                newJ: data.newJ,
                game: {
                    currPlayer: game.currPlayer,
                    promoteTo: data.promoteTo,
                    player1Timer: game.player1Timer,
                    player2Timer: game.player2Timer,
                },
            }));

            game.spectators.forEach(spectator => {
                spectator.send(JSON.stringify({
                    command: 'commitMovement',
                    i: data.i,
                    j: data.j,
                    newI: data.newI,
                    newJ: data.newJ,
                    game: {
                        currPlayer: game.currPlayer,
                        promoteTo: data.promoteTo,
                        player1Timer: game.player1Timer,
                        player2Timer: game.player2Timer,
                    },
                }));
            });
        },

        async requestUndo(socket: Socket) {
            const game = games.get(socket.gameID);
            if (!game) {
                return;
            }

            if (game.lastRequestUndo === game.currPlayer) {
                return;
            }

            game.lastRequestUndo = game.currPlayer;

            if (game.player1 === socket) {
                game.player2?.send(JSON.stringify({
                    command: 'requestUndo',
                }));
            } else {
                game.player1?.send(JSON.stringify({
                    command: 'requestUndo',
                }));
            }
        },

        async approveUndo(socket: Socket) {
            const game = games.get(socket.gameID);
            if (!game) {
                return;
            }

            boardAt(game, game.currMove - 1);
            game.movements.pop();
            game.fen.pop();
            game.takenPieces.pop();

            game.player1?.send(JSON.stringify({
                command: 'undo',
            }));

            game.player2?.send(JSON.stringify({
                command: 'undo',
            }));

            game.spectators.forEach(spectator => {
                spectator.send(JSON.stringify({
                    command: 'undo',
                }));
            });
        },

        async forfeit(socket: Socket) {
            const game = games.get(socket.gameID);
            if (!game) {
                return;
            }

            game.won = socket === game.player1 ? 'black' : 'white';
            game.draw = false;

            game.result = game.won === 'white' ? '1-0' : '0 - 1';

            game.player1?.send(JSON.stringify({
                command: 'forfeit',
                won: game.won,
            }));

            game.player2?.send(JSON.stringify({
                command: 'forfeit',
                won: game.won,
            }));

            game.spectators.forEach(spectator => {
                spectator.send(JSON.stringify({
                    command: 'forfeit',
                    won: game.won,
                }));
            });
        },

        async requestDraw(socket: Socket) {
            const game = games.get(socket.gameID);
            if (!game) {
                return;
            }

            let reason = 'requested';
            if (game.noCaptureOrPawnsQ === 100) {
                reason = '50-moves';
            } else if (Chess.threefoldRepetition(game.fen)) {
                reason = 'threefold';
            }

            if (reason === 'requested') {
                if (game.lastRequestDraw === game.currPlayer) {
                    return;
                }

                game.lastRequestDraw = game.currPlayer;

                if (game.player1 === socket) {
                    game.player2?.send(JSON.stringify({
                        command: 'requestDraw',
                    }));
                } else {
                    game.player1?.send(JSON.stringify({
                        command: 'requestDraw',
                    }));
                }

                return;
            }

            game.won = null;
            game.draw = true;

            game.result = '½–½';

            game.player1?.send(JSON.stringify({
                command: 'draw',
                reason,
            }));

            game.player2?.send(JSON.stringify({
                command: 'draw',
                reason,
            }));

            game.spectators.forEach(spectator => {
                spectator.send(JSON.stringify({
                    command: 'draw',
                    reason,
                }));
            });
        },

        async approveDraw(socket) {
            const game = games.get(socket.gameID);
            if (!game) {
                return;
            }

            let reason = 'requested';

            game.won = null;
            game.draw = true;

            game.result = '½–½';

            game.player1?.send(JSON.stringify({
                command: 'draw',
                reason,
            }));

            game.player2?.send(JSON.stringify({
                command: 'draw',
                reason,
            }));

            game.spectators.forEach(spectator => {
                spectator.send(JSON.stringify({
                    command: 'draw',
                    reason,
                }));
            });
        },

        async rejectDraw(socket: Socket) {

        },

        async changeUsername(socket: Socket, data: { oldUsername: string, newUsername: string; }) {
            const game = games.get(socket.gameID);
            if (!game) {
                return;
            }

            if (game.player1 === socket) {
                game.player1Name = data.newUsername;
            } else if (game.player2 === socket) {
                game.player2Name = data.newUsername;
            } else {
                return;
            }

            game.player1?.send(JSON.stringify({
                command: 'changeUsername',
                player1Name: game.player1Name,
                player1Color: game.player1Color,
                player2Name: game.player2Name,
                player2Color: game.player2Color
            }));

            game.player2?.send(JSON.stringify({
                command: 'changeUsername',
                player1Name: game.player1Name,
                player1Color: game.player1Color,
                player2Name: game.player2Name,
                player2Color: game.player2Color
            }));

            game.spectators.forEach(spectator => {
                spectator.send(JSON.stringify({
                    command: 'changeUsername',
                    player1Name: game.player1Name,
                    player1Color: game.player1Color,
                    player2Name: game.player2Name,
                    player2Color: game.player2Color
                }));
            });
        },
    };

    wss.on('connection', async (socket: Socket) => {
        socket.on('close', () => {
            const game = games.get(socket.gameID);

            if (!game) {
                return;
            }

            if (game.player1 === socket) {
                game.player1Connected = false;
                game.player2?.send(JSON.stringify({
                    command: 'playerDisconnected',
                }));

                game.spectators.forEach(socket => {
                    socket.send(JSON.stringify({
                        command: 'playerDisconnected',
                    }));
                });
            } else if (game.player2 === socket) {
                game.player2Connected = false;
                game.player1?.send(JSON.stringify({
                    command: 'playerDisconnected',
                }));

                game.spectators.forEach(socket => {
                    socket.send(JSON.stringify({
                        command: 'playerDisconnected',
                    }));
                });
            } else {
                game.spectators.delete(socket);
            }

            if (!game.player1Connected && !game.player2Connected) {
                game.timeout = setTimeout(() => {
                    games.delete(socket.gameID);
                }, 1000 * 60 * 5);
            }
        });

        socket.on('message', async message => {
            try {
                const data = JSON.parse(message.toString());

                const commandName: string = data.command;

                if (!(commandName in commands)) {
                    return;
                }

                await commands[commandName](socket, data);
            } catch (e) {
                logger.error('[WS] Unexpected error', { context: e, separator: ' - ' });
            }
        });
    });

}
