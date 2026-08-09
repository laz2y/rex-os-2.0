/**
 * REX OS theme registry.
 *
 * Each theme maps to a `data-theme` attribute that flips CSS accent
 * variables (see src/styles/theme.css) and a local artwork file:
 *
 *   public/themes/rex/background.svg
 *   public/themes/luffy/background.svg
 *   public/themes/naruto/background.svg
 *   public/themes/goku/background.svg
 *   public/themes/trio/background.svg   (Luffy + Naruto + Goku combined)
 *
 * Uploaded images are preferred automatically by the artwork resolver
 * (core/themes/artwork.js): drop `background.jpg`/`background.png`/… into
 * any theme folder (or the `login` and `banner` slots) and every surface —
 * dashboard background, Home hero, Login page and Settings previews — uses
 * them without touching this file. The `artwork` values below are only the
 * built-in SVG fallbacks.
 */
export const THEMES = [
  {
    id: "rex",
    name: "REX OS",
    subtitle: "Classic",
    accent: "#3b82f6",
    accentDark: "#2563eb",
    artwork: "/themes/rex/background.svg",
  },
  {
    id: "luffy",
    name: "Luffy",
    subtitle: "Straw Hat",
    accent: "#ef4444",
    accentDark: "#dc2626",
    artwork: "/themes/luffy/background.svg",
  },
  {
    id: "naruto",
    name: "Naruto",
    subtitle: "Leaf Village",
    accent: "#f97316",
    accentDark: "#ea580c",
    artwork: "/themes/naruto/background.svg",
  },
  {
    id: "goku",
    name: "Goku",
    subtitle: "Super Saiyan",
    accent: "#38bdf8",
    accentDark: "#0ea5e9",
    artwork: "/themes/goku/background.svg",
  },
  {
    id: "trio",
    name: "The Trio",
    subtitle: "Luffy · Naruto · Goku",
    accent: "#fbbf24",
    accentDark: "#d97706",
    artwork: "/themes/trio/background.svg",
  },
];

export function getTheme(id) {
  return THEMES.find((theme) => theme.id === id) || THEMES[0];
}
