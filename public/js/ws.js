/**
 *
 * @param {('ws'|'wss')} protocol
 * @param {string} address
 * @param {Object<string, Function>} commands
 * @return {WebSocket}
 */
export default function createSocket(protocol, address, commands) {
    const socket = new WebSocket(`${protocol}://${address}`, 'chessjs');

    socket.addEventListener('message', async e => {
        const message = JSON.parse(e.data);

        if (!(message.command in commands)) {
            return;
        }

        await commands[message.command](message);
    });


    return socket;
}
