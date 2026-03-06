/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  name: "Meridian",
  slug: "meridian",
  owner: "thatsmyboye",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "meridian",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  splash: {
    image: "./assets/images/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.meridian.app",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    package: "com.meridian.app",
  },
  web: {
    bundler: "metro",
    output: "static",
  },
  plugins: [
    require.resolve("expo-router"),
    require.resolve("expo-updates"),
    [
      require.resolve("expo-notifications"),
      {
        icon: "./assets/images/icon.png",
        color: "#2563eb",
        sounds: [],
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  updates: {
    url: "https://u.expo.dev/1916c841-542c-4ef5-b3c1-8de20525be07",
  },
  runtimeVersion: {
    policy: "appVersion",
  },
  extra: {
    eas: {
      projectId: "1916c841-542c-4ef5-b3c1-8de20525be07",
    },
  },
};
