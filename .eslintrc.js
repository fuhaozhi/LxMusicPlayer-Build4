module.exports = {
  root: true,
  extends: '@react-native',
  globals: {
    // src/lx-api（lx-ios-api 运行时）使用 ES2020 全局
    globalThis: 'readonly',
    BigInt: 'readonly',
  },
};
