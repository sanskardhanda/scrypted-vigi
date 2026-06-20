import crypto from 'crypto';
import https from 'https';

export interface VigiDsConnectOptions {
    host: string;
    port?: number;
    username: string;
    password: string;
    rejectUnauthorized?: boolean;
    transport?: VigiDsTransport;
}

export interface VigiDsTransportRequest {
    host: string;
    port: number;
    path: string;
    body: any;
    rejectUnauthorized: boolean;
}

export type VigiDsTransport = (request: VigiDsTransportRequest) => Promise<any>;

const VigiPasswordPrefix = 'TPCQ75NF2Y:';

export class VigiDsApi {
    private stok?: string;
    private readonly port: number;
    private readonly rejectUnauthorized: boolean;
    private readonly transport: VigiDsTransport;

    constructor(private options: VigiDsConnectOptions) {
        if (!options.host)
            throw new Error('VIGI host is required.');
        if (!options.username)
            throw new Error('VIGI username is required.');
        if (!options.password)
            throw new Error('VIGI password is required.');

        this.port = options.port || 443;
        this.rejectUnauthorized = options.rejectUnauthorized ?? false;
        this.transport = options.transport || httpsJsonTransport;
    }

    async setWhiteLight(enabled: boolean): Promise<void> {
        await this.dsRequest({
            method: 'set',
            image: {
                switch: {
                    night_vision_mode: enabled ? 'wtl_night_vision' : 'inf_night_vision',
                },
            },
        });

        await this.dsRequest({
            method: 'set',
            image: {
                common: {
                    inf_type: enabled ? 'on' : 'auto',
                    wtl_type: enabled ? 'on' : 'auto',
                },
            },
        });
    }

    async getWhiteLight(): Promise<boolean | undefined> {
        const response = await this.dsRequest({
            method: 'get',
            image: {
                name: 'switch',
            },
        });

        const nightVisionMode = findStringValue(response, 'night_vision_mode');
        if (nightVisionMode === 'wtl_night_vision')
            return true;
        if (nightVisionMode === 'inf_night_vision')
            return false;

        const whiteLightType = findStringValue(response, 'wtl_type');
        if (whiteLightType === 'on')
            return true;
        if (whiteLightType === 'auto' || whiteLightType === 'off')
            return false;
    }

    private async authenticate(): Promise<void> {
        const encryptInfoResponse = await this.post('/', {
            user_management: {
                get_encrypt_info: null,
            },
            method: 'do',
        });
        assertSuccess(encryptInfoResponse, 'get VIGI encryption info');

        const nonce = encryptInfoResponse?.data?.nonce;
        const key = encryptInfoResponse?.data?.key;
        if (!nonce || !key)
            throw new Error('VIGI encryption info did not include nonce and key.');

        const publicKeyDer = Buffer.from(decodeURIComponent(key), 'base64');
        const publicKey = crypto.createPublicKey({
            key: publicKeyDer,
            format: 'der',
            type: 'spki',
        });
        const passwordHash = crypto
            .createHash('md5')
            .update(VigiPasswordPrefix + this.options.password)
            .digest('hex')
            .toUpperCase();
        const encryptedPassword = crypto.publicEncrypt({
            key: publicKey,
            padding: crypto.constants.RSA_PKCS1_PADDING,
        }, Buffer.from(`${passwordHash}:${nonce}`)).toString('base64');

        const loginResponse = await this.post('/', {
            method: 'do',
            login: {
                username: this.options.username,
                password: encryptedPassword,
                passwdType: 'md5',
                encrypt_type: '2',
            },
        });
        assertSuccess(loginResponse, 'log in to VIGI camera');

        const stok = loginResponse?.stok || loginResponse?.data?.stok;
        if (!stok)
            throw new Error('VIGI login response did not include stok.');

        this.stok = stok;
    }

    private async dsRequest(body: any, retry = true): Promise<any> {
        if (!this.stok)
            await this.authenticate();

        const response = await this.post(`/stok=${encodeURIComponent(this.stok!)}/ds`, body);
        if (isSuccess(response))
            return response;

        if (!retry)
            throw new Error('VIGI /ds request failed: ' + JSON.stringify(response));

        this.stok = undefined;
        await this.authenticate();
        return this.dsRequest(body, false);
    }

    private async post(path: string, body: any): Promise<any> {
        return this.transport({
            host: this.options.host,
            port: this.port,
            path,
            body,
            rejectUnauthorized: this.rejectUnauthorized,
        });
    }
}

function assertSuccess(response: any, operation: string): void {
    if (!isSuccess(response))
        throw new Error(`Failed to ${operation}: ${JSON.stringify(response)}`);
}

function isSuccess(response: any): boolean {
    return response?.error_code === undefined || response.error_code === 0;
}

function findStringValue(value: any, key: string): string | undefined {
    if (!value || typeof value !== 'object')
        return;
    if (typeof value[key] === 'string')
        return value[key];

    for (const child of Object.values(value)) {
        const found = findStringValue(child, key);
        if (found)
            return found;
    }
}

function formatHost(host: string, port: number): string {
    const formattedHost = host.includes(':') && !host.startsWith('[')
        ? `[${host}]`
        : host;
    return `${formattedHost}:${port}`;
}

function httpsJsonTransport(request: VigiDsTransportRequest): Promise<any> {
    return new Promise((resolve, reject) => {
        const body = Buffer.from(JSON.stringify(request.body));
        const req = https.request({
            agent: new https.Agent({
                rejectUnauthorized: request.rejectUnauthorized,
            }),
            headers: {
                Accept: 'application/json',
                'Content-Length': body.length,
                'Content-Type': 'application/json; charset=UTF-8',
            },
            hostname: request.host,
            method: 'POST',
            path: request.path,
            port: request.port,
            rejectUnauthorized: request.rejectUnauthorized,
            servername: request.host.includes(':') ? undefined : request.host,
        }, res => {
            const chunks: Buffer[] = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                const text = Buffer.concat(chunks).toString();
                if ((res.statusCode || 0) < 200 || (res.statusCode || 0) >= 300) {
                    reject(new Error(`VIGI HTTPS ${formatHost(request.host, request.port)}${request.path} returned ${res.statusCode}: ${text}`));
                    return;
                }

                try {
                    resolve(text ? JSON.parse(text) : {});
                }
                catch (e) {
                    reject(new Error(`VIGI HTTPS ${formatHost(request.host, request.port)}${request.path} returned invalid JSON: ${text}`));
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}
