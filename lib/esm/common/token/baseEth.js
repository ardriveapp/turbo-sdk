import { defaultProdGatewayUrls } from '../../utils/common.js';
import { EthereumToken } from './ethereum.js';
export const defaultBaseNetworkPollingOptions = {
    initialBackoffMs: 2_500,
    maxAttempts: 10,
    pollingIntervalMs: 750,
};
export class BaseEthToken extends EthereumToken {
    constructor({ logger, gatewayUrl = defaultProdGatewayUrls['base-eth'], pollingOptions = defaultBaseNetworkPollingOptions, } = {}) {
        super({
            logger,
            gatewayUrl,
            pollingOptions,
        });
    }
    async getTxAvailability(txId) {
        const tx = await this.rpcProvider.getTransactionReceipt(txId);
        if (tx) {
            const confirmations = await tx.confirmations();
            if (confirmations >= 1) {
                this.logger.debug('Transaction is available on chain', {
                    txId,
                    tx,
                    confirmations,
                });
                return true;
            }
        }
        this.logger.debug('Transaction not yet available on chain', { txId, tx });
        return false;
    }
}
