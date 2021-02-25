import {negamax} from './engine.js';
import {generateArray} from './chess.js';

/**
 *
 * @param {MessageEvent<any>} e
 */
addEventListener('message', async e => {
    const [alpha, beta, depth, fen, currPlayer, lastMovedI, lastMovedJ] = e.data;
    const board = generateArray(fen);

    let lastMoved = null;
    if (lastMovedI && lastMovedJ) {
        lastMoved = board[lastMovedI][lastMovedJ];
    }

    const {score, move, d} = await negamax(alpha, beta, depth, board, currPlayer, lastMoved, async (score, move) => {
        postMessage([(currPlayer === 'white' ? 1 : -1) * score, move]);
    });

    postMessage([(currPlayer === 'white' ? 1 : -1) * score, move]);
}, false);
