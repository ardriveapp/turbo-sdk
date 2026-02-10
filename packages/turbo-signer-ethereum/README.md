# @ardrive/turbo-signer-ethereum

Ethereum signer for [Turbo SDK](https://github.com/ardriveapp/turbo-sdk) - supports Ethereum, Base L2, and Polygon networks.

## Installation

```bash
npm install @ardrive/turbo-signer-ethereum
# or
yarn add @ardrive/turbo-signer-ethereum
```

### Peer Dependencies

This package requires the following peer dependencies:

```bash
npm install @ardrive/turbo-sdk ethers @ethersproject/signing-key
```

## Usage

### Creating a Signer

```typescript
import {
  TurboEthereumSigner,
  createEthereumSigner,
} from '@ardrive/turbo-signer-ethereum';

// From a hex string (with or without 0x prefix)
const signer = createEthereumSigner(
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
);

// Or without the 0x prefix
const signer2 = createEthereumSigner(
  'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
);

// From a Uint8Array
const privateKeyBytes = new Uint8Array([
  /* 32 bytes */
]);
const signer3 = createEthereumSigner(privateKeyBytes);

// Using the class directly
const signer4 = new TurboEthereumSigner(privateKey);
```

### Using with Turbo SDK

```typescript
import { TurboFactory } from '@ardrive/turbo-sdk';
import { createEthereumSigner } from '@ardrive/turbo-signer-ethereum';

const signer = createEthereumSigner(process.env.ETH_PRIVATE_KEY);

const turbo = TurboFactory.authenticated({
  signer,
  token: 'ethereum', // or 'base-eth', 'pol', 'matic'
});

// Get your balance
const balance = await turbo.getBalance();

// Upload a file
const result = await turbo.uploadFile({
  fileStreamFactory: () => fs.createReadStream('path/to/file'),
  fileSizeFactory: () => fs.statSync('path/to/file').size,
});
```

### Signer Methods

```typescript
const signer = createEthereumSigner(privateKey);

// Get the native Ethereum address
const address = await signer.getNativeAddress();
// => '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

// Sign data
const signature = await signer.sign(new Uint8Array([1, 2, 3]));

// Send a transaction (used internally by Turbo for crypto top-ups)
const txHash = await signer.sendTransaction({
  target: '0x...',
  amount: new BigNumber('0.1'),
  gatewayUrl: 'https://mainnet.infura.io/v3/...',
});

// Access public key and constants
console.log(signer.publicKey); // Uint8Array (65 bytes)
console.log(signer.ownerLength); // 65
console.log(signer.signatureLength); // 65
```

## Supported Networks

This signer supports native token transfers on Ethereum-compatible networks:

| Token           | Network          | Crypto Top-ups |
| --------------- | ---------------- | -------------- |
| `ethereum`      | Ethereum Mainnet | ✅             |
| `base-eth`      | Base L2          | ✅             |
| `pol` / `matic` | Polygon          | ✅             |

### ERC20 Tokens

For ERC20 token transfers (USDC, ARIO), you need to use a wallet adapter instead of this signer:

| Token          | Network          | Requires Wallet Adapter |
| -------------- | ---------------- | ----------------------- |
| `usdc`         | USDC on Ethereum | Yes                     |
| `base-usdc`    | USDC on Base     | Yes                     |
| `polygon-usdc` | USDC on Polygon  | Yes                     |
| `base-ario`    | ARIO on Base     | Yes                     |

## License

Apache-2.0
