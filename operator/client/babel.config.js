module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Expo Router (keep this if using expo-router)
      require.resolve('expo-router/babel'),
      // Make "@/..." resolve to client/src
      ['module-resolver', {
        root: ['./'],
        alias: { '@': './src' },
        extensions: ['.tsx', '.ts', '.js', '.jsx', '.json'],
      }],
      'react-native-reanimated/plugin', // keep last
    ],
  };
};
