import { replaceAt } from "./util.js";

export type Piece = {
    char: PieceChar;
    color: PlayerColor;
    value: number;
    image: string;
    neverMoved: boolean;
    allowedMove: (i: number, j: number, newI: number, newJ: number, board: Board, lastMoved: Piece | null) => boolean;
};

export type PlayerColor = 'white' | 'black';
export type PosColor = 'white' | 'black';

export type PieceChar = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';

export type Board = (Piece | null)[][];

export type Bishop = Piece & { posColor: PosColor; };
export type Pawn = Piece & { longMove: boolean; };
export type King = Piece & { neverMoved: boolean; checked: boolean; };

export function checkHVCollisions(i: number, j: number, newI: number, newJ: number, board: Board): boolean {
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

export function checkDCollisions(i: number, j: number, newI: number, newJ: number, board: Board): boolean {
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

export function hasValidMovements(color: PlayerColor, board: Board, lastMoved: Piece | null): boolean {
    for (let i = 0; i < board.length; i++) {
        for (let j = 0; j < board[i].length; j++) {
            const piece = board[i][j];

            if (piece?.color === color) {
                for (let newI = 0; newI < board.length; newI++) {
                    for (let newJ = 0; newJ < board[newI].length; newJ++) {
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

export function isChecked(color: string, i: number, j: number, board: Board): boolean {
    if (i < 0 || i >= board.length || j < 0 || j >= board[i].length) {
        return false;
    }

    // Up
    for (let x = i - 1, y = j; x >= 0; x--) {
        if (board[x][y]?.char && ['R', 'Q'].includes(board[x][y]?.char!) && board[x][y]?.color !== color) {
            return true;
        } else if (board[x][y]) {
            break;
        }
    }

    // Down
    for (let x = i + 1, y = j; x < board.length; x++) {
        if (board[x][y]?.char && ['R', 'Q'].includes(board[x][y]?.char!) && board[x][y]?.color !== color) {
            return true;
        } else if (board[x][y]) {
            break;
        }
    }

    // Left
    for (let x = i, y = j - 1; y >= 0; y--) {
        if (board[x][y]?.char && ['R', 'Q'].includes(board[x][y]?.char!) && board[x][y]?.color !== color) {
            return true;
        } else if (board[x][y]) {
            break;
        }
    }

    // Right
    for (let x = i, y = j + 1; y < board[x].length; y++) {
        if (board[x][y]?.char && ['R', 'Q'].includes(board[x][y]?.char!) && board[x][y]?.color !== color) {
            return true;
        } else if (board[x][y]) {
            break;
        }
    }

    // Left Up
    for (let x = i - 1, y = j - 1; x >= 0 && y >= 0; x--, y--) {
        if (board[x][y]?.char && ['B', 'Q'].includes(board[x][y]?.char!) && board[x][y]?.color !== color) {
            return true;
        } else if (board[x][y]) {
            break;
        }
    }

    // Left Down
    for (let x = i - 1, y = j + 1; x >= 0 && y < board[x].length; x--, y++) {
        if (board[x][y]?.char && ['B', 'Q'].includes(board[x][y]?.char!) && board[x][y]?.color !== color) {
            return true;
        } else if (board[x][y]) {
            break;
        }
    }

    // Right Up
    for (let x = i + 1, y = j - 1; x < board.length && y >= 0; x++, y--) {
        if (board[x][y]?.char && ['B', 'Q'].includes(board[x][y]?.char!) && board[x][y]?.color !== color) {
            return true;
        } else if (board[x][y]) {
            break;
        }
    }

    // Right Down
    for (let x = i + 1, y = j + 1; x < board.length && y < board[x].length; x++, y++) {
        if (board[x][y]?.char && ['B', 'Q'].includes(board[x][y]?.char!) && board[x][y]?.color !== color) {
            return true;
        } else if (board[x][y]) {
            break;
        }
    }

    // Pawn
    if (
        color === 'white'
        && i - 1 >= 0
        && (
            (
                board[i - 1][j - 1]?.char === 'P'
                && board[i - 1][j - 1]?.color !== color
            ) || (
                board[i - 1][j + 1]?.char === 'P'
                && board[i - 1][j + 1]?.color !== color
            )
        ) ||
        color === 'black'
        && i + 1 < board.length
        && (
            (
                board[i + 1][j - 1]?.char === 'P'
                && board[i + 1][j - 1]?.color !== color
            ) || (
                board[i + 1][j + 1]?.char === 'P'
                && board[i + 1][j + 1]?.color !== color
            )
        )
    ) {
        return true;
    }

    // Knight
    if (
        i - 2 >= 0 && (
            board[i - 2][j - 1]?.char === 'N'
            && board[i - 2][j - 1]?.color !== color
            || board[i - 2][j + 1]?.char === 'N'
            && board[i - 2][j + 1]?.color !== color
        )
        || i - 1 >= 0 && (
            board[i - 1][j - 2]?.char === 'N'
            && board[i - 1][j - 2]?.color !== color
            || board[i - 1][j + 2]?.char === 'N'
            && board[i - 1][j + 2]?.color !== color
        )
        || i + 1 < board.length && (
            board[i + 1][j - 2]?.char === 'N'
            && board[i + 1][j - 2]?.color !== color
            || board[i + 1][j + 2]?.char === 'N'
            && board[i + 1][j + 2]?.color !== color
        )
        || i + 2 < board.length && (
            board[i + 2][j - 1]?.char === 'N'
            && board[i + 2][j - 1]?.color !== color
            || board[i + 2][j + 1]?.char === 'N'
            && board[i + 2][j + 1]?.color !== color
        )
    ) {
        return true;
    }

    if (
        i - 1 >= 0 && (
            board[i - 1][j - 1]?.char === 'K'
            || board[i - 1][j]?.char === 'K'
            || board[i - 1][j + 1]?.char === 'K'
        )
        || board[i][j - 1]?.char === 'K'
        || board[i][j + 1]?.char === 'K'
        || i + 1 < board.length && (
            board[i + 1][j - 1]?.char === 'K'
            || board[i + 1][j]?.char === 'K'
            || board[i + 1][j + 1]?.char === 'K'
        )
    ) {
        return true;
    }

    return false;
}

export function isCheckMate(color: PlayerColor, board: Board, lastMoved: Piece | null): boolean {
    if (hasValidMovements(color, board, lastMoved)) {
        return false;
    }

    const { i, j } = findPiece(board, (p => p?.char === 'K' && p?.color === color));

    return isChecked(color, i, j, board);
}

export function isStaleMate(color: PlayerColor, board: Board, lastMoved: Piece | null): boolean {
    if (hasValidMovements(color, board, lastMoved)) {
        return false;
    }

    const { i, j } = findPiece(board, (p => p?.char === 'K' && p?.color === color));

    return !isChecked(color, i, j, board);
}

export function semiInsufficientMaterial(board: Board, playerColor: PlayerColor): boolean {
    const pieces = board.flat().filter(p => p?.color === playerColor);

    // For (real) insufficient material, You can only have 2 pieces, and no Rook, Queen, or Pawn
    return !pieces.find(p => p?.char === 'R') && !pieces.find(p => p?.char === 'Q') && !pieces.find(p => p?.char === 'P') && pieces.length <= 2;
}

export function insufficientMaterial(board: Board): boolean {
    const whitePieces = board.flat().filter(p => p?.color === 'white');
    const blackPieces = board.flat().filter(p => p?.color === 'black');

    if (semiInsufficientMaterial(board, 'white') && semiInsufficientMaterial(board, 'black')) {
        const whiteBishop = whitePieces.find(p => p?.char === 'B');
        const blackBishop = blackPieces.find(p => p?.char === 'B');
        if (whiteBishop && blackBishop) {
            return (whiteBishop as Bishop).posColor === (blackBishop as Bishop).posColor;
        }

        return true;
    }

    return false;
}

export function threefoldRepetition(fen: string): boolean {
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

export function fivefoldRepetition(fen: string[]): boolean {
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

export function boardToFEN(
    board: Board,
    onlyBoard: boolean,
    lastMoved: Piece | null,
    currPlayer: PlayerColor | null,
    newI: number,
    newJ: number,
    withTime: boolean = true,
    noCaptureOrPawnsQ: number | null = null,
    movements: string[] | null = null
): string {
    let fen = '';
    for (let x = 0; x < board.length; x++) {
        let empty = 0;
        for (let y = 0; y < board[x].length; y++) {
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

        x < board.length - 1 && (fen += '/');
    }

    if (onlyBoard) {
        return fen;
    }

    fen += ` ${currPlayer ? currPlayer[0] : ''}`;

    let fenCastling = ' ';

    const { i: KingW_i, j: KingW_j, piece: KingW } = findPiece(board, (p => p?.char === 'K' && p?.color === 'white'));
    const { i: KingB_i, j: KingB_j, piece: KingB } = findPiece(board, (p => p?.char === 'K' && p?.color === 'black'));

    if (KingW?.neverMoved) {
        if (board[7][7]?.neverMoved) {
            fenCastling += 'K';
        }

        if (board[7][0]?.neverMoved) {
            fenCastling += 'Q';
        }
    }

    if (KingB?.neverMoved) {
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
    if (lastMoved?.char === 'P' && (lastMoved as Pawn).longMove && (lastMoved.color === 'white' ? newI === 4 : newI === 3) && (board[newI][newJ - 1]?.char === 'P' && board[newI][newJ + 1]?.color !== lastMoved.color || board[newI][newJ + 1]?.char === 'P' && board[newI][newJ + 1]?.color !== lastMoved.color)) {
        fen += ` ${['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'][newJ]}${8 - newI + (lastMoved.color === 'white' ? -1 : 1)}`;
    } else {
        fen += ' -';
    }

    if (withTime) {
        fen += ` ${noCaptureOrPawnsQ}`;
        fen += ` ${Math.floor((movements?.length ?? 0) / 2 + 1)}`;
    }

    return fen;
}

function makePiece(char: PieceChar, color: PlayerColor, value: number, image: string, allowedMove: (this: Piece, i: number, j: number, newI: number, newJ: number, board: Board, lastMoved: Piece | null) => boolean, posColor?: 'white' | 'black'): Piece {
    if (char === 'B') {
        return ({
            char,
            color,
            value,
            image,
            neverMoved: true,
            allowedMove,
            posColor,
        } as Bishop);
    } else {
        return {
            char,
            color,
            value,
            image,
            neverMoved: true,
            allowedMove,
        };
    }
}

/**
 *
 * @param {string} fen
 * @return {boolean}
 */
export function validateFEN(fen: string): boolean {
    return !!fen.match(/((([prnbqkPRNBQK1-8]+\/){7})([prnbqkPRNBQK12345678]*)) ([wb]) ((K?Q?k?q?)|\-) (([abcdefgh][36])|\-) (\d+) (\d+)/);
}

/**
 * @param {string} [fen='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1']
 * @return {Board}
 */
export function generateArray(fen: string = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'): Board {
    const board = fen.replace(/ .*/, '').split('/');

    const RookW = makePiece('R', 'white', 5, 'RookW', (i, j, newI, newJ, board) => {
        return (i === newI || j === newJ)
            && checkHVCollisions(i, j, newI, newJ, board);
    });

    const RookB = makePiece('R', 'black', 5, 'RookB', (i, j, newI, newJ, board) => {
        return (i === newI || j === newJ)
            && checkHVCollisions(i, j, newI, newJ, board);
    });

    const KnightW = makePiece('N', 'white', 3, 'KnightW', (i, j, newI, newJ, board) => {
        return (Math.abs(newI - i) === 2 && Math.abs(newJ - j) === 1 || Math.abs(newI - i) === 1 && Math.abs(newJ - j) === 2);
    });

    const KnightB = makePiece('N', 'black', 3, 'KnightB', (i, j, newI, newJ, board) => {
        return (Math.abs(newI - i) === 2 && Math.abs(newJ - j) === 1 || Math.abs(newI - i) === 1 && Math.abs(newJ - j) === 2);
    });

    const BishopW = makePiece('B', 'white', 3, 'BishopW', (i, j, newI, newJ, board) => {
        return (Math.abs(newI - i) === Math.abs(newJ - j))
            && checkDCollisions(i, j, newI, newJ, board);
    });

    const BishopB = makePiece('B', 'black', 3, 'BishopB', (i, j, newI, newJ, board) => {
        return (Math.abs(newI - i) === Math.abs(newJ - j))
            && checkDCollisions(i, j, newI, newJ, board);
    });

    const QueenW = makePiece('Q', 'white', 9, 'QueenW', (i, j, newI, newJ, board) => {
        return ((i === newI || j === newJ) && checkHVCollisions(i, j, newI, newJ, board)
            || Math.abs(newI - i) === Math.abs(newJ - j)) && checkDCollisions(i, j, newI, newJ, board);
    });

    const QueenB = makePiece('Q', 'black', 9, 'QueenB', (i, j, newI, newJ, board) => {
        return ((i === newI || j === newJ) && checkHVCollisions(i, j, newI, newJ, board)
            || Math.abs(newI - i) === Math.abs(newJ - j)) && checkDCollisions(i, j, newI, newJ, board);
    });

    const KingW = makePiece('K', 'white', 200, 'KingW', function (i, j, newI, newJ, board) {
        return (Math.abs(newI - i) <= 1 && Math.abs(newJ - j) <= 1)
            || this.neverMoved && (Math.abs(newJ - j) === 2 && newI === i && (newJ < j ? board[i][0] : board[i][7])?.neverMoved && checkHVCollisions(i, j, newI, newJ + 1, board) && !isChecked(this.color, i, j, board)) || false;
    });

    const KingB = makePiece('K', 'black', 200, 'KingB', function (i, j, newI, newJ, board) {
        return (Math.abs(newI - i) <= 1 && Math.abs(newJ - j) <= 1)
            || this.neverMoved && (Math.abs(newJ - j) === 2 && newI === i && (newJ < j ? board[i][0] : board[i][7])?.neverMoved && checkHVCollisions(i, j, newI, newJ + 1, board) && !isChecked(this.color, i, j, board)) || false;
    });

    const PawnW = makePiece('P', 'white', 1, 'PawnW', function (i, j, newI, newJ, board, lastMoved) {
        return (((i === 6 && newI === i - 2) || newI === i - 1) && newJ === j && checkHVCollisions(i, j, newI, newJ, board))
            || ((i - 1 === newI && j + 1 === newJ && board[i - 1][j + 1] && board[i - 1][j + 1]?.color !== this.color) || (i - 1 === newI && j - 1 === newJ && board[i - 1][j - 1] && board[i - 1][j - 1]?.color !== this.color))
            || (i === 3 && (newI === i - 1
                && ((newJ === j - 1 && board[i][j - 1] && board[i][j - 1]?.char === 'P' && (board[i][j - 1] as Pawn | null)?.longMove && board[i][j - 1] == lastMoved && board[i][j - 1]?.color !== this.color)
                    || (newJ === j + 1 && board[i][j + 1] && board[i][j + 1]?.char === 'P' && (board[i][j + 1] as Pawn | null)?.longMove && board[i][j + 1] == lastMoved && board[i][j + 1]?.color !== this.color)))) || false;
    });

    const PawnB = makePiece('P', 'black', 1, 'PawnB', function (i, j, newI, newJ, board, lastMoved) {
        return (((i === 1 && newI === i + 2) || newI === i + 1) && newJ === j && checkHVCollisions(i, j, newI, newJ, board))
            || ((i + 1 === newI && j + 1 === newJ && board[i + 1][j + 1] && board[i + 1][j + 1]?.color !== this.color) || (i + 1 === newI && j - 1 === newJ && board[i + 1][j - 1] && board[i + 1][j - 1]?.color !== this.color))
            || (i === 4 && (newI === i + 1
                && ((newJ === j - 1 && board[i][j - 1] && board[i][j - 1]?.char === 'P' && (board[i][j - 1] as Pawn | null)?.longMove && board[i][j - 1] == lastMoved && board[i][j - 1]?.color !== this.color)
                    || (newJ === j + 1 && board[i][j + 1] && board[i][j + 1]?.char === 'P' && (board[i][j + 1] as Pawn | null)?.longMove && board[i][j + 1] == lastMoved && board[i][j + 1]?.color !== this.color)))) || false;
    });

    const castling = / [wb] (?<Castling>K?Q?k?q?)/.exec(fen)?.groups?.Castling;

    const enPassant = / [wb] K?Q?k?q? (?<EnPassant>(?:-|[a-z]\d))/.exec(fen)?.groups?.EnPassant;

    const arr = board.map((row, i) => {
        if (/\d+/g.test(row)) {
            const matches = row.match(/(\d+)/g);
            matches?.forEach(match => {
                const n = Number.parseInt(match);

                row = replaceAt(row, row.indexOf(match), ' '.repeat(n));
            });
        }

        return Array.from(row).map((char, j) => {
            if (char === ' ') {
                return null;
            }

            let longMove = false;
            let neverMoved = true;

            if (castling && (!castling.includes('K') && j === 7  || !castling.includes('Q') && j == 0)) {
                neverMoved = false;
            }

            if (enPassant && enPassant !== '-') {
                longMove = true;
                neverMoved = false;
            }

            const posColor = i % 2 === 0 ? (j % 2 === 0 ? 'white' : 'black') : (j % 2 === 0 ? 'black' : 'white');

            return {
                r: { ...RookB, neverMoved },
                n: { ...KnightB },
                b: { ...BishopB, posColor },
                q: { ...QueenB },
                k: { ...KingB },
                p: { ...PawnB, neverMoved, longMove },
                R: { ...RookW, neverMoved },
                N: { ...KnightW },
                B: { ...BishopW, posColor },
                Q: { ...QueenW },
                K: { ...KingW },
                P: { ...PawnW, neverMoved, longMove },
            }[char]!;
        });
    });

    return arr;
}

export function pgnToCoord(
    pgn: string,
    board: Board,
    currPlayer: PlayerColor,
    lastMoved: Piece | null
): { i: number, j: number, newI: number, newJ: number, promoteTo: string | null; } {
    pgn = pgn.replace(/[+#]$/, '');
    pgn = pgn.replace(/ e.p.$/, '');

    let promoteTo = null;
    let i = 0;
    let j = 0;
    let newI = 0;
    let newJ = 0;
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

            if (i !== undefined && x !== i) {
                continue;
            }

            for (let y = j ?? 0; y < row.length; y++) {
                const piece = row[y];
                if (!piece) {
                    continue;
                }

                if (j !== undefined && y !== j) {
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

    return { i, j, newI, newJ, promoteTo };
}

export function findPiece(board: Board, fn: (piece: Piece | null) => boolean): { i: number, j: number, piece: Piece | null; } {
    for (let i = 0; i < board.length; i++) {
        for (let j = 0; j < board[i].length; j++) {
            if (fn(board[i][j])) {
                return { i, j, piece: board[i][j] };
            }
        }
    }

    return { i: -1, j: -1, piece: null };
}

export function isValidMove(piece: Piece, i: number, j: number, newI: number, newJ: number, board: Board, lastMoved: Piece | null): boolean {
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

    const { i: King_i, j: King_j } = findPiece(boardCopy, (p => p?.char === 'K' && p?.color === piece.color));

    if (isChecked(piece.color, King_i, King_j, boardCopy)) {
        return false;
    }

    return true;
}

export function move(
    i: number,
    j: number,
    newI: number,
    newJ: number,
    board: Board,
    currPlayer: PlayerColor,
    lastMoved: Piece | null,
    promoteTo: 'Q' | 'R' | 'B' | 'N',
    checkValid: boolean = true
): { capture: boolean, enPassant: boolean, promotion: boolean, castling: number, check: boolean, takenPiece: Piece | null; } | null {
    const piece = board[i][j];
    if (!piece) {
        return null;
    }

    if (newI === i && newJ === j) {
        return null;
    }

    if (checkValid) {
        if (!isValidMove(piece, i, j, newI, newJ, board, lastMoved)) {
            return null;
        }
    }

    let capture = false;
    let enPassant = false;
    let promotion = false;
    let castling = 0;
    let check = false;

    let takenPiece = board[newI][newJ]; // Capture
    if (piece.char === 'P' && !takenPiece && newJ !== j && ((piece.color === 'white' && i === 3) || (piece.color === 'black' && i === 4))) {
        enPassant = true; // En Passant Capture
        takenPiece = board[i][newJ];
        board[i][newJ] = null;
    }

    capture = !!takenPiece;

    board[i][j] = null;
    board[newI][newJ] = piece;

    if (piece.char === 'P' && [0, 7].includes(newI)) { // Promotion
        promote(piece, newI, newJ, promoteTo, board);
        promotion = true;
    }

    if (piece.char === 'K' && Math.abs(newJ - j) === 2) {
        if (newJ > j) {
            const rook = board[i][7];
            board[i][j + 1] = rook;
            board[i][7] = null;
            castling = 1;
        } else {
            const rook = board[i][0];
            board[i][j - 1] = rook;
            board[i][0] = null;
            castling = 2;
        }
    }

    const { i: King_i, j: King_j } = findPiece(board, (p => p?.char === 'K' && p?.color !== piece.color));

    if (isChecked(piece.color === 'white' ? 'black' : 'white', King_i, King_j, board)) {
        check = true;
    }

    if (piece.char === 'P' && Math.abs(newI - i) === 2) {
        (piece as Pawn).longMove = true; // For En Passant verification
    }

    piece.neverMoved = false;

    return {
        capture,
        enPassant,
        promotion,
        castling,
        check,
        takenPiece,
    };
}

export function result(
    board: Board,
    currPlayer: PlayerColor,
    lastMoved: Piece | null,
    noCaptureOrPawnsQ: number,
    fen: string[]
): { won: PlayerColor | null, draw: boolean, result: string | null, reason: string | null; } {
    let won: PlayerColor | null = null;
    let draw = false;
    let result = null;
    let reason = null;

    if (isCheckMate('white', board, lastMoved)) {
        won = 'black';
        draw = false;
        result = '0-1';
        reason = 'checkmate';
    } else if (isCheckMate('black', board, lastMoved)) {
        won = 'white';
        draw = false;
        result = '1-0';
        reason = 'checkmate';
    } else if (isStaleMate('black', board, lastMoved) || isStaleMate('white', board, lastMoved)) {
        won = null;
        draw = true;
        result = '½–½';
        reason = 'stalemate';
    } else if (insufficientMaterial(board)) { // Insufficient Material (K-K, KN-K, KB-K, KB-KB)
        won = null;
        draw = true;
        result = '½–½';
        reason = 'isufficientMaterial';
    } else if (noCaptureOrPawnsQ === 150) { // 75 Movement rule
        won = null;
        draw = true;
        result = '½–½';
        reason = 'seventyFive';
    } else if (fivefoldRepetition(fen)) { // 5 Repetition rule
        won = null;
        draw = true;
        result = '½–½';
        reason = 'fivefold';
    }

    return {
        won,
        draw,
        result,
        reason,
    };
}

export function promote(pawn: Piece, i: number, j: number, desiredPiece: 'Q' | 'R' | 'B' | 'N', board: Board): boolean {
    if (!['Q', 'B', 'N', 'R'].includes(desiredPiece)) {
        return false;
    }

    const piece = makePiece(desiredPiece, pawn.color, { Q: 9, B: 3, N: 3, R: 5 }[desiredPiece], { Q: 'Queen', B: 'Bishop', N: 'Knight', R: 'Rook' }[desiredPiece] + pawn.color[0].toUpperCase(), {
        Q: (i: number, j: number, newI: number, newJ: number, board: Board) => {
            return ((i === newI || j === newJ) || Math.abs(newI - i) === Math.abs(newJ - j))
                && checkHVCollisions(i, j, newI, newJ, board)
                && checkDCollisions(i, j, newI, newJ, board);
        },

        B: (i: number, j: number, newI: number, newJ: number, board: Board) => {
            return (Math.abs(newI - i) === Math.abs(newJ - j))
                && checkDCollisions(i, j, newI, newJ, board);
        },

        N: (i: number, j: number, newI: number, newJ: number, board: Board) => {
            return (Math.abs(newI - i) === 2 && Math.abs(newJ - j) === 1 || Math.abs(newI - i) === 1 && Math.abs(newJ - j) === 2);
        },

        R: (i: number, j: number, newI: number, newJ: number, board: Board) => {
            return (i === newI || j === newJ)
                && checkHVCollisions(i, j, newI, newJ, board);
        },
    }[desiredPiece]);

    board[i][j] = piece;

    return true;
}

export function findDuplicateMovement(piece: Piece, i: number, j: number, newI: number, newJ: number, board: Board, lastMoved: Piece | null): { sameFile: boolean, sameRank: boolean; } | null {
    if (piece.char === 'P') {
        return null;
    }

    let duplicate = false;
    let sameFile = false;
    let sameRank = false;

    for (let x = 0; x < board.length; x++) {
        for (let y = 0; y < board[x].length; y++) {
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

export function allMoves(board: Board, currPlayer: PlayerColor, lastMoved: Piece | null, sort: boolean = false, onlyCaptures: boolean = false): { i: number; j: number; newI: number; newJ: number; }[] {
    const ret = [];

    for (let i = 0; i < board.length; i++) {
        for (let j = 0; j < board[i].length; j++) {
            const piece = board[i][j];
            if (!piece || piece.color !== currPlayer) {
                continue;
            }

            for (let newI = 0; newI < board.length; newI++) {
                for (let newJ = 0; newJ < board[newI].length; newJ++) {
                    if (!isValidMove(piece, i, j, newI, newJ, board, lastMoved)) {
                        continue;
                    }

                    if (onlyCaptures && !board[newI][newJ]) {
                        continue;
                    }

                    ret.push({ i, j, newI, newJ });
                }
            }
        }
    }

    if (!sort) {
        return ret;
    }

    const { i: KingW_i, j: KingW_j } = findPiece(board, (p => p?.char === 'K' && p?.color === 'white'));
    const { i: KingB_i, j: KingB_j } = findPiece(board, (p => p?.char === 'K' && p?.color === 'black'));

    return ret.sort((a, b) => {
        const pieceA = board[a.i][a.j];
        const targetA = board[a.newI][a.newJ];

        const pieceB = board[b.i][b.j];
        const targetB = board[b.newI][b.newJ];

        let boardCopy = board.map(r => [...r]);
        move(a.i, a.j, a.newI, a.newJ, boardCopy, currPlayer, lastMoved, 'Q');

        let scoreA = 0;
        if (
            currPlayer === 'white' && isChecked('black', KingB_i, KingB_j, boardCopy)
            || currPlayer === 'black' && isChecked('white', KingW_i, KingW_j, boardCopy)
        ) {
            scoreA += 100;
        }

        if (targetA) {
            scoreA += 10 * targetA.value - (pieceA?.value ?? 0);
        }

        if ([0, board.length - 1].includes(a.newI) && pieceA?.char === 'P') {
            scoreA += 9;
        }

        if (
            board[a.newI + (pieceA?.color === 'white' ? -1 : 1)][a.newJ + 1]?.char === 'P' && board[a.newI + (pieceA?.color === 'white' ? -1 : 1)][a.newJ + 1]?.color !== pieceA?.color
            || board[a.newI + (pieceA?.color === 'white' ? -1 : 1)][a.newJ - 1]?.char === 'P' && board[a.newI + (pieceA?.color === 'white' ? -1 : 1)][a.newJ - 1]?.color !== pieceA?.color
        ) {
            scoreA -= (pieceA?.value ?? 0);
        }

        boardCopy = board.map(r => [...r]);
        move(b.i, b.j, b.newI, b.newJ, boardCopy, currPlayer, lastMoved, 'Q');

        let scoreB = 0;
        if (currPlayer === 'white' && isChecked('black', KingB_i, KingB_j, boardCopy)
            || currPlayer === 'black' && isChecked('white', KingW_i, KingW_j, boardCopy)) {
            scoreA += 100;
        }

        if (targetB) {
            scoreB += 10 * targetB.value - (pieceB?.value ?? 0);
        }

        if ([0, board.length - 1].includes(b.newI) && pieceB?.char === 'P') {
            scoreB += 9;
        }

        if (
            board[b.newI + (pieceB?.color === 'white' ? -1 : 1)][b.newJ + 1]?.char === 'P' && board[b.newI + (pieceB?.color === 'white' ? -1 : 1)][b.newJ + 1]?.color !== pieceB?.color
            || board[b.newI + (pieceB?.color === 'white' ? -1 : 1)][b.newJ - 1]?.char === 'P' && board[b.newI + (pieceB?.color === 'white' ? -1 : 1)][b.newJ - 1]?.color !== pieceB?.color
        ) {
            scoreB -= (pieceB?.value ?? 0);
        }

        return scoreB - scoreA;
    });
}
