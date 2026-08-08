import { mutation } from "./_generated/server";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();

type MediaSeed = {
  title: string;
  type: "movie" | "series";
  year: number;
  rating: number;
  runtime: number;
  genres: string[];
  overview: string;
  hue: number;
  addedAt: number;
  progress: number;
};

const MEDIA: MediaSeed[] = [
  {
    title: "Neon Requiem",
    type: "movie",
    year: 2026,
    rating: 8.7,
    runtime: 128,
    genres: ["Cyberpunk", "Thriller"],
    overview:
      "A courier carrying a stolen consciousness through the neon undercity must decide who gets to keep the memory — and who gets erased with it.",
    hue: 195,
    addedAt: NOW - 2 * DAY,
    progress: 0,
  },
  {
    title: "Ghost Signal",
    type: "series",
    year: 2025,
    rating: 9.1,
    runtime: 46,
    genres: ["Sci-Fi", "Mystery"],
    overview:
      "A deep-space relay station receives a transmission from a ship that was lost thirty years ago — broadcast from a frequency that shouldn't exist.",
    hue: 265,
    addedAt: NOW - 3 * DAY,
    progress: 0.62,
  },
  {
    title: "Chrome Skies",
    type: "series",
    year: 2024,
    rating: 8.2,
    runtime: 42,
    genres: ["Anime", "Action"],
    overview:
      "In a megacity where the sky is a projection, a squad of ex-military pilots hunts the rogue AIs that learned to fly.",
    hue: 210,
    addedAt: NOW - 4 * DAY,
    progress: 0.18,
  },
  {
    title: "Zero Day Protocol",
    type: "movie",
    year: 2025,
    rating: 7.9,
    runtime: 112,
    genres: ["Hacker", "Drama"],
    overview:
      "When a banking system locks an entire nation out of its own money, the only key is a script nobody is allowed to run.",
    hue: 330,
    addedAt: NOW - 5 * DAY,
    progress: 0,
  },
  {
    title: "Starfall Brigade",
    type: "series",
    year: 2026,
    rating: 8.8,
    runtime: 52,
    genres: ["Space", "Anime", "War"],
    overview:
      "The last orbital shipyard launches a crew of misfits to intercept a debris field that is actually moving in formation.",
    hue: 150,
    addedAt: NOW - 6 * DAY,
    progress: 0,
  },
  {
    title: "Vapor Sunset",
    type: "movie",
    year: 2023,
    rating: 7.4,
    runtime: 97,
    genres: ["Romance", "Cyberpunk"],
    overview:
      "Two strangers meet every evening on a rooftop where the city's daylight-saving program plays an impossible orange sky.",
    hue: 20,
    addedAt: NOW - 8 * DAY,
    progress: 1,
  },
  {
    title: "The Last Protocol",
    type: "movie",
    year: 2024,
    rating: 8.1,
    runtime: 134,
    genres: ["Espionage", "Thriller"],
    overview:
      "A retired ops handler is pulled back in when the encryption key that once ended a war starts being sold to everyone who lost it.",
    hue: 260,
    addedAt: NOW - 9 * DAY,
    progress: 0,
  },
  {
    title: "Mecha Dawn",
    type: "series",
    year: 2022,
    rating: 8.4,
    runtime: 24,
    genres: ["Anime", "Mecha", "Action"],
    overview:
      "A farmhand finds an abandoned prototype frame in the family silo — and a war that ended before he was born starts looking for it.",
    hue: 285,
    addedAt: NOW - 11 * DAY,
    progress: 0.4,
  },
  {
    title: "Digital Yokai",
    type: "series",
    year: 2025,
    rating: 8.9,
    runtime: 25,
    genres: ["Anime", "Supernatural", "Cyberpunk"],
    overview:
      "In Old Tokyo's server stacks, spirits that outlived the analog age are migrating into the new network — and some of them hold grudges.",
    hue: 350,
    addedAt: NOW - 12 * DAY,
    progress: 0,
  },
  {
    title: "Outer Rim Signal",
    type: "movie",
    year: 2021,
    rating: 7.6,
    runtime: 105,
    genres: ["Sci-Fi", "Adventure"],
    overview:
      "A salvage crew charts a course to the farthest relay in the catalogue, where every probe they send back arrives empty.",
    hue: 175,
    addedAt: NOW - 14 * DAY,
    progress: 1,
  },
  {
    title: "Railgun Run",
    type: "movie",
    year: 2026,
    rating: 8.3,
    runtime: 118,
    genres: ["Action", "Anime", "Heist"],
    overview:
      "A magnetically levitated freight train carrying the city's water supply is hijacked mid-suspend — the crew has four hours and no gravity.",
    hue: 40,
    addedAt: NOW - 15 * DAY,
    progress: 0,
  },
  {
    title: "Glass Network",
    type: "series",
    year: 2023,
    rating: 8.0,
    runtime: 44,
    genres: ["Drama", "Tech"],
    overview:
      "A mesh network woven from smart-city windows starts routing its own traffic — and its owners' secrets along with it.",
    hue: 220,
    addedAt: NOW - 17 * DAY,
    progress: 0,
  },
  {
    title: "Midnight Compiler",
    type: "movie",
    year: 2020,
    rating: 7.2,
    runtime: 101,
    genres: ["Hacker", "Drama"],
    overview:
      "A night-shift compiler at a defense lab writes one line of code that compiles into something that compiles back.",
    hue: 300,
    addedAt: NOW - 18 * DAY,
    progress: 0,
  },
  {
    title: "Petal Circuit",
    type: "series",
    year: 2024,
    rating: 8.6,
    runtime: 23,
    genres: ["Anime", "Drama", "Slice of Life"],
    overview:
      "An android flower shop in a rain-drenched district learns to arrange bouquets for people who can't say goodbye.",
    hue: 0,
    addedAt: NOW - 20 * DAY,
    progress: 0.75,
  },
  {
    title: "Static Bloom",
    type: "movie",
    year: 2025,
    rating: 7.8,
    runtime: 109,
    genres: ["Sci-Fi", "Drama"],
    overview:
      "After a solar storm scrambles every receiver on the continent, a radio DJ keeps broadcasting to an audience she can't measure.",
    hue: 55,
    addedAt: NOW - 21 * DAY,
    progress: 0,
  },
  {
    title: "Fracture Point",
    type: "series",
    year: 2021,
    rating: 8.5,
    runtime: 47,
    genres: ["Thriller", "Crime"],
    overview:
      "A data auditor discovers that every major crime in the last decade was predicted — and priced — on a single shadow ledger.",
    hue: 240,
    addedAt: NOW - 23 * DAY,
    progress: 0.3,
  },
  {
    title: "Iron Blossom",
    type: "movie",
    year: 2022,
    rating: 8.0,
    runtime: 121,
    genres: ["Anime", "Fantasy", "Action"],
    overview:
      "A blacksmith who reforges ruined war machines into gardens must rebuild one last engine to stop a flood of cold iron.",
    hue: 130,
    addedAt: NOW - 25 * DAY,
    progress: 0,
  },
  {
    title: "Sleeping City",
    type: "series",
    year: 2020,
    rating: 7.9,
    runtime: 41,
    genres: ["Noir", "Cyberpunk"],
    overview:
      "Every night the city runs a maintenance protocol that erases itself from memory. One detective started staying awake.",
    hue: 190,
    addedAt: NOW - 27 * DAY,
    progress: 0,
  },
  {
    title: "Hyperloop Heist",
    type: "movie",
    year: 2019,
    rating: 7.1,
    runtime: 96,
    genres: ["Action", "Crime"],
    overview:
      "Five couriers rob a vacuum tube network by riding the pod itself — and the payload turns out to be one of them.",
    hue: 25,
    addedAt: NOW - 29 * DAY,
    progress: 0,
  },
  {
    title: "Signal Mother",
    type: "series",
    year: 2026,
    rating: 9.0,
    runtime: 50,
    genres: ["Sci-Fi", "Family", "Drama"],
    overview:
      "A single mother maintains the satellite that keeps her island online, until the constellation starts answering her calls.",
    hue: 100,
    addedAt: NOW - 31 * DAY,
    progress: 0,
  },
  {
    title: "Byte Town",
    type: "series",
    year: 2018,
    rating: 8.3,
    runtime: 22,
    genres: ["Anime", "Comedy", "Cyberpunk"],
    overview:
      "The least profitable arcade in the grid takes on a new partner: a sentient pay-per-play machine with opinions.",
    hue: 315,
    addedAt: NOW - 33 * DAY,
    progress: 0,
  },
  {
    title: "The Redshift Journals",
    type: "movie",
    year: 2023,
    rating: 8.2,
    runtime: 142,
    genres: ["Sci-Fi", "Adventure", "Drama"],
    overview:
      "A lone pilot logs the slow death of a star system — and slowly realizes the star is logging her back.",
    hue: 10,
    addedAt: NOW - 35 * DAY,
    progress: 0,
  },
  {
    title: "Neon Requiem: Remaster",
    type: "movie",
    year: 2026,
    rating: 8.9,
    runtime: 136,
    genres: ["Cyberpunk", "Thriller", "Anime"],
    overview:
      "The definitive cut of the undercity classic, with restored frames and a new score recorded in the half-built city it was shot in.",
    hue: 205,
    addedAt: NOW - DAY,
    progress: 0,
  },
  {
    title: "Winter Protocol",
    type: "series",
    year: 2022,
    rating: 8.1,
    runtime: 39,
    genres: ["Thriller", "Espionage"],
    overview:
      "A climate research station's heating grid is running its own diplomacy, trading warmth for information with the frozen coast.",
    hue: 165,
    addedAt: NOW - 37 * DAY,
    progress: 0,
  },
];

type ContainerSeed = {
  name: string;
  image: string;
  state: "running" | "exited" | "paused" | "restarting" | "created";
  status: string;
  cpu: number;
  memMb: number;
  ports: string;
  health: "healthy" | "unhealthy" | "none";
  serviceId?: string;
  startedAt: number;
};

const CONTAINERS: ContainerSeed[] = [
  {
    name: "jellyfin",
    image: "lscr.io/linuxserver/jellyfin:latest",
    state: "running",
    status: "Up 14 days",
    cpu: 3.2,
    memMb: 812,
    ports: "8096:8096/tcp",
    health: "healthy",
    serviceId: "jellyfin",
    startedAt: NOW - 14 * DAY,
  },
  {
    name: "portainer",
    image: "portainer/portainer-ce:latest",
    state: "running",
    status: "Up 31 days",
    cpu: 0.4,
    memMb: 96,
    ports: "9443:9443/tcp",
    health: "healthy",
    serviceId: "portainer",
    startedAt: NOW - 31 * DAY,
  },
  {
    name: "sonarr",
    image: "lscr.io/linuxserver/sonarr:latest",
    state: "running",
    status: "Up 31 days",
    cpu: 1.1,
    memMb: 240,
    ports: "8989:8989/tcp",
    health: "healthy",
    serviceId: "sonarr",
    startedAt: NOW - 31 * DAY,
  },
  {
    name: "radarr",
    image: "lscr.io/linuxserver/radarr:latest",
    state: "running",
    status: "Up 31 days",
    cpu: 1.4,
    memMb: 268,
    ports: "7878:7878/tcp",
    health: "healthy",
    serviceId: "radarr",
    startedAt: NOW - 31 * DAY,
  },
  {
    name: "prowlarr",
    image: "lscr.io/linuxserver/prowlarr:latest",
    state: "running",
    status: "Up 31 days",
    cpu: 0.2,
    memMb: 128,
    ports: "9696:9696/tcp",
    health: "healthy",
    serviceId: "prowlarr",
    startedAt: NOW - 31 * DAY,
  },
  {
    name: "qbittorrent",
    image: "lscr.io/linuxserver/qbittorrent:latest",
    state: "running",
    status: "Up 12 days",
    cpu: 2.8,
    memMb: 356,
    ports: "8080:8080/tcp",
    health: "healthy",
    serviceId: "qbittorrent",
    startedAt: NOW - 12 * DAY,
  },
  {
    name: "sabnzbd",
    image: "lscr.io/linuxserver/sabnzbd:latest",
    state: "running",
    status: "Up 31 days",
    cpu: 0.9,
    memMb: 194,
    ports: "8081:8080/tcp",
    health: "healthy",
    serviceId: "sabnzbd",
    startedAt: NOW - 31 * DAY,
  },
  {
    name: "traefik",
    image: "traefik:v3.4",
    state: "running",
    status: "Up 31 days",
    cpu: 0.6,
    memMb: 72,
    ports: "80:80/tcp, 443:443/tcp",
    health: "healthy",
    startedAt: NOW - 31 * DAY,
  },
  {
    name: "watchtower",
    image: "containrrr/watchtower:latest",
    state: "paused",
    status: "Paused 2 days",
    cpu: 0,
    memMb: 24,
    ports: "",
    health: "none",
    startedAt: NOW - 2 * DAY,
  },
  {
    name: "postgres-backup",
    image: "prodrigestivill/postgres-backup-local:16",
    state: "exited",
    status: "Exited (0) 6 hours ago",
    cpu: 0,
    memMb: 0,
    ports: "",
    health: "none",
    startedAt: NOW - 6 * 60 * 60 * 1000,
  },
];

/**
 * Seed the demo dataset once (idempotent). Called by the dashboard shell on
 * mount so every REX OS console starts with a populated library and
 * container overview. Safe to re-run — no-op when data already exists.
 */
export const ensureSeedData = mutation({
  args: {},
  handler: async (ctx) => {
    const firstMedia = await ctx.db.query("mediaItems").first();
    const firstContainer = await ctx.db.query("containers").first();
    const mediaCount = firstMedia === null ? 0 : 1;
    const containerCount = firstContainer === null ? 0 : 1;

    if (mediaCount === 0) {
      for (const item of MEDIA) {
        await ctx.db.insert("mediaItems", item);
      }
    }
    if (containerCount === 0) {
      for (const c of CONTAINERS) {
        await ctx.db.insert("containers", c);
      }
    }

    return { seededMedia: mediaCount === 0, seededContainers: containerCount === 0 };
  },
});
