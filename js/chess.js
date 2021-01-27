function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}

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
 * @return {boolean}
 */
export function hasValidMovements(color, board) {
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const piece = board[i][j];

            if (piece?.color === color) {
                for (let newI = 0; newI < 8; newI++) {
                    for (let newJ = 0; newJ < 8; newJ++) {
                        if (isValidMove(piece, i, j, newI, newJ, board)) {
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
 * @return {boolean}
 */
export function isCheckMate(color, i, j, board) {
    if (hasValidMovements(color, board)) {
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
 * @return {boolean}
 */
export function isStaleMate(color, i, j, board) {
    if (hasValidMovements(color, board)) {
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
 * @param {string[]} movements
 */
export function threefoldRepetition(movements) {
    if (movements.length >= 12 && movements.length % 2 === 0) {
        let i = movements.length - 12;
        debugger;
        return movements[i + 0] === movements[i + 4] && movements[i + 4] === movements[i + 8]
            && movements[i + 2] === movements[i + 6] && movements[i + 6] === movements[i + 10]
            && movements[i + 1] === movements[i + 5] && movements[i + 5] === movements[i + 9]
            && movements[i + 3] === movements[i + 7] && movements[i + 7] === movements[i + 11];
    }

    return false;
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
 * @return {(Piece | null)[][]}
 */
export function generateArray() {
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
        return ((i === newI || j === newJ) || Math.abs(newI - i) === Math.abs(newJ - j))
            && checkHVCollisions(i, j, newI, newJ, board)
            && checkDCollisions(i, j, newI, newJ, board);
    });

    const QueenB = makePiece('Q', 'black', 'QueenB', (i, j, newI, newJ, board) => {
        return ((i === newI || j === newJ) || Math.abs(newI - i) === Math.abs(newJ - j))
            && checkHVCollisions(i, j, newI, newJ, board)
            && checkDCollisions(i, j, newI, newJ, board);
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

    const arr = [
        [{...RookB}, {...KnightB}, {...BishopB, posColor: 'white'}, {...QueenB}, {...KingB}, {...BishopB, posColor: 'black'}, {...KnightB}, {...RookB}],
        [{...PawnB}, {...PawnB}, {...PawnB}, {...PawnB}, {...PawnB}, {...PawnB}, {...PawnB}, {...PawnB}],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [{...PawnW}, {...PawnW}, {...PawnW}, {...PawnW}, {...PawnW}, {...PawnW}, {...PawnW}, {...PawnW}],
        [{...RookW}, {...KnightW}, {...BishopW, posColor: 'black'}, {...QueenW}, {...KingW}, {...BishopW, posColor: 'white'}, {...KnightW}, {...RookW}],
    ];

    return arr;
}

/**
 *
 * @param {Piece} piece
 * @param {number} i
 * @param {number} j
 * @param {number} newI
 * @param {number} newJ
 * @param {(Piece | null)[][]} board
 * @param {Piece} lastMoved
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

    const boardCopy = [...board.map(r => [...r])];

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
 * @param {Piece[][]} board
 */
export function promove(pawn, i, j, desiredPiece, board) {
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
 * @param {number} newI
 * @param {number} newJ
 * @param {(Piece | null)[][]} board
 * @param {Piece} lastMoved
 */
export function findDuplicateMovement(piece, newI, newJ, board, lastMoved) {
    for (let x = 0; x < 8; x++) {
        for (let y = 0; y < 8; y++) {
            const testingPiece = board[x][y];
            if (testingPiece && piece !== testingPiece && testingPiece.char === piece.char && testingPiece.color === piece.color && isValidMove(testingPiece, x, y, newI, newJ, board, lastMoved)) {
                return {x, y};
            }
        }
    }

    return null;
}
