module.exports = {
  extends: ["@commitlint/config-conventional"],
  ignores: [(message) => message.includes("[skip ci]")],
  rules: {
    'body-max-length': [2, 'always', Infinity],
  },
};
