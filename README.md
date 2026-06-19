# VIGI Two Way Audio for Scrypted

Adds TP-Link VIGI two-way audio, also called talkback or intercom, to VIGI cameras that are already in Scrypted.

This plugin does not discover cameras, import cameras, or provide video streaming. Use Scrypted's ONVIF or RTSP plugin for video first. After the camera is working in Scrypted, enable this plugin as a mixin on that camera to add the `Intercom` interface.

There is no `Add Camera` button in this plugin. That is expected. The camera comes from ONVIF or RTSP; this plugin only adds the talk button.

## Requirements

- A TP-Link VIGI camera already added to Scrypted through ONVIF or RTSP.
- Working local video in Scrypted before this plugin is enabled.
- The camera's local `admin` account credentials.
- Local network access from Scrypted to the camera's VIGI stream service, normally port `8800`.

VIGI talkback is currently known to require the camera's `admin` account. A non-admin ONVIF or RTSP account may work for video, but it will usually not work for two-way audio.

## Installation

In Scrypted:

1. Open `Plugins`.
2. Click `Install Plugin`.
3. Search for or paste `@sanskardhanda/scrypted-vigi`.
4. Install `VIGI Two Way Audio`.

## Recommended Setup

1. Add the VIGI camera to Scrypted using the ONVIF plugin or RTSP plugin.
2. Use the camera's `admin` username and password when adding it, if possible.
3. Confirm the camera live view works in Scrypted.
4. Open the camera in Scrypted.
5. Open `Extensions` or `Mixins`.
6. Enable `VIGI Two Way Audio`.
7. Open the `VIGI Two Way Audio` settings on that camera.
8. Leave `Host`, `Username`, and `Admin Password` blank if the detected values look correct.
9. Leave `Port` as `8800` unless your camera is behind a custom port mapping.
10. Leave `Channel` as `0` for most standalone VIGI cameras.

Blank settings are intentional. The mixin tries to read the IP address, username, and password from the ONVIF or RTSP camera that it is attached to. If the camera was added with the VIGI `admin` credentials, you usually do not need to enter anything again.

Auto-detection looks for common camera settings such as `ip`, `host`, `address`, `url`, `rtspUrl`, `username`, and `password`. Different Scrypted camera plugins expose different setting names, so manual overrides are available when detection cannot find everything.

## Manual Settings

Fill in the mixin settings only when auto-detection is missing something or the existing camera uses a different account.

| Setting | When to use it |
| --- | --- |
| `Host` | The camera IP was not detected, or the detected host is wrong. |
| `Username` | The existing ONVIF/RTSP camera was added with a non-admin user. Set this to `admin`. |
| `Admin Password` | The existing ONVIF/RTSP camera password is missing, wrong, or belongs to a non-admin user. |
| `Port` | The VIGI stream service is not reachable on `8800`. |
| `Channel` | Multi-channel devices only. Most standalone cameras should stay on `0`. |

## HomeKit

This plugin adds talkback to the Scrypted camera. HomeKit still needs to expose that camera through the Scrypted HomeKit plugin.

If the camera is already in Apple Home before you enable this mixin:

1. Enable `VIGI Two Way Audio` on the Scrypted camera.
2. Restart or reload the camera in Scrypted.
3. Restart or reload the Scrypted HomeKit plugin.
4. Check the camera tile in the Home app for the talk button.

If the Home app still does not show talkback, remove and re-add the HomeKit accessory or bridge that contains the camera. Apple Home can cache accessory capabilities, so newly added Scrypted interfaces are not always picked up on an existing pairing.

## Troubleshooting

### `VIGI Two Way Audio` is not listed under Extensions

The target device must be a Scrypted `Camera` or `Doorbell` and must provide both `VideoCamera` and `Settings`. Add the camera through ONVIF or RTSP first, then reload the VIGI plugin.

### Talkback fails with an admin error

Use the camera's local `admin` account. VIGI talkback is currently expected to fail with non-admin users.

### Talkback fails with a host or password error

Open the mixin settings and manually set `Host`, `Username`, and `Admin Password`. Auto-detection depends on what the ONVIF or RTSP plugin exposes in its settings.

### Video works but talkback does not

Video and talkback use different camera endpoints. Confirm that Scrypted can reach the camera on port `8800` and check the Scrypted plugin logs for the exact VIGI error.

### HomeKit pairing fails

HomeKit pairing, mDNS, and bridge issues are handled by Scrypted's HomeKit plugin. First confirm the VIGI mixin is enabled on the camera and its settings are correct, then troubleshoot HomeKit separately.
