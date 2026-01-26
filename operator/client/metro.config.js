const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '..');

// Build a cross-platform pattern for the server folder
const serverAbs = path.resolve(repoRoot, 'server').replace(/[/\\]/g, '[\\/]');

const config = getDefaultConfig(projectRoot);

// Block the server folder from being resolved by the client bundler
config.resolver.blockList = exclusionList([
  new RegExp(`${serverAbs}.*`),
]);

// Optional: watch the repo root for convenience
config.watchFolders = [repoRoot];

module.exports = config;


