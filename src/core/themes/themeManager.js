/**
 * REX OS theme registry.
 *
 * Each theme maps to a `data-theme` attribute that flips CSS accent
 * variables (see src/styles/theme.css) and a local artwork file:
 *
 *   public/assets/goku.png       → goku theme
 *   public/assets/luffy.png      → luffy theme
 *   public/assets/naruto.png     → naruto theme
 *   public/assets/all_three.png  → trio theme (Luffy + Naruto + Goku combined)
 *   public/assets/background.png → login page background
 *   public/assets/banner.png     → home hero banner
 *
 * Uploaded assets are preferred automatically by the artwork resolver
 * (core/themes/artwork.js). Per-theme folders at public/themes/<id>/ (e.g.
 * `background.jpg`/`background.png`/…) and the built-in SVG scenery remain
 * as fallbacks, and the `rex` theme keeps its existing artwork. The
 * `artwork` values below are only the built-in SVG fallbacks.
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
