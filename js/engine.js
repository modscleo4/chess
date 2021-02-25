import {boardToFEN, isValidMove, move, allMoves, isChecked} from './chess.js';

/**
 * @param {(import('./chess.js').Piece | null)[][]} board
 * @param {import('./chess.js').PlayerColor} currPlayer
 * @param {import('./chess.js').Piece | null} lastMoved
 * @return {Promise<number>}
 */
async function evaluate(board, currPlayer, lastMoved) {
    let whiteK = 0;
    let blackK = 0;
    let whiteQ = 0;
    let blackQ = 0;
    let whiteR = 0;
    let blackR = 0;
    let whiteB = 0;
    let blackB = 0;
    let whiteN = 0;
    let blackN = 0;
    let whiteP = 0;
    let blackP = 0;

    let whiteDP = 0;
    let blackDP = 0;
    let whiteBP = 0;
    let blackBP = 0;
    let whiteIP = 0;
    let blackIP = 0;

    let whiteM = 0;
    let blackM = 0;

    for (let i = 0; i < board.length; i++) {
        const row = board[i];
        for (let j = 0; j < row.length; j++) {
            const piece = row[j];
            if (!piece) {
                continue;
            }

            if (piece.color === 'white') {
                switch (piece.char) {
                    case 'K':
                        whiteK++;
                        break;

                    case 'Q':
                        whiteQ++;
                        break;

                    case 'R':
                        whiteR++;
                        break;

                    case 'B':
                        whiteB++;
                        break;

                    case 'N':
                        whiteN++;
                        break;

                    case 'P':
                        whiteP++;
                        break;
                }
            } else {
                switch (piece.char) {
                    case 'K':
                        blackK++;
                        break;

                    case 'Q':
                        blackQ++;
                        break;

                    case 'R':
                        blackR++;
                        break;

                    case 'B':
                        blackB++;
                        break;

                    case 'N':
                        blackN++;
                        break;

                    case 'P':
                        blackP++;
                        break;
                }
            }

            // Doubled Pawn
            if (piece.char === 'P') {
                for (let ii = 0; ii < board.length; ii++) {
                    const p = board[ii][j];
                    if (!p || ii === i) {
                        continue;
                    }

                    if (p.char === 'P' && p.color === piece.color) {
                        if (p.color === 'white') {
                            whiteDP++;
                        } else {
                            blackDP++;
                        }
                    }
                }
            }

            // Blocked Pawn
            if (piece.char === 'P') {
                const ii = piece.color === 'white' ? i - 1 : i + 1;
                if (ii >= 0 && ii <= board.length) {
                    const p = board[ii][j];

                    if (p && !isValidMove(piece, i, j, ii, j - 1, board, lastMoved) && !isValidMove(piece, i, j, ii, j + 1, board, lastMoved)) {
                        if (p.color === 'white') {
                            whiteBP++;
                        } else {
                            blackBP++;
                        }
                    }
                }
            }

            // Isolated Pawn
            if (piece.char === 'P') {
                if ((board[i][j - 1]?.color !== piece.color || board[i][j - 1]?.char !== 'P')
                    && (board[i][j + 1]?.color !== piece.color || board[i][j + 1]?.char !== 'P')) {
                    if (piece.color === 'white') {
                        whiteIP++;
                    } else {
                        blackIP++;
                    }
                }
            }

            //whiteM = allMoves(board, 'white', lastMoved).length;
            //blackM = allMoves(board, 'black', lastMoved).length;
        }
    }

    return (currPlayer === 'white' ? 1 : -1) * (
        200 * (whiteK - blackK) +
        9 * (whiteQ - blackQ) +
        5 * (whiteR - blackR) +
        3 * (whiteB - blackB) +
        3 * (whiteN - blackN) +
        1 * (whiteP - blackP) +
        -0.5 * (whiteDP - blackDP + whiteBP - blackBP + whiteIP + blackIP) +
        0.1 * (whiteM + blackM));
}

/**
 *
 * @param {number} alpha
 * @param {number} beta
 * @param {(import('./chess.js').Piece | null)[][]} board
 * @param {import('./chess.js').PlayerColor} currPlayer
 * @param {import('./chess.js').Piece | null} lastMoved
 * @return {Promise<number>}
 */
async function quiesce(alpha, beta, board, currPlayer, lastMoved) {
    const fen = boardToFEN(board, true);

    const stand_pat = (transpositionTable.get(fen) ?? await evaluate(board, currPlayer, lastMoved));
    transpositionTable.set(fen, stand_pat);
    if (stand_pat >= beta) {
        return beta;
    }

    alpha = Math.max(stand_pat, alpha);

    const moves = allMoves(board, currPlayer, lastMoved, true, true);
    for (let n = 0; n < moves.length; n++) {
        const fMove = moves[n];
        const boardCopy = board.map(r => [...r]);
        if (!move(fMove.i, fMove.j, fMove.newI, fMove.newJ, boardCopy, currPlayer, lastMoved, 'Q', true)) {
            continue;
        }

        const piece = board[fMove.i][fMove.j];

        const score = -(await quiesce(-beta, -alpha, boardCopy, currPlayer === 'white' ? 'black' : 'white', piece));

        if (score >= beta) {
            return beta;
        }

        alpha = Math.max(score, alpha);
    }

    return alpha;
}

let bestMove;
let maxScore;
let maxD;
let transpositionTable = new Map();
let dd = null;
let d = 0;

/**
 *
 * @param {number} alpha
 * @param {number} beta
 * @param {number} depth
 * @param {(import('./chess.js').Piece | null)[][]} board
 * @param {import('./chess.js').PlayerColor} currPlayer
 * @param {(import('./chess.js').Piece | null)} lastMoved
 * @param {Function} callback
 * @return {Promise<{score: number, move: {i: number, j: number, newI: number, newJ: number} | null, d: number}>}
 */
export async function negamax(alpha, beta, depth, board, currPlayer, lastMoved, callback) {
    d = Math.max(d, depth);
    if (depth === 0) {
        return {score: await quiesce(alpha, beta, board, currPlayer, lastMoved), move: bestMove, d: depth};
    }

    if (depth === d) {
        maxScore = -Infinity;
        bestMove = null;
        maxD = depth;
        dd = null;
        transpositionTable.clear();
    }

    const moves = allMoves(board, currPlayer, lastMoved, true);
    if (moves.length === 0) {
        const i = board.findIndex(row => row.find(p => p?.char === 'K' && p?.color === currPlayer));
        const j = i >= 0 && board[i].findIndex(p => p?.char === 'K' && p?.color === currPlayer) || -1;

        if (isChecked(currPlayer, i, j, board)) {
            return {score: -Infinity, move: bestMove, d: depth}; // Check Mate
        }

        return {score: 0, move: bestMove, d: depth}; // Stalemate
    }

    for (let n = 0; n < moves.length; n++) {
        const m = moves[n];

        const boardCopy = board.map(r => [...r]);
        if (!move(m.i, m.j, m.newI, m.newJ, boardCopy, currPlayer, lastMoved, 'Q', true)) {
            continue;
        }

        const piece = board[m.i][m.j];

        const result = await negamax(-beta, -alpha, depth - 1, boardCopy, currPlayer === 'white' ? 'black' : 'white', piece, callback);
        const score = -result.score;

        dd = result.d;

        if (depth === d && (score > maxScore || !bestMove || maxScore === -Infinity && result.d < maxD)) {
            maxScore = score;
            bestMove = m;
            maxD = result.d;
            callback(alpha, m);
        }

        if (score >= beta) { // Move was so good, opponent will not make it
            return {score: beta, move: bestMove, d: result.d};
        }

        if (score > alpha) {
            alpha = score;
        }
    }

    return {score: alpha, move: bestMove, d: dd ?? depth};
}
