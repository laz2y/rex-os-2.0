import { formatDistanceToNow } from "date-fns";
import { Clock3, ExternalLink, Play, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { posterGlow, posterGradient } from "@/lib/poster";
import { cn } from "@/lib/utils";
import type { Doc } from "@/convex/_generated/dataModel";

export type MediaItem = Doc<"mediaItems">;

const NEW_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

// Evaluated once at module load (not during render) so the "NEW" badge stays
// render-pure; freshness only needs to be roughly right per session.
const SESSION_NOW = Date.now();

export function MediaTile({
  item,
  onSelect,
  className,
}: {
  item: MediaItem;
  onSelect?: (item: MediaItem) => void;
  className?: string;
}) {
  const isNew = SESSION_NOW - item.addedAt < NEW_WINDOW_MS;
  const watched = item.progress >= 1;
  const inProgress = item.progress > 0 && item.progress < 1;

  return (
    <button
      type="button"
      onClick={() => onSelect?.(item)}
      aria-label={`${item.title} (${item.year}), ${item.type}`}
      className={cn(
        "group block w-full rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <div
        className="relative aspect-[2/3] overflow-hidden rounded-lg border border-border/70 shadow-sm transition-transform duration-300 group-hover:-translate-y-1 group-focus-visible:-translate-y-1"
        style={{ background: posterGradient(item.hue) }}
      >
        <div
          className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: posterGlow(item.hue) }}
        />
        {/* decorative circuit rings */}
        <div className="absolute -right-8 -top-8 size-28 rounded-full border border-white/10" />
        <div className="absolute -right-3 -top-3 size-14 rounded-full border border-white/10" />
        <div className="absolute -bottom-10 -left-10 size-24 rounded-full border border-white/10" />

        <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-1.5">
          {isNew ? (
            <Badge className="bg-black/45 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-primary backdrop-blur-sm">
              NEW
            </Badge>
          ) : (
            <span />
          )}
          <span className="flex items-center gap-1 rounded-full bg-black/40 px-1.5 py-0.5 text-[11px] font-medium text-amber-300 backdrop-blur-sm">
            <Star className="size-3 fill-amber-300 text-amber-300" />
            {item.rating.toFixed(1)}
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2.5 pb-2.5 pt-10">
          <p className="truncate text-[13px] font-semibold leading-tight text-white">
            {item.title}
          </p>
          <p className="mt-0.5 text-[11px] text-white/60">
            {item.year} · {item.type === "movie" ? "Movie" : "Series"}
          </p>
        </div>

        {inProgress && (
          <div className="absolute inset-x-0 bottom-0">
            <Progress
              value={item.progress * 100}
              className="h-[3px] rounded-none border-0 bg-white/20"
            />
          </div>
        )}
        {watched && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div className="flex size-10 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm">
              <Play className="size-4 fill-white text-white" />
            </div>
          </div>
        )}
      </div>
    </button>
  );
}

export function MediaDialog({
  item,
  open,
  onOpenChange,
}: {
  item: MediaItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="max-w-2xl gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
        {item && (
          <>
            <div
              className="relative h-44 shrink-0 sm:h-52"
              style={{ background: posterGradient(item.hue) }}
            >
              <div
                className="absolute inset-0"
                style={{ background: posterGlow(item.hue) }}
              />
              <div className="absolute -right-10 -top-10 size-36 rounded-full border border-white/10" />
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute inset-x-5 top-4 flex items-center justify-between">
                <Badge className="bg-black/45 text-primary backdrop-blur-sm">
                  {item.type === "movie" ? "Movie" : "Series"}
                </Badge>
                <span className="flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-xs font-medium text-amber-300 backdrop-blur-sm">
                  <Star className="size-3.5 fill-amber-300 text-amber-300" />
                  {item.rating.toFixed(1)} / 10
                </span>
              </div>
            </div>

            <div className="space-y-4 p-5 sm:p-6">
              <div>
                <DialogTitle className="text-2xl font-bold tracking-tight">
                  {item.title}
                </DialogTitle>
                <DialogDescription className="mt-1.5 text-sm">
                  {item.year} · {item.type === "movie" ? "Movie" : "Series"} ·{" "}
                  {Math.floor(item.runtime / 60)}h{" "}
                  {item.runtime % 60 === 0 ? "" : `${item.runtime % 60}m`}
                </DialogDescription>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {item.genres.map((genre) => (
                  <Badge key={genre} variant="secondary">
                    {genre}
                  </Badge>
                ))}
              </div>

              <p className="text-sm leading-relaxed text-muted-foreground">
                {item.overview}
              </p>

              {item.progress > 0 && item.progress < 1 && (
                <div className="space-y-1.5 rounded-lg border border-border/70 bg-muted/40 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Play className="size-3.5 text-primary" />
                      Continue watching
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {Math.round(item.progress * 100)}%
                    </span>
                  </div>
                  <Progress value={item.progress * 100} />
                </div>
              )}

              <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock3 className="size-3.5" />
                  Added{" "}
                  {formatDistanceToNow(item.addedAt, { addSuffix: true })}
                </p>
                <Button asChild className="gap-2">
                  <a
                    href={`http://rexos.local:8096/web`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="size-4" />
                    Open in Jellyfin
                  </a>
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
