"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseEthToken = exports.defaultBaseNetworkPollingOptions = void 0;
const common_js_1 = require("../../utils/common.js");
const ethereum_js_1 = require("./ethereum.js");
exports.defaultBaseNetworkPollingOptions = {
    initialBackoffMs: 2_500,
    maxAttempts: 10,
    pollingIntervalMs: 750,
};
class BaseEthToken extends ethereum_js_1.EthereumToken {
    constructor({ logger, gatewayUrl = common_js_1.defaultProdGatewayUrls['base-eth'], pollingOptions = exports.defaultBaseNetworkPollingOptions, } = {}) {
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
exports.BaseEthToken = BaseEthToken;
