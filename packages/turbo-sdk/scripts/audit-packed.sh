#!/bin/bash
set -euo pipefail

# Create temporary directory and set up cleanup trap
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Get the package directory (parent of scripts)
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PACKAGE_DIR"

# Pack the tarball
TARBALL=$(npm pack --quiet --pack-destination "$TEMP_DIR" 2>&1 | tail -1)
TARBALL_PATH="$TEMP_DIR/$TARBALL"

# Create minimal package.json in temp directory
cat > "$TEMP_DIR/package.json" <<'EOF'
{"name":"audit-packed","private":true,"version":"1.0.0"}
EOF

# Install the tarball
cd "$TEMP_DIR"
npm install --no-audit --no-fund "$TARBALL_PATH" > /dev/null 2>&1

# Run npm audit and get JSON output
AUDIT_OUTPUT=$(npm audit --json 2>&1 || true)

# Parse allowlist
ALLOWLIST_FILE="$PACKAGE_DIR/audit-allowlist.txt"
if [ ! -f "$ALLOWLIST_FILE" ]; then
  echo "Error: audit-allowlist.txt not found at $ALLOWLIST_FILE"
  exit 1
fi

# Build JSON string of allowed packages
ALLOWED_JSON="{}"
while IFS= read -r line; do
  # Remove comments and trim whitespace
  line="${line%%#*}"
  line="$(echo "$line" | xargs)"
  [ -z "$line" ] && continue
  ALLOWED_JSON=$(node -e "const obj = JSON.parse(process.argv[1]); obj[process.argv[2]] = true; console.log(JSON.stringify(obj))" "$ALLOWED_JSON" "$line")
done < "$ALLOWLIST_FILE"

# Run comprehensive audit check using node
node -e "
const auditData = JSON.parse(process.argv[1]);
const allowedPackages = JSON.parse(process.argv[2]);

const metadata = auditData.metadata || {};
const vulnerabilities = metadata.vulnerabilities || {};

console.log('Advisory counts: ' + vulnerabilities.critical + ' critical, ' + vulnerabilities.high + ' high, ' + vulnerabilities.moderate + ' moderate, ' + vulnerabilities.low + ' low');

const criticalOrHigh = vulnerabilities.critical > 0 || vulnerabilities.high > 0;

if (!criticalOrHigh) {
  process.exit(0);
}

// Find offenders: high/critical advisories for non-allowlisted packages
const offenders = [];
const vulnsByPackage = auditData.vulnerabilities || {};

for (const [pkgName, pkgVulns] of Object.entries(vulnsByPackage)) {
  const severity = pkgVulns.severity;
  if ((severity === 'critical' || severity === 'high') && !allowedPackages[pkgName]) {
    offenders.push(pkgName);
  }
}

if (offenders.length > 0) {
  console.log('High and critical advisories for non-allowlisted packages:');
  offenders.sort().forEach(pkg => console.log('  - ' + pkg));
  process.exit(1);
}

process.exit(0);
" "$AUDIT_OUTPUT" "$ALLOWED_JSON"
