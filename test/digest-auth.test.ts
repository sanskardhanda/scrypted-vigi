import assert from 'node:assert/strict';
import test from 'node:test';
import { digestAuthHeader, parseDigestHeader } from '../src/digest-auth';

const challenge = 'Digest realm="testrealm@host.com", qop="auth", nonce="dcd98b7102dd2f0e8b11d0f600bfb0c093", opaque="5ccc069c403ebaf9f0171e9517f40e41"';

test('parseDigestHeader extracts challenge values', () => {
    assert.deepEqual(parseDigestHeader(challenge), {
        realm: 'testrealm@host.com',
        qop: 'auth',
        nonce: 'dcd98b7102dd2f0e8b11d0f600bfb0c093',
        opaque: '5ccc069c403ebaf9f0171e9517f40e41',
    });
});

test('digestAuthHeader builds RFC-compatible response with fixed nonce', () => {
    const header = digestAuthHeader('GET', '/dir/index.html', challenge, 'Mufasa', 'Circle Of Life', {
        cnonce: '0a4f113b',
        nc: 1,
    });

    assert.match(header, /^Digest /);
    assert.match(header, /username="Mufasa"/);
    assert.match(header, /response="6629fae49393a05397450978507c4ef1"/);
    assert.match(header, /opaque="5ccc069c403ebaf9f0171e9517f40e41"/);
    assert.match(header, /qop=auth/);
    assert.match(header, /nc=00000001/);
});
