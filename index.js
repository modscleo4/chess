import WebSocket, {WebSocketServer} from 'ws';
import express from 'express';
import compression from 'compression';
import crypto from 'crypto';
import * as Chess from './public/js/chess.js';

const port = parseInt(process.env.PORT || '3000');

const options = {
    setHeaders(response, path) {
        response.set('Access-Control-Allow-Origin', ['*']);
        response.set('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE');
        response.set('Access-Control-Allow-Headers', 'Content-Type');
        response.set('Cache-Control', 'public, max-age=600');
        response.set('Expires', new Date(Date.now() + 1000 * 600).toUTCString());
        response.set('Cross-Origin-Opener-Policy', 'same-origin');
        response.set('Cross-Origin-Embedder-Policy', 'require-corp');
    }
};

const server = express()
    .use(compression({level: 1, filter: shouldCompress}))
    .use('/node_modules/', express.static('node_modules/', options))
    .use('/', express.static('public/', options))
    .use('/api/games/played/', (req, res) => {
        const username = req.headers['x-username'];
        const secret = req.headers['x-secret'];

        if (!username || !secret) {
            return res.status(400).json({error: 'Missing username or secret'});
        }

        const games_formatted = [];
        for (const [gameId, game] of games) {
            if (!(game.player1Name === username && game.player1Secret === secret
                || game.player2Name === username && game.player2Secret === secret)) {
                continue;
            }

            games_formatted.push({
                gameId,
                player1: game.player1Name,
                player2: game.player2Name,
                createdAt: game.createdAt,
            });
        }

        return res.json(games_formatted);
    })
    .use('/api/games/', (req, res) => {
        const games_formatted = [];
        for (const [gameId, game] of games) {
            if (!isGameStarted(game)) {
                continue;
            }

            games_formatted.push({
                gameId,
                player1: game.player1Name,
                player2: game.player2Name,
                createdAt: game.createdAt,
            });
        }

        return res.json(games_formatted);
    })
    .listen(port);

server.on('listening', () => {
    console.log(`Server listening on port ${port}`);
});

function shouldCompress(request, response) {
    if (request.headers['x-no-compression']) {
        // don't compress responses with this request header
        return false;
    }

    // fallback to standard filter function
    return compression.filter(request, response);
}

const ws = new WebSocketServer({server});

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
 * @property {Chess.PlayerColor | null} lastRequestUndo
 * @property {Chess.PlayerColor | null} lastRequestDraw
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
 *
 * @property {Date} createdAt
 */

/**
 * @type {Map<string, Game>}
 */
const games = new Map();

/**
 *
 * @param {Game} game
 * @returns
 */
function isGameStarted(game) {
    return game.player1Connected && game.player2Connected;
}

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

    const {i, j, newI, newJ} = Chess.pgnToCoord(game.movements[n], game.board, game.currPlayer, game.lastMoved);
    game.currentMove = [{i, j, newI, newJ}];
    game.currMove = n;
}

const commands = {
    /**
     *
     * @param {WebSocket} socket
     * @param {Object} data
     * @param {Chess.PlayerColor} data.playerColor
     * @param {number} data.timePlayer
     * @param {number} data.timeInc
     * @param {string} data.playerName
     */
    createGame: async (socket, {playerColor, timePlayer, timeInc, playerName}) => {
        timePlayer === -1 && (timePlayer = Infinity);

        let gameid;
        while (games.has(gameid = (Math.random() * 10).toString().replace('.', '')));

        /**
         * @type {Game}
         */
        const game = {
            won: null,
            draw: false,

            timePlayer,
            timeInc,

            board: Chess.generateArray(),

            player1: (playerColor === 'white' && socket) || null,
            player1Name: (playerColor === 'white' && playerName) || '',
            player1Connected: (playerColor === 'white' && true) || false,
            player1Timer: 0,
            player1TimerFn: null,
            player1Color: 'white',
            player1Secret: (playerColor === 'white' && randomString()) || null,

            player2: (playerColor === 'black' && socket) || null,
            player2Name: (playerColor === 'black' && playerName) || '',
            player2Connected: (playerColor === 'black' && true) || false,
            player2Timer: 0,
            player2TimerFn: null,
            player2Color: 'black',
            player2Secret: (playerColor === 'black' && randomString()) || null,

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

    approveUndo: async (socket) => {
        console.log(socket);
        const game = games.get(socket.gameid);
        if (!game) {
            return;
        }

        console.log(game.fen[game.currMove - 1]);
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
