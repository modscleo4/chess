import WebSocket from 'ws';
import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import {lookup as getMimeType} from 'mime-types';
import * as Chess from './public/js/chess.js';

const port = parseInt(process.env.PORT || '3000');

const server = http.createServer(async (request, response) => {
    function parsePath(url) {
        if (!url.startsWith('node_modules/')) {
            url = 'public/' + url;
        }

        if (url.endsWith('/')) {
            url += 'index.html';
        }

        return url;
    }

    if (!request.url) {
        response.statusCode = 400;
        return;
    }

    if (request.url.startsWith('/')) {
        request.url = request.url.replace(/^\//g, '');
    }

    if (request.url.startsWith('node_modules/') && fs.existsSync(request.url) || fs.existsSync(`public/${request.url}`)) {
        const path = parsePath(request.url);
        response.statusCode = 200;
        response.setHeader('Content-Type', getMimeType(path) || 'text/plain');
        response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
        response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
        response.setHeader('Access-Control-Allow-Origin', '*');
        response.setHeader('Cache-Control', 'public, max-age=600');
        response.setHeader('Content-Length', fs.statSync(path).size);
        response.setHeader('Date', new Date().toUTCString());
        response.setHeader('Expires', new Date(Date.now() + 1000 * 600).toUTCString());
        //response.setHeader('Etag', crypto.createHash('md5').setEncoding('hex').update().read());
        response.setHeader('Age', '0');

        fs.createReadStream(path).pipe(response).on('finish', () => {
            response.end();
        }).on('error', () => {
            response.statusCode = 500;
            response.end();
        });
    } else {
        response.statusCode = 404;
        response.end();
    }
});

server.listen(port, '0.0.0.0');

const ws = new WebSocket.Server({server});

/**
 *
 * @param {number} [n=64]
 * @return {string}
 */
function randomString(n = 64) {
    return crypto.randomBytes(n).toString('hex');
}

/**
 * @typedef {Object} Game
 * @property {string | null} won
 * @property {boolean} draw
 *
 * @property {(Chess.Piece | null)[][]} board
 *
 * @property {number} timePlayer
 * @property {number} timeInc
 *
 * @property {WebSocket | null} player1
 * @property {string} player1Name
 * @property {boolean} player1Connected
 * @property {number} player1Timer
 * @property {NodeJS.Timeout | null} player1TimerFn
 * @property {string} player1Color
 * @property {string | null} player1Secret
 *
 * @property {WebSocket | null} player2
 * @property {string} player2Name
 * @property {boolean} player2Connected
 * @property {number} player2Timer
 * @property {NodeJS.Timeout | null} player2TimerFn
 * @property {string} player2Color
 * @property {string | null} player2Secret
 *
 * @property {Chess.PlayerColor} currPlayer
 * @property {Chess.Piece | null} lastMoved
 *
 * @property {string[]} movements
 * @property {{i: number, j: number, newI: number, newJ: number}[]} pureMovements
 * @property {string[]} fen
 * @property {Chess.Piece[][]} takenPieces
 * @property {*[]} currentMove
 * @property {number} currMove
 *
 * @property {string | null} result
 * @property {number} noCaptureOrPawnsQ
 *
 * @property {number | null} timeout
 *
 * @property {Set<WebSocket>} spectators
 */

/**
 * @type {Map<string, Game>}
 */
const games = new Map();

/**
 * @param {Game} game
 * @param {string} [fen='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1']
 */
function regenerateArray(game, fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
    game.lastMoved = null;
    game.board = Chess.generateArray(fen);
    game.currPlayer = / (?<CurrPlayer>[wb])/.exec(fen)?.groups.CurrPlayer === 'w' ? 'white' : 'black';

    const enPassant = / [wb] K?Q?k?q? (?<EnPassant>(?:-|[a-z]\d))/.exec(fen)?.groups.EnPassant;
    if (enPassant && enPassant !== '-') {
        const i = (8 - parseInt(enPassant[enPassant.length - 1])) === 5 ? 4 : 3;
        const j = 'abcdefgh'.indexOf(enPassant[0]);

        game.lastMoved = game.board[i][j];
    }
}

/**
 * @param {Game} game
 * @param {number} n
 */
function boardAt(game, n) {
    if (n < 0 || n > game.movements.length - 1) {
        return;
    }

    regenerateArray(game, game.fen[n]);

    const {i, j, newI, newJ, promoteTo} = Chess.pgnToCoord(game.movements[n], game.board, game.currPlayer, game.lastMoved);
    game.currentMove = [{i, j, newI, newJ}];
    game.currMove = n;

    game.promoteTo = promoteTo;
}

const commands = {
    /**
     *
     * @param {WebSocket} socket
     * @param {Object} data
     * @param {number} data.timePlayer
     * @param {number} data.timeInc
     * @param {string} data.playerName
     */
    createGame: async (socket, {timePlayer, timeInc, playerName}) => {
        timePlayer === -1 && (timePlayer = Infinity);

        let gameid;
        while (games.has(gameid = Math.random().toString().replace('.', '')));

        /**
         * @type {Game}
         */
        const game = {
            won: null,
            draw: false,

            timePlayer,
            timeInc,

            board: Chess.generateArray(),

            player1: socket,
            player1Name: playerName,
            player1Connected: true,
            player1Timer: 0,
            player1TimerFn: null,
            player1Color: 'white',
            player1Secret: randomString(),

            player2: null,
            player2Name: '',
            player2Connected: false,
            player2Timer: 0,
            player2TimerFn: null,
            player2Color: 'black',
            player2Secret: null,

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
        };

        console.log(`New Game: ${gameid}: ${timePlayer} - ${timeInc}`);
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

        socket.gameid = gameid;
    },

    /**
     *
     * @param {WebSocket} socket
     * @param {Object} data
     * @param {string} data.gameid
     * @param {string} data.playerName
     * @param {string} data.secret
     */
    joinGame: async (socket, {gameid, playerName, secret}) => {
        const game = games.get(gameid);

        if (!game || game.result) {
            socket.send(JSON.stringify({
                command: 'gameNotFound',
                gameid: gameid,
            }));

            return;
        } else if (game.player1Connected && game.player2Connected
            && game.player1 !== socket && game.player2 !== socket
            && game.player1Secret !== secret && game.player2Secret !== secret) {
            socket.send(JSON.stringify({
                command: 'gameFull',
                gameid: gameid,
            }));

            return;
        }

        if (!game.player1Connected && (!game.player1Secret || game.player1Secret === secret)) {
            game.player1 = socket;
            game.player1Name = playerName;
            game.player1Connected = true;
            game.player1Secret = randomString();
        } else if (!game.player2Connected && (!game.player2Secret || game.player2Secret === secret)) {
            game.player2 = socket;
            game.player2Name = playerName;
            game.player2Connected = true;
            game.player2Secret = randomString();
        } else {
            socket.send(JSON.stringify({
                command: 'alreadyConnected',
                gameid: gameid,
            }));

            return;
        }

        if (game.timeout) {
            clearTimeout(game.timeout);
            game.timeout = null;
        }

        socket.send(JSON.stringify({
            command: 'joinGame',
            gameid: gameid,
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

        socket.gameid = gameid;

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

    /**
     *
     * @param {WebSocket} socket
     * @param {Object} data
     * @param {string} gameid
     */
    spectate: async (socket, {gameid}) => {
        const game = games.get(gameid);

        if (!game) {
            socket.send(JSON.stringify({
                command: 'gameNotFound',
                gameid: gameid,
            }));

            return;
        }

        game.spectators.add(socket);

        socket.send(JSON.stringify({
            command: 'joinGame',
            gameid: gameid,
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

    /**
     *
     * @param {WebSocket} socket
     * @param {Object} data
     * @param {number} data.i
     * @param {number} data.j
     * @param {number} data.newI
     * @param {number} data.newJ
     * @param {('Q'|'B'|'N'|'R')} data.promoteTo
     */
    commitMovement: async (socket, {i, j, newI, newJ, promoteTo}) => {
        const game = games.get(socket.gameid);
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

        const piece = game.board[i][j];
        if (!piece) {
            return;
        }

        const move = Chess.move(i, j, newI, newJ, game.board, game.currPlayer, game.lastMoved, promoteTo);
        if (!move) {
            return;
        }

        const {capture = false, enPassant = false, promotion = false, castling = 0, check = false, takenPiece = null} = move;

        const King_i = game.board.findIndex(row => row.find(p => p?.char === 'K' && p?.color !== game.currPlayer));
        const King_j = game.board[King_i].findIndex(p => p?.char === 'K' && p?.color !== game.currPlayer);
        const King = game.board[King_i][King_j];

        King && (King.checked = check);

        game.takenPieces.push([...(game.takenPieces[game.takenPieces.length - 1] ?? []), takenPiece].filter(p => p !== null));

        const fen = Chess.boardToFEN(game.board, piece, game.currPlayer === 'white' ? 'black' : 'white', newI, newJ, game.noCaptureOrPawnsQ, game.movements);

        game.fen.push(fen);

        const {won, draw, result, reason} = Chess.result(game.board, game.currPlayer, game.lastMoved, game.noCaptureOrPawnsQ, game.fen);
        game.won = won;
        game.draw = draw;
        result && (game.result = result);

        const duplicate = Chess.findDuplicateMovement(piece, i, j, newI, newJ, game.board, game.lastMoved);
        let mov = `${piece.char !== 'P' ? piece.char : ''}`;

        if (duplicate) {
            if (!duplicate.sameFile) {
                mov += ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'][j];
            } else if (!duplicate.sameRank) {
                mov += 8 - i;
            } else {
                mov += `${['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'][j]}${8 - i}`;
            }
        }

        if (capture) {
            if (piece.char === 'P') {
                mov += ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'][j];
            }

            mov += 'x';
        }

        mov += `${['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'][newJ]}${8 - newI}`;

        if (promotion) {
            mov += promoteTo;
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

        game.pureMovements.push({i, j, newI, newJ});

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
                    if (game.player1Timer >= game.timePlayer * 60) {
                        game.won = 'black';
                        game.result = '0–1';
                    }
                }, 1000);

                game.movements.length > 2 && (game.player1Timer -= game.timeInc);
            } else {
                game.player2TimerFn = setInterval(() => {
                    game.player2Timer++;
                    if (game.player2Timer >= game.timePlayer * 60) {
                        game.won = 'white';
                        game.result = '1–0';
                    }
                }, 1000);

                game.movements.length > 2 && (game.player1Timer -= game.timeInc);
            }
        }

        game.player1?.send(JSON.stringify({
            command: 'commitMovement',
            i,
            j,
            newI,
            newJ,
            game: {
                currPlayer: game.currPlayer,
                promoteTo,
                player1Timer: game.player1Timer,
                player2Timer: game.player2Timer,
            },
        }));

        game.player2?.send(JSON.stringify({
            command: 'commitMovement',
            i,
            j,
            newI,
            newJ,
            game: {
                currPlayer: game.currPlayer,
                promoteTo,
                player1Timer: game.player1Timer,
                player2Timer: game.player2Timer,
            },
        }));

        game.spectators.forEach(spectator => {
            spectator.send(JSON.stringify({
                command: 'commitMovement',
                i,
                j,
                newI,
                newJ,
                game: {
                    currPlayer: game.currPlayer,
                    promoteTo,
                    player1Timer: game.player1Timer,
                    player2Timer: game.player2Timer,
                },
            }));
        });
    },

    requestUndo: async (socket) => {
        const game = games.get(socket.gameid);
        if (!game) {
            return;
        }

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

    approveUndo: async (socket) => {
        const game = games.get(socket.gameid);
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

    forfeit: async (socket) => {
        const game = games.get(socket.gameid);
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

    requestDraw: async (socket) => {
        const game = games.get(socket.gameid);
        if (!game) {
            return;
        }

        let reason = 'requested';
        if (game.noCaptureOrPawnsQ === 100) {
            reason = '50-moves';
        } else if (Chess.threefoldRepetition(game.fen[game.fen.length - 1])) {
            reason = 'threefold';
        }

        if (reason === 'requested') {
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

    approveDraw: async (socket) => {
        const game = games.get(socket.gameid);
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

    rejectDraw() {

    },
};

ws.on('connection', async socket => {
    socket.on('close', () => {
        const game = games.get(socket.gameid);

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
                games.delete(socket.gameid);
            }, 1000 * 60 * 5);
        }
    });

    socket.on('message', async message => {
        message = JSON.parse(message);

        if (!(message.command in commands)) {
            return;
        }

        await commands[message.command](socket, message);
    });
});
