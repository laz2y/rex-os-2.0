import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Most recently added media (Jellyfin-style "Latest" row).
 */
export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 8 }) => {
    const items = await ctx.db.query("mediaItems").collect();
    return items
      .sort((a, b) => b.addedAt - a.addedAt)
      .slice(0, Math.min(limit, 24));
  },
});

/**
 * Filtered library listing with optional type filter and free-text search.
 */
export const list = query({
  args: {
    type: v.optional(v.union(v.literal("movie"), v.literal("series"))),
    query: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { type, query: search, limit = 200 }) => {
    let items = await ctx.db.query("mediaItems").collect();

    if (type) {
      items = items.filter((item) => item.type === type);
    }
    if (search && search.trim().length > 0) {
      const q = search.trim().toLowerCase();
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.genres.some((g) => g.toLowerCase().includes(q)),
      );
    }

    return items
      .sort((a, b) => b.addedAt - a.addedAt)
      .slice(0, Math.min(limit, 500));
  },
});

/**
 * Library stats for header badges / empty states.
 */
export const stats = query({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db.query("mediaItems").collect();
    const movies = items.filter((i) => i.type === "movie").length;
    const series = items.filter((i) => i.type === "series").length;
    return { total: items.length, movies, series };
  },
});
