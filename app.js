/* Budget familial — PWA synchronisée (Supabase)
 * Modèle : chaque élément du budget est une ligne « item » {id, kind, data, deleted}.
 * Écritures locales immédiates + file d'envoi (hors ligne OK), synchro temps réel.
 */
(() => {
"use strict";

/* ====================== Constantes ====================== */
const MOIS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const MC = ["Janv.","Févr.","Mars","Avr.","Mai","Juin","Juil.","Août","Sept.","Oct.","Nov.","Déc."];
const CATS = ["Prêts","Assurances","Énergie","Télécom","Enfants","Abonnements","Impôts","Transport","Autre"];
const TYPES = ["Salaire","Prime","Remboursement","Aide","Autre"];
const KINDS = ["settings","livret","revenu","charge","provision","enveloppe","depense"];
const CFG = window.BUDGET_CONFIG || {};
const CONFIGURED = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && !/VOTRE/.test(CFG.supabaseUrl + CFG.supabaseAnonKey));

const fmt = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const fmt2 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const eur = v => fmt.format(Math.round(v || 0));
const eur2 = v => Number.isInteger(num(v)) ? eur(v) : fmt2.format(num(v));
const num = v => { const n = parseFloat(String(v ?? "").replace(/\s/g, "").replace(",", ".")); return isFinite(n) ? n : 0; };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/-/g, "").slice(0, 16);
const $ = s => document.querySelector(s);
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} }
};

const ICON = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  env: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  budget: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  piggy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 11a7 6 0 0 1 13.5-2H20v4l-2 1v3h-3v-2H9v2H6v-3.5A6 6 0 0 1 5 11z"/><circle cx="15" cy="10.5" r=".8" fill="currentColor"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  chev: '<svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 6 6 6-6 6"/></svg>'
};

/* ====================== État ====================== */
const sb = CONFIGURED && window.supabase ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "bf-auth" },
  realtime: { params: { eventsPerSecond: 5 } }
}) : null;

const app = {
  mode: LS.get("bf:mode", CONFIGURED ? "cloud" : null), // "cloud" | "demo" | null
  screen: "loading",          // loading | welcome | login | code | household | app
  user: null,                 // {id, email}
  hid: null, household: null, members: [], myName: "",
  items: new Map(), outbox: new Map(), cursor: null,
  tab: LS.get("bf:tab", "home"), seg: LS.get("bf:seg", "revenu"),
  month: new Date().getMonth() + 1,
  sync: "ok", channel: null, flushing: false, seq: 0,
  email: LS.get("bf:email", ""), authErr: "", busy: false
};

/* ====================== Stockage local ====================== */
const key = k => `bf:${app.hid}:${k}`;
let saveT = null;
function saveLocal() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    if (!app.hid) return;
    LS.set(key("items"), [...app.items.values()]);
    LS.set(key("outbox"), [...app.outbox.values()]);
    LS.set(key("cursor"), app.cursor);
  }, 150);
}
function loadLocal() {
  app.items = new Map((LS.get(key("items"), []) || []).map(r => [r.id, r]));
  app.outbox = new Map((LS.get(key("outbox"), []) || []).map(r => [r.id, r]));
  app.cursor = LS.get(key("cursor"), null);
}

/* ====================== Synchro ====================== */
function put(kind, id, data, deleted = false) {
  const row = { id, kind, data, deleted, seq: ++app.seq };
  const prev = app.items.get(id);
  app.items.set(id, { id, kind, data, deleted, updated_at: prev?.updated_at || null });
  if (app.mode === "cloud") app.outbox.set(id, row);
  saveLocal();
  scheduleRender();
  if (app.mode === "cloud") queueFlush();
}
const del = (kind, id) => { const it = app.items.get(id); put(kind, id, it ? it.data : {}, true); };

let flushT = null;
function queueFlush() { clearTimeout(flushT); flushT = setTimeout(flush, 400); }
async function flush() {
  if (app.mode !== "cloud" || !sb || !app.hid || app.flushing || !app.outbox.size) { updateSync(); return; }
  if (!navigator.onLine) { updateSync(); return; }
  app.flushing = true; updateSync();
  const batch = [...app.outbox.values()].slice(0, 200);
  try {
    const { data, error } = await sb.from("items")
      .upsert(batch.map(r => ({ household_id: app.hid, id: r.id, kind: r.kind, data: r.data, deleted: r.deleted })), { onConflict: "household_id,id" })
      .select("id,kind,data,deleted,updated_at");
    if (error) throw error;
    for (const sent of batch) {
      const cur = app.outbox.get(sent.id);
      if (cur && cur.seq === sent.seq) app.outbox.delete(sent.id);
    }
    (data || []).forEach(r => applyRemote(r, true));
    app.sync = "ok";
  } catch (e) {
    console.warn("flush", e);
    app.sync = "err";
  } finally {
    app.flushing = false; saveLocal(); updateSync();
    if (app.outbox.size && app.sync !== "err") queueFlush();
    else if (app.sync === "err") setTimeout(queueFlush, 8000);
  }
}
function applyRemote(r, fromFlush) {
  if (!r || !r.id) return;
  if (!fromFlush && app.outbox.has(r.id)) return; // modif locale en attente : elle gagne
  if (fromFlush && app.outbox.has(r.id)) { /* nouvelle modif locale depuis l'envoi */ }
  else app.items.set(r.id, { id: r.id, kind: r.kind, data: r.data || {}, deleted: !!r.deleted, updated_at: r.updated_at });
  if (r.updated_at && (!app.cursor || r.updated_at > app.cursor)) app.cursor = r.updated_at;
  saveLocal(); scheduleRender();
}
async function pull() {
  if (app.mode !== "cloud" || !sb || !app.hid || !navigator.onLine) return;
  try {
    let more = true;
    while (more) {
      let q = sb.from("items").select("id,kind,data,deleted,updated_at").eq("household_id", app.hid).order("updated_at", { ascending: true }).limit(1000);
      if (app.cursor) q = q.gte("updated_at", app.cursor);
      const { data, error } = await q;
      if (error) throw error;
      const before = app.cursor;
      (data || []).forEach(r => applyRemote(r, false));
      more = data && data.length === 1000 && app.cursor !== before;
    }
    if (app.sync === "err") app.sync = "ok";
  } catch (e) { console.warn("pull", e); app.sync = "err"; }
  updateSync();
}
function subscribe() {
  if (app.mode !== "cloud" || !sb || !app.hid) return;
  if (app.channel) { sb.removeChannel(app.channel); app.channel = null; }
  app.channel = sb.channel("items-" + app.hid)
    .on("postgres_changes", { event: "*", schema: "public", table: "items", filter: "household_id=eq." + app.hid },
      p => applyRemote(p.new, false))
    .subscribe(status => { if (status === "SUBSCRIBED") pull(); });
}
async function resync() { await flush(); await pull(); if (app.channel && app.channel.state !== "joined") subscribe(); }
window.addEventListener("online", resync);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") resync(); });

function updateSync() {
  const el = $("#sync"); if (!el) return;
  const [cls, txt] = syncLabel();
  el.className = "sync " + cls; el.lastElementChild.textContent = txt;
}
function syncLabel() {
  if (app.mode === "demo") return ["off", "Démo locale"];
  const n = app.outbox.size;
  if (!navigator.onLine) return ["off", n ? `Hors ligne · ${n} en attente` : "Hors ligne"];
  if (app.sync === "err") return ["err", n ? `Non envoyé · ${n}` : "Erreur de synchro"];
  if (n || app.flushing) return ["wait", "Envoi…"];
  return ["ok", "Synchronisé"];
}

/* ====================== Modèle dérivé ====================== */
function state() {
  const by = k => [...app.items.values()].filter(i => i.kind === k && !i.deleted).map(i => ({ id: i.id, ...i.data }))
    .sort((a, b) => (a.ordre || 0) - (b.ordre || 0) || String(a.libelle || a.nom || "").localeCompare(String(b.libelle || b.nom || "")));
  const st = app.items.get("settings");
  const s = Object.assign({ annee: new Date().getFullYear(), personnes: ["Personne 1", "Personne 2"], repartition: "prorata", epargneCommune: 0, exemple: false },
    st && !st.deleted ? st.data : {});
  if (!Array.isArray(s.personnes) || s.personnes.length < 2) s.personnes = ["Personne 1", "Personne 2"];
  return { ...s, livrets: by("livret"), revenus: by("revenu"), charges: by("charge"), provisions: by("provision"), enveloppes: by("enveloppe"),
    depenses: by("depense").sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))) };
}
const setSettings = patch => { const S = state(); const cur = { annee: S.annee, personnes: S.personnes, repartition: S.repartition, epargneCommune: S.epargneCommune, exemple: S.exemple }; put("settings", "settings", { ...cur, ...patch }); };

function reel(S, envId, m) { return S.depenses.filter(d => d.enveloppe === envId && Number(d.annee) === Number(S.annee) && Number(d.mois) === m).reduce((a, d) => a + num(d.montant), 0); }
function revMonth(r, m) { return r.frequence === "Mensuel" ? num(r.montant) : (Number(r.mois) === m ? num(r.montant) : 0); }
function calc(S, m) {
  const revenus = S.revenus.reduce((a, r) => a + revMonth(r, m), 0);
  const revReg = S.revenus.filter(r => r.frequence === "Mensuel").reduce((a, r) => a + num(r.montant), 0);
  const charges = S.charges.reduce((a, c) => a + num(c.montant), 0);
  const provisions = S.provisions.reduce((a, p) => a + num(p.montant) / 12, 0);
  const envPrevu = S.enveloppes.reduce((a, e) => a + num(e.prevu), 0);
  const envReel = S.enveloppes.reduce((a, e) => a + reel(S, e.id, m), 0);
  const rav = revenus - charges - provisions;
  const epargne = rav - Math.max(envPrevu, envReel);
  return { revenus, revReg, charges, provisions, envPrevu, envReel, rav, epargne, resteEnv: envPrevu - envReel };
}
function livretStats(S, l) {
  const mens = S.provisions.filter(p => p.livret === l.id).reduce((a, p) => a + num(p.montant) / 12, 0);
  const soldes = []; let s = num(l.solde);
  for (let m = 1; m <= 12; m++) { s += mens; s -= S.provisions.filter(p => p.livret === l.id && Number(p.mois) === m).reduce((a, p) => a + num(p.montant), 0); soldes.push(s); }
  const bas = Math.min(...soldes);
  return { mens, soldes, bas, moisBas: soldes.indexOf(bas) + 1 };
}
function joint(S) {
  const ch = S.charges.filter(c => c.compte === "Joint").reduce((a, c) => a + num(c.montant), 0);
  const prov = S.provisions.reduce((a, p) => a + num(p.montant) / 12, 0);
  const env = S.enveloppes.reduce((a, e) => a + num(e.prevu), 0);
  const ep = num(S.epargneCommune);
  const commun = S.revenus.filter(r => r.personne === "Commun" && r.frequence === "Mensuel").reduce((a, r) => a + num(r.montant), 0);
  const besoin = ch + prov + env + ep - commun;
  const sal = S.personnes.map(p => S.revenus.filter(r => r.personne === p && r.frequence === "Mensuel").reduce((a, r) => a + num(r.montant), 0));
  const tot = sal[0] + sal[1];
  const parts = S.repartition === "egal" || tot === 0 ? [.5, .5] : [sal[0] / tot, sal[1] / tot];
  const pers = S.personnes.map((p, i) => { const vir = besoin * parts[i]; const perso = S.charges.filter(c => c.compte === "Perso " + p).reduce((a, c) => a + num(c.montant), 0); return { nom: p, sal: sal[i], part: parts[i], vir, perso, reste: sal[i] - vir - perso }; });
  return { ch, prov, env, ep, commun, besoin, pers };
}

/* ====================== Rendu ====================== */
let renderQ = false;
function scheduleRender() { if (renderQ) return; renderQ = true; requestAnimationFrame(() => { renderQ = false; render(); }); }
function render() {
  const root = $("#app");
  const scr = app.screen;
  if (scr === "loading") { root.innerHTML = `<div class="screen plain"><div class="col"><div class="brand"><img src="icons/icon-192.png" alt=""><p>Chargement…</p></div></div></div>`; return; }
  if (scr === "welcome") return root.innerHTML = vWelcome();
  if (scr === "login" || scr === "code") return root.innerHTML = vLogin();
  if (scr === "household") return root.innerHTML = vHousehold();
  const S = state();
  const view = { home: vHome, env: vEnv, budget: vBudget, livrets: vLivrets, settings: vSettings }[app.tab] || vHome;
  const y = window.scrollY, fid = !sheet && document.activeElement && root.contains(document.activeElement) ? document.activeElement.id : null;
  root.innerHTML = `<div class="screen"><div class="col">${view(S)}</div></div>${tabbar()}`;
  window.scrollTo(0, y);
  if (fid) { const el = document.getElementById(fid); if (el) el.focus({ preventScroll: true }); }
  const sel = root.querySelector('.months [aria-pressed="true"]');
  if (sel && !render._scrolled) { sel.scrollIntoView({ inline: "center", block: "nearest" }); render._scrolled = true; }
}
function head(title, extra = `<button class="iconbtn" data-tab="settings" aria-label="Réglages">${ICON.gear}</button>`) {
  const [cls, txt] = syncLabel();
  return `<header class="head"><h1>${title}</h1><div class="head-r"><span id="sync" class="sync ${cls}"><i></i><span>${txt}</span></span>${extra}</div></header>`;
}
function monthsBar(S) {
  const ech = new Set(S.provisions.map(p => Number(p.mois)));
  return `<div class="months" role="group" aria-label="Mois">${MC.map((n, i) => `<button data-month="${i + 1}" aria-pressed="${app.month === i + 1}">${n}${ech.has(i + 1) ? '<span class="dot"></span>' : ""}</button>`).join("")}</div>`;
}
function tabbar() {
  const t = (k, label, icon) => `<button data-tab="${k}" ${app.tab === k ? 'aria-current="page"' : ""}>${icon}<span>${label}</span></button>`;
  return `<nav class="tabbar" aria-label="Navigation">${t("home", "Accueil", ICON.home)}${t("env", "Dépenses", ICON.env)}<button class="fab" data-act="quick" aria-label="Ajouter une dépense">${ICON.plus}</button>${t("budget", "Budget", ICON.budget)}${t("livrets", "Livrets", ICON.piggy)}</nav>`;
}
function exampleBanner(S) {
  return S.exemple ? `<div class="banner"><span>Ce budget contient des <b>montants d'exemple</b>. Remplacez-les par les vôtres, ou repartez de zéro.</span><div class="btnrow"><button class="btn line" data-act="keepExample">Garder et modifier</button><button class="btn danger" data-act="askClear">Tout vider</button></div></div>` : "";
}

function vHome(S) {
  const m = app.month, c = calc(S, m), nm = MOIS[m - 1];
  const env = Math.max(c.envPrevu, c.envReel);
  const tot = Math.max(c.revenus, c.charges + c.provisions + env, 1);
  const segs = [["Charges", c.charges, "--c-charges"], ["À mettre de côté", c.provisions, "--c-prov"], ["Enveloppes", env, "--c-env"], ["Épargne", Math.max(c.epargne, 0), "--c-epargne"]];
  const up = []; for (let k = 0; k < 3; k++) { const mm = ((m - 1 + k) % 12) + 1; S.provisions.filter(p => Number(p.mois) === mm).forEach(p => up.push({ mm, p })); }
  const liv = Object.fromEntries(S.livrets.map(l => [l.id, l]));
  return `${head(`${nm} <span class="yr">${S.annee}</span>`)}
  ${monthsBar(S)}
  ${exampleBanner(S)}
  <section class="card hero"><div class="label">Épargne possible</div><div class="big">${eur(c.epargne)}</div><div class="sub">${c.revenus > 0 ? Math.round(c.epargne / c.revenus * 100) : 0} % des revenus du mois${c.revenus > c.revReg ? " · prime incluse" : ""}</div></section>
  <div class="duo">
    <section class="card"><div class="label"><span class="sw" style="background:var(--c-prov)"></span>De côté</div><div class="mid">${eur(c.provisions)}</div><div class="sub">à virer sur les livrets</div></section>
    <section class="card" data-tab="env" role="button"><div class="label"><span class="sw" style="background:var(--c-env)"></span>Reste à dépenser</div><div class="mid ${c.resteEnv < 0 ? "neg" : ""}">${eur(c.resteEnv)}</div><div class="sub">${eur(c.envReel)} sur ${eur(c.envPrevu)}</div></section>
  </div>
  <section class="card"><h2>Où vont les ${eur(c.revenus)}<small>reste à vivre ${eur(c.rav)}</small></h2>
    <div class="flow">${segs.map(([n, v, col]) => `<div style="width:${(v / tot * 100).toFixed(2)}%;background:var(${col})" title="${n}"></div>`).join("")}</div>
    <div class="legend">${segs.map(([n, v, col]) => `<div class="it" style="border-color:var(${col})"><b>${eur(v)}</b><span>${n}</span></div>`).join("")}</div>
  </section>
  <section class="card"><h2>Enveloppes<small>${nm.toLowerCase()}</small></h2><div class="list">
    ${S.enveloppes.length ? S.enveloppes.map(e => envRow(S, e, m)).join("") : `<p class="empty">Aucune enveloppe. Ajoutez-en dans Budget.</p>`}
  </div></section>
  <section class="card"><h2>Prochaines échéances<small>3 mois</small></h2><div class="list">
    ${up.length ? up.map(({ mm, p }) => `<div class="row"><div class="main"><div class="t">${esc(p.libelle)}</div><div class="s">${MOIS[mm - 1]} · ${esc(liv[p.livret]?.nom || "sans livret")}</div></div><div class="amt">${eur(p.montant)}</div></div>`).join("") : `<p class="empty">Rien de prévu.</p>`}
  </div></section>`;
}
function envRow(S, e, m) {
  const r = reel(S, e.id, m), p = num(e.prevu), left = p - r, pct = p ? Math.min(r / p * 100, 100) : (r ? 100 : 0);
  return `<button class="row" data-act="quick" data-env="${e.id}"><div class="main"><div class="t">${esc(e.libelle)}</div><div class="bar ${left < 0 ? "over" : ""}"><i style="width:${pct}%"></i></div></div><div class="amt ${left < 0 ? "neg" : ""}">${left < 0 ? "−" + eur(-left) : eur(left)}<small>${eur(r)} / ${eur(p)}</small></div></button>`;
}

function vEnv(S) {
  const m = app.month, c = calc(S, m);
  const deps = S.depenses.filter(d => Number(d.annee) === Number(S.annee) && Number(d.mois) === m);
  const envName = Object.fromEntries(S.enveloppes.map(e => [e.id, e.libelle]));
  const dfmt = d => { try { return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }); } catch { return ""; } };
  return `${head("Dépenses")}
  ${monthsBar(S)}
  <div class="duo"><section class="card"><div class="label">Dépensé</div><div class="mid">${eur(c.envReel)}</div><div class="sub">sur ${eur(c.envPrevu)} prévus</div></section>
  <section class="card"><div class="label">Reste</div><div class="mid ${c.resteEnv < 0 ? "neg" : ""}">${eur(c.resteEnv)}</div><div class="sub">${MOIS[m - 1].toLowerCase()} ${S.annee}</div></section></div>
  <section class="card"><h2>Par enveloppe<small>touchez pour ajouter</small></h2><div class="list">${S.enveloppes.map(e => envRow(S, e, m)).join("") || `<p class="empty">Aucune enveloppe.</p>`}</div></section>
  <section class="card"><h2>Saisies du mois<small>${deps.length} ligne${deps.length > 1 ? "s" : ""}</small></h2><div class="list">
    ${deps.length ? deps.map(d => `<button class="row" data-edit="depense" data-id="${d.id}"><div class="main"><div class="t">${esc(d.note || envName[d.enveloppe] || "Dépense")}</div><div class="s">${esc(envName[d.enveloppe] || "Enveloppe supprimée")} · ${dfmt(d.date)}${d.par ? " · " + esc(d.par) : ""}</div></div><div class="amt">${eur2(d.montant)}</div>${ICON.chev}</button>`).join("") : `<p class="empty">Aucune dépense saisie pour ${MOIS[m - 1].toLowerCase()}. Utilisez le bouton +.</p>`}
  </div></section>`;
}

const SEGS = [["revenu", "Revenus"], ["charge", "Charges"], ["provision", "Provisions"], ["enveloppe", "Enveloppes"]];
function vBudget(S) {
  const seg = app.seg;
  const L = { revenu: S.revenus, charge: S.charges, provision: S.provisions, enveloppe: S.enveloppes }[seg] || [];
  const liv = Object.fromEntries(S.livrets.map(l => [l.id, l.nom]));
  const rowOf = {
    revenu: r => [r.libelle, `${r.personne || ""} · ${r.frequence === "Mensuel" ? "chaque mois" : MOIS[(Number(r.mois) || 1) - 1]}`, eur(r.montant), r.frequence === "Mensuel" ? "/ mois" : "ponctuel"],
    charge: c => [c.libelle, `${c.categorie || ""} · ${c.compte || ""}`, eur(c.montant), "/ mois"],
    provision: p => [p.libelle, `${MOIS[(Number(p.mois) || 1) - 1]} · ${liv[p.livret] || "sans livret"}`, eur(num(p.montant) / 12), `/ mois · ${eur(p.montant)} an`],
    enveloppe: e => [e.libelle, "budget mensuel", eur(e.prevu), "/ mois"]
  }[seg];
  const total = {
    revenu: ["Revenus réguliers / mois", eur(S.revenus.filter(r => r.frequence === "Mensuel").reduce((a, r) => a + num(r.montant), 0))],
    charge: ["Total / mois", eur(S.charges.reduce((a, c) => a + num(c.montant), 0))],
    provision: ["À mettre de côté / mois", eur(S.provisions.reduce((a, p) => a + num(p.montant), 0) / 12)],
    enveloppe: ["Budget enveloppes / mois", eur(S.enveloppes.reduce((a, e) => a + num(e.prevu), 0))]
  }[seg];
  const help = {
    revenu: "Salaires, primes, remboursements, aides. « Ponctuel » = uniquement le mois choisi.",
    charge: "Prélevé chaque mois : prêts, assurances, énergie, box, centre aéré, abonnements.",
    provision: "Dépenses annuelles lissées sur 12 mois et rangées dans un livret.",
    enveloppe: "Dépenses du quotidien, avec un budget par mois."
  }[seg];
  const addLabel = { revenu: "Ajouter un revenu", charge: "Ajouter une charge", provision: "Ajouter une dépense annuelle", enveloppe: "Ajouter une enveloppe" }[seg];
  return `${head("Budget")}
  <div class="seg" role="group">${SEGS.map(([k, l]) => `<button data-seg="${k}" aria-pressed="${seg === k}">${l}</button>`).join("")}</div>
  <p class="note" style="margin:0">${help}</p>
  <section class="card"><div class="list">
    ${L.length ? L.map(it => { const [t, s, a, as] = rowOf(it); return `<button class="row" data-edit="${seg}" data-id="${it.id}"><div class="main"><div class="t">${esc(t) || "<span class='muted'>Sans nom</span>"}</div><div class="s">${esc(s)}</div></div><div class="amt">${a}<small>${as}</small></div>${ICON.chev}</button>`; }).join("") : `<p class="empty">Rien pour l'instant.</p>`}
    <button class="addrow" data-new="${seg}">${ICON.plus.replace("<svg", '<svg width="18" height="18"')} ${addLabel}</button>
  </div><div class="totals"><span>${total[0]}</span><span>${total[1]}</span></div></section>`;
}

function spark(vals, m) {
  const w = 110, h = 30, min = Math.min(0, ...vals), max = Math.max(...vals, 1);
  const x = i => 3 + i * (w - 6) / 11, y = v => h - 4 - (v - min) / (max - min || 1) * (h - 8);
  const zero = min < 0 ? `<line x1="0" x2="${w}" y1="${y(0)}" y2="${y(0)}" stroke="var(--neg)" stroke-dasharray="2 2"/>` : "";
  const cur = vals[m - 1];
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${zero}<polyline points="${vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}" fill="none" stroke="var(--c-prov)" stroke-width="1.8"/><circle cx="${x(m - 1)}" cy="${y(cur)}" r="3.2" fill="${cur < 0 ? "var(--neg)" : "var(--c-prov)"}"/></svg>`;
}
function vLivrets(S) {
  const m = app.month, j = joint(S), c0 = calc(S, m);
  const anyNeg = S.livrets.some(l => livretStats(S, l).bas < 0);
  const regC = { rev: c0.revReg, ch: c0.charges, pr: c0.provisions, en: c0.envPrevu };
  const ep = regC.rev - regC.ch - regC.pr - regC.en;
  return `${head("Livrets")}
  ${monthsBar(S)}
  <section class="card"><h2>Livrets de provisions<small>fin ${MOIS[m - 1].toLowerCase()}</small></h2><div class="list">
    ${S.livrets.map(l => { const st = livretStats(S, l), cur = st.soldes[m - 1]; return `<button class="row" data-edit="livret" data-id="${l.id}"><div class="main"><div class="t">${esc(l.nom)}</div><div class="s">${eur(st.mens)} / mois · point bas ${eur(st.bas)} (${MC[st.moisBas - 1]})</div><div style="margin-top:4px">${st.bas < 0 ? `<span class="pill neg">Manque ${eur(-st.bas)}</span>` : `<span class="pill ok">OK sur l'année</span>`}</div></div><div class="amt"><span class="${cur < 0 ? "neg" : ""}">${eur(cur)}</span>${spark(st.soldes, m)}</div></button>`; }).join("") || `<p class="empty">Aucun livret.</p>`}
    <button class="addrow" data-new="livret">${ICON.plus.replace("<svg", '<svg width="18" height="18"')} Ajouter un livret</button>
  </div>
  <div class="totals"><span>Virement total / mois</span><span>${eur(S.livrets.reduce((a, l) => a + livretStats(S, l).mens, 0))}</span></div>
  ${anyNeg ? `<p class="note">Un livret en négatif : la dépense arrive avant d'avoir été épargnée. Augmentez son solde de départ ou prévoyez un virement ponctuel.</p>` : ""}</section>
  <section class="card"><h2>Compte joint<small>${S.repartition === "egal" ? "50 / 50" : "au prorata des salaires"}</small></h2>
    ${j.pers.map(p => `<div class="kv"><span>${esc(p.nom)} vire <span class="muted">(${Math.round(p.part * 100)} %)</span></span><b>${eur(p.vir)}</b></div>`).join("")}
    <div class="kv total"><span>À couvrir chaque mois</span><b>${eur(j.besoin)}</b></div>
    <p class="note">${eur(j.ch)} de charges · ${eur(j.prov)} de provisions · ${eur(j.env)} d'enveloppes${j.ep ? ` · ${eur(j.ep)} d'épargne commune` : ""}${j.commun ? ` − ${eur(j.commun)} de revenus communs` : ""}.</p>
    ${j.pers.map(p => `<div class="kv"><span>Reste perso ${esc(p.nom)}</span><b class="${p.reste < 0 ? "neg" : ""}">${eur(p.reste)}</b></div>`).join("")}
  </section>
  <section class="card"><h2>Mois type<small>hors primes</small></h2>
    <div class="kv"><span>Revenus réguliers</span><b>${eur(regC.rev)}</b></div>
    <div class="kv"><span>− Charges</span><b>${eur(regC.ch)}</b></div>
    <div class="kv"><span>− De côté (livrets)</span><b>${eur(regC.pr)}</b></div>
    <div class="kv"><span>− Enveloppes</span><b>${eur(regC.en)}</b></div>
    <div class="kv total"><span>Épargne possible</span><b>${eur(ep)}</b></div>
  </section>`;
}

function vSettings(S) {
  const h = app.household || {};
  const demo = app.mode === "demo";
  return `${head("Réglages", `<button class="iconbtn" data-tab="home" aria-label="Fermer">✕</button>`)}
  ${demo ? `<section class="card"><h2>Mode démo</h2><p class="note" style="margin-top:0">Les données restent sur ce téléphone. Configurez Supabase (voir README) pour partager le budget entre vos iPhone.</p>${CONFIGURED ? `<button class="btn block" data-act="leaveDemo">Passer à la synchro en ligne</button>` : ""}</section>` : `
  <section class="card"><h2>Foyer<small>${esc(h.name || "")}</small></h2>
    <div class="label">Code d'invitation</div>
    <div class="code" style="margin:4px 0 8px">${esc(h.invite_code || "—")}</div>
    <p class="note" style="margin-top:0">Votre partenaire installe l'app, se connecte avec son e-mail puis choisit « Rejoindre un foyer » avec ce code.</p>
    <div class="btnrow"><button class="btn ghost" data-act="shareCode">Partager le code</button><button class="btn line" data-act="rotateCode">Nouveau code</button></div>
    <div class="list" style="margin-top:10px">${app.members.map(mb => `<div class="row"><div class="main"><div class="t">${esc(mb.display_name || "Membre")}${mb.user_id === app.user?.id ? ' <span class="muted">(vous)</span>' : ""}</div></div></div>`).join("")}</div>
  </section>`}
  <section class="card"><h2>Budget</h2><div class="form">
    <label class="field"><span>Année</span><input id="s-annee" type="number" inputmode="numeric" value="${esc(S.annee)}" data-setting="annee"></label>
    <div class="two"><label class="field"><span>Personne 1</span><input id="s-p0" value="${esc(S.personnes[0])}" data-person="0"></label>
    <label class="field"><span>Personne 2</span><input id="s-p1" value="${esc(S.personnes[1])}" data-person="1"></label></div>
    <label class="field"><span>Répartition du compte joint</span><select id="s-rep" data-setting="repartition"><option value="prorata" ${S.repartition !== "egal" ? "selected" : ""}>Au prorata des salaires</option><option value="egal" ${S.repartition === "egal" ? "selected" : ""}>50 / 50</option></select></label>
    <label class="field"><span>Épargne commune programmée / mois</span><div class="euro"><input id="s-ep" type="text" inputmode="decimal" value="${esc(S.epargneCommune || "")}" data-setting="epargneCommune"></div></label>
  </div></section>
  <section class="card"><h2>Sauvegarde</h2>
    <p class="note" style="margin-top:0">Importez l'export JSON de la version web (Réglages → Exporter) pour reprendre vos montants.</p>
    <div class="btnrow"><button class="btn ghost" data-act="export">Exporter</button><label class="btn ghost" for="importFile">Importer…</label></div>
    <input id="importFile" type="file" accept="application/json,.json" hidden>
    <div class="btnrow" style="margin-top:8px" id="clearZone"><button class="btn danger" data-act="askClear">Tout vider</button></div>
  </section>
  <section class="card"><div class="btnrow">${demo ? `<button class="btn line" data-act="quitDemo">Quitter la démo</button>` : `<button class="btn line" data-act="logout">Se déconnecter</button>`}</div>
  <p class="note">${demo ? "" : `Connecté : ${esc(app.user?.email || "")}<br>`}Budget familial · v1</p></section>`;
}

/* ---------- écrans d'entrée ---------- */
function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }
function isStandalone() { return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; }
function installTip() {
  return isIOS() && !isStandalone() ? `<div class="tip"><b>Installez d'abord l'app</b> : bouton Partager de Safari → « Sur l'écran d'accueil ». Connectez-vous ensuite depuis l'icône (Safari et l'app ne partagent pas la connexion).</div>` : "";
}
function vWelcome() {
  return `<div class="screen plain"><div class="col"><div class="brand"><img src="icons/icon-192.png" alt=""><h1>Budget familial</h1><p>Enveloppes, provisions et compte joint, partagés entre vos téléphones.</p></div>
  ${installTip()}
  ${CONFIGURED ? `<button class="btn block" data-act="goLogin">Se connecter</button>` : `<div class="card"><h2>Synchro pas encore configurée</h2><p class="note" style="margin-top:0">Renseignez l'adresse et la clé Supabase dans <b>config.js</b> (voir README) pour partager le budget.</p></div>`}
  <button class="btn ${CONFIGURED ? "line" : ""} block" data-act="demo">Essayer avec un exemple (sur ce téléphone)</button></div></div>`;
}
function vLogin() {
  const code = app.screen === "code";
  return `<div class="screen plain"><div class="col"><div class="brand"><img src="icons/icon-192.png" alt=""><h1>${code ? "Code reçu" : "Connexion"}</h1><p>${code ? `Saisissez le code envoyé à <b>${esc(app.email)}</b>.` : "Recevez un code par e-mail, sans mot de passe."}</p></div>
  ${code ? "" : installTip()}
  <form class="form card" id="${code ? "codeForm" : "emailForm"}">
    ${code ? `<label class="field"><span>Code</span><input id="otp" name="otp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="10" required style="font-size:24px;letter-spacing:.3em;text-align:center"></label>`
           : `<label class="field"><span>E-mail</span><input id="email" name="email" type="email" autocomplete="email" required value="${esc(app.email)}"></label>`}
    ${app.authErr ? `<p class="err">${esc(app.authErr)}</p>` : ""}
    <button class="btn block" ${app.busy ? "disabled" : ""}>${app.busy ? "Patientez…" : code ? "Valider" : "Recevoir le code"}</button>
    ${code ? `<button type="button" class="btn line block" data-act="backEmail">Changer d'e-mail ou renvoyer</button>` : ""}
  </form>
  ${code ? "" : `<button class="btn line block" data-act="welcome">Retour</button>`}</div></div>`;
}
function vHousehold() {
  return `<div class="screen plain"><div class="col"><div class="brand"><h1>Votre foyer</h1><p>Créez le budget du foyer, ou rejoignez celui de votre partenaire.</p></div>
  <form class="form card" id="createForm"><h2>Créer un foyer</h2>
    <label class="field"><span>Votre prénom</span><input id="c-name" name="me" required autocomplete="given-name"></label>
    <label class="field"><span>Nom du foyer</span><input id="c-home" name="home" value="Notre foyer"></label>
    <label class="field"><span>Pour commencer</span><select id="c-start" name="start"><option value="exemple">Avec des montants d'exemple</option><option value="vide">Budget vide</option></select></label>
    <button class="btn block" ${app.busy ? "disabled" : ""}>Créer</button></form>
  <form class="form card" id="joinForm"><h2>Rejoindre un foyer</h2>
    <label class="field"><span>Votre prénom</span><input id="j-name" name="me" required autocomplete="given-name"></label>
    <label class="field"><span>Code d'invitation</span><input id="j-code" name="code" required autocapitalize="characters" style="text-transform:uppercase;letter-spacing:.12em"></label>
    <button class="btn ghost block" ${app.busy ? "disabled" : ""}>Rejoindre</button></form>
  ${app.authErr ? `<p class="err">${esc(app.authErr)}</p>` : ""}
  <button class="btn line block" data-act="logout">Se déconnecter</button></div></div>`;
}

/* ====================== Feuilles (formulaires) ====================== */
let sheet = null; // {kind, id|null, draft}
function fieldsFor(kind, S, d) {
  const months = MOIS.map((n, i) => [i + 1, n]);
  return {
    revenu: [["libelle", "Libellé", "text"], ["montant", "Montant", "euro"], ["personne", "Personne", "select", [...S.personnes, "Commun"]], ["type", "Type", "select", TYPES], ["frequence", "Fréquence", "select", ["Mensuel", "Ponctuel"]], ...(d.frequence === "Ponctuel" ? [["mois", "Mois", "select", months]] : [])],
    charge: [["libelle", "Libellé", "text"], ["montant", "Montant / mois", "euro"], ["categorie", "Catégorie", "select", CATS], ["compte", "Compte", "select", ["Joint", ...S.personnes.map(p => "Perso " + p)]]],
    provision: [["libelle", "Libellé", "text"], ["montant", "Montant annuel", "euro"], ["mois", "Mois de la dépense", "select", months], ["livret", "Livret", "select", [["", "—"], ...S.livrets.map(l => [l.id, l.nom])]]],
    enveloppe: [["libelle", "Nom de l'enveloppe", "text"], ["prevu", "Budget / mois", "euro"]],
    livret: [["nom", "Nom du livret", "text"], ["solde", `Solde au 1er janvier ${S.annee}`, "euro"]]
  }[kind];
}
const TITLES = { revenu: "Revenu", charge: "Charge mensuelle", provision: "Dépense annuelle", enveloppe: "Enveloppe", livret: "Livret", depense: "Dépense" };
function openSheet(kind, id, preset = {}) {
  const S = state();
  const it = id ? app.items.get(id) : null;
  const defaults = {
    revenu: { personne: S.personnes[0], type: "Salaire", frequence: "Mensuel", mois: app.month },
    charge: { categorie: "Autre", compte: "Joint" },
    provision: { mois: app.month, livret: S.livrets[0]?.id || "" },
    enveloppe: {}, livret: { solde: 0 },
    depense: { enveloppe: S.enveloppes[0]?.id || "", mois: app.month, annee: S.annee }
  }[kind];
  sheet = { kind, id, draft: { ...defaults, ...(it ? it.data : {}), ...preset }, confirmDel: false };
  renderSheet(true);
}
function closeSheet() { sheet = null; $("#sheet").innerHTML = ""; document.body.style.overflow = ""; }
function renderSheet(first) {
  if (!sheet) return;
  const S = state(), d = sheet.draft, k = sheet.kind;
  let body;
  if (k === "depense") {
    body = `<div class="amountwrap"><input class="amount" id="f-montant" data-f="montant" inputmode="decimal" placeholder="0" value="${d.montant != null && d.montant !== "" ? esc(String(d.montant).replace(".", ",")) : ""}" aria-label="Montant"><span>€</span></div>
      <div class="field"><span>Enveloppe</span><div class="chips">${S.enveloppes.map(e => `<button type="button" data-chip="${e.id}" aria-pressed="${d.enveloppe === e.id}">${esc(e.libelle)}</button>`).join("") || '<span class="muted">Créez d\'abord une enveloppe dans Budget.</span>'}</div></div>
      <label class="field"><span>Note (facultatif)</span><input id="f-note" data-f="note" value="${esc(d.note || "")}" placeholder="Ex. Marché, plein d'essence…"></label>
      <label class="field"><span>Mois</span><select id="f-mois" data-f="mois">${MOIS.map((n, i) => `<option value="${i + 1}" ${Number(d.mois) === i + 1 ? "selected" : ""}>${n} ${d.annee || S.annee}</option>`).join("")}</select></label>`;
  } else {
    body = fieldsFor(k, S, d).map(([f, label, type, opts]) => {
      const v = d[f] ?? "";
      if (type === "select") return `<label class="field"><span>${label}</span><select id="f-${f}" data-f="${f}">${opts.map(o => { const [ov, ol] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(ov)}" ${String(ov) === String(v) ? "selected" : ""}>${esc(ol)}</option>`; }).join("")}</select></label>`;
      if (type === "euro") return `<label class="field"><span>${label}</span><div class="euro"><input id="f-${f}" data-f="${f}" inputmode="decimal" value="${v === "" ? "" : esc(String(v).replace(".", ","))}"></div></label>`;
      return `<label class="field"><span>${label}</span><input id="f-${f}" data-f="${f}" value="${esc(v)}" autocapitalize="sentences"></label>`;
    }).join("");
    if (k === "provision" && num(d.montant)) body += `<p class="note">À mettre de côté : <b>${eur(num(d.montant) / 12)}</b> par mois.</p>`;
  }
  const delZone = sheet.id ? (sheet.confirmDel
    ? `<div class="btnrow"><button type="button" class="btn danger" data-act="delConfirm">Supprimer définitivement</button><button type="button" class="btn line" data-act="delCancel">Annuler</button></div>`
    : `<button type="button" class="btn danger block" data-act="delAsk">Supprimer</button>`) : "";
  const focusId = document.activeElement?.id;
  $("#sheet").innerHTML = `<div class="scrim" data-act="closeSheet"></div><div class="panel" role="dialog" aria-modal="true" aria-label="${TITLES[k]}"><div class="grab"></div>
    <form class="form" id="sheetForm"><div class="ph"><button type="button" data-act="closeSheet">Annuler</button><h2>${sheet.id ? TITLES[k] : (k === "depense" ? "Nouvelle dépense" : "Nouveau · " + TITLES[k].toLowerCase())}</h2><button type="submit">${sheet.id ? "OK" : "Ajouter"}</button></div>
    ${body}<p class="err" id="sheetErr" hidden></p>
    <button class="btn block">${sheet.id ? "Enregistrer" : "Ajouter"}</button>${delZone}</form></div>`;
  document.body.style.overflow = "hidden";
  if (first) { const f = k === "depense" ? $("#f-montant") : $("#sheet input"); if (f && !sheet.id) setTimeout(() => f.focus(), 60); }
  else if (focusId) { const el = document.getElementById(focusId); if (el) el.focus(); }
}
function saveSheet() {
  const { kind, id, draft } = sheet;
  const d = { ...draft };
  ["montant", "prevu", "solde"].forEach(f => { if (f in d) d[f] = d[f] === "" ? 0 : num(d[f]); });
  if ("mois" in d) d.mois = Number(d.mois) || 1;
  const err = m => { const e = $("#sheetErr"); e.textContent = m; e.hidden = false; };
  if (kind === "depense") {
    if (!num(d.montant)) return err("Indiquez un montant.");
    if (!d.enveloppe) return err("Choisissez une enveloppe.");
    if (!id) { d.date = new Date().toISOString(); d.par = app.myName || ""; d.annee = state().annee; }
  } else {
    const nameF = kind === "livret" ? "nom" : "libelle";
    if (!String(d[nameF] || "").trim()) return err("Donnez-lui un nom.");
  }
  if (!id) d.ordre = Date.now();
  put(kind, id || newId(), d);
  if (kind === "depense" && !id) {
    const env = state().enveloppes.find(e => e.id === d.enveloppe);
    toast(`${eur2(d.montant)} ajoutés · ${env ? env.libelle : ""}`);
  }
  closeSheet();
}

/* ====================== Actions ====================== */
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, 2400); }
function go(screen) { app.screen = screen; app.authErr = ""; render(); }

document.addEventListener("click", async e => {
  const t = e.target.closest("[data-act],[data-tab],[data-month],[data-seg],[data-edit],[data-new],[data-chip]");
  if (!t) return;
  if (t.dataset.chip) { sheet.draft.enveloppe = t.dataset.chip; renderSheet(); return; }
  if (t.dataset.tab) { app.tab = t.dataset.tab; LS.set("bf:tab", app.tab); render._scrolled = false; window.scrollTo(0, 0); render(); return; }
  if (t.dataset.month) { app.month = Number(t.dataset.month); render(); return; }
  if (t.dataset.seg) { app.seg = t.dataset.seg; LS.set("bf:seg", app.seg); render(); return; }
  if (t.dataset.edit) { openSheet(t.dataset.edit, t.dataset.id); return; }
  if (t.dataset.new) { openSheet(t.dataset.new, null); return; }
  const a = t.dataset.act;
  switch (a) {
    case "quick": openSheet("depense", null, t.dataset.env ? { enveloppe: t.dataset.env } : {}); break;
    case "closeSheet": closeSheet(); break;
    case "delAsk": sheet.confirmDel = true; renderSheet(); break;
    case "delCancel": sheet.confirmDel = false; renderSheet(); break;
    case "delConfirm": {
      const { kind, id } = sheet; del(kind, id);
      if (kind === "livret") state().provisions.filter(p => p.livret === id).forEach(p => { const it = app.items.get(p.id); put("provision", p.id, { ...it.data, livret: "" }); });
      closeSheet(); toast("Supprimé"); break;
    }
    case "goLogin": go("login"); break;
    case "welcome": go("welcome"); break;
    case "backEmail": go("login"); break;
    case "demo": startDemo(); break;
    case "quitDemo": LS.del("bf:mode"); app.mode = CONFIGURED ? "cloud" : null; app.hid = null; app.items = new Map(); go("welcome"); break;
    case "leaveDemo": LS.set("bf:mode", "cloud"); app.mode = "cloud"; app.hid = null; app.items = new Map(); boot(); break;
    case "logout": await logout(); break;
    case "keepExample": setSettings({ exemple: false }); break;
    case "askClear": {
      const zone = t.closest(".btnrow");
      zone.innerHTML = `<span style="flex-basis:100%;font-size:14px">Effacer revenus, charges, provisions, enveloppes, livrets et dépenses ?</span><button class="btn danger" data-act="clear">Oui, tout vider</button><button class="btn line" data-act="cancelClear">Annuler</button>`;
      break;
    }
    case "cancelClear": render(); break;
    case "clear": clearAll(); setSettings({ exemple: false }); toast("Budget vidé"); break;
    case "export": doExport(); break;
    case "shareCode": shareCode(); break;
    case "rotateCode": rotateCode(); break;
  }
});
document.addEventListener("input", e => {
  const el = e.target;
  if (el.dataset.f && sheet) {
    sheet.draft[el.dataset.f] = el.value;
    if (el.tagName === "SELECT" || (sheet.kind === "provision" && el.dataset.f === "montant")) {
      if (el.tagName === "SELECT") renderSheet();
      else { const n = $("#sheet .note"); const v = num(el.value); if (n) n.innerHTML = `À mettre de côté : <b>${eur(v / 12)}</b> par mois.`; else if (v) renderSheet(); }
    }
  }
});
document.addEventListener("change", e => {
  const el = e.target;
  if (el.id === "importFile") return doImport(el.files[0]);
  if (el.dataset.setting) {
    const k = el.dataset.setting; let v = el.value;
    if (k === "annee") v = Number(v) || new Date().getFullYear();
    if (k === "epargneCommune") v = num(v);
    setSettings({ [k]: v });
  }
  if (el.dataset.person) {
    const S = state(), i = Number(el.dataset.person), old = S.personnes[i], nw = el.value.trim() || old;
    if (nw === old) return;
    const personnes = [...S.personnes]; personnes[i] = nw;
    setSettings({ personnes });
    S.revenus.filter(r => r.personne === old).forEach(r => put("revenu", r.id, { ...app.items.get(r.id).data, personne: nw }));
    S.charges.filter(c => c.compte === "Perso " + old).forEach(c => put("charge", c.id, { ...app.items.get(c.id).data, compte: "Perso " + nw }));
  }
});
document.addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target;
  if (f.id === "sheetForm") return saveSheet();
  if (f.id === "emailForm") return sendCode(f.email.value.trim());
  if (f.id === "codeForm") return verifyCode(f.otp.value.trim());
  if (f.id === "createForm") return createHousehold(f.me.value.trim(), f.home.value.trim(), f.start.value);
  if (f.id === "joinForm") return joinHousehold(f.me.value.trim(), f.code.value.trim());
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && sheet) closeSheet(); });

function clearAll() {
  for (const it of [...app.items.values()]) if (it.kind !== "settings" && !it.deleted) put(it.kind, it.id, it.data, true);
}

/* ---------- Auth & foyer ---------- */
async function sendCode(email) {
  app.email = email; LS.set("bf:email", email); app.busy = true; app.authErr = ""; render();
  const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  app.busy = false;
  if (error) { app.authErr = /not authorized/i.test(error.message) ? "Cette adresse n'est pas autorisée par l'e-mail par défaut de Supabase : ajoutez-la à l'équipe du projet ou configurez un SMTP (voir README)."
      : /rate|limit/i.test(error.message) ? "Trop de demandes : patientez avant de redemander un code (2 e-mails par heure avec l'e-mail par défaut de Supabase)." : "Envoi impossible : " + error.message; render(); return; }
  go("code"); setTimeout(() => $("#otp")?.focus(), 50);
}
async function verifyCode(token) {
  app.busy = true; app.authErr = ""; render();
  const { data, error } = await sb.auth.verifyOtp({ email: app.email, token, type: "email" });
  app.busy = false;
  if (error || !data?.session) { app.authErr = "Code invalide ou expiré. Redemandez-en un."; render(); return; }
  await afterLogin(data.session.user);
}
async function afterLogin(user) {
  app.user = { id: user.id, email: user.email };
  const { data, error } = await sb.from("household_members").select("household_id, display_name, households(id,name,invite_code)").eq("user_id", user.id).order("joined_at", { ascending: true }).limit(1);
  if (error) {
    // hors ligne : on reprend le dernier foyer connu
    const last = LS.get("bf:last", null);
    if (last && last.user === user.id) { enterHousehold(last.household, last.myName); return; }
    app.authErr = "Impossible de joindre le serveur."; go("household"); return;
  }
  if (!data || !data.length) { go("household"); return; }
  enterHousehold(data[0].households, data[0].display_name);
}
function enterHousehold(h, myName) {
  app.household = h; app.hid = h.id; app.myName = myName || "";
  LS.set("bf:last", { user: app.user?.id, household: h, myName: app.myName });
  loadLocal();
  app.screen = "app"; render();
  flush().then(pull); subscribe(); loadMembers();
}
async function loadMembers() {
  if (!sb || !app.hid) return;
  const { data } = await sb.from("household_members").select("user_id, display_name").eq("household_id", app.hid).order("joined_at");
  if (data) { app.members = data; if (app.tab === "settings") scheduleRender(); }
  const { data: h } = await sb.from("households").select("id,name,invite_code").eq("id", app.hid).maybeSingle();
  if (h) { app.household = h; LS.set("bf:last", { user: app.user?.id, household: h, myName: app.myName }); }
}
async function createHousehold(me, home, start) {
  app.busy = true; app.authErr = ""; render();
  const { data, error } = await sb.rpc("create_household", { p_name: home, p_display_name: me });
  app.busy = false;
  if (error) { app.authErr = "Création impossible : " + error.message; render(); return; }
  const h = Array.isArray(data) ? data[0] : data;
  enterHousehold(h, me);
  seed(start === "exemple", me);
}
async function joinHousehold(me, code) {
  app.busy = true; app.authErr = ""; render();
  const { data, error } = await sb.rpc("join_household", { p_code: code, p_display_name: me });
  app.busy = false;
  if (error) { app.authErr = /inconnu/i.test(error.message) ? "Ce code ne correspond à aucun foyer." : error.message; render(); return; }
  enterHousehold(Array.isArray(data) ? data[0] : data, me);
}
async function logout() {
  if (app.channel && sb) sb.removeChannel(app.channel);
  if (sb) await sb.auth.signOut().catch(() => {});
  app.user = null; app.hid = null; app.household = null; app.items = new Map(); app.outbox = new Map();
  LS.del("bf:last");
  go("welcome");
}
async function shareCode() {
  const c = app.household?.invite_code; if (!c) return;
  const text = `Rejoins notre budget familial : installe l'app (${location.origin}${location.pathname}), connecte-toi, puis « Rejoindre un foyer » avec le code ${c}`;
  try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast("Invitation copiée"); } } catch {}
}
async function rotateCode() {
  const { data, error } = await sb.rpc("rotate_invite_code", { p_household: app.hid });
  if (error) { toast("Impossible de changer le code"); return; }
  app.household = { ...app.household, invite_code: data }; render(); toast("Nouveau code créé");
}

/* ---------- Démo ---------- */
function startDemo() {
  app.mode = "demo"; LS.set("bf:mode", "demo");
  app.hid = "demo"; app.user = null; app.myName = "Vous";
  loadLocal();
  if (!app.items.size) seed(true, "Florian");
  app.screen = "app"; render();
}

/* ---------- Données de départ / import / export ---------- */
function seed(withExample, me) {
  const year = new Date().getFullYear();
  if (!withExample) {
    put("settings", "settings", { annee: year, personnes: [me || "Personne 1", "Personne 2"], repartition: "prorata", epargneCommune: 0, exemple: false });
    put("livret", newId(), { nom: "Livret provisions", solde: 0, ordre: 1 });
    return;
  }
  importState(window.BUDGET_EXAMPLE, { exemple: true, annee: year, renameFirst: me });
}
function importState(src, opt = {}) {
  if (!src || !Array.isArray(src.revenus)) throw new Error("format");
  const annee = opt.annee || src.annee || new Date().getFullYear();
  let personnes = Array.isArray(src.personnes) ? [...src.personnes] : ["Personne 1", "Personne 2"];
  const ren = opt.renameFirst && personnes[0] !== opt.renameFirst ? [personnes[0], opt.renameFirst] : null;
  if (ren) personnes[0] = ren[1];
  const fix = p => (ren && p === ren[0] ? ren[1] : p);
  const fixC = c => (ren && c === "Perso " + ren[0] ? "Perso " + ren[1] : c);
  put("settings", "settings", { annee, personnes, repartition: src.repartition === "egal" ? "egal" : "prorata", epargneCommune: num(src.epargneCommune), exemple: !!opt.exemple });
  let o = 1;
  const idMap = {};
  const nid = old => (idMap[old] = idMap[old] || newId());
  (src.livrets || []).forEach(l => put("livret", nid(l.id), { nom: l.nom, solde: num(l.solde), ordre: o++ }));
  (src.revenus || []).forEach(r => put("revenu", nid(r.id), { libelle: r.libelle, personne: fix(r.personne), type: r.type, frequence: r.frequence === "Mensuel" ? "Mensuel" : "Ponctuel", mois: Number(r.mois) || 1, montant: num(r.montant), ordre: o++ }));
  (src.charges || []).forEach(c => put("charge", nid(c.id), { libelle: c.libelle, categorie: c.categorie, compte: fixC(c.compte), montant: num(c.montant), ordre: o++ }));
  (src.provisions || []).forEach(p => put("provision", nid(p.id), { libelle: p.libelle, livret: p.livret ? nid(p.livret) : "", montant: num(p.montant), mois: Number(p.mois) || 1, ordre: o++ }));
  (src.enveloppes || []).forEach(e => put("enveloppe", nid(e.id), { libelle: e.libelle, prevu: num(e.prevu), ordre: o++ }));
  if (Array.isArray(src.depenses)) {
    src.depenses.forEach(d => put("depense", newId(), { enveloppe: nid(d.enveloppe), annee: Number(d.annee) || annee, mois: Number(d.mois) || 1, montant: num(d.montant), note: d.note || "", par: d.par || "", date: d.date || new Date().toISOString() }));
  } else {
    (src.enveloppes || []).forEach(e => Object.entries(e.reel || {}).forEach(([m, v]) => {
      if (v === "" || v == null) return;
      put("depense", newId(), { enveloppe: nid(e.id), annee, mois: Number(m), montant: num(v), note: "Total du mois", par: "", date: new Date(annee, Number(m) - 1, 28).toISOString() });
    }));
  }
}
function exportState() {
  const S = state();
  return { format: "budget-familial", version: 2, exportedAt: new Date().toISOString(), annee: S.annee, personnes: S.personnes, repartition: S.repartition, epargneCommune: S.epargneCommune,
    livrets: S.livrets, revenus: S.revenus, charges: S.charges, provisions: S.provisions,
    enveloppes: S.enveloppes.map(e => { const reelM = {}; for (let m = 1; m <= 12; m++) { const v = reel(S, e.id, m); if (v) reelM[m] = Math.round(v * 100) / 100; } return { ...e, reel: reelM }; }),
    depenses: S.depenses };
}
async function doExport() {
  const json = JSON.stringify(exportState(), null, 2), name = `budget-familial-${state().annee}.json`;
  try {
    const file = new File([json], name, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; }
  } catch (e) { if (e && e.name === "AbortError") return; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([json], { type: "application/json" })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function doImport(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    try { const d = JSON.parse(r.result); if (!d || !Array.isArray(d.revenus)) throw 0; clearAll(); importState(d, { exemple: !!d.exemple }); toast("Sauvegarde importée"); }
    catch { toast("Ce fichier n'est pas une sauvegarde du budget"); }
  };
  r.readAsText(file);
}

/* ====================== Démarrage ====================== */
async function boot() {
  render();
  if (app.mode === "demo") return startDemo();
  if (!sb) { go("welcome"); return; }
  const { data } = await sb.auth.getSession();
  if (data?.session) await afterLogin(data.session.user);
  else go("welcome");
}
if (sb) sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT" && app.screen === "app" && app.mode === "cloud") go("welcome"); });
if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
boot();
})();
