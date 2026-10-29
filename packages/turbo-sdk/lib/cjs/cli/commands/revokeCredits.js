"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.revokeCredits = revokeCredits;
const utils_js_1 = require("../utils.js");
async function revokeCredits(options) {
    const { address: revokedAddress } = options;
    if (revokedAddress === undefined) {
        throw new Error('Must provide an approved --address to revoke approvals for');
    }
    const turbo = await (0, utils_js_1.turboFromOptions)(options);
    const revokedApprovals = await turbo.revokeCredits({
        revokedAddress,
    });
    console.log(JSON.stringify({ message: 'Revoked credit share approvals!', revokedApprovals }, null, 2));
}
