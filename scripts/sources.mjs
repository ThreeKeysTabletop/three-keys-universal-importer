// Built-in open-content sources. Nothing is bundled: the SRD 5.1 / 5.2 text ships inside the dnd5e system itself (CC-BY-4.0,
// see systems/dnd5e/README.md "Licenses"). We copy documents out of the system's own compendiums into world compendiums,
// and only documents whose system.source.license is an allowed open licence ("Unlicensed" / unlabeled entries are skipped).
export const SRD51_ATTRIBUTION = 'This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.';
export const SRD52_ATTRIBUTION = 'This work includes material from the System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.';
const S51 = { key: "srd51", title: "SRD 5.1", license: "CC-BY-4.0", attribution: SRD51_ATTRIBUTION, rules: "2014" };
const S52 = { key: "srd52", title: "SRD 5.2", license: "CC-BY-4.0", attribution: SRD52_ATTRIBUTION, rules: "2024" };
const c = (src, id, pack, label, type) => ({ id: `${src.key}-${id}`, source: src, pack: `dnd5e.${pack}`, label, documentName: type });
export const CATALOG = [
  c(S51, "monsters", "monsters", "Monsters", "Actor"), c(S51, "spells", "spells", "Spells", "Item"), c(S51, "items", "items", "Items & Equipment", "Item"),
  c(S51, "tradegoods", "tradegoods", "Trade Goods", "Item"), c(S51, "monsterfeatures", "monsterfeatures", "Monster Features", "Item"),
  c(S51, "classes", "classes", "Classes", "Item"), c(S51, "subclasses", "subclasses", "Subclasses", "Item"), c(S51, "classfeatures", "classfeatures", "Class Features", "Item"),
  c(S51, "races", "races", "Races", "Item"), c(S51, "backgrounds", "backgrounds", "Backgrounds", "Item"),
  c(S52, "monsters", "actors24", "Monsters", "Actor"), c(S52, "spells", "spells24", "Spells", "Item"), c(S52, "equipment", "equipment24", "Equipment", "Item"),
  c(S52, "feats", "feats24", "Feats", "Item"), c(S52, "origins", "origins24", "Origins", "Item"), c(S52, "classes", "classes24", "Classes", "Item")
];
export const SOURCES = { srd51: S51, srd52: S52 };
