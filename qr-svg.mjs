/**
 * Pure zero-dependency ISO/IEC 18004 QR Code SVG generator (Byte mode, EC Level L).
 * Supports versions 1..6 (up to 134 UTF-8 bytes — sufficient for any https://fairhelm.com/... URL).
 * Produces a crisp vector <svg> suitable for 300+ DPI A4 lamination printing.
 */

// Version 1..6 parameters for Error Correction Level L (total codewords, EC codewords per block, num blocks = 1)
// Note: At EC Level L, Versions 1..5 use a single Reed-Solomon block, and Version 6 uses 2 blocks of (68 data, 18 ec).
const VERSION_SPEC_L = [
  null,
  { version: 1, size: 21, totalCodewords: 26, ecCodewordsPerBlock: 7, blocks: 1, align: [] },
  { version: 2, size: 25, totalCodewords: 44, ecCodewordsPerBlock: 10, blocks: 1, align: [6, 18] },
  { version: 3, size: 29, totalCodewords: 70, ecCodewordsPerBlock: 15, blocks: 1, align: [6, 22] },
  { version: 4, size: 33, totalCodewords: 100, ecCodewordsPerBlock: 20, blocks: 1, align: [6, 26] },
  { version: 5, size: 37, totalCodewords: 134, ecCodewordsPerBlock: 26, blocks: 1, align: [6, 30] },
  { version: 6, size: 41, totalCodewords: 172, ecCodewordsPerBlock: 18, blocks: 2, align: [6, 34] },
];

// GF(256) log / exp tables with primitive polynomial 0x11d (x^8 + x^4 + x^3 + x^2 + 1)
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree) {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i += 1) {
    const next = new Uint8Array(poly.length + 1);
    const root = GF_EXP[i];
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
  }
  return poly;
}

function rsComputeRemainder(data, ecLen) {
  const gen = rsGeneratorPoly(ecLen);
  const rem = new Uint8Array(ecLen);
  for (let i = 0; i < data.length; i += 1) {
    const factor = data[i] ^ rem[0];
    for (let j = 0; j < ecLen - 1; j += 1) {
      rem[j] = rem[j + 1] ^ gfMul(gen[j + 1], factor);
    }
    rem[ecLen - 1] = gfMul(gen[ecLen], factor);
  }
  return rem;
}

function pickVersion(byteLength) {
  for (let v = 1; v <= 6; v += 1) {
    const spec = VERSION_SPEC_L[v];
    const dataCapacity = spec.totalCodewords - spec.ecCodewordsPerBlock * spec.blocks;
    // Byte mode header: 4 bits mode (0100) + 8 bits length (for v1..9) + up to 4 bits terminator
    if (byteLength + 2 <= dataCapacity) return spec;
  }
  throw new Error(`QR payload too long (${byteLength} bytes; max 134 bytes for Version 6-L)`);
}

function encodeDataCodewords(bytes, spec) {
  const dataCapacity = spec.totalCodewords - spec.ecCodewordsPerBlock * spec.blocks;
  const bits = [];
  const pushBits = (val, len) => {
    for (let i = len - 1; i >= 0; i -= 1) {
      bits.push((val >>> i) & 1);
    }
  };

  // Mode indicator: Byte mode = 0100
  pushBits(0b0100, 4);
  // Character count indicator (8 bits for versions 1..9)
  pushBits(bytes.length, 8);
  for (let i = 0; i < bytes.length; i += 1) {
    pushBits(bytes[i], 8);
  }

  // Terminator (up to 4 zero bits)
  const maxBits = dataCapacity * 8;
  const term = Math.min(4, maxBits - bits.length);
  pushBits(0, term);

  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords = new Uint8Array(dataCapacity);
  const byteCount = bits.length / 8;
  for (let i = 0; i < byteCount; i += 1) {
    let b = 0;
    for (let bit = 0; bit < 8; bit += 1) {
      b = (b << 1) | bits[i * 8 + bit];
    }
    codewords[i] = b;
  }

  // Pad bytes 0xEC, 0x11 alternating
  let padToggle = 0;
  for (let i = byteCount; i < dataCapacity; i += 1) {
    codewords[i] = padToggle === 0 ? 0xec : 0x11;
    padToggle ^= 1;
  }

  if (spec.blocks === 1) {
    const ec = rsComputeRemainder(codewords, spec.ecCodewordsPerBlock);
    const out = new Uint8Array(spec.totalCodewords);
    out.set(codewords, 0);
    out.set(ec, codewords.length);
    return out;
  }

  // Multi-block interleaving (Version 6-L has 2 equal blocks)
  const blockDataLen = dataCapacity / spec.blocks;
  const dataBlocks = [];
  const ecBlocks = [];
  for (let b = 0; b < spec.blocks; b += 1) {
    const slice = codewords.subarray(b * blockDataLen, (b + 1) * blockDataLen);
    dataBlocks.push(slice);
    ecBlocks.push(rsComputeRemainder(slice, spec.ecCodewordsPerBlock));
  }

  const out = new Uint8Array(spec.totalCodewords);
  let ptr = 0;
  for (let i = 0; i < blockDataLen; i += 1) {
    for (let b = 0; b < spec.blocks; b += 1) {
      out[ptr] = dataBlocks[b][i];
      ptr += 1;
    }
  }
  for (let i = 0; i < spec.ecCodewordsPerBlock; i += 1) {
    for (let b = 0; b < spec.blocks; b += 1) {
      out[ptr] = ecBlocks[b][i];
      ptr += 1;
    }
  }
  return out;
}

function createMatrix(spec) {
  const n = spec.size;
  const modules = Array.from({ length: n }, () => new Uint8Array(n));
  const reserved = Array.from({ length: n }, () => new Uint8Array(n));

  const setFunctionModule = (r, c, dark) => {
    if (r < 0 || r >= n || c < 0 || c >= n) return;
    modules[r][c] = dark ? 1 : 0;
    reserved[r][c] = 1;
  };

  // Finder patterns + separators
  const placeFinder = (top, left) => {
    for (let dr = -1; dr <= 7; dr += 1) {
      for (let dc = -1; dc <= 7; dc += 1) {
        const r = top + dr;
        const c = left + dc;
        if (r < 0 || r >= n || c < 0 || c >= n) continue;
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        const onBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const inInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        setFunctionModule(r, c, inOuter && (onBorder || inInner));
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, n - 7);
  placeFinder(n - 7, 0);

  // Timing patterns
  for (let i = 8; i < n - 8; i += 1) {
    setFunctionModule(6, i, i % 2 === 0);
    setFunctionModule(i, 6, i % 2 === 0);
  }

  // Alignment patterns
  const coords = spec.align;
  for (let i = 0; i < coords.length; i += 1) {
    for (let j = 0; j < coords.length; j += 1) {
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === coords.length - 1) ||
        (i === coords.length - 1 && j === 0)
      ) {
        continue;
      }
      const cr = coords[i];
      const cc = coords[j];
      for (let dr = -2; dr <= 2; dr += 1) {
        for (let dc = -2; dc <= 2; dc += 1) {
          const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          setFunctionModule(cr + dr, cc + dc, dark);
        }
      }
    }
  }

  // Dark module & reserve format info areas
  setFunctionModule(4 * spec.version + 9, 8, true);
  for (let i = 0; i <= 8; i += 1) {
    if (i !== 6) {
      if (!reserved[8][i]) reserved[8][i] = 1;
      if (!reserved[i][8]) reserved[i][8] = 1;
    }
  }
  for (let i = 0; i < 8; i += 1) {
    reserved[8][n - 1 - i] = 1;
    reserved[n - 1 - i][8] = 1;
  }

  return { n, modules, reserved };
}

function placeDataBits(matrix, codewords) {
  const { n, modules, reserved } = matrix;
  let bitIdx = 0;
  const totalBits = codewords.length * 8;

  let upward = true;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < n; vert += 1) {
      const r = upward ? n - 1 - vert : vert;
      for (let j = 0; j < 2; j += 1) {
        const c = right - j;
        if (!reserved[r][c]) {
          let dark = false;
          if (bitIdx < totalBits) {
            dark = ((codewords[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1) === 1;
            bitIdx += 1;
          }
          // Apply Mask 0: (r + c) % 2 === 0
          if ((r + c) % 2 === 0) dark = !dark;
          modules[r][c] = dark ? 1 : 0;
        }
      }
    }
    upward = !upward;
  }
}

function writeFormatBits(matrix) {
  const { n, modules } = matrix;
  // EC Level L (01) + Mask 0 (000) -> data = 0b01000
  // Precomputed BCH(15,5) format bits for Level L (01), Mask 0 (000) XOR 0x5412 = 0x77c4 (30660)
  const formatBits = 0x77c4;
  const bit = (i) => ((formatBits >>> i) & 1) === 1;

  // Around top-left finder
  for (let i = 0; i <= 5; i += 1) modules[8][i] = bit(i) ? 1 : 0;
  modules[8][7] = bit(6) ? 1 : 0;
  modules[8][8] = bit(7) ? 1 : 0;
  modules[7][8] = bit(8) ? 1 : 0;
  for (let i = 9; i < 15; i += 1) modules[14 - i][8] = bit(i) ? 1 : 0;

  // Top-right and bottom-left
  for (let i = 0; i < 8; i += 1) modules[8][n - 1 - i] = bit(i) ? 1 : 0;
  for (let i = 8; i < 15; i += 1) modules[n - 15 + i][8] = bit(i) ? 1 : 0;
  modules[n - 8][8] = 1;
}

/**
 * Encode a string into a 2D boolean/number matrix of QR modules.
 * @param {string} text
 * @returns {{ size: number, version: number, modules: Uint8Array[] }}
 */
export function encodeQrMatrix(text) {
  const bytes = new TextEncoder().encode(String(text || ""));
  if (bytes.length === 0) {
    throw new Error("QR payload cannot be empty");
  }
  const spec = pickVersion(bytes.length);
  const codewords = encodeDataCodewords(bytes, spec);
  const matrix = createMatrix(spec);
  placeDataBits(matrix, codewords);
  writeFormatBits(matrix);
  return { size: matrix.n, version: spec.version, modules: matrix.modules };
}

/**
 * Render a deterministic, print-sharp SVG QR code string with a 2-module quiet zone.
 * @param {string} text
 * @param {{ label?: string, darkColor?: string, lightColor?: string }} [options]
 * @returns {string}
 */
export function renderQrSvg(text, options = {}) {
  const { size, modules } = encodeQrMatrix(text);
  const quiet = 2;
  const total = size + quiet * 2;
  const dark = options.darkColor || "#0b1929";
  const light = options.lightColor || "#ffffff";
  const label = (options.label || "QR Code").replace(/"/g, "&quot;");

  let pathData = "";
  for (let r = 0; r < size; r += 1) {
    const row = modules[r];
    for (let c = 0; c < size; c += 1) {
      if (row[c] === 1) {
        pathData += `M${c + quiet},${r + quiet}h1v1h-1z`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges" role="img" aria-label="${label}"><rect width="${total}" height="${total}" fill="${light}"/><path d="${pathData}" fill="${dark}"/></svg>`;
}
