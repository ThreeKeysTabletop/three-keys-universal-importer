# Three Keys Universal Importer

*By Three Keys Tabletop · Foundry VTT v13–v14 · dnd5e 5.x · free, MIT*

Bring free, openly licensed rules content into Foundry in one click, and turn other open stat blocks into real dnd5e documents.

## Features
- **One-click SRD.** Pick categories from SRD 5.1 or SRD 5.2 (monsters, spells, items, feats, classes…) and press *Import selected*. They land in world compendiums such as *SRD 5.1 Monsters* that you can edit freely.
- **JSON, CSV and stat-block text.** Paste or load:
  - dnd5e/Foundry JSON exports (passed through as-is),
  - simple JSON records (`name`, `ac`, `hp`, `str`…, `actions:[{name,desc}]`; Open5e-style names like `armor_class`, `hit_points`, `challenge_rating`, `level_int` also work),
  - CSV with a header row (`name,kind,...`; separate several actions with `|`),
  - stat-block text in the SRD 2014 or 2024 layout (several blocks separated by a `---` line).
  Attacks such as *"Melee Weapon Attack: +4 to hit … Hit: 6 (1d8 + 2) piercing damage"* become attack activities; *"DC 12 Wisdom saving throw"* becomes a save activity; *(Recharge 5–6)* becomes a recharge use.
- **Preview before import.** See every entry with CR / AC / HP or level and price.
- **Safe re-imports.** Each entry remembers where it came from. Running the same import again skips unchanged entries, updates changed ones and keeps anything you edited (setting: *Update / Skip / Overwrite*).
- **Licensing built in.** Only CC-BY-4.0, OGL 1.0a and CC0 content is accepted, CC-BY/OGL need an attribution notice, and every import is recorded in the *Imported Content Attribution* journal.

## What it will not do
No D&D Beyond access or scraping, no non-SRD Wizards of the Coast content (Monster Manual, Player's Handbook, etc.). JSON tagged with those books or with DDB Importer data is refused.

## Use
Compendium sidebar → **Universal Importer** (or Game Settings → Configure Settings → Three Keys Universal Importer). GM only.

## API
`game.modules.get("three-keys-universal-importer").api` → `open()`, `importSRD(ids, {names, limit, policy})`, `importText(text, {format, license, attribution, title, compendium})`, `preview(text, opts)`, `catalog`, `convert`.

## Licensing
Code: MIT. Rules content: see CREDITS.md. Not affiliated with Wizards of the Coast.

Support Three Keys Tabletop on Patreon. Patreon link coming soon.
