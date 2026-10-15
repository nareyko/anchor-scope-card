# Anchor Scope / Chain Length Cockpit Card (A4 Lamination)

Open-source, zero-dependency, 100% client-side generator for an **A4 yacht anchor scope card**: effective depth, rode length, horizontal reach, swing radius, and swing diameter — ready to print, laminate, and mount by the windlass.

- **GitHub Pages:** [**nareyko.github.io/anchor-scope-card/**](https://nareyko.github.io/anchor-scope-card/)
- **FairHelm Courses:** [**fairhelm.com/en/courses/**](https://fairhelm.com/en/courses/)
- **Free VHF & DSC Simulator:** [**fairhelm.com/en/free-vhf/**](https://fairhelm.com/en/free-vhf/)

---

## FairHelm Open-Source Seamanship Suite

Sister tools:

- [**mayday-card**](https://github.com/nareyko/mayday-card) — ITU / GMDSS MAYDAY · PAN-PAN · DSC distress cockpit card
- [**sea-lights**](https://github.com/nareyko/sea-lights) — interactive OpenSeaMap / Shom light sectors chart

**Phase B:** FairHelm site embed of this card is planned later; this repo ships as a standalone GitHub Pages app first.

---

## What It Computes

Given charted depth, expected tide rise, bow-roller height, LOA, and scope ratio \(S\):

| Symbol | Formula | Meaning |
|--------|---------|---------|
| **D** | depth + tide rise + bow height | Effective depth for scope |
| **L** | \(S \times D\) | Required rode length |
| **H** | \(\sqrt{L^2 - D^2}\) (0 if \(L \le D\)) | Horizontal distance bow → anchor |
| **R** | \(H + \mathrm{LOA}\) | Conservative swing radius |
| **Ø** | \(2R\) | Swing circle diameter |

Rule-of-thumb guidance on the card: calm all-chain ≈ **3:1**, coastal overnight ≈ **5:1**, heavy weather / poor holding ≈ **7:1**.

Privacy: pure ES modules (`scope-model.mjs`, `qr-svg.mjs`, `ui-copy.mjs`). No vessel data leaves the browser. Shareable state uses a URL hash + optional `localStorage` key `fairhelm_anchor_scope_card_v1`.

---

## Running Locally & Tests

No build step or npm dependencies required:

```bash
# Unit tests (Node.js 20+ built-in test runner)
npm test
# or: node --test scope-model.test.mjs

# Serve locally with any static HTTP server
python3 -m http.server 8080
```

Then open `http://localhost:8080/`.

## License

MIT © [FairHelm](https://fairhelm.com)
