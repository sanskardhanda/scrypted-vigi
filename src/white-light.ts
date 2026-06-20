import { MixinProvider, OnOff, ScryptedDeviceBase, ScryptedDeviceType, ScryptedInterface, Setting, Settings, SettingValue, VideoCamera, WritableDeviceState } from '@scrypted/sdk';
import { SettingsMixinDeviceBase } from '@scrypted/sdk/settings-mixin';
import { StorageSettings } from '@scrypted/sdk/storage-settings';
import { applyDetectedConnectionSettings, getDetectedConnectionSettings } from './connection-settings';
import { VigiDsApi } from './vigi-ds-api';

class VigiWhiteLightMixin extends SettingsMixinDeviceBase<VideoCamera & Settings> implements OnOff {
    private api?: VigiDsApi;

    storageSettings = new StorageSettings(this, {
        host: {
            title: 'Host',
            placeholder: 'Use camera IP',
            description: 'Optional override. Leave empty to use the mixed camera IP, host, address, or RTSP URL host.',
        },
        username: {
            title: 'Username',
            placeholder: 'Use camera username',
            description: 'Optional override. Use the VIGI admin username if the inherited account cannot change image settings.',
        },
        password: {
            title: 'Password',
            type: 'password',
            placeholder: 'Use camera password',
            description: 'Optional override. Leave empty to use the mixed camera password.',
        },
        port: {
            title: 'HTTPS Port',
            type: 'number',
            defaultValue: 443,
            description: 'The VIGI HTTPS web API port.',
        },
    });

    async turnOn(): Promise<void> {
        const api = await this.getApi();
        await api.setWhiteLight(true);
        this.on = true;
    }

    async turnOff(): Promise<void> {
        const api = await this.getApi();
        await api.setWhiteLight(false);
        this.on = false;
    }

    async getMixinSettings(): Promise<Setting[]> {
        const [settings, detected] = await Promise.all([
            this.storageSettings.getSettings(),
            getDetectedConnectionSettings(this.mixinDevice).catch(() => undefined),
        ]);

        applyDetectedConnectionSettings(settings, detected, 'Some VIGI image settings may require admin.');

        return settings;
    }

    putMixinSetting(key: string, value: SettingValue): Promise<boolean | void> {
        if (['host', 'username', 'password', 'port'].includes(key))
            this.api = undefined;
        return this.storageSettings.putSetting(key, value);
    }

    private async getApi(): Promise<VigiDsApi> {
        if (this.api)
            return this.api;

        const { host, username, password, port } = await this.getConnectionSettings();
        this.api = new VigiDsApi({
            host,
            port,
            username,
            password,
        });
        return this.api;
    }

    private async getConnectionSettings() {
        const detected = await getDetectedConnectionSettings(this.mixinDevice);

        const host = this.storageSettings.values.host?.toString() || detected.host;
        const username = this.storageSettings.values.username?.toString() || detected.username || 'admin';
        const password = this.storageSettings.values.password?.toString() || detected.password;
        const portValue = this.storageSettings.values.port;
        const port = typeof portValue === 'number' ? portValue : parseInt(portValue?.toString() || '443', 10);

        if (!host)
            throw new Error('VIGI host is not configured and could not be detected from the camera settings.');
        if (!password)
            throw new Error('VIGI password is not configured and could not be detected from the camera settings.');

        return {
            host,
            username,
            password,
            port: Number.isFinite(port) ? port : 443,
        };
    }
}

export class VigiWhiteLightProvider extends ScryptedDeviceBase implements MixinProvider {
    async canMixin(type: ScryptedDeviceType, interfaces: string[]): Promise<string[] | undefined> {
        if (type !== ScryptedDeviceType.Doorbell && type !== ScryptedDeviceType.Camera)
            return;
        if (!interfaces.includes(ScryptedInterface.VideoCamera) || !interfaces.includes(ScryptedInterface.Settings))
            return;

        return [
            ScryptedInterface.OnOff,
            ScryptedInterface.Settings,
        ];
    }

    async getMixin(mixinDevice: VideoCamera & Settings, mixinDeviceInterfaces: ScryptedInterface[], mixinDeviceState: WritableDeviceState): Promise<any> {
        return new VigiWhiteLightMixin({
            mixinProviderNativeId: this.nativeId,
            group: 'VIGI White Light',
            groupKey: 'vigi-white-light',
            mixinDevice,
            mixinDeviceInterfaces,
            mixinDeviceState,
        });
    }

    async releaseMixin(id: string, mixinDevice: any): Promise<void> {
    }
}
