import assert from 'node:assert/strict';
import test from 'node:test';
import { securityEncode } from '../src/security-encode';

test('securityEncode matches known VIGI vectors', () => {
    assert.equal(securityEncode(''), 'tyWcQbhc9TefbwK');
    assert.equal(securityEncode('admin'), 'WaQ7xbhc9TefbwK');
    assert.equal(securityEncode('password'), 'xHVQ3wiB9TefbwK');
    assert.equal(securityEncode('long-password-1234567890'), '4430UtxvyPU0wDKVkcMQfXq7');
});
