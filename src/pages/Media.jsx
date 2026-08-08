import "./Media.css";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Bookmark,
  Clapperboard,
  ExternalLink,
  Film,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from "lucide-react";

import {
  getLibraryItems,
  getLatestMedia,
  getResumeMedia,
  mediaUrl,
} from "../services/jellyfinService";
import { services } from "../data/services";

const TYPES = [
  { id: "", label: "All" },
  { id: "Movie", label: "Movies" },
  { id: "Series", label: "TV Shows" },
];

function PosterSkeleton() {
  return <div className="skeleton media-card-sk" />;
}

function RowSkeleton() {
  return <div className="skeleton media-poster-sk" />;
}

function SectionError({ onRetry }) {
  return (
    <div className="error-card">
      <div className="error-icon">
        <Clapperboard size={20} />
      </div>

      <div className="error-body">
        <h3>Jellyfin is unreachable</h3>
        <p>This section needs the Jellyfin server. Check it, then retry.</p>
      </div>

      <button type="button" className="retry-btn" onClick={onRetry}>
        <RefreshCw size={15} />
        Retry
      </button>
    </div>
  );
}

function PosterCard({ item, onOpen }) {
  return (
    <div
      className="poster-card"
      onClick={() => onOpen(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(item);
        }
      }}
    >
      {item.poster ? (
        <img src={mediaUrl(item.poster)} alt={item.name} loading="lazy" />
      ) : (
        <div className="poster-fallback">
          <Clapperboard size={22} />
        </div>
      )}

      <div className="poster-overlay">
        <span className="type-badge">{item.type}</span>
        <h4>{item.name}</h4>
        <p>{item.year || "—"}</p>
      </div>
    </div>
  );
}

export default function Media() {
  const [searchParams] = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [debounced, setDebounced] = useState(searchParams.get("q") || "");
  const [type, setType] = useState("");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState(null);

  const [recent, setRecent] = useState([]);
  const [recentState, setRecentState] = useState({ loading: true, error: null });

  const [resume, setResume] = useState([]);
  const [resumeState, setResumeState] = useState({ loading: true, error: null });

  const jellyfin = services.find((service) => service.id === "jellyfin");

  // Debounce the search box.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(id);
  }, [query]);

  const loadRecent = useCallback(async () => {
    setRecentState({ loading: true, error: null });
    try {
      const data = await getLatestMedia();
      setRecent(data);
      setRecentState({ loading: false, error: null });
    } catch (err) {
      console.error("[REX OS] recent load failed:", err);
      setRecentState({ loading: false, error: err });
    }
  }, []);

  const loadResume = useCallback(async () => {
    setResumeState({ loading: true, error: null });
    try {
      const data = await getResumeMedia();
      setResume(data);
      setResumeState({ loading: false, error: null });
    } catch (err) {
      console.error("[REX OS] resume load failed:", err);
      setResumeState({ loading: false, error: err });
    }
  }, []);

  // Fetch the library whenever the filter or search term changes.
  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);

    getLibraryItems({ type, search: debounced, startIndex: 0, limit: 24 })
      .then((data) => {
        if (!active) return;
        setItems(data.items);
        setTotal(data.total);
      })
      .catch((err) => {
        console.error("[REX OS] library load failed:", err);
        if (active) {
          setError(err);
          setItems([]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [type, debounced, reload]);

  // Side sections load once on mount.
  useEffect(() => {
    loadRecent();
    loadResume();
  }, [loadRecent, loadResume]);

  // Close the detail modal on Escape.
  useEffect(() => {
    if (!selected) return;

    function onKey(event) {
      if (event.key === "Escape") setSelected(null);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  async function loadMore() {
    setLoadingMore(true);

    try {
      const data = await getLibraryItems({
        type,
        search: debounced,
        startIndex: items.length,
        limit: 24,
      });

      setItems((prev) => [...prev, ...data.items]);
      setTotal(data.total);
    } catch (err) {
      console.error("[REX OS] load more failed:", err);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head fade-up">
        <h1>Media Library</h1>
        <p>Movies, TV Shows and Anime from Jellyfin</p>
      </div>

      <div className="media-toolbar fade-up">
        <div className="media-search">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search titles…"
            aria-label="Search titles"
          />
        </div>

        <div className="media-chips">
          {TYPES.map((option) => (
            <button
              key={option.id || "all"}
              type="button"
              className={`chip ${type === option.id ? "active" : ""}`}
              onClick={() => setType(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Recently Added */}
      <section className="media-section fade-up">
        <div className="media-section-head">
          <h2>
            <Sparkles size={18} />
            Recently Added
          </h2>
        </div>

        {recentState.loading ? (
          <div className="media-poster-row" aria-busy="true">
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </div>
        ) : recentState.error ? (
          <SectionError onRetry={loadRecent} />
        ) : recent.length === 0 ? (
          <p className="section-empty">Nothing added yet.</p>
        ) : (
          <div className="media-poster-row">
            {recent.map((item) => (
              <PosterCard key={item.id} item={item} onOpen={setSelected} />
            ))}
          </div>
        )}
      </section>

      {/* Continue Watching */}
      <section className="media-section fade-up">
        <div className="media-section-head">
          <h2>
            <Bookmark size={18} />
            Continue Watching
          </h2>
        </div>

        {resumeState.loading ? (
          <div className="media-poster-row" aria-busy="true">
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </div>
        ) : resumeState.error ? (
          <SectionError onRetry={loadResume} />
        ) : resume.length === 0 ? (
          <p className="section-empty">Nothing in progress.</p>
        ) : (
          <div className="media-poster-row">
            {resume.map((item) => (
              <PosterCard key={item.id} item={item} onOpen={setSelected} />
            ))}
          </div>
        )}
      </section>

      {/* Library */}
      <section className="media-section fade-up">
        <div className="media-section-head">
          <h2>
            <Film size={18} />
            Library
          </h2>

          {!loading && !error && (
            <span className="media-count">
              {total} {total === 1 ? "title" : "titles"}
              {debounced && (
                <>
                  {" "}
                  for “{debounced}”
                </>
              )}
            </span>
          )}
        </div>

        {loading ? (
          <div className="media-grid" aria-busy="true">
            {Array.from({ length: 12 }).map((_, index) => (
              <PosterSkeleton key={index} />
            ))}
          </div>
        ) : error ? (
          <SectionError onRetry={() => setReload((value) => value + 1)} />
        ) : items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Film size={24} />
            </div>
            <h3>
              {debounced
                ? `No results for “${debounced}”`
                : "Your library is empty"}
            </h3>
            <p>
              {debounced
                ? "Try a different search term or clear the filter."
                : "Add media to Jellyfin and it will appear here after the next scan."}
            </p>
          </div>
        ) : (
          <>
            <div className="media-grid">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="media-card fade-up"
                  onClick={() => setSelected(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelected(item);
                    }
                  }}
                >
                  {item.poster ? (
                    <img src={mediaUrl(item.poster)} alt={item.name} loading="lazy" />
                  ) : (
                    <div className="media-fallback">
                      <Clapperboard size={26} />
                      <span>{item.name}</span>
                    </div>
                  )}

                  <div className="media-overlay">
                    <span className="type-badge">{item.type}</span>
                    <h4>{item.name}</h4>
                    <p>{item.year || "—"}</p>
                  </div>
                </div>
              ))}
            </div>

            {items.length < total && (
              <button
                type="button"
                className="load-more fade-up"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            )}
          </>
        )}
      </section>

      {selected && (
        <div
          className="media-backdrop"
          onClick={() => setSelected(null)}
          role="presentation"
        >
          <div
            className="media-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={selected.name}
          >
            <button
              type="button"
              className="media-modal-close"
              onClick={() => setSelected(null)}
              aria-label="Close details"
            >
              <X size={20} />
            </button>

            {selected.backdrop && (
              <div
                className="media-modal-hero"
                style={{
                  backgroundImage: `linear-gradient(rgba(0,0,0,.25), rgba(0,0,0,.25)), url(${mediaUrl(selected.backdrop)})`,
                }}
              />
            )}

            <div className="media-modal-body">
              <h2>{selected.name}</h2>

              <div className="media-modal-meta">
                <span className="type-badge">{selected.type}</span>
                <span>{selected.year || "—"}</span>
                {selected.type === "Series" && <span>TV</span>}
              </div>

              <p className="media-modal-overview">
                {selected.overview || "No synopsis available for this title."}
              </p>

              <div className="media-modal-actions">
                {jellyfin && (
                  <a
                    className="retry-btn"
                    href={`${jellyfin.url}/web/index.html#!/details?id=${selected.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink size={16} />
                    Open in Jellyfin
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
