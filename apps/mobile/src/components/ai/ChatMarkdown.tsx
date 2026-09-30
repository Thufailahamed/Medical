import React from "react";
import { View, Text, type TextStyle } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

/**
 * Minimal Markdown for chat replies: headings, bullet / numbered lists
 * (with nesting by indent), **bold**, *italic*, `code`, and paragraphs.
 * LLM replies arrive as Markdown; rendering it raw showed literal `*`
 * and `+` markers to patients.
 */
export function ChatMarkdown({ text, color }: { text: string; color?: string }) {
  const { colors, typography, fontFamily, spacing } = useTheme();
  const fg = color ?? colors.text;
  const base: TextStyle = { ...typography.body.md, color: fg, lineHeight: 23 };

  const blocks = toBlocks(text);

  return (
    <View style={{ gap: spacing.sm }}>
      {blocks.map((b, i) => {
        if (b.kind === "heading") {
          return (
            <Text
              key={i}
              style={[b.level <= 2 ? typography.title.md : typography.title.sm, { color: fg, marginTop: i ? 4 : 0 }]}
            >
              {inline(b.text, base, fontFamily, colors)}
            </Text>
          );
        }
        if (b.kind === "list") {
          return (
            <View key={i} style={{ gap: 6 }}>
              {b.items.map((it, j) => (
                <View key={j} style={{ flexDirection: "row", paddingLeft: it.depth * 16, gap: 8 }}>
                  <Text style={[base, { color: colors.primary, minWidth: it.marker.length > 1 ? 18 : 10 }]}>
                    {it.marker}
                  </Text>
                  <Text style={[base, { flex: 1 }]}>{inline(it.text, base, fontFamily, colors)}</Text>
                </View>
              ))}
            </View>
          );
        }
        return (
          <Text key={i} style={base}>
            {inline(b.text, base, fontFamily, colors)}
          </Text>
        );
      })}
    </View>
  );
}

type Block =
  | { kind: "p"; text: string }
  | { kind: "heading"; level: number; text: string }
  | { kind: "list"; items: { depth: number; marker: string; text: string }[] };

function toBlocks(src: string): Block[] {
  const lines = (src || "").replace(/\r/g, "").split("\n");
  const out: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push({ kind: "p", text: para.join(" ").trim() });
    para = [];
  };
  for (const raw of lines) {
    const line = raw.replace(/\t/g, "    ");
    if (!line.trim()) {
      flush();
      continue;
    }
    const h = /^\s*(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      out.push({ kind: "heading", level: h[1].length, text: h[2] });
      continue;
    }
    const li = /^(\s*)([*+\-•]|\d+[.)])\s+(.*)$/.exec(line);
    if (li) {
      flush();
      const depth = Math.min(3, Math.ceil(li[1].length / 4));
      const marker = /\d/.test(li[2]) ? li[2].replace(")", ".") : depth ? "◦" : "•";
      const last = out[out.length - 1];
      const item = { depth, marker, text: li[3] };
      if (last && last.kind === "list") last.items.push(item);
      else out.push({ kind: "list", items: [item] });
      continue;
    }
    // A bold-only line ("**Summary:**") reads as a heading.
    const boldLine = /^\s*\*\*(.+?)\*\*:?\s*$/.exec(line);
    if (boldLine) {
      flush();
      out.push({ kind: "heading", level: 3, text: boldLine[1] });
      continue;
    }
    para.push(line.trim());
  }
  flush();
  return out;
}

function inline(s: string, base: TextStyle, fontFamily: any, colors: any): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**") || tok.startsWith("__")) {
      parts.push(
        <Text key={k++} style={{ fontFamily: fontFamily.bodyBold ?? base.fontFamily }}>
          {tok.slice(2, -2)}
        </Text>
      );
    } else if (tok.startsWith("`")) {
      parts.push(
        <Text key={k++} style={{ fontFamily: "Menlo", fontSize: (base.fontSize ?? 15) - 1, backgroundColor: colors.well }}>
          {tok.slice(1, -1)}
        </Text>
      );
    } else {
      parts.push(
        <Text key={k++} style={{ fontStyle: "italic" }}>
          {tok.slice(1, -1)}
        </Text>
      );
    }
    last = m.index + tok.length;
  }
  if (last < s.length) parts.push(s.slice(last));
  return parts;
}
