/**
 *
 * @param {string} address
 * @param {Object<string, Function>} commands
 * @return {WebSocket}
 */
export default function createSocket(address, commands) {
    const socket = new WebSocket(`ws://${address}:3000`, 'chessjs');

    socket.addEventListener('message', async e => {
        const message = JSON.parse(e.data);

        if (!(message.command in commands)) {
            return;
        }

        await commands[message.command](message);
    });


    return socket;
};;;
