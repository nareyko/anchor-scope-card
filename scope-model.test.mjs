import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_CARD_STATE,
  LOCALES as MODEL_LOCALES,
  computeScope,
  decodeCardHash,
  encodeCardHash,
  effectiveDepthM,
  fairhelmCoursesUrl,
  fairhelmVhfUrl,
  feetToMeters,
  formatLength,
  horizontalDistanceM,
  metersToFeet,
  pagesCanonicalUrl,
  rodeLengthM,
  swingDiameterM,
  swingRadiusM,
} from "./scope-model.mjs";
import { renderQrSvg } from "./qr-svg.mjs";
import { copyFor, LOCALES } from "./ui-copy.mjs";

test("effectiveDepthM sums charted depth, tide rise, and bow height (D)", () => {
  assert.equal(effectiveDepthM({ depth_m: 8, tide_rise_m: 0.3, bow_height_m: 1.5 }), 9.8);
  assert.equal(effectiveDepthM({ depth_m: 5, tide_rise_m: 0, bow_height_m: 1 }), 6);
  assert.equal(effectiveDepthM({ depth_m: 0, tide_rise_m: 0, bow_height_m: 0 }), 0);
});

test("rodeLengthM applies scope ratio L = S × D", () => {
  assert.equal(rodeLengthM(9.8, 5), 49);
  assert.equal(rodeLengthM(6, 3), 18);
  assert.equal(rodeLengthM(6, 7), 42);
  assert.equal(rodeLengthM(0, 5), 0);
});

test("horizontalDistanceM returns H = √(L²−D²) and edges to 0 when L ≤ D", () => {
  const H = horizontalDistanceM(49, 9.8);
  assert.ok(Math.abs(H - Math.sqrt(49 * 49 - 9.8 * 9.8)) < 1e-9);
  assert.equal(horizontalDistanceM(9.8, 9.8), 0);
  assert.equal(horizontalDistanceM(5, 10), 0);
  assert.equal(horizontalDistanceM(0, 5), 0);
});

test("swingRadiusM and swingDiameterM add LOA and double radius", () => {
  const H = horizontalDistanceM(49, 9.8);
  const R = swingRadiusM(H, 12.2);
  assert.ok(Math.abs(R - (H + 12.2)) < 1e-9);
  assert.equal(swingDiameterM(R), 2 * R);
  assert.equal(swingDiameterM(0), 0);
});

test("computeScope returns selected numbers plus 3/5/7 comparison table", () => {
  const result = computeScope({
    depth_m: 8,
    tide_rise_m: 0.3,
    bow_height_m: 1.5,
    loa_m: 12.2,
    scope_ratio: 5,
  });
  assert.equal(result.D, 9.8);
  assert.equal(result.L, 49);
  assert.equal(result.valid, true);
  assert.equal(result.scope_ratio, 5);
  assert.equal(result.table.length, 3);
  assert.deepEqual(
    result.table.map((row) => row.ratio),
    [3, 5, 7],
  );
  assert.ok(Math.abs(result.table[0].L - 29.4) < 1e-9);
  assert.equal(result.table[1].L, 49);
  assert.ok(Math.abs(result.table[2].L - 68.6) < 1e-9);
  assert.ok(result.table.every((row) => row.valid === true));
});

test("metersToFeet, feetToMeters, and formatLength convert display units", () => {
  assert.ok(Math.abs(metersToFeet(1) - 3.280839895) < 1e-9);
  assert.ok(Math.abs(feetToMeters(3.280839895) - 1) < 1e-9);
  assert.equal(formatLength(49, "m"), "49.0 m");
  assert.ok(formatLength(49, "ft").endsWith(" ft"));
  assert.equal(formatLength(NaN, "m"), "—");
});

test("encodeCardHash and decodeCardHash round-trip vessel and scope state", () => {
  const custom = {
    ...DEFAULT_CARD_STATE,
    vesselName: "SY BALTIC WIND",
    homeWaters: "Kiel Bight",
    depth_m: 6.5,
    tide_rise_m: 1.2,
    bow_height_m: 1.8,
    loa_m: 11.5,
    scope_ratio: 7,
    rode_kind: "chain_rope",
    unit: "ft",
  };
  const hash = encodeCardHash(custom, "de");
  const decoded = decodeCardHash(hash);
  assert.equal(decoded.lang, "de");
  assert.equal(decoded.state.vesselName, "SY BALTIC WIND");
  assert.equal(decoded.state.homeWaters, "Kiel Bight");
  assert.equal(decoded.state.depth_m, 6.5);
  assert.equal(decoded.state.tide_rise_m, 1.2);
  assert.equal(decoded.state.bow_height_m, 1.8);
  assert.equal(decoded.state.loa_m, 11.5);
  assert.equal(decoded.state.scope_ratio, 7);
  assert.equal(decoded.state.rode_kind, "chain_rope");
  assert.equal(decoded.state.unit, "ft");
});

test("FairHelm courses/VHF URLs exist for all 10 locales; Pages canonical is fixed", () => {
  assert.equal(MODEL_LOCALES.length, 10);
  assert.equal(LOCALES.length, 10);
  for (const lang of LOCALES) {
    assert.equal(fairhelmCoursesUrl(lang), `https://fairhelm.com/${lang}/courses/`);
    assert.equal(fairhelmVhfUrl(lang), `https://fairhelm.com/${lang}/free-vhf/`);
  }
  assert.equal(pagesCanonicalUrl(), "https://nareyko.github.io/anchor-scope-card/");
  assert.equal(fairhelmCoursesUrl("xx"), "https://fairhelm.com/en/courses/");
});

test("ui-copy provides complete translations for all 10 FairHelm locales", () => {
  const required = [
    "dir",
    "langName",
    "title",
    "kicker",
    "lede",
    "privacyNote",
    "formHeading",
    "vesselNameLabel",
    "vesselNamePlaceholder",
    "homeWatersLabel",
    "homeWatersPlaceholder",
    "depthLabel",
    "tideLabel",
    "bowLabel",
    "loaLabel",
    "scopeLabel",
    "rodeLabel",
    "rodeAllChain",
    "rodeChainRope",
    "unitLabel",
    "unitMeters",
    "unitFeet",
    "printBtn",
    "nightBtn",
    "resetBtn",
    "clearBtn",
    "copyLinkBtn",
    "linkCopied",
    "presetsLabel",
    "sheetHeaderLeft",
    "sheetHeaderRight",
    "idVessel",
    "idWaters",
    "bigScope",
    "bigRode",
    "bigSwing",
    "bigDiameter",
    "tableTitle",
    "checklistTitle",
    "guidanceTitle",
    "guidanceBody",
    "qrCtaTitle",
    "qrCtaBody",
    "fairhelmCredit",
    "coursesLinkLabel",
    "vhfLinkLabel",
    "invalidScopeNote",
  ];
  for (const lang of LOCALES) {
    const pack = copyFor(lang);
    for (const key of required) {
      assert.ok(pack[key] != null && String(pack[key]).length > 0, `missing ${key} for ${lang}`);
    }
    assert.ok(Array.isArray(pack.checklistItems), `checklistItems not array for ${lang}`);
    assert.equal(pack.checklistItems.length, 5, `checklistItems length for ${lang}`);
    assert.ok(pack.title.length > 5, `short title for ${lang}`);
    assert.ok(
      pack.qrCtaBody.includes(`fairhelm.com/${lang}/courses/`),
      `QR CTA courses URL mismatch for ${lang}`,
    );
  }
});

test("renderQrSvg produces non-empty SVG for FairHelm courses URL", () => {
  const url = fairhelmCoursesUrl("en");
  const svg = renderQrSvg(url, { label: url });
  assert.ok(svg.startsWith("<svg"));
  assert.ok(svg.length > 200);
  assert.ok(svg.includes('shape-rendering="crispEdges"'));
  assert.ok(svg.endsWith("</svg>"));
});
