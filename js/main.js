'use strict';

import * as Vue from 'https://cdnjs.cloudflare.com/ajax/libs/vue/3.0.5/vue.esm-browser.prod.js';
import * as Chess from './chess.js';
import createSocket from './ws.js';

window.addEventListener('appinstalled', () => {
    console.log('A2HS installed');
});

const app = Vue.createApp({
    data: () => ({
        //page: '',
        page: '/chess',
        connection: {
            //protocol: 'ws',
            protocol: 'wss',
            //address: 'localhost:3000',
            address: 'chessjs-server.herokuapp.com',
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
        shift: false,
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
        config: {
            get theme() {
                return localStorage.getItem('theme') ?? 'system';
            },

            set theme(val) {
                localStorage.setItem('theme', val);
                document.querySelector('html')?.setAttribute('theme', val);
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
    },

    computed: {
        matchHistory() {
            const matchHistory = JSON.parse(localStorage.getItem('gameHistory'));
            return matchHistory;
        },
    },

    methods: {
        parseS(s) {
            if (s === Infinity) {
                return '∞';
            }

            return `${Math.floor(s / 60).toString().padStart(2, '0')}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
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

            this.game.timePlayer === -1 && (this.game.timePlayer = Infinity);
            this.game.gamemode !== 'smp' && this.loginServer();

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

            setTimeout(() => {
                document.querySelector('.sidebar-right .history .result')?.scrollIntoView({behavior: 'smooth', block: 'end'});
            }, 100);
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

            if (['smp', 'mp', 'spec'].includes(this.game.gamemode) && !this.game._board && !override) {
                this.game._board = this.game.board.map(r => [...r]);
            }

            if (n === -1) {
                this.regenerateArray(this.game.fen[0]);
                this.game.currentMove = [];
                this.game.currMove = n;
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
        },

        async loginServer() {
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
                    this.boardAt(this.game.currMove - 1, true);
                    this.game.movements.pop();
                    this.game.fen.pop();
                    this.game.takenPieces.pop();
                },

                forfeit: async (message) => {
                    const {won} = message;

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

                requestDraw: async (message) => {
                    this.connection.socket.send(JSON.stringify({
                        command: confirm('Empatar?') ? 'approveDraw' : 'rejectDraw',
                    }));
                },

                draw: async (message) => {
                    this.result('Empate', 'solicitado');

                    this.game.result = '½-½';

                    this.game.won = null;
                    this.game.draw = true;
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

        dragPiece(i, j) {
            if (this.drag.dragging) {
                return;
            }

            this.drag.dragging = true;
            this.drag.i = i;
            this.drag.j = j;

            this.hidePiece(i, j);
        },

        setDragImage(i, j, e) {
            const img = document.createElement('img');
            img.src = document.querySelector(`#cell_${i}_${j} img`)?.src;

            const cell = document.querySelector(`#cell_${i}_${j} img`)?.getBoundingClientRect();

            const x = e.clientX - cell?.left;
            const y = e.clientY - cell?.top;

            e.dataTransfer.dropEffect = 'move';
            e.dataTransfer.setDragImage(img, x, y);
        },

        hidePiece(i, j) {
            document.querySelector(`#cell_${i}_${j}`)?.classList.add('moving');
        },

        dragOver(i, j) {
            if (this.drag.newI === i && this.drag.newJ === j) {
                return;
            }

            document.querySelector(`#cell_${this.drag.newI}_${this.drag.newJ}`)?.classList.remove('hover');

            this.drag.newI = i;
            this.drag.newJ = j;

            const board_cell = this.game.board[this.drag.i][this.drag.j];

            if (!Chess.isValidMove(board_cell, this.drag.i, this.drag.j, this.drag.newI, this.drag.newJ, this.game.board, this.game.lastMoved)) {
                return;
            }

            document.querySelector(`#cell_${i}_${j}`)?.classList.add('hover');
        },

        dragEnd(i, j) {
            document.querySelector(`#cell_${this.drag.i}_${this.drag.j}`)?.classList.remove('moving');
            document.querySelector(`#cell_${this.drag.newI}_${this.drag.newJ}`)?.classList.remove('moving');

            document.querySelector(`#cell_${this.drag.newI}_${this.drag.newJ}`)?.classList.remove('hover');
        },

        drop(board_cell, i, j) {
            this.drag.dragging = false;

            if (this.game.board[this.drag.i][this.drag.j].char === 'P' && [0, 7].includes(this.drag.newI) && Chess.isValidMove(this.game.board[this.drag.i][this.drag.j], this.drag.i, this.drag.j, this.drag.newI, this.drag.newJ, this.game.board, this.game.lastMoved)) {
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

            if (this.game.gamemode === 'smp') {
                this.commitMovement(this.drag.i, this.drag.j, this.drag.newI, this.drag.newJ);
            }

            this.game.promoteTo = null;
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

            if (this.game.gamemode !== 'analysis' && this.game.result) {
                return;
            }

            if (newI === i && newJ === j) {
                return;
            }

            if (checkValid) { // Trust the Server, do not check movement validness again
                if (!Chess.isValidMove(piece, i, j, newI, newJ, this.game.board, this.game.lastMoved)) {
                    return;
                }
            }

            let capture = false;
            let enPassant = false;
            let promotion = false;
            let castling = 0;
            let check = false;
            let checkMate = false;

            let takenPiece = this.game.board[newI][newJ]; // Capture
            if (piece.char === 'P' && !takenPiece && newJ !== j && ((piece.color === 'white' && i === 3) || (piece.color === 'black' && i === 4))) {
                enPassant = true; // En Passant Capture
                takenPiece = this.game.board[i][newJ];
                this.game.board[i][newJ] = null;
            }

            capture = !!takenPiece;

            const boardCopy = this.game.board.map(r => [...r]);

            this.game.board[i][j] = null;
            this.game.board[newI][newJ] = piece;

            if (piece.char === 'P' && [0, 7].includes(newI)) { // Promotion
                Chess.promove(piece, newI, newJ, this.game.promoteTo, this.game.board);
                promotion = true;
            }

            if (piece.char === 'K' && Math.abs(newJ - j) === 2) {
                if (newJ > j) {
                    const rook = this.game.board[i][7];
                    this.game.board[i][j + 1] = rook;
                    this.game.board[i][7] = null;
                    castling = 1;
                } else {
                    const rook = this.game.board[i][0];
                    this.game.board[i][j - 1] = rook;
                    this.game.board[i][0] = null;
                    castling = 2;
                }
            }

            const KingW_i = this.game.board.findIndex(row => row.find(p => p?.char === 'K' && p?.color === 'white'));
            const KingW_j = this.game.board[KingW_i].findIndex(p => p?.char === 'K' && p?.color === 'white');
            const KingW = this.game.board[KingW_i][KingW_j];

            const KingB_i = this.game.board.findIndex(row => row.find(p => p?.char === 'K' && p?.color === 'black'));
            const KingB_j = this.game.board[KingB_i].findIndex(p => p?.char === 'K' && p?.color === 'black');
            const KingB = this.game.board[KingB_i][KingB_j];

            if (KingW.checked = Chess.isChecked('white', KingW_i, KingW_j, this.game.board)) {
                if (this.game.currPlayer === 'white') { // Block any movement that would put the King in Check
                    this.game.board = boardCopy;
                    return;
                } else {
                    check = true;
                }
            }

            if (KingB.checked = Chess.isChecked('black', KingB_i, KingB_j, this.game.board)) {
                if (this.game.currPlayer === 'black') { // Block any movement that would put the King in Check
                    this.game.board = boardCopy;
                    return;
                } else {
                    check = true;
                }
            }

            if (piece.char === 'P' && Math.abs(newI - i) === 2) {
                piece.longMove = true; // For En Passant verification
            }

            piece.neverMoved = false;
            saveMovement && this.game.takenPieces.push([...(this.game.takenPieces[this.game.takenPieces.length - 1] ?? []), takenPiece].filter(p => p !== null));

            if (playSound) {
                const audio = new Audio(capture ? 'assets/capture.ogg' : 'assets/move.ogg');
                audio.play();
            }

            if (saveMovement) {
                const fen = Chess.boardToFEN(this.game.board, piece, this.game.currPlayer === 'white' ? 'black' : 'white', newI, newJ, KingW, KingB, this.game.noCaptureOrPawnsQ, this.game.movements);

                this.game.fen.push(fen);
            }

            if (Chess.isCheckMate('white', KingW_i, KingW_j, this.game.board, this.game.lastMoved)) {
                this.game.gamemode !== 'analysis' && this.result('Pretas venceram', 'Cheque Mate');

                this.won = 'black';
                this.draw = false;

                this.game.result = '0-1';

                checkMate = true;
            } else if (Chess.isCheckMate('black', KingB_i, KingB_j, this.game.board, this.game.lastMoved)) {
                this.game.gamemode !== 'analysis' && this.result('Brancas venceram', 'Cheque Mate');

                this.game.won = 'white';
                this.game.draw = false;

                this.game.result = '1-0';

                checkMate = true;
            } else if (Chess.isStaleMate('black', KingB_i, KingB_j, this.game.board, this.game.lastMoved) || Chess.isStaleMate('white', KingW_i, KingW_j, this.game.board, this.game.lastMoved)) {
                this.game.gamemode !== 'analysis' && this.result('Empate', 'afogamento');

                this.game.won = null;
                this.game.draw = true;

                this.game.result = '½–½';
            } else if (Chess.insufficientMaterial(this.game.board)) { // Insufficient Material (K-K, KN-K, KB-K, KB-KB)
                this.game.gamemode !== 'analysis' && this.result('Empate', 'insuficiência material');

                this.game.won = null;
                this.game.draw = true;

                this.game.result = '½–½';
            } else if (this.game.noCaptureOrPawnsQ === 150) { // 75 Movement rule
                this.game.gamemode !== 'analysis' && this.result('Empate', '75 movimentos');

                this.game.won = null;
                this.game.draw = true;

                this.game.result = '½–½';
            } else if (Chess.fivefoldRepetition(this.game.fen)) { // 5 Repetition rule
                this.game.gamemode !== 'analysis' && this.result('Empate', 'repetição quintupla');

                this.game.won = null;
                this.game.draw = true;

                this.game.result = '½–½';
            }

            if (saveMovement) {
                const duplicate = Chess.findDuplicateMovement(piece, i, j, newI, newJ, boardCopy, this.game.lastMoved);
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

                if (enPassant) {
                    mov += ' e.p.';
                }

                if (promotion) {
                    mov += this.game.promoteTo;
                }

                if (checkMate) {
                    this.game.movements.push(mov + '#');
                } else if (check) {
                    this.game.movements.push(mov + '+');
                } else if (castling) {
                    this.game.movements.push(['0-0', '0-0-0'][castling - 1]);
                } else {
                    this.game.movements.push(mov);
                }

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

            this.game.player1TimerFn && clearInterval(this.game.player1TimerFn);
            this.game.player2TimerFn && clearInterval(this.game.player2TimerFn);
            this.game.player1TimerFn = null;
            this.game.player2TimerFn = null;

            if (this.game.result) {
                localStorage.removeItem('playerSecret');
                this.connection.secret = null;
            }

            if (this.game.movements.length >= 2 && !this.game.result) {
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

            if (scrollToMovement) {
                setTimeout(() => {
                    document.querySelector('.sidebar-right .history .movement.current')?.scrollIntoView({behavior: 'smooth', block: 'nearest'});
                }, 100);
            }
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

            if (this.game.gamemode === 'smp') {
                this.boardAt(this.game.currMove - 1, true);
                this.game.movements.pop();
                this.game.fen.pop();
                this.game.takenPieces.pop();
            }
        },

        forfeit() {
            if (!confirm('Desistir?')) {
                return;
            }

            if (this.connection.socket) {
                this.connection.socket.send(JSON.stringify({
                    command: 'forfeit',
                }));
            }

            if (this.game.gamemode === 'smp') {
                if (this.game.currPlayer === 'white') {
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

            if (this.game.gamemode === 'smp') {
                this.result('Empate', 'solicitado');

                this.game.result = '½-½';

                this.game.won = null;
                this.game.draw = true;
            }
        },

        isPieceMove(i, j, newI, newJ) {
            return (i === newI || j === newJ) || // Rook
                (Math.abs(newI - i) === Math.abs(newJ - j)) || // Bishop
                (Math.abs(newI - i) === 2 && Math.abs(newJ - j) === 1 || Math.abs(newI - i) === 1 && Math.abs(newJ - j) === 2); // Knight
        },

        startArrow(i, j, shift) {
            this.mouseRight = true;
            this.shift = shift;

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

            this.annotationPreview = {x1: this.mouse.x1, y1: this.mouse.y1, x2: this.mouse.x1, y2: this.mouse.y1, shift: this.shift};
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

            this.annotationPreview = {x1: this.mouse.x1, y1: this.mouse.y1, x2: this.mouse.x2, y2: this.mouse.y2, shift: this.shift};
        },

        endArrow(i, j) {
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
            if (annotation = this.annotations.find(({x1, y1, x2, y2, shift}) => x1 === this.mouse.x1 && y1 === this.mouse.y1 && x2 === this.mouse.x2 && y2 === this.mouse.y2 && shift === this.shift)) {
                this.annotations.splice(this.annotations.indexOf(annotation), 1);
            } else if (annotation = this.annotations.find(({x1, y1, x2, y2, shift}) => x1 === this.mouse.x1 && y1 === this.mouse.y1 && x2 === this.mouse.x2 && y2 === this.mouse.y2 && shift === !this.shift)) {
                annotation.shift = this.shift;
            } else {
                this.annotations.push({x1: this.mouse.x1, y1: this.mouse.y1, x2: this.mouse.x2, y2: this.mouse.y2, shift: this.shift});
            }

            this.mouseRight = false;
        },

        clearAnnotations() {
            this.annotations = [];
        },
    },
}).mount('#app');
