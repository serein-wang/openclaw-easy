const zlib = require("node:zlib");

const COLORS = {
  online: [0x34, 0xc7, 0x59],
  busy: [0xff, 0x9f, 0x0a],
  needs_you: [0xff, 0x3b, 0x30],
  offline: [0x8e, 0x8e, 0x93],
};

function crc32(buf) {
  let crc = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

/** 16×16 circle PNG. No image library, so the tray stays dependency-free. */
function circlePng(rgb) {
  const size = 16;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const dx = x - 7.5;
      const dy = y - 7.5;
      const inside = dx * dx + dy * dy <= 6.25 * 6.25;
      const index = row + 1 + x * 4;
      raw[index] = rgb[0];
      raw[index + 1] = rgb[1];
      raw[index + 2] = rgb[2];
      raw[index + 3] = inside ? 255 : 0;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function iconFor(status) {
  return circlePng(COLORS[status] ?? COLORS.offline);
}

module.exports = { iconFor };
