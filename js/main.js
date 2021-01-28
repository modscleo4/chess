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
        },
        game: {
            gamemode: null,
            playerColor: 'white',
            currPlayer: 'white',
            lost: false,
            won: false,
            draw: false,
            board: null,
            lastMoved: null,
            takenPieces: [],
            movements: [],
            currentMove: [],
            noCaptureOrPawnsQ: 0,
            result: null,
            promoteTo: null,
        },
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
        mouseRight: false,
        arrows: [],
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
            if (!this.game.board) {
                this.regenerateArray();
            }

            return this.game.board;
        },

        takenPiecesW() {
            return this.game.takenPieces.filter(p => p.color === 'white');
        },

        takenPiecesB() {
            return this.game.takenPieces.filter(p => p.color === 'black');
        },
    },

    mounted() {
        this.play();
    },

    methods: {
        play() {
            if (this.game.movements.length > 0) {
                const games = JSON.parse(localStorage.getItem('gameHistory') ?? '[]');
                games.push({won: this.game.won, lost: this.game.lost, draw: this.game.draw, gamemode: this.game.gamemode, movements: this.game.movements, result: this.game.result});

                localStorage.setItem('gameHistory', JSON.stringify(games));
            }

            this.game.gamemode = null;
            this.game.won = false;
            this.game.lost = false;
            this.game.draw = false;
            this.game.lastMoved = null;
            this.game.takenPieces = [];
            this.game.movements = [];
            this.game.currentMove = [];
            this.game.noCaptureOrPawnsQ = 0;
            this.game.result = null;

            this.connection.gameid = null;
            this.connection.canStart = false;
            this.regenerateArray();
        },

        async loginServer() {
            if (!this.connection.gameid) {
                const gameid = prompt('Game ID (vazio para um novo jogo): ');
                this.connection.gameid = gameid || null;
            }

            const commands = {
                commitMovement: async (message) => {
                    const {i, j, newI, newJ, game: {currPlayer}} = message;
                    this.commitMovement(i, j, newI, newJ);

                    this.game.currPlayer = currPlayer;
                },

                createGame: async (message) => {
                    const {gameid, game: {playerColor, currPlayer}} = message;

                    this.connection.gameid = gameid;
                    this.game.currPlayer = currPlayer;
                    this.game.playerColor = playerColor;
                },

                joinGame: async (message) => {
                    const {game: {movements, playerColor, currPlayer}} = message;

                    this.game.playerColor = this.game.currPlayer = 'white';

                    movements.forEach(({i, j, newI, newJ}) => {
                        this.commitMovement(i, j, newI, newJ);
                        this.game.currPlayer = (this.game.currPlayer === 'white' ? 'black' : 'white');
                        this.game.playerColor = this.game.currPlayer;
                    });

                    const lastMovement = movements[movements.length - 1];
                    this.game.currentMove = !lastMovement ? [] : [[lastMovement.i, lastMovement.j], [lastMovement.newI, lastMovement.newJ]];
                    this.game.currPlayer = currPlayer;
                    this.game.playerColor = playerColor;
                },

                start: async (message) => {
                    this.connection.canStart = true;
                },

                gameNotFound: async (message) => {
                    const {gameid} = message;

                    alert(`Jogo ${gameid} não encontrado.`);
                    this.play();
                },

                gameFull: async (message) => {
                    const {gameid} = message;

                    alert(`O jogo ${gameid} está cheio.`);
                    this.play();
                },

                playerDisconnected: async (message) => {
                    if (!confirm('O outro jogador foi desconectado. Deseja aguardá-lo?')) {
                        return this.play();
                    }

                    this.connection.canStart = false;
                },
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

            socket.addEventListener('close', () => {
                alert('Conexão com o servidor perdida. Tentando reconectar...');
                this.loginServer();
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
            this.game.board = Chess.generateArray();
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
         */
        commitMovement(i, j, newI, newJ) {
            const piece = this.game.board[i][j];

            if (newI === i && newJ === j) {
                return;
            }

            if (!Chess.isValidMove(piece, i, j, newI, newJ, this.game.board, this.game.lastMoved)) {
                return;
            }

            let capture = false;
            let enPassant = false;
            let promotion = false;
            let castling = 0;
            let check = false;
            let checkMate = false;

            let takenPiece = this.game.board[newI][newJ];
            if (piece.char === 'P' && !takenPiece && newJ !== j && ((piece.color === 'white' && i === 3) || (piece.color === 'black' && i === 4))) {
                enPassant = true;
                takenPiece = this.game.board[i][newJ];
                this.game.board[i][newJ] = null;
            }

            capture = !!takenPiece;

            const boardCopy = this.game.board.map(r => [...r]);

            this.game.board[i][j] = null;
            this.game.board[newI][newJ] = piece;

            if (piece.char === 'P' && [0, 7].includes(newI)) {
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
                if (this.game.currPlayer === 'white') {
                    this.game.board = boardCopy;
                    return;
                } else {
                    check = true;
                }
            }

            if (KingB.checked = Chess.isChecked('black', KingB_i, KingB_j, this.game.board)) {
                if (this.game.currPlayer === 'black') {
                    this.game.board = boardCopy;
                    return;
                } else {
                    check = true;
                }
            }

            if (piece.char === 'P' && Math.abs(newI - i) === 2) {
                piece.longMove = true;
            }

            piece.neverMoved = false;
            takenPiece && this.game.takenPieces.push(takenPiece);

            const moveAudio = new Audio('assets/move.ogg');
            moveAudio.play();

            if (Chess.isCheckMate('white', KingW_i, KingW_j, this.game.board, this.game.lastMoved)) {
                setTimeout(() => {
                    alert('Win: Black');
                    this.play();
                }, 500);

                this.won = this.game.playerColor === 'black';
                this.lose = this.game.playerColor === 'white';
                this.draw = false;

                if (this.game.won) {
                    this.game.result = '0-1';
                } else {
                    this.game.result = '1-0';
                }

                checkMate = true;
            } else if (Chess.isCheckMate('black', KingB_i, KingB_j, this.game.board, this.game.lastMoved)) {
                setTimeout(() => {
                    alert('Win: White');
                    this.play();
                }, 500);

                this.game.won = this.game.playerColor === 'white';
                this.game.lose = this.game.playerColor === 'black';
                this.game.draw = false;

                if (this.game.won) {
                    this.game.result = '1-0';
                } else {
                    this.game.result = '0-1';
                }

                checkMate = true;
            } else if (Chess.isStaleMate('black', KingB_i, KingB_j, this.game.board, this.game.lastMoved) || Chess.isStaleMate('white', KingW_i, KingW_j, this.game.board, this.game.lastMoved)) {
                setTimeout(() => {
                    alert('Draw');
                    this.play();
                }, 500);

                this.game.won = false;
                this.game.lose = false;
                this.game.draw = true;

                this.game.result = '½–½';
            } else if (Chess.insufficientMaterial(this.game.board)) {
                setTimeout(() => {
                    alert('Draw');
                    this.play();
                }, 500);

                this.game.won = false;
                this.game.lose = false;
                this.game.draw = true;

                this.game.result = '½–½';
            } else if (this.game.noCaptureOrPawnsQ === 100) {
                setTimeout(() => {
                    alert('Draw');
                    this.play();
                }, 500);

                this.game.won = false;
                this.game.lose = false;
                this.game.draw = true;

                this.game.result = '½–½';
            } else if (Chess.threefoldRepetition(this.game.movements)) {
                setTimeout(() => {
                    alert('Draw');
                    this.play();
                }, 500);

                this.game.won = false;
                this.game.lose = false;
                this.game.draw = true;

                this.game.result = '½–½';
            }

            const duplicate = Chess.findDuplicateMovement(piece, newI, newJ, this.game.board, this.game.lastMoved);
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
                mov += ' e.p';
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

            if (!capture || piece.char !== 'P') {
                this.game.noCaptureOrPawnsQ++;
            } else {
                this.game.noCaptureOrPawnsQ = 0;
            }

            if (this.game.gamemode === 'smp') {
                this.game.currPlayer = (this.game.currPlayer === 'white' ? 'black' : 'white');
                this.game.playerColor = this.game.currPlayer;
            }

            this.game.lastMoved = piece;

            this.game.currentMove = [[i, j], [newI, newJ]];
        },

        startArrow(i, j) {
            console.log(`start arrow: ${i} ${j}`);
            this.mouseRight = true;
        },

        moveArrow(i, j) {
            if (!this.mouseRight) {
                return;
            }

            console.log(`move arrow: ${i} ${j}`);
        },

        endArrow(i, j) {
            console.log(`end arrow: ${i} ${j}`);
            this.mouseRight = false;
        },
    },
}).mount('#app');
