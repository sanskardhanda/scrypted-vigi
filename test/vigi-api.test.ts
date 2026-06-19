import assert from 'node:assert/strict';
import test from 'node:test';
import net, { AddressInfo } from 'net';
import { VigiApi } from '../src/vigi-api';

function writeDeviceJson(socket: NodeJS.WritableStream, seq: number, params: any) {
    const body = Buffer.from(JSON.stringify({
        type: 'response',
        seq,
        params,
    }));

    socket.write('----device-stream-boundary--\r\n');
    socket.write('Content-Type: application/json\r\n');
    socket.write(`Content-Length: ${body.length}\r\n\r\n`);
    socket.write(body);
    socket.write('\r\n');
}

test('VigiApi authenticates and writes talk audio multipart data', async t => {
    let sawAuthorization = false;
    let sawTalkRequest = false;
    let sawAudio = false;

    const server = net.createServer(socket => {
        let buffer = Buffer.alloc(0);
        let sentHttpResponse = false;
        let authenticated = false;
        let sentTalkResponse = false;

        socket.on('data', data => {
            buffer = Buffer.concat([buffer, data]);

            if (!sentHttpResponse) {
                const headerEnd = buffer.indexOf('\r\n\r\n');
                if (headerEnd === -1)
                    return;

                const request = buffer.subarray(0, headerEnd).toString();
                buffer = buffer.subarray(headerEnd + 4);
                sentHttpResponse = true;

                if (!request.includes('Authorization:')) {
                    socket.write([
                        'HTTP/1.1 401 Unauthorized',
                        'WWW-Authenticate: Digest realm="vigi", qop="auth", nonce="abc", opaque="opaque"',
                        'Content-Length: 0',
                        '',
                        '',
                    ].join('\r\n'));
                    return;
                }

                sawAuthorization = request.includes('Digest username="admin"');
                authenticated = true;
                socket.write([
                    'HTTP/1.1 200 OK',
                    'Content-Type: multipart/mixed; boundary=--device-stream-boundary--',
                    'Key-Exchange: cipher="AES_128_CBC" username="admin" padding="PKCS7_16" algorithm="MD5" nonce="abc"',
                    'Content-Length: 0',
                    '',
                    '',
                ].join('\r\n'));
            }

            if (!authenticated)
                return;

            const text = buffer.toString();
            if (!sentTalkResponse && text.includes('"talk"')) {
                sentTalkResponse = true;
                sawTalkRequest = true;
                writeDeviceJson(socket, 1, {
                    session_id: 'session-1',
                });
            }
            if (text.includes('Content-Type: audio/mp2t') && text.includes('X-Session-Id: session-1'))
                sawAudio = true;
        });
    });

    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => server.close());

    const address = server.address() as AddressInfo;
    const api = await VigiApi.connect({
        host: '127.0.0.1',
        port: address.port,
        username: 'admin',
        password: 'password',
    });

    api.processMessages().catch(() => undefined);
    const writable = await api.startMpegTsBackchannel();
    writable.write(Buffer.alloc(188, 0x47));

    await new Promise(resolve => setTimeout(resolve, 50));
    api.close();

    assert.equal(sawAuthorization, true);
    assert.equal(sawTalkRequest, true);
    assert.equal(sawAudio, true);
});
