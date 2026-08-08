import "./Media.css";

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Clapperboard,
  ExternalLink,
  Film,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

import { getLibraryItems, mediaUrl } from "../services/jellyfinService";
import { services } from "../data/services";

const TYPES = [
  { id: "", label: "All" },
  { id: "Movie", label: "Movies" },
  { id: "Series", label: "TV Shows" },
];

function PosterSkeleton() {
  return <div className="skeleton media-card-sk" />;
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
  const [selected, setSelected] = useState(null);

  const jellyfin = services.find((service) => service.id === "jellyfin");

  // Debounce the search box.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(id);
  }, [query]);

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
  }, [type, debounced]);

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

      {!loading && !error && (
        <p className="media-count fade-up">
          {total} {total === 1 ? "title" : "titles"}
          {debounced && (
            <>
              {" "}
              for “{debounced}”
            </>
          )}
        </p>
      )}

      {loading ? (
        <div className="media-grid" aria-busy="true">
          {Array.from({ length: 12 }).map((_, index) => (
            <PosterSkeleton key={index} />
          ))}
        </div>
      ) : error ? (
        <div className="error-card fade-up">
          <div className="error-icon">
            <Clapperboard size={22} />
          </div>

          <div className="error-body">
            <h3>Library unavailable</h3>
            <p>
              Jellyfin could not be reached. Check the server and API key, then
              retry.
            </p>
          </div>

          <button
            type="button"
            className="retry-btn"
            onClick={() => {
              setDebounced("");
              setType("");
            }}
          >
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state fade-up">
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
