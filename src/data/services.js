import {
  Clapperboard,
  Cloud,
  Camera,
  Boxes,
  Download,
  Shield,
  Tv,
  Film,
  Search,
  Sailboat,
  Zap,
} from "lucide-react";

export const services = [
  {
    id: "jellyfin",
    name: "Jellyfin",
    description: "Movies & TV",
    icon: Clapperboard,
    color: "#8b5cf6",
    url: "https://jellyfin.laz2ynas.cc",
    category: "media",
  },

  {
    id: "nextcloud",
    name: "Nextcloud",
    description: "Cloud Storage",
    icon: Cloud,
    color: "#0ea5e9",
    url: "https://cloud.laz2ynas.cc",
    category: "cloud",
  },

  {
    id: "immich",
    name: "Immich",
    description: "Photos",
    icon: Camera,
    color: "#22c55e",
    url: "https://immich.laz2ynas.cc",
    category: "photos",
  },

  {
    id: "docker",
    name: "Portainer",
    description: "Containers",
    icon: Boxes,
    color: "#f97316",
    url: "https://portainer.laz2ynas.cc",
    category: "system",
  },

  {
    id: "qbittorrent",
    name: "qBittorrent",
    description: "Downloads",
    icon: Download,
    color: "#2563eb",
    url: "https://qb.laz2ynas.cc",
    category: "downloads",
  },

  {
    id: "homepage",
    name: "Homepage",
    description: "Dashboard",
    icon: Shield,
    color: "#14b8a6",
    url: "https://homepage.laz2ynas.cc",
    category: "system",
  },

  {
    id: "sonarr",
    name: "Sonarr",
    description: "TV Series",
    icon: Tv,
    color: "#f43f5e",
    url: "https://sonarr.laz2ynas.cc",
    category: "media",
  },

  {
    id: "radarr",
    name: "Radarr",
    description: "Movies",
    icon: Film,
    color: "#eab308",
    url: "https://radarr.laz2ynas.cc",
    category: "media",
  },

  {
    id: "prowlarr",
    name: "Prowlarr",
    description: "Indexers",
    icon: Search,
    color: "#06b6d4",
    url: "https://prowlarr.laz2ynas.cc",
    category: "downloads",
  },

  {
    id: "jackett",
    name: "Jackett",
    description: "Torrent Proxies",
    icon: Sailboat,
    color: "#a3e635",
    url: "https://jackett.laz2ynas.cc",
    category: "downloads",
  },

  {
    id: "flaresolverr",
    name: "FlareSolverr",
    description: "Challenge Proxy",
    icon: Zap,
    color: "#f59e0b",
    url: "https://flaresolverr.laz2ynas.cc",
    category: "downloads",
  },
];
