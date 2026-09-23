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

  // Intercept @healthcare/shared and its subpaths
  if (moduleName === '@healthcare/shared') {
    return context.resolveRequest(
      context,
      path.resolve(workspaceRoot, 'packages/shared/src/index.ts'),
      platform
    );
  }

  if (moduleName.startsWith('@healthcare/shared/')) {
    const subpath = moduleName.slice('@healthcare/shared/'.length);
    const candidateFile = path.resolve(workspaceRoot, 'packages/shared/src', `${subpath}.ts`);
    if (fs.existsSync(candidateFile)) {
      return context.resolveRequest(context, candidateFile, platform);
    }
    const candidateIndex = path.resolve(workspaceRoot, 'packages/shared/src', subpath, 'index.ts');
    if (fs.existsSync(candidateIndex)) {
      return context.resolveRequest(context, candidateIndex, platform);
    }
  }

  // Let Metro resolve everything else normally
  return context.resolveRequest(context, moduleName, platform);
};

// Add mappings for @healthcare/shared to allow Metro extraNodeModules resolution
const sharedPkgDir = path.resolve(workspaceRoot, 'packages/shared');
const sharedSrcDir = path.resolve(sharedPkgDir, 'src');

extraNodeModules['@healthcare/shared'] = path.resolve(sharedSrcDir, 'index.ts');
extraNodeModules['@healthcare/shared/vitals'] = path.resolve(sharedSrcDir, 'vitals.ts');
extraNodeModules['@healthcare/shared/types'] = path.resolve(sharedSrcDir, 'types.ts');
extraNodeModules['@healthcare/shared/validators'] = path.resolve(sharedSrcDir, 'validators.ts');
extraNodeModules['@healthcare/shared/records'] = path.resolve(sharedSrcDir, 'records.ts');
extraNodeModules['@healthcare/shared/visit-lifecycle'] = path.resolve(sharedSrcDir, 'visit-lifecycle.ts');
extraNodeModules['@healthcare/shared/doctor-badge'] = path.resolve(sharedSrcDir, 'doctor-badge.ts');
extraNodeModules['@healthcare/shared/extractors'] = path.resolve(sharedSrcDir, 'extractors.ts');
extraNodeModules['@healthcare/shared/coding'] = path.resolve(sharedSrcDir, 'coding.ts');
extraNodeModules['@healthcare/shared/diagnostics'] = path.resolve(sharedSrcDir, 'diagnostics.ts');
extraNodeModules['@healthcare/shared/contracts'] = path.resolve(sharedSrcDir, 'contracts/index.ts');

if (fs.existsSync(sharedSrcDir)) {
  for (const entry of fs.readdirSync(sharedSrcDir)) {
    const full = path.join(sharedSrcDir, entry);
    const stat = fs.statSync(full);
    if (stat.isFile() && entry.endsWith('.ts') && !entry.endsWith('.test.ts') && !entry.endsWith('.d.ts')) {
      const name = entry.replace(/\.ts$/, '');
      extraNodeModules[`@healthcare/shared/${name}`] = full;
    } else if (stat.isDirectory()) {
      const indexCandidate = path.join(full, 'index.ts');
      if (fs.existsSync(indexCandidate)) {
        extraNodeModules[`@healthcare/shared/${entry}`] = indexCandidate;
      }
    }
  }
}

config.resolver.extraNodeModules = extraNodeModules;

module.exports = config;
