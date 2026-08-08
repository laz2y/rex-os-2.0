import {
  Blocks,
  Boxes,
  Clapperboard,
  Cpu,
  Download,
  Film,
  LayoutDashboard,
  Package,
  Radar,
  Tv,
  type LucideIcon,
} from "lucide-react";

export const REX_VERSION = "2.0.0";
export const REX_CODENAME = "Aurora";
export const REX_BUILD = `REX OS ${REX_VERSION} "${REX_CODENAME}"`;

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/dashboard/media", label: "Media", icon: Clapperboard },
  { to: "/dashboard/system", label: "System", icon: Cpu },
  { to: "/dashboard/services", label: "Services", icon: Blocks },
];

export type ServiceDef = {
  id: string;
  name: string;
  description: string;
  url: string;
  port: string;
  icon: LucideIcon;
  color: string;
  version: string;
  status: "online" | "offline";
};

/**
 * Self-hosted app catalog. `url` is where each service is reachable on the
 * LAN — edit these to point at your real endpoints. REX OS stays a
 * read-only launcher/overview; management lives in each app.
 */
export const SERVICES: ServiceDef[] = [
  {
    id: "jellyfin",
    name: "Jellyfin",
    description: "Media server & library",
    url: "http://rexos.local:8096",
    port: "8096",
    icon: Clapperboard,
    color: "#38bdf8",
    version: "10.9.11",
    status: "online",
  },
  {
    id: "portainer",
    name: "Portainer",
    description: "Container management",
    url: "https://rexos.local:9443",
    port: "9443",
    icon: Boxes,
    color: "#2dd4bf",
    version: "2.21.5",
    status: "online",
  },
  {
    id: "sonarr",
    name: "Sonarr",
    description: "TV series manager",
    url: "http://rexos.local:8989",
    port: "8989",
    icon: Tv,
    color: "#34d399",
    version: "4.0.14",
    status: "online",
  },
  {
    id: "radarr",
    name: "Radarr",
    description: "Movie manager",
    url: "http://rexos.local:7878",
    port: "7878",
    icon: Film,
    color: "#fbbf24",
    version: "5.22.4",
    status: "online",
  },
  {
    id: "prowlarr",
    name: "Prowlarr",
    description: "Indexer manager",
    url: "http://rexos.local:9696",
    port: "9696",
    icon: Radar,
    color: "#f472b6",
    version: "1.42.0",
    status: "online",
  },
  {
    id: "qbittorrent",
    name: "qBittorrent",
    description: "Torrent client",
    url: "http://rexos.local:8080",
    port: "8080",
    icon: Download,
    color: "#60a5fa",
    version: "5.1.4",
    status: "online",
  },
  {
    id: "sabnzbd",
    name: "SABnzbd",
    description: "Usenet downloader",
    url: "http://rexos.local:8081",
    port: "8081",
    icon: Package,
    color: "#fb923c",
    version: "4.5.1",
    status: "online",
  },
];

export function getService(id: string | undefined) {
  return SERVICES.find((s) => s.id === id);
}

// ---------- formatting helpers ----------

export function formatGigabytes(gb: number): string {
  if (gb >= 1024) {
    return `${(gb / 1024).toFixed(1)} TB`;
  }
  return `${Math.round(gb)} GB`;
}

export function formatMegabytes(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  return `${Math.round(mb)} MB`;
}

export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatMbps(mbps: number): string {
  if (mbps >= 1000) return `${(mbps / 1000).toFixed(1)} Gbps`;
  if (mbps >= 10) return `${Math.round(mbps)} Mbps`;
  return `${mbps.toFixed(1)} Mbps`;
}

export function greetingForHour(hour: number): string {
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
