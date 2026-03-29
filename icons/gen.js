// 生成简单的纯色 PNG 图标 (无需外部依赖)
// 最小有效 PNG: 蓝色圆形背景 + 白色X标记

const fs = require("fs");

function createPNG(size) {
  // 创建 RGBA 像素数据
  const pixels = Buffer.alloc(size * size * 4, 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 1;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= r) {
        // 蓝色背景
        pixels[idx] = 0;     // R
        pixels[idx + 1] = 120; // G
        pixels[idx + 2] = 212; // B
        pixels[idx + 3] = 255; // A

        // 白色 X 标记 (清除符号)
        const nr = r * 0.55; // 标记半径
        if (dist < nr) {
          const angle = Math.atan2(dy, dx);
          const lineWidth = size * 0.08;
          // 两条对角线
          const d1 = Math.abs(dx - dy) / Math.sqrt(2);
          const d2 = Math.abs(dx + dy) / Math.sqrt(2);
          if (d1 < lineWidth || d2 < lineWidth) {
            pixels[idx] = 255;
            pixels[idx + 1] = 255;
            pixels[idx + 2] = 255;
            pixels[idx + 3] = 255;
          }
        }
      }
    }
  }

  return encodePNG(size, size, pixels);
}

// 最小 PNG 编码器
function encodePNG(w, h, pixels) {
  const zlib = require("zlib");

  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // 准备原始图像数据 (每行前加 filter byte 0)
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0; // no filter
    pixels.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
  }

  const compressed = zlib.deflateSync(raw);

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeB = Buffer.from(type, "ascii");
    const crcData = Buffer.concat([typeB, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcData) >>> 0, 0);
    return Buffer.concat([len, typeB, data, crc]);
  }

  const ihdrChunk = makeChunk("IHDR", ihdr);
  const idatChunk = makeChunk("IDAT", compressed);
  const iendChunk = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// CRC32 计算
function crc32(buf) {
  let crc = 0xffffffff;
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return crc ^ 0xffffffff;
}

// 生成三种尺寸
[16, 48, 128].forEach((size) => {
  const png = createPNG(size);
  fs.writeFileSync(`${__dirname}/icon${size}.png`, png);
  console.log(`Generated icon${size}.png (${png.length} bytes)`);
});
