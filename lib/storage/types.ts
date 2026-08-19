/**
 * Object storage interface — Section 4 (service boundaries): receipt images are
 * an external resource behind a swappable interface, like OCR.
 *
 * v1 ships a LocalDiskStorage for dev. Production MUST swap this for S3 (or an
 * equivalent object store) — local disk does not survive horizontal scaling,
 * container restarts, or serverless deploys. See lib/storage/local-disk.ts.
 */

export interface StoredObject {
  /**
   * A URL/reference persisted on the receipt row (`receipts.image_url`). For
   * LocalDiskStorage this is a `file://`-style relative path; for S3 it would be
   * an s3:// URI or a signed https URL.
   */
  url: string;
  /** Storage key (path/object key) without the scheme, for later retrieval. */
  key: string;
  /** Bytes written. */
  size: number;
}

export interface ObjectStorage {
  readonly name: string;
  /**
   * Persist raw bytes and return a reference. `suggestedExt` (e.g. "jpg") is a
   * hint for the stored key; implementations may ignore it.
   */
  put(bytes: Uint8Array, mimeType: string, suggestedExt?: string): Promise<StoredObject>;
  /** Read previously stored bytes back by key. */
  get(key: string): Promise<Uint8Array>;
}
