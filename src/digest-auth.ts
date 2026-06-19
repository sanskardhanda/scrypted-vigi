import crypto from 'crypto';

const authKeyValue = /(\w+)=["']?([^'",]+)["']?/;
const ncPad = '00000000';

export interface DigestAuthOptions {
    cnonce?: string;
    nc?: number;
}

export function parseDigestHeader(header: string): Record<string, string> {
    const digest = header.trim().replace(/^Digest\s+/i, '');
    const parts = digest.split(',');
    const options: Record<string, string> = {};

    for (const part of parts) {
        const match = part.trim().match(authKeyValue);
        if (match)
            options[match[1]] = match[2].replace(/["']/g, '');
    }

    return options;
}

function md5(value: string): string {
    return crypto.createHash('md5').update(value).digest('hex');
}

export function digestAuthHeader(method: string, uri: string, wwwAuthenticate: string, username: string, password: string, options: DigestAuthOptions = {}): string {
    const digest = parseDigestHeader(wwwAuthenticate);

    if (!digest.realm || !digest.nonce)
        throw new Error('Invalid digest challenge: missing realm or nonce.');

    let qop = digest.qop || '';
    if (qop)
        qop = qop.split(',')[0];

    const ncNumber = options.nc ?? 1;
    const nc = ncPad.substring(String(ncNumber).length) + ncNumber;
    const cnonce = options.cnonce ?? crypto.randomBytes(8).toString('hex');
    const ha1 = md5(`${username}:${digest.realm}:${password}`);
    const ha2 = md5(`${method.toUpperCase()}:${uri}`);

    let responseBase = `${ha1}:${digest.nonce}`;
    if (qop)
        responseBase += `:${nc}:${cnonce}:${qop}`;
    responseBase += `:${ha2}`;

    const response = md5(responseBase);

    const values = [
        `Digest username="${username}"`,
        `realm="${digest.realm}"`,
        `nonce="${digest.nonce}"`,
        `uri="${uri}"`,
        `response="${response}"`,
    ];

    if (digest.opaque)
        values.push(`opaque="${digest.opaque}"`);
    if (qop)
        values.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`);
    if (digest.algorithm)
        values.push(`algorithm=${digest.algorithm}`);
    else
        values.push('algorithm=MD5');

    return values.join(', ');
}
