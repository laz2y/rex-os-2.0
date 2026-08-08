import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Boxes,
  Clapperboard,
  Cpu,
  ExternalLink,
  HardDrive,
  MemoryStick,
  Network,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import {
  MediaDialog,
  MediaTile,
  type MediaItem,
} from "@/components/dashboard/media-tile";
import { Sparkline } from "@/components/dashboard/sparkline";
import {
  PosterSkeleton,
  RowSkeleton,
  StatSkeleton,
  WidgetBoundary,
  WidgetCard,
} from "@/components/dashboard/widget-shell";
import { useAuth } from "@/hooks/use-auth";
import { useClock } from "@/hooks/use-clock";
import { useSystemStats } from "@/hooks/use-system-stats";
import { SERVICES, getService, greetingForHour } from "@/lib/rexos";
import { cn } from "@/lib/utils";

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = "text-primary",
  chart,
  children,
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
  sub: string;
  accent?: string;
  chart?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="group rounded-xl border border-border/70 bg-card p-4 shadow-sm transition-colors hover:border-border sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className={cn("flex size-8 items-center justify-center rounded-lg border border-border/70 bg-muted/60", accent)}>
          <Icon className="size-4" />
        </div>
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
          {label}
        </span>
      </div>
      <p className="mt-3 font-mono text-2xl font-semibold tabular-nums tracking-tight">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
      {chart && <div className="mt-3">{chart}</div>}
      {children}
    </div>
  );
}

function RecentlyAdded() {
  const recent = useQuery(api.media.recent, { limit: 6 });
  const ensureSeed = useMutation(api.seed.ensureSeedData);
  const [selected, setSelected] = useState<MediaItem | null>(null);

  return (
    <WidgetCard
      className="h-full"
      icon={Clapperboard}
      title="Recently Added"
      description="Latest from your Jellyfin library"
      action={
        <Button asChild variant="ghost" size="sm" className="text-primary hover:text-primary/90">
          <Link to="/dashboard/media">
            View library
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      }
      contentClassName="flex flex-col"
    >
      <WidgetBoundary title="Media library unavailable">
        {recent === undefined ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <PosterSkeleton key={i} />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <Empty className="flex-1 gap-4 py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Clapperboard />
              </EmptyMedia>
              <EmptyTitle>No media synced yet</EmptyTitle>
              <EmptyDescription>
                Connect Jellyfin and scan your libraries, or seed the demo
                catalog to preview REX OS.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex-row gap-2">
              <Button
                size="sm"
                onClick={() => ensureSeed().catch(() => undefined)}
              >
                <RefreshCw className="size-3.5" />
                Seed demo catalog
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {recent.map((item) => (
              <MediaTile
                key={item._id}
                item={item}
                onSelect={setSelected}
              />
            ))}
          </div>
        )}
      </WidgetBoundary>

      <MediaDialog
        item={selected}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </WidgetCard>
  );
}

function DockerOverview() {
  const containers = useQuery(api.containers.list);
  const portainer = getService("portainer");
  const running = containers?.filter((c) => c.state === "running").length ?? 0;

  return (
    <WidgetCard
      className="h-full"
      icon={Boxes}
      title="Containers"
      description="Docker overview · managed via Portainer"
      action={
        portainer && (
          <Button asChild variant="ghost" size="sm" className="text-primary hover:text-primary/90">
            <a href={portainer.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" />
              Portainer
            </a>
          </Button>
        )
      }
      contentClassName="flex flex-col"
    >
      <WidgetBoundary title="Container data unavailable">
        {containers === undefined ? (
          <RowSkeleton rows={4} />
        ) : containers.length === 0 ? (
          <Empty className="flex-1 gap-4 py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Boxes />
              </EmptyMedia>
              <EmptyTitle>No containers detected</EmptyTitle>
              <EmptyDescription>
                Deploy containers with Docker or Portainer and REX OS will
                surface them here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-border/70 bg-muted/40 p-2.5 text-center">
                <p className="font-mono text-xl font-semibold tabular-nums">
                  {running}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Running
                </p>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/40 p-2.5 text-center">
                <p className="font-mono text-xl font-semibold tabular-nums">
                  {containers.length}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Total
                </p>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/40 p-2.5 text-center">
                <p className="font-mono text-xl font-semibold tabular-nums">
                  {containers
                    .reduce((a, c) => a + c.memMb, 0) >= 1024
                    ? `${(containers.reduce((a, c) => a + c.memMb, 0) / 1024).toFixed(1)}G`
                    : `${containers.reduce((a, c) => a + c.memMb, 0)}M`}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Memory
                </p>
              </div>
            </div>

            <ul className="space-y-2.5">
              {containers.slice(0, 5).map((c) => {
                const service = getService(c.serviceId);
                return (
                  <li key={c._id} className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        c.state === "running"
                          ? "bg-emerald-400"
                          : c.state === "paused"
                            ? "bg-amber-400"
                            : "bg-muted-foreground/40",
                      )}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate font-mono text-xs font-medium">
                          {c.name}
                        </p>
                        <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                          {c.cpu.toFixed(1)}% CPU
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <Progress
                          value={Math.min(100, (c.memMb / 1024) * 8)}
                          className="h-1 bg-border/60"
                        />
                        <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                          {c.memMb >= 1024
                            ? `${(c.memMb / 1024).toFixed(1)}G`
                            : `${c.memMb}M`}
                        </span>
                      </div>
                    </div>
                    {service && (
                      <Badge
                        variant="outline"
                        className="hidden shrink-0 border-border/70 text-[10px] text-muted-foreground sm:inline-flex"
                      >
                        {service.name}
                      </Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </WidgetBoundary>
    </WidgetCard>
  );
}

function ServicesStrip() {
  return (
    <WidgetCard
      icon={Network}
      title="Services"
      description="Quick launch · management stays in each app"
      action={
        <Button asChild variant="ghost" size="sm" className="text-primary hover:text-primary/90">
          <Link to="/dashboard/services">
            All services
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
        {SERVICES.map((s) => (
          <a
            key={s.id}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2.5 rounded-lg border border-border/70 bg-muted/30 p-2.5 transition-colors hover:border-primary/40 hover:bg-muted/60"
          >
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background"
              style={{ color: s.color }}
            >
              <s.icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-xs font-medium">{s.name}</span>
                <span className="size-1.5 shrink-0 rounded-full bg-emerald-400" />
              </span>
              <span className="block truncate font-mono text-[10px] text-muted-foreground">
                :{s.port}
              </span>
            </span>
          </a>
        ))}
      </div>
    </WidgetCard>
  );
}

export default function OverviewPage() {
  const { user } = useAuth();
  const { now, date } = useClock();
  const { stats, phase } = useSystemStats();

  const firstName =
    user?.name?.split(" ")[0] ?? (user?.isAnonymous ? "Guest" : undefined);
  const greeting = greetingForHour(now.getHours());

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-primary">
            {greeting}
            {firstName ? `, ${firstName}` : ""}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Your server at a glance
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {date} · rexos-node is healthy · 7 services online
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a
              href={SERVICES.find((s) => s.id === "jellyfin")?.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Clapperboard className="size-3.5" />
              Open Jellyfin
            </a>
          </Button>
        </div>
      </div>

      {/* Live stat cards */}
      {phase === "loading" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatSkeleton key={i} />
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          <StatCard
            icon={Cpu}
            label="CPU"
            value={`${Math.round(stats.cpu.usage)}%`}
            sub={`${stats.host.cores} cores · ${Math.round(stats.cpu.tempC)}°C`}
            chart={
              <Sparkline
                data={stats.cpu.history}
                color="var(--chart-1)"
                className="h-10"
              />
            }
          />
          <StatCard
            icon={MemoryStick}
            label="Memory"
            value={`${stats.memory.usedGb.toFixed(1)} GB`}
            sub={`of ${stats.memory.totalGb} GB · ${Math.round(stats.memory.percent)}% used`}
            accent="text-chart-2"
            chart={
              <Sparkline
                data={stats.memory.history}
                color="var(--chart-2)"
                className="h-10"
              />
            }
          />
          <StatCard
            icon={HardDrive}
            label="Storage"
            value={`${stats.storage.usedTb.toFixed(1)} TB`}
            sub={`of ${stats.storage.totalTb.toFixed(1)} TB · ${stats.storage.percent.toFixed(0)}% capacity`}
            accent="text-chart-3"
          >
            <Progress
              value={stats.storage.percent}
              className="mt-3 h-1.5 bg-border/60"
            />
          </StatCard>
          <StatCard
            icon={Network}
            label="Network"
            value={`↓ ${stats.network.rxMbps.toFixed(1)}`}
            sub={`↑ ${stats.network.txMbps.toFixed(1)} Mbps`}
            accent="text-chart-4"
            chart={
              <Sparkline
                data={stats.network.rxHistory}
                color="var(--chart-4)"
                className="h-10"
              />
            }
          />
        </motion.div>
      )}

      {/* Widgets row */}
      <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentlyAdded />
        </div>
        <DockerOverview />
      </div>

      <ServicesStrip />
    </div>
  );
}
