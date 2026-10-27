import { readLocalFile } from "@/server/adapters/storage";

const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Serves files stored by the local storage adapter. Only image types are ever served. */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const key = (await params).key.join("/");
  const type = TYPES[key.split(".").pop()?.toLowerCase() ?? ""];
  if (!type) return new Response("Not found", { status: 404 });
  const data = await readLocalFile(key);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'" },
  });
}
