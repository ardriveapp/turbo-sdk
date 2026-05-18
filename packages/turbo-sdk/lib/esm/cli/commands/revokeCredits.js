import { turboFromOptions } from '../utils.js';
export async function revokeCredits(options) {
    const { address: revokedAddress } = options;
    if (revokedAddress === undefined) {
        throw new Error('Must provide an approved --address to revoke approvals for');
    }
    const turbo = await turboFromOptions(options);
    const revokedApprovals = await turbo.revokeCredits({
        revokedAddress,
    });
    console.log(JSON.stringify({ message: 'Revoked credit share approvals!', revokedApprovals }, null, 2));
}
