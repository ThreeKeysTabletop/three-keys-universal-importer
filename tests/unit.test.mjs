// Offline unit tests for the converters (node tests/unit.test.mjs). No Foundry needed.
import * as C from '../scripts/convert.mjs';
import { readFileSync } from 'node:fs';
let pass = 0, fail = 0; const ok = (n, c, d = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`); };
const GOBLIN = `Goblin
Small humanoid (goblinoid), neutral evil
Armor Class 15 (leather armor, shield)
Hit Points 7 (2d6)
Speed 30 ft.
STR DEX CON INT WIS CHA
8 (-1) 14 (+2) 10 (+0) 10 (+0) 8 (-1) 8 (-1)
Skills Stealth +6
Senses darkvision 60 ft., passive Perception 9
Languages Common, Goblin
Challenge 1/4 (50 XP)
Nimble Escape. The goblin can take the Disengage or Hide action as a bonus action on each of its turns.
Actions
Scimitar. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage.
Shortbow. Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target. Hit: 5 (1d6 + 2) piercing damage.`;
const g = C.toMonster(C.parseStatBlock(GOBLIN), { license: 'CC-BY-4.0' });
ok('2014 stat block: core numbers', g.system.attributes.ac.flat === 15 && g.system.attributes.hp.max === 7 && g.system.attributes.hp.formula === '2d6' && g.system.details.cr === 0.25 && g.system.traits.size === 'sm' && g.system.details.type.value === 'humanoid' && g.system.details.type.subtype === 'goblinoid', JSON.stringify([g.system.attributes.ac, g.system.details.cr]));
ok('2014 stat block: abilities, skills, senses, languages', g.system.abilities.dex.value === 14 && g.system.abilities.str.value === 8 && g.system.skills.ste && g.system.attributes.senses.ranges.darkvision === 60 && g.system.traits.languages.value.join() === 'common,goblin');
const sh = g.items.find(i => i.name === 'Shortbow'); const sa = Object.values(sh.system.activities)[0];
ok('2014 stat block: ranged attack activity with +4, 80/320, 1d6+2 piercing', sa.type === 'attack' && sa.attack.bonus === '4' && sa.attack.flat && sa.attack.type.value === 'ranged' && sa.range.value === '80' && sa.range.long === 320 && sa.damage.parts[0].denomination === 6 && sa.damage.parts[0].bonus === '2' && sa.damage.parts[0].types[0] === 'piercing');
ok('Trait without activation stays passive', Object.keys(g.items.find(i => i.name === 'Nimble Escape').system.activities).length === 0);
const G24 = `Goblin Warrior
Small Fey (Goblinoid), Chaotic Neutral
AC 15 Initiative +6 (16)
HP 10 (3d6)
Speed 30 ft.
MOD SAVE MOD SAVE MOD SAVE
Str 8 -1 -1 Dex 15 +2 +2 Con 10 +0 +0
Int 10 +0 +0 Wis 8 -1 -1 Cha 8 -1 -1
Skills Stealth +6
Senses Darkvision 60 ft.; Passive Perception 9
Languages Common, Goblin
CR 1/4 (XP 50; PB +2)
Actions
Scimitar. Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Slashing damage, plus 2 (1d4) Slashing damage if the attack roll had Advantage.
Bonus Actions
Nimble Escape. The goblin takes the Disengage or Hide action.`;
const g2 = C.toMonster(C.parseStatBlock(G24), { license: 'CC-BY-4.0', title: 'SRD 5.2' });
const a2 = Object.values(g2.items.find(i => i.name === 'Scimitar').system.activities)[0];
ok('2024 stat block: AC/HP/CR/abilities/type', g2.system.attributes.ac.flat === 15 && g2.system.attributes.hp.max === 10 && g2.system.details.cr === 0.25 && g2.system.abilities.dex.value === 15 && g2.system.details.type.value === 'fey' && g2.system.source.rules === '2024');
ok('2024 stat block: "Attack Roll: +4" attack with two damage parts; bonus action section', a2?.type === 'attack' && a2.attack.bonus === '4' && a2.damage.parts.length === 2 && Object.values(g2.items.find(i => i.name === 'Nimble Escape').system.activities)[0]?.activation.type === 'bonus');
const sp = C.toSpell({ name: 'Fireball', level: 3, school: 'Evocation', casting_time: '1 action', range: '150 feet', components: 'V, S, M (a tiny ball of bat guano and sulfur)', duration: 'Instantaneous', desc: 'A bright streak…' }, { license: 'CC-BY-4.0' });
ok('Spell: level/school/range/components/material', sp.system.level === 3 && sp.system.school === 'evo' && sp.system.range.value === '150' && sp.system.properties.join() === 'vocal,somatic,material' && /bat guano/.test(sp.system.materials.value) && sp.system.duration.units === 'inst');
const conc = C.toSpell({ name: 'Bless', level_int: 1, school: 'enchantment', range: '30 feet', duration: 'Concentration, up to 1 minute', components: 'V, S, M' });
ok('Spell: concentration + duration 1 minute (Open5e field names)', conc.system.properties.includes('concentration') && conc.system.duration.value === '1' && conc.system.duration.units === 'minute' && conc.system.level === 1);
const it = C.toItem({ name: 'Longsword', itemType: 'martial melee weapon', price: '15 gp', weight: 3, damage: '1d8 slashing' });
ok('Item: weapon with price/weight/damage', it.type === 'weapon' && it.system.type.value === 'martialM' && it.system.price.value === 15 && it.system.weight.value === 3 && it.system.damage.base.denomination === 8);
ok('Item: potion -> consumable, rarity mapped', C.toItem({ name: 'Potion of Healing', itemType: 'potion', rarity: 'Common', price: '50 gp' }).type === 'consumable');
const csv = C.parseCSV('name,kind,ac,hp,actions\n"Big, Rat",monster,12,7,"Bite. Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 4 (1d4 + 2) piercing damage.|Squeak. It squeaks."');
ok('CSV: quoted commas and |-separated actions', csv.length === 1 && csv[0].name === 'Big, Rat' && csv[0].actions.length === 2);
ok('Auto format detection (json / csv / statblock)', C.parseInput('[{"name":"x"}]').format === 'json' && C.parseInput('name,level\nx,1').format === 'csv' && C.parseInput(GOBLIN).format === 'statblock');
ok('Multiple stat blocks split on ---', C.parseInput(GOBLIN + '\n---\n' + G24).records.length === 2);
ok('Licence gate: accepts CC-BY with attribution, CC0 without', C.checkLicense({ license: 'CC-BY-4.0', attribution: 'x' }).length === 0 && C.checkLicense({ license: 'cc0' }).length === 0 && C.checkLicense({ license: 'OGL 1.0a', attribution: 'x' }).length === 0);
ok('Licence gate: rejects unknown/proprietary licences and missing attribution', C.checkLicense({ license: 'All rights reserved' }).length && C.checkLicense({ license: 'CC-BY-4.0' }).length && C.checkLicense({}).length);
ok('Licence gate: rejects D&D Beyond / DDB Importer data', C.checkLicense({ license: 'CC-BY-4.0', attribution: 'x' }, [{ name: 'a', flags: { ddbimporter: { id: 1 } } }]).length && C.checkLicense({ license: 'CC0', url: 'https://www.dndbeyond.com/monsters/1' }).length);
ok('Licence gate: rejects non-SRD WotC books', C.checkLicense({ license: 'CC-BY-4.0', attribution: 'x' }, [{ name: 'Beholder', system: { source: { book: 'Monster Manual' } } }]).length > 0 && C.checkLicense({ license: 'CC-BY-4.0', attribution: 'x' }, [{ name: 'Goblin', system: { source: { book: 'SRD 5.1' } } }]).length === 0);
ok('Hash is stable and ignores _id/_stats/flags', C.hash({ a: 1, b: { c: 2 }, _id: 'x' }) === C.hash({ b: { c: 2 }, a: 1, flags: { q: 1 } }) && C.hash({ a: 1 }) !== C.hash({ a: 2 }));
for (const f of ['three-keys-open-bestiary.json', 'open-items.csv', 'statblock-example.txt']) { const p = C.parseInput(readFileSync(new URL(`../samples/${f}`, import.meta.url), 'utf8')); ok(`Sample ${f} parses (${p.records.length} records)`, p.records.length >= 1 && p.records.every(r => C.toDocument(r, { license: 'CC0-1.0' }).data.name)); }
console.log(`\n${pass}/${pass + fail} unit tests passed`); process.exit(fail ? 1 : 0);
