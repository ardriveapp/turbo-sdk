import Arweave from 'arweave';
import { expect } from 'chai';
import { createReadStream, statSync } from 'node:fs';
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

describe('Delegated Payments', () => {
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

    expect(controlledWinc).to.equal('766');
    expect(effectiveBalance).to.equal('766');
    expect(wincLater).to.equal('766');
  });

  let oldestApprovalId: string;

  describe('shareCredits', () => {
    it('should properly create a credit share approval', async () => {
      const { approvalDataItemId, payingAddress } = await turbo.shareCredits({
        approvedWincAmount: '100',
        approvedAddress: unfundedSignerAddress1,
      });
      oldestApprovalId = approvalDataItemId;
      expect(approvalDataItemId).to.be.a('string');
      expect(payingAddress).to.equal(arweavePayerAddress);

      const balance = await turbo.getBalance();
      const {
        controlledWinc,
        effectiveBalance,
        givenApprovals,
        receivedApprovals,
        winc,
      } = balance;

      expect(controlledWinc).to.equal('766');
      expect(winc).to.equal('666');
      expect(effectiveBalance).to.equal('666');
      expect(givenApprovals).to.have.length(1);
      expect(receivedApprovals).to.have.length(0);
    });

    it('should properly create a credit share approval with expiration, and the approval should expire as expected', async () => {
      const { approvalDataItemId, payingAddress } = await turbo.shareCredits({
        approvedWincAmount: '100',
        approvedAddress: unfundedSignerAddress1,
        expiresBySeconds: 1,
      });
      expect(approvalDataItemId).to.be.a('string');
      expect(payingAddress).to.equal(arweavePayerAddress);

      const balance = await turbo.getBalance();
      const {
        controlledWinc,
        effectiveBalance,
        givenApprovals,
        receivedApprovals,
        winc,
      } = balance;

      expect(controlledWinc).to.equal('766');
      expect(winc).to.equal('566');
      expect(effectiveBalance).to.equal('566');
      expect(givenApprovals).to.have.length(2);
      expect(receivedApprovals).to.have.length(0);
      await sleep(1500);

      const balanceLater = await turbo.getBalance();
      const {
        controlledWinc: controlledWincLater,
        effectiveBalance: effectiveBalanceLater,
        givenApprovals: givenApprovalsLater,
        receivedApprovals: receivedApprovalsLater,
        winc: wincLater,
      } = balanceLater;

      expect(controlledWincLater).to.equal('766');
      expect(effectiveBalanceLater).to.equal('666');
      expect(wincLater).to.equal('666');
      expect(givenApprovalsLater).to.have.length(1);
      expect(receivedApprovalsLater).to.have.length(0);
    });

    it('should fail to create payment approvals to invalid addresses', async () => {
      await expectAsyncErrorThrow({
        promiseToError: turbo.shareCredits({
          approvedWincAmount: '100',
          approvedAddress: 'invalidAddress',
        }),
        errorMessage:
          'Failed request: 400: Unable to create credit share approval : Invalid approved address',
        errorType: 'FailedRequestError',
      });
    });

    it('should fail to create payment approvals when payer has insufficient balance for approval', async () => {
      await expectAsyncErrorThrow({
        promiseToError: turbo.shareCredits({
          approvedWincAmount: '10000',
          approvedAddress: unfundedSignerAddress1,
        }),
        errorMessage: `Failed request: 400: Unable to create credit share approval : Insufficient balance for '${arweavePayerAddress}'`,
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
      expect(givenApprovals).to.have.length(4);
      expect(givenApprovals[0].approvalDataItemId).to.equal(
        approvalWithNearExpirationId,
      );
      expect(givenApprovals[1].approvalDataItemId).to.equal(
        approvalWithFarExpirationId,
      );
      expect(givenApprovals[2].approvalDataItemId).to.equal(oldestApprovalId);
      expect(givenApprovals[3].approvalDataItemId).to.equal(
        newApprovalWithNoExpirationId,
      );
    });

    it('should properly get credit share approvals when no approvals are present', async () => {
      const { givenApprovals } = await TurboFactory.unauthenticated(
        {},
      ).getCreditShareApprovals({
        userAddress: 'stub-43-char-address-stub-43-char-address-0',
      });
      expect(givenApprovals).to.have.length(0);
    });
  });

  describe('revokeCredits', () => {
    it('should properly revoke all credit share approvals for given address', async () => {
      const { givenApprovals } = await turbo.getBalance();
      expect(givenApprovals).to.have.length(4);

      await turbo.revokeCredits({
        revokedAddress: unfundedSignerAddress1,
      });

      const { givenApprovals: givenApprovalsLater } = await turbo.getBalance();
      expect(givenApprovalsLater).to.have.length(0);
    });

    it('should fail to revoke if there are no credit share approvals for given address', async () => {
      await expectAsyncErrorThrow({
        promiseToError: turbo.revokeCredits({
          revokedAddress: 'stub-43-char-address-stub-43-char-address-0',
        }),
        errorMessage:
          'Failed request: 400: Unable to revoke credit share approval !',
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
      expect(payerBalance.winc).to.equal('0');
      expect(+payerBalance.controlledWinc).to.equal(766_000_000_000);

      const signerBalance = await signerTurbo.getBalance();
      expect(signerBalance.winc).to.equal('0');
      expect(+signerBalance.effectiveBalance).to.equal(766_000_000_000);
    });

    const filePath = new URL('files/1MB_file', import.meta.url).pathname;
    const fileSize = statSync(filePath).size;
    it('should properly use a credit share approvals to upload data when paid-by is provided', async () => {
      const { winc } = await signerTurbo.uploadFile({
        dataItemOpts: { paidBy: payingAddress },
        fileStreamFactory: () => createReadStream(filePath),
        fileSizeFactory: () => fileSize,
      });

      expect(winc).to.not.equal('0');

      const payerBalance = await payingTurbo.getBalance();
      expect(payerBalance.winc).to.equal('0');
      expect(+payerBalance.controlledWinc).to.equal(766_000_000_000 - +winc);

      const signerBalance = await signerTurbo.getBalance();
      expect(signerBalance.winc).to.equal('0');
      expect(+signerBalance.effectiveBalance).to.equal(766_000_000_000 - +winc);
    });

    it('should properly use a credit share approvals to upload data when multiple paid-bys are provided', async () => {
      const payerBalance = await payingTurbo.getBalance();

      const { winc } = await signerTurbo.uploadFile({
        dataItemOpts: { paidBy: [signerAddress, payingAddress] },
        fileStreamFactory: () => createReadStream(filePath),
        fileSizeFactory: () => fileSize,
      });

      expect(winc).to.not.equal('0');
      const payerBalanceLater = await payingTurbo.getBalance();
      expect(+payerBalanceLater.controlledWinc).to.equal(
        +payerBalance.controlledWinc - +winc,
      );
    });
  });
});
