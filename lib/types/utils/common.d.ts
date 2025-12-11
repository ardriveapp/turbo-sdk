import { TokenType, TurboSigner, TurboWallet } from '../types.js';
export declare function sleep(ms: number): Promise<void>;
export declare function isWeb(): boolean;
export declare const tokenToDevGatewayMap: Record<TokenType, string>;
export declare const tokenToDevAoConfigMap: {
    ario: {
        processId: string;
        cuUrl: string;
    };
};
export declare const defaultProdGatewayUrls: Record<TokenType, string>;
export declare const defaultProdAoConfigs: {
    ario: {
        processId: string;
        cuUrl: string;
    };
};
export declare function createTurboSigner({ signer: clientProvidedSigner, privateKey: clientProvidedPrivateKey, token, }: {
    signer?: TurboSigner;
    privateKey?: TurboWallet;
    token: TokenType;
}): TurboSigner;
export declare function signerFromKyvePrivateKey(privateKey: string): TurboSigner;
export declare function signerFromKyveMnemonic(mnemonic: string): Promise<TurboSigner>;
export declare function isBlob(val: unknown): val is Blob;
export declare function isValidArweaveBase64URL(base64URL: string): boolean;
export declare function isValidSolanaAddress(address: string): boolean;
export declare function isValidECDSAAddress(address: string): boolean;
export declare function isValidKyveAddress(address: string): boolean;
export declare function isValidUserAddress(address: string, type: TokenType): boolean;
export declare function isAnyValidUserAddress(address: string): TokenType | false;
//# sourceMappingURL=common.d.ts.map