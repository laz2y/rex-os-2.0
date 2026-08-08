import {
  Clapperboard,
  Cloud,
  Camera,
  Boxes,
  Download,
  Shield,
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
    url: "https://qbittorrent.laz2ynas.cc",
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
];