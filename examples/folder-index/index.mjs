/**
 * Incremental folder uploads: deploy the same folder twice and pay once.
 *
 * `uploadFolder` re-signs and re-pays for every file on every run. An Arweave
 * upload is permanent, so paying a second time for byte-identical files buys
 * nothing. Pass a `folderIndex` and only the files that actually changed are
 * signed, uploaded and billed.
 *
 * Run: cd examples/folder-index && yarn && node index.mjs
 * This uploads to the Turbo development environment, not production.
 */
import {
  TurboFactory,
  composeFolderIndex,
  createChainFolderIndex,
  createFileFolderIndex,
  developmentTurboConfiguration,
} from '@ardrive/turbo-sdk/node';
import Arweave from 'arweave';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const jwk = await Arweave.init({}).wallets.generate();
const turbo = TurboFactory.authenticated({
  privateKey: jwk,
  ...developmentTurboConfiguration,
});

// A folder shaped like a build output: an entry point and a couple of assets.
const folder = mkdtempSync(join(tmpdir(), 'turbo-folder-index-'));
mkdirSync(join(folder, 'assets'));
writeFileSync(join(folder, 'index.html'), '<h1>hello</h1>');
writeFileSync(join(folder, 'assets/app.js'), 'console.log(1)');
writeFileSync(join(folder, 'assets/app.css'), 'body{color:red}');

/**
 * Two layers, and the order matters. The file index answers instantly on a
 * machine that keeps its working directory between deploys. The chain index
 * sweeps your own past uploads over a gateway's GraphQL, which is what lets a
 * CI runner with an empty working directory still skip.
 *
 * `getPublicKey()` is passed rather than an address because a gateway indexes
 * uploads under the base64url sha-256 of the public key, and a raw ed25519 key
 * base64urls to the same 43 characters as that address. Guessing wrong matches
 * nothing and silently re-uploads everything, so the SDK makes you say which
 * you have.
 */
const folderIndex = composeFolderIndex([
  createFileFolderIndex({ filePath: join(folder, '.turbo/index.jsonl') }),
  createChainFolderIndex({ owner: await turbo.signer.getPublicKey() }),
]);

const deploy = async (label) => {
  const { folderIndexSummary: s } = await turbo.uploadFolder({
    folderPath: folder,
    folderIndex,
    // Deploy-varying tags belong on the manifest. A commit sha in
    // `dataItemOpts` would change every file's key and re-upload the folder.
    manifestDataItemOpts: {
      tags: [{ name: 'Deploy', value: new Date().toISOString() }],
    },
  });
  console.log(
    `${label}: uploaded ${s.uploadedFiles}, reused ${s.reusedFiles} of ${s.totalFiles} files`,
  );
};

try {
  await deploy('first deploy ');
  await deploy('unchanged   ');

  writeFileSync(join(folder, 'assets/app.js'), 'console.log(2)');
  await deploy('one file edit');
} finally {
  rmSync(folder, { recursive: true, force: true });
}

/**
 * Expected:
 *   first deploy : uploaded 3, reused 0 of 3 files
 *   unchanged    : uploaded 0, reused 3 of 3 files
 *   one file edit: uploaded 1, reused 2 of 3 files
 */
