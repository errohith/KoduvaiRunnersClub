import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { config } from "@/config/env";

export interface StorageAdapter {
  readonly name: string;
  put(key: string, data: Buffer, contentType: string): Promise<{ url: string }>;
  remove(key: string): Promise<void>;
}

const safeKey = (key: string) => {
  const normalized = path.posix.normalize(key).replace(/^\/+/, "");
  if (normalized.startsWith("..") || normalized.includes("\0")) throw new Error("Invalid storage key");
  return normalized;
};

export function createLocalStorage(dir: string): StorageAdapter {
  const root = path.resolve(dir);
  return {
    name: "local",
    async put(key, data) {
      const k = safeKey(key);
      const file = path.join(root, k);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, data);
      return { url: `/media/${k}` };
    },
    async remove(key) {
      await unlink(path.join(root, safeKey(key))).catch(() => undefined);
    },
  };
}

/** Read a locally stored file (used by the /media route). Returns null when missing. */
export async function readLocalFile(key: string): Promise<Buffer | null> {
  try {
    return await readFile(path.join(path.resolve(config.STORAGE_LOCAL_DIR), safeKey(key)));
  } catch {
    return null;
  }
}

export function createS3Storage(): StorageAdapter {
  const client = new S3Client({
    region: config.STORAGE_REGION,
    endpoint: config.STORAGE_ENDPOINT,
    forcePathStyle: !!config.STORAGE_ENDPOINT,
    credentials: { accessKeyId: config.STORAGE_ACCESS_KEY!, secretAccessKey: config.STORAGE_SECRET_KEY! },
  });
  return {
    name: "s3",
    async put(key, data, contentType) {
      const k = safeKey(key);
      await client.send(new PutObjectCommand({ Bucket: config.STORAGE_BUCKET!, Key: k, Body: data, ContentType: contentType, CacheControl: "public, max-age=31536000, immutable" }));
      return { url: `${config.STORAGE_PUBLIC_BASE_URL!.replace(/\/+$/, "")}/${k}` };
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket: config.STORAGE_BUCKET!, Key: safeKey(key) }));
    },
  };
}

export function getStorage(): StorageAdapter {
  return config.STORAGE_PROVIDER === "s3" ? createS3Storage() : createLocalStorage(config.STORAGE_LOCAL_DIR);
}

/** Validate uploads by magic bytes, not just the client-supplied MIME type. */
export function sniffImageType(buf: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}
