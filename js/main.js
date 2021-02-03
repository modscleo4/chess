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
            return this.game.takenPieces.filter(p => p.color === 'white');
        },

        takenPiecesB() {
            return this.game.takenPieces.filter(p => p.color === 'black');
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

        async loginServer() {
            localStorage.setItem('playerName', this.playerName);

            const commands = {
                commitMovement: async (message) => {
                    const {i, j, newI, newJ, game: {currPlayer, promoteTo, player1Timer, player2Timer}} = message;
                    this.game.promoteTo = promoteTo;
                    this.commitMovement(i, j, newI, newJ, false);

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
                        this.commitMovement(i, j, newI, newJ, false);
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

        regenerateArray() {
            this.game.board = Chess.generateArray();
        },

        pointsAdvantage(playerColor) {
            const piecesW = this.takenPiecesB().reduce((acc, p) => {(p.char === 'Q' ? acc.Q += 9 : p.char === 'R' ? acc.R += 5 : p.char === 'N' ? acc.N += 3 : p.char === 'B' ? acc.B += 3 : p.char === 'P' ? acc.P += 1 : 0); return acc;}, {Q: 0, R: 0, N: 0, B: 0, P: 0});
            const piecesB = this.takenPiecesW().reduce((acc, p) => {(p.char === 'Q' ? acc.Q += 9 : p.char === 'R' ? acc.R += 5 : p.char === 'N' ? acc.N += 3 : p.char === 'B' ? acc.B += 3 : p.char === 'P' ? acc.P += 1 : 0); return acc;}, {Q: 0, R: 0, N: 0, B: 0, P: 0});

            const pointsW = Math.max(piecesW.Q - piecesB.Q, 0) + Math.max(piecesW.R - piecesB.R, 0) + Math.max(piecesW.N - piecesB.N, 0) + Math.max(piecesW.B - piecesB.B, 0) + Math.max(piecesW.P - piecesB.P, 0);
            const pointsB = Math.max(piecesB.Q - piecesW.Q, 0) + Math.max(piecesB.R - piecesW.R, 0) + Math.max(piecesB.N - piecesW.N, 0) + Math.max(piecesB.B - piecesW.B, 0) + Math.max(piecesB.P - piecesW.P, 0);

            return playerColor === 'white' ? (pointsW > pointsB ? `+${pointsW}` : '') :
                playerColor === 'black' ? (pointsB > pointsW ? `+${pointsB}` : '') : '';
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

            const cell = document.querySelector(`#cell_${i}_${j}`)?.getBoundingClientRect();

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

            if (this.connection.socket) {
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
         * @param {boolean} checkValid
         */
        commitMovement(i, j, newI, newJ, checkValid = true) {
            const piece = this.game.board[i][j];

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
            takenPiece && this.game.takenPieces.push(takenPiece);

            const audio = new Audio(capture ? 'assets/capture.ogg' : 'assets/move.ogg');
            audio.play();

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

            if (!capture && piece.char !== 'P') {
                this.game.noCaptureOrPawnsQ++;
            } else {
                this.game.noCaptureOrPawnsQ = 0;
            }

            this.game.currPlayer = (this.game.currPlayer === 'white' ? 'black' : 'white');

            if (this.game.gamemode === 'smp') {
                this.game.playerColor = this.game.currPlayer;
            }

            let fen = '';
            for (let x = 0; x < 8; x++) {
                let empty = 0;
                for (let y = 0; y < 8; y++) {
                    const p = this.game.board[x][y];
                    if (!p) {
                        empty++;
                        continue;
                    }

                    if (empty) {
                        fen += empty;
                        empty = 0;
                    }

                    fen += p.color === 'black' ? p.char.toLowerCase() : p.char;
                }

                if (empty) {
                    fen += empty;
                    empty = 0;
                }

                x < 7 && (fen += '/');
            }

            fen += ` ${this.game.currPlayer[0]}`;

            let fenCastling = ' ';
            if (KingW.neverMoved) {
                if (this.game.board[7][0]?.neverMoved) {
                    fenCastling += 'Q';
                }

                if (this.game.board[7][7]?.neverMoved) {
                    fenCastling += 'K';
                }
            }

            if (KingB.neverMoved) {
                if (this.game.board[0][0]?.neverMoved) {
                    fenCastling += 'q';
                }

                if (this.game.board[0][7]?.neverMoved) {
                    fenCastling += 'k';
                }
            }

            if (fenCastling === ' ') {
                fenCastling = ' -';
            }

            fen += fenCastling;

            // This is not FEN because we are only recording true En Passant (this is for threefold repetition)
            if (piece.char === 'P' && piece.longMove && (piece.color === 'white' ? newI === 4 : newI === 3) && (this.game.board[newI][newJ - 1]?.char === 'P' && this.game.board[newI][newJ + 1]?.color !== piece.color || this.game.board[newI][newJ + 1]?.char === 'P' && this.game.board[newI][newJ + 1]?.color !== piece.color)) {
                fen += ` ${['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'][newJ]}${8 - newI + (piece.color === 'white' ? -1 : 1)}`;
            } else {
                fen += ' -';
            }

            fen += ` ${this.game.noCaptureOrPawnsQ}`;
            fen += ` ${Math.floor(this.game.movements.length / 2 + 1)}`;

            this.game.fen.push(fen);

            if (Chess.isCheckMate('white', KingW_i, KingW_j, this.game.board, this.game.lastMoved)) {
                setTimeout(() => {
                    alert('Pretas venceram');
                    this.reset();
                }, 500);

                this.won = 'black';
                this.draw = false;

                if (this.game.won) {
                    this.game.result = '0-1';
                } else {
                    this.game.result = '1-0';
                }

                checkMate = true;
            } else if (Chess.isCheckMate('black', KingB_i, KingB_j, this.game.board, this.game.lastMoved)) {
                setTimeout(() => {
                    alert('Brancas venceram');
                    this.reset();
                }, 500);

                this.game.won = 'white';
                this.game.draw = false;

                if (this.game.won) {
                    this.game.result = '1-0';
                } else {
                    this.game.result = '0-1';
                }

                checkMate = true;
            } else if (Chess.isStaleMate('black', KingB_i, KingB_j, this.game.board, this.game.lastMoved) || Chess.isStaleMate('white', KingW_i, KingW_j, this.game.board, this.game.lastMoved)) {
                setTimeout(() => {
                    alert('Empate (afogamento)');
                    this.reset();
                }, 500);

                this.game.won = null;
                this.game.draw = true;

                this.game.result = '½–½';
            } else if (Chess.insufficientMaterial(this.game.board)) { // Insufficient Material (K-K, KN-K, KB-K, KB-KB)
                setTimeout(() => {
                    alert('Empate (insuficiência material)');
                    this.reset();
                }, 500);

                this.game.won = null;
                this.game.draw = true;

                this.game.result = '½–½';
            } else if (this.game.noCaptureOrPawnsQ === 100) { // 50 Movement rule
                setTimeout(() => {
                    alert('Empate (50 movimentos)');
                    this.reset();
                }, 500);

                this.game.won = null;
                this.game.draw = true;

                this.game.result = '½–½';
            } else if (Chess.threefoldRepetition(this.game.fen)) { // 3 Repetition rule
                setTimeout(() => {
                    alert('Empate (repetição tripla)');
                    this.reset();
                }, 500);

                this.game.won = null;
                this.game.draw = true;

                this.game.result = '½–½';
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
                            setTimeout(() => {
                                alert('Pretas venceram (tempo esgotado)');
                                this.reset();
                            }, 500);

                            this.game.won = 'black';
                            this.game.result = '0–1';
                        }
                    }, 1000);

                    this.game.movements.length > 2 && (this.game.player2Timer -= this.game.timeInc);
                } else {
                    this.game.player2TimerFn = setInterval(() => {
                        this.game.player2Timer++;
                        if (this.game.player2Timer >= this.game.timePlayer * 60) {
                            setTimeout(() => {
                                alert('Brancas venceram (tempo esgotado)');
                                this.reset();
                            }, 500);

                            this.game.won = 'white';
                            this.game.result = '1–0';
                        }
                    }, 1000);

                    this.game.movements.length > 2 && (this.game.player1Timer -= this.game.timeInc);
                }
            }

            setTimeout(() => {
                document.querySelector('.sidebar-right .history .movement:last-child')?.scrollIntoView({behavior: 'smooth', block: 'end'});
            }, 100);
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
            this.mouse.x1 = Math.floor(cell?.left - table?.left + (cell?.width ?? 0) / 2);
            this.mouse.y1 = Math.floor(cell?.top - table?.top + (cell?.height ?? 0) / 2);
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

            this.mouse.x2 = Math.floor(cell?.left - table?.left + (cell?.width ?? 0) / 2);
            this.mouse.y2 = Math.floor(cell?.top - table?.top + (cell?.height ?? 0) / 2);

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
                this.mouse.x2 = Math.floor(cell?.left - table?.left + (cell?.width ?? 0) / 2);
                this.mouse.y2 = Math.floor(cell?.top - table?.top + (cell?.height ?? 0) / 2);
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
