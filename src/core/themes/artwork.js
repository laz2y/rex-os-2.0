/**
 * REX OS artwork resolution.
 *
 * Resolution order per slot:
 *
 *   1. The uploaded project assets (public/assets/*) — these are the real
 *      anime wallpapers and take priority.
 *   2. A per-theme folder at public/themes/<id>/ looking for a file named
 *      `background` in any common image format (JPG first, SVG last).
 *   3. The bundled SVG scenery as the final fallback.
 *
 * Uploaded assets (1) — served from public/ so the paths are stable in both
 * development and production builds:
 *
 *   /assets/goku.png       → goku theme
 *   /assets/luffy.png      → luffy theme
 *   /assets/naruto.png     → naruto theme
 *   /assets/all_three.png  → trio theme (Luffy + Naruto + Goku combined)
 *   /assets/background.png → login page background ONLY
 *   /assets/banner.png     → home hero banner ONLY
 *
 * The `rex` theme has no upload — it keeps its built-in REX artwork.
 *
 * Slots:
 *   rex, luffy, naruto, goku, trio  → selectable anime themes (dashboard
 *                                     background, Home hero, Settings
 *                                     previews)
 *   login                           → Login page full-screen background
 *   banner                          → Home hero banner (falls back to the
 *                                     active theme's artwork if absent)
 */

const EXTENSIONS = ["jpg", "jpeg", "png", "webp", "avif", "svg"];

/**
 * Uploaded project assets — served from public/ so these URLs work in
 * development and in the production build. These win over the per-theme
 * folders and the SVG fallback. (Slots without an entry, e.g. `rex`, keep
 * their existing artwork.)
 */
const UPLOADED_ASSETS = {
  goku: "/assets/goku.png",
  luffy: "/assets/luffy.png",
  naruto: "/assets/naruto.png",
  trio: "/assets/all_three.png",
  login: "/assets/background.png",
  banner: "/assets/banner.png",
};

const cache = new Map();

/** Candidate filenames for a slot: the documented `background` plus the id. */
function candidateNames(slot) {
  return ["background", slot];
}

/** Candidate URLs for a slot, in priority order (uploaded asset first). */
export function artworkCandidates(slot) {
  const urls = [];

  const uploaded = UPLOADED_ASSETS[slot];
  if (uploaded) urls.push(uploaded);

  for (const name of candidateNames(slot)) {
    for (const extension of EXTENSIONS) {
      const url = `/themes/${slot}/${name}.${extension}`;
      if (url !== uploaded) urls.push(url);
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
