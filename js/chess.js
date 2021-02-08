function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}

/**
 *
 * @param {number} index
 * @param {string} replacement
 */
String.prototype.replaceAt = function (index, replacement) {
    return `${this.substring(0, index)}${replacement}${this.substring(index + 1)}`;
};

/**
 *
 * @typedef {Object} Piece
 * @property {string} char
 * @property {string} color
 * @property {string} image
 * @property {boolean} neverMoved
 * @property {Function} allowedMove
 */

/**
 *
 * @param {number} i
 * @param {number} j
 * @param {number} newI
 * @param {number} newJ
 * @param {(Piece | null)[][]} board
 * @return {boolean}
 */
export function checkHVCollisions(i, j, newI, newJ, board) {
    if (i !== newI && j !== newJ) {
        return true;
    }

    for (let ii = i + 1; ii < newI; ii++) {
        if (board[ii][j]) {
            return false;
        }
    }

    for (let ii = i - 1; ii > newI; ii--) {
        if (board[ii][j]) {
            return false;
        }
    }

    for (let jj = j + 1; jj < newJ; jj++) {
        if (board[i][jj]) {
            return false;
        }
    }

    for (let jj = j - 1; jj > newJ; jj--) {
        if (board[i][jj]) {
            return false;
        }
    }

    return true;
}

/**
 *
 * @param {number} i
 * @param {number} j
 * @param {number} newI
 * @param {number} newJ
 * @param {(Piece | null)[][]} board
 * @return {boolean}
 */
export function checkDCollisions(i, j, newI, newJ, board) {
    for (let delta = 1; i + delta < newI && j + delta < newJ; delta++) {
        if (board[i + delta][j + delta]) {
            return false;
        }
    }

    for (let delta = 1; i + delta < newI && j - delta > newJ; delta++) {
        if (board[i + delta][j - delta]) {
            return false;
        }
    }

    for (let delta = 1; i - delta > newI && j - delta > newJ; delta++) {
        if (board[i - delta][j - delta]) {
            return false;
        }
    }

    for (let delta = 1; i - delta > newI && j + delta < newJ; delta++) {
        if (board[i - delta][j + delta]) {
            return false;
        }
    }

    return true;
}

/**
 *
 * @param {string} color
 * @param {(Piece | null)[][]} board
 * @param {Piece | null} lastMoved
 * @return {boolean}
 */
export function hasValidMovements(color, board, lastMoved) {
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const piece = board[i][j];

            if (piece?.color === color) {
                for (let newI = 0; newI < 8; newI++) {
                    for (let newJ = 0; newJ < 8; newJ++) {
                        if (isValidMove(piece, i, j, newI, newJ, board, lastMoved)) {
                            return true;
                        }
                    }
                }
            }
        }
    }

    return false;
}

/**
 *
 * @param {string} color
 * @param {number} i
 * @param {number} j
 * @param {(Piece | null)[][]} board
 * @return {boolean}
 */
export function isChecked(color, i, j, board) {
    // Up
    for (let x = i - 1, y = j; x >= 0; x--) {
        if (['R', 'Q'].includes(board[x][y]?.char) && board[x][y]?.color !== color) {
            return true;
        } else if (board[x][y]) {
            break;
        }
    }

    // Down
    for (let x = i + 1, y = j; x <= 7; x++) {
        if (['R', 'Q'].includes(board[x][y]?.char) && board[x][y]?.color !== color) {
            return true;
        } else if (board[x][y]) {
            break;
        }
    }

    // Left
    for (let x = i, y = j - 1; y >= 0; y--) {
        if (['R', 'Q'].includes(board[x][y]?.char) && board[x][y]?.color !== color) {
            return true;
        } else if (board[x][y]) {
            break;
        }
    }

    // Right
    for (let x = i, y = j + 1; y <= 7; y++) {
        if (['R', 'Q'].includes(board[x][y]?.char) && board[x][y]?.color !== color) {
            return true;
        } else if (board[x][y]) {
            break;
        }
    }

    // Left Up
    for (let x = i - 1, y = j - 1; x >= 0 && y >= 0; x--, y--) {
        if (['B', 'Q'].includes(board[x][y]?.char) && board[x][y]?.color !== color) {
            return true;
        } else if (board[x][y]) {
            break;
        }
    }

    // Left Down
    for (let x = i - 1, y = j + 1; x >= 0 && y <= 7; x--, y++) {
        if (['B', 'Q'].includes(board[x][y]?.char) && board[x][y]?.color !== color) {
            return true;
        } else if (board[x][y]) {
            break;
        }
    }

    // Right Up
    for (let x = i + 1, y = j - 1; x <= 7 && y >= 0; x++, y--) {
        if (['B', 'Q'].includes(board[x][y]?.char) && board[x][y]?.color !== color) {
            return true;
        } else if (board[x][y]) {
            break;
        }
    }

    // Right Down
    for (let x = i + 1, y = j + 1; x <= 7 && y <= 7; x++, y++) {
        if (['B', 'Q'].includes(board[x][y]?.char) && board[x][y]?.color !== color) {
            return true;
        } else if (board[x][y]) {
            break;
        }
    }

    // Pawn
    if (color === 'white' && i - 1 >= 0 && ((board[i - 1][j - 1]?.char === 'P' && board[i - 1][j - 1]?.color !== color) || (board[i - 1][j + 1]?.char === 'P' && board[i - 1][j + 1]?.color !== color))
        || color === 'black' && i - 1 <= 7 && ((board[i + 1][j - 1]?.char === 'P' && board[i + 1][j - 1]?.color !== color) || (board[i + 1][j + 1]?.char === 'P' && board[i + 1][j + 1]?.color !== color))) {
        return true;
    }

    // Knight
    if (i - 2 >= 0 && (board[i - 2][j - 1]?.char === 'N' && board[i - 2][j - 1]?.color !== color
        || board[i - 2][j + 1]?.char === 'N' && board[i - 2][j + 1]?.color !== color)
        || i - 1 >= 0 && (board[i - 1][j - 2]?.char === 'N' && board[i - 1][j - 2]?.color !== color
            || board[i - 1][j + 2]?.char === 'N' && board[i - 1][j + 2]?.color !== color)
        || i + 1 <= 7 && (board[i + 1][j - 2]?.char === 'N' && board[i + 1][j - 2]?.color !== color
            || board[i + 1][j + 2]?.char === 'N' && board[i + 1][j + 2]?.color !== color)
        || i + 2 <= 7 && (board[i + 2][j - 1]?.char === 'N' && board[i + 2][j - 1]?.color !== color
            || board[i + 2][j + 1]?.char === 'N' && board[i + 2][j + 1]?.color !== color)) {
        return true;
    }

    if (i - 1 >= 0 && (board[i - 1][j - 1]?.char === 'K'
        || board[i - 1][j]?.char === 'K'
        || board[i - 1][j + 1]?.char === 'K')
        || board[i][j - 1]?.char === 'K'
        || board[i][j + 1]?.char === 'K'
        || i + 1 <= 7 && (board[i + 1][j - 1]?.char === 'K'
            || board[i + 1][j]?.char === 'K'
            || board[i + 1][j + 1]?.char === 'K')) {
        return true;
    }

    return false;
}

/**
 *
 * @param {string} color
 * @param {number} i
 * @param {number} j
 * @param {(Piece | null)[][]} board
 * @param {(Piece | null)} lastMoved
 * @return {boolean}
 */
export function isCheckMate(color, i, j, board, lastMoved) {
    if (hasValidMovements(color, board, lastMoved)) {
        return false;
    }

    return isChecked(color, i, j, board);
}

/**
 *
 * @param {string} color
 * @param {number} i
 * @param {number} j
 * @param {(Piece | null)[][]} board
 * @param {(Piece | null)} lastMoved
 * @return {boolean}
 */
export function isStaleMate(color, i, j, board, lastMoved) {
    if (hasValidMovements(color, board, lastMoved)) {
        return false;
    }

    return !isChecked(color, i, j, board);
}

/**
 * @param {(Piece | null)[][]} board
 * @return {boolean}
 */
export function insufficientMaterial(board) {
    const whitePieces = board.flat().filter(p => p?.color === 'white');
    const blackPieces = board.flat().filter(p => p?.color === 'black');

    if (!whitePieces.find(p => p.char === 'R') && !whitePieces.find(p => p.char === 'Q') && !whitePieces.find(p => p.char === 'P')
        && !blackPieces.find(p => p.char === 'R') && !blackPieces.find(p => p.char === 'Q') && !blackPieces.find(p => p.char === 'P')) {


        if (!whitePieces.find(p => p.char === 'N') && !whitePieces.find(p => p.char === 'B')) {
            if (!blackPieces.find(p => p.char === 'N') && !blackPieces.find(p => p.char === 'B')) {
                // King vs King
            }

            if (!blackPieces.find(p => p.char === 'N') && blackPieces.find(p => p.char === 'B')) {
                // King vs King + Bishop
                return true;
            }

            if (blackPieces.find(p => p.char === 'N') && !blackPieces.find(p => p.char === 'B')) {
                // King vs King + Knight
                return true;
            }
        } else if (!blackPieces.find(p => p.char === 'N') && !blackPieces.find(p => p.char === 'B')) {
            if (!whitePieces.find(p => p.char === 'N') && whitePieces.find(p => p.char === 'B')) {
                // King vs King + Bishop
                return true;
            }

            if (whitePieces.find(p => p.char === 'N') && !whitePieces.find(p => p.char === 'B')) {
                // King vs King + Knight
                return true;
            }
        } else if (!whitePieces.find(p => p.char === 'N') && !blackPieces.find(p => p.char === 'N')
            && whitePieces.find(p => p.char === 'B') && blackPieces.find(p => p.char === 'B')
            && whitePieces.find(p => p.char === 'B')?.posColor === blackPieces.find(p => p.char === 'B')?.posColor) {
            // King + Bishop vs King + Bishop (same color)
            return true;
        }
    }

    return false;
}

/**
 *
 * @param {string} fen
 */
export function threefoldRepetition(fen) {
    if (fen.length >= 6) {
        const currMov = fen[fen.length - 1];
        let dup = 1;
        for (let j = 0; j < fen.length - 1; j++) {
            const comparMov = fen[j];

            if (currMov.replace(/\d+ \d+$/, '') === comparMov.replace(/\d+ \d+$/, '')) {
                dup++;
            }
        }

        if (dup >= 3) {
            return true;
        }
    }

    return false;
}

/**
 *
 * @param {string} fen
 */
export function fivefoldRepetition(fen) {
    if (fen.length >= 10) {
        const currMov = fen[fen.length - 1];
        let dup = 1;
        for (let j = 0; j < fen.length - 1; j++) {
            const comparMov = fen[j];

            if (currMov.replace(/\d+ \d+$/, '') === comparMov.replace(/\d+ \d+$/, '')) {
                dup++;
            }
        }

        if (dup === 5) {
            return true;
        }
    }

    return false;
}

/**
 *
 * @param {(Piece | null)[][]} board
 * @param {Piece} piece
 * @param {string} currPlayer
 * @param {number} newI
 * @param {number} newJ
 * @param {Piece} KingW
 * @param {Piece} KingB
 * @param {number} noCaptureOrPawnsQ
 * @param {string[]} movements
 */
export function boardToFEN(board, piece, currPlayer, newI, newJ, KingW, KingB, noCaptureOrPawnsQ, movements) {
    let fen = '';
    for (let x = 0; x < 8; x++) {
        let empty = 0;
        for (let y = 0; y < 8; y++) {
            const p = board[x][y];
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

    fen += ` ${currPlayer[0]}`;

    let fenCastling = ' ';
    if (KingW.neverMoved) {
        if (board[7][7]?.neverMoved) {
            fenCastling += 'K';
        }

        if (board[7][0]?.neverMoved) {
            fenCastling += 'Q';
        }
    }

    if (KingB.neverMoved) {
        if (board[0][7]?.neverMoved) {
            fenCastling += 'k';
        }

        if (board[0][0]?.neverMoved) {
            fenCastling += 'q';
        }
    }

    if (fenCastling === ' ') {
        fenCastling = ' -';
    }

    fen += fenCastling;

    // This is not FEN because we are only recording true En Passant (this is for threefold repetition)
    if (piece.char === 'P' && piece.longMove && (piece.color === 'white' ? newI === 4 : newI === 3) && (board[newI][newJ - 1]?.char === 'P' && board[newI][newJ + 1]?.color !== piece.color || board[newI][newJ + 1]?.char === 'P' && board[newI][newJ + 1]?.color !== piece.color)) {
        fen += ` ${['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'][newJ]}${8 - newI + (piece.color === 'white' ? -1 : 1)}`;
    } else {
        fen += ' -';
    }

    fen += ` ${noCaptureOrPawnsQ}`;
    fen += ` ${Math.floor(movements.length / 2 + 1)}`;

    return fen;
}

/**
 *
 * @param {string} char
 * @param {string} color
 * @param {string} image
 * @param {Function} allowedMove
 * @return {Piece}
 */
function makePiece(char, color, image, allowedMove) {
    return {
        char,
        color,
        image,
        neverMoved: true,
        allowedMove,
    };
}

/**
 *
 * @param {string} fen
 * @return {boolean}
 */
export function validateFEN(fen) {
    return !!fen.match(/((([prnbqkPRNBQK1-8]+\/){7})([prnbqkPRNBQK12345678]*)) ([wb]) ((K?Q?k?q?)|\-) (([abcdefgh][36])|\-) (\d+) (\d+)/);
}

/**
 * @param {string} [fen='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1']
 * @return {(Piece | null)[][]}
 */
export function generateArray(fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
    const board = fen.replace(/ .*/, '').split('/');

    const RookW = makePiece('R', 'white', 'RookW', (i, j, newI, newJ, board) => {
        return (i === newI || j === newJ)
            && checkHVCollisions(i, j, newI, newJ, board);
    });

    const RookB = makePiece('R', 'black', 'RookB', (i, j, newI, newJ, board) => {
        return (i === newI || j === newJ)
            && checkHVCollisions(i, j, newI, newJ, board);
    });

    const KnightW = makePiece('N', 'white', 'KnightW', (i, j, newI, newJ, board) => {
        return (Math.abs(newI - i) === 2 && Math.abs(newJ - j) === 1 || Math.abs(newI - i) === 1 && Math.abs(newJ - j) === 2);
    });

    const KnightB = makePiece('N', 'black', 'KnightB', (i, j, newI, newJ, board) => {
        return (Math.abs(newI - i) === 2 && Math.abs(newJ - j) === 1 || Math.abs(newI - i) === 1 && Math.abs(newJ - j) === 2);
    });

    const BishopW = makePiece('B', 'white', 'BishopW', (i, j, newI, newJ, board) => {
        return (Math.abs(newI - i) === Math.abs(newJ - j))
            && checkDCollisions(i, j, newI, newJ, board);
    });

    const BishopB = makePiece('B', 'black', 'BishopB', (i, j, newI, newJ, board) => {
        return (Math.abs(newI - i) === Math.abs(newJ - j))
            && checkDCollisions(i, j, newI, newJ, board);
    });

    const QueenW = makePiece('Q', 'white', 'QueenW', (i, j, newI, newJ, board) => {
        return ((i === newI || j === newJ) && checkHVCollisions(i, j, newI, newJ, board)
            || Math.abs(newI - i) === Math.abs(newJ - j)) && checkDCollisions(i, j, newI, newJ, board);
    });

    const QueenB = makePiece('Q', 'black', 'QueenB', (i, j, newI, newJ, board) => {
        return ((i === newI || j === newJ) && checkHVCollisions(i, j, newI, newJ, board)
            || Math.abs(newI - i) === Math.abs(newJ - j)) && checkDCollisions(i, j, newI, newJ, board);
    });

    const KingW = makePiece('K', 'white', 'KingW', function (i, j, newI, newJ, board) {
        return (Math.abs(newI - i) <= 1 && Math.abs(newJ - j) <= 1)
            || this.neverMoved && (Math.abs(newJ - j) === 2 && newI === i && (newJ < j ? board[i][0] : board[i][7])?.neverMoved && checkHVCollisions(i, j, newI, newJ + 1, board) && !isChecked(this.color, i, j, board));
    });

    const KingB = makePiece('K', 'black', 'KingB', function (i, j, newI, newJ, board) {
        return (Math.abs(newI - i) <= 1 && Math.abs(newJ - j) <= 1)
            || this.neverMoved && (Math.abs(newJ - j) === 2 && newI === i && (newJ < j ? board[i][0] : board[i][7])?.neverMoved && checkHVCollisions(i, j, newI, newJ + 1, board) && !isChecked(this.color, i, j, board));
    });

    const PawnW = makePiece('P', 'white', 'PawnW', function (i, j, newI, newJ, board, lastMoved) {
        return (((i === 6 && newI === i - 2) || newI === i - 1) && newJ === j && checkHVCollisions(i, j, newI, newJ, board))
            || ((i - 1 === newI && j + 1 === newJ && board[i - 1][j + 1] && board[i - 1][j + 1].color !== this.color) || (i - 1 === newI && j - 1 === newJ && board[i - 1][j - 1] && board[i - 1][j - 1].color !== this.color))
            || (i === 3 && (newI === i - 1
                && ((newJ === j - 1 && board[i][j - 1] && board[i][j - 1].char === 'P' && board[i][j - 1].longMove && board[i][j - 1] == lastMoved && board[i][j - 1].color !== this.color)
                    || (newJ === j + 1 && board[i][j + 1] && board[i][j + 1].char === 'P' && board[i][j + 1].longMove && board[i][j + 1] == lastMoved && board[i][j + 1].color !== this.color))));
    });

    const PawnB = makePiece('P', 'black', 'PawnB', function (i, j, newI, newJ, board, lastMoved) {
        return (((i === 1 && newI === i + 2) || newI === i + 1) && newJ === j && checkHVCollisions(i, j, newI, newJ, board))
            || ((i + 1 === newI && j + 1 === newJ && board[i + 1][j + 1] && board[i + 1][j + 1].color !== this.color) || (i + 1 === newI && j - 1 === newJ && board[i + 1][j - 1] && board[i + 1][j - 1].color !== this.color))
            || (i === 4 && (newI === i + 1
                && ((newJ === j - 1 && board[i][j - 1] && board[i][j - 1].char === 'P' && board[i][j - 1].longMove && board[i][j - 1] == lastMoved && board[i][j - 1].color !== this.color)
                    || (newJ === j + 1 && board[i][j + 1] && board[i][j + 1].char === 'P' && board[i][j + 1].longMove && board[i][j + 1] == lastMoved && board[i][j + 1].color !== this.color))));
    });

    const castling = / [wb] (?<Castling>K?Q?k?q?)/.exec(fen)?.groups.Castling;

    const enPassant = / [wb] K?Q?k?q? (?<EnPassant>(?:-|[a-z]\d))/.exec(fen)?.groups.EnPassant;

    const arr = board.map((row, i) => {
        if (/\d+/g.test(row)) {
            const matches = row.match(/(\d+)/g);
            matches?.forEach(match => {
                const n = Number.parseInt(match);

                row = row.replaceAt(row.indexOf(match), ' '.repeat(n));
            });
        }

        return Array.from(row).map((char, j) => {
            if (char === ' ') {
                return null;
            }

            let longMove = false;
            let neverMoved = true;

            if (castling && (!castling.includes('K') && j === 7
                || !castling.includes('Q') && j == 0)) {
                neverMoved = false;
            }

            if (enPassant && enPassant !== '-') {
                longMove = true;
                neverMoved = false;
            }

            return {
                r: {...RookB, neverMoved},
                n: {...KnightB},
                b: {...BishopB},
                q: {...QueenB},
                k: {...KingB},
                p: {...PawnB, neverMoved, longMove},
                R: {...RookW, neverMoved},
                N: {...KnightW},
                B: {...BishopW},
                Q: {...QueenW},
                K: {...KingW},
                P: {...PawnW, neverMoved, longMove},
            }[char];
        });
    });

    return arr;
}

/**
 *
 * @param {string} pgn
 * @param {(Piece | null)[][]} board
 * @param {string} currPlayer
 * @param {Piece | null} currPlayer
 * @return {{i: number, j: number, newI: number, newJ: number, promoteTo: string | null}}
 */
export function pgnToCoord(pgn, board, currPlayer, lastMoved) {
    pgn = pgn.replace(/[+#]$/, '');
    pgn = pgn.replace(/ e.p.$/, '');

    let promoteTo = null;
    let i;
    let j;
    let newI;
    let newJ;
    if (pgn === '0-0') {
        i = currPlayer === 'white' ? 7 : 0;
        j = 4;
        newI = i;
        newJ = j + 2;
    } else if (pgn === '0-0-0') {
        i = currPlayer === 'white' ? 7 : 0;
        j = 4;
        newI = i;
        newJ = j - 2;
    } else {
        let char = pgn[0].toUpperCase() === pgn[0] ? pgn[0] : 'P';
        pgn = pgn.replace(/^[A-Z]/, '');

        if (['R', 'N', 'B', 'Q'].includes(pgn[pgn.length - 1])) {
            promoteTo = pgn[pgn.length - 1];
            pgn = pgn.replace(/[A-Z]$/, '');
        }

        newI = 8 - parseInt(pgn[pgn.length - 1]);
        newJ = 'abcdefgh'.indexOf(pgn[pgn.length - 2]);

        pgn = pgn.replace(/[a-z]\d$/, '');
        pgn = pgn.replace(/x/, '');

        if (/^[a-z]/.test(pgn)) {
            j = 'abcdefgh'.indexOf(pgn[0]);
        }

        if (/\d$/.test(pgn)) {
            i = 8 - parseInt(pgn[pgn.length - 1]);
        }

        for (let x = i ?? 0; x < board.length; x++) {
            const row = board[x];

            if (i && x !== i) {
                continue;
            }

            for (let y = j ?? 0; y < row.length; y++) {
                const piece = row[y];
                if (!piece) {
                    continue;
                }

                if (j && y !== j) {
                    continue;
                }

                if (piece.char === char && piece.color === currPlayer && isValidMove(piece, x, y, newI, newJ, board, lastMoved)) {
                    i = x;
                    j = y;
                    break;
                }
            }
        }
    }

    return {i, j, newI, newJ, promoteTo};
}

/**
 *
 * @param {Piece} piece
 * @param {number} i
 * @param {number} j
 * @param {number} newI
 * @param {number} newJ
 * @param {(Piece | null)[][]} board
 * @param {Piece | null} lastMoved
 * @return {boolean}
 */
export function isValidMove(piece, i, j, newI, newJ, board, lastMoved) {
    if (!piece.allowedMove(i, j, newI, newJ, board, lastMoved)) {
        return false;
    }

    const takenPiece = board[newI][newJ];

    if (takenPiece?.color === piece.color) {
        return false;
    }

    if (piece.char === 'P' && newJ == j && board[newI][newJ]) {
        return false;
    }

    const boardCopy = board.map(r => [...r]);

    boardCopy[i][j] = null;

    if (piece.char === 'K' && Math.abs(newJ - j) === 2) {
        if (newJ > j) {
            const rook = boardCopy[i][7];
            boardCopy[i][j + 1] = rook;
            boardCopy[i][7] = null;
        } else {
            const rook = boardCopy[i][0];
            boardCopy[i][j - 1] = rook;
            boardCopy[i][0] = null;
        }

        if (isChecked(piece.color, i, newJ > j ? j + 1 : j - 1, boardCopy)) {
            return false;
        }
    }

    boardCopy[newI][newJ] = piece;

    const King_i = boardCopy.findIndex(row => row.find(p => p?.char === 'K' && p?.color === piece.color));
    const King_j = boardCopy[King_i].findIndex(p => p?.char === 'K' && p?.color === piece.color);

    if (isChecked(piece.color, King_i, King_j, boardCopy)) {
        return false;
    }

    return true;
}

/**
 *
 * @param {Piece} pawn
 * @param {number} i
 * @param {number} j
 * @param {string} desiredPiece
 * @param {(Piece | null)[][]} board
 */
export function promove(pawn, i, j, desiredPiece, board) {
    if (!['Q', 'B', 'N', 'R'].includes(desiredPiece)) {
        return false;
    }

    const piece = makePiece(desiredPiece, pawn.color, {Q: 'Queen', B: 'Bishop', N: 'Knight', R: 'Rook'}[desiredPiece] + pawn.color[0].toUpperCase(), {
        Q: (i, j, newI, newJ, board) => {
            return ((i === newI || j === newJ) || Math.abs(newI - i) === Math.abs(newJ - j))
                && checkHVCollisions(i, j, newI, newJ, board)
                && checkDCollisions(i, j, newI, newJ, board);
        },

        B: (i, j, newI, newJ, board) => {
            return (Math.abs(newI - i) === Math.abs(newJ - j))
                && checkDCollisions(i, j, newI, newJ, board);
        },

        N: (i, j, newI, newJ, board) => {
            return (Math.abs(newI - i) === 2 && Math.abs(newJ - j) === 1 || Math.abs(newI - i) === 1 && Math.abs(newJ - j) === 2);
        },

        R: (i, j, newI, newJ, board) => {
            return (i === newI || j === newJ)
                && checkHVCollisions(i, j, newI, newJ, board);
        },
    }[desiredPiece]);

    board[i][j] = piece;
}

/**
 *
 * @param {Piece} piece
 * @param {number} i
 * @param {number} j
 * @param {number} newI
 * @param {number} newJ
 * @param {(Piece | null)[][]} board
 * @param {Piece | null} lastMoved
 * @return {{sameFile: boolean, sameRank: boolean} | null}
 */
export function findDuplicateMovement(piece, i, j, newI, newJ, board, lastMoved) {
    if (piece.char === 'P') {
        return null;
    }

    let duplicate = false;
    let sameFile = false;
    let sameRank = false;

    for (let x = 0; x < 8; x++) {
        for (let y = 0; y < 8; y++) {
            const testingPiece = board[x][y];
            if (!testingPiece || testingPiece.char === 'P') {
                continue;
            }

            if (piece !== testingPiece && testingPiece.color === piece.color && testingPiece.char === piece.char && isValidMove(testingPiece, x, y, newI, newJ, board, lastMoved)) {
                duplicate = true;
                !sameFile && (sameFile = (y === j));
                !sameRank && (sameRank = (x === i));
            }
        }
    }

    if (duplicate) {
        return {
            sameFile,
            sameRank,
        };
    }

    return null;
}
