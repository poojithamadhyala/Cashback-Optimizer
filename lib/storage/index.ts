/**
 * Storage factory. Selects the ObjectStorage implementation. v1 only ships
 * LocalDiskStorage (dev). When S3 is added, select via STORAGE_PROVIDER here.
 */
import type { ObjectStorage } from "./types.ts";
import { LocalDiskStorage } from "./local-disk.ts";

export * from "./types.ts";
export { LocalDiskStorage } from "./local-disk.ts";

/**
 * Parse a stored reference (e.g. "local://abc.jpg") into its scheme + key.
 * Returns null for anything that isn't a recognized reference. Pure/testable.
 */
export function parseStorageRef(
  ref: string | null | undefined
): { scheme: string; key: string } | null {
  if (!ref) return null;
  const m = /^([a-z0-9]+):\/\/(.+)$/i.exec(ref);
  if (!m) return null;
  return { scheme: m[1].toLowerCase(), key: m[2] };
}

export function getObjectStorage(): ObjectStorage {
  const which = (process.env.STORAGE_PROVIDER ?? "local").toLowerCase();
  switch (which) {
    // case "s3": return new S3Storage(); // TODO: production
    case "local":
    default:
      return new LocalDiskStorage();
  }
}
