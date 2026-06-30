module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: ["./babel-plugin-outfit-text.js", "react-native-reanimated/plugin"],
  };
};
