#!/usr/bin/env bash
# Build dist/three-keys-universal-importer.zip (module files at the zip root) + dist/module.json
set -euo pipefail
cd "$(dirname "$0")"; rm -rf dist; mkdir -p dist
python3 -c "import sys,zipfile,os;z=zipfile.ZipFile('dist/three-keys-universal-importer.zip','w',zipfile.ZIP_DEFLATED);[z.write(os.path.join(r,f)) for p in sys.argv[1:] for r,_,fs in (os.walk(p) if os.path.isdir(p) else [('',0,[p])]) for f in fs]" module.json README.md CHANGELOG.md CREDITS.md LICENSE scripts styles lang samples
cp module.json dist/module.json; unzip -l dist/three-keys-universal-importer.zip
