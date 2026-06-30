/**
 * Rewrites `import { Text, ... } from "react-native"` to use AppText so
 * fontWeight maps to the correct Outfit file on Android (avoids Roboto fallback).
 */
const path = require("path");

module.exports = function outfitTextBabelPlugin() {
  return {
    name: "outfit-text",
    visitor: {
      ImportDeclaration(importPath, state) {
        const filename = state.filename;
        if (!filename) return;

        // Never transform dependencies (e.g. expo/build/errors/AppEntryNotFound.js).
        if (filename.includes(`${path.sep}node_modules${path.sep}`)) return;

        // Only app source under apps/mobile/src
        const normalized = filename.split(path.sep).join("/");
        if (!normalized.includes("/apps/mobile/src/")) return;

        if (importPath.node.source.value !== "react-native") return;

        const textSpecifier = importPath.node.specifiers.find(
          (s) =>
            s.type === "ImportSpecifier" &&
            s.imported.type === "Identifier" &&
            s.imported.name === "Text"
        );
        if (!textSpecifier) return;

        if (normalized.endsWith("/AppText.tsx")) return;

        const appTextImport = {
          type: "ImportDeclaration",
          specifiers: [
            {
              type: "ImportSpecifier",
              imported: { type: "Identifier", name: "AppText" },
              local: textSpecifier.local,
            },
          ],
          source: {
            type: "StringLiteral",
            value: "@/components/ui/AppText",
          },
        };

        importPath.insertBefore(appTextImport);
        importPath.node.specifiers = importPath.node.specifiers.filter(
          (s) => s !== textSpecifier
        );
        if (importPath.node.specifiers.length === 0) {
          importPath.remove();
        }
      },
    },
  };
};
