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
/**
 * Whether `scriptPath` (pass `process.argv[1]`) is the Turbo CLI, so the CLI
 * parses arguments only when it is the script Node was asked to run.
 *
 * Node reports `process.argv[1]` with the platform separator. On Windows,
 * npm's `turbo.cmd`, `turbo.ps1` and Git Bash shims all run
 * `node ...\node_modules\@ardrive\turbo-sdk\lib\esm\cli\cli.js`, so the path
 * holds backslashes and is normalized before matching.
 */
export function isCliEntrypoint(scriptPath) {
    if (scriptPath === undefined) {
        return false;
    }
    const normalizedPath = scriptPath.replace(/\\/g, '/');
    return (normalizedPath.includes('bin/turbo') || // npm symlink in a bin or .bin directory
        normalizedPath.includes('cli/cli') // cli/cli.js or cli/cli.ts, run directly or through a Windows shim
    );
}
