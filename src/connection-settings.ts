import { Setting, Settings } from '@scrypted/sdk';

export interface DetectedConnectionSettings {
    host?: string;
    username?: string;
    password?: string;
}

export async function getDetectedConnectionSettings(mixinDevice: Settings): Promise<DetectedConnectionSettings> {
    const cameraSettings = await mixinDevice.getSettings();
    const getValue = (...keys: string[]) => {
        for (const key of keys) {
            const value = cameraSettings.find(s => s.key === key)?.value?.toString();
            if (value)
                return value;
        }
    };

    const rtspUrl = getValue('url', 'rtspUrl', 'rtspUrlOverride')
        || (cameraSettings.find(s => s.key === 'urls')?.value as string[] | undefined)?.find(url => !!url);

    return {
        host: getValue('ip', 'host', 'address') || getHostFromUrl(rtspUrl),
        username: getValue('username'),
        password: getValue('password'),
    };
}

export function applyDetectedConnectionSettings(settings: Setting[], detected: DetectedConnectionSettings | undefined, usernameSuffix: string): void {
    for (const setting of settings) {
        if (setting.key === 'host' && detected?.host) {
            setting.placeholder = detected.host;
            setting.description = `Optional override. Currently detected from the mixed camera as ${detected.host}.`;
        }
        else if (setting.key === 'username' && detected?.username) {
            setting.placeholder = detected.username;
            setting.description = `Optional override. Currently detected from the mixed camera as ${detected.username}. ${usernameSuffix}`;
        }
        else if (setting.key === 'password' && detected?.password) {
            setting.placeholder = 'Using mixed camera password';
            setting.description = 'Optional override. A password was detected from the mixed camera settings.';
        }
    }
}

function getHostFromUrl(value?: string): string | undefined {
    if (!value)
        return;

    try {
        return new URL(value).hostname;
    }
    catch {
        return;
    }
}
