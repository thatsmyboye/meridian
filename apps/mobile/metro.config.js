const { getDefaultConfig } = require("expo/metro-config");
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

module.exports = config;
