const path = require("path");
const webpack = require("webpack");
const { DuplicatesPlugin } = require("inspectpack/plugin");

const config = {
  entry: "./lib-cjs/index.js",
  mode: "production",
  devtool: "source-map",
  output: {
    path: path.resolve(__dirname, "bundles"),
    filename: "bundle.js",
    libraryTarget: "umd",
    library: "Turbo",
    umdNamedDefine: true,
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: "process/browser",
      Buffer: ["buffer", "Buffer"],
    }),
    new DuplicatesPlugin({
      emitErrors: false,
      verbose: true,
    }),
  ],
  // module: {
  //   rules: [
  //     {
  //       test: /\.(ts|tsx)$/i,
  //       loader: "ts-loader",
  //       exclude: ["/node_modules/"],
  //     },
  //   ],
  // },
  resolve: {
    symlinks: false,
    extensions: [".ts", ".js"],
    alias: {
      process: "process/browser",
      crypto: "crypto-browserify",
      stream: "stream-browserify",
    },

    fallback: {
      ["stream/promises"]: false,
      crypto: require.resolve("crypto-browserify"),
      stream: require.resolve("stream-browserify"),
      events: require.resolve("events/"),
      buffer: require.resolve("buffer/"),
      process: require.resolve("process/browser"),
      path: false,
      fs: false,
      os: false,
      assert: false,
    },
  },
};

module.exports = () => {
  return config;
};
