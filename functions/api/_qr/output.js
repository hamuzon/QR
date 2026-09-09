/**
 * QR Code — SVG / PNG Output
 *
 * QRコードのグリッドデータから SVG・PNG 画像を生成する。
 * カスタムカラー、余白（margin）に対応。
 */


// ══════════════════════════════════════════
//  SVG Output
// ══════════════════════════════════════════

export function qrToSVG(qr, size, fgColor, bgColor, margin) {

  const { grid, moduleCount } = qr

  const quietZone = margin
  const totalModules = moduleCount + quietZone * 2
  const scale = size / totalModules

  // 色を CSS hex に変換
  const fgHex = `#${toHex(fgColor.r)}${toHex(fgColor.g)}${toHex(fgColor.b)}`
  const bgHex = `#${toHex(bgColor.r)}${toHex(bgColor.g)}${toHex(bgColor.b)}`

  const rects = []

  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {

      if (grid[r][c]) {
        const x = (c + quietZone) * scale
        const y = (r + quietZone) * scale
        rects.push(
          `<rect x="${x}" y="${y}" width="${scale}" height="${scale}"/>`
        )
      }

    }
  }

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`,
    `<rect width="100%" height="100%" fill="${bgHex}"/>`,
    `<g fill="${fgHex}">`,
    ...rects,
    `</g>`,
    `</svg>`,
  ].join("\n")

}


// ══════════════════════════════════════════
//  PNG Output (minimal uncompressed PNG)
// ══════════════════════════════════════════

export function qrToPNG(qr, size, fgColor, bgColor, margin) {

  const { grid, moduleCount } = qr

  const quietZone = margin
  const totalModules = moduleCount + quietZone * 2
  const scale = Math.max(1, Math.floor(size / totalModules))
  const imgSize = totalModules * scale

  // Build raw pixel data (RGB: 3 bytes per pixel)
  // Each row starts with filter byte 0 (None)
  const rowBytes = 1 + imgSize * 3  // filter byte + RGB pixels
  const rawData = new Uint8Array(rowBytes * imgSize)

  for (let y = 0; y < imgSize; y++) {

    const rowOffset = y * rowBytes
    rawData[rowOffset] = 0  // filter: None

    const moduleRow = Math.floor(y / scale) - quietZone

    for (let x = 0; x < imgSize; x++) {

      const moduleCol = Math.floor(x / scale) - quietZone

      let isDark = false

      if (
        moduleRow >= 0 &&
        moduleRow < moduleCount &&
        moduleCol >= 0 &&
        moduleCol < moduleCount
      ) {
        isDark = grid[moduleRow][moduleCol]
      }

      const color = isDark ? fgColor : bgColor
      const pixelOffset = rowOffset + 1 + x * 3

      rawData[pixelOffset]     = color.r
      rawData[pixelOffset + 1] = color.g
      rawData[pixelOffset + 2] = color.b

    }

  }

  // Deflate (store — no compression, just stored blocks)
  const deflated = deflateStore(rawData)

  // Build PNG
  const png = buildPNG(imgSize, imgSize, deflated)

  return png

}


// ──────────────────────────────────────────
//  PNG internal helpers
// ──────────────────────────────────────────

/**
 * 数値を2桁hex文字列に変換
 */
function toHex(n) {
  return n.toString(16).padStart(2, "0")
}


function deflateStore(data) {

  // Wrap raw data in deflate stored blocks (no compression)
  const maxBlock = 65535
  const numBlocks = Math.ceil(data.length / maxBlock)
  const output = new Uint8Array(data.length + numBlocks * 5 + 6)  // zlib header + blocks + adler

  let pos = 0

  // Zlib header (CM=8, CINFO=7, FCHECK)
  output[pos++] = 0x78
  output[pos++] = 0x01

  for (let i = 0; i < numBlocks; i++) {

    const start = i * maxBlock
    const end = Math.min(start + maxBlock, data.length)
    const len = end - start
    const isLast = i === numBlocks - 1

    output[pos++] = isLast ? 1 : 0  // BFINAL
    output[pos++] = len & 0xff
    output[pos++] = (len >> 8) & 0xff
    output[pos++] = ~len & 0xff
    output[pos++] = (~len >> 8) & 0xff

    output.set(data.subarray(start, end), pos)
    pos += len

  }

  // Adler-32 checksum
  const adler = adler32(data)

  output[pos++] = (adler >> 24) & 0xff
  output[pos++] = (adler >> 16) & 0xff
  output[pos++] = (adler >> 8) & 0xff
  output[pos++] = adler & 0xff

  return output.subarray(0, pos)

}


function adler32(data) {

  let a = 1
  let b = 0

  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % 65521
    b = (b + a) % 65521
  }

  return (b << 16) | a

}


function buildPNG(width, height, deflatedData) {

  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR
  const ihdr = new Uint8Array(13)
  const ihdrView = new DataView(ihdr.buffer)

  ihdrView.setUint32(0, width)
  ihdrView.setUint32(4, height)
  ihdr[8] = 8     // bit depth
  ihdr[9] = 2     // color type: RGB
  ihdr[10] = 0    // compression
  ihdr[11] = 0    // filter
  ihdr[12] = 0    // interlace

  const ihdrChunk = pngChunk("IHDR", ihdr)
  const idatChunk = pngChunk("IDAT", deflatedData)
  const iendChunk = pngChunk("IEND", new Uint8Array(0))

  const total =
    signature.length +
    ihdrChunk.length +
    idatChunk.length +
    iendChunk.length

  const png = new Uint8Array(total)
  let offset = 0

  png.set(signature, offset)
  offset += signature.length

  png.set(ihdrChunk, offset)
  offset += ihdrChunk.length

  png.set(idatChunk, offset)
  offset += idatChunk.length

  png.set(iendChunk, offset)

  return png

}


function pngChunk(type, data) {

  const chunk = new Uint8Array(4 + 4 + data.length + 4)
  const view = new DataView(chunk.buffer)

  // Length
  view.setUint32(0, data.length)

  // Type
  for (let i = 0; i < 4; i++) {
    chunk[4 + i] = type.charCodeAt(i)
  }

  // Data
  chunk.set(data, 8)

  // CRC
  const crcData = chunk.subarray(4, 8 + data.length)
  view.setUint32(8 + data.length, crc32(crcData))

  return chunk

}


// CRC-32 (PNG standard)
const CRC_TABLE = (() => {

  const table = new Uint32Array(256)

  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c
  }

  return table

})()


function crc32(data) {

  let crc = 0xffffffff

  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  }

  return (crc ^ 0xffffffff) >>> 0

}
