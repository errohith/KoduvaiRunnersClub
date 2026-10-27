import { writeFileSync } from "node:fs";
import { openapi } from "../src/openapi";
writeFileSync(new URL("../docs/openapi.json", import.meta.url), JSON.stringify(openapi, null, 2) + "\n");
console.log("✓ docs/openapi.json written");
