import {
  ArconnectSigner,
  TurboAuthenticatedClient,
  TurboFactory,
} from '@ardrive/turbo-sdk/web';
import Arweave from 'arweave';
import { JWKInterface } from 'arweave/node/lib/wallet';
import { useEffect, useState } from 'react';

import './App.css';

// enable debug logs
TurboFactory.setLogLevel('debug');

const arweave = new Arweave({
  host: 'arweave.net',
  port: 443,
  protocol: 'https',
});

function App() {
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
      const buffer = await selectedFile.arrayBuffer();
      const upload = await turbo.uploadFile({
        fileStreamFactory: () =>
          new ReadableStream({
            start(controller) {
              controller.enqueue(buffer);
              controller.close();
            },
          }),
        fileSizeFactory: () => selectedFile.size,
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
          },
          onSigningSuccess: () => {
            console.log('Signing success!');
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
          },
          onUploadError: (error: Error) => {
            console.log('Upload error:', { error });
          },
          onUploadSuccess: () => {
            console.log('Upload success!');
          },
        },
      });
      setUploadStatus(`Upload successful! ${JSON.stringify(upload, null, 2)}`);
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
    if (jwk) {
      setTurbo(
        TurboFactory.authenticated({
          privateKey: JSON.parse(jwk),
        }),
      );
    }
    if (wallet && 'connect' in wallet) {
      setTurbo(
        TurboFactory.authenticated({
          signer: new ArconnectSigner(window.arweaveWallet),
          paymentServiceConfig: {
            url: 'https://payment.ardrive.dev',
          },
          uploadServiceConfig: {
            url: 'https://upload.ardrive.dev',
          },
        }),
      );
    }
  }, [jwk, wallet]);

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
        <button
          onClick={async () => {
            if (!window.arweaveWallet) {
              setUploadStatus('No arweave wallet injected');
              return;
            }
            if (window.arweaveWallet) {
              try {
                const requiredPermissions = [
                  'ACCESS_ADDRESS',
                  'ACCESS_PUBLIC_KEY',
                  'SIGNATURE',
                  'SIGN_TRANSACTION',
                ];
                const isConnected = await window.arweaveWallet.getPermissions();
                if (isConnected.length === requiredPermissions.length) {
                  setUploadStatus('Wallet already connected');
                  setWallet(window.arweaveWallet);
                  setShowJwkInput(false);
                  return;
                }
                await window.arweaveWallet.connect([
                  'ACCESS_ADDRESS',
                  'ACCESS_PUBLIC_KEY',
                  'SIGNATURE',
                  'SIGN_TRANSACTION',
                ]);
                setWallet(window.arweaveWallet);
                setShowJwkInput(false);
              } catch (error) {
                setUploadStatus(
                  `Error connecting with injected arweave wallet: ${
                    error instanceof Error ? error.message : 'Unknown error'
                  }`,
                );
              }
            }
          }}
        >
          {wallet && 'connect' in wallet
            ? 'connected'
            : 'Connect with Injected Arweave Wallet'}
        </button>

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
          </div>
        ) : wallet && !('connect' in wallet) ? (
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
        ) : null}
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

export default App;
