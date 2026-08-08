import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  Server,
  Thermometer,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { WidgetBoundary, WidgetCard } from "@/components/dashboard/widget-shell";
import { useSystemStats } from "@/hooks/use-system-stats";
import { formatGigabytes, formatUptime } from "@/lib/rexos";

function Gauge({
  value,
  label,
  sub,
  color,
}: {
  value: number;
  label: string;
  sub: string;
  color: string;
}) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <svg width="120" height="120" viewBox="0 0 100 100" aria-hidden="true">
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="var(--muted)"
            strokeWidth="7"
          />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - clamped / 100)}
            className="transition-all duration-700 ease-out"
            transform="rotate(-90 50 50)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-xl font-semibold tabular-nums">
            {clamped.toFixed(0)}
            <span className="text-xs text-muted-foreground">%</span>
          </span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  color,
  dataKey,
  data,
  label,
}: {
  title: string;
  subtitle: string;
  color: string;
  dataKey: string;
  data: { i: number; value: number }[];
  label: string;
}) {
  return (
    <WidgetCard
      icon={Activity}
      title={title}
      description={subtitle}
      contentClassName="pt-2"
    >
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id={`fill-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="i" hide />
            <YAxis domain={[0, 100]} hide />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md">
                    <span className="font-mono tabular-nums text-foreground">
                      {label}: {Number(payload[0]?.value).toFixed(1)}%
                    </span>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#fill-${dataKey})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </WidgetCard>
  );
}

export default function SystemPage() {
  const { stats } = useSystemStats();
  const reduceMotion = useReducedMotion();

  const chartData = stats.cpu.history.map((v, i) => ({ i, value: v }));
  const memChartData = stats.memory.history.map((v, i) => ({ i, value: v }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          System Monitor
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Live telemetry for {stats.host.hostname}</span>
          <Badge variant="outline" className="border-border/70 font-mono text-[10px] text-muted-foreground">
            {stats.host.ip}
          </Badge>
          <Badge variant="outline" className="border-border/70 font-mono text-[10px] text-muted-foreground">
            up {formatUptime(stats.uptimeSec)}
          </Badge>
        </p>
      </div>

      <WidgetBoundary title="Telemetry unavailable">
        {/* Gauges */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <WidgetCard title="CPU" description={`${stats.host.cores} cores`} contentClassName="py-6">
            <Gauge
              value={stats.cpu.usage}
              label="Load"
              sub={`${Math.round(stats.cpu.tempC)}°C core temp`}
              color="var(--chart-1)"
            />
          </WidgetCard>
          <WidgetCard title="Memory" description={`${stats.host.ramGb} GB installed`} contentClassName="py-6">
            <Gauge
              value={stats.memory.percent}
              label="In use"
              sub={`${stats.memory.usedGb.toFixed(1)} / ${stats.memory.totalGb} GB`}
              color="var(--chart-2)"
            />
          </WidgetCard>
          <WidgetCard title="Storage" description="All volumes" contentClassName="py-6">
            <Gauge
              value={stats.storage.percent}
              label="Capacity"
              sub={`${stats.storage.usedTb.toFixed(1)} / ${stats.storage.totalTb.toFixed(1)} TB`}
              color="var(--chart-3)"
            />
          </WidgetCard>
          <WidgetCard title="Network" description="Real-time throughput" contentClassName="py-5">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/40 px-3 py-2">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-chart-4" />
                  Download
                </span>
                <span className="font-mono text-sm font-semibold tabular-nums">
                  {stats.network.rxMbps.toFixed(1)} Mbps
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/40 px-3 py-2">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-chart-2" />
                  Upload
                </span>
                <span className="font-mono text-sm font-semibold tabular-nums">
                  {stats.network.txMbps.toFixed(1)} Mbps
                </span>
              </div>
              <p className="text-center text-[10px] uppercase tracking-wider text-muted-foreground/70">
                Live · refresh 2s
              </p>
            </div>
          </WidgetCard>
        </div>

        {/* History charts */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <ChartCard
            title="CPU Load"
            subtitle="Last 96 seconds"
            color="var(--chart-1)"
            dataKey="cpu"
            data={chartData}
            label="CPU"
          />
          <ChartCard
            title="Memory"
            subtitle="Last 96 seconds"
            color="var(--chart-2)"
            dataKey="mem"
            data={memChartData}
            label="Memory"
          />
        </div>

        {/* Storage + host */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <WidgetCard
            icon={HardDrive}
            title="Storage"
            description={`${stats.storage.percent.toFixed(1)}% of ${stats.storage.totalTb.toFixed(1)} TB used`}
            contentClassName="flex flex-col gap-3"
          >
            <motion.ul
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              {stats.storage.volumes.map((volume) => {
                const pct = (volume.usedGb / volume.totalGb) * 100;
                return (
                  <li key={volume.mount}>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-medium">{volume.name}</p>
                      <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
                        {formatGigabytes(volume.usedGb)} /{" "}
                        {formatGigabytes(volume.totalGb)} · {pct.toFixed(0)}%
                      </p>
                    </div>
                    <p className="mb-1.5 font-mono text-[10px] text-muted-foreground/70">
                      {volume.mount}
                    </p>
                    <Progress
                      value={pct}
                      className="h-1.5 bg-border/60"
                    />
                  </li>
                );
              })}
            </motion.ul>
          </WidgetCard>

          <WidgetCard
            icon={Server}
            title="System"
            description="Hardware & host information"
            contentClassName="pt-1"
          >
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              {[
                ["Hostname", stats.host.hostname],
                ["Model", stats.host.model],
                ["OS", stats.host.os],
                ["Kernel", stats.host.kernel],
                ["CPU", `${stats.host.cores} cores`],
                ["Memory", `${stats.host.ramGb} GB`],
                ["Uptime", formatUptime(stats.uptimeSec)],
                ["Local IP", stats.host.ip],
              ].map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                    {k}
                  </dt>
                  <dd className="mt-0.5 truncate font-mono text-xs text-foreground">
                    {v}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">
                <Cpu className="size-3.5 text-chart-1" />
                CPU {Math.round(stats.cpu.tempC)}°C
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">
                <Thermometer className="size-3.5 text-chart-4" />
                SSD 41°C
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">
                <MemoryStick className="size-3.5 text-chart-2" />
                {stats.memory.usedGb.toFixed(1)} GB active
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">
                <Network className="size-3.5 text-chart-3" />
                ↓{stats.network.rxMbps.toFixed(1)} ↑{stats.network.txMbps.toFixed(1)} Mbps
              </span>
            </div>
          </WidgetCard>
        </div>
      </WidgetBoundary>
    </div>
  );
}
