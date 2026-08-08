import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Standardized dashboard widget card: consistent padding, title row with
 * optional icon + action, and a body region.
 */
export function WidgetCard({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
  contentClassName,
  id,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  id?: string;
}) {
  return (
    <Card
      id={id}
      className={cn(
        "min-w-0 overflow-hidden gap-0 py-0 shadow-sm",
        className,
      )}
    >
      {(title || action) && (
        <CardHeader
          className={cn(
            "flex-row items-center justify-between gap-3 border-b border-border/60 px-4 py-3.5 sm:px-5",
            Icon ? "has-data-[slot=card-action]:grid-cols-[auto_1fr_auto]" : "",
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            {Icon && (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/60 text-primary">
                <Icon className="size-4" />
              </div>
            )}
            <div className="min-w-0">
              {title && (
                <h2 className="truncate text-sm font-semibold tracking-tight">
                  {title}
                </h2>
              )}
              {description && (
                <p className="truncate text-xs text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </CardHeader>
      )}
      <CardContent
        className={cn("px-4 py-4 sm:px-5 sm:py-5", contentClassName)}
      >
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * Clean per-widget error state: explains which widget failed, keeps the rest
 * of the console usable, and offers a retry action.
 */
export function WidgetError({
  title = "Widget unavailable",
  message = "This component hit an unexpected error. The rest of the console is still running.",
  onRetry,
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed border-destructive/40 bg-destructive/5 px-4 py-10 text-center",
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-5" />
      </div>
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {message}
        </p>
      </div>
      {onRetry && (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="size-3.5" />
          Retry
        </Button>
      )}
    </div>
  );
}

/**
 * Error boundary scoped to a single widget: a data failure inside one widget
 * renders its own error card (with retry) instead of crashing the console.
 */
export class WidgetBoundary extends React.Component<
  {
    children: React.ReactNode;
    title?: string;
    message?: string;
  },
  { hasError: boolean; error: Error | null; attempt: number }
> {
  state = { hasError: false, error: null as Error | null, attempt: 0 };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error("[REX OS] widget crashed:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <WidgetError
          title={this.props.title}
          message={
            this.props.message ??
            this.state.error?.message ??
            "This widget hit an unexpected error."
          }
          onRetry={() =>
            this.setState((s) => ({
              hasError: false,
              error: null,
              attempt: s.attempt + 1,
            }))
          }
        />
      );
    }
    return (
      <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>
    );
  }
}

// ---------- skeleton loaders ----------

export function StatSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <Skeleton className="size-8 rounded-lg" />
        <Skeleton className="h-4 w-12 rounded-full" />
      </div>
      <Skeleton className="mt-4 h-8 w-24" />
      <Skeleton className="mt-2 h-3 w-32" />
      <Skeleton className="mt-4 h-10 w-full" />
    </div>
  );
}

export function PosterSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      <Skeleton className="aspect-[2/3] w-full rounded-lg" />
      <Skeleton className="h-3.5 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

export function RowSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-8 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-2/5" />
          </div>
          <Skeleton className="h-3.5 w-14 shrink-0" />
        </div>
      ))}
    </div>
  );
}
