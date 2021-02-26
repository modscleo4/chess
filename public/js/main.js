'use strict';

import {simd} from 'https://unpkg.com/wasm-feature-detect?module';
import * as Vue from 'https://cdnjs.cloudflare.com/ajax/libs/vue/3.0.5/vue.esm-browser.prod.js';
import * as Chess from './chess.js';
import createSocket from './ws.js';

function importScript(src) {
    const script = document.createElement('script');
    script.src = src;

    document.body.appendChild(script);

    return script;
}

window.addEventListener('appinstalled', () => {
    console.log('A2HS installed');
});

/**
 * @type {Worker|undefined}
 */
let worker;

let stockfish;

const app = Vue.createApp({
    data: () => ({
        page: '/',
        connection: {
            //protocol: 'ws',
            protocol: 'wss',
            //address: 'localhost:3000',
            address: 'chessjs-web.herokuapp.com',
            socket: null,
            gameid: null,
            canStart: false,
            secret: null,
        },
        game: {
            start: false,
            playerNames: {white: 'Brancas', black: 'Pretas'},
            gamemode: null,
            playerColor: 'white',
            currPlayer: 'white',
            timePlayer: null,
            timeInc: null,
            won: null,
            draw: false,
            board: null,
            _board: null,
            lastMoved: null,
            takenPieces: [],
            movements: [],
            fen: ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'],
            currentMove: [],
            noCaptureOrPawnsQ: 0,
            result: null,
            promoteTo: null,
            player1Timer: 0,
            player1TimerFn: null,
            player2Timer: 0,
            player2TimerFn: null,
            canRequestDraw: true,
            currMove: -1,
        },
        scores: [],
        validMoves: [],
        selectVariant: false,
        selectMode: false,
        createGame: false,
        playerName: localStorage.getItem('playerName'),
        sidebarOpened: false,
        standalone: window.matchMedia('(display-mode: standalone)').matches,
        drag: {
            dragging: false,
            piece: null,
            i: 0,
            j: 0,
            newI: 0,
            newJ: 0,
        },
        click: {
            clicked: false,
            piece: null,
        },
        shift: false,
        alt: false,
        analyze: true,
        engine: {
            name: 'Stockfish',
            ver: '12',
            tag: 'WASM',
            options: {

            },
            loaded: false,
            calculating: false,
        },
        maxThreads: navigator.hardwareConcurrency,
        maxRAM: Math.min(Math.floor((performance.memory?.jsHeapSizeLimit ?? 32 * 1024 * 1024) / 1024 / 1024), 1024),
        analysisEnabled: true,
        currDepth: 23,
        mouseRight: false,
        mouse: {
            i: null,
            j: null,
            x1: null,
            y1: null,
            x2: null,
            y2: null,
        },
        annotations: [],
        annotationPreview: null,
        firstRun: true,
        allowLogin: false,
        config: {
            get theme() {
                return localStorage.getItem('theme') ?? 'system';
            },

            set theme(val) {
                localStorage.setItem('theme', val);
                document.querySelector('html')?.setAttribute('theme', val);
            },

            get colorEven() {
                return localStorage.getItem('colorEven') ?? '#d4d4d4';
            },

            set colorEven(val) {
                localStorage.setItem('colorEven', val);
            },

            get colorOdd() {
                return localStorage.getItem('colorOdd') ?? '#404040';
            },

            set colorOdd(val) {
                localStorage.setItem('colorOdd', val);
            },

            get engineElo() {
                return parseInt(localStorage.getItem('engineElo') ?? '1500');
            },

            set engineElo(val) {
                localStorage.setItem('engineElo', val);
            },

            get depth() {
                return parseInt(localStorage.getItem('depth') ?? '23');
            },

            set depth(val) {
                localStorage.setItem('depth', val);
            },

            get threads() {
                return parseInt(localStorage.getItem('threads') ?? '1');
            },

            set threads(val) {
                localStorage.setItem('threads', val);
            },

            get hash() {
                return parseInt(localStorage.getItem('hash') ?? '16');
            },

            set hash(val) {
                localStorage.setItem('hash', val);
            },
        },
    }),

    mounted() {
        this.reset();
        this.connection.gameid = new URLSearchParams(new URL(window.location.href).search).get('gameid');
        this.game.gamemode = new URLSearchParams(new URL(window.location.href).search).get('gamemode');
        this.connection.secret = localStorage.getItem('playerSecret');

        if (['mp', 'spec'].includes(this.game.gamemode)) {
            this.createGame = false;
            this.selectVariant = true;
        }

        document.addEventListener('keydown', e => {
            const listeners = {
                ArrowUp: () => {
                    this.boardAt(-1);
                },

                ArrowLeft: () => {
                    this.boardAt(this.game.currMove - 1);
                },

                ArrowRight: () => {
                    this.boardAt(this.game.currMove + 1);
                },

                ArrowDown: () => {
                    this.boardAt(this.game.movements.length - 1);
                },
            };

            e.key in listeners && listeners[e.key]();
        });

        simd().then(simdSupported => {
            if (simdSupported) {
                const js = importScript('node_modules/stockfish-nnue.wasm/stockfish.js');
                this.engine.ver = '13';
                this.engine.tag = 'NNUE';

                js.addEventListener('load', () => this.setupStockfish());
            } else {
                this.setupStockfish();
            }
        });
    },

    computed: {
        radius() {
            return parseInt(getComputedStyle(document.querySelector('table.chessboard')).fontSize) * 4 / 2 - 2;
        },
    },

    methods: {
        matchHistory() {
            const matchHistory = JSON.parse(localStorage.getItem('gameHistory'));
            return matchHistory;
        },

        parseS(s) {
            if (s === Infinity) {
                return '∞';
            }

            return `${Math.floor(s / 60).toString().padStart(2, '0')}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
        },

        openWorker() {
            if (worker) {
                return;
            }

            worker = new Worker('js/engine.worker.js', {type: "module"});

            worker.addEventListener('message', e => {
                const [score, move, d] = e.data;
                this.scores[this.game.currMove] = {score: score === Infinity ? '∞' : score === -Infinity ? '-∞' : score, depth: d, bestMove: null};
                move && this.drawBestMove(move.i, move.j, move.newI, move.newJ, this.game.playerColor);
            }, false);
        },

        terminateWorker() {
            if (!worker) {
                return;
            }

            worker.terminate();
            worker = undefined;
        },

        sendUCI(uci) {
            if (this.engine.name === 'Stockfish') {
                stockfish.postMessage(uci);
            }
        },

        sendToEngine(move = false) {
            if (this.scores[this.game.currMove]?.d === this.config.depth) {
                this.currDepth = this.scores[this.game.currMove]?.d;
                return;
            }

            if (this.engine.name === 'Stockfish') {
                this.sendUCI('stop');

                if (move) {
                    this.engine.calculating = true;
                }

                setTimeout(() => {
                    this.sendUCI(`position fen "${this.game.fen[this.game.currMove + 1]}"`);
                    this.sendUCI(`go move time ${move ? this.game.player2Timer : 30000} depth ${this.config.depth}`);
                }, 100);
                return;
            }

            this.terminateWorker();
            this.openWorker();
            const message = [-Infinity, Infinity, this.config.depth, this.game.fen[this.game.currMove + 1], this.game.currPlayer, null, null];
            worker?.postMessage(message);
        },

        setupStockfish() {
            Stockfish().then(sf => {
                stockfish = sf;

                this.sendUCI('uci');

                stockfish.addMessageListener(e => {
                    console.log(e);
                    if (/option name /.test(e)) {
                        const option = /option name (?<Name>.*) type (?<Type>check|spin|combo|button|string)(?: default ?(?<Default>.+?(?=(?: min| max| var))|.*))?(?:(?: min (?<Min>.*))?(?: max (?<Max>.*)))?/gm.exec(e)?.groups;
                        const vars = e.match(/(?: var (?<Var>.+?(?= var)|.*))/gm);

                        if (option) {
                            this.engine.options[option.Name] = {
                                type: option.Type,
                                default: option.Default,
                                min: option.Min,
                                max: option.Max,
                                vars,
                            };
                        }
                    } else if (/uciok/.test(e)) {
                        this.engine.loaded = true;
                    } else if (/bestmove/g.test(e)) {
                        this.engine.calculating = false;

                        if (/bestmove \(none\)/gm.test(e)) {
                            this.scores[this.game.currMove] = undefined;
                            return;
                        }
                    }

                    const mult = this.game.currPlayer === 'white' ? 1 : -1;
                    const move = /(?<Begin>bestmove) (?<J>[a-z])(?<I>\d)(?<NewJ>[a-z])(?<NewI>\d)/g.exec(e)?.groups ?? /(?<Begin>info) depth (?<Depth>\d+) seldepth \d+ multipv \d+ score (?<Score>mate|cp) (?<ScoreEval>-?\d+) nodes \d+ nps \d+(?: hashfull \d+)?(?: tbhits \d+)? time \d+ pv (?<J>[a-z])(?<I>\d)(?<NewJ>[a-z])(?<NewI>\d)/gm.exec(e)?.groups;

                    if (['sp'].includes(this.game.gamemode)) {
                        move?.Begin === 'bestmove' && this.commitMovement(8 - parseInt(move.I), 'abcdefgh'.indexOf(move.J), 8 - parseInt(move.NewI), 'abcdefgh'.indexOf(move.NewJ));
                        return;
                    }

                    move?.Depth && (this.currDepth = parseInt(move.Depth));
                    move?.Score && (this.scores[this.game.currMove] = {d: this.currDepth, bestMove: null});
                    move?.Score && move?.ScoreEval && (this.scores[this.game.currMove] = {...this.scores[this.game.currMove], score: move.Score === 'mate' ? `#${mult * parseInt(move?.ScoreEval)}` : mult * parseFloat(move.ScoreEval) / 100});
                    move && this.drawBestMove(8 - parseInt(move.I), 'abcdefgh'.indexOf(move.J), 8 - parseInt(move.NewI), 'abcdefgh'.indexOf(move.NewJ), this.game.playerColor);
                });
            }).catch(e => this.analysisEnabled = false);
        },

        scrollToResult() {
            setTimeout(() => {
                document.querySelector('.sidebar-right .history .movement.current')?.scrollIntoView({behavior: 'smooth', block: 'nearest'});
            }, 100);
        },

        /**
         *
         * @param {string[]} movements
         * @param {string} result
         * @return {string}
         */
        movementsToPGN(movements, result) {
            return movements.reduce((acc, m, i) => acc + (i % 2 == 0 ? `${i / 2 + 1}. ${m}` : ` ${m} `), '') + ` ${result}`;
        },

        /**
         *
         * @param {string} str
         */
        copyToClipboard(str) {
            navigator.clipboard.writeText(str);
        },

        takenPiecesW() {
            const sortArray = ['P', 'N', 'B', 'R', 'Q'];
            return (this.game.takenPieces[this.game.currMove]?.filter(p => p.color === 'white') ?? []).sort((a, b) => sortArray.indexOf(a.char) - sortArray.indexOf(b.char));
        },

        takenPiecesB() {
            const sortArray = ['P', 'N', 'B', 'R', 'Q'];
            return (this.game.takenPieces[this.game.currMove]?.filter(p => p.color === 'black') ?? []).sort((a, b) => sortArray.indexOf(a.char) - sortArray.indexOf(b.char));
        },

        reset() {
            if (this.game.movements.length > 0) {
                const games = JSON.parse(localStorage.getItem('gameHistory') ?? '[]');
                games.push({date: new Date(), won: this.game.won, draw: this.game.draw, gamemode: this.game.gamemode, movements: this.game.movements, result: this.game.result});

                localStorage.setItem('gameHistory', JSON.stringify(games));
            }

            this.allowLogin = false;
            this.connection.socket?.readyState === this.connection.socket?.OPEN && this.connection.socket?.close();

            clearInterval(this.game.player1TimerFn);
            clearInterval(this.game.player2TimerFn);

            this.game.start = false;
            this.game.gamemode = null;
            this.game.won = null;
            this.game.draw = false;
            this.game.playerColor = 'white';
            this.game.currPlayer = 'white';
            this.game.timePlayer = 10;
            this.game.timeInc = 5;
            this.game.player1Timer = 0;
            this.game.player1TimerFn = null;
            this.game.player2Timer = 0;
            this.game.player2TimerFn = null;
            this.game.lastMoved = null;
            this.game.takenPieces = [];
            this.game.movements = [];
            this.game.fen = ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'];
            this.game.currentMove = [];
            this.game.noCaptureOrPawnsQ = 0;
            this.game.result = null;
            this.game.canRequestDraw = true;
            this.game.currMove = -1;

            this.scores = [];
            this.validMoves = [];
            this.selectVariant = false;
            this.selectMode = false;
            this.createGame = false;
            this.clearAnnotations();

            this.connection.gameid = null;
            this.connection.canStart = false;
            this.regenerateArray();

            !this.firstRun && history.pushState({}, 'Chess', `${this.page}/`);
            this.firstRun = false;
        },

        startGame() {
            if (!this.config.engineElo || this.config.engineElo < 100 || this.config.engineElo > 3200) {
                alert('Preencha um valor válido entre 100 e 3200');
                document.querySelector('#inputEngineElo')?.focus();

                return;
            }

            if (!this.game.timePlayer || this.game.timePlayer <= 0 && this.game.timePlayer !== -1 || this.game.timePlayer > 180) {
                alert('Preencha um valor válido entre 1 e 180');
                document.querySelector('#inputTimePlayer')?.focus();

                return;
            }

            if (!this.game.timePlayer || this.game.timeInc < 0 || this.game.timeInc > 180) {
                alert('Preencha um valor válido entre 0 e 180');
                document.querySelector('#inputTimeInc')?.focus();

                return;
            }

            this.allowLogin = true;

            this.game.timePlayer === -1 && (this.game.timePlayer = Infinity);
            ['mp', 'spec'].includes(this.game.gamemode) && this.loginServer();

            this.sendUCI(`setoption name Threads value ${this.config.threads}`);
            this.sendUCI(`setoption name Hash value ${this.config.hash}`);
            ['sp'].includes(this.game.gamemode) && this.sendUCI(`setoption name UCI_Elo value ${this.config.engineElo}`) && this.sendUCI('setoption name UCI_AnalyseMode value false');
            ['spec', 'analysis'].includes(this.game.gamemode) && this.sendUCI(`setoption name UCI_Elo value ${this.engine.options['UCI_Elo'].max}`) && this.sendUCI('setoption name UCI_AnalyseMode value true');

            this.game.start = true;
        },

        watch(game) {
            this.game.gamemode = 'analysis';
            this.game.start = true;
            this.game.timePlayer = Infinity;

            game.movements.forEach(movement => {
                const {i, j, newI, newJ, promoteTo} = Chess.pgnToCoord(movement, this.game.board, this.game.currPlayer, this.game.lastMoved);

                this.game.promoteTo = promoteTo;
                this.commitMovement(i, j, newI, newJ, {checkValid: false, playSound: false, scrollToMovement: false});
            });

            this.game.currMove = game.movements.length - 1;

            this.scrollToResult();
        },

        /**
         *
         * @param {number} n
         * @param {boolean} [override=false]
         */
        boardAt(n, override = false) {
            if (n < -1 || n > this.game.movements.length - 1) {
                return;
            }

            if (['sp', 'smp', 'mp', 'spec'].includes(this.game.gamemode) && !this.game._board && !override) {
                this.game._board = this.game.board.map(r => [...r]);
            }

            if (n === -1) {
                this.regenerateArray(this.game.fen[0]);
                this.game.currentMove = [];
                this.game.currMove = n;

                if (this.analyze && ['spec', 'analysis'].includes(this.game.gamemode)) {
                    this.sendToEngine();
                }

                return;
            }

            this.regenerateArray(this.game.fen[n]);
            this.game.currentMove = [];

            const {i, j, newI, newJ, promoteTo} = Chess.pgnToCoord(this.game.movements[n], this.game.board, this.game.currPlayer, this.game.lastMoved);

            this.game.promoteTo = promoteTo;
            this.commitMovement(i, j, newI, newJ, {checkValid: false, saveMovement: false});
            this.game.currMove = n;

            if (!override && this.game._board && this.game.movements.length - 1 === n) {
                this.game.board = this.game._board;
                this.game._board = null;
            }

            if (this.analyze && ['spec', 'analysis'].includes(this.game.gamemode)) {
                this.sendToEngine();
            }
        },

        async loginServer() {
            if (!this.allowLogin) {
                return;
            }

            localStorage.setItem('playerName', this.playerName);

            const commands = {
                commitMovement: async (message) => {
                    if (this.game._board) {
                        this.game.board = this.game._board;
                        this.game._board = null;
                    }

                    const {i, j, newI, newJ, game: {currPlayer, promoteTo, player1Timer, player2Timer}} = message;
                    this.game.promoteTo = promoteTo;
                    this.commitMovement(i, j, newI, newJ, {checkValid: false});

                    this.game.currPlayer = currPlayer;

                    this.game.player1Timer = player1Timer;
                    this.game.player2Timer = player2Timer;

                    if (this.analyze && ['spec'].includes(this.game.gamemode)) {
                        this.sendToEngine();
                    }
                },

                createGame: async (message) => {
                    const {gameid, game: {playerColor, currPlayer, secret}} = message;

                    this.connection.gameid = gameid;
                    this.game.currPlayer = currPlayer;
                    this.game.playerColor = playerColor;
                    history.pushState({}, `Chess Game ${gameid}`, `${this.page}/?gameid=${gameid}&gamemode=mp`);
                    localStorage.setItem('playerSecret', secret);
                },

                joinGame: async (message) => {
                    const {game: {timePlayer, timeInc, movements, playerColor, currPlayer, player1Timer, player2Timer, secret}} = message;

                    this.game.playerColor = this.game.currPlayer = 'white';

                    this.game.timePlayer = timePlayer === -1 ? Infinity : timePlayer;
                    this.game.timeInc = timeInc;

                    movements.forEach(({i, j, newI, newJ}) => {
                        this.commitMovement(i, j, newI, newJ, {checkValid: false, playSound: false});
                    });

                    const lastMovement = movements[movements.length - 1];
                    this.game.currentMove = !lastMovement ? [] : [[lastMovement.i, lastMovement.j], [lastMovement.newI, lastMovement.newJ]];
                    this.game.currPlayer = currPlayer;
                    this.game.playerColor = playerColor;

                    this.game.player1Timer = player1Timer;
                    this.game.player2Timer = player2Timer;
                    localStorage.setItem('playerSecret', secret);

                    if (this.analyze && ['spec'].includes(this.game.gamemode)) {
                        this.sendToEngine();
                    }
                },

                start: async (message) => {
                    const {game: {player1Name, player2Name}} = message;
                    this.connection.canStart = true;

                    this.game.playerNames = {white: player1Name, black: player2Name};
                },

                gameNotFound: async (message) => {
                    const {gameid} = message;

                    alert(`Jogo ${gameid} não encontrado.`);
                    this.reset();
                    this.connection.secret = null;
                    localStorage.removeItem('playerSecret');
                },

                gameFull: async (message) => {
                    const {gameid} = message;

                    alert(`O jogo ${gameid} está cheio.`);
                    this.reset();
                    this.connection.secret = null;
                    localStorage.removeItem('playerSecret');
                },

                alreadyConnected: async (message) => {
                    const {gameid} = message;

                    alert(`Você já está no jogo ${gameid}.`);
                    this.reset();
                },

                playerDisconnected: async (message) => {
                    this.connection.canStart = false;
                },

                requestUndo: async (message) => {
                    this.connection.socket.send(JSON.stringify({
                        command: confirm('Voltar jogada?') ? 'approveUndo' : 'rejectUndo',
                    }));
                },

                undo: async (message) => {
                    this.undo();
                },

                forfeit: async (message) => {
                    const {won} = message;

                    this.forfeit(won);
                },

                requestDraw: async (message) => {
                    this.connection.socket.send(JSON.stringify({
                        command: confirm('Empatar?') ? 'approveDraw' : 'rejectDraw',
                    }));
                },

                draw: async (message) => {
                    this.draw();
                }
            };

            const socket = createSocket(this.connection.protocol, this.connection.address, commands);
            this.connection.socket = socket;

            await new Promise((resolve, reject) => {
                if (socket.readyState === socket.OPEN) {
                    return resolve(true);
                }

                socket.addEventListener('open', () => {
                    resolve(true);
                });
            });

            socket.addEventListener('close', () => {
                socket.readyState === socket.OPEN && socket.close();
                this.loginServer();
            });

            if (!this.connection.gameid) {
                socket.send(JSON.stringify({
                    command: 'createGame',
                    playerName: this.playerName,
                    timePlayer: this.game.timePlayer === Infinity ? -1 : this.game.timePlayer,
                    timeInc: this.game.timeInc,
                }));
            } else if (this.game.gamemode === 'mp') {
                socket.send(JSON.stringify({
                    command: 'joinGame',
                    gameid: this.connection.gameid,
                    playerName: this.playerName,
                    secret: this.connection.secret,
                }));
            } else {
                socket.send(JSON.stringify({
                    command: 'spectate',
                    gameid: this.connection.gameid,
                }));
            }
        },

        undo() {
            this.sendUCI('stop');

            this.boardAt(this.game.currMove - 1, true);
            this.game.movements.pop();
            this.game.fen.pop();
            this.game.takenPieces.pop();
        },

        forfeit(won) {
            this.sendUCI('stop');

            if (won === 'black') {
                this.result('Pretas venceram', 'desistência');

                this.game.result = '0-1';

                this.game.won = 'black';
                this.game.draw = false;
            } else {
                this.result('Brancas venceram', 'desistência');

                this.game.result = '1-0';

                this.game.won = 'white';
                this.game.draw = false;
            }
        },

        draw() {
            this.sendUCI('stop');

            this.result('Empate', 'solicitado');

            this.game.result = '½-½';

            this.game.won = null;
            this.game.draw = true;
        },

        /**
         *
         * @param {string} fen
         */
        regenerateArray(fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
            this.game.lastMoved = null;
            this.game.board = Chess.generateArray(fen);
            this.game.currPlayer = / (?<CurrPlayer>[wb])/.exec(fen)?.groups.CurrPlayer === 'w' ? 'white' : 'black';
            this.game.gamemode === 'smp' && (this.game.playerColor = this.game.currPlayer);

            const enPassant = / [wb] K?Q?k?q? (?<EnPassant>(?:-|[a-z]\d))/.exec(fen)?.groups.EnPassant;
            if (enPassant && enPassant !== '-') {
                const i = (8 - parseInt(enPassant[enPassant.length - 1])) === 5 ? 4 : 3;
                const j = 'abcdefgh'.indexOf(enPassant[0]);

                this.game.lastMoved = this.game.board[i][j];
            }
        },

        pointsAdvantage(playerColor) {
            const pointsW = this.takenPiecesB().reduce((acc, p) => acc + (p.char === 'Q' ? 9 : p.char === 'R' ? 5 : p.char === 'N' ? 3 : p.char === 'B' ? 3 : p.char === 'P' ? 1 : 0), 0);
            const pointsB = this.takenPiecesW().reduce((acc, p) => acc + (p.char === 'Q' ? 9 : p.char === 'R' ? 5 : p.char === 'N' ? 3 : p.char === 'B' ? 3 : p.char === 'P' ? 1 : 0), 0);

            return playerColor === 'white' ? (pointsW > pointsB ? `+${pointsW - pointsB}` : '') :
                playerColor === 'black' ? (pointsB > pointsW ? `+${pointsB - pointsW}` : '') : '';
        },

        clickPiece(i, j) {
            const piece = this.game.board[i][j];
            if (this.game._board || ['analysis', 'spec'].includes(this.game.gamemode) || !((this.click.piece ?? piece)?.color === this.game.playerColor && this.game.playerColor === this.game.currPlayer)) {
                return;
            }

            if (this.click.clicked) {
                this.showPiece(this.drag.i, this.drag.j);
                this.click.clicked = false;
                this.validMoves = [];

                this.drag.newI = i;
                this.drag.newJ = j;

                if (this.drag.i === this.drag.newI && this.drag.j === this.drag.newJ) {
                    return;
                }

                if (piece?.color !== this.game.board[this.drag.i][this.drag.j]?.color) {
                    this.drop(i, j);
                    return;
                }
            }

            this.click.clicked = true;
            this.click.piece = piece;
            this.drag.i = i;
            this.drag.j = j;

            this.hidePiece(i, j);

            for (let newI = 0; newI < this.game.board.length; newI++) {
                for (let newJ = 0; newJ < this.game.board[newI].length; newJ++) {
                    if (Chess.isValidMove(piece, i, j, newI, newJ, this.game.board, this.game.lastMoved)) {
                        this.validMoves.push([newI, newJ]);
                    }
                }
            }
        },

        dragPiece(i, j) {
            if (this.drag.dragging) {
                return;
            }

            const piece = this.game.board[i][j];

            this.showPiece(this.drag.i, this.drag.j);
            this.validMoves = [];
            this.drag.dragging = true;
            this.drag.piece = piece;
            this.click.clicked = false;
            this.drag.i = i;
            this.drag.j = j;

            this.hidePiece(i, j);

            for (let newI = 0; newI < this.game.board.length; newI++) {
                for (let newJ = 0; newJ < this.game.board[newI].length; newJ++) {
                    if (Chess.isValidMove(piece, i, j, newI, newJ, this.game.board, this.game.lastMoved)) {
                        this.validMoves.push([newI, newJ]);
                    }
                }
            }
        },

        setDragImage(i, j, e) {
            const img = document.createElement('img');
            img.src = document.querySelector(`#cell_${i}_${j} img`)?.src;

            const cell = document.querySelector(`#cell_${i}_${j} img`)?.getBoundingClientRect();

            const x = e.clientX - cell?.left;
            const y = e.clientY - cell?.top;

            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text', e.target.id);
            e.dataTransfer.setDragImage(img, x, y);
            document.querySelector(':root')?.classList.add('grabbing');
        },

        hidePiece(i, j) {
            document.querySelector(`#cell_${i}_${j}`)?.classList.add('moving');
        },

        showPiece(i, j) {
            document.querySelector(`#cell_${i}_${j}`)?.classList.remove('moving');
        },

        dragEnter(i, j, e) {
            if (!this.drag.dragging) {
                return;
            }

            if (this.drag.newI === i && this.drag.newJ === j) {
                return;
            }

            document.querySelector(`#cell_${this.drag.newI}_${this.drag.newJ}`)?.classList.remove('hover');

            this.drag.newI = i;
            this.drag.newJ = j;

            const piece = this.game.board[this.drag.i][this.drag.j];

            if (!Chess.isValidMove(piece, this.drag.i, this.drag.j, this.drag.newI, this.drag.newJ, this.game.board, this.game.lastMoved)) {
                return;
            }

            document.querySelector(`#cell_${this.drag.newI}_${this.drag.newJ}`)?.classList.add('hover');
        },

        dragOver(i, j, e) {
            e.dataTransfer.dropEffect = 'none';

            if (!this.drag.dragging) {
                return;
            }

            const piece = this.game.board[this.drag.i][this.drag.j];

            if (!Chess.isValidMove(piece, this.drag.i, this.drag.j, this.drag.newI, this.drag.newJ, this.game.board, this.game.lastMoved)) {
                return;
            }

            e.dataTransfer.dropEffect = 'move';
        },

        dragEnd(i, j) {
            if (!this.drag.dragging) {
                return;
            }

            this.drag.dragging = false;
            this.showPiece(this.drag.i, this.drag.j);
            this.showPiece(this.drag.newI, this.drag.newJ);

            document.querySelector(`#cell_${this.drag.newI}_${this.drag.newJ}`)?.classList.remove('hover');
            this.validMoves = [];

            document.querySelector(':root')?.classList.remove('grabbing');
        },

        drop(i, j) {
            const piece = this.drag.piece ?? this.click.piece;
            if (!piece) {
                return;
            }

            if (piece.char === 'P' && [0, 7].includes(this.drag.newI) && Chess.isValidMove(piece, this.drag.i, this.drag.j, this.drag.newI, this.drag.newJ, this.game.board, this.game.lastMoved)) {
                do {
                    this.game.promoteTo = prompt('Promover para: ');
                } while (!['Q', 'B', 'N', 'R'].includes(this.game.promoteTo));
            }

            if (this.connection.socket && !this.game._board) {
                this.connection.socket.send(JSON.stringify({
                    command: 'commitMovement',
                    i: this.drag.i,
                    j: this.drag.j,
                    newI: this.drag.newI,
                    newJ: this.drag.newJ,
                    promoteTo: this.game.promoteTo,
                }));
            }

            if (['sp', 'smp'].includes(this.game.gamemode)) {
                this.commitMovement(this.drag.i, this.drag.j, this.drag.newI, this.drag.newJ);
            }

            this.game.promoteTo = null;
            this.drag.piece = null;
            this.click.piece = null;
        },

        /**
         *
         * @param {number} i
         * @param {number} j
         * @param {number} newI
         * @param {number} newJ
         * @param {Object} options
         * @param {boolean} [options.checkValid=true]
         * @param {boolean} [options.saveMovement=true]
         * @param {boolean} [options.playSound=true]
         * @param {boolean} [options.scrollToMovement=true]
         */
        commitMovement(i, j, newI, newJ, {checkValid = true, saveMovement = true, playSound = true, scrollToMovement = true} = {}) {
            const piece = this.game.board[i][j];
            if (!piece) {
                debugger;
                return;
            }

            if (this.game.gamemode !== 'analysis' && this.game.result) {
                return;
            }

            const duplicate = Chess.findDuplicateMovement(piece, i, j, newI, newJ, this.game.board, this.game.lastMoved);

            const move = Chess.move(i, j, newI, newJ, this.game.board, this.game.currPlayer, this.game.lastMoved, this.game.promoteTo, checkValid);
            if (!move) {
                return;
            }

            const {capture = false, enPassant = false, promotion = false, castling = 0, check = false, takenPiece = null} = move;

            const {piece: KingW} = Chess.findPiece(this.game.board, (p => p?.char === 'K' && p?.color === 'white'));
            const {piece: KingB} = Chess.findPiece(this.game.board, (p => p?.char === 'K' && p?.color === 'black'));

            KingW && (KingW.checked = (this.game.currPlayer === 'black' && check));
            KingB && (KingB.checked = (this.game.currPlayer === 'white' && check));

            saveMovement && this.game.takenPieces.push([...(this.game.takenPieces[this.game.takenPieces.length - 1] ?? []), takenPiece].filter(p => p !== null));

            if (playSound) {
                const audio = new Audio(capture ? 'assets/capture.ogg' : 'assets/move.ogg');
                audio.play();
            }

            if (saveMovement) {
                const fen = Chess.boardToFEN(this.game.board, false, piece, this.game.currPlayer === 'white' ? 'black' : 'white', newI, newJ, true, this.game.noCaptureOrPawnsQ, this.game.movements);

                this.game.fen.push(fen);
            }

            const {won, draw, result, reason} = Chess.result(this.game.board, this.game.currPlayer, this.game.lastMoved, this.game.noCaptureOrPawnsQ, this.game.fen);
            this.game.won = won;
            this.game.draw = draw;
            result && (this.game.result = result);

            if (result) {
                const res = won ? (won === 'white' ? 'Brancas' : 'Pretas') + ' venceram' : draw ? 'Empate' : '';
                const desc =
                    reason === 'checkmate' ? 'Xeque-mate' :
                        reason === 'stalemate' ? 'Afogamento' :
                            reason === 'insufficientMaterial' ? 'Material insuficiente' :
                                reason === 'seventyFive' ? 'Regra dos 75 movimentos' :
                                    reason === 'fivefold' ? 'Repetição quíntupla' : '';
                this.game.gamemode !== 'analysis' && this.result(res, desc);
            }

            if (saveMovement) {
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
                    mov += this.game.promoteTo;
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

                this.game.movements.push(mov);

                this.game.currMove++;
            }

            if (!capture && piece.char !== 'P') {
                this.game.noCaptureOrPawnsQ++;
            } else {
                this.game.noCaptureOrPawnsQ = 0;
            }

            this.game.currPlayer = (this.game.currPlayer === 'white' ? 'black' : 'white');

            if (this.game.gamemode === 'smp') {
                this.game.playerColor = this.game.currPlayer;
            }

            this.game.lastMoved = piece;

            this.game.currentMove = [[i, j], [newI, newJ]];

            if (saveMovement) {
                this.game.player1TimerFn && clearInterval(this.game.player1TimerFn);
                this.game.player2TimerFn && clearInterval(this.game.player2TimerFn);
                this.game.player1TimerFn = null;
                this.game.player2TimerFn = null;
            }

            if (this.game.result) {
                localStorage.removeItem('playerSecret');
                this.connection.secret = null;
            }

            if (saveMovement && this.game.movements.length >= 2 && !this.game.result) {
                if (this.game.currPlayer === 'white') {
                    this.game.player1TimerFn = setInterval(() => {
                        this.game.player1Timer++;
                        if (this.game.player1Timer >= this.game.timePlayer * 60) {
                            this.result('Pretas venceram', 'tempo esgotado');

                            this.game.won = 'black';
                            this.game.result = '0–1';
                        }
                    }, 1000);

                    this.game.movements.length > 2 && (this.game.player2Timer -= this.game.timeInc);
                } else {
                    this.game.player2TimerFn = setInterval(() => {
                        this.game.player2Timer++;
                        if (this.game.player2Timer >= this.game.timePlayer * 60) {
                            this.result('Brancas venceram', 'tempo esgotado');

                            this.game.won = 'white';
                            this.game.result = '1–0';
                        }
                    }, 1000);

                    this.game.movements.length > 2 && (this.game.player1Timer -= this.game.timeInc);
                }
            }

            if (['sp'].includes(this.game.gamemode) && this.game.currPlayer === 'black') {
                this.sendToEngine(true);
            }

            if (scrollToMovement) {
                this.scrollToResult();
            }
        },

        drawBestMove(i, j, newI, newJ, playerColor) {
            if (!this.scores[this.game.currMove]) {
                return;
            }

            const {bestMove} = this.scores[this.game.currMove];
            if (bestMove?.i === i && bestMove?.j === j && bestMove?.newI === newI && bestMove?.newJ === newJ) {
                return;
            }

            let cell1;
            if (playerColor === 'white') {
                cell1 = document.querySelector(`#cell_${i}_${j}`)?.getBoundingClientRect();
            } else {
                cell1 = document.querySelector(`#cell_${7 - i}_${7 - j}`)?.getBoundingClientRect();
            }

            let cell2;
            if (playerColor === 'white') {
                cell2 = document.querySelector(`#cell_${newI}_${newJ}`)?.getBoundingClientRect();
            } else {
                cell2 = document.querySelector(`#cell_${7 - newI}_${7 - newJ}`)?.getBoundingClientRect();
            }

            const table = document.querySelector('table.chessboard')?.getBoundingClientRect();

            const x1 = Math.floor(Math.floor(cell1?.left) - Math.floor(table?.left) + (Math.floor(cell1?.width) ?? 0) / 2);
            const y1 = Math.floor(Math.floor(cell1?.top) - Math.floor(table?.top) + (Math.floor(cell1?.height) ?? 0) / 2);
            const x2 = Math.floor(Math.floor(cell2?.left) - Math.floor(table?.left) + (Math.floor(cell2?.width) ?? 0) / 2);
            const y2 = Math.floor(Math.floor(cell2?.top) - Math.floor(table?.top) + (Math.floor(cell2?.height) ?? 0) / 2);

            this.scores[this.game.currMove].bestMove = {i, j, newI, newJ, x1, y1, x2, y2};
        },

        /**
         *
         * @param {string} result
         * @param {string} reason
         */
        result(result, reason) {
            setTimeout(() => {
                alert(`${result} (${reason})`);
                this.reset();
            }, 500);
        },

        requestUndo() {
            if (!confirm('Soliciar voltar jogada?')) {
                return;
            }

            if (this.connection.socket) {
                this.connection.socket.send(JSON.stringify({
                    command: 'requestUndo',
                }));
            }

            if (['sp', 'smp'].includes(this.game.gamemode)) {
                this.undo();
            }
        },

        requestForfeit() {
            if (!confirm('Desistir?')) {
                return;
            }

            if (this.connection.socket) {
                this.connection.socket.send(JSON.stringify({
                    command: 'forfeit',
                }));
            }

            if (['sp', 'smp'].includes(this.game.gamemode)) {
                this.forfeit(this.game.currPlayer === 'white' ? 'black' : 'white');
            }
        },

        requestDraw() {
            if (!this.game.canRequestDraw) {
                return;
            }

            if (!confirm('Solicitar empate?')) {
                return;
            }

            if (this.connection.socket) {
                this.connection.socket.send(JSON.stringify({
                    command: 'requestDraw',
                }));
            }

            if (['sp', 'smp'].includes(this.game.gamemode)) {
                this.draw();
            }
        },

        isPieceMove(i, j, newI, newJ) {
            return (i === newI || j === newJ) || // Rook
                (Math.abs(newI - i) === Math.abs(newJ - j)) || // Bishop
                (Math.abs(newI - i) === 2 && Math.abs(newJ - j) === 1 || Math.abs(newI - i) === 1 && Math.abs(newJ - j) === 2); // Knight
        },

        startArrow(i, j, shift, alt) {
            this.mouseRight = true;
            this.shift = shift;
            this.alt = alt;

            let cell;
            if (this.game.playerColor === 'white') {
                cell = document.querySelector(`#cell_${i}_${j}`)?.getBoundingClientRect();
            } else {
                cell = document.querySelector(`#cell_${7 - i}_${7 - j}`)?.getBoundingClientRect();
            }

            const table = document.querySelector('table.chessboard')?.getBoundingClientRect();

            this.mouse.i = i;
            this.mouse.j = j;
            this.mouse.x1 = Math.floor(Math.floor(cell?.left) - Math.floor(table?.left) + (Math.floor(cell?.width) ?? 0) / 2);
            this.mouse.y1 = Math.floor(Math.floor(cell?.top) - Math.floor(table?.top) + (Math.floor(cell?.height) ?? 0) / 2);
            this.mouse.x2 = this.mouse.x1;
            this.mouse.y2 = this.mouse.y1;

            const color = this.alt ? 'b' : this.shift ? 'r' : 'g';

            this.annotationPreview = {x1: this.mouse.x1, y1: this.mouse.y1, x2: this.mouse.x1, y2: this.mouse.y1, color};
        },

        moveArrow(i, j) {
            if (!this.mouseRight) {
                return;
            }

            let cell;
            if (this.game.playerColor === 'white') {
                cell = document.querySelector(`#cell_${i}_${j}`)?.getBoundingClientRect();
            } else {
                cell = document.querySelector(`#cell_${7 - i}_${7 - j}`)?.getBoundingClientRect();
            }

            const table = document.querySelector('table.chessboard')?.getBoundingClientRect();

            if (!this.isPieceMove(this.mouse.i, this.mouse.j, i, j)) {
                return;
            }

            this.mouse.x2 = Math.floor(Math.floor(cell?.left) - Math.floor(table?.left) + (Math.floor(cell?.width) ?? 0) / 2);
            this.mouse.y2 = Math.floor(Math.floor(cell?.top) - Math.floor(table?.top) + (Math.floor(cell?.height) ?? 0) / 2);

            const color = this.annotationPreview.color;

            this.annotationPreview = {x1: this.mouse.x1, y1: this.mouse.y1, x2: this.mouse.x2, y2: this.mouse.y2, color};
        },

        endArrow(i, j) {
            const color = this.annotationPreview.color;
            this.annotationPreview = null;

            let cell;
            if (this.game.playerColor === 'white') {
                cell = document.querySelector(`#cell_${i}_${j}`)?.getBoundingClientRect();
            } else {
                cell = document.querySelector(`#cell_${7 - i}_${7 - j}`)?.getBoundingClientRect();
            }

            const table = document.querySelector('table.chessboard')?.getBoundingClientRect();

            if (this.isPieceMove(this.mouse.i, this.mouse.j, i, j)) {
                this.mouse.x2 = Math.floor(Math.floor(cell?.left) - Math.floor(table?.left) + (Math.floor(cell?.width) ?? 0) / 2);
                this.mouse.y2 = Math.floor(Math.floor(cell?.top) - Math.floor(table?.top) + (Math.floor(cell?.height) ?? 0) / 2);
            }

            let annotation;
            if (annotation = this.annotations.find(({x1, y1, x2, y2, color: c}) => x1 === this.mouse.x1 && y1 === this.mouse.y1 && x2 === this.mouse.x2 && y2 === this.mouse.y2 && color === c)) {
                this.annotations.splice(this.annotations.indexOf(annotation), 1);
            } else if (annotation = this.annotations.find(({x1, y1, x2, y2, color: c}) => x1 === this.mouse.x1 && y1 === this.mouse.y1 && x2 === this.mouse.x2 && y2 === this.mouse.y2 && color !== c)) {
                annotation.color = color;
            } else {
                this.annotations.push({x1: this.mouse.x1, y1: this.mouse.y1, x2: this.mouse.x2, y2: this.mouse.y2, color});
            }

            this.mouseRight = false;
        },

        clearAnnotations() {
            this.annotations = [];
        },
    },
}).mount('#app');
