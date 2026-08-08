/**
 * REX OS theme registry.
 *
 * Each theme maps to a `data-theme` attribute that flips CSS accent
 * variables (see src/styles/theme.css) and a local artwork file:
 *
 *   public/themes/luffy/background.png
 *   public/themes/naruto/background.png
 *   public/themes/goku/background.png
 *
 * Drop your own images in those slots (1600x900 or larger, landscape) and
 * the dashboard artwork updates automatically. The classic REX theme uses
 * the original gradient background and no artwork.
 */
export const THEMES = [
  {
    id: "rex",
    name: "REX Blue",
    subtitle: "Classic",
    accent: "#3b82f6",
    accentDark: "#2563eb",
    artwork: null,
  },
  {
    id: "luffy",
    name: "Luffy",
    subtitle: "Straw Hat",
    accent: "#ef4444",
    accentDark: "#dc2626",
    artwork: "/themes/luffy/background.png",
  },
  {
    id: "naruto",
    name: "Naruto",
    subtitle: "Leaf Village",
    accent: "#f97316",
    accentDark: "#ea580c",
    artwork: "/themes/naruto/background.png",
  },
  {
    id: "goku",
    name: "Goku",
    subtitle: "Super Saiyan",
    accent: "#38bdf8",
    accentDark: "#0ea5e9",
    artwork: "/themes/goku/background.png",
  },
];

export function getTheme(id) {
  return THEMES.find((theme) => theme.id === id) || THEMES[0];
}
