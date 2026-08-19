/**
 * LocalDiskStorage tests — proves bytes are REALLY written to and read from disk
 * (not dropped by a stub). Uses a temp dir; cleans up after.
 * Run: node --experimental-strip-types --test lib/storage/local-disk.test.ts
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalDiskStorage } from "./local-disk.ts";

let dir: string;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "storage-test-"));
});
after(async () => {
  await rm(dir, { recursive: true, force: true });
});

test("put writes real bytes to disk; the file exists with identical content", async () => {
  const storage = new LocalDiskStorage(dir);
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 255]); // PNG-ish
  const obj = await storage.put(bytes, "image/png");

  assert.equal(obj.size, bytes.byteLength);
  assert.ok(obj.url.startsWith("local://"));
  assert.ok(obj.key.endsWith(".png"));

  // The file physically exists on disk...
  const onDisk = await stat(join(dir, obj.key));
  assert.equal(onDisk.size, bytes.byteLength);

  // ...and its bytes are identical to what we wrote.
  const raw = new Uint8Array(await readFile(join(dir, obj.key)));
  assert.deepEqual([...raw], [...bytes]);
});

test("get reads back exactly what put wrote (round-trip)", async () => {
  const storage = new LocalDiskStorage(dir);
  const bytes = new Uint8Array([10, 20, 30, 40, 50]);
  const obj = await storage.put(bytes, "image/jpeg");
  const back = await storage.get(obj.key);
  assert.deepEqual([...back], [...bytes]);
});

test("mime -> extension mapping (jpeg->jpg, unknown->bin)", async () => {
  const storage = new LocalDiskStorage(dir);
  const a = await storage.put(new Uint8Array([1]), "image/jpeg");
  assert.ok(a.key.endsWith(".jpg"));
  const b = await storage.put(new Uint8Array([1]), "application/octet-stream");
  assert.ok(b.key.endsWith(".bin"));
});

test("get rejects path-traversal keys", async () => {
  const storage = new LocalDiskStorage(dir);
  await assert.rejects(() => storage.get("../etc/passwd"), /invalid storage key/);
  await assert.rejects(() => storage.get("sub/dir.png"), /invalid storage key/);
});
