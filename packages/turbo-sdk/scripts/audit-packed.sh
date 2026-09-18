#!/bin/bash
set -euo pipefail

# Create temporary directory and set up cleanup trap
TEMP_DIR=$(mktemp -d)
trap 'rm -rf -- "$TEMP_DIR"' EXIT

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Get the package directory (parent of scripts)
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PACKAGE_DIR"

# Pack the tarball
# npm writes warnings to stderr, and under yarn it warns about every unknown
# env config yarn injects. Keep stderr out of anything parsed.
TARBALL=$(npm pack --quiet --pack-destination "$TEMP_DIR" 2>/dev/null | tail -1)
TARBALL_PATH="$TEMP_DIR/$TARBALL"

# Create minimal package.json in temp directory
cat > "$TEMP_DIR/package.json" <<'EOF'
{"name":"audit-packed","private":true,"version":"1.0.0"}
EOF

# Install the tarball
cd "$TEMP_DIR"
npm install --no-audit --no-fund "$TARBALL_PATH" > /dev/null 2>&1

# Load the installed build before auditing it.
#
# This install has no optional peer and no devDependencies, which is what a
# consumer gets. A dependency that a package imports but never declares
# resolves in this repo, where something else brings it along, and fails here.
# @dha-team/arbundles imports axios without declaring it, and the SDK only kept
# loading because @cosmjs and x402-fetch each pulled axios in; removing both
# broke every entry point. Unit tests, lint and the integration suite all pass
# in that state, so this is the only check that sees it.
load_or_fail() {
  local label="$1"
  local code="$2"
  if ! OUTPUT=$(node -e "$code" 2>&1); then
    echo "Error: $label failed on a clean install of the packed build:"
    echo "$OUTPUT" | head -5
    exit 1
  fi
}

load_or_fail "the ESM node entry point" \
  "import('@ardrive/turbo-sdk/node').then((m) => { if (typeof m.TurboFactory.unauthenticated !== 'function') { throw new Error('TurboFactory missing'); } })"
load_or_fail "the CommonJS node entry point" \
  "if (typeof require('@ardrive/turbo-sdk/node').TurboFactory.unauthenticated !== 'function') { throw new Error('TurboFactory missing'); }"
load_or_fail "the root entry point" \
  "import('@ardrive/turbo-sdk').then((m) => { if (typeof m.TurboFactory.unauthenticated !== 'function') { throw new Error('TurboFactory missing'); } })"

if ! CLI_OUTPUT=$(./node_modules/.bin/turbo --version 2>&1); then
  echo "Error: the turbo CLI failed on a clean install of the packed build:"
  echo "$CLI_OUTPUT" | head -5
  exit 1
fi

# Run npm audit and get JSON output
AUDIT_OUTPUT=$(npm audit --json 2>/dev/null || true)

# The allowlist names accepted ADVISORY ids, not packages, so a new advisory
# against an already listed package still fails. Format, one per line:
#   GHSA-xxxx-xxxx-xxxx  package  # why it is accepted
ALLOWLIST_FILE="$PACKAGE_DIR/audit-allowlist.txt"
if [ ! -f "$ALLOWLIST_FILE" ]; then
  echo "Error: audit-allowlist.txt not found at $ALLOWLIST_FILE"
  exit 1
fi

if [ -z "$AUDIT_OUTPUT" ] || [ "${AUDIT_OUTPUT:0:1}" != "{" ]; then
  echo "Error: npm audit did not return JSON. First line: $(echo "$AUDIT_OUTPUT" | head -1)"
  exit 1
fi

node -e '
const [auditJson, allowlistText] = process.argv.slice(1);
const audit = JSON.parse(auditJson);

const accepted = new Set();
for (const rawLine of allowlistText.split("\n")) {
  const line = rawLine.replace(/#.*$/, "").trim();
  if (line === "") continue;
  const [advisory, pkg] = line.split(/\s+/);
  if (advisory === undefined || pkg === undefined) {
    console.log(`Error: allowlist line needs an advisory id and a package: ${rawLine}`);
    process.exit(1);
  }
  accepted.add(`${advisory} ${pkg}`);
}

const counts = audit.metadata?.vulnerabilities ?? {};
console.log(
  `Advisory counts: ${counts.critical} critical, ${counts.high} high, ` +
    `${counts.moderate} moderate, ${counts.low} low`,
);

// An advisory reaches us through one package at a time. npm reports the chain
// under each affected package, so read the ids from the `via` entries that
// carry them and attribute each to the package it was reported under.
const unaccepted = [];
for (const [pkg, entry] of Object.entries(audit.vulnerabilities ?? {})) {
  for (const via of entry.via ?? []) {
    if (typeof via !== "object") continue;
    if (via.severity !== "high" && via.severity !== "critical") continue;
    const id = (via.url ?? "").split("/").pop() || `source-${via.source}`;
    const key = `${id} ${via.name ?? pkg}`;
    if (!accepted.has(key)) {
      unaccepted.push(`${key}  (${via.severity}, reported under ${pkg}): ${via.title ?? ""}`);
    }
  }
}

if (unaccepted.length > 0) {
  console.log("High and critical advisories that are not accepted in audit-allowlist.txt:");
  [...new Set(unaccepted)].sort().forEach((line) => console.log(`  - ${line}`));
  console.log("");
  console.log("Fix the dependency, or add the advisory id and package to the allowlist with a reason.");
  process.exit(1);
}

process.exit(0);
' "$AUDIT_OUTPUT" "$(cat "$ALLOWLIST_FILE")"
