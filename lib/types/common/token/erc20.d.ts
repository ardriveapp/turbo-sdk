import { ethers } from 'ethers';
import { TokenConfig, TokenCreateTxParams } from '../../types.js';
import { EthereumToken } from './ethereum.js';
export type ERC20Contract = ethers.Contract & {
    decimals(): Promise<number>;
    balanceOf(addr: string): Promise<bigint>;
    transfer(to: string, value: string | number | bigint, opts?: unknown): Promise<ethers.TransactionResponse>;
};
export declare class ERC20Token extends EthereumToken {
    private tokenContract;
    constructor({ tokenContractAddress, logger, gatewayUrl, pollingOptions, }: TokenConfig & {
        tokenContractAddress: string;
    });
    createAndSubmitTx({ target, tokenAmount, signer, turboCreditDestinationAddress, }: TokenCreateTxParams): Promise<{
        id: string;
        target: string;
    }>;
}
//# sourceMappingURL=erc20.d.ts.map