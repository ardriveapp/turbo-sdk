import { defaultProdGatewayUrls } from '../../utils/common.js';
import { Logger } from '../logger.js';
import { ETHToTokenAmount, EthereumToken } from './ethereum.js';
export const POLToTokenAmount = ETHToTokenAmount;
export const defaultPolygonPollingOptions = {
    maxAttempts: 10,
    initialBackoffMs: 5_000,
    pollingIntervalMs: 1_000,
};
export class PolygonToken extends EthereumToken {
    constructor({ logger = Logger.default, gatewayUrl = defaultProdGatewayUrls.pol, pollingOptions = defaultPolygonPollingOptions, } = {}) {
        super({ logger, gatewayUrl, pollingOptions });
    }
}
