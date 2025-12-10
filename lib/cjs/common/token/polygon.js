"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolygonToken = exports.defaultPolygonPollingOptions = exports.POLToTokenAmount = void 0;
const common_js_1 = require("../../utils/common.js");
const logger_js_1 = require("../logger.js");
const ethereum_js_1 = require("./ethereum.js");
exports.POLToTokenAmount = ethereum_js_1.ETHToTokenAmount;
exports.defaultPolygonPollingOptions = {
    maxAttempts: 10,
    initialBackoffMs: 5_000,
    pollingIntervalMs: 1_000,
};
class PolygonToken extends ethereum_js_1.EthereumToken {
    constructor({ logger = logger_js_1.Logger.default, gatewayUrl = common_js_1.defaultProdGatewayUrls.pol, pollingOptions = exports.defaultPolygonPollingOptions, } = {}) {
        super({ logger, gatewayUrl, pollingOptions });
    }
}
exports.PolygonToken = PolygonToken;
