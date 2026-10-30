// Three Keys Universal Importer — pure conversion helpers (no Foundry globals; unit-testable in Node).
// Turns JSON / CSV / pasted stat-block text into dnd5e 5.x document data (Actor "npc", Item "spell" / "weapon" / "equipment" / "consumable" / "loot" / "feat").

export const LICENSES = {
  "CC-BY-4.0": { name: "Creative Commons Attribution 4.0", url: "https://creativecommons.org/licenses/by/4.0/legalcode", attribution: true },
  "OGL-1.0a": { name: "Open Game License v1.0a", url: "https://opengamingfoundation.org/ogl.html", attribution: true },
  "CC0-1.0": { name: "Creative Commons Zero 1.0 (public domain)", url: "https://creativecommons.org/publicdomain/zero/1.0/legalcode", attribution: false }
};
const LICENSE_ALIASES = { "cc-by-4.0": "CC-BY-4.0", "cc by 4.0": "CC-BY-4.0", "cc-by": "CC-BY-4.0", "ccby4": "CC-BY-4.0", "ogl": "OGL-1.0a", "ogl-1.0a": "OGL-1.0a", "ogl 1.0a": "OGL-1.0a", "open game license": "OGL-1.0a", "cc0": "CC0-1.0", "cc0-1.0": "CC0-1.0", "public domain": "CC0-1.0" };
export const normLicense = l => { if (!l) return null; const s = String(l).trim(); return LICENSES[s] ? s : LICENSE_ALIASES[s.toLowerCase()] ?? null; };

// WotC books that are NOT open content. Anything tagged with these (and not explicitly SRD) is refused.
const CLOSED_BOOKS = /^(MM|PHB|DMG|XGE|XGtE|TCE|TCoE|VGM|VGtM|MTF|MToF|FTD|MPMM|BGG|SCC|VRGR|GGR|ERLW|EGW|AI|IDRotF|WBtW|SCAG|TOA|CoS|LMoP|PotA|OotA|SKT|HotDQ|RoT|DiA|BGDIA|SAiS|BMT|CoA|XPHB|XDMG|XMM|Monster Manual|Player'?s Handbook|Dungeon Master'?s Guide|Xanathar|Tasha|Volo|Mordenkainen|Fizban|Bigby)\b/i;
/** Licensing gate. Returns a list of human-readable problems (empty = OK). */
export function checkLicense(meta = {}, docs = []) {
  const errs = []; const lic = normLicense(meta.license);
  if (!lic) errs.push(`License "${meta.license ?? ""}" is not allowed. Only CC-BY-4.0, OGL-1.0a or CC0-1.0 content can be imported.`);
  else if (LICENSES[lic].attribution && !String(meta.attribution ?? "").trim()) errs.push(`${lic} requires an attribution notice (who made it, title, licence).`);
  const blob = JSON.stringify(meta) + " " + docs.slice(0, 2000).map(d => JSON.stringify([d.flags ?? {}, d.system?.source ?? {}])).join(" ");
  if (/dndbeyond\.com|d&d ?beyond|ddbimporter|ddb-importer/i.test(blob) && !/dndbeyond\.com\/srd/i.test(blob)) errs.push("Content from D&D Beyond (or the DDB Importer) is not openly licensed and cannot be imported here.");
  for (const d of docs) { const b = d.system?.source?.book ?? d.source ?? ""; if (b && CLOSED_BOOKS.test(String(b)) && !/srd/i.test(String(b))) { errs.push(`"${d.name}" is tagged with the non-open book "${b}". Only SRD / openly licensed content is allowed.`); break; } }
  return errs;
}

export const slug = s => String(s ?? "").toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-");
/** Stable content hash (FNV-1a over canonical JSON) used to detect upstream changes and local edits. */
export function hash(obj) {
  const canon = v => Array.isArray(v) ? `[${v.map(canon).join(",")}]` : v && typeof v === "object" ? `{${Object.keys(v).sort().filter(k => !["_id", "_stats", "folder", "sort", "ownership", "flags"].includes(k)).map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}` : JSON.stringify(v ?? null);
  let h = 0x811c9dc5; const s = canon(obj); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0");
}

// ---------------------------------------------------------------- small parsers
const num = v => { if (v === null || v === undefined || v === "") return null; const m = String(v).replace(/[−–]/g, "-").match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : null; };
export function parseCR(v) { if (v === null || v === undefined || v === "") return null; if (typeof v === "number") return v; const s = String(v).trim(); const f = s.match(/^(\d+)\s*\/\s*(\d+)/); return f ? Number(f[1]) / Number(f[2]) : num(s); }
const SIZES = { tiny: "tiny", small: "sm", sm: "sm", medium: "med", med: "med", large: "lg", lg: "lg", huge: "huge", gargantuan: "grg", grg: "grg" };
const TYPES = ["aberration", "beast", "celestial", "construct", "dragon", "elemental", "fey", "fiend", "giant", "humanoid", "monstrosity", "ooze", "plant", "undead"];
export const ABIL = ["str", "dex", "con", "int", "wis", "cha"];
const ABIL_LONG = { strength: "str", dexterity: "dex", constitution: "con", intelligence: "int", wisdom: "wis", charisma: "cha" };
const SKILLS = { acrobatics: "acr", "animal handling": "ani", arcana: "arc", athletics: "ath", deception: "dec", history: "his", insight: "ins", intimidation: "itm", investigation: "inv", medicine: "med", nature: "nat", perception: "prc", performance: "prf", persuasion: "per", religion: "rel", "sleight of hand": "slt", stealth: "ste", survival: "sur" };
const SCHOOLS = { abjuration: "abj", conjuration: "con", divination: "div", enchantment: "enc", evocation: "evo", illusion: "ill", necromancy: "nec", transmutation: "trs" };
const DMG = ["acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "piercing", "poison", "psychic", "radiant", "slashing", "thunder"];
const CONDS = ["blinded", "charmed", "deafened", "exhaustion", "frightened", "grappled", "incapacitated", "invisible", "paralyzed", "petrified", "poisoned", "prone", "restrained", "stunned", "unconscious"];
const LANGS = { common: "common", dwarvish: "dwarvish", elvish: "elvish", giant: "giant", gnomish: "gnomish", goblin: "goblin", halfling: "halfling", orc: "orc", abyssal: "abyssal", celestial: "celestial", draconic: "draconic", "deep speech": "deep", infernal: "infernal", primordial: "primordial", sylvan: "sylvan", undercommon: "undercommon", "thieves' cant": "cant", druidic: "druidic" };
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const html = s => { const t = String(s ?? "").trim(); if (!t) return ""; return /^<\w/.test(t) ? t : t.split(/\n{2,}|\r?\n(?=[•\-*] )/).map(p => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join(""); };
const list = v => Array.isArray(v) ? v : String(v ?? "").split(/[,;]\s*/).map(x => x.trim()).filter(Boolean);

export function parseSpeed(v) {
  const m = { walk: 0, burrow: 0, climb: 0, fly: 0, swim: 0, units: "ft", hover: false };
  if (v && typeof v === "object") { for (const k of ["walk", "burrow", "climb", "fly", "swim"]) if (v[k] !== undefined) m[k] = num(v[k]) ?? 0; m.hover = !!v.hover; return m; }
  for (const part of String(v ?? "").split(/,\s*/)) { const mm = part.match(/(?:(burrow|climb|fly|swim)\s+)?(\d+)\s*ft/i); if (mm) m[(mm[1] ?? "walk").toLowerCase()] = Number(mm[2]); if (/hover/i.test(part)) m.hover = true; }
  return m;
}
export function parseSenses(v) {
  const r = { darkvision: 0, blindsight: 0, tremorsense: 0, truesight: 0, special: "" }; const extra = [];
  for (const part of list(v)) { const mm = part.match(/(darkvision|blindsight|tremorsense|truesight)\s+(\d+)/i); if (mm) r[mm[1].toLowerCase()] = Number(mm[2]); else if (!/passive perception/i.test(part)) extra.push(part); }
  r.special = extra.join(", "); return r;
}
function traitSet(v, allowed) { const value = [], custom = []; for (const p of list(v)) { const k = p.toLowerCase().replace(/\.$/, ""); allowed.includes(k) ? value.push(k) : custom.push(p); } return { value, custom: custom.join("; ") }; }
function langs(v) { const value = [], custom = []; for (const p of list(v)) { const k = LANGS[p.toLowerCase().replace(/\.$/, "")]; k ? value.push(k) : (p !== "—" && p !== "-" && custom.push(p)); } return { value, custom: custom.join("; ") }; }

/** Parse "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage." (2014 and 2024 wording). */
export function parseAttack(desc) {
  const d = String(desc ?? "").replace(/[−–]/g, "-");
  const head = d.match(/(Melee|Ranged|Melee or Ranged)\s+(Weapon|Spell)?\s*Attack(?: Roll)?:\s*([+-]\d+)/i); if (!head) return null;
  const reach = d.match(/(?:reach|range)\s+(\d+)(?:\/(\d+))?\s*ft/i);
  const parts = []; const re = /\d+\s*\((\d+)d(\d+)\s*(?:([+-])\s*(\d+))?\)\s*(\w+)\s+damage/gi; let m;
  while ((m = re.exec(d))) { const t = m[5].toLowerCase(); parts.push({ number: Number(m[1]), denomination: Number(m[2]), bonus: m[4] ? `${m[3] === "-" ? "-" : ""}${m[4]}` : "", types: DMG.includes(t) ? [t] : [] }); }
  return { kind: /ranged/i.test(head[1]) && !/melee/i.test(head[1]) ? "ranged" : "melee", classification: /spell/i.test(head[2] ?? "") ? "spell" : "weapon", toHit: Number(head[3]), range: reach ? Number(reach[1]) : 5, long: reach?.[2] ? Number(reach[2]) : null, parts };
}
export function parseSave(desc) {
  const m = String(desc ?? "").match(/DC\s*(\d+)\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving throw|(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+Saving Throw:\s*DC\s*(\d+)/i);
  if (!m) return null; return { dc: Number(m[1] ?? m[4]), ability: ABIL_LONG[(m[2] ?? m[3]).toLowerCase()] };
}
const actId = i => `tkuiact${String(i).padStart(9, "0")}`.slice(0, 16);
/** Build a dnd5e "feat" item (monster feature / action) with an attack or save activity when the text supports one. */
export function featureItem({ name, desc, kind = "trait" }, i = 0) {
  const activation = { action: "action", bonus: "bonus", reaction: "reaction", legendary: "legendary" }[kind] ?? "";
  const sys = { description: { value: html(desc) }, type: { value: "monster", subtype: "" }, activities: {} };
  const recharge = String(name).match(/\(Recharge (\d)(?:[–-]6)?\)/i);
  if (recharge) sys.uses = { max: "1", spent: 0, recovery: [{ period: "recharge", formula: recharge[1] }] };
  const atk = parseAttack(desc), save = parseSave(desc);
  const base = { activation: { type: activation || "action", value: kind === "legendary" ? 1 : null, override: false }, sort: 0 };
  if (activation && atk) sys.activities[actId(i)] = { _id: actId(i), type: "attack", ...base, attack: { ability: "", bonus: String(atk.toHit), flat: true, type: { value: atk.kind, classification: atk.classification } },
    range: { value: String(atk.range), long: atk.long, units: "ft", override: true }, damage: { includeBase: false, parts: atk.parts.map(p => ({ ...p, custom: { enabled: false, formula: "" } })) } };
  else if (activation && save) sys.activities[actId(i)] = { _id: actId(i), type: "save", ...base, save: { ability: [save.ability], dc: { calculation: "", formula: String(save.dc) } },
    damage: { onSave: /half as much/i.test(desc) ? "half" : "none", parts: (parseAttack(`Melee Attack: +0 ${desc}`)?.parts ?? []).map(p => ({ ...p, custom: { enabled: false, formula: "" } })) } };
  else if (activation) sys.activities[actId(i)] = { _id: actId(i), type: "utility", ...base };
  return { name: String(name).replace(/\.$/, "").trim(), type: "feat", img: atk ? "icons/skills/melee/strike-sword-slashed-orange.webp" : "icons/svg/aura.svg", system: sys };
}

// ---------------------------------------------------------------- simple JSON shapes -> dnd5e
const pick = (o, ...keys) => { for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== "") return o[k]; return undefined; };
/** Guess the kind of a plain record (monster / spell / item) from its fields. */
export function detectKind(r) {
  const k = String(pick(r, "kind", "documentType") ?? "").toLowerCase(); if (["monster", "npc", "creature", "spell", "item"].includes(k)) return k === "npc" || k === "creature" ? "monster" : k;
  if (r.type && r.system) return r.type === "npc" ? "monster" : r.type === "spell" ? "spell" : "item";
  if (pick(r, "school", "level_int", "casting_time", "castingTime", "spell_level") !== undefined) return "spell";
  if (pick(r, "hp", "hit_points", "hitPoints", "challenge_rating", "cr", "armor_class", "ac", "str", "strength") !== undefined) return "monster";
  return "item";
}

export function toMonster(r, meta = {}) {
  const abil = {}; for (const a of ABIL) { const long = Object.keys(ABIL_LONG).find(k => ABIL_LONG[k] === a); abil[a] = { value: num(pick(r, a, long, a.toUpperCase())) ?? 10 }; }
  const saves = r.saves ?? r.saving_throws ?? Object.fromEntries(ABIL.map(a => [a, r[`${Object.keys(ABIL_LONG).find(k => ABIL_LONG[k] === a)}_save`]]).filter(x => x[1] !== undefined && x[1] !== null));
  for (const [a, v] of Object.entries(typeof saves === "string" ? Object.fromEntries(list(saves).map(p => { const m = p.match(/(\w+)\s*([+-]\d+)/); return m ? [m[1].toLowerCase().slice(0, 3), m[2]] : []; }).filter(x => x.length)) : saves)) if (abil[a] && v !== null && v !== undefined) abil[a].proficient = 1;
  const skills = {}; const sk = r.skills;
  for (const [n, v] of Object.entries(typeof sk === "string" ? Object.fromEntries(list(sk).map(p => { const m = p.match(/^(.+?)\s*([+-]\d+)$/); return m ? [m[1], m[2]] : []; }).filter(x => x.length)) : sk ?? {})) { const key = SKILLS[n.toLowerCase()]; if (key) skills[key] = { value: 1 }; }
  const acRaw = pick(r, "ac", "armor_class", "armorClass", "AC"); const ac = Array.isArray(acRaw) ? num(acRaw[0]?.value ?? acRaw[0]) : num(acRaw);
  const hpRaw = pick(r, "hp", "hit_points", "hitPoints", "HP"); const hp = num(typeof hpRaw === "object" ? hpRaw?.average ?? hpRaw?.value : hpRaw) ?? 1;
  const formula = String(pick(r, "hpFormula", "hit_dice", "hitDice", "hp_formula") ?? (String(hpRaw).match(/\(([^)]+)\)/)?.[1] ?? (typeof hpRaw === "object" ? hpRaw?.formula : "")) ?? "").replace(/\s+/g, " ").trim();
  const typeStr = String(pick(r, "creatureType", "creature_type", "monsterType") ?? (r.type && !r.system ? r.type : "") ?? "").toLowerCase();
  const tm = typeStr.match(/([a-z]+)\s*(?:\(([^)]+)\))?/); const t = tm && TYPES.includes(tm[1]) ? tm[1] : (typeStr ? "custom" : "humanoid");
  const items = []; let i = 0;
  const feats = (v, kind) => { for (const f of (Array.isArray(v) ? v : [])) { if (!f) continue; items.push(featureItem({ name: f.name ?? "Feature", desc: f.desc ?? f.description ?? f.text ?? "", kind }, i++)); } };
  feats(pick(r, "traits", "special_abilities", "specialAbilities"), "trait"); feats(r.actions, "action"); feats(pick(r, "bonusActions", "bonus_actions"), "bonus"); feats(r.reactions, "reaction"); feats(pick(r, "legendaryActions", "legendary_actions"), "legendary");
  const cr = parseCR(pick(r, "cr", "challenge_rating", "challengeRating", "challenge")) ?? 0;
  const dr = traitSet(pick(r, "dr", "damage_resistances", "resistances"), DMG), di = traitSet(pick(r, "di", "damage_immunities", "immunities"), DMG), dv = traitSet(pick(r, "dv", "damage_vulnerabilities", "vulnerabilities"), DMG), ci = traitSet(pick(r, "ci", "condition_immunities", "conditionImmunities"), CONDS);
  const sens = parseSenses(pick(r, "senses"));
  const legendary = Array.isArray(pick(r, "legendaryActions", "legendary_actions")) && pick(r, "legendaryActions", "legendary_actions").length;
  return { name: String(r.name).trim(), type: "npc", img: r.img ?? "icons/svg/mystery-man.svg",
    system: { abilities: abil, skills,
      attributes: { ac: ac !== null ? { flat: ac, calc: "flat" } : { calc: "default" }, hp: { value: hp, max: hp, formula }, movement: parseSpeed(pick(r, "speed")), senses: { ranges: { darkvision: sens.darkvision, blindsight: sens.blindsight, tremorsense: sens.tremorsense, truesight: sens.truesight }, units: "ft", special: sens.special }, ...(legendary ? { legact: { max: 3 } } : {}) },
      details: { cr, alignment: String(pick(r, "alignment") ?? ""), type: { value: t, subtype: tm?.[2] ?? "", custom: t === "custom" ? typeStr : "" }, biography: { value: html(pick(r, "description", "desc", "biography")) } },
      traits: { size: SIZES[String(pick(r, "size") ?? "medium").toLowerCase()] ?? "med", languages: langs(pick(r, "languages")), dr, di, dv, ci },
      source: source(meta, r) },
    items, prototypeToken: { name: String(r.name).trim(), actorLink: false, disposition: -1 } };
}
function source(meta, r = {}) { return { book: String(meta.title ?? r.document__title ?? r.source ?? "").slice(0, 80), page: String(r.page ?? ""), custom: "", license: normLicense(meta.license) ?? "", rules: meta.rules ?? (/2024|5\.2/.test(String(meta.title ?? "")) ? "2024" : "2014") }; }

export function toSpell(r, meta = {}) {
  const lvl = num(pick(r, "level", "level_int", "spell_level")) ?? (/cantrip/i.test(String(r.level ?? "")) ? 0 : 0);
  const schoolRaw = String(pick(r, "school") ?? "evocation").toLowerCase(); const school = SCHOOLS[schoolRaw] ?? (Object.values(SCHOOLS).includes(schoolRaw.slice(0, 3)) ? schoolRaw.slice(0, 3) : "evo");
  const ct = String(pick(r, "castingTime", "casting_time", "time") ?? "1 action"); const ctm = ct.match(/(\d+)?\s*(bonus action|reaction|action|minute|hour)/i);
  const actType = { "bonus action": "bonus", reaction: "reaction", action: "action", minute: "minute", hour: "hour" }[ctm?.[2]?.toLowerCase()] ?? "action";
  const rng = String(pick(r, "range") ?? ""); const rm = rng.match(/(\d+)\s*(feet|ft|miles?)/i);
  const range = /^self/i.test(rng) ? { units: "self" } : /^touch/i.test(rng) ? { units: "touch" } : rm ? { value: rm[1], units: /mile/i.test(rm[2]) ? "mi" : "ft" } : /sight/i.test(rng) ? { units: "spec", special: rng } : { units: "", special: rng };
  const comp = String(pick(r, "components") ?? ""); const props = [];
  if (/\bV\b/.test(comp) || r.requires_verbal_components) props.push("vocal"); if (/\bS\b/.test(comp) || r.requires_somatic_components) props.push("somatic"); if (/\bM\b/.test(comp) || r.requires_material_components) props.push("material");
  const dur = String(pick(r, "duration") ?? "Instantaneous"); const conc = /concentration/i.test(dur) || /^yes|true$/i.test(String(r.concentration ?? "")); if (conc) props.push("concentration"); if (/^yes|true$/i.test(String(r.ritual ?? r.can_be_cast_as_ritual ?? ""))) props.push("ritual");
  const dm = dur.match(/(\d+)\s*(round|minute|hour|day)/i);
  const material = pick(r, "material", "materials") ?? comp.match(/\(([^)]+)\)/)?.[1] ?? "";
  const desc = [pick(r, "description", "desc", "text") ?? "", pick(r, "higherLevels", "higher_level", "higher_levels") ? `At Higher Levels. ${pick(r, "higherLevels", "higher_level", "higher_levels")}` : ""].filter(Boolean).join("\n\n");
  return { name: String(r.name).trim(), type: "spell", img: r.img ?? "icons/magic/symbols/runes-star-blue.webp",
    system: { level: lvl, school, activation: { type: actType, value: num(ctm?.[1]) ?? 1, condition: "" }, range, properties: props, materials: { value: String(material) },
      duration: dm ? { value: dm[1], units: dm[2].toLowerCase().replace(/s$/, "") } : { units: /until dispelled/i.test(dur) ? "perm" : /special/i.test(dur) ? "spec" : "inst" },
      description: { value: html(desc) }, source: source(meta, r) } };
}
const WEAPON_HINT = /sword|axe|bow|dagger|mace|spear|hammer|club|staff|flail|glaive|halberd|lance|pike|rapier|scimitar|sickle|trident|whip|sling|dart|javelin|crossbow|maul|morningstar|weapon/i;
export function toItem(r, meta = {}) {
  let t = String(pick(r, "itemType", "item_type", "category") ?? "").toLowerCase();
  const typeMap = t.includes("weapon") ? "weapon" : /armor|shield|ring|wondrous|rod|wand|equipment|gear/.test(t) && !/potion|scroll/.test(t) ? "equipment" : /potion|scroll|ammunition|consumable|food|poison/.test(t) ? "consumable" : /tool|kit/.test(t) ? "tool" : /container|bag|pack/.test(t) ? "container" : !t && WEAPON_HINT.test(r.name) ? "weapon" : "loot";
  const priceRaw = String(pick(r, "price", "cost", "value") ?? ""); const pm = priceRaw.replace(/,/g, "").match(/([\d.]+)\s*(pp|gp|ep|sp|cp)?/i);
  const rarity = String(pick(r, "rarity") ?? "").toLowerCase().replace(/\s+/g, ""); const R = { common: "common", uncommon: "uncommon", rare: "rare", veryrare: "veryRare", legendary: "legendary", artifact: "artifact" }[rarity] ?? "";
  const system = { description: { value: html(pick(r, "description", "desc", "text")) }, quantity: num(r.quantity) ?? 1, weight: { value: num(pick(r, "weight")) ?? 0, units: "lb" },
    price: { value: pm ? Number(pm[1]) : 0, denomination: (pm?.[2] ?? "gp").toLowerCase() }, rarity: R, attunement: /attun/i.test(String(pick(r, "attunement", "requires_attunement") ?? "")) || r.attunement === true ? "required" : "", source: source(meta, r) };
  if (typeMap === "weapon") { const dmg = String(pick(r, "damage", "damage_dice") ?? ""); const dm = dmg.match(/(\d+)d(\d+)\s*(\w+)?/); const ty = (dm?.[3] ?? pick(r, "damageType", "damage_type") ?? "").toLowerCase();
    Object.assign(system, { type: { value: /ranged|bow|sling|dart|crossbow/i.test(t + r.name) ? (/martial/i.test(t) ? "martialR" : "simpleR") : (/martial/i.test(t) ? "martialM" : "simpleM"), baseItem: "" },
      damage: { base: dm ? { number: Number(dm[1]), denomination: Number(dm[2]), bonus: "", types: DMG.includes(ty) ? [ty] : [], custom: { enabled: false, formula: "" } } : {} } }); }
  if (typeMap === "equipment") { const acv = num(pick(r, "ac", "armor_class")); Object.assign(system, { type: { value: /shield/.test(t + r.name.toLowerCase()) ? "shield" : /heavy/.test(t) ? "heavy" : /medium/.test(t) ? "medium" : /light|armor/.test(t) ? "light" : "trinket", baseItem: "" }, ...(acv ? { armor: { value: acv } } : {}) }); }
  if (typeMap === "consumable") Object.assign(system, { type: { value: /scroll/.test(t) ? "scroll" : /ammunition/.test(t) ? "ammo" : /food/.test(t) ? "food" : /poison/.test(t) ? "poison" : "potion", subtype: "" } });
  return { name: String(r.name).trim(), type: typeMap, img: r.img ?? (typeMap === "weapon" ? "icons/weapons/swords/sword-guard-steel.webp" : typeMap === "consumable" ? "icons/consumables/potions/bottle-round-corked-red.webp" : "icons/svg/item-bag.svg"), system };
}
/** Any record -> {documentName, data}. Full Foundry exports (with type + system) are passed through (minus ids/ownership). */
export function toDocument(r, meta = {}) {
  if (r && r.type && r.system && typeof r.system === "object") {
    const data = structuredClone(r); delete data._id; delete data.ownership; delete data.folder; delete data._stats; delete data.sort;
    data.system.source = { ...(data.system.source ?? {}), license: normLicense(meta.license) ?? data.system.source?.license ?? "", ...(meta.title && !data.system.source?.book ? { book: meta.title } : {}) };
    return { documentName: ["npc", "character", "vehicle", "group", "encounter"].includes(r.type) ? "Actor" : "Item", data };
  }
  const k = detectKind(r);
  return k === "monster" ? { documentName: "Actor", data: toMonster(r, meta) } : k === "spell" ? { documentName: "Item", data: toSpell(r, meta) } : { documentName: "Item", data: toItem(r, meta) };
}

// ---------------------------------------------------------------- CSV
export function parseCSV(text) {
  const rows = []; let row = [], cell = "", q = false; const s = String(text ?? "").replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) { const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true; else if (c === ",") { row.push(cell); cell = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && s[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; } else cell += c; }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  const clean = rows.filter(r => r.some(c => c.trim() !== "")); if (!clean.length) return [];
  const head = clean[0].map(h => h.trim()); return clean.slice(1).map(r => {
    const o = {}; head.forEach((h, i) => { const v = (r[i] ?? "").trim(); if (v === "") return;
      if (/^(actions|traits|reactions|bonusActions|legendaryActions)$/i.test(h)) o[h] = v.split(/\s*\|\s*/).map(x => { const m = x.match(/^([^.]+)\.\s*(.*)$/s); return m ? { name: m[1], desc: m[2] } : { name: x, desc: "" }; });
      else o[h] = v; }); return o; }).filter(o => o.name);
}

// ---------------------------------------------------------------- stat block text (SRD 5.1 and 5.2 layouts)
const SECTION = /^(actions|bonus actions|reactions|legendary actions|traits|lair actions)$/i;
export function parseStatBlock(text) {
  const lines = String(text ?? "").replace(/\r/g, "").replace(/[−–]/g, "-").split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 3) throw new Error("Stat block is too short. Paste the whole block, starting with the creature's name.");
  const r = { name: lines[0].replace(/\s+/g, " "), traits: [], actions: [], bonusActions: [], reactions: [], legendaryActions: [] };
  let i = 1; const meta = lines[1].match(/^(Tiny|Small|Medium|Large|Huge|Gargantuan)(?:\s+or\s+\w+)?\s+([^,]+?)(?:,\s*(.+))?$/i);
  if (meta) { r.size = meta[1]; r.creatureType = meta[2]; r.alignment = meta[3] ?? ""; i = 2; }
  let section = "traits", cur = null; const sectKey = { traits: "traits", actions: "actions", "bonus actions": "bonusActions", reactions: "reactions", "legendary actions": "legendaryActions", "lair actions": "legendaryActions" };
  const abilRow = /^(?:STR|Str)\b/;
  for (; i < lines.length; i++) { const l = lines[i];
    let m;
    if ((m = l.match(/^(?:Armor Class|AC)\s+(\d+)(?:\s*\(([^)]*)\))?(?:\s+Initiative\s+([+-]\d+))?/i))) { r.ac = Number(m[1]); continue; }
    if ((m = l.match(/^(?:Hit Points|HP)\s+(\d+)(?:\s*\(([^)]*)\))?/i))) { r.hp = Number(m[1]); r.hpFormula = m[2] ?? ""; continue; }
    if ((m = l.match(/^Speed\s+(.+)$/i))) { r.speed = m[1]; continue; }
    if (/^STR\s+DEX\s+CON/i.test(l)) { const vals = (lines[i + 1] ?? "").match(/\d+\s*\([+-]?\d+\)/g) ?? []; if (vals.length >= 6) { ABIL.forEach((a, j) => r[a] = num(vals[j])); i++; } else { const v2 = (lines[i + 1] ?? "").match(/\b\d+\b/g) ?? []; ABIL.forEach((a, j) => r[a] = num(v2[j])); i++; } continue; }
    if ((m = l.match(/^(Str|Dex|Con|Int|Wis|Cha)\s+(\d+)\s+([+-]\d+)\s+([+-]\d+)/i))) { // 2024 layout: "Str 8 -1 -1" (possibly several per line)
      for (const mm of l.matchAll(/(Str|Dex|Con|Int|Wis|Cha)\s+(\d+)\s+([+-]\d+)\s+([+-]\d+)/gi)) { const a = mm[1].toLowerCase(); r[a] = Number(mm[2]); if (mm[4] !== mm[3]) (r.saves ??= {})[a] = mm[4]; } continue; }
    if (abilRow.test(l) && /MOD/i.test(l)) continue;
    if ((m = l.match(/^Saving Throws\s+(.+)$/i))) { r.saves = m[1]; continue; }
    if ((m = l.match(/^Skills\s+(.+)$/i))) { r.skills = m[1]; continue; }
    if ((m = l.match(/^Damage Vulnerabilities\s+(.+)$/i)) || (m = l.match(/^Vulnerabilities\s+(.+)$/i))) { r.dv = m[1]; continue; }
    if ((m = l.match(/^Damage Resistances\s+(.+)$/i)) || (m = l.match(/^Resistances\s+(.+)$/i))) { r.dr = m[1]; continue; }
    if ((m = l.match(/^Damage Immunities\s+(.+)$/i))) { r.di = m[1]; continue; }
    if ((m = l.match(/^Condition Immunities\s+(.+)$/i))) { r.ci = m[1]; continue; }
    if ((m = l.match(/^Immunities\s+(.+)$/i))) { const [dmg, cond] = m[1].split(/;\s*/); r.di = dmg; if (cond) r.ci = cond; continue; }
    if ((m = l.match(/^Senses\s+(.+)$/i))) { r.senses = m[1]; continue; }
    if ((m = l.match(/^Languages\s+(.+)$/i))) { r.languages = m[1]; continue; }
    if ((m = l.match(/^(?:Challenge|CR)\s+([\d/]+)/i))) { r.cr = m[1]; continue; }
    if (/^(Proficiency Bonus|Gear)\b/i.test(l)) continue;
    if (SECTION.test(l)) { section = sectKey[l.toLowerCase()]; cur = null; continue; }
    if ((m = l.match(/^([A-Z][^.:]{0,60}?(?:\([^)]*\))?)\.\s+(.*)$/))) { cur = { name: m[1].trim(), desc: m[2] }; r[section].push(cur); continue; }
    if (cur) cur.desc += "\n" + l; else if (section === "legendaryActions") { /* preamble */ }
  }
  if (r.hp === undefined) throw new Error("Could not find Hit Points / HP in the stat block.");
  return r;
}

/** Split any input text into records. format: auto | json | csv | statblock */
export function parseInput(text, format = "auto") {
  const t = String(text ?? "").trim(); if (!t) throw new Error("Nothing to import.");
  if (format === "auto") format = /^[[{]/.test(t) ? "json" : /^[^\n]*,[^\n]*\n/.test(t) && /^name\b|,name\b/i.test(t.split("\n")[0]) ? "csv" : "statblock";
  if (format === "json") { const j = JSON.parse(t); const meta = Array.isArray(j) ? {} : (j.license || j.attribution || j.title ? { license: j.license, attribution: j.attribution, title: j.title, url: j.url } : {});
    const recs = Array.isArray(j) ? j : j.results ?? j.documents ?? j.monsters ?? j.items ?? j.spells ?? j.entries ?? [j]; return { format, meta, records: recs.filter(r => r && r.name) }; }
  if (format === "csv") return { format, meta: {}, records: parseCSV(t) };
  return { format: "statblock", meta: {}, records: t.split(/\n\s*-{3,}\s*\n/).map(b => ({ kind: "monster", ...parseStatBlock(b) })) };
}
export const attributionText = meta => { const L = LICENSES[normLicense(meta.license)] ?? {}; return `${meta.attribution || meta.title || "Imported content"}${L.name ? ` — licensed under the ${L.name}${L.url ? ` (${L.url})` : ""}` : ""}.`; };
