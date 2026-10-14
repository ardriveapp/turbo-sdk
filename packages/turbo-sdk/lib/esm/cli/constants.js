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
import { version } from '../version.js';
export const turboCliTags = [
    { name: 'App-Name', value: 'Turbo-CLI' },
    { name: 'App-Version', value: version },
    { name: 'App-Platform', value: process?.platform },
];
export const wincPerCredit = 1_000_000_000_000;
// Export from here for backwards compatibility
export { defaultProdGatewayUrls } from '../utils/common.js';
