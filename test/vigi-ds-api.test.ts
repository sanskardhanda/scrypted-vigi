import assert from 'node:assert/strict';
import crypto from 'crypto';
import test from 'node:test';
import { VigiDsApi, VigiDsTransportRequest } from '../src/vigi-ds-api';

function createPublicKey(): string {
    const { publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
    });
    return encodeURIComponent(publicKey.export({
        format: 'der',
        type: 'spki',
    }).toString('base64'));
}

function createApi(handler: (request: VigiDsTransportRequest) => Promise<any> | any) {
    const requests: VigiDsTransportRequest[] = [];
    const api = new VigiDsApi({
        host: '10.0.0.2',
        username: 'admin',
        password: 'password',
        transport: async request => {
            requests.push(request);
            return handler(request);
        },
    });

    return {
        api,
        requests,
    };
}

test('VigiDsApi authenticates and sends white light on commands', async () => {
    const key = createPublicKey();
    const { api, requests } = createApi(request => {
        if (request.path === '/' && request.body.user_management?.get_encrypt_info === null) {
            return {
                error_code: 0,
                data: {
                    key,
                    nonce: 'nonce-1',
                },
            };
        }
        if (request.path === '/' && request.body.login) {
            assert.equal(request.body.login.username, 'admin');
            assert.equal(request.body.login.passwdType, 'md5');
            assert.equal(request.body.login.encrypt_type, '2');
            assert.notEqual(request.body.login.password, 'password');
            return {
                error_code: 0,
                stok: 'stok-1',
            };
        }
        if (request.path === '/stok=stok-1/ds')
            return { error_code: 0 };

        throw new Error('Unexpected request: ' + JSON.stringify(request));
    });

    await api.setWhiteLight(true);

    assert.equal(requests.length, 4);
    assert.deepEqual(requests[2].body, {
        method: 'set',
        image: {
            switch: {
                night_vision_mode: 'wtl_night_vision',
            },
        },
    });
    assert.deepEqual(requests[3].body, {
        method: 'set',
        image: {
            common: {
                inf_type: 'on',
                wtl_type: 'on',
            },
        },
    });
});

test('VigiDsApi sends white light off commands', async () => {
    const key = createPublicKey();
    const { api, requests } = createApi(request => {
        if (request.path === '/' && request.body.user_management?.get_encrypt_info === null) {
            return {
                error_code: 0,
                data: {
                    key,
                    nonce: 'nonce-1',
                },
            };
        }
        if (request.path === '/' && request.body.login) {
            return {
                error_code: 0,
                stok: 'stok-1',
            };
        }
        if (request.path === '/stok=stok-1/ds')
            return { error_code: 0 };

        throw new Error('Unexpected request: ' + JSON.stringify(request));
    });

    await api.setWhiteLight(false);

    assert.deepEqual(requests[2].body, {
        method: 'set',
        image: {
            switch: {
                night_vision_mode: 'inf_night_vision',
            },
        },
    });
    assert.deepEqual(requests[3].body, {
        method: 'set',
        image: {
            common: {
                inf_type: 'auto',
                wtl_type: 'auto',
            },
        },
    });
});

test('VigiDsApi reauthenticates once after a failed ds command', async () => {
    const key = createPublicKey();
    let loginCount = 0;
    let dsCount = 0;
    const { api, requests } = createApi(request => {
        if (request.path === '/' && request.body.user_management?.get_encrypt_info === null) {
            return {
                error_code: 0,
                data: {
                    key,
                    nonce: `nonce-${loginCount + 1}`,
                },
            };
        }
        if (request.path === '/' && request.body.login) {
            loginCount++;
            return {
                error_code: 0,
                stok: `stok-${loginCount}`,
            };
        }
        if (request.path.endsWith('/ds')) {
            dsCount++;
            if (dsCount === 1)
                return { error_code: -40401 };
            return { error_code: 0 };
        }

        throw new Error('Unexpected request: ' + JSON.stringify(request));
    });

    await api.setWhiteLight(true);

    const dsPaths = requests.filter(request => request.path.endsWith('/ds')).map(request => request.path);
    assert.equal(loginCount, 2);
    assert.deepEqual(dsPaths, [
        '/stok=stok-1/ds',
        '/stok=stok-2/ds',
        '/stok=stok-2/ds',
    ]);
});
