import { query } from "./_generated/server";

/**
 * All containers, running first, then alphabetical. The REX OS console is a
 * read-only overview — full management lives in Portainer.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const containers = await ctx.db.query("containers").collect();
    const order: Record<string, number> = {
      running: 0,
      restarting: 1,
      paused: 2,
      created: 3,
      exited: 4,
    };
    return [...containers].sort((a, b) => {
      const d = (order[a.state] ?? 9) - (order[b.state] ?? 9);
      return d !== 0 ? d : a.name.localeCompare(b.name);
    });
  },
});
