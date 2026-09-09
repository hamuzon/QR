/**
 * QR Code — Main Generator
 *
 * バージョン自動選択と QR コード生成のメインロジック。
 * encoder / matrix モジュールを組み合わせて最終的なグリッドを出力する。
 */

import { EC_LEVEL, VERSION_TABLE } from "./tables.js"
import { encodeData, interleave } from "./encoder.js"

import {
  getModuleCount,
  createMatrix,
  placeFinderPattern,
  placeTimingPatterns,
  placeAlignmentPatterns,
  reserveFormatInfo,
  reserveVersionInfo,
  placeDataBits,
  applyMask,
  placeFormatInfo,
  placeVersionInfo,
  computePenalty,
} from "./matrix.js"


// ══════════════════════════════════════════
//  Auto-select version
// ══════════════════════════════════════════

export function selectVersion(text, ecLevel) {

  const utf8Bytes = new TextEncoder().encode(text)
  const byteLen = utf8Bytes.length

  for (let v = 1; v <= 40; v++) {
    const vInfo = VERSION_TABLE[v][EC_LEVEL[ecLevel]]
    const ccBits = v <= 9 ? 8 : 16
    const dataBits = 4 + ccBits + byteLen * 8
    const availBits = vInfo.totalDataCodewords * 8
    if (dataBits <= availBits) return v
  }

  throw new Error("テキストが長すぎます。QRコードに収まりません。")

}


// ══════════════════════════════════════════
//  Main QR generation
// ══════════════════════════════════════════

export function generateQR(text, ecLevel, version) {

  if (!version) {
    version = selectVersion(text, ecLevel)
  }

  // Validate that data fits
  const utf8Bytes = new TextEncoder().encode(text)
  const vInfo = VERSION_TABLE[version][EC_LEVEL[ecLevel]]
  const ccBits = version <= 9 ? 8 : 16
  const dataBits = 4 + ccBits + utf8Bytes.length * 8

  if (dataBits > vInfo.totalDataCodewords * 8) {
    throw new Error(
      `テキストが長すぎます。バージョン${version}(${ecLevel})の容量を超えています。`
    )
  }


  const data = encodeData(text, version, ecLevel)
  const interleavedData = interleave(data, version, ecLevel)

  const moduleCount = getModuleCount(version)


  // Build reserved matrix (tracks which cells are function patterns)
  const reserved = createMatrix(moduleCount)
  placeFinderPattern(reserved, 0, 0)
  placeFinderPattern(reserved, 0, moduleCount - 7)
  placeFinderPattern(reserved, moduleCount - 7, 0)
  placeTimingPatterns(reserved)
  placeAlignmentPatterns(reserved, version)
  reserveFormatInfo(reserved)
  reserveVersionInfo(reserved, version)


  // Try all 8 masks, pick the one with lowest penalty
  let bestMatrix = null
  let bestPenalty = Infinity

  for (let maskIdx = 0; maskIdx < 8; maskIdx++) {

    const mat = createMatrix(moduleCount)

    placeFinderPattern(mat, 0, 0)
    placeFinderPattern(mat, 0, moduleCount - 7)
    placeFinderPattern(mat, moduleCount - 7, 0)
    placeTimingPatterns(mat)
    placeAlignmentPatterns(mat, version)
    reserveFormatInfo(mat)
    reserveVersionInfo(mat, version)

    placeDataBits(mat, interleavedData)
    applyMask(mat, reserved, maskIdx)
    placeFormatInfo(mat, ecLevel, maskIdx)
    placeVersionInfo(mat, version)

    const penalty = computePenalty(mat)

    if (penalty < bestPenalty) {
      bestPenalty = penalty
      bestMatrix = mat
    }

  }


  // Convert to boolean grid (true = dark)
  const grid = []

  for (let r = 0; r < moduleCount; r++) {
    const row = []
    for (let c = 0; c < moduleCount; c++) {
      row.push(bestMatrix[r][c] > 0)
    }
    grid.push(row)
  }

  return { grid, moduleCount, version }

}
