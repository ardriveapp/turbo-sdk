"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenToBaseMap = exports.exponentMap = exports.defaultTokenMap = void 0;
exports.isTokenType = isTokenType;
const types_js_1 = require("../../types.js");
const common_js_1 = require("../../utils/common.js");
const ario_js_1 = require("./ario.js");
const arweave_js_1 = require("./arweave.js");
const baseEth_js_1 = require("./baseEth.js");
const erc20_js_1 = require("./erc20.js");
const ethereum_js_1 = require("./ethereum.js");
const kyve_js_1 = require("./kyve.js");
const polygon_js_1 = require("./polygon.js");
const solana_js_1 = require("./solana.js");
const usdc_js_1 = require("./usdc.js");
const baseARIOContractAddress = '0x138746adfA52909E5920def027f5a8dc1C7EfFb6';
exports.defaultTokenMap = {
    arweave: (config) => new arweave_js_1.ArweaveToken(config),
    ario: (config) => new ario_js_1.ARIOToken(config),
    solana: (config) => new solana_js_1.SolanaToken(config),
    ethereum: (config) => new ethereum_js_1.EthereumToken(config),
    'base-eth': (config) => new baseEth_js_1.BaseEthToken(config),
    kyve: (config) => new kyve_js_1.KyveToken(config),
    matic: (config) => new polygon_js_1.PolygonToken(config),
    pol: (config) => new polygon_js_1.PolygonToken(config),
    usdc: (config) => new usdc_js_1.USDCToken({ network: 'ethereum', ...config }),
    'base-usdc': (config) => new usdc_js_1.USDCToken({ network: 'base', ...config }),
    'polygon-usdc': (config) => new usdc_js_1.USDCToken({ network: 'polygon', ...config }),
    'base-ario': (config) => new erc20_js_1.ERC20Token({
        ...config,
        pollingOptions: config.pollingOptions ?? baseEth_js_1.defaultBaseNetworkPollingOptions,
        tokenContractAddress: baseARIOContractAddress,
        gatewayUrl: config.gatewayUrl ?? common_js_1.defaultProdGatewayUrls['base-ario'],
    }),
};
const ethExponent = 18;
const usdcExponent = 6;
const arioExponent = 6;
exports.exponentMap = {
    arweave: 12,
    ario: arioExponent,
    'base-ario': arioExponent,
    solana: 9,
    ethereum: ethExponent,
    'base-eth': ethExponent,
    kyve: 6,
    matic: ethExponent,
    pol: ethExponent,
    usdc: usdcExponent,
    'base-usdc': usdcExponent,
    'polygon-usdc': usdcExponent,
};
exports.tokenToBaseMap = {
    arweave: (a) => (0, arweave_js_1.ARToTokenAmount)(a),
    ario: (a) => (0, ario_js_1.ARIOToTokenAmount)(a),
    'base-ario': (a) => (0, usdc_js_1.USDCToTokenAmount)(a),
    solana: (a) => (0, solana_js_1.SOLToTokenAmount)(a),
    ethereum: (a) => (0, ethereum_js_1.ETHToTokenAmount)(a),
    'base-eth': (a) => (0, ethereum_js_1.ETHToTokenAmount)(a),
    kyve: (a) => (0, kyve_js_1.KYVEToTokenAmount)(a),
    matic: (a) => (0, polygon_js_1.POLToTokenAmount)(a),
    pol: (a) => (0, polygon_js_1.POLToTokenAmount)(a),
    usdc: (a) => (0, usdc_js_1.USDCToTokenAmount)(a),
    'base-usdc': (a) => (0, usdc_js_1.USDCToTokenAmount)(a),
    'polygon-usdc': (a) => (0, usdc_js_1.USDCToTokenAmount)(a),
};
function isTokenType(token) {
    return types_js_1.tokenTypes.includes(token);
}
__exportStar(require("./arweave.js"), exports);
__exportStar(require("./ario.js"), exports);
__exportStar(require("./solana.js"), exports);
__exportStar(require("./ethereum.js"), exports);
__exportStar(require("./baseEth.js"), exports);
__exportStar(require("./polygon.js"), exports);
__exportStar(require("./kyve.js"), exports);
