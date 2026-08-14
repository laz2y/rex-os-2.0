import "./Search.css";

import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Boxes,
  Clapperboard,
  Download,
  Film,
  Home,
  Loader2,
  Search as SearchIcon,
  Tv,
  X,
} from "lucide-react";

import { globalSearch } from "../services/searchService";

const TYPE_META = {
  movie: { icon: Film, label: "Movies", color: "#eab308" },
  series: { icon: Tv, label: "TV Shows", color: "#f43f5e" },
  media: { icon: Clapperboard, label: "Media", color: "#8b5cf6" },
  download: { icon: Download, label: "Downloads", color: "#2563eb" },
  container: { icon: Boxes, label: "Docker", color: "#f97316" },
  event: { icon: Activity, label: "Activity", color: "#06b6d4" },
  page: { icon: Home, label: "REX OS", color: "#22c55e" },
};

function ResultRow({ result }) {
  const meta = TYPE_META[result.type] || TYPE_META.page;
  const Icon = meta.icon;
  const action = result.action || {};

  return (
    <div className="sr-row">
      <div className="sr-icon" style={{ background: meta.color }}>
        <Icon size={18} />
      </div>

      <div className="sr-body">
        <strong title={result.name}>{result.name}</strong>
        <span>
          {meta.label}
          {result.source ? ` · ${result.source}` : ""}
          {result.detail ? ` · ${result.detail}` : ""}
        </span>
      </div>

      <span className={`sr-status ${String(result.status || "").toLowerCase()}`}>
        {result.status || ""}
      </span>

      {action.kind === "navigate" && action.to ? (
        <Link to={action.to} className="sr-action">
          {action.label || "Open"}
          <ArrowRight size={14} />
        </Link>
      ) : action.kind === "open" && action.url ? (
        <a href={action.url} target="_blank" rel="noreferrer" className="sr-action">
          {action.label || "Open"}
          <ArrowRight size={14} />
        </a>
      ) : (
        <span className="sr-action muted">—</span>
      )}
    </div>
  );
}

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = searchParams.get("q") || "";

  const [query, setQuery] = useState(initial);
  const [debounced, setDebounced] = useState(initial);
  const [results, setResults] = useState([]);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Debounce input; keep the URL in sync so searches are shareable.
  useEffect(() => {
    const id = setTimeout(() => {
      const term = query.trim();
      setDebounced(term);
      setSearchParams(term ? { q: term } : {}, { replace: true });
    }, 350);
    return () => clearTimeout(id);
  }, [query, setSearchParams]);

  const run = useCallback(async (term) => {
    if (!term) {
      setResults([]);
      setErrors([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const data = await globalSearch(term);
      setResults(data.results || []);
      setErrors(data.errors || []);
    } catch (err) {
      console.error("[REX OS] search failed:", err);
      setResults([]);
      setErrors([{ source: "rexos", message: "The REX API could not be reached." }]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    run(debounced);
  }, [debounced, run]);

  const grouped = results.reduce((acc, result) => {
    const key = TYPE_META[result.type]?.label || "Other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(result);
    return acc;
  }, {});

  return (
    <div className="page">
      <div className="page-head fade-up">
        <h1>Search</h1>
        <p>One search across movies, TV, downloads, containers and REX OS pages</p>
      </div>

      <div className="sr-box fade-up">
        <SearchIcon size={20} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search the whole NAS…"
          aria-label="Search everything"
          autoFocus
        />
        {query && (
          <button
            type="button"
            className="sr-clear"
            onClick={() => setQuery("")}
            aria-label="Clear search"
          >
            <X size={16} />
          </button>
        )}
        {loading && <Loader2 size={18} className="spin" />}
      </div>

      {errors.length > 0 && (
        <div className="sr-errors fade-up">
          {errors.map((error) => (
            <span key={error.source}>
              {error.source}: {error.message}
            </span>
          ))}
        </div>
      )}

      {!searched ? (
        <div className="empty-state fade-up">
          <div className="empty-icon">
            <SearchIcon size={24} />
          </div>
          <h3>Search the NAS</h3>
          <p>
            Type at least a few characters — results appear as you type across
            Radarr, Sonarr, Jellyfin, qBittorrent, Docker and REX OS pages.
          </p>
        </div>
      ) : loading && results.length === 0 ? (
        <div className="sr-loading" aria-busy="true">
          <div className="skeleton sk-line" />
          <div className="skeleton sk-line" />
          <div className="skeleton sk-line" />
        </div>
      ) : results.length === 0 ? (
        <div className="empty-state fade-up">
          <div className="empty-icon">
            <SearchIcon size={24} />
          </div>
          <h3>No results for “{debounced}”</h3>
          <p>Try a shorter term or check that the source services are online.</p>
        </div>
      ) : (
        <div className="sr-groups">
          {Object.entries(grouped).map(([label, items], index) => (
            <section className="sr-group fade-up" key={label}>
              <div className="sr-group-head">
                <h2>{label}</h2>
                <span>{items.length} {items.length === 1 ? "result" : "results"}</span>
              </div>
              <div className={`sr-list d-${index + 1}`}>
                {items.map((result) => (
                  <ResultRow key={result.id} result={result} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
