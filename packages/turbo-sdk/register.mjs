// Register ts-node/esm for TypeScript support in Node.js test runner
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

// Use ts-node to register TypeScript handling
register('ts-node/esm', pathToFileURL('./'));
