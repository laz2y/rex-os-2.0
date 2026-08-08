import { useQuery } from "convex/react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Boxes,
  Clapperboard,
  Gauge,
  Network,
  Server,
  ShieldCheck,
  Smartphone,
  Terminal,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router";

import { api } from "@/convex/_generated/api";
import logo from "@/assets/logo.svg";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  REX_BUILD,
  REX_CODENAME,
  REX_VERSION,
  SERVICES,
} from "@/lib/rexos";
import { cn } from "@/lib/utils";

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 },
};

const BOOT_LINES: Array<[string, string]> = [
  ["ok", "REX OS 2.0 \"Aurora\" — console online"],
  ["ok", "jellyfin.service   · active (running) · :8096"],
  ["ok", "portainer.service  · active (running) · :9443"],
  ["ok", "sonarr / radarr / prowlarr · healthy"],
  ["info", "telemetry stream  · refresh 2s · 48 samples"],
];

function Navbar() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="group flex min-w-0 items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
          aria-label="REX OS home"
        >
          <img
            src={logo}
            alt=""
            width={30}
            height={30}
            className="shrink-0 rounded-lg transition-transform duration-300 group-hover:scale-105"
          />
          <span className="truncate text-sm font-bold tracking-tight">
            REX OS
          </span>
          <Badge
            variant="outline"
            className="hidden border-primary/30 font-mono text-[10px] text-primary sm:inline-flex"
          >
            v{REX_VERSION}
          </Badge>
        </Link>

        <nav
          aria-label="Landing"
          className="ml-auto hidden items-center gap-1 md:flex"
        >
          {[
            ["Console", "#console"],
            ["Features", "#features"],
            ["Services", "#services"],
          ].map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          {isLoading ? (
            <span className="flex size-9 items-center justify-center">
              <span className="size-4 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
            </span>
          ) : isAuthenticated ? (
            <Button asChild size="sm" className="gap-1.5">
              <Link to="/dashboard">
                Open console
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link to="/auth">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="gap-1.5">
                <Link to="/auth">
                  Launch console
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function TerminalMock() {
  const reduceMotion = useReducedMotion();
  const containers = useQuery(api.containers.list);
  const running = containers?.filter((c) => c.state === "running").length;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 24, rotateX: 6 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.6, delay: 0.25, ease: "easeOut" }}
      className="relative"
    >
      {/* glow behind the terminal */}
      <div className="absolute -inset-6 -z-10 rounded-[28px] bg-gradient-to-br from-primary/15 via-transparent to-violet-500/10 blur-2xl" />

      <div className="overflow-hidden rounded-xl border border-border/80 bg-card/90 shadow-lg backdrop-blur">
        {/* window chrome */}
        <div className="flex items-center gap-2 border-b border-border/70 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-rose-400/80" />
          <span className="size-2.5 rounded-full bg-amber-400/80" />
          <span className="size-2.5 rounded-full bg-emerald-400/80" />
          <span className="ml-2 font-mono text-[11px] text-muted-foreground">
            rex@rexos-node: ~/console
          </span>
        </div>

        {/* boot log */}
        <div className="space-y-1.5 px-4 py-4 font-mono text-[11.5px] leading-relaxed sm:text-xs">
          <motion.p
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-muted-foreground/80"
          >
            <span className="text-primary">rex@rexos-node</span>
            <span className="text-muted-foreground/60">:~$</span> systemctl
            status rex-console
          </motion.p>
          {BOOT_LINES.map(([kind, text], i) => (
            <motion.p
              key={text}
              initial={reduceMotion ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 + i * 0.28 }}
              className="flex items-start gap-2"
            >
              <span
                className={cn(
                  "mt-px shrink-0 font-mono",
                  kind === "ok" ? "text-emerald-400" : "text-primary",
                )}
              >
                {kind === "ok" ? "✓" : "▸"}
              </span>
              <span className="text-foreground/90">{text}</span>
            </motion.p>
          ))}
          <motion.p
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 + BOOT_LINES.length * 0.28 + 0.2 }}
            className="flex items-center gap-2 text-muted-foreground/80"
          >
            <span className="text-primary">▌</span>
            <span className="size-1.5 animate-pulse rounded-full bg-primary" />
            <span className="hidden sm:inline">
              streaming telemetry — press any key
            </span>
          </motion.p>
        </div>

        {/* live footer strip */}
        <div className="grid grid-cols-3 divide-x divide-border/70 border-t border-border/70 bg-muted/30">
          {[
            ["CPU", "14%"],
            ["MEM", "9.6 GB"],
            ["CTN", running === undefined ? "…" : `${running}/7`],
          ].map(([k, v]) => (
            <div key={k} className="px-3 py-2.5 text-center">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                {k}
              </p>
              <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-primary">
                {v}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* floating chip */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.4, duration: 0.5 }}
        className="absolute -bottom-4 -left-4 hidden items-center gap-2 rounded-lg border border-emerald-400/25 bg-card/90 px-3 py-2 backdrop-blur sm:flex"
      >
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
        </span>
        <span className="font-mono text-[11px] text-emerald-300">
          all systems operational
        </span>
      </motion.div>
    </motion.div>
  );
}

function Hero() {
  const reduceMotion = useReducedMotion();

  return (
    <section id="console" className="relative overflow-hidden pt-16">
      <div className="rex-grid rex-grid-fade absolute inset-0 -z-10" />
      <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:px-8 lg:pb-24 lg:pt-24">
        <motion.div
          initial={reduceMotion ? false : "hidden"}
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
        >
          <motion.div variants={fadeUp}>
            <Badge
              variant="outline"
              className="border-primary/30 bg-primary/5 px-3 py-1 font-mono text-[11px] text-primary"
            >
              <span className="relative mr-1.5 flex size-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
              </span>
              REX OS {REX_VERSION} “{REX_CODENAME}” · ONLINE
            </Badge>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
          >
            Your entire homelab,
            <br />
            <span className="bg-gradient-to-r from-primary via-sky-300 to-violet-400 bg-clip-text text-transparent">
              one console.
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            REX OS turns your NAS into a command deck — a live pulse of your
            media library, containers, services, and hardware. Jellyfin on one
            side, Portainer on the other, and every self-hosted app one tap
            away.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <LaunchButton />
            <Button asChild variant="outline" size="lg">
              <a href="#features">
                Explore features
                <ArrowRight className="size-4" />
              </a>
            </Button>
          </motion.div>

          <motion.div
            variants={fadeUp}
            className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground"
          >
            {[
              { icon: ShieldCheck, label: "Email OTP + guest access" },
              { icon: Smartphone, label: "Works on any screen" },
              { icon: Activity, label: "2s live telemetry" },
            ].map(({ icon: Icon, label }) => (
              <span key={label} className="flex items-center gap-1.5">
                <Icon className="size-3.5 text-primary/80" />
                {label}
              </span>
            ))}
          </motion.div>
        </motion.div>

        <TerminalMock />
      </div>
    </section>
  );
}

function LaunchButton() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <Button size="lg" disabled>
        <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
        Booting…
      </Button>
    );
  }
  return (
    <Button asChild size="lg" className="gap-2">
      <Link to={isAuthenticated ? "/dashboard" : "/auth"}>
        <Terminal className="size-4" />
        {isAuthenticated ? "Open console" : "Launch console"}
        <ArrowRight className="size-4" />
      </Link>
    </Button>
  );
}

function StatsBand() {
  const mediaStats = useQuery(api.media.stats);
  const containers = useQuery(api.containers.list);
  const running =
    containers === undefined
      ? undefined
      : containers.filter((c) => c.state === "running").length;

  const stats: Array<[string, string, string]> = [
    ["Services online", `${SERVICES.filter((s) => s.status === "online").length}/${SERVICES.length}`, "Wifi"],
    ["Uptime", "31d 4h", "Server"],
    ["Library titles", mediaStats === undefined ? "…" : String(mediaStats.total), "Clapperboard"],
    ["Containers running", running === undefined ? "…" : `${running}/${containers?.length ?? 0}`, "Boxes"],
  ];

  return (
    <section className="border-y border-border/60 bg-card/40">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-px overflow-hidden px-4 py-8 sm:px-6 lg:grid-cols-4 lg:px-8">
        {stats.map(([label, value, iconName], i) => {
          const Icon =
            iconName === "Wifi"
              ? Wifi
              : iconName === "Server"
                ? Server
                : iconName === "Clapperboard"
                  ? Clapperboard
                  : Boxes;
          return (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className="flex flex-col items-center gap-1.5 px-4 py-2 text-center"
            >
              <Icon className="size-4 text-primary/70" />
              <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight">
                {value}
              </p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

const FEATURES: Array<{
  icon: LucideIcon;
  title: string;
  copy: string;
}> = [
  {
    icon: Clapperboard,
    title: "Jellyfin library",
    copy: "Recently added, searchable media, and continue-watching progress — surfaced straight from your Jellyfin server without leaving the console.",
  },
  {
    icon: Boxes,
    title: "Container overview",
    copy: "A read-only Docker health feed: running state, CPU, and memory per container. Full management stays in Portainer where it belongs.",
  },
  {
    icon: Gauge,
    title: "Live telemetry",
    copy: "CPU load, memory, storage, and network throughput sampled every two seconds, with sparklines and 96-second history charts.",
  },
  {
    icon: Network,
    title: "One-tap launcher",
    copy: "Every self-hosted app — Jellyfin, Sonarr, Radarr, qBittorrent, and friends — reachable from a single launcher strip.",
  },
  {
    icon: ShieldCheck,
    title: "Private by default",
    copy: "Email OTP or instant guest access. No third-party accounts required to run your own server's control surface.",
  },
  {
    icon: Smartphone,
    title: "Any screen",
    copy: "A responsive console that goes from a collapsible sidebar on desktop to a thumb-friendly bottom nav on your phone.",
  },
];

function Features() {
  const reduceMotion = useReducedMotion();

  return (
    <section id="features" className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl"
      >
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
          // console.features
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Everything your NAS does,
          <br className="hidden sm:block" /> in one clean interface.
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          REX OS 2.0 is a polished command deck for your homelab — fast,
          consistent, and tuned to the way you actually run things.
        </p>
      </motion.div>

      <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature, i) => (
          <motion.div
            key={feature.title}
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4, delay: (i % 3) * 0.07 }}
            className="group rounded-xl border border-border/70 bg-card p-5 transition-colors duration-300 hover:border-primary/40"
          >
            <div className="flex size-10 items-center justify-center rounded-lg border border-border/70 bg-muted/60 text-primary transition-colors duration-300 group-hover:border-primary/40">
              <feature.icon className="size-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold tracking-tight">
              {feature.title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {feature.copy}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function ServicesSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section id="services" className="border-t border-border/60 bg-card/30">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl"
        >
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
            // console.services
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Your self-hosted stack, one launcher away.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            REX OS is a read-only launcher — management stays in each app.
          </p>
        </motion.div>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {SERVICES.map((service, i) => (
            <motion.a
              key={service.id}
              href={service.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={reduceMotion ? false : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ duration: 0.35, delay: i * 0.04 }}
              className="group flex flex-col items-start gap-2.5 rounded-xl border border-border/70 bg-card p-3.5 transition-colors duration-300 hover:border-primary/40"
            >
              <span
                className="flex size-9 items-center justify-center rounded-lg border border-border/60 bg-background transition-transform duration-300 group-hover:scale-105"
                style={{ color: service.color }}
              >
                <service.icon className="size-4.5" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium">
                    {service.name}
                  </span>
                </span>
                <span className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                  <span className="size-1 rounded-full bg-emerald-400" />
                  :{service.port}
                </span>
              </span>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaBand() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
        className="rex-grid relative overflow-hidden rounded-2xl border border-primary/25 bg-card px-6 py-14 text-center sm:px-12 lg:py-20"
      >
        <div className="rex-grid-fade absolute inset-0" />
        <div className="absolute -top-24 left-1/2 -z-0 h-48 w-[36rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative">
          <img
            src={logo}
            alt=""
            width={52}
            height={52}
            className="mx-auto rounded-xl"
          />
          <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to boot your console?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Sign in with your email or jump straight in as a guest. Your
            server is already waiting.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <LaunchButton />
            <Button asChild variant="outline" size="lg">
              <Link to="/auth">Create an account</Link>
            </Button>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/60 bg-card/40">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="" width={22} height={22} className="rounded" />
          <span className="text-sm font-semibold tracking-tight">REX OS</span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {REX_BUILD}
          </span>
        </div>
        <div className="flex items-center gap-5 text-xs text-muted-foreground">
          <Link to="/auth" className="transition-colors hover:text-foreground">
            Sign in
          </Link>
          <a href="#features" className="transition-colors hover:text-foreground">
            Features
          </a>
          <a href="#services" className="transition-colors hover:text-foreground">
            Services
          </a>
          <span className="hidden sm:inline">© 2026 REX OS</span>
        </div>
      </div>
    </footer>
  );
}

export default function Landing() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <StatsBand />
        <Features />
        <ServicesSection />
        <CtaBand />
      </main>
      <Footer />
    </div>
  );
}
