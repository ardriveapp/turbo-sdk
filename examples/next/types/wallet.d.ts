// types/wallet.d.ts
interface Window {
  ethereum?: {
    request: (args: { method: string; params?: any[] }) => Promise<any>;
    on?: (event: string, handler: (...args: any[]) => void) => void;
    removeListener?: (event: string, handler: (...args: any[]) => void) => void;
    isMetaMask?: boolean;
  };
  arweaveWallet?: {
    connect: (permissions: string[]) => Promise<void>;
    disconnect: () => Promise<void>;
    getActiveAddress: () => Promise<string>;
    getPermissions: () => Promise<string[]>;
    sign: (transaction: any) => Promise<any>;
    getPublicKey: () => Promise<string>;
  };
}
