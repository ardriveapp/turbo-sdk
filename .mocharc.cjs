'use-strict';

process.env.NODE_ENV = 'test';

// Mocha configuration file
// Reference for options: https://github.com/mochajs/mocha/blob/master/example/config/.mocharc.js
module.exports = {
  extension: ['ts'],
  spec: ['tests/**/*.test.ts', 'src/**/*.test.ts'], // Add this to target spec files: ,"tests/**/*.spec.ts"
  require: ['ts-node/register/transpile-only'],
  timeout: '10000', // 10 seconds
  parallel: false,
  recursive: true,
  loader: 'ts-node/esm',
};
