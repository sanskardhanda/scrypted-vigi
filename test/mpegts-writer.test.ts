import assert from 'node:assert/strict';
import test from 'node:test';
import { MpegTSWriter, StreamTypePCMATapo } from '../src/mpegts-writer';

test('MPEG-TS writer emits packet-aligned PAT, PMT, and PCMA PES', () => {
    const writer = new MpegTSWriter();
    writer.addPES(68, StreamTypePCMATapo);
    writer.writePAT();
    writer.writePMT();
    writer.writePES(68, 192, Buffer.alloc(160, 0x55));

    const data = writer.resetBytes();
    assert.equal(data.length % 188, 0);
    assert.equal(data[0], 0x47);
    assert.equal(data[188], 0x47);
    assert.equal(data[376], 0x47);
});
