/* qrsteg.js - QR error-correction steganography (QSTG). */
(function (root) {
  "use strict";

  const LEVEL_BITS = { L: 1, M: 0, Q: 3, H: 2 };
  const LEVELS = ["L", "M", "Q", "H"];

  const BLOCK_TABLE = {
    L: parseBlockTable(
      "1,26,19;1,44,34;1,70,55;1,100,80;1,134,108;2,86,68;2,98,78;2,121,97;2,146,116;2,86,68|2,87,69;4,101,81;2,116,92|2,117,93;4,133,107;3,145,115|1,146,116;5,109,87|1,110,88;5,122,98|1,123,99;1,135,107|5,136,108;5,150,120|1,151,121;3,141,113|4,142,114;3,135,107|5,136,108;4,144,116|4,145,117;2,139,111|7,140,112;4,151,121|5,152,122;6,147,117|4,148,118;8,132,106|4,133,107;10,142,114|2,143,115;8,152,122|4,153,123;3,147,117|10,148,118;7,146,116|7,147,117;5,145,115|10,146,116;13,145,115|3,146,116;17,145,115;17,145,115|1,146,116;13,145,115|6,146,116;12,151,121|7,152,122;6,151,121|14,152,122;17,152,122|4,153,123;4,152,122|18,153,123;20,147,117|4,148,118;19,148,118|6,149,119"
    ),
    M: parseBlockTable(
      "1,26,16;1,44,28;1,70,44;2,50,32;2,67,43;4,43,27;4,49,31;2,60,38|2,61,39;3,58,36|2,59,37;4,69,43|1,70,44;1,80,50|4,81,51;6,58,36|2,59,37;8,59,37|1,60,38;4,64,40|5,65,41;5,65,41|5,66,42;7,73,45|3,74,46;10,74,46|1,75,47;9,69,43|4,70,44;3,70,44|11,71,45;3,67,41|13,68,42;17,68,42;17,74,46;4,75,47|14,76,48;6,73,45|14,74,46;8,75,47|13,76,48;19,74,46|4,75,47;22,73,45|3,74,46;3,73,45|23,74,46;21,73,45|7,74,46;19,75,47|10,76,48;2,74,46|29,75,47;10,74,46|23,75,47;14,74,46|21,75,47;14,74,46|23,75,47;12,75,47|26,76,48;6,75,47|34,76,48;29,74,46|14,75,47;13,74,46|32,75,47;40,75,47|7,76,48;18,75,47|31,76,48"
    ),
    Q: parseBlockTable(
      "1,26,13;1,44,22;2,35,17;2,50,24;2,33,15|2,34,16;4,43,19;2,32,14|4,33,15;4,40,18|2,41,19;4,36,16|4,37,17;6,43,19|2,44,20;4,50,22|4,51,23;4,46,20|6,47,21;8,44,20|4,45,21;11,36,16|5,37,17;5,54,24|7,55,25;15,43,19|2,44,20;1,50,22|15,51,23;17,50,22|1,51,23;17,47,21|4,48,22;15,54,24|5,55,25;17,50,22|6,51,23;7,54,24|16,55,25;11,54,24|14,55,25;11,54,24|16,55,25;7,54,24|22,55,25;28,50,22|6,51,23;8,53,23|26,54,24;4,54,24|31,55,25;1,53,23|37,54,24;15,54,24|25,55,25;42,54,24|1,55,25;10,54,24|35,55,25;29,54,24|19,55,25;44,54,24|7,55,25;39,54,24|14,55,25;46,54,24|10,55,25;49,54,24|10,55,25;48,54,24|14,55,25;43,54,24|22,55,25;34,54,24|34,55,25"
    ),
    H: parseBlockTable(
      "1,26,9;1,44,16;2,35,13;4,25,9;2,33,11|2,34,12;4,43,15;4,39,13|1,40,14;4,40,14|2,41,15;4,36,12|4,37,13;6,43,15|2,44,16;3,36,12|8,37,13;7,42,14|4,43,15;12,33,11|4,34,12;11,36,12|5,37,13;11,36,12|7,37,13;3,45,15|13,46,16;2,42,14|17,43,15;2,42,14|19,43,15;9,39,13|16,40,14;15,43,15|10,44,16;19,46,16|6,47,17;34,37,13;16,45,15|14,46,16;30,46,16|2,47,17;22,45,15|13,46,16;33,46,16|4,47,17;12,45,15|28,46,16;11,45,15|31,46,16;19,45,15|26,46,16;23,45,15|25,46,16;23,45,15|28,46,16;19,45,15|35,46,16;11,45,15|46,46,16;59,46,16|1,47,17;22,45,15|41,46,16;2,45,15|64,46,16;24,45,15|46,46,16;42,45,15|32,46,16;10,45,15|67,46,16;20,45,15|61,46,16"
    )
  };

  function parseBlockTable(text) {
    return text.split(";").map(function (versionSpec) {
      return versionSpec.split("|").map(function (group) {
        return group.split(",").map(Number);
      });
    });
  }

  const FRAME_MAGIC = [0x51, 0x53, 0x54, 0x47];
  const FRAME_VERSION = 1;
  const FRAME_FLAG_UTF8 = 1;
  const FRAME_HEADER_SIZE = 12;
  const HIDDEN_PARITY_RATE = 0.25;

  const GF_EXP = new Uint8Array(512);
  const GF_LOG = new Uint8Array(256);

  (function buildGaloisTables() {
    let value = 1;
    for (let i = 0; i < 255; i++) {
      GF_EXP[i] = value;
      GF_LOG[value] = i;
      value <<= 1;
      if (value & 0x100) value ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return GF_EXP[GF_LOG[a] + GF_LOG[b]];
  }

  function gfInv(a) {
    return GF_EXP[255 - GF_LOG[a]];
  }

  function gfPow2(power) {
    const index = ((power % 255) + 255) % 255;
    return GF_EXP[index];
  }

  function gfLog(a) {
    return GF_LOG[a];
  }

  function polyTrim(poly) {
    let start = 0;
    while (start < poly.length - 1 && poly[start] === 0) start++;
    return poly.slice(start);
  }

  function polyDegree(poly) {
    return poly.length - 1;
  }

  function polyIsZero(poly) {
    return poly.length === 1 && poly[0] === 0;
  }

  function polyEval(poly, x) {
    let result = 0;
    for (let i = 0; i < poly.length; i++) {
      result = gfMul(result, x) ^ poly[i];
    }
    return result;
  }

  function polyAdd(a, b) {
    const length = Math.max(a.length, b.length);
    const out = new Array(length).fill(0);
    for (let i = 0; i < a.length; i++) out[i + length - a.length] = a[i];
    for (let i = 0; i < b.length; i++) out[i + length - b.length] ^= b[i];
    return polyTrim(out);
  }

  function polyScale(poly, scalar) {
    return polyTrim(poly.map(function (coefficient) {
      return gfMul(coefficient, scalar);
    }));
  }

  function polyMul(a, b) {
    const out = new Array(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i++) {
      if (a[i] === 0) continue;
      for (let j = 0; j < b.length; j++) {
        out[i + j] ^= gfMul(a[i], b[j]);
      }
    }
    return polyTrim(out);
  }

  function polyMonomial(degree, coefficient) {
    const out = new Array(degree + 1).fill(0);
    out[0] = coefficient;
    return out;
  }

  function polyMulMonomial(poly, degree, coefficient) {
    const out = new Array(poly.length + degree).fill(0);
    for (let i = 0; i < poly.length; i++) {
      out[i] = gfMul(poly[i], coefficient);
    }
    return polyTrim(out);
  }

  const generatorCache = new Map();

  function rsGenerator(ecLength) {
    if (generatorCache.has(ecLength)) return generatorCache.get(ecLength);
    let generator = [1];
    for (let i = 0; i < ecLength; i++) {
      generator = polyMul(generator, [1, gfPow2(i)]);
    }
    generatorCache.set(ecLength, generator);
    return generator;
  }

  function rsEncode(data, ecLength) {
    const out = new Uint8Array(data.length + ecLength);
    out.set(data);
    if (ecLength === 0) return Array.from(out);

    const generator = rsGenerator(ecLength);
    for (let i = 0; i < data.length; i++) {
      const factor = out[i];
      if (factor === 0) continue;
      for (let j = 1; j < generator.length; j++) {
        out[i + j] ^= gfMul(generator[j], factor);
      }
    }
    return Array.from(data).concat(Array.from(out.slice(data.length)));
  }

  function rsDecode(codeword, ecLength) {
    const message = Array.from(codeword);
    if (ecLength === 0) return { data: message, errors: [] };

    const syndromes = new Array(ecLength).fill(0);
    let hasError = false;
    for (let i = 0; i < ecLength; i++) {
      const value = polyEval(message, gfPow2(i));
      syndromes[ecLength - 1 - i] = value;
      if (value !== 0) hasError = true;
    }
    if (!hasError) return { data: message, errors: [] };

    const result = euclidean(polyMonomial(ecLength, 1), polyTrim(syndromes), ecLength);
    if (!result) return null;

    const sigma = result[0];
    const omega = result[1];
    const locations = findErrorLocations(sigma);
    if (!locations) return null;

    const magnitudes = findErrorMagnitudes(omega, locations);
    if (!magnitudes) return null;

    const errors = [];
    for (let i = 0; i < locations.length; i++) {
      const position = message.length - 1 - gfLog(locations[i]);
      if (position < 0 || position >= message.length) return null;
      message[position] ^= magnitudes[i];
      errors.push(position);
    }

    for (let i = 0; i < ecLength; i++) {
      if (polyEval(message, gfPow2(i)) !== 0) return null;
    }

    errors.sort(function (a, b) { return a - b; });
    return { data: message, errors: errors };
  }

  function euclidean(a, b, ecLength) {
    if (polyDegree(a) < polyDegree(b)) {
      const swap = a;
      a = b;
      b = swap;
    }

    let rPrev = a;
    let r = b;
    let tPrev = [0];
    let t = [1];

    while (polyDegree(r) >= Math.floor(ecLength / 2)) {
      const rPrevPrev = rPrev;
      const tPrevPrev = tPrev;
      rPrev = r;
      tPrev = t;
      if (polyIsZero(rPrev)) return null;

      r = rPrevPrev;
      let q = [0];
      const leading = rPrev[0];
      const leadingInv = gfInv(leading);

      while (polyDegree(r) >= polyDegree(rPrev) && !polyIsZero(r)) {
        const degreeDiff = polyDegree(r) - polyDegree(rPrev);
        const scale = gfMul(r[0], leadingInv);
        q = polyAdd(q, polyMonomial(degreeDiff, scale));
        r = polyAdd(r, polyMulMonomial(rPrev, degreeDiff, scale));
      }

      t = polyAdd(polyMul(q, tPrev), tPrevPrev);
    }

    const constant = t[t.length - 1];
    if (constant === 0) return null;
    const inverse = gfInv(constant);
    return [polyScale(t, inverse), polyScale(r, inverse)];
  }

  function findErrorLocations(sigma) {
    const count = polyDegree(sigma);
    if (count === 1) return [sigma[0]];

    const locations = [];
    for (let value = 1; value < 256 && locations.length < count; value++) {
      if (polyEval(sigma, value) === 0) locations.push(gfInv(value));
    }
    return locations.length === count ? locations : null;
  }

  function findErrorMagnitudes(omega, locations) {
    const magnitudes = new Array(locations.length);
    for (let i = 0; i < locations.length; i++) {
      const inverse = gfInv(locations[i]);
      let denominator = 1;
      for (let j = 0; j < locations.length; j++) {
        if (i === j) continue;
        denominator = gfMul(denominator, 1 ^ gfMul(locations[j], inverse));
      }
      if (denominator === 0) return null;
      magnitudes[i] = gfMul(polyEval(omega, inverse), gfInv(denominator));
    }
    return magnitudes;
  }

  function moduleCount(version) {
    return 17 + 4 * version;
  }

  function blockLayout(version, level) {
    const blocks = [];
    const groups = BLOCK_TABLE[level][version - 1];
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      for (let n = 0; n < group[0]; n++) {
        blocks.push([group[1], group[2]]);
      }
    }
    return blocks;
  }

  function dataCapacity(version, level) {
    return blockLayout(version, level).reduce(function (sum, block) {
      return sum + block[1];
    }, 0);
  }

  function errorCapacity(version, level) {
    const blocks = blockLayout(version, level);
    let capacity = Infinity;
    for (let i = 0; i < blocks.length; i++) {
      const total = blocks[i][0];
      const data = blocks[i][1];
      capacity = Math.min(capacity, Math.floor((total - data) / 2));
    }
    return capacity;
  }

  function alignmentPositions(version) {
    if (version === 1) return [];

    const count = Math.floor(version / 7) + 2;
    const step = version === 32
      ? 26
      : Math.floor((version * 4 + count * 2 + 1) / (count * 2 - 2)) * 2;

    const positions = new Array(count);
    positions[0] = 6;
    let position = moduleCount(version) - 7;
    for (let i = count - 1; i >= 1; i--) {
      positions[i] = position;
      position -= step;
    }
    return positions;
  }

  function formatPositions(n) {
    const first = [];
    const second = [];

    for (let i = 0; i <= 5; i++) first.push([8, i]);
    first.push([8, 7], [8, 8], [7, 8]);
    for (let i = 9; i < 15; i++) first.push([14 - i, 8]);

    for (let i = 0; i < 8; i++) second.push([n - 1 - i, 8]);
    for (let i = 8; i < 15; i++) second.push([8, n - 15 + i]);

    return [first, second];
  }

  function formatCode(level, mask) {
    const data = (LEVEL_BITS[level] << 3) | mask;
    let remainder = data;
    for (let i = 0; i < 10; i++) {
      remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
    }
    return ((data << 10) | remainder) ^ 0x5412;
  }

  function versionCode(version) {
    let remainder = version;
    for (let i = 0; i < 12; i++) {
      remainder = (remainder << 1) ^ ((remainder >>> 11) * 0x1f25);
    }
    return (version << 12) | remainder;
  }

  function buildBase(version) {
    const n = moduleCount(version);
    const modules = Array.from({ length: n }, function () {
      return new Uint8Array(n);
    });
    const reserved = Array.from({ length: n }, function () {
      return new Uint8Array(n);
    });

    function set(x, y, dark) {
      if (x < 0 || x >= n || y < 0 || y >= n) return;
      modules[y][x] = dark ? 1 : 0;
      reserved[y][x] = 1;
    }

    for (let i = 0; i < n; i++) {
      set(6, i, i % 2 === 0);
      set(i, 6, i % 2 === 0);
    }

    const finderCenters = [[3, 3], [n - 4, 3], [3, n - 4]];
    for (let i = 0; i < finderCenters.length; i++) {
      const cx = finderCenters[i][0];
      const cy = finderCenters[i][1];
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const distance = Math.max(Math.abs(dx), Math.abs(dy));
          set(cx + dx, cy + dy, distance !== 2 && distance !== 4);
        }
      }
    }

    const centers = alignmentPositions(version);
    for (let i = 0; i < centers.length; i++) {
      for (let j = 0; j < centers.length; j++) {
        if (
          (i === 0 && j === 0) ||
          (i === 0 && j === centers.length - 1) ||
          (i === centers.length - 1 && j === 0)
        ) continue;

        const cx = centers[i];
        const cy = centers[j];
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const distance = Math.max(Math.abs(dx), Math.abs(dy));
            set(cx + dx, cy + dy, distance !== 1);
          }
        }
      }
    }

    const format = formatPositions(n);
    for (let copy = 0; copy < 2; copy++) {
      for (let i = 0; i < 15; i++) {
        set(format[copy][i][0], format[copy][i][1], 0);
      }
    }

    set(8, n - 8, 1);

    if (version >= 7) {
      for (let i = 0; i < 18; i++) {
        const a = n - 11 + (i % 3);
        const b = Math.floor(i / 3);
        set(a, b, 0);
        set(b, a, 0);
      }
    }

    return { modules: modules, reserved: reserved, n: n };
  }

  const baseCache = new Map();
  function baseFor(version) {
    if (!baseCache.has(version)) baseCache.set(version, buildBase(version));
    return baseCache.get(version);
  }

  function cloneBase(base) {
    return {
      modules: base.modules.map(function (row) { return row.slice(); }),
      reserved: base.reserved,
      n: base.n
    };
  }

  const placementCache = new Map();
  function placementOrder(version) {
    if (placementCache.has(version)) return placementCache.get(version);

    const n = moduleCount(version);
    const reserved = baseFor(version).reserved;
    const order = [];

    for (let right = n - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      const upward = ((right + 1) & 2) === 0;

      for (let vertical = 0; vertical < n; vertical++) {
        for (let column = 0; column < 2; column++) {
          const x = right - column;
          const y = upward ? n - 1 - vertical : vertical;
          if (!reserved[y][x]) order.push([x, y]);
        }
      }
    }

    placementCache.set(version, order);
    return order;
  }

  const maskFunctions = [
    function (x, y) { return (x + y) % 2 === 0; },
    function (x, y) { return y % 2 === 0; },
    function (x, y) { return x % 3 === 0; },
    function (x, y) { return (x + y) % 3 === 0; },
    function (x, y) { return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; },
    function (x, y) { return ((x * y) % 2) + ((x * y) % 3) === 0; },
    function (x, y) { return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; },
    function (x, y) { return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; }
  ];

  function penaltyScore(modules) {
    const n = modules.length;
    let score = 0;

    for (let y = 0; y < n; y++) {
      let color = modules[y][0];
      let run = 1;
      for (let x = 1; x < n; x++) {
        if (modules[y][x] === color) {
          run++;
        } else {
          if (run >= 5) score += 3 + (run - 5);
          color = modules[y][x];
          run = 1;
        }
      }
      if (run >= 5) score += 3 + (run - 5);
    }

    for (let x = 0; x < n; x++) {
      let color = modules[0][x];
      let run = 1;
      for (let y = 1; y < n; y++) {
        if (modules[y][x] === color) {
          run++;
        } else {
          if (run >= 5) score += 3 + (run - 5);
          color = modules[y][x];
          run = 1;
        }
      }
      if (run >= 5) score += 3 + (run - 5);
    }

    for (let y = 0; y < n - 1; y++) {
      for (let x = 0; x < n - 1; x++) {
        const color = modules[y][x];
        if (
          color === modules[y][x + 1] &&
          color === modules[y + 1][x] &&
          color === modules[y + 1][x + 1]
        ) score += 3;
      }
    }

    const patternA = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    const patternB = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];

    for (let y = 0; y < n; y++) {
      for (let x = 0; x <= n - 11; x++) {
        let matchA = true;
        let matchB = true;
        for (let k = 0; k < 11; k++) {
          if (modules[y][x + k] !== patternA[k]) matchA = false;
          if (modules[y][x + k] !== patternB[k]) matchB = false;
        }
        if (matchA) score += 40;
        if (matchB) score += 40;
      }
    }

    for (let x = 0; x < n; x++) {
      for (let y = 0; y <= n - 11; y++) {
        let matchA = true;
        let matchB = true;
        for (let k = 0; k < 11; k++) {
          if (modules[y + k][x] !== patternA[k]) matchA = false;
          if (modules[y + k][x] !== patternB[k]) matchB = false;
        }
        if (matchA) score += 40;
        if (matchB) score += 40;
      }
    }

    let dark = 0;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) dark += modules[y][x];
    }
    const percentage = (dark * 100) / (n * n);
    score += Math.floor(Math.abs(percentage - 50) / 5) * 10;

    return score;
  }

  function drawFormat(modules, n, level, mask) {
    const code = formatCode(level, mask);
    const positions = formatPositions(n);

    for (let i = 0; i < 15; i++) {
      const bit = (code >>> i) & 1;
      modules[positions[0][i][1]][positions[0][i][0]] = bit;
      modules[positions[1][i][1]][positions[1][i][0]] = bit;
    }

    modules[n - 8][8] = 1;
  }

  function drawVersion(modules, n, version) {
    if (version < 7) return;

    const code = versionCode(version);
    for (let i = 0; i < 18; i++) {
      const bit = (code >>> i) & 1;
      const a = n - 11 + (i % 3);
      const b = Math.floor(i / 3);
      modules[b][a] = bit;
      modules[a][b] = bit;
    }
  }

  const interleaveCache = new Map();
  function interleaveOrder(version, level) {
    const key = version + ":" + level;
    if (interleaveCache.has(key)) return interleaveCache.get(key);

    const layout = blockLayout(version, level);
    const order = [];
    let maxData = 0;
    let maxEc = 0;

    for (let i = 0; i < layout.length; i++) {
      maxData = Math.max(maxData, layout[i][1]);
      maxEc = Math.max(maxEc, layout[i][0] - layout[i][1]);
    }

    for (let i = 0; i < maxData; i++) {
      for (let b = 0; b < layout.length; b++) {
        if (i < layout[b][1]) order.push([b, i]);
      }
    }

    for (let i = 0; i < maxEc; i++) {
      for (let b = 0; b < layout.length; b++) {
        if (i < layout[b][0] - layout[b][1]) {
          order.push([b, layout[b][1] + i]);
        }
      }
    }

    interleaveCache.set(key, order);
    return order;
  }

  function renderMatrix(blocks, version, level, forcedMask) {
    const order = interleaveOrder(version, level);
    const bits = [];

    for (let i = 0; i < order.length; i++) {
      const value = blocks[order[i][0]][order[i][1]];
      for (let shift = 7; shift >= 0; shift--) bits.push((value >>> shift) & 1);
    }

    const placement = placementOrder(version);
    const masks = (forcedMask === undefined || forcedMask === null)
      ? [0, 1, 2, 3, 4, 5, 6, 7]
      : [forcedMask];

    let best = null;
    for (let m = 0; m < masks.length; m++) {
      const mask = masks[m];
      const base = cloneBase(baseFor(version));
      const modules = base.modules;
      const n = base.n;
      const maskFunction = maskFunctions[mask];

      for (let i = 0; i < placement.length; i++) {
        const x = placement[i][0];
        const y = placement[i][1];
        const bit = i < bits.length ? bits[i] : 0;
        modules[y][x] = bit ^ (maskFunction(x, y) ? 1 : 0);
      }

      drawFormat(modules, n, level, mask);
      drawVersion(modules, n, version);

      const score = masks.length > 1 ? penaltyScore(modules) : 0;
      if (!best || score < best.score) {
        best = { matrix: modules, mask: mask, score: score };
      }
    }

    return best;
  }

  function utf8(text) {
    return Array.from(new TextEncoder().encode(text));
  }

  function frontCodewords(bytes, version, level) {
    const capacity = dataCapacity(version, level);
    const bits = [];

    function append(value, length) {
      for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
    }

    append(0b0100, 4);
    append(bytes.length, version < 10 ? 8 : 16);
    for (let i = 0; i < bytes.length; i++) append(bytes[i], 8);

    if (bits.length > capacity * 8) return null;

    const terminator = Math.min(4, capacity * 8 - bits.length);
    append(0, terminator);
    while (bits.length % 8 !== 0) bits.push(0);

    const codewords = [];
    for (let i = 0; i < bits.length; i += 8) {
      let value = 0;
      for (let j = 0; j < 8; j++) value = (value << 1) | bits[i + j];
      codewords.push(value);
    }

    const padding = [0xec, 0x11];
    for (let i = 0; codewords.length < capacity; i++) {
      codewords.push(padding[i & 1]);
    }
    return codewords;
  }

  function minimumVersion(byteLength, level) {
    for (let version = 1; version <= 40; version++) {
      if (frontCodewords(new Uint8Array(byteLength), version, level)) {
        return version;
      }
    }
    return null;
  }

  function checksum32(bytes) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < bytes.length; i++) {
      hash ^= bytes[i];
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
  }

  function buildFrame(payload) {
    const sum = checksum32(payload);
    const frame = [
      FRAME_MAGIC[0], FRAME_MAGIC[1], FRAME_MAGIC[2], FRAME_MAGIC[3],
      FRAME_VERSION,
      FRAME_FLAG_UTF8,
      (payload.length >>> 8) & 0xff,
      payload.length & 0xff,
      (sum >>> 24) & 0xff,
      (sum >>> 16) & 0xff,
      (sum >>> 8) & 0xff,
      sum & 0xff
    ];
    for (let i = 0; i < payload.length; i++) frame.push(payload[i]);
    return frame;
  }

  function parseFrame(bytes) {
    if (bytes.length < FRAME_HEADER_SIZE) return null;
    if (
      bytes[0] !== FRAME_MAGIC[0] ||
      bytes[1] !== FRAME_MAGIC[1] ||
      bytes[2] !== FRAME_MAGIC[2] ||
      bytes[3] !== FRAME_MAGIC[3]
    ) return null;
    if (bytes[4] !== FRAME_VERSION) return null;

    const length = (bytes[6] << 8) | bytes[7];
    if (FRAME_HEADER_SIZE + length > bytes.length) return null;

    const expected = (
      (bytes[8] << 24) |
      (bytes[9] << 16) |
      (bytes[10] << 8) |
      bytes[11]
    ) >>> 0;

    const payload = bytes.slice(FRAME_HEADER_SIZE, FRAME_HEADER_SIZE + length);
    if (checksum32(payload) !== expected) return null;

    for (let i = FRAME_HEADER_SIZE + length; i < bytes.length; i++) {
      if (bytes[i] !== 0) return null;
    }

    return { payload: payload, flags: bytes[5] };
  }

  const LEGACY_MAGIC = 0xa5;
  const LEGACY_PARITY_RATIO = 0.25;

  function legacyChunkPlan(total) {
    const count = Math.max(1, Math.ceil(total / 255));
    const plan = [];
    for (let i = 0; i < count; i++) {
      const size = Math.floor(total / count) + (i < total % count ? 1 : 0);
      let parity = Math.max(2, 2 * Math.round((size * LEGACY_PARITY_RATIO) / 2));
      parity = Math.min(parity, size > 1 ? size - 1 : 0);
      plan.push([size, parity]);
    }
    return plan;
  }

  function legacyFrameDecode(raw) {
    const plan = legacyChunkPlan(raw.length);
    const message = [];
    let offset = 0;
    let fixed = 0;

    for (let i = 0; i < plan.length; i++) {
      const size = plan[i][0];
      const parity = plan[i][1];
      const decoded = rsDecode(raw.slice(offset, offset + size), parity);
      if (!decoded) return null;
      fixed += decoded.errors.length;
      for (let j = 0; j < size - parity; j++) message.push(decoded.data[j]);
      offset += size;

      if (message.length > 0 && message[0] !== LEGACY_MAGIC) return null;
    }

    if (message.length < 3 || message[0] !== LEGACY_MAGIC) return null;

    const length = (message[1] << 8) | message[2];
    if (length > message.length - 3) return null;
    for (let i = 3 + length; i < message.length; i++) {
      if (message[i] !== 0) return null;
    }

    return { payload: message.slice(3, 3 + length), fixed: fixed };
  }

  function legacySlots(layout, k) {
    const slots = [];
    for (let j = 0; j < k; j++) {
      for (let b = 0; b < layout.length; b++) {
        slots.push([b, layout[b][0] - 1 - j]);
      }
    }
    return slots;
  }

  function readLegacy(blocks, layout, t) {
    for (let candidate = t; candidate >= 1; candidate--) {
      const slots = legacySlots(layout, candidate);
      const raw = new Array(slots.length);
      for (let i = 0; i < slots.length; i++) {
        raw[i] = blocks[slots[i][0]][slots[i][1]];
      }
      const parsed = legacyFrameDecode(raw);
      if (parsed) {
        return { k: candidate, payload: parsed.payload, fixed: parsed.fixed };
      }
    }
    return null;
  }

  function hiddenParity(k) {
    if (k <= 1) return 0;
    return Math.max(1, Math.round(k * HIDDEN_PARITY_RATE));
  }

  function hiddenDataPerBlock(k) {
    return k - hiddenParity(k);
  }

  function hiddenCapacity(version, level, k) {
    return blockLayout(version, level).length * hiddenDataPerBlock(k);
  }

  function maximumHiddenPayload(version, level, cap) {
    const t = errorCapacity(version, level);
    const kMax = Math.floor(cap * t + 1e-9);
    if (kMax < 1) return 0;
    return Math.max(0, hiddenCapacity(version, level, kMax) - FRAME_HEADER_SIZE);
  }

  function plan(frontText, hiddenText, options) {
    options = options || {};
    const level = options.level || "H";
    const cap = options.cap === undefined ? 0.7 : Number(options.cap);
    const front = utf8(frontText);
    const hidden = utf8(hiddenText || "");

    const firstVersion = minimumVersion(front.length, level);
    if (!firstVersion) return { error: "front" };

    const versions = options.version
      ? [Number(options.version)]
      : Array.from({ length: 41 - firstVersion }, function (_, i) {
        return firstVersion + i;
      });

    const frameLength = FRAME_HEADER_SIZE + hidden.length;

    for (let i = 0; i < versions.length; i++) {
      const version = versions[i];
      if (version < firstVersion || version < 1 || version > 40) continue;

      const layout = blockLayout(version, level);
      const t = errorCapacity(version, level);
      const kMax = Math.floor(cap * t + 1e-9);
      const room = maximumHiddenPayload(version, level, cap);
      let k = 0;

      if (hidden.length > 0) {
        k = -1;
        for (let candidate = 1; candidate <= kMax; candidate++) {
          if (hiddenCapacity(version, level, candidate) >= frameLength) {
            k = candidate;
            break;
          }
        }
        if (k < 0) continue;
      }

      return {
        version: version,
        level: level,
        k: k,
        t: t,
        blocks: layout.length,
        errLen: hidden.length,
        errRoom: room,
        front: front,
        hidden: hidden
      };
    }

    return { error: "hidden" };
  }

  function make(frontText, hiddenText, options) {
    const planned = plan(frontText, hiddenText, options);
    if (planned.error) return planned;

    const version = planned.version;
    const level = planned.level;
    const k = planned.k;
    const layout = blockLayout(version, level);
    const data = frontCodewords(planned.front, version, level);
    const blocks = [];

    let offset = 0;
    for (let i = 0; i < layout.length; i++) {
      const total = layout[i][0];
      const dataLength = layout[i][1];
      const blockData = data.slice(offset, offset + dataLength);
      offset += dataLength;
      blocks.push(rsEncode(blockData, total - dataLength));
    }

    if (k > 0) {
      const parity = hiddenParity(k);
      const dataPerBlock = k - parity;
      const frame = buildFrame(planned.hidden);
      const paddedLength = layout.length * dataPerBlock;
      while (frame.length < paddedLength) frame.push(0);

      for (let b = 0; b < layout.length; b++) {
        const start = b * dataPerBlock;
        const chunk = frame.slice(start, start + dataPerBlock);
        const encoded = rsEncode(chunk, parity);
        const total = layout[b][0];
        for (let i = 0; i < k; i++) {
          blocks[b][total - k + i] = encoded[i];
        }
      }
    }

    const rendered = renderMatrix(blocks, version, level, options && options.mask);
    return {
      version: planned.version,
      level: planned.level,
      k: planned.k,
      t: planned.t,
      blocks: planned.blocks,
      errLen: planned.errLen,
      errRoom: planned.errRoom,
      mask: rendered.mask,
      size: moduleCount(version),
      matrix: rendered.matrix
    };
  }

  function readFormat(getModule, n) {
    const positions = formatPositions(n);
    let best = null;

    for (let l = 0; l < LEVELS.length; l++) {
      const level = LEVELS[l];
      for (let mask = 0; mask < 8; mask++) {
        const code = formatCode(level, mask);

        for (let copy = 0; copy < 2; copy++) {
          let distance = 0;
          for (let i = 0; i < 15; i++) {
            const expected = (code >>> i) & 1;
            const actual = getModule(positions[copy][i][0], positions[copy][i][1]);
            if (actual !== expected) distance++;
          }
          if (!best || distance < best.distance) {
            best = { distance: distance, level: level, mask: mask };
          }
        }
      }
    }

    return best && best.distance <= 3 ? best : null;
  }

  let preferredK = 0;

  function readMatrix(getModule, version) {
    const n = moduleCount(version);
    const format = readFormat(getModule, n);
    if (!format) return null;

    const level = format.level;
    const mask = format.mask;
    const layout = blockLayout(version, level);
    const blocks = layout.map(function (block) {
      return new Array(block[0]).fill(0);
    });
    const order = interleaveOrder(version, level);
    const placement = placementOrder(version);
    const maskFunction = maskFunctions[mask];

    for (let c = 0; c < order.length; c++) {
      let value = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = placement[c * 8 + bit][0];
        const y = placement[c * 8 + bit][1];
        const raw = getModule(x, y);
        value = (value << 1) | (raw ^ (maskFunction(x, y) ? 1 : 0));
      }
      blocks[order[c][0]][order[c][1]] = value;
    }

    const errorPositions = [];
    for (let b = 0; b < layout.length; b++) {
      const total = layout[b][0];
      const dataLength = layout[b][1];
      const decoded = rsDecode(blocks[b], total - dataLength);
      if (!decoded) return { version: version, level: level, mask: mask, ok: false };
      errorPositions.push(decoded.errors);
    }

    const t = errorCapacity(version, level);
    const candidates = [];
    if (preferredK >= 1 && preferredK <= t) candidates.push(preferredK);
    for (let candidate = t; candidate >= 1; candidate--) {
      if (candidate !== preferredK) candidates.push(candidate);
    }

    let k = 0;
    let hiddenBytes = null;
    let innerFixed = 0;

    for (let c = 0; c < candidates.length; c++) {
      const candidate = candidates[c];
      const parity = hiddenParity(candidate);
      const dataPerBlock = candidate - parity;
      const frame = [];
      let failed = false;

      for (let b = 0; b < layout.length; b++) {
        const total = layout[b][0];
        const raw = blocks[b].slice(total - candidate);
        const decoded = rsDecode(raw, parity);
        if (!decoded) {
          failed = true;
          break;
        }
        innerFixed += decoded.errors.length;
        for (let i = 0; i < dataPerBlock; i++) frame.push(decoded.data[i]);

        if (frame.length >= 4 && (
          frame[0] !== FRAME_MAGIC[0] ||
          frame[1] !== FRAME_MAGIC[1] ||
          frame[2] !== FRAME_MAGIC[2] ||
          frame[3] !== FRAME_MAGIC[3]
        )) {
          failed = true;
          break;
        }
      }

      if (failed) continue;

      const parsed = parseFrame(frame);
      if (parsed) {
        k = candidate;
        hiddenBytes = parsed.payload;
        break;
      }
    }

    let formatKind = "qstg";
    if (!hiddenBytes) {
      const legacy = readLegacy(blocks, layout, t);
      if (legacy) {
        k = legacy.k;
        hiddenBytes = legacy.payload;
        innerFixed += legacy.fixed;
        formatKind = "legacy";
      }
    }

    let noise = 0;
    for (let b = 0; b < layout.length; b++) {
      const total = layout[b][0];
      for (let i = 0; i < errorPositions[b].length; i++) {
        if (errorPositions[b][i] < total - k) noise++;
      }
    }

    return {
      ok: true,
      version: version,
      level: level,
      mask: mask,
      t: t,
      k: k,
      errLen: hiddenBytes ? hiddenBytes.length : 0,
      noise: noise,
      innerFixed: innerFixed,
      format: formatKind,
      hidden: hiddenBytes
        ? new TextDecoder().decode(new Uint8Array(hiddenBytes))
        : null
    };
  }

  const QRSteg = {
    make: make,
    plan: plan,
    readMatrix: readMatrix,
    size: moduleCount,
    maximumHiddenPayload: maximumHiddenPayload,
    blockLayout: blockLayout,
    maxErrorsPerBlock: errorCapacity,
    dataCapacity: dataCapacity,
    utf8: utf8,
    rsEncode: rsEncode,
    rsDecode: rsDecode
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = QRSteg;
  } else {
    root.QRSteg = QRSteg;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
