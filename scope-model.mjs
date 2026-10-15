/**
 * Pure domain model for the Anchor Scope / Chain Length / Swing Radius Cockpit Card.
 * Scope ratio S = rode length / effective depth (charted depth + tide rise + bow roller height).
 */

export const LOCALES = Object.freeze([
  "en",
  "de",
  "pl",
  "ru",
  "es",
  "sv",
  "uk",
  "ar",
  "zh",
  "he",
]);

export const SCOPE_GUIDANCE = Object.freeze({
  calm_all_chain: { ratio: 3, label: "calm all-chain ~3:1" },
  coastal: { ratio: 5, label: "coastal ~5:1" },
  heavy_weather: { ratio: 7, label: "heavy weather ~7:1" },
});

export const TABLE_RATIOS = Object.freeze([3, 5, 7]);

export const DEFAULT_CARD_STATE = Object.freeze({
  vesselName: "SY AURORA",
  homeWaters: "Stockholm Archipelago",
  depth_m: 8,
  tide_rise_m: 0.3,
  bow_height_m: 1.5,
  loa_m: 12.2,
  scope_ratio: 5,
  rode_kind: "all_chain",
  unit: "m",
});

const FT_PER_M = 3.280839895;

/**
 * Effective depth D = charted depth + expected tide rise + height of bow roller / hawse above water.
 * @param {{ depth_m?: number, tide_rise_m?: number, bow_height_m?: number }} input
 * @returns {number}
 */
export function effectiveDepthM({ depth_m = 0, tide_rise_m = 0, bow_height_m = 0 } = {}) {
  const D = Number(depth_m) + Number(tide_rise_m) + Number(bow_height_m);
  return Number.isFinite(D) && D > 0 ? D : 0;
}

/**
 * Required rode length L = S × D.
 * @param {number} D
 * @param {number} scope_ratio
 * @returns {number}
 */
export function rodeLengthM(D, scope_ratio) {
  const d = Number(D);
  const s = Number(scope_ratio);
  if (!(d > 0) || !(s > 0)) return 0;
  return s * d;
}

/**
 * Horizontal distance from bow to anchor on the bottom: H = √(L² − D²) when L > D, else 0.
 * @param {number} L
 * @param {number} D
 * @returns {number}
 */
export function horizontalDistanceM(L, D) {
  const l = Number(L);
  const d = Number(D);
  if (!(l > d) || !(d >= 0)) return 0;
  return Math.sqrt(l * l - d * d);
}

/**
 * Swing radius from vessel stern/bow extremes: R = H + LOA (conservative cockpit rule of thumb).
 * @param {number} H
 * @param {number} loa_m
 * @returns {number}
 */
export function swingRadiusM(H, loa_m) {
  const h = Number(H);
  const loa = Number(loa_m);
  if (!(h >= 0)) return Math.max(0, loa || 0);
  return h + (Number.isFinite(loa) && loa > 0 ? loa : 0);
}

/**
 * Swing circle diameter = 2R.
 * @param {number} R
 * @returns {number}
 */
export function swingDiameterM(R) {
  const r = Number(R);
  return Number.isFinite(r) && r > 0 ? 2 * r : 0;
}

/**
 * Full scope computation for the selected ratio plus a comparison table at 3:1 / 5:1 / 7:1.
 * @param {Partial<typeof DEFAULT_CARD_STATE>} state
 * @returns {{ D: number, L: number, H: number, R: number, diameter: number, scope_ratio: number, valid: boolean, table: Array<{ ratio: number, L: number, H: number, R: number, diameter: number, valid: boolean }> }}
 */
export function computeScope(state = {}) {
  const merged = { ...DEFAULT_CARD_STATE, ...state };
  const D = effectiveDepthM(merged);
  const scope_ratio = Number(merged.scope_ratio) > 0 ? Number(merged.scope_ratio) : 5;
  const L = rodeLengthM(D, scope_ratio);
  const H = horizontalDistanceM(L, D);
  const R = swingRadiusM(H, merged.loa_m);
  const diameter = swingDiameterM(R);
  const valid = L > D;

  const table = TABLE_RATIOS.map((ratio) => {
    const tL = rodeLengthM(D, ratio);
    const tH = horizontalDistanceM(tL, D);
    const tR = swingRadiusM(tH, merged.loa_m);
    return {
      ratio,
      L: tL,
      H: tH,
      R: tR,
      diameter: swingDiameterM(tR),
      valid: tL > D,
    };
  });

  return { D, L, H, R, diameter, scope_ratio, valid, table };
}

export function metersToFeet(m) {
  const n = Number(m);
  return Number.isFinite(n) ? n * FT_PER_M : 0;
}

export function feetToMeters(ft) {
  const n = Number(ft);
  return Number.isFinite(n) ? n / FT_PER_M : 0;
}

/**
 * Format a length stored in metres for display in m or ft.
 * @param {number} m
 * @param {"m"|"ft"} unit
 * @returns {string}
 */
export function formatLength(m, unit = "m") {
  const n = Number(m);
  if (!Number.isFinite(n)) return "—";
  if (unit === "ft") {
    const ft = metersToFeet(n);
    return `${ft.toFixed(ft >= 100 ? 0 : 1)} ft`;
  }
  return `${n.toFixed(n >= 100 ? 0 : 1)} m`;
}

function localeCode(lang) {
  return LOCALES.includes(lang) ? lang : "en";
}

/**
 * FairHelm courses door for a locale.
 * @param {string} lang
 * @returns {string}
 */
export function fairhelmCoursesUrl(lang = "en") {
  return `https://fairhelm.com/${localeCode(lang)}/courses/`;
}

/**
 * FairHelm Free VHF simulator door for a locale.
 * @param {string} lang
 * @returns {string}
 */
export function fairhelmVhfUrl(lang = "en") {
  return `https://fairhelm.com/${localeCode(lang)}/free-vhf/`;
}

/**
 * GitHub Pages canonical URL for this tool.
 * @returns {string}
 */
export function pagesCanonicalUrl() {
  return "https://nareyko.github.io/anchor-scope-card/";
}

function numOrEmpty(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Serialize card state into a compact URL hash for bookmark / share (no server).
 * @param {Partial<typeof DEFAULT_CARD_STATE>} state
 * @param {string} [lang]
 * @returns {string}
 */
export function encodeCardHash(state, lang = "en") {
  const params = new URLSearchParams();
  if (lang && lang !== "en") params.set("lang", lang);
  if (state.vesselName != null) params.set("v", String(state.vesselName).trim());
  if (state.homeWaters != null) params.set("w", String(state.homeWaters).trim());
  if (state.depth_m != null) params.set("d", String(state.depth_m));
  if (state.tide_rise_m != null) params.set("t", String(state.tide_rise_m));
  if (state.bow_height_m != null) params.set("b", String(state.bow_height_m));
  if (state.loa_m != null) params.set("loa", String(state.loa_m));
  if (state.scope_ratio != null) params.set("s", String(state.scope_ratio));
  if (state.rode_kind != null) params.set("rode", String(state.rode_kind));
  if (state.unit != null && state.unit !== "m") params.set("u", String(state.unit));
  return `#${params.toString()}`;
}

/**
 * Parse a URL hash back into card state.
 * @param {string} hash
 * @returns {{ state: typeof DEFAULT_CARD_STATE, lang: string | null }}
 */
export function decodeCardHash(hash) {
  const raw = String(hash || "").replace(/^#/, "");
  const params = new URLSearchParams(raw);
  const hasAny =
    params.has("v") ||
    params.has("w") ||
    params.has("d") ||
    params.has("t") ||
    params.has("b") ||
    params.has("loa") ||
    params.has("s") ||
    params.has("rode") ||
    params.has("u");

  if (!hasAny) {
    return {
      state: { ...DEFAULT_CARD_STATE },
      lang: params.get("lang") || null,
    };
  }

  const rode = params.get("rode");
  const unit = params.get("u");
  const scope = numOrEmpty(params.get("s"));

  return {
    state: {
      vesselName: params.get("v") ?? "",
      homeWaters: params.get("w") ?? "",
      depth_m: numOrEmpty(params.get("d")) ?? 0,
      tide_rise_m: numOrEmpty(params.get("t")) ?? 0,
      bow_height_m: numOrEmpty(params.get("b")) ?? 0,
      loa_m: numOrEmpty(params.get("loa")) ?? 0,
      scope_ratio: scope != null && scope > 0 ? scope : 5,
      rode_kind: rode === "chain_rope" ? "chain_rope" : "all_chain",
      unit: unit === "ft" ? "ft" : "m",
    },
    lang: params.get("lang") || null,
  };
}
