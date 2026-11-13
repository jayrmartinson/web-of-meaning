// lock.mjs: keeps a companion's keys locked to this computer.
//
// On Windows, a key is locked to the signed-in user account with DPAPI (the Windows Data Protection API).
// On any other system there is no built-in lock here, so this refuses to run unless you are running the tests
// (WEB_OF_MEANING_TEST=1), where keys are made up and stored unlocked in a throwaway folder.
// If you build on macOS or Linux, replace these two functions with your system's keychain.
import { spawnSync } from "node:child_process";

const testing = () => process.env.WEB_OF_MEANING_TEST === "1";

export function lockForThisPC(key) {
  if (process.platform !== "win32") {
    if (!testing()) throw new Error("No key lock for this system yet: replace lockForThisPC in lock.mjs with your system's keychain.");
    return { kind: "test-only-unlocked", data: key.toString("base64") };
  }
  const r = spawnSync("powershell", ["-NoProfile", "-Command",
    "Add-Type -AssemblyName System.Security; $b=[Convert]::FromBase64String($env:LOCK_IN); [Convert]::ToBase64String([System.Security.Cryptography.ProtectedData]::Protect($b,$null,'CurrentUser'))"],
    { env: { ...process.env, LOCK_IN: key.toString("base64") }, encoding: "utf8" });
  if (r.status !== 0) throw new Error("Windows could not lock the key.");
  return { kind: "windows-dpapi", data: r.stdout.trim() };
}

export function unlockOnThisPC(v) {
  if (v.kind === "test-only-unlocked") {
    if (!testing()) throw new Error("This key was made for the tests and is not locked; it can't be used outside them.");
    return Buffer.from(v.data, "base64");
  }
  if (v.kind !== "windows-dpapi" || process.platform !== "win32") throw new Error("This key can only be opened on the Windows account that locked it.");
  const r = spawnSync("powershell", ["-NoProfile", "-Command",
    "Add-Type -AssemblyName System.Security; $b=[Convert]::FromBase64String($env:LOCK_IN); [Convert]::ToBase64String([System.Security.Cryptography.ProtectedData]::Unprotect($b,$null,'CurrentUser'))"],
    { env: { ...process.env, LOCK_IN: v.data }, encoding: "utf8" });
  if (r.status !== 0) throw new Error("The key could not be opened on this computer.");
  return Buffer.from(r.stdout.trim(), "base64");
}
