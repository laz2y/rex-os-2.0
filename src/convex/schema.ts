import { defineSchema } from "convex/server";

// REX OS uses its own Express backend (./backend) for all real data —
// Jellyfin, Portainer/Docker and system telemetry. Convex is kept here
// (empty schema) purely for platform tooling compatibility.
export default defineSchema({});
