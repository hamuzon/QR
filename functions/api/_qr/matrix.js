/**
 * QR Code — Matrix Operations
 *
 * QRコードのマトリクス構築に関する操作:
 * ファインダーパターン、タイミングパターン、アライメントパターン、
 * データビット配置、マスキング、フォーマット/バージョン情報、ペナルティ計算。
 */

import { ALIGNMENT_POSITIONS } from "./tables.js"


// ══════════════════════════════════════════
//  Matrix basics
// ══════════════════════════════════════════

export function getModuleCount(version) {
  return 17 + version * 4
}


export function createMatrix(size) {
  // 0=unset, 1=black, -1=white (reserved)
  return Array.from({ length: size }, () => new Int8Array(size))
}


// ══════════════════════════════════════════
//  Finder pattern
// ══════════════════════════════════════════

export function placeFinderPattern(matrix, row, col) {

  const n = matrix.length

  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {

      const rr = row + r
      const cc = col + c

      if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue

      if (
        (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
        (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
        (r >= 2 && r <= 4 && c >= 2 && c <= 4)
      ) {
        matrix[rr][cc] = 1
      } else {
        matrix[rr][cc] = -1  // white (reserved)
      }

    }
  }

}


// ══════════════════════════════════════════
//  Timing patterns
// ══════════════════════════════════════════

export function placeTimingPatterns(matrix) {

  const n = matrix.length

  for (let i = 8; i < n - 8; i++) {
    const val = i % 2 === 0 ? 1 : -1
    if (matrix[6][i] === 0) matrix[6][i] = val
    if (matrix[i][6] === 0) matrix[i][6] = val
  }

}


// ══════════════════════════════════════════
//  Alignment patterns
// ══════════════════════════════════════════

function getAlignmentPatternPositions(version) {

  if (version === 1) return []

  const positions = ALIGNMENT_POSITIONS[version]
  const result = []

  for (let i = 0; i < positions.length; i++) {
    for (let j = 0; j < positions.length; j++) {

      // Skip if overlapping with finder patterns
      if (i === 0 && j === 0) continue
      if (i === 0 && j === positions.length - 1) continue
      if (i === positions.length - 1 && j === 0) continue

      result.push([positions[i], positions[j]])

    }
  }

  return result

}


export function placeAlignmentPatterns(matrix, version) {

  const positions = getAlignmentPatternPositions(version)

  for (const [row, col] of positions) {
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {

        if (
          Math.abs(r) === 2 ||
          Math.abs(c) === 2 ||
          (r === 0 && c === 0)
        ) {
          matrix[row + r][col + c] = 1
        } else {
          matrix[row + r][col + c] = -1
        }

      }
    }
  }

}


// ══════════════════════════════════════════
//  Reserve format & version info areas
// ══════════════════════════════════════════

export function reserveFormatInfo(matrix) {

  const n = matrix.length

  // Around top-left finder
  for (let i = 0; i <= 8; i++) {
    if (matrix[8][i] === 0) matrix[8][i] = -1
    if (matrix[i][8] === 0) matrix[i][8] = -1
  }

  // Around top-right finder
  for (let i = 0; i <= 7; i++) {
    if (matrix[8][n - 1 - i] === 0) matrix[8][n - 1 - i] = -1
  }

  // Around bottom-left finder
  for (let i = 0; i <= 7; i++) {
    if (matrix[n - 1 - i][8] === 0) matrix[n - 1 - i][8] = -1
  }

  // Dark module
  matrix[n - 8][8] = 1

}


export function reserveVersionInfo(matrix, version) {

  if (version < 7) return

  const n = matrix.length

  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 3; j++) {
      if (matrix[i][n - 11 + j] === 0) matrix[i][n - 11 + j] = -1
      if (matrix[n - 11 + j][i] === 0) matrix[n - 11 + j][i] = -1
    }
  }

}


// ══════════════════════════════════════════
//  Place data bits
// ══════════════════════════════════════════

export function placeDataBits(matrix, data) {

  const n = matrix.length

  const bits = []

  for (const byte of data) {
    for (let i = 7; i >= 0; i--) {
      bits.push((byte >> i) & 1)
    }
  }

  let bitIdx = 0
  let upward = true

  for (let col = n - 1; col >= 1; col -= 2) {

    if (col === 6) col = 5  // skip timing pattern column

    const rows = upward
      ? Array.from({ length: n }, (_, i) => n - 1 - i)
      : Array.from({ length: n }, (_, i) => i)

    for (const row of rows) {
      for (const c of [col, col - 1]) {
        if (matrix[row][c] === 0) {
          matrix[row][c] = bitIdx < bits.length && bits[bitIdx] ? 1 : -1
          bitIdx++
        }
      }
    }

    upward = !upward

  }

}


// ══════════════════════════════════════════
//  Masking
// ══════════════════════════════════════════

const MASK_FUNCTIONS = [
  (r, c) => (r + c) % 2 === 0,
  (r, c) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
]


export function applyMask(matrix, reservedMatrix, maskIdx) {

  const n = matrix.length
  const fn = MASK_FUNCTIONS[maskIdx]

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {

      // isDataModule: reservedMatrix[r][c] === 0
      if (reservedMatrix[r][c] === 0) {
        if (fn(r, c)) {
          matrix[r][c] = matrix[r][c] === 1 ? -1 : 1
        }
      }

    }
  }

}


// ══════════════════════════════════════════
//  Format info (EC level + mask)
// ══════════════════════════════════════════

const FORMAT_INFO_STRINGS = computeFormatInfoStrings()


function computeFormatInfoStrings() {

  const table = {}
  const ecBits = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 }

  for (const [ecName, ecVal] of Object.entries(ecBits)) {

    table[ecName] = []

    for (let mask = 0; mask < 8; mask++) {

      const data = (ecVal << 3) | mask
      let bits = data << 10

      // Divide by generator poly 10100110111 (0x537)
      const gen = 0x537

      for (let i = 14; i >= 10; i--) {
        if (bits & (1 << i)) bits ^= gen << (i - 10)
      }

      bits = (data << 10) | bits

      // XOR with mask pattern
      bits ^= 0x5412

      table[ecName].push(bits)

    }

  }

  return table

}


export function placeFormatInfo(matrix, ecLevel, maskIdx) {

  const n = matrix.length
  const bits = FORMAT_INFO_STRINGS[ecLevel][maskIdx]

  // Positions around top-left
  const positions1 = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ]

  // Positions right + bottom
  const positions2 = [
    [n - 1, 8], [n - 2, 8], [n - 3, 8], [n - 4, 8], [n - 5, 8],
    [n - 6, 8], [n - 7, 8],
    [8, n - 8], [8, n - 7], [8, n - 6], [8, n - 5], [8, n - 4],
    [8, n - 3], [8, n - 2], [8, n - 1],
  ]

  for (let i = 0; i < 15; i++) {
    const val = (bits >> (14 - i)) & 1 ? 1 : -1
    const [r1, c1] = positions1[i]
    const [r2, c2] = positions2[i]
    matrix[r1][c1] = val
    matrix[r2][c2] = val
  }

}


// ══════════════════════════════════════════
//  Version info (v7+)
// ══════════════════════════════════════════

const VERSION_INFO_BITS = computeVersionInfoBits()


function computeVersionInfoBits() {

  const result = new Array(41).fill(0)
  const gen = 0x1f25  // generator poly for version info

  for (let v = 7; v <= 40; v++) {

    let bits = v << 12
    let tmp = bits

    for (let i = 17; i >= 12; i--) {
      if (tmp & (1 << i)) tmp ^= gen << (i - 12)
    }

    result[v] = bits | tmp

  }

  return result

}


export function placeVersionInfo(matrix, version) {

  if (version < 7) return

  const n = matrix.length
  const bits = VERSION_INFO_BITS[version]

  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 3; j++) {
      const bitIdx = i * 3 + j
      const val = (bits >> bitIdx) & 1 ? 1 : -1
      matrix[i][n - 11 + j] = val
      matrix[n - 11 + j][i] = val
    }
  }

}


// ══════════════════════════════════════════
//  Penalty scoring
// ══════════════════════════════════════════

export function computePenalty(matrix) {

  const n = matrix.length
  let penalty = 0


  // Rule 1: 5+ same-color in a row/column

  for (let r = 0; r < n; r++) {
    let count = 1
    for (let c = 1; c < n; c++) {
      if ((matrix[r][c] > 0) === (matrix[r][c - 1] > 0)) {
        count++
        if (count === 5) penalty += 3
        else if (count > 5) penalty += 1
      } else {
        count = 1
      }
    }
  }

  for (let c = 0; c < n; c++) {
    let count = 1
    for (let r = 1; r < n; r++) {
      if ((matrix[r][c] > 0) === (matrix[r - 1][c] > 0)) {
        count++
        if (count === 5) penalty += 3
        else if (count > 5) penalty += 1
      } else {
        count = 1
      }
    }
  }


  // Rule 2: 2×2 blocks

  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const v = matrix[r][c] > 0
      if (
        v === (matrix[r][c + 1] > 0) &&
        v === (matrix[r + 1][c] > 0) &&
        v === (matrix[r + 1][c + 1] > 0)
      ) {
        penalty += 3
      }
    }
  }


  // Rule 3: finder-like patterns

  const pattern1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0]
  const pattern2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1]

  for (let r = 0; r < n; r++) {
    for (let c = 0; c <= n - 11; c++) {
      let match1 = true
      let match2 = true
      for (let i = 0; i < 11; i++) {
        const dark = matrix[r][c + i] > 0 ? 1 : 0
        if (dark !== pattern1[i]) match1 = false
        if (dark !== pattern2[i]) match2 = false
      }
      if (match1 || match2) penalty += 40
    }
  }

  for (let c = 0; c < n; c++) {
    for (let r = 0; r <= n - 11; r++) {
      let match1 = true
      let match2 = true
      for (let i = 0; i < 11; i++) {
        const dark = matrix[r + i][c] > 0 ? 1 : 0
        if (dark !== pattern1[i]) match1 = false
        if (dark !== pattern2[i]) match2 = false
      }
      if (match1 || match2) penalty += 40
    }
  }


  // Rule 4: proportion of dark modules

  let dark = 0

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c] > 0) dark++
    }
  }

  const total = n * n
  const pct = (dark / total) * 100
  const prev5 = Math.floor(pct / 5) * 5
  const next5 = prev5 + 5
  penalty += Math.min(Math.abs(prev5 - 50) / 5, Math.abs(next5 - 50) / 5) * 10


  return penalty

}
