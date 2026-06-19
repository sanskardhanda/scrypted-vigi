import CRC32 from 'crc-32';

export const StreamTypePCMATapo = 0x90;

const packetSize = 188;
const isUnitStart = 0x4000;
const flagHasAdaptation = 0x20;
const flagHasPayload = 0x10;
const lenIsProgramTable = 0xB000;
const tableFlags = 0xC1;
const tableHeader = 0xE000;
const tableLength = 0xF000;
const patPID = 0;
const patTableID = 0;
const patTableExtID = 1;
const pmtPID = 18;
const pmtTableID = 2;
const pmtTableExtID = 1;
const syncByte = 0x47;
const pesHeaderSize = packetSize - 18;

function byte(value: number): number {
    return value & 0xFF;
}

function uint16(value: number): number {
    return value & 0xFFFF;
}

function uint32(value: number): number {
    return value >>> 0;
}

export class MpegTSWriter {
    private buffers: Buffer[] = [];
    private checksumStart = 0;
    private pid: number[] = [];
    private counter: number[] = [];
    private streamType: number[] = [];
    private timestamp: number[] = [];

    resetBytes(): Buffer {
        const data = Buffer.concat(this.buffers);
        if (data.length % packetSize)
            throw new Error('Invalid MPEG-TS packet size.');
        this.buffers = [];
        return data;
    }

    addPES(pid: number, streamType: number): void {
        this.pid.push(pid);
        this.streamType.push(streamType);
        this.counter.push(0);
        this.timestamp.push(0);
    }

    writePAT(): void {
        this.writeByte(syncByte);
        this.writeUint16(isUnitStart | patPID);
        this.writeByte(flagHasPayload);
        this.writeByte(0);
        this.markChecksum();
        this.writeByte(patTableID);
        this.writeUint16(lenIsProgramTable | 13);
        this.writeUint16(patTableExtID);
        this.writeByte(tableFlags);
        this.writeByte(0);
        this.writeByte(0);
        this.writeUint16(1);
        this.writeUint16(tableHeader + pmtPID);
        this.writeChecksum();
        this.finishPacket();
    }

    writePMT(): void {
        this.writeByte(syncByte);
        this.writeUint16(isUnitStart | pmtPID);
        this.writeByte(flagHasPayload);
        this.writeByte(0);

        const tableLen = uint16(13 + this.pid.length * 5);
        this.markChecksum();
        this.writeByte(pmtTableID);
        this.writeUint16(lenIsProgramTable | tableLen);
        this.writeUint16(pmtTableExtID);
        this.writeByte(tableFlags);
        this.writeByte(0);
        this.writeByte(0);
        this.writeUint16(tableHeader | this.pid[0]);
        this.writeUint16(tableLength | 0);

        for (let i = 0; i < this.pid.length; i++) {
            const pid = this.pid[i];
            this.writeByte(this.streamType[i]);
            this.writeUint16(tableHeader | pid);
            this.writeUint16(tableLength | 0);
        }

        this.writeChecksum();
        this.finishPacket();
    }

    writePES(pid: number, streamId: number, payload: Buffer): void {
        this.writeByte(syncByte);
        this.writeUint16(isUnitStart | pid);

        if (payload.length < packetSize - 18) {
            this.writeByte(flagHasAdaptation | flagHasPayload);
            const adaptationSize = packetSize - 18 - 1 - byte(payload.length);
            this.writeByte(adaptationSize);
            this.writeBuffer(Buffer.alloc(adaptationSize));
        }
        else {
            this.writeByte(flagHasPayload);
        }

        this.writeByte(0);
        this.writeByte(0);
        this.writeByte(1);
        this.writeByte(streamId);
        this.writeUint16(uint16(8 + payload.length));
        this.writeByte(0x80);
        this.writeByte(0x80);
        this.writeByte(5);

        if (this.streamType[0] === StreamTypePCMATapo)
            this.timestamp[0] += uint32(payload.length * 45 / 8);

        this.writeTime(this.timestamp[0]);

        if (payload.length < packetSize - 18) {
            this.writeBuffer(payload);
            return;
        }

        this.writeBuffer(payload.subarray(0, pesHeaderSize));
        payload = payload.subarray(pesHeaderSize);

        let counter = this.counter[0];
        while (payload.length) {
            counter = (counter + 1) & 0x0F;

            if (payload.length > packetSize - 4) {
                this.writeByte(syncByte);
                this.writeUint16(pid);
                this.writeByte(flagHasPayload | counter);
                this.writeBuffer(payload.subarray(0, packetSize - 4));
                payload = payload.subarray(packetSize - 4);
            }
            else if (payload.length === packetSize - 4) {
                this.writeByte(syncByte);
                this.writeUint16(pid);
                this.writeByte(flagHasPayload | counter);
                this.writeBuffer(payload);
                payload = Buffer.alloc(0);
            }
            else {
                this.writeByte(syncByte);
                this.writeUint16(pid);
                this.writeByte(flagHasAdaptation | flagHasPayload | counter);
                const adaptationSize = packetSize - 4 - 1 - byte(payload.length);
                this.writeByte(adaptationSize);
                this.writeBuffer(Buffer.alloc(adaptationSize));
                this.writeBuffer(payload);
                payload = Buffer.alloc(0);
            }
        }

        this.counter[0] = counter;
    }

    private writeByte(value: number): void {
        this.buffers.push(Buffer.from([byte(value)]));
    }

    private writeUint16(value: number): void {
        this.writeBytes(byte(value >> 8), byte(value));
    }

    private writeTime(time: number): void {
        const onlyPTS = 0x20;
        this.buffers.push(Buffer.from([
            onlyPTS | byte(time >> 29) | 1,
            byte(time >> 22),
            byte(time >> 14) | 1,
            byte(time >> 7),
            byte(time << 1) | 1,
        ]));
    }

    private writeBytes(...bytes: number[]): void {
        this.buffers.push(Buffer.from(bytes.map(byte)));
    }

    private writeBuffer(buffer: Buffer): void {
        this.buffers.push(buffer);
    }

    private markChecksum(): void {
        this.checksumStart = Buffer.concat(this.buffers).length;
    }

    private writeChecksum(): void {
        const data = Buffer.concat(this.buffers);
        const check = data.subarray(this.checksumStart);
        const crc = CRC32.buf(check);
        this.writeBytes(byte(crc), byte(crc >> 8), byte(crc >> 16), byte(crc >> 24));
    }

    private finishPacket(): void {
        const data = Buffer.concat(this.buffers);
        const remainder = data.length % packetSize;
        if (remainder)
            this.buffers.push(Buffer.alloc(packetSize - remainder));
    }
}
