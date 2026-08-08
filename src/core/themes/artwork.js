/**
 * Theme artwork resolution.
 *
 * Each theme has a folder at public/themes/<id>/ and looks for a file named
 * `background` in any common image format. Real photos are usually JPG/PNG,
 * so those are tried first; the bundled SVG scenery is the last fallback.
 *
 *   public/themes/luffy/background.jpg   ← your upload (any of the below)
 *   public/themes/luffy/background.jpeg
 *   public/themes/luffy/background.png
 *   public/themes/luffy/background.webp
 *   public/themes/luffy/background.avif
 *   public/themes/luffy/background.svg   ← built-in fallback artwork
 *
 * The same applies to rex, naruto, goku and trio.
 *
 * Drop a file into the folder (any of those names), refresh, and the theme,
 * the Home hero and the Settings preview all use it automatically.
 */

const EXTENSIONS = ["jpg", "jpeg", "png", "webp", "avif", "svg"];

const cache = new Map();

/** Candidate URLs for a theme, in priority order. */
export function artworkCandidates(themeId) {
  return EXTENSIONS.map((extension) => `/themes/${themeId}/background.${extension}`);
}

/** URL of the first loadable artwork file for a theme (resolves once, cached). */
export function resolveArtwork(themeId) {
  if (cache.has(themeId)) {
    return Promise.resolve(cache.get(themeId));
  }

  return new Promise((resolve) => {
    const candidates = artworkCandidates(themeId);
    let index = 0;

    function tryNext() {
      if (index >= candidates.length) {
        cache.set(themeId, null);
        resolve(null);
        return;
      }

      const url = candidates[index];
      index += 1;

      const image = new Image();
      image.onload = () => {
        cache.set(themeId, url);
        resolve(url);
      };
      image.onerror = () => tryNext();
      image.src = url;
    }

    tryNext();
  });
}

/** Point the global --theme-bg-image variable at the theme's real artwork. */
export function setThemeArtwork(themeId) {
  return resolveArtwork(themeId).then((url) => {
    document.documentElement.style.setProperty(
      "--theme-bg-image",
      url ? `url("${url}")` : "none",
    );
    return url;
  });
}
