import sdk, { DeviceProvider, FFmpegInput, Intercom, MediaObject, MixinProvider, ScryptedDeviceBase, ScryptedDeviceType, ScryptedInterface, ScryptedMimeTypes, Setting, Settings, SettingValue, VideoCamera, WritableDeviceState } from '@scrypted/sdk';
import { SettingsMixinDeviceBase } from '@scrypted/sdk/settings-mixin';
import { StorageSettings } from '@scrypted/sdk/storage-settings';
import { startPcmaRtpForwarder, AudioForwarder } from './audio-forwarder';
import { MpegTSWriter, StreamTypePCMATapo } from './mpegts-writer';
import { VigiApi } from './vigi-api';

class VigiIntercomMixin extends SettingsMixinDeviceBase<VideoCamera & Settings> implements Intercom {
    private client?: Promise<VigiApi>;
    private forwarder?: AudioForwarder;

    storageSettings = new StorageSettings(this, {
        host: {
            title: 'Host',
            description: 'The VIGI camera host or IP. Leave empty to use the mixed camera IP setting when available.',
        },
        username: {
            title: 'Username',
            defaultValue: 'admin',
            description: 'VIGI two-way audio currently requires the admin account.',
        },
        password: {
            title: 'Admin Password',
            type: 'password',
            description: 'The local VIGI admin password. This is typically the same credential used for RTSP.',
        },
        port: {
            title: 'Port',
            type: 'number',
            defaultValue: 8800,
            description: 'The VIGI stream service port.',
        },
        channel: {
            title: 'Channel',
            type: 'number',
            defaultValue: 0,
            description: 'Camera channel. Most standalone VIGI cameras use 0.',
        },
    });

    async startIntercom(media: MediaObject): Promise<void> {
        const ffmpegInput = await sdk.mediaManager.convertMediaObjectToJSON<FFmpegInput>(media, ScryptedMimeTypes.FFmpegInput);
        await this.stopIntercom();

        const { host, username, password, port } = await this.getConnectionSettings();
        if (username !== 'admin')
            throw new Error('VIGI two-way audio currently requires the admin account.');

        this.client = VigiApi.connect({
            host,
            port,
            username,
            password,
        });

        const client = await this.client;
        client.processMessages().catch(e => this.console.error('VIGI message processing stopped:', e));
        const mpegts = await client.startMpegTsBackchannel();

        const writer = new MpegTSWriter();
        writer.addPES(68, StreamTypePCMATapo);
        writer.writePAT();
        writer.writePMT();
        mpegts.write(writer.resetBytes());

        this.forwarder = await startPcmaRtpForwarder(this.console, ffmpegInput, rtp => {
            const payload = rtp.subarray(12);
            if (!payload.length)
                return;

            writer.writePES(68, 192, payload);
            mpegts.write(writer.resetBytes());
        });

        this.forwarder.killPromise.finally(() => client.close());
        client.stream.on('close', () => this.forwarder?.kill());
    }

    async stopIntercom(): Promise<void> {
        const forwarder = this.forwarder;
        this.forwarder = undefined;
        forwarder?.kill();

        const clientPromise = this.client;
        this.client = undefined;
        const client = await clientPromise?.catch(() => undefined);
        client?.close();
    }

    getMixinSettings(): Promise<Setting[]> {
        return this.storageSettings.getSettings();
    }

    putMixinSetting(key: string, value: SettingValue): Promise<boolean | void> {
        return this.storageSettings.putSetting(key, value);
    }

    private async getConnectionSettings() {
        const mixinSettings = await this.mixinDevice.getSettings();
        const detectedHost = mixinSettings.find(s => s.key === 'ip')?.value?.toString()
            || mixinSettings.find(s => s.key === 'host')?.value?.toString()
            || mixinSettings.find(s => s.key === 'address')?.value?.toString();

        const host = this.storageSettings.values.host?.toString() || detectedHost;
        const username = this.storageSettings.values.username?.toString() || 'admin';
        const password = this.storageSettings.values.password?.toString();
        const portValue = this.storageSettings.values.port;
        const port = typeof portValue === 'number' ? portValue : parseInt(portValue?.toString() || '8800', 10);

        if (!host)
            throw new Error('VIGI host is not configured and could not be detected from the camera settings.');
        if (!password)
            throw new Error('VIGI admin password is not configured.');

        return {
            host,
            username,
            password,
            port: Number.isFinite(port) ? port : 8800,
        };
    }
}

class VigiIntercomProvider extends ScryptedDeviceBase implements MixinProvider {
    async canMixin(type: ScryptedDeviceType, interfaces: string[]): Promise<string[] | undefined> {
        if (type !== ScryptedDeviceType.Doorbell && type !== ScryptedDeviceType.Camera)
            return;
        if (!interfaces.includes(ScryptedInterface.VideoCamera) || !interfaces.includes(ScryptedInterface.Settings))
            return;

        return [
            ScryptedInterface.Intercom,
            ScryptedInterface.Settings,
        ];
    }

    async getMixin(mixinDevice: VideoCamera & Settings, mixinDeviceInterfaces: ScryptedInterface[], mixinDeviceState: WritableDeviceState): Promise<any> {
        return new VigiIntercomMixin({
            mixinProviderNativeId: this.nativeId,
            group: 'VIGI Two Way Audio',
            groupKey: 'vigi',
            mixinDevice,
            mixinDeviceInterfaces,
            mixinDeviceState,
        });
    }

    async releaseMixin(id: string, mixinDevice: any): Promise<void> {
    }
}

class VigiPlugin extends ScryptedDeviceBase implements DeviceProvider {
    constructor(nativeId?: string) {
        super(nativeId);

        process.nextTick(() => {
            sdk.deviceManager.onDeviceDiscovered({
                nativeId: 'intercom',
                type: ScryptedDeviceType.Builtin,
                interfaces: [
                    ScryptedInterface.MixinProvider,
                ],
                name: 'VIGI Two Way Audio',
            });
        });
    }

    async getDevice(nativeId: string): Promise<any> {
        if (nativeId === 'intercom')
            return new VigiIntercomProvider('intercom');
    }

    async releaseDevice(id: string, nativeId: string): Promise<void> {
    }
}

export default VigiPlugin;
