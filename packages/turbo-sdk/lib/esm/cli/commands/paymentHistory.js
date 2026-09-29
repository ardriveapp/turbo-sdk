import { turboFromOptions } from '../utils.js';
export async function paymentHistory(options) {
    // Signature-required and self-scoped: a wallet is mandatory (there is no
    // --address form), and the service returns only this signer's own top-ups.
    const turbo = await turboFromOptions(options);
    const limit = options.limit !== undefined ? +options.limit : undefined;
    if (limit !== undefined &&
        (!Number.isInteger(limit) || limit < 1 || limit > 100)) {
        throw new Error('--limit must be an integer between 1 and 100');
    }
    const { payments, hasMore, cursor } = await turbo.getPaymentHistory({
        limit,
        cursor: options.cursor,
    });
    // stdout carries only the JSON page and the next-page hint goes to stderr, so
    // `... | jq` works at the default log level. (--debug intentionally routes SDK
    // logs to stdout and will interleave — expected when you ask for debug output.)
    console.log(JSON.stringify({ payments, hasMore, cursor }, null, 2));
    if (hasMore) {
        console.error(`\nMore results available — fetch the next page with --cursor ${cursor}`);
    }
}
