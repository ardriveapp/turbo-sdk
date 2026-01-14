#!/bin/bash

# The version to be released is passed as the first argument to the script
nextRelease_version=$1

# Update the version in src/version.ts
sed -i.bak -e "s/export const version = '.*';/export const version = '${nextRelease_version}';/" src/version.ts && rm src/version.ts.bak

# Update the version in lib/cjs/version.js
sed -i.bak -e "s/exports.version = '.*';/exports.version = '${nextRelease_version}';/" lib/cjs/version.js && rm lib/cjs/version.js.bak

# Update the version in lib/esm/version.js
sed -i.bak -e "s/export const version = '.*';/export const version = '${nextRelease_version}';/" lib/esm/version.js && rm lib/esm/version.js.bak
