"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultProdGatewayUrls = exports.wincPerCredit = exports.turboCliTags = void 0;
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
const version_js_1 = require("../version.js");
exports.turboCliTags = [
    { name: 'App-Name', value: 'Turbo-CLI' },
    { name: 'App-Version', value: version_js_1.version },
    { name: 'App-Platform', value: process?.platform },
];
exports.wincPerCredit = 1_000_000_000_000;
// Export from here for backwards compatibility
var common_js_1 = require("../utils/common.js");
Object.defineProperty(exports, "defaultProdGatewayUrls", { enumerable: true, get: function () { return common_js_1.defaultProdGatewayUrls; } });
