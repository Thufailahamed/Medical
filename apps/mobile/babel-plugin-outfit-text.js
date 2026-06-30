/**
 * Rewrites `import { Text, ... } from "react-native"` to use AppText so
 * fontWeight maps to the correct Outfit file on Android (avoids Roboto fallback).
 */
module.exports = function outfitTextBabelPlugin() {
  return {
    name: "outfit-text",
    visitor: {
      ImportDeclaration(path, state) {
        if (path.node.source.value !== "react-native") return;

        const textSpecifier = path.node.specifiers.find(
          (s) =>
            s.type === "ImportSpecifier" &&
            s.imported.type === "Identifier" &&
            s.imported.name === "Text"
        );
        if (!textSpecifier) return;

        // Skip our AppText wrapper itself
        if (state.filename?.includes("AppText.tsx")) return;

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

        path.insertBefore(appTextImport);
        path.node.specifiers = path.node.specifiers.filter(
          (s) => s !== textSpecifier
        );
        if (path.node.specifiers.length === 0) {
          path.remove();
        }
      },
    },
  };
};
