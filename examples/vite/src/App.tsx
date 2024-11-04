import {
  TurboAuthenticatedClient,
  TurboFactory,
  developmentTurboConfiguration,
} from '@ardrive/turbo-sdk/web';
import Arweave from 'arweave';
import { JWKInterface } from 'arweave/node/lib/wallet';
import { useEffect, useState } from 'react';
import { ReadableStream } from 'web-streams-polyfill';

import './App.css';

const arweave = new Arweave({
  host: 'arweave.net',
  port: 443,
  protocol: 'https',
});

const fileToReadableStream = (file: File): ReadableStream => {
  const fileReader = new FileReader();
  const stream = new ReadableStream({
    start(controller) {
      fileReader.addEventListener('load', () =>
        controller.enqueue(fileReader.result as ArrayBuffer),
      );
    },
  });
  return stream;
};

function App() {
  const [wallet, setWallet] = useState<JWKInterface | null>(null);
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
      console.log(selectedFile);
      const upload = await turbo.uploadFile({
        fileStreamFactory: () => fileToReadableStream(selectedFile),
        fileSizeFactory: () => selectedFile.size,
      });
      console.log(upload);
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
      console.error('Error generating JWK:', error);
    }
  };

  const handleJwkChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJwk(event.target.value);
  };

  useEffect(() => {
    if (jwk) {
      setWallet(JSON.parse(jwk));
      setTurbo(
        TurboFactory.authenticated({
          ...developmentTurboConfiguration,
          privateKey: JSON.parse(jwk),
        }),
      );
    }
  }, [jwk]);

  return (
    <div
      className="App flex flex-col items-center"
      style={{ padding: '50px', height: '100vh' }}
    >
      <div
        className="flex flex-col items-center"
        style={{
          marginBottom: '20px',
          height: '100%',
        }}
      >
        <h2>File Upload with Turbo SDK</h2>

        {showJwkInput ? (
          <div style={{ marginBottom: '20px' }}>
            <textarea
              placeholder="Paste your JWK here..."
              value={jwk}
              onChange={handleJwkChange}
              style={{ width: '300px', height: '100px', marginRight: '10px' }}
            />
            <button onClick={generateRandomJwk}>Generate Random JWK</button>
          </div>
        ) : (
          <div style={{ marginBottom: '10px' }}>
            <p>Using generated JWK - {address}</p>
            <button onClick={() => setShowJwkInput(true)}>
              Use Different JWK
            </button>
          </div>
        )}

        <form onSubmit={handleUpload}>
          <input
            type="file"
            onChange={handleFileSelect}
            style={{ marginRight: '10px' }}
          />
          <button type="submit">Upload File</button>
        </form>

        {uploadStatus && <p style={{ marginTop: '10px' }}>{uploadStatus}</p>}
      </div>
    </div>
  );
}

export default App;
