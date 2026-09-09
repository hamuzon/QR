/**
 * QR Code — Data Encoding & Error Correction
 *
 * バイトモードでのデータエンコード、
 * 誤り訂正コードワード計算、インターリーブ処理。
 */

import {
  EC_LEVEL,
  VERSION_TABLE,
  getGeneratorPoly,
  polyDiv,
} from "./tables.js"


// ══════════════════════════════════════════
//  Data encoding (Byte mode)
// ══════════════════════════════════════════

export function encodeData(text, version, ecLevel) {

  const vInfo = VERSION_TABLE[version][EC_LEVEL[ecLevel]]
  const totalDataCodewords = vInfo.totalDataCodewords

  const utf8Bytes = new TextEncoder().encode(text)

  // Character count indicator length for byte mode
  const ccBits = version <= 9 ? 8 : 16

  // Bit stream: mode indicator (4 bits) + character count + data
  const bits = []

  // Mode indicator: 0100 = byte mode
  pushBits(bits, 0b0100, 4)

  // Character count
  pushBits(bits, utf8Bytes.length, ccBits)

  // Data
  for (const byte of utf8Bytes) {
    pushBits(bits, byte, 8)
  }

  // Terminator (up to 4 zeros)
  const totalDataBits = totalDataCodewords * 8
  const terminatorLen = Math.min(4, totalDataBits - bits.length)
  pushBits(bits, 0, terminatorLen)

  // Pad to byte boundary
  while (bits.length % 8 !== 0) {
    bits.push(0)
  }

  // Pad codewords
  const padBytes = [0xec, 0x11]
  let padIdx = 0

  while (bits.length < totalDataBits) {
    pushBits(bits, padBytes[padIdx % 2], 8)
    padIdx++
  }

  // Convert to bytes
  const codewords = new Uint8Array(totalDataCodewords)

  for (let i = 0; i < totalDataCodewords; i++) {
    let byte = 0
    for (let b = 0; b < 8; b++) {
      byte = (byte << 1) | (bits[i * 8 + b] || 0)
    }
    codewords[i] = byte
  }

  return codewords

}


function pushBits(arr, value, length) {

  for (let i = length - 1; i >= 0; i--) {
    arr.push((value >> i) & 1)
  }

}


// ══════════════════════════════════════════
//  Error correction
// ══════════════════════════════════════════

export function computeEC(data, numECCodewords) {

  const gen = getGeneratorPoly(numECCodewords)
  const padded = new Uint8Array(data.length + numECCodewords)
  padded.set(data)

  return polyDiv(padded, gen)

}


// ══════════════════════════════════════════
//  Interleave data & EC
// ══════════════════════════════════════════

export function interleave(data, version, ecLevel) {

  const vInfo = VERSION_TABLE[version][EC_LEVEL[ecLevel]]
  const { ecPerBlock, groups } = vInfo

  const dataBlocks = []
  const ecBlocks = []
  let offset = 0

  for (const [count, dataPerBlock] of groups) {
    for (let i = 0; i < count; i++) {
      const block = data.slice(offset, offset + dataPerBlock)
      dataBlocks.push(block)
      ecBlocks.push(computeEC(block, ecPerBlock))
      offset += dataPerBlock
    }
  }


  const result = []

  // Interleave data
  const maxDataLen = Math.max(...dataBlocks.map((b) => b.length))

  for (let i = 0; i < maxDataLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) result.push(block[i])
    }
  }

  // Interleave EC
  for (let i = 0; i < ecPerBlock; i++) {
    for (const block of ecBlocks) {
      if (i < block.length) result.push(block[i])
    }
  }

  return new Uint8Array(result)

}
