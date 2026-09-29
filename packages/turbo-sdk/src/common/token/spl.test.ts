import { HexInjectedSolanaSigner } from '@dha-team/arbundles';
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  Transaction,
} from '@solana/web3.js';
import { BigNumber } from 'bignumber.js';
import bs58 from 'bs58';
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import nacl from 'tweetnacl';

import { TurboFactory } from '../../node/factory.js';
import { SolanaWalletAdapter, TokenCreateTxParams } from '../../types.js';
import { SolanaUsdcToken } from './solanaUsdc.js';

const TURBO_WALLET = new PublicKey(
  '8jNb1d5mCSSU3UBEmSsSuZ4sXtR2Ad2V6DQkjxEgotRQ',
);
const BLOCKHASH = bs58.encode(new Uint8Array(32).fill(7));

/** A browser wallet: signs a transaction with its key, optionally changing it first. */
function walletFor(
  key: Keypair,
  {
    addInstruction = false,
  }: {
    addInstruction?: boolean;
  } = {},
) {
  const calls = { signTransaction: 0, signMessage: 0 };
  const adapter: SolanaWalletAdapter = {
    publicKey: key.publicKey,
    signMessage: async () => {
      calls.signMessage++;
      throw new Error('signMessage must not be used to sign a transaction');
    },
    signTransaction: async (tx: Transaction) => {
      calls.signTransaction++;
      // What a wallet hands back is a new, deserialized transaction.
      const copy = Transaction.from(
        tx.serialize({ requireAllSignatures: false, verifySignatures: false }),
      );
      if (addInstruction) {
        // Wallets such as Phantom may add compute-budget or guard instructions.
        const modified = new Transaction({
          feePayer: copy.feePayer,
          recentBlockhash: copy.recentBlockhash,
        });
        modified.add(
          ComputeBudgetProgram.setComputeUnitLimit({ units: 60_000 }),
        );
        modified.add(...copy.instructions);
        modified.sign(key);
        return modified;
      }
      copy.sign(key);
      return copy;
    },
  };
  return { adapter, calls };
}

/** A token whose RPC is stubbed, recording what is submitted. */
function stubbedToken() {
  const token = new SolanaUsdcToken();
  const sent: Buffer[] = [];
  const confirmed: { signature: string; lastValidBlockHeight: number }[] = [];
  (token as unknown as { connection: unknown }).connection = {
    getLatestBlockhash: async () => ({
      blockhash: BLOCKHASH,
      lastValidBlockHeight: 1_000,
    }),
    sendRawTransaction: async (raw: Buffer) => {
      sent.push(raw);
      return 'ignored';
    },
    confirmTransaction: async (strategy: {
      signature: string;
      lastValidBlockHeight: number;
    }) => {
      confirmed.push(strategy);
      return { value: { err: null } };
    },
  };
  return { token, sent, confirmed };
}

function params(
  signer: Partial<TokenCreateTxParams['signer']>,
): TokenCreateTxParams {
  return {
    target: TURBO_WALLET.toBase58(),
    tokenAmount: new BigNumber(1_000_000),
    feeMultiplier: 1,
    signer: signer as TokenCreateTxParams['signer'],
  };
}

describe('Solana wallet adapters with SPL tokens', () => {
  for (const token of ['solana', 'solana-usdc', 'ario'] as const) {
    it(`builds a Solana signer from a wallet adapter for ${token}`, () => {
      const { adapter } = walletFor(Keypair.generate());
      const turbo = TurboFactory.authenticated({
        token,
        walletAdapter: adapter,
      });
      const signer = (turbo as unknown as { signer: { signer: unknown } })
        .signer.signer;
      assert.ok(signer instanceof HexInjectedSolanaSigner);
    });
  }
});

describe('SplToken.createAndSubmitTx', () => {
  it('has a wallet sign the transaction, not a message', async () => {
    const key = Keypair.generate();
    const { adapter, calls } = walletFor(key);
    const { token, sent, confirmed } = stubbedToken();

    const { id } = await token.createAndSubmitTx(
      params({
        walletAdapter: adapter,
        getPublicKey: async () => Buffer.from(key.publicKey.toBytes()),
        signData: async () => {
          throw new Error('signData must not be used with a wallet adapter');
        },
      }),
    );

    assert.equal(calls.signTransaction, 1);
    assert.equal(calls.signMessage, 0);
    assert.equal(sent.length, 1);
    const submitted = Transaction.from(sent[0]);
    assert.ok(submitted.verifySignatures());
    assert.equal(id, bs58.encode(submitted.signature!));
    // Deserializing drops lastValidBlockHeight; confirmation must still get it.
    assert.deepEqual(confirmed, [
      {
        signature: id,
        blockhash: BLOCKHASH,
        lastValidBlockHeight: 1_000,
      },
    ]);
  });

  it('submits the transaction the wallet returns, including what it added', async () => {
    const key = Keypair.generate();
    const { adapter } = walletFor(key, { addInstruction: true });
    const { token, sent } = stubbedToken();

    const { id } = await token.createAndSubmitTx(
      params({
        walletAdapter: adapter,
        getPublicKey: async () => Buffer.from(key.publicKey.toBytes()),
      }),
    );

    const submitted = Transaction.from(sent[0]);
    assert.ok(submitted.verifySignatures());
    assert.ok(
      submitted.instructions[0].programId.equals(
        ComputeBudgetProgram.programId,
      ),
    );
    assert.equal(id, bs58.encode(submitted.signature!));
  });

  it('rejects a transaction the wallet returned unsigned', async () => {
    const key = Keypair.generate();
    const { token, sent } = stubbedToken();

    await assert.rejects(
      token.createAndSubmitTx(
        params({
          walletAdapter: {
            publicKey: key.publicKey,
            signMessage: async () => new Uint8Array(),
            signTransaction: async (tx: Transaction) => tx,
          },
          getPublicKey: async () => Buffer.from(key.publicKey.toBytes()),
        }),
      ),
      /unsigned/,
    );
    assert.equal(sent.length, 0);
  });

  it('still signs the message bytes with a private-key signer', async () => {
    const key = Keypair.generate();
    const { token, sent } = stubbedToken();
    let signed = 0;

    await token.createAndSubmitTx(
      params({
        getPublicKey: async () => Buffer.from(key.publicKey.toBytes()),
        signData: async (message: Uint8Array) => {
          signed++;
          return nacl.sign.detached(message, key.secretKey);
        },
      }),
    );

    assert.equal(signed, 1);
    assert.equal(sent.length, 1);
    assert.ok(Transaction.from(sent[0]).verifySignatures());
  });
});
