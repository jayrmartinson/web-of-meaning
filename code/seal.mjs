// seal.mjs: AES-256-GCM sealing for the web, its log and the reflections.
// Each sealed text gets a fresh 12-byte IV; the auth tag is checked on opening, so a changed file won't open.
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

export function seal(key, text) {
  const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([c.update(String(text), "utf8"), c.final()]);
  return JSON.stringify({ v: 1, iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), data: data.toString("base64") });
}

export function unseal(key, sealed) {
  const e = JSON.parse(sealed), d = createDecipheriv("aes-256-gcm", key, Buffer.from(e.iv, "base64"));
  d.setAuthTag(Buffer.from(e.tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(e.data, "base64")), d.final()]).toString("utf8");
}
