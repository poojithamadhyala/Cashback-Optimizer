/**
 * Storage factory. Selects the ObjectStorage implementation. v1 only ships
 * LocalDiskStorage (dev). When S3 is added, select via STORAGE_PROVIDER here.
 */
import type { ObjectStorage } from "./types.ts";
import { LocalDiskStorage } from "./local-disk.ts";

export * from "./types.ts";
export { LocalDiskStorage } from "./local-disk.ts";

export function getObjectStorage(): ObjectStorage {
  const which = (process.env.STORAGE_PROVIDER ?? "local").toLowerCase();
  switch (which) {
    // case "s3": return new S3Storage(); // TODO: production
    case "local":
    default:
      return new LocalDiskStorage();
  }
}
