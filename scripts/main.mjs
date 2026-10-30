// Three Keys Universal Importer — Foundry VTT v13/v14, dnd5e 5.x.
// One-click SRD 5.1 / 5.2 import (copied from the dnd5e system's own CC-BY-4.0 compendiums) plus JSON / CSV / stat-block text import
// of other openly licensed content into world compendiums. Duplicate-safe: every imported document carries a stable source id and
// content hashes, so re-imports skip unchanged entries, update changed ones and never clobber your local edits (unless you ask).
import * as C from "./convert.mjs";
import { CATALOG, SOURCES } from "./sources.mjs";
const ID = "three-keys-universal-importer";
const L = (k, d) => d ? game.i18n.format(`TKUI.${k}`, d) : game.i18n.localize(`TKUI.${k}`);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const get = k => game.settings.get(ID, k);
const CompendiumCollection = foundry.documents?.collections?.CompendiumCollection ?? globalThis.CompendiumCollection;
const docHash = doc => C.hash((({ flags, ...rest }) => rest)(doc.toObject()));

/** Find or create a world compendium. */
export async function ensurePack(name, label, documentName) {
  const pid = `world.${name}`; let pack = game.packs.get(pid);
  if (pack && pack.documentName !== documentName) throw new Error(`Compendium ${pid} holds ${pack.documentName}, not ${documentName}.`);
  if (!pack) pack = await CompendiumCollection.createCompendium({ type: documentName, label, name, package: "world", system: documentName === "Adventure" ? undefined : game.system.id });
  if (pack.locked) await pack.configure({ locked: false });
  return pack;
}

/** Write documents into a compendium, duplicate-safe. entries: [{ sourceId, data }]. Returns counts + per-entry log. */
export async function writeEntries(pack, entries, { policy = get("duplicatePolicy"), sourceKey = "custom", meta = {}, onProgress } = {}) {
  const Cls = getDocumentClass(pack.documentName); const res = { created: 0, updated: 0, unchanged: 0, keptEdited: 0, skipped: 0, failed: 0, log: [], pack: pack.collection };
  const index = await pack.getIndex({ fields: [`flags.${ID}`] }); const bySource = new Map();
  for (const e of index) { const f = e.flags?.[ID]; if (f?.sourceId) bySource.set(f.sourceId, e._id); }
  const seen = new Map(); for (const e of entries) seen.set(e.sourceId, e); // in-batch duplicates: last one wins
  const toCreate = []; let n = 0; const total = seen.size;
  for (const e of seen.values()) {
    n++; if (n % 25 === 0) onProgress?.(n, total);
    const h = C.hash(e.data); const flags = { sourceId: e.sourceId, source: sourceKey, license: meta.license ?? "", attribution: meta.attributionKey ?? sourceKey, importHash: h, importedAt: Date.now(), version: game.modules.get(ID).version };
    foundry.utils.setProperty(e.data, `flags.${ID}`, flags);
    const existingId = bySource.get(e.sourceId);
    if (!existingId) { toCreate.push(e.data); continue; }
    try {
      const doc = await pack.getDocument(existingId); const f = doc.getFlag(ID, "importHash") ? doc.flags[ID] : {};
      if (f.importHash === h) { res.unchanged++; continue; }
      const edited = f.docHash && docHash(doc) !== f.docHash;
      if (policy === "skip" || (edited && policy !== "overwrite")) { edited ? res.keptEdited++ : res.skipped++; res.log.push({ name: e.data.name, action: edited ? "kept-edited" : "skipped" }); continue; }
      await doc.delete(); const created = await Cls.create({ ...e.data, _id: existingId }, { pack: pack.collection, keepId: true });
      await created.setFlag(ID, "docHash", docHash(created)); res.updated++; res.log.push({ name: e.data.name, action: "updated" });
    } catch (err) { res.failed++; res.log.push({ name: e.data.name, action: "failed", error: err.message }); console.error(`${ID} | update failed for ${e.data.name}`, err); }
  }
  for (let i = 0; i < toCreate.length; i += 50) {
    const chunk = toCreate.slice(i, i + 50);
    try { const created = await Cls.createDocuments(chunk, { pack: pack.collection });
      await Cls.updateDocuments(created.map(d => ({ _id: d.id, [`flags.${ID}.docHash`]: docHash(d) })), { pack: pack.collection });
      res.created += created.length; created.forEach(d => res.log.push({ name: d.name, action: "created" })); }
    catch (err) { // fall back one by one so a single bad record does not sink the batch
      for (const d of chunk) { try { const c = await Cls.create(d, { pack: pack.collection }); await c.setFlag(ID, "docHash", docHash(c)); res.created++; res.log.push({ name: d.name, action: "created" }); }
        catch (e2) { res.failed++; res.log.push({ name: d.name, action: "failed", error: e2.message }); console.warn(`${ID} | could not create ${d.name}: ${e2.message}`); } } }
    onProgress?.(Math.min(n, i + 50), total);
  }
  return res;
}

/** Keep a world journal listing every imported source with its licence and the exact attribution notice. */
export async function recordAttribution({ key, title, license, attribution, url = "", packs = [] }) {
  const name = L("AttributionJournal"); let j = game.journal.find(x => x.getFlag(ID, "attribution"));
  if (!j) j = await JournalEntry.create({ name, flags: { [ID]: { attribution: true } }, ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER } });
  const lic = C.LICENSES[C.normLicense(license)] ?? {};
  const content = `<h2>${esc(title)}</h2><p><strong>${esc(L("License"))}:</strong> ${esc(lic.name ?? license)}${lic.url ? ` — <a href="${esc(lic.url)}">${esc(lic.url)}</a>` : ""}</p>
    ${attribution ? `<blockquote>${esc(attribution)}</blockquote>` : ""}${url ? `<p>${esc(L("SourceUrl"))}: <a href="${esc(url)}">${esc(url)}</a></p>` : ""}
    <p>${esc(L("ImportedInto"))}: ${packs.map(p => `<code>${esc(p)}</code>`).join(", ")}</p><p><em>${esc(L("ImportedBy", { date: new Date().toISOString().slice(0, 10) }))}</em></p>`;
  const page = j.pages.find(p => p.getFlag(ID, "key") === key);
  if (page) { const prevPacks = page.getFlag(ID, "packs") ?? []; const all = [...new Set([...prevPacks, ...packs])];
    await page.update({ "text.content": content.replace(/<p>[^<]*: (<code>.*?<\/code>(, )?)+<\/p>/, `<p>${esc(L("ImportedInto"))}: ${all.map(p => `<code>${esc(p)}</code>`).join(", ")}</p>`), [`flags.${ID}.packs`]: all }); }
  else await j.createEmbeddedDocuments("JournalEntryPage", [{ name: title, type: "text", text: { content }, flags: { [ID]: { key, packs } } }]);
  return j;
}

/** One-click import of SRD categories (ids from CATALOG). opts.names / opts.limit restrict the set (used by tests and previews). */
export async function importSRD(ids, { names, limit, policy, onProgress } = {}) {
  if (!game.user.isGM) throw new Error(L("GMOnly"));
  const out = [];
  for (const id of [].concat(ids)) {
    const cat = CATALOG.find(c => c.id === id); if (!cat) throw new Error(`Unknown source ${id}`);
    const src = game.packs.get(cat.pack); if (!src) { out.push({ id, error: `System compendium ${cat.pack} not found` }); continue; }
    let docs = await src.getDocuments(); const total = docs.length;
    docs = docs.filter(d => d.type !== "character" && C.normLicense(d.system?.source?.license) === cat.source.license);
    const filteredOut = total - docs.length;
    if (names) { const want = new Set([].concat(names).map(s => s.toLowerCase())); docs = docs.filter(d => want.has(d.name.toLowerCase())); }
    if (limit) docs = docs.slice(0, limit);
    const pack = await ensurePack(`tk-${cat.id}`, `${cat.source.title} ${cat.label}`, cat.documentName);
    const entries = docs.map(d => { const data = d.toObject(); delete data._id; delete data.folder; data._stats = { compendiumSource: d.uuid };
      data.system.source = { ...(data.system.source ?? {}), book: data.system.source?.book || cat.source.title, license: cat.source.license }; return { sourceId: d.uuid, data }; });
    const r = await writeEntries(pack, entries, { policy, sourceKey: cat.source.key, meta: { license: cat.source.license, attributionKey: cat.source.key }, onProgress: (n, t) => onProgress?.(cat, n, t) });
    await recordAttribution({ key: cat.source.key, title: cat.source.title, license: cat.source.license, attribution: cat.source.attribution, packs: [pack.collection] });
    out.push({ id, pack: pack.collection, notOpenLicensed: filteredOut, ...r });
  }
  return out;
}

/** Convert text (JSON / CSV / stat block) to dnd5e data without writing anything. */
export function preview(text, { format = "auto", license, attribution, title } = {}) {
  const parsed = C.parseInput(text, format); const meta = { ...parsed.meta, ...(license ? { license } : {}), ...(attribution ? { attribution } : {}), ...(title ? { title } : {}) };
  const docs = parsed.records.map(r => ({ record: r, ...C.toDocument(r, meta) }));
  const errors = C.checkLicense(meta, parsed.records);
  return { format: parsed.format, meta, docs, errors };
}

/** Import custom open content. Monsters go to "<name> Monsters", items/spells to "<name> Items". */
export async function importText(text, { format = "auto", license, attribution, title, url = "", compendium, policy } = {}) {
  if (!game.user.isGM) throw new Error(L("GMOnly"));
  const p = preview(text, { format, license, attribution, title });
  if (p.errors.length) { const e = new Error(p.errors.join(" ")); e.licensing = true; throw e; }
  if (!p.docs.length) throw new Error(L("NothingFound"));
  const base = compendium?.trim() || p.meta.title || "Imported Content"; const key = `custom-${C.slug(p.meta.title || base)}`;
  const out = [];
  for (const dn of ["Actor", "Item"]) {
    const docs = p.docs.filter(d => d.documentName === dn); if (!docs.length) continue;
    const pack = await ensurePack(`tk-${C.slug(base).slice(0, 40)}-${dn === "Actor" ? "actors" : "items"}`, `${base} ${dn === "Actor" ? L("Creatures") : L("Items")}`, dn);
    const entries = docs.map(d => ({ sourceId: `${key}:${dn}:${d.data.type}:${C.slug(d.data.name)}`, data: d.data }));
    out.push(await writeEntries(pack, entries, { policy, sourceKey: key, meta: { license: C.normLicense(p.meta.license), attributionKey: key } }));
  }
  await recordAttribution({ key, title: p.meta.title || base, license: p.meta.license, attribution: p.meta.attribution, url: url || p.meta.url, packs: out.map(r => r.pack) });
  return out;
}

// ---------------------------------------------------------------- UI
const { ApplicationV2 } = foundry.applications.api;
export class ImporterApp extends ApplicationV2 {
  static DEFAULT_OPTIONS = { id: "tkui-app", classes: ["tkui-app"], tag: "div", window: { title: "TKUI.Title", icon: "fa-solid fa-file-import", resizable: true }, position: { width: 760, height: 720 },
    actions: { switchTab: ImporterApp.#tab, srd: ImporterApp.#srd, preview: ImporterApp.#preview, import: ImporterApp.#import, file: ImporterApp.#file, attribution: ImporterApp.#openAttr, all: ImporterApp.#all } };
  tabName = "srd"; status = ""; results = null; draft = { text: "", format: "auto", license: "CC-BY-4.0", attribution: "", title: "", url: "", compendium: "" }; previewData = null;
  get title() { return L("Title"); }
  async _renderHTML() {
    const t = this.tabName; const d = this.draft;
    const tabs = ["srd", "custom", "about"].map(k => `<a class="tkui-tab ${t === k ? "active" : ""}" data-action="switchTab" data-tab="${k}">${esc(L(`Tab.${k}`))}</a>`).join("");
    const groups = Object.values(SOURCES).map(s => `<fieldset class="tkui-src" data-source="${s.key}"><legend>${esc(s.title)} <span class="tkui-lic">CC-BY-4.0</span></legend>
      ${CATALOG.filter(c => c.source === s).map(c => { const pk = game.packs.get(`world.tk-${c.id}`); return `<label class="tkui-cat"><input type="checkbox" name="cat" value="${c.id}" ${["srd51-monsters", "srd51-spells", "srd51-items"].includes(c.id) ? "checked" : ""}> ${esc(c.label)}
        ${pk ? `<span class="tkui-have" title="${esc(pk.collection)}">✓ ${pk.index.size}</span>` : ""}</label>`; }).join("")}
      <p class="tkui-attr">${esc(s.attribution)}</p></fieldset>`).join("");
    const res = this.results ? `<div class="tkui-results">${this.results.map(r => r.error ? `<div class="tkui-err">${esc(r.error)}</div>` : `<div class="tkui-res" data-pack="${esc(r.pack)}"><code>${esc(r.pack)}</code>
      ${esc(L("ResultLine", { c: r.created, u: r.updated, s: r.unchanged, k: r.keptEdited + (r.skipped ?? 0), f: r.failed }))}${r.notOpenLicensed ? ` <span class="tkui-dim">${esc(L("NotOpen", { n: r.notOpenLicensed }))}</span>` : ""}</div>`).join("")}</div>` : "";
    const lic = Object.entries(C.LICENSES).map(([k, v]) => `<option value="${k}" ${d.license === k ? "selected" : ""}>${esc(v.name)}</option>`).join("");
    const pv = this.previewData ? `<div class="tkui-preview">${this.previewData.errors.map(e => `<div class="tkui-err">${esc(e)}</div>`).join("")}
      <table><thead><tr><th>${esc(L("Name"))}</th><th>${esc(L("Type"))}</th><th>${esc(L("Summary"))}</th></tr></thead><tbody>${this.previewData.docs.map(x => `<tr><td>${esc(x.data.name)}</td><td>${esc(x.data.type)}</td><td>${esc(summary(x.data))}</td></tr>`).join("")}</tbody></table></div>` : "";
    const body = t === "srd" ? `<p>${esc(L("SrdIntro"))}</p><form class="tkui-srd">${groups}</form>
        <div class="tkui-bar"><button type="button" data-action="all"><i class="fa-solid fa-list-check"></i> ${esc(L("SelectAll"))}</button><button type="button" class="tkui-go" data-action="srd"><i class="fa-solid fa-file-import"></i> ${esc(L("ImportSelected"))}</button></div>`
      : t === "custom" ? `<p>${esc(L("CustomIntro"))}</p><form class="tkui-custom" autocomplete="off">
        <div class="tkui-row"><label>${esc(L("Format"))}</label><select name="format">${["auto", "json", "csv", "statblock"].map(f => `<option value="${f}" ${d.format === f ? "selected" : ""}>${esc(L(`Fmt.${f}`))}</option>`).join("")}</select>
          <button type="button" data-action="file"><i class="fa-solid fa-folder-open"></i> ${esc(L("LoadFile"))}</button><input type="file" name="file" accept=".json,.csv,.txt,.md" hidden></div>
        <textarea name="text" rows="12" placeholder="${esc(L("PastePlaceholder"))}">${esc(d.text)}</textarea>
        <div class="tkui-row"><label>${esc(L("SourceTitle"))}</label><input name="title" value="${esc(d.title)}" placeholder="e.g. Tome of Open Beasts"></div>
        <div class="tkui-row"><label>${esc(L("License"))}</label><select name="license">${lic}</select></div>
        <div class="tkui-row"><label>${esc(L("Attribution"))}</label><textarea name="attribution" rows="2" placeholder="${esc(L("AttributionPlaceholder"))}">${esc(d.attribution)}</textarea></div>
        <div class="tkui-row"><label>${esc(L("SourceUrl"))}</label><input name="url" value="${esc(d.url)}"></div>
        <div class="tkui-row"><label>${esc(L("Compendium"))}</label><input name="compendium" value="${esc(d.compendium)}" placeholder="${esc(L("CompendiumPlaceholder"))}"></div>
        <p class="tkui-dim">${esc(L("LicenseDeclaration"))}</p></form>
        <div class="tkui-bar"><button type="button" data-action="preview"><i class="fa-solid fa-eye"></i> ${esc(L("Preview"))}</button><button type="button" class="tkui-go" data-action="import"><i class="fa-solid fa-file-import"></i> ${esc(L("Import"))}</button></div>${pv}`
      : `<div class="tkui-about">${L("About")}</div><div class="tkui-bar"><button type="button" data-action="attribution"><i class="fa-solid fa-scale-balanced"></i> ${esc(L("OpenAttribution"))}</button></div>`;
    return `<nav class="tkui-tabs">${tabs}</nav><section class="tkui-body">${body}<div class="tkui-status">${esc(this.status)}</div>${res}</section>`;
  }
  _replaceHTML(result, content) { content.innerHTML = result; }
  _onRender() { const f = this.element.querySelector("form.tkui-custom"); if (!f) return;
    f.addEventListener("input", () => this.#readDraft());
    f.querySelector("input[type=file]")?.addEventListener("change", async ev => { const file = ev.target.files?.[0]; if (!file) return; this.#readDraft(); this.draft.text = await file.text();
      if (/\.json$/i.test(file.name)) this.draft.format = "json"; else if (/\.csv$/i.test(file.name)) this.draft.format = "csv"; this.render(); }); }
  #readDraft() { const f = this.element.querySelector("form.tkui-custom"); if (!f) return; for (const k of Object.keys(this.draft)) if (f.elements[k]) this.draft[k] = f.elements[k].value; }
  setStatus(s) { this.status = s; const el = this.element?.querySelector(".tkui-status"); if (el) el.textContent = s; }
  static #tab(_e, t) { this.#readDraft(); this.tabName = t.dataset.tab; this.results = null; this.render(); }
  static #all() { this.element.querySelectorAll("input[name=cat]").forEach(c => c.checked = true); }
  static async #srd() {
    const ids = [...this.element.querySelectorAll("input[name=cat]:checked")].map(c => c.value); if (!ids.length) return ui.notifications.warn(L("PickOne"));
    this.setStatus(L("Working")); this.element.querySelectorAll("button").forEach(b => b.disabled = true);
    try { this.results = await importSRD(ids, { onProgress: (c, n, t) => this.setStatus(`${c.source.title} ${c.label}: ${n}/${t}`) }); this.status = L("Done"); ui.notifications.info(L("Done")); }
    catch (e) { this.status = e.message; ui.notifications.error(e.message); }
    this.render();
  }
  static #preview() { this.#readDraft(); try { this.previewData = preview(this.draft.text, this.draft); this.status = L("PreviewCount", { n: this.previewData.docs.length }); } catch (e) { this.previewData = null; this.status = e.message; } this.render(); }
  static async #import() { this.#readDraft(); this.setStatus(L("Working"));
    try { this.results = await importText(this.draft.text, this.draft); this.previewData = null; this.status = L("Done"); ui.notifications.info(L("Done")); }
    catch (e) { this.status = e.message; this.results = null; ui.notifications[e.licensing ? "warn" : "error"](e.message); }
    this.render(); }
  static #file() { this.element.querySelector("input[type=file]")?.click(); }
  static #openAttr() { game.journal.find(x => x.getFlag(ID, "attribution"))?.sheet.render(true) ?? ui.notifications.info(L("NoAttribution")); }
}
function summary(d) {
  const s = d.system ?? {};
  if (d.type === "npc") return `CR ${s.details?.cr ?? "?"} · AC ${s.attributes?.ac?.flat ?? "?"} · HP ${s.attributes?.hp?.max ?? "?"} · ${d.items?.length ?? 0} features`;
  if (d.type === "spell") return `Level ${s.level} ${s.school}`;
  return `${s.price?.value ?? 0} ${s.price?.denomination ?? "gp"} · ${s.weight?.value ?? 0} lb`;
}

class OpenApp extends ApplicationV2 { async render() { open(); return this; } }
let app = null;
export function open(tab) { if (!game.user.isGM) { ui.notifications.warn(L("GMOnly")); return null; } app ??= new ImporterApp(); if (tab) app.tabName = tab; app.render({ force: true }); return app; }

Hooks.once("init", () => {
  game.settings.registerMenu(ID, "open", { name: L("Title"), label: L("Open"), hint: L("MenuHint"), icon: "fa-solid fa-file-import", type: OpenApp, restricted: true });
  game.settings.register(ID, "duplicatePolicy", { name: L("S.dup"), hint: L("S.dupHint"), scope: "world", config: true, type: String, default: "update",
    choices: { update: L("S.dupUpdate"), skip: L("S.dupSkip"), overwrite: L("S.dupOverwrite") } });
  game.modules.get(ID).api = { open, importSRD, importText, preview, writeEntries, ensurePack, recordAttribution, catalog: CATALOG, sources: SOURCES, convert: C, get app() { return app; } };
});
Hooks.on("renderCompendiumDirectory", (_app, html) => {
  if (!game.user.isGM) return; const root = html instanceof HTMLElement ? html : html?.[0]; if (!root || root.querySelector("#tkui-open")) return;
  const btn = document.createElement("button"); btn.type = "button"; btn.id = "tkui-open"; btn.innerHTML = `<i class="fa-solid fa-file-import"></i> ${esc(L("Open"))}`;
  btn.addEventListener("click", () => open());
  (root.querySelector(".header-actions, .directory-header .action-buttons") ?? root.querySelector("header") ?? root).append(btn);
});
Hooks.once("ready", () => { if (game.system.id !== "dnd5e") console.warn(`${ID} | designed for dnd5e; current system is ${game.system.id}`); });
