const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

// Monorepo roots
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in the monorepo so Metro picks up changes in packages/*
config.watchFolders = [workspaceRoot];

// 2. Resolve packages from the workspace root first, then the project root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// 3. Wrap with NativeWind — processes global.css through Tailwind and injects
//    the resulting style sheet into the bundle at startup.
module.exports = withNativeWind(config, { input: "./global.css" });
