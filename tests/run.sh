#!/usr/bin/env bash
# Full test: offline unit tests, build, install+smoke the ZIP via foundry-test, run the Playwright suite, stop the server.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; MOD="$(dirname "$HERE")"; FT="${FT:-$MOD/../foundry-test}"
trap '"$FT/stop.sh" >/dev/null 2>&1 || true' EXIT
node "$HERE/unit.test.mjs"
"$MOD/build.sh" >/dev/null
"$FT/tests/test-module.sh" "$MOD/dist/three-keys-universal-importer.zip"
FOUNDRY_TESTS="$FT/tests" node "$HERE/universal-importer.test.mjs"
