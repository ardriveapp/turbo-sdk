import Arweave from 'arweave';
import { expect } from 'chai';
import { createReadStream, statSync } from 'node:fs';

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

  describe('createDelegatedPaymentApproval', () => {
    it('should properly create a delegated payment approval', async () => {
      const { approvalDataItemId, payingAddress } =
        await turbo.createDelegatedPaymentApproval({
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

    it('should properly create a delegated payment approval with expiration, and the approval should expire as expected', async () => {
      const { approvalDataItemId, payingAddress } =
        await turbo.createDelegatedPaymentApproval({
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
        promiseToError: turbo.createDelegatedPaymentApproval({
          approvedWincAmount: '100',
          approvedAddress: 'invalidAddress',
        }),
        errorMessage:
          'Failed request: 400: Unable to create delegated payment approval : Invalid approved address',
        errorType: 'FailedRequestError',
      });
    });

    it('should fail to create payment approvals when payer has insufficient balance for approval', async () => {
      await expectAsyncErrorThrow({
        promiseToError: turbo.createDelegatedPaymentApproval({
          approvedWincAmount: '10000',
          approvedAddress: unfundedSignerAddress1,
        }),
        errorMessage: `Failed request: 400: Unable to create delegated payment approval : Insufficient balance for '${arweavePayerAddress}'`,
        errorType: 'FailedRequestError',
      });
    });
  });

  describe('getDelegatedPaymentApprovals', () => {
    it('should properly get all delegated payment approvals for given signer -- sorted by expiration date first, then by creation date', async () => {
      const newApprovalWithNoExpirationId = (
        await turbo.createDelegatedPaymentApproval({
          approvedWincAmount: '100',
          approvedAddress: unfundedSignerAddress1,
        })
      ).approvalDataItemId;
      const approvalWithFarExpirationId = (
        await turbo.createDelegatedPaymentApproval({
          approvedWincAmount: '100',
          approvedAddress: unfundedSignerAddress1,
          expiresBySeconds: 10000,
        })
      ).approvalDataItemId;
      const approvalWithNearExpirationId = (
        await turbo.createDelegatedPaymentApproval({
          approvedWincAmount: '100',
          approvedAddress: unfundedSignerAddress1,
          expiresBySeconds: 10,
        })
      ).approvalDataItemId;

      const { givenApprovals } = await turbo.getDelegatedPaymentApprovals();
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
  });

  describe('revokeDelegatedPaymentApprovals', () => {
    it('should properly revoke all delegated payment approvals for given address', async () => {
      const { givenApprovals } = await turbo.getBalance();
      expect(givenApprovals).to.have.length(4);

      await turbo.revokeDelegatedPaymentApprovals({
        revokedAddress: unfundedSignerAddress1,
      });

      const { givenApprovals: givenApprovalsLater } = await turbo.getBalance();
      expect(givenApprovalsLater).to.have.length(0);
    });

    it('should fail to revoke if there are no delegated payment approvals for given address', async () => {
      await expectAsyncErrorThrow({
        promiseToError: turbo.revokeDelegatedPaymentApprovals({
          revokedAddress: 'stub-43-char-address-stub-43-char-address-0',
        }),
        errorMessage:
          'Failed request: 400: Unable to revoke delegated payment approval !',
        errorType: 'FailedRequestError',
      });
    });
  });

  describe('using delegated payment approvals', () => {
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

      await payingTurbo.createDelegatedPaymentApproval({
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

    it('should properly use a delegated payment approvals to upload data when paid-by is provided', async () => {
      const filePath = new URL('files/1MB_file', import.meta.url).pathname;
      const fileSize = statSync(filePath).size;

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
  });
});
