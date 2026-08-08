import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // REX OS — media library (Jellyfin-style catalog). Fields mirror the shape
    // of a Jellyfin BaseItem so this can be pointed at a real server later.
    mediaItems: defineTable({
      title: v.string(), // Jellyfin: Name
      type: v.union(v.literal("movie"), v.literal("series")), // Jellyfin: Type
      year: v.number(), // Jellyfin: ProductionYear
      rating: v.number(), // 0–10, Jellyfin: CommunityRating
      runtime: v.number(), // minutes, Jellyfin: RunTimeTicks / 600000000
      genres: v.array(v.string()), // Jellyfin: Genres
      overview: v.string(), // Jellyfin: Overview
      hue: v.number(), // poster gradient base hue (0–360)
      addedAt: v.number(), // ms epoch, Jellyfin: DateCreated
      progress: v.number(), // 0–1 watch progress (continue watching)
    })
      .index("by_addedAt", ["addedAt"])
      .index("by_type", ["type"]),

    // REX OS — Docker/Portainer container overview (read-only mirror).
    containers: defineTable({
      name: v.string(),
      image: v.string(),
      state: v.union(
        v.literal("running"),
        v.literal("exited"),
        v.literal("paused"),
        v.literal("restarting"),
        v.literal("created"),
      ),
      status: v.string(), // human text, e.g. "Up 3 days"
      cpu: v.number(), // percent
      memMb: v.number(),
      ports: v.string(), // "8096:8096/tcp"
      health: v.union(v.literal("healthy"), v.literal("unhealthy"), v.literal("none")),
      serviceId: v.optional(v.string()), // matches a service in src/lib/rexos.ts
      startedAt: v.number(),
    }).index("by_state", ["state"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
