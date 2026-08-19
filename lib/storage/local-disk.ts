/**
 * LocalDiskStorage — real, dev-only object storage.
 *
 * ⚠️ NOT FOR PRODUCTION. This writes receipt images to a local `uploads/`
 * directory (gitignored). It is real storage — bytes are actually written to
 * and read back from disk, not dropped — but local disk does not survive
 * container restarts, horizontal scaling, or serverless/Vercel deploys.
 * BEFORE ANY REAL DEPLOYMENT, swap this for an S3-backed ObjectStorage
 * implementation (same interface). Tracked in README "Suggested next steps".
 *
 * Uses only Node built-ins (node:fs/promises, node:crypto, node:path) so it runs
 * with zero npm dependencies.
 */

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import type { ObjectStorage, StoredObject } from "./types.ts";

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

export class LocalDiskStorage implements ObjectStorage {
  readonly name = "local-disk";
  private readonly baseDir: string;

  /** @param baseDir absolute or cwd-relative directory to store objects in. */
  constructor(baseDir = process.env.UPLOAD_DIR ?? "uploads") {
    this.baseDir = resolve(baseDir);
  }

  private extFor(mimeType: string, suggestedExt?: string): string {
    if (suggestedExt) return suggestedExt.replace(/[^a-z0-9]/gi, "").toLowerCase();
    return MIME_EXT[mimeType.toLowerCase()] ?? "bin";
  }

  async put(
    bytes: Uint8Array,
    mimeType: string,
    suggestedExt?: string
  ): Promise<StoredObject> {
    await mkdir(this.baseDir, { recursive: true });
    const ext = this.extFor(mimeType, suggestedExt);
    const key = `${randomUUID()}.${ext}`;
    const fullPath = join(this.baseDir, key);
    await writeFile(fullPath, bytes);
    return {
      // A stable reference stored on the receipt. Scheme makes the backend
      // explicit; the app resolves it via get(key) rather than trusting a path.
      url: `local://${key}`,
      key,
      size: bytes.byteLength,
    };
  }

  async get(key: string): Promise<Uint8Array> {
    // Guard against path traversal: keys must be a single path segment.
    if (key.includes(sep) || key.includes("..") || key.includes("/")) {
      throw new Error("invalid storage key");
    }
    const fullPath = join(this.baseDir, key);
    const buf = await readFile(fullPath);
    return new Uint8Array(buf);
  }
}
