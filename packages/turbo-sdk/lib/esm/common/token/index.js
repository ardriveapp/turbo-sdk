import { tokenTypes, } from '../../types.js';
import { defaultProdGatewayUrls } from '../../utils/common.js';
import { ARIOToTokenAmount, ARIOToken } from './ario.js';
import { ARToTokenAmount, ArweaveToken } from './arweave.js';
import { BaseEthToken, defaultBaseNetworkPollingOptions } from './baseEth.js';
import { ERC20Token } from './erc20.js';
import { ETHToTokenAmount, EthereumToken } from './ethereum.js';
import { KYVEToTokenAmount, KyveToken } from './kyve.js';
import { POLToTokenAmount, PolygonToken } from './polygon.js';
import { SOLToTokenAmount, SolanaToken } from './solana.js';
import { USDCToTokenAmount, USDCToken } from './usdc.js';
const baseARIOContractAddress = '0x138746adfA52909E5920def027f5a8dc1C7EfFb6';
export const defaultTokenMap = {
    arweave: (config) => new ArweaveToken(config),
    ario: (config) => new ARIOToken(config),
    solana: (config) => new SolanaToken(config),
    ethereum: (config) => new EthereumToken(config),
    'base-eth': (config) => new BaseEthToken(config),
    kyve: (config) => new KyveToken(config),
    matic: (config) => new PolygonToken(config),
    pol: (config) => new PolygonToken(config),
    usdc: (config) => new USDCToken({ network: 'ethereum', ...config }),
    'base-usdc': (config) => new USDCToken({ network: 'base', ...config }),
    'polygon-usdc': (config) => new USDCToken({ network: 'polygon', ...config }),
    'base-ario': (config) => new ERC20Token({
        ...config,
        pollingOptions: config.pollingOptions ?? defaultBaseNetworkPollingOptions,
        tokenContractAddress: baseARIOContractAddress,
        gatewayUrl: config.gatewayUrl ?? defaultProdGatewayUrls['base-ario'],
    }),
};
const ethExponent = 18;
const usdcExponent = 6;
const arioExponent = 6;
export const exponentMap = {
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
export const tokenToBaseMap = {
    arweave: (a) => ARToTokenAmount(a),
    ario: (a) => ARIOToTokenAmount(a),
    'base-ario': (a) => USDCToTokenAmount(a),
    solana: (a) => SOLToTokenAmount(a),
    ethereum: (a) => ETHToTokenAmount(a),
    'base-eth': (a) => ETHToTokenAmount(a),
    kyve: (a) => KYVEToTokenAmount(a),
    matic: (a) => POLToTokenAmount(a),
    pol: (a) => POLToTokenAmount(a),
    usdc: (a) => USDCToTokenAmount(a),
    'base-usdc': (a) => USDCToTokenAmount(a),
    'polygon-usdc': (a) => USDCToTokenAmount(a),
};
export function isTokenType(token) {
    return tokenTypes.includes(token);
}
export * from './arweave.js';
export * from './ario.js';
export * from './solana.js';
export * from './ethereum.js';
export * from './baseEth.js';
export * from './polygon.js';
export * from './kyve.js';
