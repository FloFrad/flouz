/* Relevé de compte PDF → opérations.
 * Tout se passe dans le téléphone : le fichier est lu en mémoire par pdf.js, jamais envoyé ni conservé.
 * On cherche le tableau dont l'en-tête contient DATE, LIBELLE, VALEUR, DEBIT et CREDIT, puis on range
 * chaque morceau de texte dans la colonne la plus proche (les montants sont souvent alignés à droite).
 */
(function (root) {
"use strict";

const COLS = ["date", "libelle", "valeur", "debit", "credit"];
const HEAD = { date: "DATE", libelle: "LIBELLE", valeur: "VALEUR", debit: "DEBIT", credit: "CREDIT" };
const MOIS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
const RE_DATE = /^(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{4}|\d{2}))?$/;
const RE_FULLDATE = /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})\b/g;
const RE_TXTDATE = /\b(?:(\d{1,2})(?:er)?\s+)?(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\s+(\d{4})\b/g;
const RE_AMOUNT = /^[+-]?(?:\d{1,3}(?:[\s.]\d{3})+|\d+),\d{2}$|^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2}$/;
const RE_STOP = /^(?:ancien |nouveau )?solde\b|^(?:sous[- ])?totaux?\b|^total\b|^report\b/i;

const fold = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
const clean = s => String(s ?? "").replace(/[   ]/g, " ");

function parseAmount(s) {
  const t = clean(s).replace(/€|eur(?:os?)?/gi, "").trim();
  if (!RE_AMOUNT.test(t)) return null;
  const comma = t.lastIndexOf(","), dot = t.lastIndexOf(".");
  const dec = comma > dot ? "," : ".";
  const n = parseFloat(t.replace(dec === "," ? /[\s.]/g : /[\s,]/g, "").replace(",", "."));
  return isFinite(n) ? Math.abs(n) : null;
}
const isDate = s => { const m = RE_DATE.exec(clean(s).trim()); return !!m && +m[1] >= 1 && +m[1] <= 31 && +m[2] >= 1 && +m[2] <= 12; };
// « 02.12 » est une date (les montants des relevés français ont une virgule)
const isAmount = s => parseAmount(s) != null && !(isDate(s) && /^\d{1,2}\.\d{2}$/.test(clean(s).trim()));

/* Morceaux de texte pdf.js → mots positionnés (x0, x1, y, fs = taille de police). */
function words(items) {
  const out = [];
  for (const it of items) {
    const str = clean(it.str);
    if (!str.trim() || !it.transform) continue;
    const [, , c, d, x, y] = it.transform;
    const fs = Math.hypot(c, d) || it.height || 10;
    const w = it.width || fs * 0.5 * str.length, cw = w / str.length;
    for (const m of str.matchAll(/\S+/g)) out.push({ s: m[0], x0: x + m.index * cw, x1: x + (m.index + m[0].length) * cw, y, fs });
  }
  return out;
}
/* Mots → lignes (de haut en bas), chaque ligne triée de gauche à droite. */
function rows(ws) {
  const sorted = [...ws].sort((a, b) => b.y - a.y || a.x0 - b.x0);
  const out = [];
  for (const w of sorted) {
    const r = out[out.length - 1];
    if (r && Math.abs(r.y - w.y) <= Math.max(r.fs, w.fs) * 0.45) { r.ws.push(w); r.fs = Math.max(r.fs, w.fs); }
    else out.push({ y: w.y, fs: w.fs, ws: [w] });
  }
  out.forEach(r => r.ws.sort((a, b) => a.x0 - b.x0));
  return out;
}
/* Mots proches (moins d'un demi-cadratin d'écart) → un seul bloc : « 1 234,56 », « CB CARREFOUR »… */
function chunks(r) {
  const out = [];
  for (const w of r.ws) {
    const c = out[out.length - 1];
    if (c && w.x0 - c.x1 <= Math.max(w.fs, 6) * 0.6) { c.ws.push(w); c.x1 = Math.max(c.x1, w.x1); c.s += " " + w.s; }
    else out.push({ s: w.s, x0: w.x0, x1: w.x1, ws: [w] });
  }
  return out;
}
/* Ligne d'en-tête du tableau : les cinq colonnes y figurent. */
function header(r) {
  const h = {};
  for (const w of r.ws) {
    const t = fold(w.s).toUpperCase().replace(/[^A-Z]/g, "");
    for (const k of COLS) if (!h[k] && t.startsWith(HEAD[k])) { h[k] = { x0: w.x0, x1: w.x1, cx: (w.x0 + w.x1) / 2 }; break; }
  }
  return COLS.every(k => h[k]) ? h : null;
}
// Distance d'un bloc à une colonne : alignement à gauche, au centre ou à droite, le meilleur des trois.
const dist = (c, h) => Math.min(Math.abs(c.x0 - h.x0), Math.abs(c.x1 - h.x1), Math.abs((c.x0 + c.x1) / 2 - h.cx));

/* Une ligne du tableau → cellules {date, libelle[], valeur, debit, credit}. */
function cells(r, h) {
  const out = { date: "", libelle: [], valeur: "", debit: null, credit: null };
  const amount = (s, c) => {
    const k = dist(c, h.debit) <= dist(c, h.credit) ? "debit" : "credit";
    if (out[k] == null) out[k] = parseAmount(s);
  };
  const dateCell = (s, c) => {
    const k = dist(c, h.date) <= dist(c, h.valeur) ? "date" : "valeur";
    if (!out[k]) out[k] = s; else if (!out.valeur) out.valeur = s;
  };
  const libEnd = h.valeur.x0 - (h.valeur.x1 - h.valeur.x0) * 0.4;
  for (const c of chunks(r)) {
    let ws = c.ws;
    // date collée au libellé (colonne étroite) : on la détache
    if (ws.length > 1 && isDate(ws[0].s) && c.x0 < h.libelle.x0 - 1) {
      dateCell(ws[0].s, { x0: ws[0].x0, x1: ws[0].x1 }); ws = ws.slice(1);
    }
    const s = ws.map(w => w.s).join(" "), part = { x0: ws[0].x0, x1: ws[ws.length - 1].x1 };
    if (isAmount(s) && part.x1 > libEnd) { amount(s, part); continue; }
    if (isDate(s) && (part.x0 < h.libelle.x0 - 1 || part.x0 > libEnd)) { dateCell(s, part); continue; }
    if (part.x0 >= libEnd) {
      // à droite du libellé : une date de valeur suivie d'un montant, collés
      let i = 0;
      if (isDate(ws[0].s)) { dateCell(ws[0].s, { x0: ws[0].x0, x1: ws[0].x1 }); i = 1; }
      const rest = ws.slice(i);
      if (rest.length && isAmount(rest.map(w => w.s).join(" "))) amount(rest.map(w => w.s).join(" "), { x0: rest[0].x0, x1: rest[rest.length - 1].x1 });
      continue;
    }
    out.libelle.push(s);
  }
  return out;
}

/* Date de référence du relevé, pour les dates sans année : la fin de la période (« du … au 30/09/2026 »),
 * sinon la plus récente date complète du document qui ne soit pas dans le futur. */
function refDate(lines, now) {
  const lim = (now || new Date()).getTime() + 31 * 864e5;
  let best = null, period = null;
  const seen = (y, m, d) => {
    if (y < 2000 || y > 2100 || m < 1 || m > 12 || new Date(y, m - 1, d || 1).getTime() > lim) return null;
    const v = y * 10000 + m * 100 + (d || 1), r = { v, y, m };
    if (!best || v > best.v) best = r;
    return r;
  };
  for (const l of lines) {
    const t = fold(l).toLowerCase();
    for (const m of t.matchAll(RE_FULLDATE)) seen(+m[3], +m[2], +m[1]);
    for (const m of t.matchAll(RE_TXTDATE)) seen(+m[3], MOIS.indexOf(m[2]) + 1, m[1] ? +m[1] : 0);
    const p = /\bau\s+(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})\b/.exec(t);
    if (p && !period) period = seen(+p[3], +p[2], +p[1]);
  }
  return period || best;
}
function toISO(s, ref) {
  const m = RE_DATE.exec(clean(s).trim()); if (!m) return null;
  const d = +m[1], mo = +m[2];
  let y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : ref.y - (mo > ref.m ? 1 : 0); // décembre sur un relevé de janvier → année précédente
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
// Libellé lisible, sans numéros de carte ni longues suites de chiffres.
function tidy(s) {
  return clean(s).replace(/(^|\s)(?:[X*]+\d{3,}|[X*]{2,}[\dX*]*\d+|\d+[X*]{3,}[\dX*]*)(?=\s|$)/gi, "$1").replace(/\b\d{9,}\b/g, "")
    .replace(/\s{2,}/g, " ").trim().slice(0, 90);
}

/* pages : [[item pdf.js…], …] → { ops: [{date, libelle, montant (signé : < 0 = débit)}], tables } */
function parse(pages, fallbackYear, now) {
  const allLines = [], parsed = [];
  pages.forEach(items => {
    const rs = rows(words(items));
    rs.forEach(r => allLines.push(r.ws.map(w => w.s).join(" ")));
    parsed.push(rs);
  });
  const ref = refDate(allLines, now) || { y: fallbackYear || new Date().getFullYear(), m: 12 };
  const ops = [];
  let h = null, tables = 0;
  for (const rs of parsed) {
    let cur = null, lastY = Infinity, inTable = !!h; // une page sans en-tête reprend les colonnes de la précédente
    const flush = () => {
      if (cur) {
        const lib = tidy(cur.libelle.join(" "));
        const montant = (cur.credit || 0) - (cur.debit || 0);
        const date = toISO(cur.date, ref);
        if (date && montant && !RE_STOP.test(lib)) ops.push({ date, libelle: lib || "Opération", montant: Math.round(montant * 100) / 100 });
      }
      cur = null;
    };
    for (const r of rs) {
      const hh = header(r);
      if (hh) { flush(); h = hh; tables++; inTable = true; lastY = r.y; continue; }
      if (!h || !inTable) continue;                    // pas encore d'en-tête sur cette page
      const c = cells(r, h);
      const lib = c.libelle.join(" ");
      const hasAmt = c.debit != null || c.credit != null;
      if (c.date && isDate(c.date)) {
        flush();
        cur = { date: c.date, libelle: [lib], debit: c.debit, credit: c.credit };
      } else if (cur && RE_STOP.test(fold(lib).trim())) {
        flush();
      } else if (cur && r.y >= lastY - r.fs * 2.6 && lib && !hasAmt) {
        cur.libelle.push(lib);                         // libellé sur plusieurs lignes
      } else if (cur && hasAmt && cur.debit == null && cur.credit == null && r.y >= lastY - r.fs * 2.6) {
        cur.libelle.push(lib); cur.debit = c.debit; cur.credit = c.credit; // montant sur la 2e ligne
      } else if (cur) {
        flush();
      }
      lastY = r.y;
    }
    flush();
  }
  return { ops, tables, ref };
}

let lib = null;
async function loadPdfJs(base) {
  if (!lib) {
    lib = await import(new URL("vendor/pdfjs/pdf.min.mjs", base).href);
    lib.GlobalWorkerOptions.workerSrc = new URL("vendor/pdfjs/pdf.worker.min.mjs", base).href;
  }
  return lib;
}
/* Fichier PDF → texte positionné de chaque page. Les octets ne sont gardés que le temps de la lecture. */
async function extract(data, base) {
  const pdfjs = await loadPdfJs(base);
  const task = pdfjs.getDocument({ data, verbosity: 0, isEvalSupported: false, disableFontFace: true, useSystemFonts: false, stopAtErrors: false });
  const doc = await task.promise;
  try {
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      pages.push(tc.items);
      page.cleanup();
    }
    return pages;
  } finally { await doc.destroy(); }
}

const api = { parse, extract, parseAmount, isDate, tidy };
root.RelevePDF = api;
if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
