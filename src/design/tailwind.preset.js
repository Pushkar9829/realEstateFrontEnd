// design/tokens.json -> Tailwind theme. Components use only these names
// (brand-600, ink-muted, surface-muted, rounded-lg ...) so web and app match.
import { createRequire } from 'node:module';

const tokens = createRequire(import.meta.url)('./tokens.json');

const { color, font, radius, shadow, breakpoint } = tokens;

export default {
  theme: {
    screens: breakpoint,
    extend: {
      colors: color,
      fontFamily: { sans: font.family.sans.split(',').map((s) => s.trim()), mono: font.family.mono.split(',').map((s) => s.trim()) },
      fontSize: Object.fromEntries(Object.entries(font.size).map(([k, [size, lineHeight]]) => [k, [size, { lineHeight }]])),
      borderRadius: radius,
      boxShadow: shadow,
      borderColor: { DEFAULT: color.line.DEFAULT },
    },
  },
};
