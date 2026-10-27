/** Runs once when the Next.js server starts: validate configuration and fail fast. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getConfig, ConfigError } = await import("@/config/env");
    try {
      getConfig();
    } catch (e) {
      if (e instanceof ConfigError) {
        console.error("\n" + e.message + "\n");
        process.exit(1);
      }
      throw e;
    }
  }
}
