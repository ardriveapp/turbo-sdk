import Arweave from 'arweave';
import { strict as assert } from 'node:assert';
import { createReadStream, statSync } from 'node:fs';
import { afterEach, before, describe, it } from 'node:test';
import { restore, stub } from 'sinon';

import { JWKInterface } from '../src/common/jwk.js';
import { TurboAuthenticatedClient } from '../src/common/turbo.js';
import { TurboFactory } from '../src/node/factory.js';
import { UserAddress } from '../src/types.js';
import { jwkToPublicArweaveAddress } from '../src/utils/base64.js';
import { sleep } from '../src/utils/common.js';
import {
  arweaveUrlString,
  expectAsyncErrorThrow,
  fundArLocalWalletAddress,
  mineArLocalBlock,
  sendFundTransaction,
  turboDevelopmentConfigurations,
} from './helpers.js';

describe('Credit Sharing', () => {
  afterEach(() => {
    // Restore all stubs
    restore();
  });

  let fundedPayerArweaveJwk: JWKInterface;

  let arweavePayerAddress: UserAddress;
  const unfundedSignerAddress1: UserAddress =
    '43CharArweaveStubAddress1234567890123456789';

  const arweaveTestConfig = {
    ...turboDevelopmentConfigurations,
    gatewayUrl: arweaveUrlString,
  };
  let turbo: TurboAuthenticatedClient;

  before(async () => {
    fundedPayerArweaveJwk = await Arweave.crypto.generateJWK();

    arweavePayerAddress = jwkToPublicArweaveAddress(fundedPayerArweaveJwk);

    await fundArLocalWalletAddress(arweavePayerAddress);

    turbo = TurboFactory.authenticated({
      privateKey: fundedPayerArweaveJwk,
      ...arweaveTestConfig,
    });
    const id = await sendFundTransaction(1000, fundedPayerArweaveJwk);
    await mineArLocalBlock(25);
    await turbo.submitFundTransaction({
      txId: id,
    });

    const res = await turbo.getBalance();
    const { controlledWinc, effectiveBalance, winc: wincLater } = res;

    assert.equal(controlledWinc, '766');
    assert.equal(effectiveBalance, '766');
    assert.equal(wincLater, '766');
  });

  let oldestApprovalId: string;

  describe('shareCredits', () => {
    it('should properly create a credit share approval', async () => {
      const { approvalDataItemId, payingAddress } = await turbo.shareCredits({
        approvedWincAmount: '100',
        approvedAddress: unfundedSignerAddress1,
      });
      oldestApprovalId = approvalDataItemId;
      assert.ok(typeof approvalDataItemId === 'string');
      assert.equal(payingAddress, arweavePayerAddress);

      const balance = await turbo.getBalance();
      const {
        controlledWinc,
        effectiveBalance,
        givenApprovals,
        receivedApprovals,
        winc,
      } = balance;

      assert.equal(controlledWinc, '766');
      assert.equal(winc, '666');
      assert.equal(effectiveBalance, '666');
      assert.equal(givenApprovals.length, 1);
      assert.equal(receivedApprovals.length, 0);
    });

    it('should properly create a credit share approval with expiration, and the approval should expire as expected', async () => {
      const { approvalDataItemId, payingAddress } = await turbo.shareCredits({
        approvedWincAmount: '100',
        approvedAddress: unfundedSignerAddress1,
        expiresBySeconds: 1,
      });
      assert.ok(typeof approvalDataItemId === 'string');
      assert.equal(payingAddress, arweavePayerAddress);

      const balance = await turbo.getBalance();
      const {
        controlledWinc,
        effectiveBalance,
        givenApprovals,
        receivedApprovals,
        winc,
      } = balance;

      assert.equal(controlledWinc, '766');
      assert.equal(winc, '566');
      assert.equal(effectiveBalance, '566');
      assert.equal(givenApprovals.length, 2);
      assert.equal(receivedApprovals.length, 0);
      await sleep(1500);

      const balanceLater = await turbo.getBalance();
      const {
        controlledWinc: controlledWincLater,
        effectiveBalance: effectiveBalanceLater,
        givenApprovals: givenApprovalsLater,
        receivedApprovals: receivedApprovalsLater,
        winc: wincLater,
      } = balanceLater;

      assert.equal(controlledWincLater, '766');
      assert.equal(effectiveBalanceLater, '666');
      assert.equal(wincLater, '666');
      assert.equal(givenApprovalsLater.length, 1);
      assert.equal(receivedApprovalsLater.length, 0);
    });

    it('should fail to create payment approvals to invalid addresses', async () => {
      await expectAsyncErrorThrow({
        promiseToError: turbo.shareCredits({
          approvedWincAmount: '100',
          approvedAddress: 'invalidAddress',
        }),
        errorMessage:
          'Failed to upload file after 1 attempts\nFailed request (Status 400): Unable to create delegated payment approval : Invalid approved address',
        errorType: 'FailedRequestError',
      });
    });

    it('should fail to create payment approvals when payer has insufficient balance for approval', async () => {
      await expectAsyncErrorThrow({
        promiseToError: turbo.shareCredits({
          approvedWincAmount: '10000',
          approvedAddress: unfundedSignerAddress1,
        }),
        errorMessage: `Failed to upload file after 1 attempts\nFailed request (Status 400): Unable to create delegated payment approval : Insufficient balance for '${arweavePayerAddress}'`,
        errorType: 'FailedRequestError',
      });
    });

    it('should throw an error when create approval uploadFile succeeds but does not return the created approval', async () => {
      stub(turbo['uploadService'], 'uploadFile').resolves({
        winc: '100',
        dataCaches: [],
        fastFinalityIndexes: [],
        id: 'id',
        owner: 'owner',
      });
      await expectAsyncErrorThrow({
        promiseToError: turbo.shareCredits({
          approvedAddress: 'stub-43-char-address-stub-43-char-address-0',
          approvedWincAmount: '100',
        }),
        errorMessage: `Failed to create credit share approval but upload has succeeded\n{"winc":"100","dataCaches":[],"fastFinalityIndexes":[],"id":"id","owner":"owner"}`,
        errorType: 'Error',
      });
    });
  });

  describe('getCreditShareApprovals', () => {
    it('should properly get all credit share approvals for given signer -- sorted by expiration date first, then by creation date', async () => {
      const newApprovalWithNoExpirationId = (
        await turbo.shareCredits({
          approvedWincAmount: '100',
          approvedAddress: unfundedSignerAddress1,
        })
      ).approvalDataItemId;
      const approvalWithFarExpirationId = (
        await turbo.shareCredits({
          approvedWincAmount: '100',
          approvedAddress: unfundedSignerAddress1,
          expiresBySeconds: 10000,
        })
      ).approvalDataItemId;
      const approvalWithNearExpirationId = (
        await turbo.shareCredits({
          approvedWincAmount: '100',
          approvedAddress: unfundedSignerAddress1,
          expiresBySeconds: 10,
        })
      ).approvalDataItemId;

      const { givenApprovals } = await turbo.getCreditShareApprovals();
      assert.equal(givenApprovals.length, 4);
      assert.equal(
        givenApprovals[0].approvalDataItemId,
        approvalWithNearExpirationId,
      );
      assert.equal(
        givenApprovals[1].approvalDataItemId,
        approvalWithFarExpirationId,
      );
      assert.equal(givenApprovals[2].approvalDataItemId, oldestApprovalId);
      assert.equal(
        givenApprovals[3].approvalDataItemId,
        newApprovalWithNoExpirationId,
      );
    });

    it('should properly get credit share approvals when no approvals are present', async () => {
      const { givenApprovals } = await TurboFactory.unauthenticated(
        {},
      ).getCreditShareApprovals({
        userAddress: 'stub-43-char-address-stub-43-char-address-0',
      });
      assert.equal(givenApprovals.length, 0);
    });
  });

  describe('revokeCredits', () => {
    it('should properly revoke all credit share approvals for given address', async () => {
      const { givenApprovals } = await turbo.getBalance();
      assert.equal(givenApprovals.length, 4);

      await turbo.revokeCredits({
        revokedAddress: unfundedSignerAddress1,
      });

      const { givenApprovals: givenApprovalsLater } = await turbo.getBalance();
      assert.equal(givenApprovalsLater.length, 0);
    });

    it('should fail to revoke if there are no credit share approvals for given address', async () => {
      await expectAsyncErrorThrow({
        promiseToError: turbo.revokeCredits({
          revokedAddress: 'stub-43-char-address-stub-43-char-address-0',
        }),
        errorMessage:
          'Failed to upload file after 1 attempts\nFailed request (Status 400): Unable to revoke delegated payment approval !',
        errorType: 'FailedRequestError',
      });
    });

    it('should throw an error when revoke uploadFile succeeds but does not return the revoked approvals', async () => {
      stub(turbo['uploadService'], 'uploadFile').resolves({
        winc: '100',
        dataCaches: [],
        fastFinalityIndexes: [],
        id: 'id',
        owner: 'owner',
      });
      await expectAsyncErrorThrow({
        promiseToError: turbo.revokeCredits({
          revokedAddress: 'stub-43-char-address-stub-43-char-address-0',
        }),
        errorMessage:
          'Failed to revoke credit share approvals but upload has succeeded\n{"winc":"100","dataCaches":[],"fastFinalityIndexes":[],"id":"id","owner":"owner"}',
        errorType: 'Error',
      });
    });
  });

  describe('using credit share approvals', () => {
    let signerJwk: JWKInterface;
    let payingJwk: JWKInterface;

    let signerTurbo: TurboAuthenticatedClient;
    let payingTurbo: TurboAuthenticatedClient;

    let signerAddress: UserAddress;
    let payingAddress: UserAddress;

    before(async () => {
      signerJwk = await Arweave.crypto.generateJWK();
      signerTurbo = TurboFactory.authenticated({
        ...arweaveTestConfig,
        privateKey: signerJwk,
      });
      signerAddress = jwkToPublicArweaveAddress(signerJwk);

      payingJwk = await Arweave.crypto.generateJWK();
      payingTurbo = TurboFactory.authenticated({
        ...arweaveTestConfig,
        privateKey: payingJwk,
      });
      payingAddress = jwkToPublicArweaveAddress(payingJwk);

      await fundArLocalWalletAddress(jwkToPublicArweaveAddress(payingJwk));
      const id = await sendFundTransaction(1_000_000_000_000, payingJwk);
      await mineArLocalBlock(25);
      await payingTurbo.submitFundTransaction({
        txId: id,
      });

      await payingTurbo.shareCredits({
        approvedWincAmount: 766_000_000_000,
        approvedAddress: signerAddress,
      });

      const payerBalance = await payingTurbo.getBalance();
      assert.equal(payerBalance.winc, '0');
      assert.equal(+payerBalance.controlledWinc, 766_000_000_000);

      const signerBalance = await signerTurbo.getBalance();
      assert.equal(signerBalance.winc, '0');
      assert.equal(+signerBalance.effectiveBalance, 766_000_000_000);
    });

    const filePath = new URL('files/1MB_file', import.meta.url).pathname;
    const fileSize = statSync(filePath).size;
    it('should properly use a credit share approvals to upload data when paid-by is provided', async () => {
      const { winc } = await signerTurbo.uploadFile({
        dataItemOpts: { paidBy: payingAddress },
        fileStreamFactory: () => createReadStream(filePath),
        fileSizeFactory: () => fileSize,
      });

      assert.notEqual(winc, '0');

      const payerBalance = await payingTurbo.getBalance();
      assert.equal(payerBalance.winc, '0');
      assert.equal(+payerBalance.controlledWinc, 766_000_000_000 - +winc);

      const signerBalance = await signerTurbo.getBalance();
      assert.equal(signerBalance.winc, '0');
      assert.equal(+signerBalance.effectiveBalance, 766_000_000_000 - +winc);
    });

    it('should properly use a credit share approvals to upload data when multiple paid-bys are provided', async () => {
      const payerBalance = await payingTurbo.getBalance();

      const { winc } = await signerTurbo.uploadFile({
        dataItemOpts: { paidBy: [signerAddress, payingAddress] },
        fileStreamFactory: () => createReadStream(filePath),
        fileSizeFactory: () => fileSize,
      });

      assert.notEqual(winc, '0');
      const payerBalanceLater = await payingTurbo.getBalance();
      assert.equal(
        +payerBalanceLater.controlledWinc,
        +payerBalance.controlledWinc - +winc,
      );
    });
  });
});
