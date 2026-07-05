const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [workspaceRoot];

// 2. Let Metro resolve modules from both local and root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Build extraNodeModules mapping from BOTH the mobile app's local
//    node_modules AND the root node_modules (including the .bun cache).
//    This ensures Metro can resolve any dependency from anywhere.
const mobileNodeModules = path.resolve(projectRoot, 'node_modules');
const rootNodeModules = path.resolve(workspaceRoot, 'node_modules');
const extraNodeModules = {};

function scanNodeModules(nmPath) {
  if (!fs.existsSync(nmPath)) return;
  for (const name of fs.readdirSync(nmPath)) {
    if (name.startsWith('.')) continue;
    const fullPath = path.join(nmPath, name);
    if (name.startsWith('@')) {
      // Scoped packages
      try {
        for (const pkg of fs.readdirSync(fullPath)) {
          const key = `${name}/${pkg}`;
          // Don't overwrite mobile-local entries with root entries
          if (!extraNodeModules[key]) {
            extraNodeModules[key] = path.resolve(fullPath, pkg);
          }
        }
      } catch (e) { /* skip if not a directory */ }
    } else {
      if (!extraNodeModules[name]) {
        extraNodeModules[name] = path.resolve(fullPath);
      }
    }
  }
}

// Mobile-local first (higher priority), then root
scanNodeModules(mobileNodeModules);
scanNodeModules(rootNodeModules);

// Also scan inside each .bun cache entry's node_modules for peer deps
const bunCache = path.join(rootNodeModules, '.bun');
if (fs.existsSync(bunCache)) {
  for (const entry of fs.readdirSync(bunCache)) {
    const entryNm = path.join(bunCache, entry, 'node_modules');
    if (fs.existsSync(entryNm)) {
      scanNodeModules(entryNm);
    }
  }
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Force react and react-native (and their subpaths/runtimes) to always resolve locally
  if (
    moduleName === 'react' ||
    moduleName.startsWith('react/') ||
    moduleName === 'react-native' ||
    moduleName.startsWith('react-native/')
  ) {
    const localPath = path.resolve(projectRoot, 'node_modules', moduleName);
    return context.resolveRequest(
      context,
      localPath,
      platform
    );
  }
  // Let Metro resolve everything else normally
  return context.resolveRequest(context, moduleName, platform);
};

config.resolver.extraNodeModules = extraNodeModules;

module.exports = config;
