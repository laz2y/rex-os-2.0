/**
 * REX OS artwork resolution.
 *
 * Each theme has a folder at public/themes/<id>/ and looks for a file named
 * `background` in any common image format (JPG first — real photos are
 * usually JPG/PNG; the bundled SVG scenery is the last fallback). The theme
 * id itself is also accepted as a filename, so a file renamed to
 * `goku.jpg`, `login.jpg` or `banner.jpg` works too.
 *
 *   public/themes/goku/background.jpg   ← your upload (any of the below)
 *   public/themes/goku/goku.jpg
 *   public/themes/goku/background.png
 *   public/themes/goku/background.webp
 *   public/themes/goku/background.avif
 *   public/themes/goku/background.svg   ← built-in fallback artwork
 *
 * Slots:
 *   rex, luffy, naruto, goku, trio  → selectable anime themes (dashboard
 *                                     background, Home hero, Settings
 *                                     previews)
 *   login                           → Login page full-screen background
 *   banner                          → Home hero banner (falls back to the
 *                                     active theme's artwork if absent)
 *
 * Drop a file into the folder, refresh, and every surface picks it up
 * automatically — no React code changes needed.
 */

const EXTENSIONS = ["jpg", "jpeg", "png", "webp", "avif", "svg"];

const cache = new Map();

/** Candidate filenames for a slot: the documented `background` plus the id. */
function candidateNames(slot) {
  return ["background", slot];
}

/** Candidate URLs for a slot, in priority order. */
export function artworkCandidates(slot) {
  const urls = [];
  for (const name of candidateNames(slot)) {
    for (const extension of EXTENSIONS) {
      urls.push(`/themes/${slot}/${name}.${extension}`);
    }
  }
  return urls;
}

/** URL of the first loadable artwork file for a slot (resolves once, cached). */
export function resolveArtwork(slot) {
  if (cache.has(slot)) {
    return Promise.resolve(cache.get(slot));
  }

  return new Promise((resolve) => {
    const candidates = artworkCandidates(slot);
    let index = 0;

    function tryNext() {
      if (index >= candidates.length) {
        cache.set(slot, null);
        resolve(null);
        return;
      }

      const url = candidates[index];
      index += 1;

      const image = new Image();
      image.onload = () => {
        cache.set(slot, url);
        resolve(url);
      };
      image.onerror = () => tryNext();
      image.src = url;
    }

    tryNext();
  });
}

/** Point the global --theme-bg-image variable at the slot's real artwork. */
export function setThemeArtwork(slot) {
  return resolveArtwork(slot).then((url) => {
    document.documentElement.style.setProperty(
      "--theme-bg-image",
      url ? `url("${url}")` : "none",
    );
    return url;
  });
}

/**
 * Apply any slot's artwork to a CSS variable — e.g. the Login page uses
 * setSlotArtwork("login", "--login-bg-image") and the Home hero uses
 * setSlotArtwork("banner", "--banner-bg-image"). When no upload exists
 * the variable is removed, so CSS fallbacks like
 * `var(--login-bg-image, var(--theme-bg-image))` chain to the theme
 * artwork gracefully.
 */
export function setSlotArtwork(slot, cssVariable) {
  return resolveArtwork(slot).then((url) => {
    if (url) {
      document.documentElement.style.setProperty(
        cssVariable,
        `url("${url}")`,
      );
    } else {
      document.documentElement.style.removeProperty(cssVariable);
    }
    return url;
  });
}
