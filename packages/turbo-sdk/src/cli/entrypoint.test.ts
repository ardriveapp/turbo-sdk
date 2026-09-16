/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { isCliEntrypoint } from './entrypoint.js';

describe('isCliEntrypoint', () => {
  // Node resolves process.argv[1] with the platform separator, so every
  // Windows launch (npm's turbo.cmd, turbo.ps1 and Git Bash shims, npx, or
  // `node <path>` typed by hand) reaches the CLI with a backslash path.
  describe('Windows paths (issue #389)', () => {
    const windowsPaths = {
      "npm's global turbo.cmd shim":
        'C:\\Users\\hans\\AppData\\Roaming\\npm\\node_modules\\@ardrive\\turbo-sdk\\lib\\esm\\cli\\cli.js',
      'a project node_modules\\.bin shim or npx':
        'D:\\work\\app\\node_modules\\@ardrive\\turbo-sdk\\lib\\esm\\cli\\cli.js',
      'a lower-case drive letter':
        'c:\\users\\hans\\appdata\\roaming\\npm\\node_modules\\@ardrive\\turbo-sdk\\lib\\esm\\cli\\cli.js',
      'a UNC path': '\\\\server\\share\\turbo-sdk\\lib\\esm\\cli\\cli.js',
      'a source checkout':
        'C:\\src\\turbo-sdk\\packages\\turbo-sdk\\src\\cli\\cli.ts',
    };

    for (const [launch, scriptPath] of Object.entries(windowsPaths)) {
      it(`runs the CLI for ${launch}`, () => {
        assert.equal(isCliEntrypoint(scriptPath), true);
      });
    }

    it('does not run the CLI for an unrelated Windows script', () => {
      assert.equal(isCliEntrypoint('C:\\Users\\hans\\app\\index.js'), false);
    });
  });

  describe('POSIX paths', () => {
    const posixPaths = {
      "npm's global symlink": '/usr/local/bin/turbo',
      'an npm --prefix global symlink': '/tmp/prefix/bin/turbo',
      'a project node_modules/.bin symlink':
        '/home/u/app/node_modules/.bin/turbo',
      'a direct run of the published file':
        '/home/u/app/node_modules/@ardrive/turbo-sdk/lib/esm/cli/cli.js',
      'a source checkout':
        '/home/u/turbo-sdk/packages/turbo-sdk/src/cli/cli.ts',
    };

    for (const [launch, scriptPath] of Object.entries(posixPaths)) {
      it(`runs the CLI for ${launch}`, () => {
        assert.equal(isCliEntrypoint(scriptPath), true);
      });
    }

    it('does not run the CLI for an unrelated POSIX script', () => {
      assert.equal(isCliEntrypoint('/home/u/app/index.js'), false);
    });
  });

  it('does not run the CLI when there is no script path (node -e, REPL)', () => {
    assert.equal(isCliEntrypoint(undefined), false);
  });
});
