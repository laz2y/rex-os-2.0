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
 *
 * The artwork is original vector scenery (1600x900 landscape) so every
 * theme has a real visual identity. Drop your own image over any of those
 * files (or swap the `artwork` path below for a PNG/JPG) and the dashboard
 * artwork updates automatically.
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
];

export function getTheme(id) {
  return THEMES.find((theme) => theme.id === id) || THEMES[0];
}
