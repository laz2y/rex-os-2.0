/**
 * Deterministic "poster" gradients for the media library. Jellyfin normally
 * serves artwork; until a real server is wired up, each item derives a
 * unique, pleasant gradient from its stored hue.
 */
export function posterGradient(hue: number): string {
  const h2 = (hue + 38) % 360;
  const h3 = (hue + 70) % 360;
  return `linear-gradient(160deg, hsl(${hue} 62% 32%) 0%, hsl(${h2} 60% 20%) 52%, hsl(${h3} 62% 12%) 100%)`;
}

export function posterGlow(hue: number): string {
  return `radial-gradient(120% 90% at 50% 0%, hsla(${hue} 90% 60% / 0.16), transparent 60%)`;
}

export function posterAccent(hue: number): string {
  return `hsl(${hue} 90% 62%)`;
}
