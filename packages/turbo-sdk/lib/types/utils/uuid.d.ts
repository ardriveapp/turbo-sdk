/**
 * RFC 4122 version 4 UUID, derived from `randomBytes` (already used across the
 * SDK in both the node and web builds). Avoids depending on
 * `crypto.randomUUID`, whose availability varies by runtime/polyfill.
 */
export declare function uuidV4(): string;
//# sourceMappingURL=uuid.d.ts.map