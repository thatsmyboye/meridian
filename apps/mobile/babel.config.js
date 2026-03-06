module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // jsxImportSource tells the JSX transform to use NativeWind's JSX runtime,
      // which converts className props to the style prop React Native expects.
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
