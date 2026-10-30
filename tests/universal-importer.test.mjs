// Three Keys Universal Importer end-to-end test (GM client in headless Chromium against the foundry-test server).
// Usage: tests/run.sh   or   node tests/universal-importer.test.mjs   (env: URL, FOUNDRY_TESTS, OUT)
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url)); const MOD = dirname(here);
const FT = process.env.FOUNDRY_TESTS || join(MOD, '../foundry-test/tests');
const { chromium } = createRequire(join(FT, 'package.json'))('playwright');
const base = process.env.URL || 'http://localhost:30000';
const out = process.env.OUT || join(FT, 'out', 'universal-importer'); mkdirSync(out, { recursive: true });
const ID = 'three-keys-universal-importer';
const results = [], errors = [], shots = []; let lastStep = 'start';
const ok = (name, pass, detail = '') => { lastStep = name; results.push({ name, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, baseURL: base });
await ctx.route(url => !url.toString().startsWith(base), route => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' }));
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') errors.push(`console [after: ${lastStep}]: ${m.text()}`); });
page.on('pageerror', e => errors.push(`pageerror [after: ${lastStep}]: ${e.stack || e.message}`));
const shot = async (name, loc) => { const p = join(out, `${name}.png`); await (loc ? page.locator(loc).screenshot({ path: p }) : page.screenshot({ path: p })); shots.push(p); };
const ev = (fn, arg) => page.evaluate(([ID, src, arg]) => eval(src)(game.modules.get(ID).api, arg, ID), [ID, fn.toString(), arg]);
const cleanup = () => ev(async (a, _, ID) => { for (const p of [...game.packs].filter(p => p.metadata.packageType === 'world' && p.metadata.name.startsWith('tk-'))) await p.deleteCompendium();
  for (const j of game.journal.filter(j => j.getFlag(ID, 'attribution'))) await j.delete(); await game.settings.set(ID, 'duplicatePolicy', 'update'); a.app?.close(); });
const sample = f => readFileSync(join(MOD, 'samples', f), 'utf8');
try {
  await page.goto(base + '/join'); await page.waitForSelector('select[name="userId"]', { timeout: 60000 });
  const uid = await page.$eval('select[name="userId"]', s => [...s.options].find(o => o.textContent.trim() === 'Gamemaster')?.value);
  await page.selectOption('select[name="userId"]', uid); await page.click('button[name="join"]');
  await page.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: 120000 }); await sleep(1500);
  await cleanup();

  // ---------- load ----------
  const ld = await ev((a, _, ID) => ({ active: game.modules.get(ID)?.active, api: ['open', 'importSRD', 'importText', 'preview'].every(k => typeof a[k] === 'function'), cats: a.catalog.length, sys: game.system.id + ' ' + game.system.version, core: game.version, setting: game.settings.get(ID, 'duplicatePolicy') }));
  ok('Module loads on Foundry v14 + dnd5e 5.3.3 with API and settings', ld.active && ld.api && ld.cats === 16 && ld.setting === 'update' && /^14/.test(ld.core), JSON.stringify(ld));

  // ---------- open UI from the Compendium sidebar ----------
  await page.click('[data-tab="compendium"]').catch(() => {}); await sleep(800);
  const hasBtn = await page.$('#tkui-open'); if (hasBtn) await page.click('#tkui-open'); else await ev(a => a.open());
  await page.waitForSelector('#tkui-app', { timeout: 10000 }); await sleep(500);
  ok('"Universal Importer" button in the Compendium sidebar opens the importer', !!hasBtn);
  const ui1 = await page.evaluate(() => ({ cats: document.querySelectorAll('#tkui-app input[name=cat]').length, attr: [...document.querySelectorAll('#tkui-app .tkui-attr')].map(e => e.textContent).join(' '), raw: (document.querySelector('#tkui-app').innerText.match(/TKUI\./g) || []).length }));
  ok('SRD tab lists 16 categories with the full SRD 5.1 + 5.2 attribution notices; strings localized', ui1.cats === 16 && /SRD 5\.1.*Creative Commons Attribution 4\.0/.test(ui1.attr) && /SRD 5\.2/.test(ui1.attr) && ui1.raw === 0, `cats ${ui1.cats}, raw keys ${ui1.raw}`);
  await shot('01-srd-tab', '#tkui-app');

  // ---------- SRD import via API (sample monsters / spells / items) ----------
  const r1 = await ev(a => a.importSRD(['srd51-monsters', 'srd51-spells', 'srd51-items', 'srd52-monsters', 'srd52-spells'], { names: ['Goblin', 'Adult Red Dragon', 'Fireball', 'Cure Wounds', 'Longsword', 'Potion of Healing', 'Plate Armor', 'Goblin Warrior'] }));
  ok('SRD import creates world compendiums with the requested entries', r1.every(r => !r.error && r.failed === 0) && r1.map(r => r.created).join() === '2,2,3,2,2', r1.map(r => `${r.pack}:${r.created}`).join(' '));
  const chk = await ev(async () => {
    const m = await game.packs.get('world.tk-srd51-monsters').getDocuments(); const g = m.find(d => d.name === 'Goblin'), d = m.find(d => d.name === 'Adult Red Dragon');
    const s = await game.packs.get('world.tk-srd51-spells').getDocuments(); const fb = s.find(x => x.name === 'Fireball');
    const it = await game.packs.get('world.tk-srd51-items').getDocuments(); const ls = it.find(x => x.name === 'Longsword'), po = it.find(x => x.name === 'Potion of Healing'), pl = it.find(x => x.name === 'Plate Armor');
    const gw = (await game.packs.get('world.tk-srd52-monsters').getDocuments()).find(x => x.name === 'Goblin Warrior');
    const scim = g.items.find(i => i.name === 'Scimitar');
    return { g: { type: g.type, cr: g.system.details.cr, hp: g.system.attributes.hp.max, ac: g.system.attributes.ac.value, dex: g.system.abilities.dex.value, size: g.system.traits.size, items: g.items.size, scimHit: scim?.system.activities.contents[0]?.labels?.toHit, lic: g.system.source.license, src: g._stats.compendiumSource, flag: g.flags['three-keys-universal-importer']?.sourceId },
      d: { cr: d.system.details.cr, legact: d.system.resources?.legact?.max, hp: d.system.attributes.hp.max },
      fb: { type: fb.type, level: fb.system.level, school: fb.system.school, act: fb.system.activities.contents[0]?.type, dmg: fb.system.activities.contents[0]?.damage?.parts?.[0]?.formula ?? fb.system.activities.contents[0]?.damage?.parts?.[0]?.number + 'd' + fb.system.activities.contents[0]?.damage?.parts?.[0]?.denomination },
      ls: { type: ls.type, base: ls.system.damage.base.formula, price: ls.system.price.value }, po: po?.type, pl: { type: pl?.type, ac: pl?.system.armor.value },
      gw: { name: gw.name, cr: gw.system.details.cr, rules: gw.system.source.rules, lic: gw.system.source.license } };
  });
  ok('SRD Goblin is a correct dnd5e NPC (CR 1/4, HP 7, AC 15, Dex 14, Small, Scimitar +4 to hit)', chk.g.type === 'npc' && chk.g.cr === 0.25 && chk.g.hp === 7 && chk.g.ac === 15 && chk.g.dex === 14 && chk.g.size === 'sm' && chk.g.scimHit === '+4', JSON.stringify(chk.g));
  ok('SRD entries keep provenance (CC-BY-4.0 licence, compendiumSource, importer source id)', chk.g.lic === 'CC-BY-4.0' && /^Compendium\.dnd5e\.monsters\./.test(chk.g.src) && chk.g.flag === chk.g.src);
  ok('SRD Adult Red Dragon: CR 17, HP 256, 3 legendary actions', chk.d.cr === 17 && chk.d.hp === 256 && chk.d.legact === 3, JSON.stringify(chk.d));
  ok('SRD Fireball: level 3 evocation spell with an 8d6 save activity', chk.fb.type === 'spell' && chk.fb.level === 3 && chk.fb.school === 'evo' && chk.fb.act === 'save' && /8d6/.test(chk.fb.dmg), JSON.stringify(chk.fb));
  ok('SRD items: Longsword weapon 1d8 / 15 gp, Potion of Healing consumable, Plate Armor AC 18', chk.ls.type === 'weapon' && /1d8/.test(chk.ls.base) && chk.ls.price === 15 && chk.po === 'consumable' && chk.pl.type === 'equipment' && chk.pl.ac === 18, JSON.stringify([chk.ls, chk.po, chk.pl]));
  ok('SRD 5.2 Goblin Warrior imported as 2024 rules, CC-BY-4.0', chk.gw.name === 'Goblin Warrior' && chk.gw.rules === '2024' && chk.gw.lic === 'CC-BY-4.0', JSON.stringify(chk.gw));
  const att = await ev((a, _, ID) => { const j = game.journal.find(j => j.getFlag(ID, 'attribution')); return { pages: j?.pages.map(p => p.name), txt: j?.pages.map(p => p.text.content).join(' ') }; });
  ok('Attribution journal records SRD 5.1 and SRD 5.2 with the exact CC-BY-4.0 notices', att.pages?.includes('SRD 5.1') && att.pages?.includes('SRD 5.2') && /System Reference Document 5\.1.*creativecommons\.org\/licenses\/by\/4\.0/s.test(att.txt) && /tk-srd51-monsters/.test(att.txt), JSON.stringify(att.pages));

  // ---------- duplicates ----------
  const r2 = await ev(a => a.importSRD(['srd51-monsters', 'srd51-spells'], { names: ['Goblin', 'Adult Red Dragon', 'Fireball', 'Cure Wounds'] }));
  const cnt = await ev(async () => (await game.packs.get('world.tk-srd51-monsters').getIndex()).size);
  ok('Re-importing the same SRD entries creates no duplicates (all unchanged)', r2.every(r => r.created === 0 && r.unchanged === 2) && cnt === 2, r2.map(r => JSON.stringify({ c: r.created, u: r.unchanged })).join(' '));

  // ---------- custom import: JSON / CSV / stat block ----------
  const j1 = await ev((a, t) => a.importText(t, { compendium: 'Open Bestiary' }), sample('three-keys-open-bestiary.json'));
  const cj = await ev(async () => { const A = (await game.packs.get('world.tk-open-bestiary-actors').getDocuments())[0]; const I = await game.packs.get('world.tk-open-bestiary-items').getDocuments();
    const touch = A.items.find(i => i.name === 'Searing Touch')?.system.activities.contents[0]; const lure = A.items.find(i => /^Lure/.test(i.name));
    return { name: A.name, cr: A.system.details.cr, fly: A.system.attributes.movement.fly, hover: A.system.attributes.movement.hover, di: [...A.system.traits.di.value], touch: [touch?.type, touch?.labels?.toHit], lure: [lure?.system.activities.contents[0]?.type, lure?.system.activities.contents[0]?.save?.dc?.value, lure?.system.uses?.max], lic: A.system.source.license,
      items: I.map(i => `${i.name}:${i.type}`).sort(), mote: I.find(i => i.name === 'Lantern Mote')?.system.properties.has('concentration') };
  });
  ok('JSON import (CC0 sample): NPC with fly/hover, immunities, attack (+5) and save (DC 12, recharge) activities', j1.every(r => r.created > 0) && cj.cr === 0.5 && cj.fly === 40 && cj.hover && cj.di.includes('fire') && cj.touch[0] === 'attack' && cj.touch[1] === '+5' && cj.lure[0] === 'save' && cj.lure[1] === 12 && cj.lure[2] === 1 && cj.lic === 'CC0-1.0', JSON.stringify(cj));
  ok('JSON import: spell (concentration) and wondrous item land in the items compendium', cj.items.join() === 'Lantern Mote:spell,Marsh Lantern:equipment' && cj.mote, cj.items.join());
  const c1 = await ev((a, t) => a.importText(t, { format: 'csv', license: 'CC0-1.0', title: 'Open Items CSV' }), sample('open-items.csv'));
  const cc = await ev(async () => (await game.packs.get('world.tk-open-items-csv-items').getDocuments()).map(i => `${i.name}:${i.type}:${i.system.price.value}`).sort());
  ok('CSV import: 3 items with correct types and prices', c1[0]?.created === 3 && cc.join() === 'Ember Charm:equipment:120,Fen Spear:weapon:2,Peat Tonic:consumable:25', cc.join());

  // stat block through the UI
  await page.click('#tkui-app .tkui-tab[data-tab="custom"]'); await sleep(600);
  await page.fill('#tkui-app textarea[name=text]', sample('statblock-example.txt'));
  await page.selectOption('#tkui-app select[name=license]', 'CC0-1.0'); await page.fill('#tkui-app input[name=title]', 'Marsh Monsters');
  await page.click('#tkui-app [data-action=preview]'); await sleep(600);
  const pv = await page.evaluate(() => [...document.querySelectorAll('#tkui-app .tkui-preview tbody tr')].map(r => r.innerText.replace(/\s+/g, ' ')));
  ok('Stat-block text: Preview shows the parsed creature (CR 1, AC 14, HP 33)', pv.length === 1 && /Reed Stalker/.test(pv[0]) && /CR 1 · AC 14 · HP 33/.test(pv[0]), pv.join(' | '));
  await shot('02-statblock-preview', '#tkui-app');
  await page.click('#tkui-app .tkui-go'); await page.waitForSelector('#tkui-app .tkui-res', { timeout: 20000 }); await sleep(400);
  const sb = await ev(async () => { const A = (await game.packs.get('world.tk-marsh-monsters-actors').getDocuments())[0]; return { n: A?.name, swim: A?.system.attributes.movement.swim, stealth: A?.system.skills.ste.value, atk: A?.items.filter(i => i.system.activities.contents[0]?.type === 'attack').length }; });
  ok('Stat-block text: Import button creates the NPC (swim 30, Stealth proficient, 2 attacks)', sb.n === 'Reed Stalker' && sb.swim === 30 && sb.stealth >= 1 && sb.atk === 2, JSON.stringify(sb));
  await shot('03-statblock-imported', '#tkui-app');

  // ---------- licensing gate ----------
  await page.selectOption('#tkui-app select[name=license]', 'CC-BY-4.0'); await page.fill('#tkui-app textarea[name=attribution]', '');
  await page.fill('#tkui-app input[name=title]', 'Unattributed'); await page.click('#tkui-app .tkui-go'); await sleep(800);
  const refused = await page.evaluate(() => document.querySelector('#tkui-app .tkui-status')?.textContent);
  const noPack = await ev(() => !game.packs.get('world.tk-unattributed-actors'));
  ok('Licence gate (UI): CC-BY without attribution is refused, nothing written', /requires an attribution/i.test(refused) && noPack, refused);
  await shot('04-licence-refused', '#tkui-app');
  const ddb = await ev(a => a.importText(JSON.stringify([{ name: 'Beholder', type: 'npc', system: { source: { book: 'Monster Manual' } }, flags: { ddbimporter: { id: 1 } } }]), { license: 'CC-BY-4.0', attribution: 'x' }).then(() => 'imported', e => e.message));
  const prop = await ev(a => a.importText('[{"name":"Thing","hp":5}]', { license: 'All rights reserved' }).then(() => 'imported', e => e.message));
  ok('Licence gate (API): D&D Beyond / non-SRD book data and proprietary licences are refused', /D&D Beyond/.test(ddb) && /Monster Manual/.test(ddb) && /not allowed/.test(prop), `${ddb} | ${prop}`);

  // ---------- updates and local edits ----------
  const bj = JSON.parse(sample('three-keys-open-bestiary.json'));
  bj.results[0].hp = 30; const u1 = await ev((a, t) => a.importText(t, { compendium: 'Open Bestiary' }), JSON.stringify(bj));
  const hp1 = await ev(async () => (await game.packs.get('world.tk-open-bestiary-actors').getDocuments())[0].system.attributes.hp.max);
  ok('Changed source entry is updated in place; unchanged entries skipped', u1[0].updated === 1 && u1[1].unchanged === 2 && hp1 === 30, JSON.stringify(u1.map(r => [r.created, r.updated, r.unchanged])));
  await ev(async () => { const A = (await game.packs.get('world.tk-open-bestiary-actors').getDocuments())[0]; await A.update({ 'system.attributes.hp.max': 44, 'system.attributes.hp.value': 44 }); });
  bj.results[0].hp = 31; const u2 = await ev((a, t) => a.importText(t, { compendium: 'Open Bestiary' }), JSON.stringify(bj));
  const hp2 = await ev(async () => (await game.packs.get('world.tk-open-bestiary-actors').getDocuments())[0].system.attributes.hp.max);
  ok('Locally edited entry is kept on re-import (policy "Update")', u2[0].keptEdited === 1 && hp2 === 44, `hp ${hp2}`);
  await ev((a, _, ID) => game.settings.set(ID, 'duplicatePolicy', 'overwrite')); const u3 = await ev((a, t) => a.importText(t, { compendium: 'Open Bestiary' }), JSON.stringify(bj));
  const hp3 = await ev(async () => { const p = game.packs.get('world.tk-open-bestiary-actors'); return { hp: (await p.getDocuments())[0].system.attributes.hp.max, n: (await p.getIndex()).size }; });
  ok('Policy "Overwrite" replaces the edited entry without duplicating it', u3[0].updated === 1 && hp3.hp === 31 && hp3.n === 1, JSON.stringify(hp3));
  await ev((a, _, ID) => game.settings.set(ID, 'duplicatePolicy', 'update'));

  // ---------- one-click full category via the UI ----------
  await page.click('#tkui-app .tkui-tab[data-tab="srd"]'); await sleep(600);
  await page.evaluate(() => document.querySelectorAll('#tkui-app input[name=cat]').forEach(c => c.checked = c.value === 'srd51-spells'));
  const t0 = Date.now(); await page.click('#tkui-app .tkui-go'); await page.waitForSelector('#tkui-app .tkui-res', { timeout: 180000 }); const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const full = await ev(async () => ({ n: (await game.packs.get('world.tk-srd51-spells').getIndex()).size, line: document.querySelector('#tkui-app .tkui-res')?.innerText }));
  ok('One click imports the whole SRD 5.1 spell list (≥300 spells, previously imported ones kept)', full.n >= 300, `${full.n} spells in ${secs}s — ${full.line}`);
  await shot('05-srd-full-spells', '#tkui-app'); await shot('06-full-window');
  await page.click('#tkui-app .tkui-tab[data-tab="about"]'); await sleep(400); await shot('07-licensing-tab', '#tkui-app');
} catch (e) { errors.push(`fatal [after: ${lastStep}]: ${e.stack || e.message}`); }
finally { await cleanup().catch(e => errors.push('cleanup: ' + e.message)); await sleep(500); }
const relevant = errors.filter(e => !/favicon|ERR_FAILED.*(news|foundryvtt\.com)|screen resolution/i.test(e));
ok('No console or page errors during the whole run', relevant.length === 0, relevant.slice(0, 5).join(' | '));
const pass = results.filter(r => r.pass).length;
writeFileSync(join(out, 'results.json'), JSON.stringify({ pass, total: results.length, results, errors, shots }, null, 2));
console.log(`\n${pass}/${results.length} passed. Screenshots:\n${shots.join('\n')}`);
await browser.close(); process.exit(pass === results.length ? 0 : 1);
