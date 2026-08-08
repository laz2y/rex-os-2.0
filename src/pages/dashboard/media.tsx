import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { Clapperboard, Film, Search, Tv, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MediaDialog,
  MediaTile,
  type MediaItem,
} from "@/components/dashboard/media-tile";
import {
  PosterSkeleton,
  WidgetBoundary,
} from "@/components/dashboard/widget-shell";

type Filter = "all" | "movie" | "series";

function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function MediaPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const debouncedQuery = useDebounced(query);

  const args = useMemo(
    () => ({
      type: (filter === "all" ? undefined : filter) as
        | "movie"
        | "series"
        | undefined,
      query: debouncedQuery.trim() || undefined,
      limit: 200,
    }),
    [filter, debouncedQuery],
  );

  const items = useQuery(api.media.list, args);
  const stats = useQuery(api.media.stats);

  const hasQuery = debouncedQuery.trim().length > 0;

  return (
    <div className="space-y-5">
      {/* Header + controls */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Media Library
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats === undefined
              ? "Syncing with Jellyfin…"
              : `${stats.total} titles · ${stats.movies} movies · ${stats.series} series`}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative sm:w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search titles or genres…"
              className="h-9 pl-9 pr-8"
              aria-label="Search media library"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsList className="h-9 w-full sm:w-auto">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="movie">
                <Film className="size-3.5" />
                Movies
              </TabsTrigger>
              <TabsTrigger value="series">
                <Tv className="size-3.5" />
                Series
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Grid */}
      <WidgetBoundary title="Media library unavailable">
        {items === undefined ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <PosterSkeleton key={i} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Empty className="py-16">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  {hasQuery ? <Search /> : <Clapperboard />}
                </EmptyMedia>
                <EmptyTitle>
                  {hasQuery ? `No results for "${debouncedQuery.trim()}"` : "Nothing here yet"}
                </EmptyTitle>
                <EmptyDescription>
                  {hasQuery
                    ? "Try a different title or genre."
                    : "Your Jellyfin libraries haven't synced any titles. Scan your libraries to populate this view."}
                </EmptyDescription>
              </EmptyHeader>
              {hasQuery && (
                <EmptyContent>
                  <Button variant="outline" size="sm" onClick={() => setQuery("")}>
                    Clear search
                  </Button>
                </EmptyContent>
              )}
            </Empty>
          </motion.div>
        ) : (
          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.03 } },
            }}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
          >
            {items.map((item) => (
              <motion.div
                key={item._id}
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  show: { opacity: 1, y: 0 },
                }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <MediaTile item={item} onSelect={setSelected} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </WidgetBoundary>

      <MediaDialog
        item={selected}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />

      {items && items.length > 0 && (
        <p className="text-center text-xs text-muted-foreground/70">
          Showing {items.length} title{items.length === 1 ? "" : "s"}
          {hasQuery && ` matching "${debouncedQuery.trim()}"`}
          {filter !== "all" && ` in ${filter === "movie" ? "movies" : "series"}`}
        </p>
      )}
    </div>
  );
}
