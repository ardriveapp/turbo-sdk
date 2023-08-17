module.exports = {
  extends: ['@commitlint/config-conventional'],
  ignores: [(message) => message.includes('[skip ci]')],
  rules: {
    'body-max-line-length': [0, 'always', Infinity],
  },
};
