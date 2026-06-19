# VIGI Two Way Audio for Scrypted

This plugin adds TP-Link VIGI two-way audio support to existing Scrypted camera devices.

It does not import cameras or replace video streaming. Add the VIGI camera with the ONVIF or RTSP plugin first, then enable the `VIGI Two Way Audio` extension on that camera.

## Requirements

- A VIGI camera that exposes the local VIGI stream endpoint on port `8800`.
- The camera's local `admin` credentials. VIGI two-way audio is currently known to require the `admin` account.
- Existing Scrypted camera video through RTSP or ONVIF.

## Setup

### Install

In Scrypted:

1. Open `Plugins`.
2. Click `Install Plugin`.
3. Search for or paste `scrypted-vigi`.
4. Install `VIGI Two Way Audio`.

### Configure

1. Add the camera to Scrypted using ONVIF or RTSP.
2. Enable the `VIGI Two Way Audio` mixin on the camera.
3. Open the mixin settings.
4. Leave Host, Username, and Admin Password blank to inherit them from the ONVIF/RTSP camera settings.
5. If the inherited camera account is not `admin`, enter the VIGI `admin` username and password as overrides.
6. Leave the port as `8800` unless your camera uses a custom mapping.

## Notes

This implementation follows the behavior proven in go2rtc's `vigi://admin:password@host` support. The older VIGI API document appears to be stale for some current camera firmware, so the plugin targets the working local `/stream` protocol instead of the HTTPS `/ds` management API.

Initial validation is unit and mock-protocol based. A real camera should be used for final hardware validation.
