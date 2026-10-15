import {
  DEFAULT_CARD_STATE,
  computeScope,
  decodeCardHash,
  encodeCardHash,
  fairhelmCoursesUrl,
  fairhelmVhfUrl,
  feetToMeters,
  formatLength,
  metersToFeet,
  pagesCanonicalUrl,
} from "./scope-model.mjs";
import { renderQrSvg } from "./qr-svg.mjs";
import { copyFor, LOCALES } from "./ui-copy.mjs";

const STORAGE_KEY = "fairhelm_anchor_scope_card_v1";

const PRESETS = {
  nordic: {
    vesselName: "SY AURORA",
    homeWaters: "Stockholm Archipelago",
    depth_m: 8,
    tide_rise_m: 0.3,
    bow_height_m: 1.5,
    loa_m: 12.2,
    scope_ratio: 5,
    rode_kind: "all_chain",
    unit: "m",
  },
  med: {
    vesselName: "SY CALYPSO",
    homeWaters: "Balearic Islands",
    depth_m: 5,
    tide_rise_m: 0.2,
    bow_height_m: 1.4,
    loa_m: 13.7,
    scope_ratio: 5,
    rode_kind: "chain_rope",
    unit: "m",
  },
  storm: {
    vesselName: "SY STORMBOUND",
    homeWaters: "North Sea approaches",
    depth_m: 10,
    tide_rise_m: 2.5,
    bow_height_m: 1.8,
    loa_m: 12.5,
    scope_ratio: 7,
    rode_kind: "all_chain",
    unit: "m",
  },
  blank: {
    vesselName: "",
    homeWaters: "",
    depth_m: 0,
    tide_rise_m: 0,
    bow_height_m: 0,
    loa_m: 0,
    scope_ratio: 5,
    rode_kind: "all_chain",
    unit: "m",
  },
};

function detectInitialLang() {
  const params = new URLSearchParams(window.location.search);
  const queryLang = params.get("lang");
  if (queryLang && LOCALES.includes(queryLang)) return queryLang;

  const hashDecoded = decodeCardHash(window.location.hash);
  if (hashDecoded.lang && LOCALES.includes(hashDecoded.lang)) return hashDecoded.lang;

  const navLang = (navigator.language || "en").slice(0, 2).toLowerCase();
  return LOCALES.includes(navLang) ? navLang : "en";
}

function loadInitialState() {
  if (window.location.hash && window.location.hash.length > 2) {
    const { state } = decodeCardHash(window.location.hash);
    return state;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_CARD_STATE, ...parsed };
    }
  } catch {
    // Ignore storage errors in private/sandboxed frames
  }
  return { ...DEFAULT_CARD_STATE };
}

let currentLang = detectInitialLang();
let state = loadInitialState();
/** Unit currently shown in numeric inputs (may lag select until sync). */
let fieldsUnit = state.unit === "ft" ? "ft" : "m";

const el = (id) => document.getElementById(id);

function setText(id, text) {
  const node = el(id);
  if (node) node.textContent = text;
}

function displayToMeters(value, unit) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return unit === "ft" ? feetToMeters(n) : n;
}

function metersToDisplay(m, unit) {
  const n = Number(m);
  if (!Number.isFinite(n)) return "";
  const v = unit === "ft" ? metersToFeet(n) : n;
  return String(Math.round(v * 10) / 10);
}

function syncScopeSelect() {
  const ratio = Number(state.scope_ratio);
  const select = el("in-scope");
  const customWrap = el("custom-scope-wrap");
  if ([3, 5, 7].includes(ratio)) {
    select.value = String(ratio);
    customWrap.hidden = true;
  } else {
    select.value = "custom";
    customWrap.hidden = false;
    el("in-scope-custom").value = String(ratio || 4);
  }
}

function syncInputsFromState() {
  const unit = state.unit === "ft" ? "ft" : "m";
  fieldsUnit = unit;
  el("in-vessel").value = state.vesselName;
  el("in-waters").value = state.homeWaters;
  el("in-depth").value = metersToDisplay(state.depth_m, unit);
  el("in-tide").value = metersToDisplay(state.tide_rise_m, unit);
  el("in-bow").value = metersToDisplay(state.bow_height_m, unit);
  el("in-loa").value = metersToDisplay(state.loa_m, unit);
  el("in-rode").value = state.rode_kind === "chain_rope" ? "chain_rope" : "all_chain";
  el("in-unit").value = unit;
  syncScopeSelect();
}

function readScopeRatioFromInputs() {
  if (el("in-scope").value === "custom") {
    const custom = Number(el("in-scope-custom").value);
    return custom > 1 ? custom : 5;
  }
  return Number(el("in-scope").value) || 5;
}

function persistState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

function readStateFromInputs() {
  // Convert using fieldsUnit (what the inputs currently show), not the select
  // which may already have flipped on a unit-change input event.
  state = {
    vesselName: el("in-vessel").value,
    homeWaters: el("in-waters").value,
    depth_m: displayToMeters(el("in-depth").value, fieldsUnit),
    tide_rise_m: displayToMeters(el("in-tide").value, fieldsUnit),
    bow_height_m: displayToMeters(el("in-bow").value, fieldsUnit),
    loa_m: displayToMeters(el("in-loa").value, fieldsUnit),
    scope_ratio: readScopeRatioFromInputs(),
    rode_kind: el("in-rode").value === "chain_rope" ? "chain_rope" : "all_chain",
    unit: el("in-unit").value === "ft" ? "ft" : "m",
  };
  persistState();
}

function renderLocaleCopy() {
  const copy = copyFor(currentLang);
  document.documentElement.lang = currentLang;
  document.documentElement.dir = copy.dir;

  const canonical = el("canonical-link");
  if (canonical) canonical.href = pagesCanonicalUrl();

  setText("ui-kicker", copy.kicker);
  setText("ui-title", copy.title);
  setText("ui-lede", copy.lede);
  setText("ui-privacy", copy.privacyNote);
  setText("ui-form-heading", copy.formHeading);
  setText("ui-presets-label", `${copy.presetsLabel}:`);

  setText("lbl-vessel", copy.vesselNameLabel);
  el("in-vessel").placeholder = copy.vesselNamePlaceholder;
  setText("lbl-waters", copy.homeWatersLabel);
  el("in-waters").placeholder = copy.homeWatersPlaceholder;
  setText("lbl-depth", copy.depthLabel);
  setText("lbl-tide", copy.tideLabel);
  setText("lbl-bow", copy.bowLabel);
  setText("lbl-loa", copy.loaLabel);
  setText("lbl-scope", copy.scopeLabel);
  setText("lbl-rode", copy.rodeLabel);
  setText("opt-rode-chain", copy.rodeAllChain);
  setText("opt-rode-rope", copy.rodeChainRope);
  setText("lbl-unit", copy.unitLabel);
  setText("opt-unit-m", copy.unitMeters);
  setText("opt-unit-ft", copy.unitFeet);

  setText("btn-print", copy.printBtn);
  setText("btn-print-bottom", copy.printBtn);
  setText("btn-night", copy.nightBtn);
  setText("btn-nordic", "Nordic 8 m");
  setText("btn-med", "Med 5 m");
  setText("btn-storm", "Storm 7:1");
  setText("btn-blank", copy.clearBtn);
  setText("btn-copy-link", copy.copyLinkBtn);

  setText("sheet-header-left", copy.sheetHeaderLeft);
  setText("sheet-header-right", copy.sheetHeaderRight);
  setText("lbl-id-vessel", copy.idVessel);
  setText("lbl-id-waters", copy.idWaters);
  setText("lbl-big-scope", copy.bigScope);
  setText("lbl-big-rode", copy.bigRode);
  setText("lbl-big-swing", copy.bigSwing);
  setText("lbl-big-diameter", copy.bigDiameter);
  setText("out-table-title", copy.tableTitle);
  setText("out-checklist-title", copy.checklistTitle);
  setText("out-guidance-title", copy.guidanceTitle);
  setText("out-guidance-body", copy.guidanceBody);
  setText("out-qr-title", copy.qrCtaTitle);
  setText("out-qr-body", copy.qrCtaBody);
  setText("out-fairhelm-credit", copy.fairhelmCredit);
  setText("out-invalid", copy.invalidScopeNote);

  const checklist = el("out-checklist");
  if (checklist) {
    checklist.innerHTML = "";
    for (const item of copy.checklistItems) {
      const li = document.createElement("li");
      li.textContent = item;
      checklist.appendChild(li);
    }
  }

  const coursesUrl = fairhelmCoursesUrl(currentLang);
  const vhfUrl = fairhelmVhfUrl(currentLang);

  const creditCourses = el("credit-courses");
  if (creditCourses) {
    creditCourses.href = coursesUrl;
    creditCourses.textContent = `${copy.coursesLinkLabel} ↗`;
  }
  const creditVhf = el("credit-vhf");
  if (creditVhf) {
    creditVhf.href = vhfUrl;
    creditVhf.textContent = `${copy.vhfLinkLabel} ↗`;
  }

  const sheetCourses = el("sheet-courses-link");
  if (sheetCourses) {
    sheetCourses.href = coursesUrl;
    sheetCourses.textContent = coursesUrl.replace(/^https?:\/\//, "");
  }
  const sheetVhf = el("sheet-vhf-link");
  if (sheetVhf) {
    sheetVhf.href = vhfUrl;
    sheetVhf.textContent = vhfUrl.replace(/^https?:\/\//, "");
  }

  const qrContainer = el("qr-container");
  if (qrContainer) {
    qrContainer.innerHTML = renderQrSvg(coursesUrl, {
      label: `QR Code: ${coursesUrl}`,
    });
  }
}

function renderSheetValues() {
  const copy = copyFor(currentLang);
  const unit = state.unit === "ft" ? "ft" : "m";
  const result = computeScope(state);

  const vesselDisplay = state.vesselName.trim().toUpperCase() || "_______________";
  const watersDisplay = state.homeWaters.trim() || "_______________";
  const rodeLabel = state.rode_kind === "chain_rope" ? copy.rodeChainRope : copy.rodeAllChain;

  setText("out-vessel-name", vesselDisplay);
  setText("out-waters", watersDisplay);
  setText("out-waters-badge", watersDisplay.toUpperCase());
  setText("out-rode-kind", rodeLabel);
  setText("out-d-value", `D ${formatLength(result.D, unit)}`);
  setText("out-d-line", `D = ${formatLength(result.D, unit)}`);
  setText("out-scope", `${result.scope_ratio}:1`);
  setText("out-rode", formatLength(result.L, unit));
  setText("out-swing", formatLength(result.R, unit));
  setText("out-diameter", formatLength(result.diameter, unit));

  const invalid = el("out-invalid");
  if (invalid) {
    invalid.hidden = result.valid || result.D <= 0;
  }

  const hint = el("hint-scope-status");
  if (hint) {
    if (result.D > 0 && !result.valid) {
      hint.className = "field-hint invalid";
      hint.textContent = copy.invalidScopeNote;
    } else {
      hint.className = "field-hint";
      hint.textContent = result.D > 0 ? `D ${formatLength(result.D, unit)} · L ${formatLength(result.L, unit)}` : "";
    }
  }

  const tbody = el("scope-table-body");
  if (tbody) {
    tbody.innerHTML = "";
    for (const row of result.table) {
      const tr = document.createElement("tr");
      if (row.ratio === result.scope_ratio) tr.classList.add("is-selected");
      tr.innerHTML = `
        <td>${row.ratio}:1</td>
        <td>${formatLength(row.L, unit)}</td>
        <td>${formatLength(row.H, unit)}</td>
        <td>${formatLength(row.R, unit)}</td>
        <td>${formatLength(row.diameter, unit)}</td>
      `;
      tbody.appendChild(tr);
    }
  }
}

function applyPreset(key) {
  state = { ...PRESETS[key] };
  syncInputsFromState();
  readStateFromInputs();
  renderSheetValues();
}

function init() {
  const langSelect = el("lang-select");
  if (langSelect) {
    langSelect.value = currentLang;
    langSelect.addEventListener("change", () => {
      currentLang = langSelect.value;
      renderLocaleCopy();
      renderSheetValues();
    });
  }

  syncInputsFromState();
  renderLocaleCopy();
  renderSheetValues();

  const form = el("card-form");
  form.addEventListener("input", (event) => {
    const customWrap = el("custom-scope-wrap");
    customWrap.hidden = el("in-scope").value !== "custom";

    if (event.target && event.target.id === "in-unit") {
      // Keep metre values; only re-label the numeric fields.
      state.unit = el("in-unit").value === "ft" ? "ft" : "m";
      syncInputsFromState();
      persistState();
      renderSheetValues();
      return;
    }

    readStateFromInputs();
    renderSheetValues();
  });

  el("btn-nordic").addEventListener("click", () => applyPreset("nordic"));
  el("btn-med").addEventListener("click", () => applyPreset("med"));
  el("btn-storm").addEventListener("click", () => applyPreset("storm"));
  el("btn-blank").addEventListener("click", () => applyPreset("blank"));

  const triggerPrint = () => window.print();
  el("btn-print").addEventListener("click", triggerPrint);
  el("btn-print-bottom").addEventListener("click", triggerPrint);

  const nightBtn = el("btn-night");
  nightBtn.addEventListener("click", () => {
    const active = document.body.classList.toggle("night-mode");
    nightBtn.setAttribute("aria-pressed", active ? "true" : "false");
  });

  el("btn-copy-link").addEventListener("click", async () => {
    const hash = encodeCardHash(state, currentLang);
    const shareUrl = `${window.location.origin}${window.location.pathname}${hash}`;
    window.history.replaceState(null, "", hash);
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // Fallback: URL bar is already updated with hash
    }
    const status = el("copy-status");
    if (status) {
      status.textContent = copyFor(currentLang).linkCopied;
      status.hidden = false;
      setTimeout(() => {
        status.hidden = true;
      }, 3000);
    }
  });
}

init();
