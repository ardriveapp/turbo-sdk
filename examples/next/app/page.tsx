'use client';

import {
  ArconnectSigner,
  ArweaveSigner,
  TurboAuthenticatedClient,
  TurboFactory,
} from '@ardrive/turbo-sdk/web';
import Arweave from 'arweave';
import { JWKInterface } from 'arweave/node/lib/wallet';
import { useEffect, useState } from 'react';

import './globals.css';

// enable debug logs
TurboFactory.setLogLevel('debug');

const arweave = new Arweave({
  host: 'arweave.net',
  port: 443,
  protocol: 'https',
});

export default function Home() {
  const [wallet, setWallet] = useState<
    JWKInterface | Window['arweaveWallet'] | null
  >(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [jwk, setJwk] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [showJwkInput, setShowJwkInput] = useState(true);
  const [turbo, setTurbo] = useState<TurboAuthenticatedClient | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadStatus('');
    }
  };

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedFile) {
      setUploadStatus('Please select a file first');
      return;
    }

    console.log('Uploading selected file...');

    if (!wallet) {
      setUploadStatus('Please generate a wallet first');
      return;
    }

    if (!turbo) {
      setUploadStatus('Please generate a turbo client first');
      return;
    }

    try {
      setUploadStatus('Uploading...');

      const upload = await turbo.uploadFile({
        fileStreamFactory: () => selectedFile.stream(),
        fileSizeFactory: () => selectedFile.size,
        dataItemOpts: {
          tags: [
            {
              name: 'Content-Type',
              value: selectedFile.type || 'application/octet-stream',
            },
            { name: 'App-Name', value: 'Turbo-SDK-Next-Example' },
            { name: 'File-Name', value: selectedFile.name },
          ],
        },
        events: {
          onSigningProgress: ({
            totalBytes,
            processedBytes,
          }: {
            totalBytes: number;
            processedBytes: number;
          }) => {
            console.log('Signing progress:', {
              totalBytes,
              processedBytes,
            });
          },
          onSigningError: (error: Error) => {
            console.log('Signing error:', { error });
            setUploadStatus(
              `Signing error: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`,
            );
          },
          onSigningSuccess: () => {
            console.log('Signing success!');
            setUploadStatus('Signing success!');
          },
          onUploadProgress: ({
            totalBytes,
            processedBytes,
          }: {
            totalBytes: number;
            processedBytes: number;
          }) => {
            console.log('Upload progress:', {
              totalBytes,
              processedBytes,
            });
            setUploadStatus(
              `Upload progress: ${Math.round(
                (processedBytes / totalBytes) * 100,
              )}%`,
            );
          },
          onUploadError: (error: Error) => {
            console.log('Upload error:', { error });
            setUploadStatus(
              `Upload error: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`,
            );
          },
          onUploadSuccess: () => {
            console.log('Upload success!');
            setUploadStatus('Upload success!');
          },
        },
      });

      setUploadStatus(
        `Upload successful! JSON: ${JSON.stringify(upload, null, 2)}`,
      );
    } catch (error) {
      setUploadStatus(
        `Upload failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  };

  const generateRandomJwk = async () => {
    try {
      // Generate a random JWK
      const jwk = await arweave.wallets.generate();
      const address = await arweave.wallets.getAddress(jwk);
      setJwk(JSON.stringify(jwk));
      setAddress(address);
      setShowJwkInput(false);
    } catch (error) {
      setUploadStatus(
        `Error generating JWK: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  };

  const handleJwkChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJwk(event.target.value);
  };

  useEffect(() => {
    if (jwk) {
      setWallet(JSON.parse(jwk));
    }
  }, [jwk]);

  useEffect(() => {
    if (wallet) {
      setTurbo(
        TurboFactory.authenticated({
          signer: ('connect' in wallet
            ? new ArconnectSigner(wallet)
            : new ArweaveSigner(wallet)) as any,
          token: 'arweave',
        }),
      );
    }
  }, [wallet]);

  return (
    <div
      className="App flex flex-col items-center justify-center"
      style={{ padding: '50px', height: '100vh' }}
    >
      <div
        className="flex flex-col items-center justify-center"
        style={{
          marginBottom: '20px',
          height: '100%',
        }}
      >
        <h2>File Upload with Turbo SDK</h2>

        <h3>Provide a JWK</h3>

        {showJwkInput ? (
          <div
            style={{
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <textarea
              placeholder="Paste your JWK here..."
              value={jwk}
              onChange={handleJwkChange}
              style={{ width: '300px', height: '100px', marginRight: '10px' }}
            />
            or
            <button
              onClick={generateRandomJwk}
              style={{ marginLeft: '10px', height: '20px' }}
            >
              Generate Random JWK
            </button>
            or
            <button
              style={{ marginLeft: '10px', height: '20px' }}
              onClick={async () => {
                try {
                  if (window['arweaveWallet']) {
                    const requiredPermissions = [
                      'ACCESS_ADDRESS',
                      'ACCESS_PUBLIC_KEY',
                      'SIGN_TRANSACTION',
                      'SIGNATURE',
                    ];
                    const permissions =
                      await window['arweaveWallet'].getPermissions();
                    console.log('permissions', permissions);
                    if (
                      requiredPermissions.every((permission) =>
                        permissions.includes(permission as any),
                      )
                    ) {
                      setWallet(window['arweaveWallet']);
                    } else {
                      await window['arweaveWallet'].connect(
                        requiredPermissions as any,
                      );
                      setWallet(window['arweaveWallet']);
                    }

                    setShowJwkInput(false);
                  } else {
                  }
                } catch (error) {
                  setUploadStatus(
                    error instanceof Error ? error.message : 'Unknown error',
                  );
                }
              }}
            >
              Connect wallet
            </button>
          </div>
        ) : (
          <div
            style={{
              marginBottom: '10px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <p>Using generated JWK - {address}</p>
            <button onClick={() => setShowJwkInput(true)}>
              Use Different JWK
            </button>
          </div>
        )}
        <h3>Select a file to upload</h3>

        <form
          onSubmit={handleUpload}
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'column',
            width: '300px',
            margin: 'auto',
            gap: '20px',
          }}
        >
          <input
            type="file"
            onChange={handleFileSelect}
            style={{ display: 'block', marginTop: '10px' }}
          />
          <button type="submit">Upload File</button>
        </form>

        {uploadStatus && (
          <p
            style={{
              width: '500px',
              wordWrap: 'break-word',
              textAlign: 'center',
              margin: 'auto',
            }}
          >
            {uploadStatus}
          </p>
        )}
      </div>
    </div>
  );
}
