'use strict';

import * as Vue from 'https://cdnjs.cloudflare.com/ajax/libs/vue/3.0.5/vue.esm-browser.prod.js';
import * as Chess from './chess.js';
import createSocket from './ws.js';

window.addEventListener('appinstalled', () => {
    console.log('A2HS installed');
});

let timerFn = null;

const app = Vue.createApp({
    data: () => ({
        connection: {
            socket: null,
            address: 'chessjs-server.herokuapp.com',
            gameid: new URLSearchParams(new URL(window.location).search).get('gameid') ?? null,
            canStart: false,
            currPlayer: null,
        },
        gamemode: null,
        sidebarOpened: false,
        color: 'white',
        playerColor: 'white',
        standalone: window.matchMedia('(display-mode: standalone)').matches,
        timer: 0,
        lost: false,
        won: false,
        draw: false,
        _board: null,
        lastMoved: null,
        takenPieces: [],
        movements: [],
        noCaptureOrPawnsQ: 0,
        result: null,
        promoteTo: null,
        drag: {
            dragging: false,
            piece: null,
            i: 0,
            j: 0,
            newI: 0,
            newJ: 0,
        },
        config: {
            get theme() {
                return localStorage.getItem('theme') ?? 'system';
            },

            set theme(val) {
                localStorage.setItem('theme', val);
                document.querySelector('html').setAttribute('theme', val);
            },
        },
    }),

    computed: {
        board() {
            if (!this._board) {
                this.regenerateArray();
            }

            return this._board;
        },

        takenPiecesW() {
            return this.takenPieces.filter(p => p.color === 'white');
        },

        takenPiecesB() {
            return this.takenPieces.filter(p => p.color === 'black');
        },
    },

    methods: {
        play() {
            this.gamemode = null;
            this.won = false;
            this.lost = false;
            this.draw = false;
            this.takenPieces = [];
            this.movements = [];
            this.connection.canStart = false;
            this.regenerateArray();
        },

        async loginServer() {
            if (!this.connection.gameid) {
                const gameid = prompt('Game ID (empty for a new game): ');
                this.connection.gameid = gameid || null;
            }

            const commands = {
                commitMovement: async (message) => {
                    console.log('aaaaa');
                    const {i, j, newI, newJ, game: {currPlayer}} = message;
                    this.commitMovement(i, j, newI, newJ);

                    this.connection.currPlayer = currPlayer;
                },

                createGame: async (message) => {
                    const {gameid, game: {player1Color, currPlayer}} = message;

                    this.connection.gameid = gameid;
                    this.connection.currPlayer = currPlayer;
                    this.playerColor = player1Color;
                },

                joinGame: async (message) => {
                    const {game: {player2Color, currPlayer}} = message;

                    this.connection.currPlayer = currPlayer;
                    this.playerColor = player2Color;
                },

                start: async (message) => {
                    this.connection.canStart = true;
                }
            };

            const socket = createSocket(this.connection.address, commands);
            this.connection.socket = socket;

            await new Promise((resolve, reject) => {
                if (socket.readyState === socket.OPEN) {
                    return resolve();
                }

                socket.addEventListener('open', () => {
                    resolve();
                });
            });

            if (!this.connection.gameid) {
                socket.send(JSON.stringify({
                    command: 'createGame',
                }));
            } else {
                socket.send(JSON.stringify({
                    command: 'joinGame',
                    gameid: this.connection.gameid,
                }));
            }
        },

        regenerateArray() {
            this._board = Chess.generateArray();
        },

        dragPiece(i, j) {
            if (this.drag.dragging) {
                return;
            }

            this.drag.dragging = true;
            this.drag.i = i;
            this.drag.j = j;
        },

        dragOver(i, j) {
            if (this.drag.newI === i && this.drag.newJ === j) {
                return;
            }

            document.querySelector(`#cell_${this.drag.newI}_${this.drag.newJ}`)?.classList.remove('hover');

            this.drag.newI = i;
            this.drag.newJ = j;

            const board_cell = this._board[this.drag.i][this.drag.j];

            if (!Chess.isValidMove(board_cell, this.drag.i, this.drag.j, this.drag.newI, this.drag.newJ, this._board, this.lastMoved)) {
                return;
            }

            document.querySelector(`#cell_${i}_${j}`)?.classList.add('hover');
        },

        dragEnd(board_cell, i, j) {
            this.drag.dragging = false;
            document.querySelector(`#cell_${this.drag.newI}_${this.drag.newJ}`)?.classList.remove('hover');

            if (this._board[this.drag.i][this.drag.j].char === 'P' && [0, 7].includes(this.drag.newI) && Chess.isValidMove(this._board[this.drag.i][this.drag.j], i, j, this.drag.newI, this.drag.newJ, this._board, this.lastMoved)) {
                this.promoteTo = prompt('Promover para: ');
            }

            if (this.connection.socket) {
                this.connection.socket.send(JSON.stringify({
                    command: 'commitMovement',
                    i: this.drag.i,
                    j: this.drag.j,
                    newI: this.drag.newI,
                    newJ: this.drag.newJ,
                    promoteTo: this.promoteTo,
                }));
            }

            if (this.gamemode === 'smp') {
                this.commitMovement(this.drag.i, this.drag.j, this.drag.newI, this.drag.newJ);
            }

            this.promoteTo = null;
        },

        /**
         *
         * @param {number} i
         * @param {number} j
         * @param {number} newI
         * @param {number} newJ
         */
        commitMovement(i, j, newI, newJ) {
            const piece = this._board[i][j];

            if (newI === i && newJ === j) {
                return;
            }

            if (!Chess.isValidMove(piece, i, j, newI, newJ, this._board, this.lastMoved)) {
                return;
            }

            let capture = false;
            let enPassant = false;
            let promotion = false;
            let castling = 0;
            let check = false;
            let checkMate = false;

            let takenPiece = this._board[newI][newJ];
            if (piece.char === 'P' && !takenPiece && newJ !== j && ((piece.color === 'white' && i === 3) || (piece.color === 'black' && i === 4))) {
                enPassant = true;
                takenPiece = this._board[i][newJ];
                this._board[i][newJ] = null;
            }

            capture = !!takenPiece;

            const boardCopy = [...this._board.map(r => [...r])];

            this._board[i][j] = null;
            this._board[newI][newJ] = piece;

            if (piece.char === 'K' && Math.abs(newJ - j) === 2) {
                if (newJ > j) {
                    const rook = this._board[i][7];
                    this._board[i][j + 1] = rook;
                    this._board[i][7] = null;
                    castling = 1;
                } else {
                    const rook = this._board[i][0];
                    this._board[i][j - 1] = rook;
                    this._board[i][0] = null;
                    castling = 2;
                }
            }

            const KingW_i = this._board.findIndex(row => row.find(p => p?.char === 'K' && p?.color === 'white'));
            const KingW_j = this._board[KingW_i].findIndex(p => p?.char === 'K' && p?.color === 'white');

            const KingB_i = this._board.findIndex(row => row.find(p => p?.char === 'K' && p?.color === 'black'));
            const KingB_j = this._board[KingB_i].findIndex(p => p?.char === 'K' && p?.color === 'black');

            if (Chess.isChecked('white', KingW_i, KingW_j, this._board)) {
                if (this.color === 'white') {
                    this._board = boardCopy;
                    return;
                } else {
                    check = true;
                }
            }

            if (Chess.isChecked('black', KingB_i, KingB_j, this._board)) {
                if (this.color === 'black') {
                    this._board = boardCopy;
                    return;
                } else {
                    check = true;
                }
            }

            if (piece.char === 'P' && Math.abs(newI - i) === 2) {
                piece.longMove = true;
            }

            piece.neverMoved = false;
            takenPiece && this.takenPieces.push(takenPiece);

            if (piece.char === 'P' && [0, 7].includes(newI)) {
                Chess.promove(piece, newI, newJ, this.promoteTo, this._board);
                promotion = true;
            }

            const moveAudio = new Audio('assets/move.ogg');
            moveAudio.play();

            if (Chess.isCheckMate('white', KingW_i, KingW_j, this._board)) {
                setTimeout(() => {
                    alert('Win: Black');
                    this.play();
                }, 500);

                this.won = (this.color === 'black');
                this.lose = (this.color === 'white');
                this.draw = false;

                if (this.won) {
                    this.result = '0-1';
                } else {
                    this.result = '1-0';
                }

                checkMate = true;
            } else if (Chess.isCheckMate('black', KingB_i, KingB_j, this._board)) {
                setTimeout(() => {
                    alert('Win: White');
                    this.play();
                }, 500);

                this.won = (this.color === 'white');
                this.lose = (this.color === 'black');
                this.draw = false;

                if (this.won) {
                    this.result = '1-0';
                } else {
                    this.result = '0-1';
                }

                checkMate = true;
            } else if (Chess.isStaleMate('black', KingB_i, KingB_j, this._board) || Chess.isStaleMate('white', KingW_i, KingW_j, this._board)) {
                setTimeout(() => {
                    alert('Draw');
                    this.play();
                }, 500);

                this.won = false;
                this.lose = false;
                this.draw = true;

                this.result = '½–½';
            } else if (Chess.insufficientMaterial(this._board)) {
                setTimeout(() => {
                    alert('Draw');
                    this.play();
                }, 500);

                this.won = false;
                this.lose = false;
                this.draw = true;

                this.result = '½–½';
            } else if (this.noCaptureOrPawnsQ === 100) {
                setTimeout(() => {
                    alert('Draw');
                    this.play();
                }, 500);

                this.won = false;
                this.lose = false;
                this.draw = true;

                this.result = '½–½';
            } else if (Chess.threefoldRepetition(this.movements)) {
                setTimeout(() => {
                    alert('Draw');
                    this.play();
                }, 500);

                this.won = false;
                this.lose = false;
                this.draw = true;

                this.result = '½–½';
            }

            const duplicate = Chess.findDuplicateMovement(piece, newI, newJ, this._board, this.lastMoved);
            let mov = `${piece.char !== 'P' ? piece.char : ''}`;
            if (duplicate?.x === i) {
                mov += ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'][j];
            }

            if (duplicate?.y === j) {
                mov += 1 + i;
            }

            if (capture) {
                if (piece.char === 'P') {
                    mov += ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'][j];
                }

                mov += 'x';
            }

            mov += `${['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'][newJ]}${1 + newI}`;

            if (enPassant) {
                mov += 'e.p';
            }

            if (checkMate) {
                this.movements.push(mov + '#');
            } else if (check) {
                this.movements.push(mov + '+');
            } else if (castling) {
                this.movements.push(['0-0', '0-0-0'][castling - 1]);
            } else if (promotion) {
                this.movements.push(`${['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'][newJ]}${1 + newI}${piece.char}`);
            } else {
                this.movements.push(mov);
            }

            if (!capture || piece.char !== 'P') {
                this.noCaptureOrPawnsQ++;
            } else {
                this.noCaptureOrPawnsQ = 0;
            }

            if (this.gamemode === 'smp') {
                this.color = (this.color === 'white' ? 'black' : 'white');
            }

            this.lastMoved = piece;
        },
    },
}).mount('#app');
