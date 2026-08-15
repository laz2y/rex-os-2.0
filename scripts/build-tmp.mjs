import { build } from "vite";

const result = await build({ configFile: "vite.config.ts", logLevel: "info" });
console.log("VITE_BUILD_OK", JSON.stringify(result && result.length !== undefined ? { written: result.length } : result));
