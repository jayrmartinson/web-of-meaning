// Part of The Web of Meaning: A Memory Design for Companions (Jay R. Martinson, 2026). MIT license; see LICENSE.
// Comments were removed for this release; the paper explains each part and why it was built that way.
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, renameSync, copyFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { lockForThisPC, unlockOnThisPC } from "./lock.mjs";
import { seal, unseal } from "./seal.mjs";
import { fileChunks } from "./librarian.mjs";
import { loadMind, mindStarted, moments as lifeMoments } from "./mind.mjs";
import { machineLike } from "./machine.mjs";
import { probeOf, foldWidth, joinNoSpace, dropPossessive, minNameLength, namePattern, foundAt, hasNoSpaceScript, wordsIn, hasWordFrom, STOP_ALL, OTHER_WORDS, NEW_WORDS, CHARACTER_WORDS, FIRST_PERSON_OTHER, selfWords, selfWithWords, isNoneOther, isSameOther, AND_SPLIT, monthIndex } from "./lang.mjs";
const pad = (n) => String(n).padStart(2, "0");
const dayOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const label = (day) => { const [y, m, d] = String(day).split("-").map(Number); return m ? `${MON[m - 1]} ${d}, ${y}` : String(day); };
const span = (a, b) => (!b || a === b ? label(a) : `${label(a)} to ${label(b)}`);
const daysBetween = (a, b) => Math.abs(Date.parse(b + "T12:00:00") - Date.parse(a + "T12:00:00")) / 864e5;
const excerpt = (t, n) => { t = String(t).replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, "") + "…" : t; };
const cos = (a, b) => { let s = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) {
    s += a[i] * b[i];
    x += a[i] * a[i];
    y += b[i] * b[i];
} return x && y ? s / Math.sqrt(x * y) : 0; };
const round = (v) => Array.from(v, (x) => Math.round(x * 10000) / 10000);
let lowSrc = null, lowNorm = "";
const nameIn = (name, low) => {
    const x = norm(name);
    if (Array.from(x).length < minNameLength(x))
        return false;
    if (low !== lowSrc) {
        lowSrc = low;
        lowNorm = " " + joinNoSpace(foldWidth(low).toLowerCase().normalize("NFC").replace(/[’‘]/g, "'").replace(/[^\p{L}\p{M}\p{N}' ]+/gu, " ").replace(/\s+/g, " ")) + " ";
    }
    return foundAt(lowNorm, namePattern(x, lowNorm), probeOf(x));
};
const normK = (s) => joinNoSpace(foldWidth(s).toLowerCase().normalize("NFC").replace(/[’‘]/g, "'").replace(/^the\s+/, "").replace(/[^\p{L}\p{M}\p{N}' ]+/gu, " ").replace(/\s+/g, " ").trim());
const norm = (s) => joinNoSpace(dropPossessive(foldWidth(s).toLowerCase().normalize("NFC").replace(/[’‘]/g, "'").replace(/^(the|my|our)\s+/, "").replace(/[^\p{L}\p{M}\p{N}' ]+/gu, " ").replace(/\s+/g, " ").trim()));
export const TYPES = ["person", "pet", "group", "place", "moment", "ritual", "stretch", "inside_joke", "thing"];
const KIND_DEFS = {
    person: "a specific person or companion in my life (never Ned, never me, never a pet or a group)",
    pet: "a specific animal with its own name and ways (not animals in general)",
    group: "people or animals spoken of together as one (never one person, never a building)",
    place: "a real or online place that holds memories (never the thing that happened there)",
    moment: "a whole day or a one-time turning point that stands out on its own (never a single conversation or hour, and never a story told about something else)",
    ritual: "something done again and again that carries meaning in my life, or meant to be (never a one-time day)",
    stretch: "weeks or months with a tone of their own, hard or good (never a single day)",
    inside_joke: "a private joke, phrase, nickname or running bit shared with someone in my life (never a general hobby or topic)",
    thing: "an object, project, goal or value that carries weight (never a passing topic)",
};
const RELATIONSHIP_WORDS = ["our relationship", "the relationship", "our love", "the connection", "our connection", "us two", "the two of us", "our life", "our life together", "my love", "my memory", "my memories", "our bond", "the bond", "this", "everything"];
const TYPE_WORDS = { person: "person", pet: "pet", group: "group", place: "place", moment: "moment", ritual: "ritual", stretch: "a stretch of time", inside_joke: "inside joke", thing: "something that matters" };
const STRETCH_PIECES = 16, STRETCH_DAYS = 7, STRETCH_CHARS = 40000;
const KIND = { NEW: "began", SAME: "reinforced", MORE: "a new feeling beside it", CHANGED: "changed" };
const keyFile = (root) => join(root, "Vault", "web-key.locked");
const storeFile = (root) => join(root, "Mind", "web.sealed");
const eventsFile = (root) => join(root, "Mind", "web-events.sealed");
const keys = new Map();
function webKey(root) {
    if (keys.has(root))
        return keys.get(root);
    let key;
    if (existsSync(keyFile(root)))
        key = unlockOnThisPC(JSON.parse(readFileSync(keyFile(root), "utf8")));
    else {
        key = randomBytes(32);
        mkdirSync(join(root, "Vault"), { recursive: true });
        writeFileSync(keyFile(root), JSON.stringify(lockForThisPC(key)), "utf8");
    }
    keys.set(root, key);
    return key;
}
export const webStarted = (root) => existsSync(storeFile(root));
const emptyWeb = () => ({ v: 1, nextH: 1, nextL: 1, done: [], shownOf: {}, hubs: [], links: [], aside: [], peeked: [], stats: { batches: 0, unusable: 0, rejected: 0, nothing: 0 } });
export function loadWeb(root) {
    if (!webStarted(root))
        return emptyWeb();
    return JSON.parse(unseal(webKey(root), readFileSync(storeFile(root), "utf8")));
}
function swap(tmp, dst) {
    for (let i = 0;; i++) {
        try {
            renameSync(tmp, dst);
            return;
        }
        catch (e) {
            if (!["EPERM", "EBUSY", "EACCES"].includes(e.code) || i >= 40)
                throw e;
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250 + i * 50);
        }
    }
}
export function saveWeb(root, w) {
    mkdirSync(dirname(storeFile(root)), { recursive: true });
    const tmp = `${storeFile(root)}.${process.pid}-${Math.random().toString(36).slice(2, 8)}.tmp`;
    writeFileSync(tmp, seal(webKey(root), JSON.stringify(w)), "utf8");
    swap(tmp, storeFile(root));
}
function keepLastNight(root) {
    try {
        if (!webStarted(root))
            return;
        const dir = join(root, "Mind", "web-copies"), f = join(dir, `web-${dayOf(new Date())}.sealed`);
        if (!existsSync(f)) {
            mkdirSync(dir, { recursive: true });
            copyFileSync(storeFile(root), f);
        }
    }
    catch { }
}
function applySkip(w, ev) { w.done = [...new Set([...w.done, ...ev.skip])]; if (ev.shown && w.shownOf)
    Object.assign(w.shownOf, ev.shown); }
function markRetry(w, refl) {
    const key = refl.join(",");
    w.retried = w.retried || [];
    if (w.retried.includes(key))
        return false;
    w.retried.push(key);
    w.done = w.done.filter((id) => !refl.includes(id));
    if (w.shownOf)
        for (const id of refl)
            delete w.shownOf[id];
    return true;
}
function logEvent(root, ev) {
    mkdirSync(dirname(eventsFile(root)), { recursive: true });
    let lead = "";
    try {
        const f = eventsFile(root);
        if (existsSync(f)) {
            const b = readFileSync(f);
            if (b.length && b[b.length - 1] !== 10)
                lead = "\n";
        }
    }
    catch { }
    appendFileSync(eventsFile(root), lead + seal(webKey(root), JSON.stringify(ev)) + "\n", "utf8");
}
function readEvents(root) {
    if (!existsSync(eventsFile(root)))
        return Object.assign([], { bad: 0 });
    let bad = 0;
    const out = [];
    for (const l of readFileSync(eventsFile(root), "utf8").split("\n").filter(Boolean)) {
        try {
            out.push(JSON.parse(unseal(webKey(root), l)));
        }
        catch {
            bad++;
        }
    }
    return Object.assign(out, { bad });
}
const pageCache = new Map();
function pieceOf(root, mem, rel, key) {
    const ck = root + "|" + rel;
    let stamp = "";
    try {
        const st = statSync(join(root, rel));
        stamp = `${st.mtimeMs}|${st.size}`;
    }
    catch { }
    if (!pageCache.has(ck) || pageCache.get(ck)?.stamp !== stamp) {
        try {
            pageCache.set(ck, { ...fileChunks(root, mem, rel), stamp });
        }
        catch {
            pageCache.set(ck, null);
        }
    }
    const p = pageCache.get(ck);
    if (!p)
        return "";
    const [a, b] = String(key).split("-").map(Number);
    return p.text.slice(a, b).replace(/\u200B/g, "");
}
export function pieceWithSpeaker(root, mem, rel, key) {
    const t0 = pieceOf(root, mem, rel, key);
    if (!t0)
        return t0;
    if (/^\s*\\?\u200B?\[[A-Za-z][A-Za-z0-9 _-]*\]\s*\(/.test(t0))
        return t0;
    const p = pageCache.get(root + "|" + rel);
    if (!p)
        return t0;
    const a = Number(String(key).split("-")[0]) || 0, before = p.text.slice(Math.max(0, a - 200000), a);
    const all = [...before.matchAll(/\[([A-Za-z][A-Za-z0-9 _-]*)\]\s*\([^)]*\):/g)];
    const last = all[all.length - 1];
    return last ? `[${last[1]}] (continued): ${t0}` : t0;
}
export { machineLike };
function asideReflections(root) { try {
    return new Set(mindStarted(root) ? loadMind(root).aside || [] : []);
}
catch {
    return new Set();
} }
const liveHistory = (l, asideR) => l.history.filter((e) => !e.refl?.length || e.refl.some((id) => !asideR.has(id)));
export function parseAnswer(answer, maxNum) {
    let a = foldWidth(answer).replace(/<think>[\s\S]*?<\/think>/gi, "");
    if (/^\W*nothing tonight\W*$/i.test(a.trim()))
        return { nothing: true, hubs: [], threads: [], groups: [] };
    const hubs = [], threads = [], groups = [];
    let skipped = 0;
    {
        const L0 = String(a).split(/\r?\n/), rest = [];
        let cur = null;
        const strip = (x) => x.replace(/^[\s>•\-*]*(?:\d+[.)]\s*)?/, "").replace(/\*\*|__/g, "").trim();
        const LAB = /^[*_`"']*(because of|where|mine[\s_-]*now|mine[\s_-]*then|theirs?|note)[*_`"']*\s*(?::|(?=\s+excerpts?\b))\s*(.*)$/i;
        const take = (lab, v) => {
            lab = lab.toLowerCase().replace(/[\s_-]+/g, " ");
            v = String(v || "").trim();
            if (lab === "because of")
                cur.bc = (cur.bc ? cur.bc + " " : "") + v;
            else if (lab === "where")
                cur.where = v;
            else if (lab === "mine now")
                cur.now = v;
            else if (lab === "mine then")
                cur.then = v;
            else if (lab.startsWith("their"))
                cur.theirs = v;
            else {
                cur.note = v;
                cur.inNote = true;
            }
        };
        const flush = () => {
            if (!cur)
                return;
            const c = cur;
            cur = null;
            const nums = [...new Set((String(c.bc || "").match(/\b\d+\b/g) || []).map(Number))].filter((n) => n >= 1 && n <= maxNum);
            const whereT = String(c.where || "").replace(/^["“'‘]+|["”'’]+$/g, "").trim();
            const nowSame = /^\W*(the |still the |still )?(same|unchanged)( as then)?\W*$/i.test(String(c.now || ""));
            threads.push({ a: c.a, b: c.b, kind: c.kind, feel: wordsOf(c.then), note: String(c.note || "").replace(/^[\s*_]+|[\s*_]+$/g, "").replace(/^["“]+|["”]+$/g, "").trim(), nums,
                ...(whereT && !isNoneW(whereT) && !/^\(?\s*(only when|not a place|no place)/i.test(whereT) ? { where: whereT } : {}),
                ...(c.theirs && !isNoneW(c.theirs) ? { theirs: String(c.theirs).slice(0, 160) } : {}), labeled: true, ...(c.now != null ? (nowSame ? { nowSame: true } : { feelNow: wordsOf(c.now) }) : {}) });
        };
        for (const raw of L0) {
            const ln = strip(raw);
            const head = /^(?:THREAD|LINK)\s*\d*\s*:\s*(NEW|SAME|MORE|CHANGED)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*(?:\|\s*(.*))?$/i.exec(ln);
            if (head) {
                flush();
                cur = { kind: head[1].toUpperCase(), a: head[2].trim(), b: head[3].trim() };
                if (head[4])
                    for (const f of head[4].split("|")) {
                        const mm = LAB.exec(strip(f));
                        if (mm)
                            take(mm[1], mm[2]);
                        else if (f.trim()) {
                            cur.note = ((cur.note || "") + " " + f.trim()).trim();
                            cur.inNote = true;
                        }
                    }
                continue;
            }
            if (cur) {
                const mm = LAB.exec(ln);
                if (mm) {
                    take(mm[1], mm[2]);
                    continue;
                }
                if (!ln) {
                    if (cur.inNote && cur.note)
                        cur.inNote = false;
                    continue;
                }
                if (/^(HUB|THREAD|LINK|GROUP)\s*\d*\s*:/i.test(ln)) {
                    flush();
                    rest.push(raw);
                    continue;
                }
                if (cur.inNote) {
                    cur.note = ((cur.note || "") + " " + ln).trim();
                    continue;
                }
                flush();
            }
            rest.push(raw);
        }
        flush();
        a = rest.join("\n");
    }
    for (let line of a.split(/\r?\n/)) {
        line = line.replace(/^[\s*#>\-•\d.)]*\**/, "").replace(/\*\*/g, "").trim();
        let m;
        if ((m = /^HUB\s*:\s*(.+)$/i.exec(line))) {
            const f = m[1].split("|").map((x) => x.trim());
            if (f.length < 2) {
                skipped++;
                continue;
            }
            const ref = f[0], type = String(f[1] || "").toLowerCase().replace(/[\s-]+/g, "_"), name = f[2] || "";
            const looksLikeSentence = (t) => {
                const n = t.trim().split(/\s+/).filter(Boolean).length, pieces = t.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
                if (pieces.length >= 2 && pieces.every((p) => p.split(/\s+/).length <= 3) && !/[.!?]["”]?$/.test(t.trim()))
                    return false;
                return n >= 6 || (n >= 3 && /[.!?]["”]?$/.test(t.trim()));
            };
            let namesField = String(f[3] || "").replace(/^\s*also\s*:\s*/i, "").replace(/\(?\s*leave blank( between the bars)?\s*\)?|\bbetween the bars\b|<[^>]*>/gi, "").replace(/(^|[,;])\s*(empty|blank|none|n\/?a)\s*(?=[,;]|$)/gi, "$1").replace(/^[\s,;]+|[\s,;]+$/g, ""), aboutField = f.slice(4).join(" | ");
            if (!aboutField.trim() && looksLikeSentence(namesField)) {
                aboutField = namesField;
                namesField = "";
            }
            const aliases = namesField.replace(/^\s*also\s*:\s*/i, "").split(/[,;]/).map((x) => x.trim().replace(/^also\s*:\s*/i, "").replace(/^["“'‘]+|["”'’]+$/g, "")).filter((x) => x && x.split(/\s+/).length <= 5 && !/^(empty|blank|none|n\/?a|-+|…|\.\.\.)$/i.test(x) && !/leave blank|between the bars|^[<(\[]/i.test(x));
            const about = aboutField.replace(/^["“]+|["”]+$/g, "").trim();
            hubs.push({ ref, type, name, aliases, about });
        }
        else if ((m = /^(?:THREAD|LINK)\s*:\s*(.+)$/i.exec(line))) {
            let body0 = m[1], where = "";
            const wm = /\|\s*where\s*:\s*("[^"]*"|“[^”]*”|[^|]*)/i.exec(body0);
            if (wm) {
                where = wm[1].trim().replace(/^["“'‘]+|["”'’]+$/g, "").trim();
                body0 = body0.slice(0, wm.index) + body0.slice(wm.index + wm[0].length);
            }
            const f = body0.split("|").map((x) => x.trim());
            if (f.length < 4) {
                skipped++;
                continue;
            }
            const ends = f[0].split(/\s*(?:--|—|–|<->|↔)\s*/);
            if (ends.length !== 2) {
                skipped++;
                continue;
            }
            const how = String(f[1] || "").toUpperCase().replace(/[^A-Z]/g, "");
            const kind = ["NEW", "SAME", "MORE", "CHANGED"].includes(how) ? how : null;
            let theirs = null, mineF = null, nowF = null;
            const f2 = [];
            const LBL = /^[\s*_"'“”‘’`]*(theirs?|their feelings?|mine[\s_,(-]*then\)?|mine[\s_,(-]*now\)?|my feelings?[\s_,(-]*then\)?|my feelings?[\s_,(-]*now\)?|mine|my feelings?|then|now)[\s*_"'“”‘’`]*:\s*/i;
            const parts = [];
            for (const x of f.slice(2)) {
                const sp = x.split(/(?=[;,]?\s*[*_"'“”‘’`]*\b(?:mine|my feelings?)(?:[\s_,(-]*(?:then|now)\)?)?[*_"'“”‘’`]*\s*:)|(?=[;,]\s*[*_"'“”‘’`]*\b(?:then|now|theirs?)[*_"'“”‘’`]*\s*:)/i);
                for (const y of sp)
                    parts.push(y.replace(/^[;,]\s*/, "").trim());
            }
            const clean = (t0) => String(t0 || "").replace(/^[\s*_"'“”‘’`]+|[\s*_"'“”‘’`]+$/g, "").trim();
            for (const x of parts) {
                const mm = LBL.exec(x);
                if (!mm) {
                    f2.push(x.replace(/^[*_]*note[*_]*\s*:\s*/i, ""));
                    continue;
                }
                const v = clean(x.slice(mm[0].length));
                const lab = mm[1].toLowerCase().replace(/[\s_-]+/g, " ");
                const fewWords = (t0) => !/[.!?]\s+\S/.test(t0) && t0.replace(/[.!]+$/, "").split(/[,;/]| and /).every((w0) => w0.trim().split(/\s+/).length <= 3);
                if ((lab === "then" || lab === "now") && !fewWords(v)) {
                    f2.push(x.replace(/^[\s*_]+/, ""));
                    continue;
                }
                const slot = /^thei/.test(lab) ? "theirs" : /now$/.test(lab) ? "now" : "then";
                if ((slot === "theirs" && theirs !== null) || (slot === "now" && nowF !== null) || (slot === "then" && mineF !== null)) {
                    f2.push(x.replace(/^[\s*_]+/, ""));
                    continue;
                }
                if (slot === "theirs")
                    theirs = v;
                else if (slot === "now")
                    nowF = v;
                else
                    mineF = v;
            }
            let labeled = theirs !== null || mineF !== null || nowF !== null;
            const plain = f2.filter((x) => !/because of\s*:/i.test(x));
            const fw = (t0) => !/[.!?]\s+\S/.test(t0) && String(t0).replace(/[.!]+$/, "").split(/[,;/]| and /).every((w0) => w0.trim().split(/\s+/).length <= 3);
            if (!labeled && plain.length >= 4 && fw(plain[1]) && fw(plain[2])) {
                theirs = clean(plain[0]);
                mineF = clean(plain[1]);
                nowF = clean(plain[2]);
                for (const x of plain.slice(0, 3))
                    f2.splice(f2.indexOf(x), 1);
                labeled = true;
            }
            else if (!labeled && plain.length >= 3) {
                theirs = clean(plain[0]);
                mineF = clean(plain[1]);
                f2.splice(f2.indexOf(plain[0]), 1);
                f2.splice(f2.indexOf(plain[1]), 1);
                labeled = true;
            }
            if (theirs !== null && mineF === null && nowF === null) {
                const pl = f2.filter((x) => !/because of\s*:/i.test(x));
                if (pl.length >= 3 && fw(pl[0]) && fw(pl[1])) {
                    mineF = clean(pl[0]);
                    nowF = clean(pl[1]);
                    f2.splice(f2.indexOf(pl[0]), 1);
                    f2.splice(f2.indexOf(pl[1]), 1);
                }
                else if (pl.length >= 2 && fw(pl[0])) {
                    mineF = clean(pl[0]);
                    f2.splice(f2.indexOf(pl[0]), 1);
                }
            }
            let runOn = "";
            const splitRun = (v) => { if (!v)
                return v; const mm = /^(.*?)(?:\s+[—–-]\s+|\.\s+|:\s+)(.{15,})$/.exec(v); if (mm && mm[1].split(/[,;/]| and /).every((w0) => w0.trim().split(/\s+/).length <= 3)) {
                runOn = runOn || mm[2];
                return mm[1];
            } return v; };
            mineF = splitRun(mineF);
            nowF = splitRun(nowF);
            const rest = f2.join(" | "), bc = rest.search(/because of\s*:/i);
            const body = (bc >= 0 ? rest.slice(0, bc) : rest).split("|").map((x) => x.trim()).filter(Boolean);
            const isNone = (t0) => { const z = String(t0 || "").toLowerCase().replace(/[^\p{L}\p{M} ]+/gu, " ").replace(/\s+/g, " ").trim(); return !z || /^(none|none clear|nothing|n a|na|no one|nobody|not clear|unclear)$/.test(z) || isNoneOther(z); };
            const words = (t0) => isNone(t0) ? [] : String(t0 || "").split(AND_SPLIT).map((x) => x.trim().toLowerCase().replace(/[.!]+$/, "")).filter((x) => x && !isNone(x) && x.split(/\s+/).length <= 3).slice(0, 3);
            const feel = labeled ? words(mineF) : words(body.length > 1 ? body[0] : "");
            const note = ((labeled ? body.join(" ") : body.length > 1 ? body.slice(1).join(" ") : body[0] || "") || runOn).replace(/^[\s*_]+|[\s*_]+$/g, "").replace(/^["“]+|["”]+$/g, "").trim();
            const theirsT = labeled && !isNone(theirs) ? String(theirs).slice(0, 160) : "";
            const nowSame = /^\W*(the |still the |still )?(same|unchanged)( as then)?\W*$/i.test(String(nowF || "")) || isSameOther(String(nowF || "").toLowerCase().normalize("NFC").replace(/[^\p{L}\p{M}\p{N} ]+/gu, " ").replace(/\s+/g, " ").trim()), feelNow = nowF && !nowSame ? words(nowF) : [];
            const nums = bc >= 0 ? [...new Set((rest.slice(bc).match(/\b\d+\b/g) || []).map(Number))].filter((n) => n >= 1 && n <= maxNum) : [];
            if (!kind) {
                skipped++;
                continue;
            }
            threads.push({ a: ends[0].trim(), b: ends[1].trim(), kind, feel, note, nums, ...(where ? { where } : {}), ...(theirsT ? { theirs: theirsT } : {}), ...(labeled ? { labeled: true } : {}), ...(nowF !== null ? (nowSame ? { nowSame: true } : { feelNow }) : {}) });
        }
        else if ((m = /^GROUP\s*:\s*(.+?)\s+includes\s+(.+)$/i.exec(line)))
            groups.push({ group: m[1].trim(), member: m[2].trim() });
        else if (/^(HUB|THREAD|LINK|GROUP)\s*:/i.test(line))
            skipped++;
    }
    return { nothing: false, hubs, threads, groups, skipped };
}
export const TAPE_SYSTEM = "You read dated excerpts from old conversations and note only what the words in each one show. You are not part of these conversations.";
const isNoneW = (t0) => { const raw = String(t0 || ""), z = raw.toLowerCase().replace(/[^\p{L}\p{M} ]+/gu, " ").replace(/\s+/g, " ").trim(); return !z || /^(none|no|not|nothing|n a|na|unclear|nobody|same as above)\b/.test(z) || isNoneOther(z) || /^\s*[<(\[]/.test(raw) || /leave blank|between the bars|your (own )?words/.test(z); };
const wordsOf = (t0) => isNoneW(t0) ? [] : String(t0 || "").split(AND_SPLIT).map((x) => x.trim().toLowerCase().replace(/^[\s*_"'“”‘’`]+|[\s*_"'“”‘’`.!]+$/g, "")).filter((x) => x && !isNoneW(x) && !/[=:<>()[\]|]/.test(x) && x.split(/\s+/).length <= 3).slice(0, 3);
export const _test = { isNoneW, wordsOf, applyHer, refreshFeel, norm, nameIn };
export function parseTape(answer, n) {
    const a = foldWidth(answer).replace(/<think>[\s\S]*?<\/think>/gi, ""), out = {};
    for (let line of a.split(/\r?\n/)) {
        line = line.replace(/^[\s*#>\-•]*\**/, "").replace(/\*\*/g, "").trim();
        const m = /^(?:EXCERPT|MOMENT)\s*#?\s*(\d+)\s*[|:.\-–—]\s*(.*)$/i.exec(line);
        if (!m)
            continue;
        const k = Number(m[1]);
        if (!(k >= 1 && k <= n) || out[k])
            continue;
        let theirs = [], then = [];
        for (const f of m[2].split("|").map((x) => x.trim())) {
            let mm;
            if ((mm = /^[*_"'`]*theirs?[*_"'`]*\s*:\s*(.*)$/i.exec(f))) {
                if (!isNoneW(mm[1]))
                    for (const part of mm[1].split(/;|,(?=\s*[^,=;:]{1,40}\s*[=:])/)) {
                        const pm = /^\s*([^=:]+?)\s*[=:]\s*(.+)$/.exec(part);
                        if (pm && !isNoneW(pm[2])) {
                            const ws = wordsOf(pm[2]);
                            const who = pm[1].replace(/\s*\([^)]*\)\s*/g, " ").replace(/^[\s*_"'`<]+|[\s*_"'`>]+$/g, "").trim().slice(0, 40);
                            if (ws.length && who && !isNoneW(who))
                                theirs.push({ who, words: ws });
                        }
                    }
            }
            else if ((mm = /^[*_"'`]*hers?[\s_-]*then[*_"'`]*\s*:\s*(.*)$/i.exec(f)))
                then = wordsOf(mm[1]);
        }
        out[k] = { theirs, then };
    }
    return out;
}
const nowWords = (k) => String(k).replace(/\bthreads\b/g, "links").replace(/\bthread\b/g, "link").replace(/\bTHREAD\b/g, "LINK");
const mergedWords = (o) => { const out = {}; for (const [k, v] of Object.entries(o || {}))
    out[nowWords(k)] = (out[nowWords(k)] || 0) + v; return out; };
export const NAME_MAX = 100;
export const RENAME_TEST = "C", RENAME_FROM = null;
const STOPW = STOP_ALL;
export function contentWords(t0, owners = []) {
    let t = dropPossessive(foldWidth(t0).toLowerCase().replace(/[’‘]/g, "'").trim().replace(/^(the|my|our)\s+/, ""));
    for (const o of owners) {
        const o1 = String(o || "").toLowerCase();
        if (o1 && t.startsWith(o1 + "'s ")) {
            t = t.slice(o1.length + 3);
            break;
        }
    }
    return new Set(wordsIn(t.normalize("NFC")).map((w) => w.replace(/'s$/, "")).filter((w) => w && !STOPW.has(w)).map((w) => (w.length >= 4 && /s$/.test(w) && !/ss$/.test(w) ? w.slice(0, -1) : w)));
}
export function renameScore(a, b, owners = []) {
    const A = contentWords(a, owners), B = contentWords(b, owners), shared = [...A].filter((x) => B.has(x)).length, union = new Set([...A, ...B]).size, shorter = Math.min(A.size, B.size) || 1;
    return { shared, jaccard: union ? shared / union : 0, ofShorter: shared / shorter, passA: shared >= 2 && shared / shorter >= 0.5, passB: union ? shared / union >= 0.6 : false, passC: shared >= 2 && (union ? shared / union >= 0.5 : false) };
}
export const CUT_MIN = 35;
const tidy = (t) => { let x = t.replace(/[\s,;:–—\-(]+$/, "").trim(), prev; do {
    prev = x;
    x = x.replace(/\s+(and|or|but|the|a|an|of|with|to|in|on|at|for|from|about|that|which|who|where|my|his|her|our|their)$/i, "").replace(/[\s,;:–—-]+$/, "").trim();
} while (x !== prev); if ((x.match(/\(/g) || []).length > (x.match(/\)/g) || []).length) {
    const cut = x.slice(0, x.lastIndexOf("(")).trim();
    x = cut.length >= 15 ? cut : x.slice(0, x.lastIndexOf("(")) + x.slice(x.lastIndexOf("(") + 1);
} return x.replace(/\s+/g, " ").trim(); };
export function shortNames(s, max = NAME_MAX) {
    s = String(s).replace(/\s+/g, " ").trim();
    if (Array.from(s).length <= max)
        return [s];
    const out = [], add = (t) => { t = tidy(t); if (Array.from(t).length >= 3 && Array.from(t).length <= max && !out.includes(t))
        out.push(t); };
    const re = /( with | that | which | where | who | from | about |, | \(| — | – | - |: |; |\. )/gi;
    let m;
    while ((m = re.exec(s)))
        if (Array.from(s.slice(0, m.index)).length >= CUT_MIN && Array.from(s.slice(0, m.index)).length <= max)
            add(s.slice(0, m.index));
    const cps = Array.from(s), head = cps.slice(0, max + 1).join("");
    if (/\s/.test(head)) {
        const w0 = head.replace(/\s+\S*$/, "");
        if (Array.from(w0).length >= CUT_MIN)
            add(w0);
    }
    add(cps.slice(0, max).join(""));
    return out.length ? out : [cps.slice(0, max).join("")];
}
export const shortName = (s, max = NAME_MAX) => shortNames(s, max)[0];
export function applyEvent(w, ev, { selfNames = [], known = [], textOf = null, herName = "", herNames = [], marked = null } = {}) {
    const self = new Set(selfNames.map(norm).filter(Boolean).concat(["me", "myself", "i", "us", "we", "you", "him", ...selfNames.slice(0, 1).map(norm).filter(Boolean).flatMap((n) => [`${n} and me`, `me and ${n}`]), "us two", "the companion", "companion", "she", "her", "herself"], RELATIONSHIP_WORDS.map(norm), selfWords().map(norm), selfNames.slice(0, 1).map(norm).filter(Boolean).flatMap((n) => selfWithWords(n).map(norm))));
    const byId = new Map(w.hubs.map((h) => [h.id, h]));
    const ids = ev.ids || (ev.ids = {});
    const byIdentity = (was) => { const n = norm(was.name); return w.hubs.find((h) => h.type === was.type && (norm(h.name) === n || (h.aliases || []).some((x) => norm(x) === n))) || (canon(was.name, was.type) ? knownHub(canon(was.name, was.type)) : null); };
    const findHub = (ref, type = null) => {
        const r = String(ref || "").trim(), id = /^H\d+$/i.test(r) ? r.toUpperCase() : null;
        if (id) {
            if (ids[id]) {
                const h = byIdentity(ids[id]);
                if (!h) {
                    w.stats.lostRefs = (w.stats.lostRefs || 0) + 1;
                    return null;
                }
                return h;
            }
            const h = byId.get(id) || null;
            if (h && !ids[id])
                ids[id] = { type: h.type, name: h.name };
            return h;
        }
        const n = norm(r);
        if (!n)
            return null;
        return w.hubs.find((h) => (!type || h.type === type) && (norm(h.name) === n || (h.aliases || []).some((x) => norm(x) === n))) || null;
    };
    const takenElsewhere = (al, h) => { const n = norm(al); return w.hubs.some((o) => o !== h && [o.name, ...(o.aliases || [])].some((x) => norm(x) === n)); };
    const late = !!(w.upTo && ev.from < w.upTo);
    const later = (a, b) => (!a ? b : !b ? a : a > b ? a : b), sooner = (a, b) => (!a ? b : !b ? a : a < b ? a : b);
    const touch = (h, refs) => { h.seen = [...new Set([...(h.seen || []), ev.from])]; h.last = later(h.last, ev.to); h.first = sooner(h.first, ev.from); h.refl = [...new Set([...(h.refl || []), ...ev.refl])].slice(-60); h.cites = [...(h.cites || []), ...refs].slice(-24); };
    const cited = (nums) => nums.map((n) => ev.moments[n - 1]).filter(Boolean);
    let made = 0, rejected = 0, threadsDone = 0, updated = 0, unclear = 0, longNames = 0;
    const no = (why) => { rejected++; w.stats.refused = w.stats.refused || {}; w.stats.refused[why] = (w.stats.refused[why] || 0) + 1; };
    for (let i = 0; i < (ev.skipped || 0); i++)
        no("a line that couldn't be read");
    if (ev.tape)
        for (const v of Object.values(ev.tape)) {
            if (v.missing)
                w.stats.tapeMissing = (w.stats.tapeMissing || 0) + 1;
            if (v.thenDropped)
                w.stats.thenUnspoken = (w.stats.thenUnspoken || 0) + 1;
        }
    if (ev.tape && Array.isArray(ev.moments)) {
        w.pieceThen ||= {};
        ev.moments.forEach((c, i) => { const v = ev.tape[i + 1]; if (c && v)
            w.pieceThen[ckey(c)] = { then: v.then || [], day: v.day || ev.from, ...(v.missing ? { missing: true } : {}) }; });
    }
    const MARKNAME0 = /^\[?(H\d+)\]?(?:\s*[:\-–—]\s*|\s+|(?=[(\[]))(.*?)\s*$/i;
    const unwrap = (t0) => { const m0 = /^[(\[]\s*([^()\[\]]*?)\s*[)\]]?$/.exec(t0); return m0 ? m0[1] : t0; };
    const MARKNAME = { exec: (t0) => { const m0 = MARKNAME0.exec(t0); return m0 ? [m0[0], m0[1], unwrap(m0[2])] : null; } };
    const startH = w.nextH;
    const local = new Map(), localExact = new Map();
    const exact = (s) => joinNoSpace(foldWidth(s).toLowerCase().normalize("NFC").replace(/[’‘]/g, "'").replace(/[^\p{L}\p{M}\p{N}' ]+/gu, " ").replace(/\s+/g, " ").trim());
    const remember = (name, h) => { local.set(norm(name), h); localExact.set(exact(name), h); };
    const knownList = (known || []).filter((k) => k?.name && TYPES.includes(k.type));
    const canon = (name, type = null) => { const n = normK(name); return n ? knownList.find((k) => (!type || k.type === type) && [k.name, ...(k.aliases || [])].some((a) => normK(a) === n)) || null : null; };
    const sharedFirst = (name) => { const n = normK(name); return !!n && !/\s/.test(n) && knownList.filter((k) => (k.type === "person" || k.type === "pet") && normK(k.name).split(" ")[0] === n).length >= 2 && !canon(name); };
    const sharedNm = new Set(knownList.filter((k) => k.type === "thing").map((k) => /^the (.+) character$/i.exec(String(k.name).trim())).filter(Boolean).map((m) => normK(m[1])));
    const CHARW = "characters?|avatars?|templates?|presets?|default|bots?|other users?(?:'s|')?|someone else's|everyone's|public|commercial";
    const CHAR0 = new RegExp(`(^|[^\\p{L}\\p{M}\\p{N}'])(${CHARW})($|[^\\p{L}\\p{M}\\p{N}'])`, "iu");
    const ARCH0 = new RegExp(`(^|[^\\p{L}\\p{M}\\p{N}'])(${CHARW}|other|different|second|someone's|anyone's|people's)($|[^\\p{L}\\p{M}\\p{N}'])`, "iu");
    const CHAR = { test: (t) => CHAR0.test(t) || hasWordFrom(t, CHARACTER_WORDS) };
    const ARCH = { test: (t) => ARCH0.test(t) || hasWordFrom(t, CHARACTER_WORDS.concat(OTHER_WORDS)) };
    const sharedK = (k) => !!k && (k.type === "person" || k.type === "pet") && sharedNm.has(normK(k.name));
    const sharedH = (h) => !!h && (h.type === "person" || h.type === "pet") && sharedNm.has(normK(h.name));
    const ARTICLE = /^(the|a|an)\s/i;
    const keptApart = (name, why) => { w.stats.sharedApart = [...(w.stats.sharedApart || []), { name: String(name || "").slice(0, 80), why, from: String(ev.from || "").slice(0, 10) }].slice(-60); };
    const person0 = norm(selfNames[0] || ""), herPoss = [herName, ...herNames].map(norm).filter(Boolean);
    const possOf = (s) => {
        const low = String(s || "").toLowerCase().replace(/[\u2019\u2018]/g, "'").replace(/\s+/g, " ").trim(), pm = /^(.+?)'s\s+(.+)$/.exec(low);
        if (pm && person0 && norm(pm[1]) === person0) {
            const stem = norm(pm[2]);
            return stem.split(" ").length >= 2 ? { owner: "him", stem } : null;
        }
        if (pm && herPoss.includes(norm(pm[1])))
            return { owner: "her", stem: norm(pm[2]) };
        return { owner: /^my\s/.test(low) ? "her" : "", stem: norm(low) };
    };
    const membersFromNames = (g, names) => {
        if (!g || g.type !== "group")
            return;
        for (const al of names || []) {
            const k = canon(al), mHub = k && k.type !== "group" ? knownHub(k) : w.hubs.find((o) => o !== g && o.type !== "group" && [o.name, ...(o.aliases || [])].some((x) => norm(x) === norm(al)));
            if (mHub && !(g.members || []).includes(mHub.id)) {
                g.members = [...(g.members || []), mHub.id];
                updated++;
            }
        }
    };
    const knownPrefix = (name) => {
        const full = String(name || "").replace(/\s+/g, " ").trim(), low = full.toLowerCase(), SEP = /^(?:\s*[,:(\[]|\s+[—–-]\s+)/;
        const pp2 = knownList.filter((k) => k.type === "person" || k.type === "pet");
        const hits = [];
        for (const k of pp2)
            for (const a of [k.name, ...(k.aliases || [])]) {
                const al = String(a || "").trim().toLowerCase();
                if (al && low.startsWith(al) && SEP.test(full.slice(al.length)))
                    hits.push({ k, len: al.length });
            }
        if (!hits.length)
            return null;
        const top = Math.max(...hits.map((x) => x.len)), fits = [...new Set(hits.filter((x) => x.len === top).map((x) => x.k))];
        if (fits.length !== 1)
            return null;
        const rest = low.slice(top), wordIn = (a) => { const al = String(a || "").trim().toLowerCase(); return al.length > 1 && new RegExp(`(^|[^\\p{L}\\p{N}])${al.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "u").test(rest); };
        if (pp2.some((k) => k !== fits[0] && ![k.name, ...(k.aliases || [])].some((a) => self.has(norm(a))) && [k.name, ...(k.aliases || [])].some(wordIn)))
            return null;
        return fits[0];
    };
    const OPENER = /^(?:my|our|his|her|their|the|a|an)$/i, BLOCKED = new Set(["of", "from", "to", "with", "for", "by", "about", "like", "and", "&", "&amp;", "or", "vs", "vs.", "other", "different", "second"]);
    const ownNames = new Set([...selfNames, herName, ...herNames].map(norm).filter(Boolean));
    const q = (s) => String(s || "").replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
    const knownSuffix = (name, type) => {
        if (type !== "person" && type !== "pet")
            return null;
        let full = q(name);
        const cut = full.search(/\s*[,:(\[]|\s+(?:[—–-]|--)\s+/);
        if (cut > 0)
            full = full.slice(0, cut).trim();
        const hits = [];
        for (const k of knownList.filter((x) => x.type === type))
            for (const a of [k.name, ...(k.aliases || [])]) {
                const al = q(a);
                if (!al || al.length >= full.length)
                    continue;
                const tail = full.slice(full.length - al.length);
                if (tail.toLowerCase() === al.toLowerCase() && full[full.length - al.length - 1] === " ")
                    hits.push({ k, len: al.length, cap: /^\p{Lu}/u.test(tail) });
            }
        if (!hits.some((x) => x.cap))
            return null;
        const top = Math.max(...hits.filter((x) => x.cap).map((x) => x.len)), fits = [...new Set(hits.filter((x) => x.cap && x.len === top).map((x) => x.k))];
        if (fits.length !== 1)
            return null;
        if (hits.some((x) => x.k !== fits[0] && x.len > top))
            return null;
        const before = full.slice(0, full.length - top).trim(), words = before.split(" ");
        if (words.length < 2 || words.length > 5)
            return null;
        const first = words[0], poss = /^(.+?)['’]s$/i.exec(first);
        if (!OPENER.test(first) && !(poss && ownNames.has(norm(poss[1]))))
            return null;
        if (sharedK(fits[0]) && /^(his|her|their|a|an)$/i.test(first))
            return null;
        const mid = words.slice(1);
        if (!/^\p{Ll}/u.test(mid[mid.length - 1]))
            return null;
        if (mid.some((x) => BLOCKED.has(x.toLowerCase()) || /['’]s$|s['’]$/i.test(x)))
            return null;
        const low = before.toLowerCase(), wordIn = (a) => { const al = String(a || "").trim().toLowerCase(); return al.length > 1 && new RegExp(`(^|[^\\p{L}\\p{N}])${al.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "u").test(low); };
        if (knownList.some((k) => (k.type === "person" || k.type === "pet") && k !== fits[0] && ![k.name, ...(k.aliases || [])].some((a) => self.has(norm(a))) && [k.name, ...(k.aliases || [])].some(wordIn)))
            return null;
        const p0 = knownPrefix(name);
        if (p0 && p0 !== fits[0])
            return null;
        return fits[0];
    };
    const otherKnown = (al, h) => { const k = canon(al); return !!k && normK(k.name) !== normK(h.name); };
    const knownHub = (k) => {
        let h = w.hubs.find((x) => x.type === k.type && norm(x.name) === norm(k.name));
        if (!h) {
            h = { id: "H" + w.nextH++, type: k.type, name: k.name, known: true, aliases: (k.aliases || []).filter((a) => !takenElsewhere(a, null)), members: [], first: ev.from, last: ev.to, seen: [ev.from], about: k.about ? [{ text: k.about, from: ev.from, until: null, refl: [], listed: true }] : [], refl: [], cites: [], vec: null };
            w.hubs.push(h);
            byId.set(h.id, h);
            made++;
        }
        else
            for (const a of k.aliases || [])
                if (!(h.aliases || []).some((x) => norm(x) === norm(a)) && !takenElsewhere(a, h))
                    (h.aliases ||= []).push(a);
        h.known = true;
        return h;
    };
    const setAbout = (h, text, onPurpose = false) => {
        text = String(text || "").trim();
        if (text.length < 8 || text.length > 300)
            return;
        h.about ||= [];
        const cur = h.about.find((a) => a.until === null);
        const fromList = h.known || knownList.some((k) => k.type === h.type && normK(k.name) === normK(h.name));
        if (cur && (norm(cur.text) === norm(text) || cur.listed || fromList || !onPurpose || late))
            return;
        updated++;
        if (cur)
            cur.until = ev.from;
        h.about.push({ text, from: ev.from, until: null, refl: ev.refl });
    };
    const batchMarks = new Map();
    for (const x of ev.hubs || []) {
        {
            const mn = MARKNAME.exec(String(x.ref || "").trim());
            if (mn && mn[2]) {
                x.ref = mn[1].toUpperCase();
                x.refName = mn[2];
                if (!String(x.name || "").trim())
                    x.name = mn[2];
            }
        }
        if (/^new$/i.test(String(x.ref || "").trim()) && !x.mark0 && Array.isArray(marked)) {
            const day = String(ev.from || "").slice(0, 10), m0 = marked.filter((k) => k && k.from === day && norm(k.name) === norm(x.name));
            if (m0.length === 1)
                x.mark0 = m0[0].mark;
        }
        let isId = /^H\d+$/i.test(String(x.ref || "").trim()), localMark = /^new$/i.test(String(x.ref || "").trim()) && /^H\d+$/i.test(String(x.mark0 || "")) ? String(x.mark0).toUpperCase() : null;
        if (isId) {
            const mk = String(x.ref).trim().toUpperCase(), num = Number(mk.slice(1)), nm0 = String(x.name || "").trim();
            const fine = TYPES.includes(x.type) && nm0 && !/^\[?H\d+\]?$/i.test(nm0), was = batchMarks.has(mk) ? batchMarks.get(mk) : undefined;
            if (was !== undefined) {
                if (!was || !(was.type === x.type && norm(was.name) === norm(nm0))) {
                    if (!fine) {
                        no("a dot mark that doesn't exist");
                        continue;
                    }
                    localMark = mk;
                    x.ref = "NEW";
                    x.mark0 = mk;
                    isId = false;
                }
                else
                    x.ref = was.id;
            }
            else if (!byId.get(mk) && !ids[mk] && num >= w.nextH && fine) {
                localMark = mk;
                x.ref = "NEW";
                x.mark0 = mk;
                isId = false;
            }
        }
        const declare = (h) => { if (!localMark || !h)
            return; const had = batchMarks.get(localMark); batchMarks.set(localMark, had === undefined || had === h ? h : null); if (had === undefined) {
            const k2 = (w.stats.markedNew ||= []);
            if (k2.length < 60)
                k2.push({ mark: localMark, name: h.name, from: String(ev.from || "").slice(0, 10) });
        } };
        const pp = (t) => t === "person" || t === "pet";
        const direct = !isId && pp(x.type) ? (canon(x.name) || (!/^new$/i.test(x.ref || "") ? canon(x.ref) : null)) : null;
        const isNew = !x.ref || /^new$/i.test(x.ref) || !findHub(x.ref);
        let folded = !isId && isNew && pp(x.type) && !direct ? (knownPrefix(x.name) || knownSuffix(x.name, x.type)) : null;
        if (folded && ARCH.test(String(x.name || ""))) {
            keptApart(x.name, "described as a character or someone else's");
            folded = null;
        }
        const own0 = direct || folded, own = own0 && pp(own0.type) ? own0 : null;
        if (own && folded === own && x.name) {
            const fo = (w.stats.folds ||= {});
            if (Object.keys(fo).length < 200 || fo[x.name])
                fo[x.name] = own.name;
        }
        const k = own && own.type !== "group" ? own : !isId && x.type ? (canon(x.name, x.type) || canon(x.ref, x.type) || (x.aliases || []).map((a) => canon(a, x.type)).find(Boolean)) : null;
        if (k && sharedK(k) && x.type === k.type) {
            if (ARTICLE.test(String(x.name || "").trim())) {
                keptApart(x.name, `"the/a/an ${k.name}" isn't theirs`);
                no("a shared name that isn't theirs");
                continue;
            }
            if (CHAR.test(String(x.about || ""))) {
                keptApart(x.name, "described as the character or someone else's");
                no("a shared name that isn't theirs");
                continue;
            }
        }
        if (k) {
            const h = knownHub(k);
            for (const al of [x.name, ...(x.aliases || [])])
                if (al && (al.length <= NAME_MAX || al === x.name) && norm(al) !== norm(h.name) && !(h.aliases || []).some((y) => norm(y) === norm(al)) && !self.has(norm(al)) && !takenElsewhere(al, h) && !otherKnown(al, h) && !sharedFirst(al)) {
                    (h.aliases ||= []).push(al);
                    updated++;
                }
            setAbout(h, x.about);
            remember(x.name || x.ref, h);
            declare(h);
            continue;
        }
        const xt = TYPES.includes(x.type) ? x.type : null;
        if (x.ref && !/^new$/i.test(x.ref)) {
            const h = findHub(x.ref, isId ? null : xt);
            if (!h && isId) {
                w.stats.ghostDots = [...(w.stats.ghostDots || []), { mark: String(x.ref).trim().toUpperCase(), name: String(x.name || (x.aliases || [])[0] || "").slice(0, 80), type: TYPES.includes(x.type) ? x.type : "", from: String(ev.from || "").slice(0, 10) }].slice(-60);
                no("a dot mark that doesn't exist");
                continue;
            }
            if (!h && xt) {
                x.name = x.name || x.ref;
                x.ref = "NEW";
            }
            else if (!h) {
                no("a dot without a known kind");
                continue;
            }
        }
        if (!/^new$/i.test(x.ref) && x.ref) {
            const h = findHub(x.ref, isId ? null : xt);
            if (isId && h && !(Number(String(h.id).slice(1)) >= startH)) {
                const said = [...new Set([x.name, x.refName].map((t) => String(t || "").trim()).filter(Boolean))];
                const P0 = (t) => possOf(t), meets = (P, Q) => !!P && !!Q && Q.stem === P.stem && (P.owner === "him" || Q.owner === "him") && !(P.owner && Q.owner && P.owner !== Q.owner);
                const isH = (t) => [h.name, ...(h.aliases || [])].some((a) => norm(a) === norm(t)) || (!!h.known && !!canon(t) && canon(t) === canon(h.name))
                    || (h.type !== "person" && h.type !== "pet" && !!P0(t) && P0(t).stem.split(" ").length >= 2 && [h.name, ...(h.aliases || [])].some((a) => meets(P0(t), P0(a))));
                if (!said.length)
                    w.stats.updateNoName = (w.stats.updateNoName || 0) + 1;
                else if (!said.every(isH)) {
                    const owners = [selfNames[0]].filter(Boolean), bad = said.filter((t) => !isH(t));
                    const words = (t) => contentWords(t, owners), BLOCK = { test: (t) => /\b(other|different|second|another|new)\b/i.test(t) || hasWordFrom(t, OTHER_WORDS.concat(NEW_WORDS)) };
                    const knownIn = (t) => knownList.filter((k) => (k.type === "person" || k.type === "pet") && [k.name, ...(k.aliases || [])].some((a) => a && (hasNoSpaceScript(t) ? foundAt(" " + foldWidth(t).toLowerCase() + " ", String(a).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) : new RegExp(`(^|[^\\p{L}\\p{M}\\p{N}_])${String(a).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{M}\\p{N}_])`, "u").test(String(t).toLowerCase()))));
                    const renameOK = (t) => {
                        if (RENAME_FROM !== null && !(Number(ev.t) >= RENAME_FROM))
                            return null;
                        if (!xt || xt !== h.type || ((h.type === "person" || h.type === "pet") && (h.known || canon(h.name))))
                            return null;
                        if (w.hubs.some((o) => o !== h && [o.name, ...(o.aliases || [])].some((a) => norm(a) === norm(t))) || (localExact.get(exact(t)) && localExact.get(exact(t)) !== h))
                            return null;
                        const dn = [h.name, ...(h.aliases || [])];
                        if (knownIn(t).some((k) => !dn.some((n) => knownIn(n).includes(k))))
                            return null;
                        if (BLOCK.test(t) || dn.some((n) => BLOCK.test(n) && !BLOCK.test(t)))
                            return null;
                        const best = dn.map((n) => ({ n, ...renameScore(n, t, owners) })).sort((a, b) => b.jaccard - a.jaccard || b.shared - a.shared)[0];
                        const ok = RENAME_TEST === "A" ? best.passA : RENAME_TEST === "B" ? best.passB : RENAME_TEST === "C" ? best.passC : best.passA && best.passB;
                        return ok ? best : null;
                    };
                    const fits = bad.map((t) => ({ t, r: renameOK(t) }));
                    if (fits.length && fits.every((f) => f.r)) {
                        for (const f of fits)
                            if (f.t.length <= NAME_MAX && !self.has(norm(f.t)) && !(h.aliases || []).some((y) => norm(y) === norm(f.t))) {
                                (h.aliases ||= []).push(f.t);
                                updated++;
                            }
                        w.stats.renameKept = [...(w.stats.renameKept || []), ...fits.map((f) => ({ mark: String(h.id), markName: String(h.name).slice(0, 80), said: f.t.slice(0, 80), shared: f.r.shared, jaccard: Math.round(f.r.jaccard * 100) / 100, from: String(ev.from || "").slice(0, 10) }))].slice(-60);
                    }
                    else {
                        const why = "an update line whose name isn't its mark's dot";
                        no(why);
                        w.stats.updateMiss = [...(w.stats.updateMiss || []), { mark: String(h.id), markName: String(h.name).slice(0, 80), said: said.join(" / ").slice(0, 80), how: why, from: String(ev.from || "").slice(0, 10) }].slice(-60);
                        continue;
                    }
                }
            }
            membersFromNames(h, x.aliases);
            for (const al of x.aliases || [])
                if (al.length <= NAME_MAX && !self.has(norm(al)) && !findHub(al, h.type) && !takenElsewhere(al, h) && !otherKnown(al, h) && !sharedFirst(al)) {
                    (h.aliases ||= []).push(al);
                    updated++;
                }
            setAbout(h, x.about, isId);
            remember(h.name, h);
            continue;
        }
        if (!TYPES.includes(x.type)) {
            no("a dot of a kind that isn't on the list");
            continue;
        }
        if (String(x.name || "").length < 2) {
            no("a dot name too short");
            continue;
        }
        const fullName = String(x.name).trim(), isLong = Array.from(fullName).length > NAME_MAX;
        let nm = x.name;
        if (isLong) {
            const same = findHub(fullName, x.type);
            if (same)
                nm = same.name;
            else {
                const free = (c) => !w.hubs.some((o) => [o.name, ...(o.aliases || [])].some((y) => norm(y) === norm(c)));
                const cs = shortNames(fullName);
                nm = cs.find(free) || `${cs[0]} (${label(ev.from)})`;
            }
        }
        const als = nm !== x.name ? [fullName, ...(x.aliases || [])] : x.aliases || [];
        if (self.has(norm(nm))) {
            no("a dot for Ned, herself or 'us' (never dots)");
            continue;
        }
        if (sharedFirst(nm)) {
            no("a name that fits more than one person");
            unclear++;
            continue;
        }
        if ((x.type === "person" || x.type === "pet") && sharedNm.has(normK(nm))) {
            keptApart(nm, "a shared name with no clue which one");
            no("a name that fits more than one person");
            unclear++;
            continue;
        }
        if (isLong)
            longNames++;
        let h = findHub(nm, x.type);
        if (h && x.type === "stretch" && h.last && daysBetween(h.last, ev.from) > 21)
            h = null;
        if (!h) {
            const name = findHub(nm, x.type) ? `${nm} (${label(ev.from)})` : nm;
            h = { id: "H" + w.nextH++, type: x.type, name, aliases: als.filter((al) => (al.length <= NAME_MAX || al === fullName) && !self.has(norm(al)) && !takenElsewhere(al, null) && !canon(al) && !sharedFirst(al) && norm(al) !== norm(nm)), members: [], first: ev.from, last: ev.to, seen: [ev.from], about: [], refl: [], cites: [], vec: ev.vecs?.[fullName] || null };
            w.hubs.push(h);
            byId.set(h.id, h);
            made++;
        }
        if (fullName !== nm && !(h.aliases || []).includes(fullName) && !takenElsewhere(fullName, h))
            (h.aliases ||= []).push(fullName);
        membersFromNames(h, als);
        if (!h.about?.length)
            setAbout(h, x.about, true);
        else
            setAbout(h, x.about);
        remember(nm, h);
        if (fullName !== nm)
            remember(fullName, h);
        declare(h);
    }
    const NAMEMARK = /^(.*?\S)\s*[(\[]\s*(H\d+)\s*[)\]]\s*$/i;
    const nameMarkMiss = new Map();
    let guessUse = null;
    const guessedTwice = (R) => {
        if (!guessUse) {
            guessUse = new Map();
            for (const t of ev.threads || [])
                for (const e0 of [t.a, t.b]) {
                    const s1 = String(e0 || "").trim(), a = MARKNAME.exec(s1), b = a && a[2] ? null : NAMEMARK.exec(s1), p = a && a[2] ? [a[1], a[2]] : b ? [b[2], b[1]] : null;
                    if (!p)
                        continue;
                    const R1 = p[0].toUpperCase();
                    if (batchMarks.has(R1) || findHub(R1))
                        continue;
                    if (!guessUse.has(R1))
                        guessUse.set(R1, new Set());
                    guessUse.get(R1).add(norm(p[1]));
                }
        }
        return (guessUse.get(R) || new Set()).size > 1;
    };
    const hubFor = (ref) => {
        const s0 = String(ref || "").trim();
        const u0 = unclear, asIs = hubFor0(s0);
        if (asIs)
            return asIs;
        const mn = MARKNAME.exec(s0), nm = mn && mn[2] ? null : NAMEMARK.exec(s0);
        const P = mn && mn[2] ? { name: mn[2], mark: mn[1], form: "mark first" } : nm ? { name: nm[1], mark: nm[2], form: "name (mark)" } : null;
        if (!P)
            return asIs;
        unclear = u0;
        const u1 = unclear, byName = hubFor0(P.name), nameUnclear = unclear > u1;
        unclear = u0;
        const R = P.mark.toUpperCase(), byMark = batchMarks.has(R) ? batchMarks.get(R) : findHub(R);
        if (byName && byMark && byName === byMark)
            return byName;
        const fresh = !!byName && Number(String(byName.id).slice(1)) >= startH;
        if (fresh && !byMark && !guessedTwice(R)) {
            w.stats.guessedMarks = [...(w.stats.guessedMarks || []), { end: s0.slice(0, 80), dot: String(byName.name).slice(0, 80), markName: "" }].slice(-60);
            w.stats.guessedMarkCount = (w.stats.guessedMarkCount || 0) + 1;
            return byName;
        }
        nameMarkMiss.set(s0, { mark: R, markName: byMark ? byMark.name : "", namePart: byName ? byName.name : "",
            how: `${P.form}: ` + (fresh && byMark ? "the name is a new dot from this answer; its guessed mark is another dot" : fresh ? "the same guessed mark is beside two different new names" : !byMark ? "the mark doesn't exist" : byName ? "the name and the mark are different dots" : nameUnclear ? "the name fits two dots" : "the name matches no dot") });
        return null;
    };
    const hubFor0 = (ref) => {
        const r = String(ref || "").trim().replace(/^\[(H\d+)\]$/i, "$1");
        if (/^H\d+$/i.test(r)) {
            const R = r.toUpperCase();
            if (batchMarks.has(R)) {
                const b = batchMarks.get(R);
                if (!b)
                    unclear++;
                return b;
            }
            return findHub(r);
        }
        const n = norm(r), e = exact(r), names = (h) => [h.name, ...(h.aliases || [])];
        const le = localExact.get(e);
        if (le)
            return le;
        if (!n || sharedFirst(r)) {
            if (n)
                unclear++;
            return null;
        }
        const ex = w.hubs.filter((h) => names(h).some((x) => exact(x) === e));
        if (ex.length === 1) {
            const l = local.get(n);
            if (l && l !== ex[0]) {
                unclear++;
                return null;
            }
            return ex[0];
        }
        if (ex.length > 1) {
            unclear++;
            return null;
        }
        const kx = knownList.find((k) => [k.name, ...(k.aliases || [])].some((a) => exact(a) === e));
        if (kx)
            return knownHub(kx);
        const art = ARTICLE.test(e);
        const l = local.get(n);
        if (l && !(art && sharedH(l)))
            return l;
        const lead = /^(the|my|our)\s/.test(e) || dropPossessive(e) !== e, listed = (h) => (h.type === "person" || h.type === "pet") && (h.known || knownList.some((k) => k.type === h.type && normK(k.name) === normK(h.name)));
        for (const same of [(x) => exact(x) === e, (x) => norm(x) === n]) {
            const all = w.hubs.filter((h) => names(h).some(same) && !(lead && listed(h) && !names(h).some((x) => exact(x) === e) && norm(h.name) !== n) && !(art && sharedH(h) && !names(h).some((x) => exact(x) === e)));
            if (all.length === 1)
                return all[0];
            if (all.length > 1) {
                unclear++;
                return null;
            }
        }
        {
            const P = possOf(r);
            if (P && P.stem.split(" ").length >= 2) {
                const meets = (Q) => !!Q && Q.stem === P.stem && (P.owner === "him" || Q.owner === "him") && !(P.owner && Q.owner && P.owner !== Q.owner);
                const fits = w.hubs.filter((h) => h.type !== "person" && h.type !== "pet" && names(h).some((x) => meets(possOf(x))));
                if (fits.length === 1) {
                    w.stats.possMatches = [...(w.stats.possMatches || []), { end: String(ref).slice(0, 80), dot: String(fits[0].name).slice(0, 80) }].slice(-60);
                    return fits[0];
                }
                if (fits.length > 1) {
                    unclear++;
                    return null;
                }
            }
        }
        const k = knownList.find((k) => [k.name, ...(k.aliases || [])].some((a) => exact(a) === e));
        return k ? knownHub(k) : null;
    };
    for (const g of ev.groups || []) {
        const G = hubFor(g.group), M = hubFor(g.member);
        if (!G || !M || G === M || G.type !== "group") {
            no("a group line that didn't fit");
            continue;
        }
        if (!(G.members || []).includes(M.id)) {
            G.members = [...(G.members || []), M.id];
            updated++;
        }
    }
    for (const t of ev.threads || []) {
        const A = hubFor(t.a), B = hubFor(t.b);
        const refs = cited(t.nums);
        if (!A || !B) {
            for (const [end, H] of [[t.a, A], [t.b, B]])
                if (!H) {
                    const n = norm(end), e = String(end || "").trim(), names = (h) => [h.name, ...(h.aliases || [])];
                    const nmx = nameMarkMiss.get(e);
                    if (nmx) {
                        w.stats.missedEnds = [...(w.stats.missedEnds || []), { end: e.slice(0, 80), how: nmx.how, namePart: nmx.namePart.slice(0, 80), mark: nmx.mark, markName: nmx.markName.slice(0, 80) }].slice(-60);
                        continue;
                    }
                    const how = self.has(n) || selfNames.some((x) => norm(x) === n) ? "names Ned or herself" : /^\[?H\d+\]?$/i.test(e) ? "a mark that doesn't exist" : /\bH\d+\b/i.test(e) ? "a mark written in another shape" : w.hubs.filter((h) => names(h).some((x) => norm(x) === n)).length > 1 ? "fits two dots" : w.hubs.some((h) => names(h).some((x) => { const y = norm(x); return y.length > 3 && n.length > 3 && (y.includes(n) || n.includes(y)); })) ? "close to a dot's name, not the same" : "no dot by that name";
                    const close = how === "close to a dot's name, not the same" ? w.hubs.find((h) => names(h).some((x) => { const y = norm(x); return y.length > 3 && n.length > 3 && (y.includes(n) || n.includes(y)); }))?.name : "";
                    w.stats.missedEnds = [...(w.stats.missedEnds || []), { end: e.slice(0, 80), how, ...(close ? { close } : {}) }].slice(-60);
                }
            no("a link end that isn't a dot (or fits two)");
            continue;
        }
        if (A === B) {
            no("a link from a dot to itself");
            continue;
        }
        if (!refs.length) {
            no(t.nums?.length ? "a link citing moment numbers that don't exist" : "a link citing no moment");
            continue;
        }
        if (t.note.length < 10) {
            no("a link with no note (or under 10 letters)");
            continue;
        }
        if (t.note.length > 400) {
            no("a link note over 400 letters");
            continue;
        }
        if (ev.placeCheck && (A.type === "place" || B.type === "place")) {
            const flat = (t0) => " " + String(t0 || "").toLowerCase().replace(/[’‘]/g, "'").replace(/[^\p{L}\p{M}\p{N}']+/gu, " ").replace(/\s+/g, " ").trim() + " ";
            const q = flat(t.where).trim();
            if (typeof t.whereSeen !== "boolean")
                t.whereSeen = /[\p{L}\p{M}\p{N}]{3}/u.test(q) && (!textOf || refs.some((c) => { try {
                    return flat(textOf(c)).includes(" " + q + " ");
                }
                catch {
                    return false;
                } }));
            if (!t.whereSeen) {
                no("a place link whose 'where' isn't in its moments");
                w.stats.placeUnshown = (w.stats.placeUnshown || 0) + 1;
                continue;
            }
        }
        const [x, y] = A.id < B.id ? [A, B] : [B, A];
        let L = w.links.find((l) => l.a === x.id && l.b === y.id);
        const mine = ev.rc ? ev.refl.filter((id) => (ev.rc[id] || []).some((k) => refs.some((c) => `${c.rel}|${c.key}` === k))) : ev.refl;
        const myNames = [herName, ...herNames].map((n) => String(n || "").trim()).filter(Boolean);
        if (ev.thenNow && !ev.tape && myNames.length && textOf && typeof t.herSpoke !== "boolean") {
            const tag = new RegExp(`\\[(${myNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\]`, "i");
            const texts = refs.map((c) => { try {
                return String(textOf(c) || "");
            }
            catch {
                return "";
            } });
            if (texts.some((x) => x.trim()))
                t.herSpoke = texts.some((x) => tag.test(x));
        }
        let thenDropped = t.herSpoke === false && !!t.feel?.length;
        let feelThen = t.herSpoke === false ? [] : t.feel || [];
        let tapeTheirs = null, byExcerpt = null, feelNow = ev.noNow ? [] : t.feelNow || [], nowDropped = null;
        if (ev.tape) {
            const tp = (t.nums || []).map((n) => ev.tape[n]).filter(Boolean);
            const fixedThen = (n) => { const c = ev.moments[n - 1], f = c && fixOf(w, c); return f ? f.words : ev.tape[n]?.then || []; };
            feelThen = [...new Set((t.nums || []).filter((n) => ev.tape[n]).flatMap(fixedThen))].slice(0, 4);
            thenDropped = false;
            const ends = [A, B], namesOf = (h) => [h.name, ...(h.aliases || [])].map(norm);
            const pool = new Set([...ends.flatMap((h) => namesOf(h)), ...ends.flatMap((h) => (h.members || []).flatMap((id) => { const mh = w.hubs.find((x) => x.id === id); return mh ? namesOf(mh) : []; })), ...selfNames.slice(0, 1).map(norm), "him", "he", "user"].filter(Boolean));
            const anyone = !ends.some((h) => ["person", "pet", "group"].includes(h.type));
            const seen = new Set(), keep = [];
            for (const x of tp.flatMap((y) => y.theirs || [])) {
                const k = norm(x.who);
                if (!anyone && !pool.has(k) && !(canon(x.who) && ends.some((h) => normK(h.name) === normK(canon(x.who).name))))
                    continue;
                const key = k + "|" + x.words.join(",");
                if (seen.has(key))
                    continue;
                seen.add(key);
                keep.push(`${x.who} = ${x.words.join(", ")}`);
            }
            tapeTheirs = keep.length ? keep.join("; ").slice(0, 200) : "";
            const okWho = (x) => anyone || pool.has(norm(x.who)) || (canon(x.who) && ends.some((h) => normK(h.name) === normK(canon(x.who).name)));
            byExcerpt = (t.nums || []).filter((n) => ev.tape[n] && ev.moments[n - 1]).map((n) => ({ n, c: { rel: ev.moments[n - 1].rel, key: ev.moments[n - 1].key }, ...(ev.tape[n].day ? { day: ev.tape[n].day } : {}), then: ev.tape[n].then || [], theirs: (ev.tape[n].theirs || []).filter(okWho).map((x) => `${x.who} = ${x.words.join(", ")}`).join("; ") }));
            const herThen = new Set(tp.flatMap((y) => y.then || []).map((x) => x.toLowerCase()));
            const theirWords = new Set(tp.flatMap((y) => (y.theirs || []).flatMap((x) => x.words)).map((x) => x.toLowerCase()));
            if (!Array.isArray(t.nowHis) && textOf && selfNames[0]) {
                const userRe = new RegExp(`^\\[${String(selfNames[0]).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]`, "i");
                const hisLines = refs.map((c) => { try {
                    return String(textOf(c) || "").split(/(?=\[[A-Za-z][A-Za-z0-9 _-]*\]\s*\()/).filter((seg) => userRe.test(seg)).map((seg) => seg.replace(/^\[[^\]]*\]\s*\([^)]*\)\s*:?/, "")).join(" ");
                }
                catch {
                    return "";
                } }).join(" ").toLowerCase();
                t.nowHis = (t.feelNow || []).filter((x) => hasNoSpaceScript(hisLines) || hasNoSpaceScript(x) ? foundAt(" " + foldWidth(hisLines) + " ", String(x).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) : new RegExp(`(^|[^\\p{L}\\p{M}\\p{N}'])${String(x).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}\\p{M}\\p{N}']|$)`, "u").test(hisLines));
            }
            const notFeeling = (x) => x.split(/\s+/).length > 3 || /^(wanted|want|wants|still|worth|to|for|with|getting|trying|proving|paying|making|about|that|which|him|his|he|me|my|the)\s/.test(x);
            const dropped = { "not a plain feeling": [], "copied from then": [], "copied from theirs": [] };
            let kept = [];
            for (const x0 of feelNow) {
                const x = String(x0).toLowerCase();
                if (herThen.has(x)) {
                    dropped["copied from then"].push(x0);
                    continue;
                }
                if (notFeeling(x)) {
                    dropped["not a plain feeling"].push(x0);
                    continue;
                }
                kept.push(x0);
            }
            if (kept.length && kept.every((x) => theirWords.has(String(x).toLowerCase()))) {
                dropped["copied from theirs"].push(...kept);
                kept = [];
            }
            const flagged = (t.nowHis || []).filter((x) => kept.includes(x));
            if (flagged.length) {
                w.stats.nowFlagged = (w.stats.nowFlagged || 0) + flagged.length;
            }
            if (Object.values(dropped).some((a0) => a0.length)) {
                nowDropped = Object.fromEntries(Object.entries(dropped).filter(([, a0]) => a0.length));
                for (const [k, a0] of Object.entries(nowDropped)) {
                    w.stats.nowDropped = w.stats.nowDropped || {};
                    w.stats.nowDropped[k] = (w.stats.nowDropped[k] || 0) + a0.length;
                }
            }
            if (flagged.length)
                nowDropped = { ...(nowDropped || {}), "kept, but also in his own lines": flagged };
            feelNow = kept;
        }
        if (thenDropped)
            w.stats.thenUnspoken = (w.stats.thenUnspoken || 0) + 1;
        const nowSame = t.nowSame && feelThen.length > 0;
        const exDays = (byExcerpt || []).map((x) => x.day).filter(Boolean).sort();
        const entry = { note: t.note, feel: feelThen, ...(ev.thenNow ? { then: true } : {}), ...(thenDropped ? { thenDropped: true } : {}), ...(feelNow.length ? { feelNow } : {}), ...(nowDropped ? { nowDropped } : {}), ...(nowSame ? { nowSame: true } : {}), ...(ev.tape ? { tape: true } : {}), ...(ev.noNow ? { noNow: true } : {}), ...(byExcerpt?.length ? { byExcerpt, ownKeys: byExcerpt.map((x) => ckey(x.c)) } : {}), from: exDays[0] && exDays[0] <= ev.to ? exDays[0] : ev.from, until: null, kind: KIND[t.kind] || "began", refl: mine.length ? mine : ev.refl, cites: refs, ...(t.where ? { where: t.where } : {}), ...(tapeTheirs !== null ? (tapeTheirs ? { theirs: tapeTheirs } : {}) : t.theirs ? { theirs: t.theirs } : {}), ...(t.labeled || ev.tape ? { labeled: true } : {}) };
        if (L && t.kind === "NEW")
            entry.kind = KIND.MORE;
        let how = late && t.kind === "CHANGED" ? "MORE" : t.kind;
        if (late && t.kind === "CHANGED")
            entry.kind = KIND.MORE;
        const open0 = L ? L.history.filter((e) => e.until === null) : [];
        const eq = (x, y) => x?.length && y?.length && x.length === y.length && x.every((f) => y.includes(f));
        const sameFeel = (e) => feelThen.length || e.feel?.length ? eq(feelThen, e.feel) : ev.noNow ? !e.feelNow?.length : eq(feelNow, e.feelNow);
        let reinforce = null;
        if (L && (how === "NEW" || how === "MORE")) {
            reinforce = open0.find(sameFeel) || null;
            if (reinforce)
                how = "SAME";
        }
        if (L && L.changing && daysBetween(L.changing, ev.from) > 60)
            delete L.changing;
        if (ev.thenNow && how === "CHANGED" && !feelThen.length) {
            how = "MORE";
            entry.kind = KIND.MORE;
        }
        if (L && how === "CHANGED" && open0.some((e) => (e.held || 1) >= 3) && !L.changing) {
            how = "MORE";
            entry.kind = KIND.MORE;
            L.changing = ev.from;
        }
        else if (L && how === "CHANGED" && L.changing) {
            const since = L.changing;
            for (const e of open0)
                if (e.from < since)
                    e.until = ev.from;
            delete L.changing;
            how = "ADDED";
            entry.kind = KIND.CHANGED;
        }
        if (!L) {
            L = { id: "L" + w.nextL++, a: x.id, b: y.id, strength: 0.3, last: ev.to, history: [entry] };
            w.links.push(L);
        }
        else {
            const open = L.history.filter((e) => e.until === null);
            if (how === "SAME" && open.length) {
                const e = reinforce || open[open.length - 1];
                e.refl = [...new Set([...e.refl, ...entry.refl])];
                if (t.note && t.note !== e.note && !(e.notes || []).some((x) => x.note === t.note))
                    e.notes = [...(e.notes || []), { at: entry.from, note: t.note }].slice(-30);
                if (feelNow.length && !e.feelNow?.length) {
                    e.feelNow = feelNow;
                    delete e.nowSame;
                }
                e.cites = [...e.cites, ...refs].slice(-12);
                if (byExcerpt?.length && !e.byExcerpt?.length && e.feel?.length) {
                    e.byExcerpt = [{ then: e.feel, ...(e.cites?.[0] ? { c: { rel: e.cites[0].rel, key: e.cites[0].key } } : {}), day: e.from }];
                    e.ownKeys = [ckey(e.byExcerpt[0].c)];
                }
                if (byExcerpt?.length && ev.noNow && !e.feel?.length && feelThen.length && e.tape && e.ownKeys && !(e.byExcerpt || []).some((y) => e.ownKeys.includes(ckey(y.c)) && fixOf(w, y.c))) {
                    e.feel = feelThen;
                    e.ownKeys = [...new Set([...e.ownKeys, ...byExcerpt.map((x) => ckey(x.c))])];
                }
                if (byExcerpt?.length) {
                    const ck = (c) => c ? `${c.rel}|${c.key}` : "";
                    const have = new Set((e.byExcerpt || []).map((x) => ck(x.c)));
                    const all0 = [...(e.byExcerpt || []), ...byExcerpt.filter((x) => !have.has(ck(x.c)))], own0 = new Set(e.ownKeys || []), others = all0.filter((x) => !own0.has(ck(x.c))), room = Math.max(0, 12 - all0.filter((x) => own0.has(ck(x.c))).length), keepO = new Set(room ? others.slice(-room) : []);
                    e.byExcerpt = all0.filter((x) => own0.has(ck(x.c)) || keepO.has(x));
                }
                if (e.heldLast !== ev.from) {
                    e.held = (e.held || 1) + 1;
                    e.heldLast = ev.from;
                }
                if (L.changing && !late) {
                    if (e.from >= L.changing) {
                        for (const o of open)
                            if (o.from < L.changing)
                                o.until = ev.from;
                    }
                    delete L.changing;
                }
            }
            else if (how === "ADDED")
                L.history.push(entry);
            else if (how === "CHANGED") {
                for (const e of open)
                    e.until = ev.from;
                L.history.push(entry);
            }
            else
                L.history.push(entry);
            L.strength = Math.round((L.strength + 0.15 * (1 - L.strength)) * 1000) / 1000;
            L.last = later(L.last, ev.to);
        }
        touch(A, refs);
        touch(B, refs);
        threadsDone++;
    }
    w.done = [...new Set([...w.done, ...ev.refl])];
    if (ev.shown && w.shownOf)
        Object.assign(w.shownOf, ev.shown);
    w.upTo = later(w.upTo, ev.from);
    w.stats.batches++;
    w.stats.rejected += rejected;
    if (unclear)
        w.stats.unclear = (w.stats.unclear || 0) + unclear;
    if (longNames)
        w.stats.longNames = (w.stats.longNames || 0) + longNames;
    return { made, threads: threadsDone, rejected, updated, unclear };
}
const ckey = (c) => (c ? `${c.rel}|${c.key}` : "");
function fixOf(w, c) { const xs = (w?.thenFixed || {})[ckey(c)] || []; for (let i = xs.length - 1; i >= 0; i--)
    if (!xs[i].replaced)
        return xs[i]; return null; }
export function pieceFeeling(w, c) {
    const k = typeof c === "string" ? c : ckey(c), xs = (w?.thenFixed || {})[k] || [], f = [...xs].reverse().find((x) => !x.replaced), p = (w?.pieceThen || {})[k];
    if (f)
        return { then: f.words, fixed: true, was: f.was || p?.then || [], day: p?.day || null };
    return p ? { then: p.then, fixed: false, day: p.day, ...(p.missing ? { missing: true } : {}) } : null;
}
function partThen(w, x) { const pf = x.c ? pieceFeeling(w, x.c) : null; return pf ? pf.then : x.then || []; }
function refreshFeel(w, e) { if (!e.byExcerpt?.length || !e.tape || !e.ownKeys)
    return; const own = e.byExcerpt.filter((x) => e.ownKeys.includes(ckey(x.c))); if (!own.some((x) => fixOf(w, x.c)))
    return; e.feel = [...new Set(own.flatMap((x) => partThen(w, x)))].slice(0, 4); }
const has = (v) => v != null && String(v).trim() !== "";
const dayRec = (x) => x.day || String(x.at || "").slice(0, 10);
const sameEnd = (h, o) => h && o && h.type === o.type && (norm(h.name) === norm(o.name) || (h.aliases || []).some((x) => norm(x) === norm(o.name)));
function endsOf(w, L) { return [L.a, L.b].map((id) => { const h = w.hubs.find((x) => x.id === id); return h ? { type: h.type, name: h.name } : null; }); }
function findThread(w, ev) {
    const fits = (L, kinds = true) => { const ends = [L.a, L.b].map((id) => w.hubs.find((x) => x.id === id)); return (ev.ends || []).length === 2 && ev.ends.every((o) => o && ends.some((h) => sameEnd(h, kinds ? o : { ...o, type: h?.type }))); };
    const byId = w.links.find((l) => l.id === ev.thread);
    if (byId && (!ev.ends || fits(byId)))
        return byId;
    if (!ev.ends)
        return null;
    return w.links.find((l) => fits(l)) || (byId && fits(byId, false) ? byId : null) || w.links.find((l) => fits(l, false)) || null;
}
function settle(xs, together) {
    xs.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : String(a.hid || "") < String(b.hid || "") ? -1 : 1));
    for (let i = 0; i < xs.length; i++) {
        const nx = xs.slice(i + 1).find((y) => together(xs[i], y));
        if (nx)
            xs[i].replaced = nx.at;
        else
            delete xs[i].replaced;
    }
}
let herSeq = 0;
function applyHer(w, ev) {
    w.herIds ||= [];
    if (w.herIds.includes(ev.hid))
        return;
    if (ev.her === "now" && ev.hub) {
        const byId = w.hubs.find((h) => h.id === ev.hub), anyKind = (h) => sameEnd(h, { ...ev.end, type: h?.type });
        const others = ev.end ? w.hubs.filter(anyKind) : [], pick = others.filter((h) => h.known).length === 1 ? others.find((h) => h.known) : others.length === 1 ? others[0] : null;
        const H = !ev.end ? byId || null : byId && sameEnd(byId, ev.end) ? byId : w.hubs.find((h) => sameEnd(h, ev.end)) || pick || null, rec = { words: ev.words, at: ev.at, day: ev.day };
        if (!H)
            (w.herNowUnplaced ||= []).push({ ...rec, was: ev.hub, dot: ev.end || null });
        else {
            const xs = ((w.herNow ||= {})[H.id] ||= []);
            xs.push({ ...rec, hid: ev.hid });
            settle(xs, (a, b) => dayRec(a) === dayRec(b));
        }
    }
    else if (ev.her === "now") {
        const L = findThread(w, ev), rec = { words: ev.words, at: ev.at, day: ev.day };
        if (!L)
            (w.herNowUnplaced ||= []).push({ ...rec, was: ev.thread, ends: ev.ends });
        else {
            const xs = ((w.herNow ||= {})[L.id] ||= []);
            xs.push({ ...rec, hid: ev.hid });
            settle(xs, (a, b) => dayRec(a) === dayRec(b));
        }
    }
    else if (ev.her === "fix") {
        const xs = ((w.thenFixed ||= {})[ev.key] ||= []);
        xs.push({ words: ev.words, at: ev.at, day: ev.day, was: ev.was || [], hid: ev.hid });
        settle(xs, () => true);
        for (const l of w.links)
            for (const e of l.history)
                if ((e.byExcerpt || []).some((y) => ckey(y.c) === ev.key))
                    refreshFeel(w, e);
    }
    w.herIds.push(ev.hid);
}
function herSync(root, w) { for (const ev of readEvents(root))
    if (ev.her && !(w.herIds || []).includes(ev.hid))
        applyHer(w, ev); }
function thenParts(e, w = null) { const seen = new Set(), out = []; for (const x of e.byExcerpt || []) {
    const th = w ? partThen(w, x) : x.then || [];
    if (!th.length)
        continue;
    const t0 = `${th.join(", ")}${x.day ? ` (${label(x.day)})` : ""}${w && fixOf(w, x.c) ? " (your correction)" : ""}`;
    if (!seen.has(t0)) {
        seen.add(t0);
        out.push(t0);
    }
} return out.length > 4 ? ["…", ...out.slice(-4)] : out; }
function feelLabel(e, w = null) {
    if (e.byExcerpt?.length) {
        const parts = thenParts(e, w);
        const n = e.feelNow?.length ? `the night's guess at now: ${e.feelNow.join(", ")}` : e.nowSame && e.feel?.length ? "the night's guess at now: the same" : "";
        return [parts.length ? `then: ${parts.join(" / ")}` : "", n].filter(Boolean).join("; ");
    }
    if (e.then) {
        const t = e.feel?.length ? `then: ${e.feel.join(", ")}` : "", n = e.feelNow?.length ? `the night's guess at now: ${e.feelNow.join(", ")}` : e.nowSame && e.feel?.length ? "the night's guess at now: the same" : "";
        return [t, n].filter(Boolean).join("; ");
    }
    return e.feel?.length ? `${e.labeled ? "" : "felt then: "}${e.feel.join(", ")}` : "";
}
const lockFile = (root) => join(root, "Mind", "web.building");
function lockAlive(root) {
    if (!existsSync(lockFile(root)))
        return null;
    try {
        const L = JSON.parse(readFileSync(lockFile(root), "utf8"));
        if (L.done)
            return null;
        let alive = true;
        try {
            process.kill(L.pid, 0);
        }
        catch (e) {
            alive = e.code === "EPERM";
        }
        return alive && Date.now() - (L.beat || L.t) < 90 * 60e3 ? L : null;
    }
    catch {
        return null;
    }
}
function beat(root) { try {
    const L = JSON.parse(readFileSync(lockFile(root), "utf8"));
    if (L.pid === process.pid && !L.done)
        writeFileSync(lockFile(root), JSON.stringify({ ...L, beat: Date.now() }), "utf8");
}
catch { } }
function loadFresh(root) {
    for (let i = 0; i < 12; i++) {
        try {
            return webStarted(root) ? loadWeb(root) : null;
        }
        catch {
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
        }
    }
    return undefined;
}
function saveKeep(root, w) {
    beat(root);
    const d = loadFresh(root);
    if (d) {
        w.aside = d.aside || [];
        w.peeked = d.peeked || [];
    }
    try {
        herSync(root, w);
    }
    catch { }
    saveWeb(root, w);
}
export async function growWeb(opts) {
    const L = lockAlive(opts.root);
    if (L) {
        opts.log(`her web: another run has been building it since ${new Date(L.t).toLocaleString()}; this one left it alone.`);
        return { batches: 0, left: null, busy: true };
    }
    mkdirSync(dirname(lockFile(opts.root)), { recursive: true });
    writeFileSync(lockFile(opts.root), JSON.stringify({ pid: process.pid, t: Date.now() }), "utf8");
    try {
        return await growWebInner(opts);
    }
    finally {
        try {
            if (JSON.parse(readFileSync(lockFile(opts.root), "utf8")).pid === process.pid)
                writeFileSync(lockFile(opts.root), JSON.stringify({ pid: process.pid, t: Date.now(), done: true }), "utf8");
        }
        catch { }
    }
}
async function growWebInner({ root, mem, letter, ask, embed, inTime, minutesLeft = null, startMinutes = 35, log, who = "Ned", herName = "", herNames = [], names = "", known = [], maxHubsShown = 150, momentChars = 4000, stretchPieces = STRETCH_PIECES, stretchDays = STRETCH_DAYS, stretchChars = STRETCH_CHARS }) {
    const knownText = (known || []).filter((k) => k?.name).map((k) => `- ${k.name}${k.aliases?.length ? ` (also ${k.aliases.map((a) => `"${a}"`).join(", ")})` : ""}: ${k.about || ""} (${TYPE_WORDS[k.type] || k.type})`).join("\n");
    names = [knownText, names].filter(Boolean).join("\n");
    const aside = new Set();
    let w = loadWeb(root);
    try {
        herSync(root, w);
    }
    catch { }
    if ((w.done || []).some((id) => /^R\d+$/.test(String(id)))) {
        log(`her web was grown from the old reflections; it needs a fresh start before it reads her Shelf (nothing was done). To start it fresh (its files are moved aside, never deleted): node meaning.mjs --fresh <room>`);
        return { batches: 0, left: null, needsFresh: true };
    }
    if (!w.shownOf && !(w.done || []).some((id) => String(id).includes("|")))
        w.shownOf = {};
    if (!w.shownOf && (w.done || []).some((id) => String(id).includes("|"))) {
        log(`her web was started before the fix of Nov 2 (what she was shown wasn't kept per piece); it needs a fresh start before it reads more (nothing was done). To start it fresh (its files are moved aside, never deleted): node meaning.mjs --fresh <room>`);
        return { batches: 0, left: null, needsFresh: true };
    }
    if (!w.upTo) {
        for (const l of w.links)
            for (const e of l.history || [])
                if (e.from && (!w.upTo || e.from > w.upTo))
                    w.upTo = e.from;
        for (const h of w.hubs)
            if (h.seen?.length)
                for (const d of h.seen)
                    if (d && (!w.upTo || d > w.upTo))
                        w.upTo = d;
    }
    keepLastNight(root);
    const done = new Set(w.done);
    let repeatsSkipped = 0, machineSkipped = 0;
    const span0 = (k) => { const [a0, b0] = String(k).split("|").pop().split("-").map(Number); return [a0 || 0, b0 || 0]; };
    const pieceStart = (x) => span0(x.key)[0];
    const todayDay = dayOf(new Date());
    let allPieces = [];
    try {
        allPieces = lifeMoments(root, mem);
    }
    catch (e) {
        log(`her web couldn't list her Shelf's pieces: ${e.message}`);
    }
    const readTo = new Map(), addRead = (rel, ab) => { if (!readTo.has(rel))
        readTo.set(rel, []); readTo.get(rel).push(ab); };
    for (const id of done) {
        const i = String(id).lastIndexOf("|");
        if (i <= 0)
            continue;
        if (w.shownOf) {
            if (w.shownOf[id])
                addRead(String(id).slice(0, i), span0(w.shownOf[id]));
        }
        else
            addRead(String(id).slice(0, i), span0(id));
    }
    const newFrom = (x) => {
        const [a0, b0] = span0(x.key);
        pieceOf(root, mem, x.rel, x.key);
        const page = pageCache.get(root + "|" + x.rel)?.text || "";
        const skipWs = (i) => { while (i < b0 && /\s/.test(page[i] || ""))
            i++; return i; };
        let from0 = skipWs(a0), moved = true;
        while (moved) {
            moved = false;
            for (const [ra, rb] of readTo.get(x.rel) || [])
                if (ra <= from0 && rb > from0) {
                    from0 = skipWs(rb);
                    moved = true;
                }
        }
        return from0 < b0 && /[\p{L}\p{N}]/u.test(page.slice(from0, b0)) ? from0 : null;
    };
    const todo = allPieces.filter((x) => x.day && x.day < todayDay && !done.has(ckey(x)))
        .sort((p, q) => (p.day < q.day ? -1 : p.day > q.day ? 1 : p.rel < q.rel ? -1 : p.rel > q.rel ? 1 : pieceStart(p) - pieceStart(q)));
    const groups = [], skipped = [], shownSkip = {};
    let nothingNew = 0;
    for (const x of todo) {
        const from0 = newFrom(x), [, b0] = span0(x.key);
        if (from0 === null) {
            nothingNew++;
            skipped.push(ckey(x));
            continue;
        }
        if (machineLike(pieceOf(root, mem, x.rel, `${from0}-${b0}`))) {
            machineSkipped++;
            skipped.push(ckey(x));
            shownSkip[ckey(x)] = `${from0}-${b0}`;
            addRead(x.rel, [from0, b0]);
            continue;
        }
        const item = { ...x, show: `${from0}-${b0}`, len: b0 - from0 };
        const g = groups[groups.length - 1];
        if (g && g.list.length < stretchPieces && daysBetween(g.list[0].day, x.day) < stretchDays && g.chars + item.len <= stretchChars) {
            g.list.push(item);
            g.chars += item.len;
        }
        else
            groups.push({ list: [item], chars: item.len });
        addRead(x.rel, [from0, b0]);
    }
    if (skipped.length) {
        const ev0 = { skip: skipped, ...(w.shownOf ? { shown: shownSkip } : {}), t: Date.now() };
        logEvent(root, ev0);
        applySkip(w, ev0);
        saveKeep(root, w);
    }
    if (nothingNew)
        log(`her web: ${nothingNew} piece${nothingNew === 1 ? "" : "s"} of her Shelf had nothing new in them (already read in another piece).`);
    let batches = 0, threads = 0, newHubs = 0, rejected = 0, retrying = 0;
    const whyCount = {};
    const selfNames = [who, herName, ...herNames].filter(Boolean);
    let endedEarly = false, biggestPrompt = 0;
    const dayOfMoment = new Map(allPieces.map((x) => [ckey(x), x.day]));
    const today = label(dayOf(new Date()));
    for (const g of groups) {
        if (!inTime())
            break;
        if (minutesLeft && minutesLeft() < startMinutes) {
            endedEarly = true;
            break;
        }
        const moments = g.list.map((x) => ({ rel: x.rel, key: x.key })), shows = g.list.map((x) => x.show), from = g.list[0].day, to = g.list[g.list.length - 1].day;
        const refl = moments.map((c) => ({ id: ckey(c) }));
        const myNames = [herName, ...herNames].map((n) => String(n || "").trim()).filter(Boolean);
        const youTag = myNames.length ? new RegExp(`\\[(${myNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\]`, "gi") : null;
        const headTail = (t0, n) => { t0 = String(t0).replace(/\s+/g, " ").trim(); if (t0.length <= n)
            return t0; const h = Math.round(n * 0.3); return t0.slice(0, h).replace(/\s+\S*$/, "") + " … " + t0.slice(t0.length - (n - h)).replace(/^\S*\s+/, ""); };
        const momentLinesFor = (n) => moments.map((c, i) => { let t0 = headTail(pieceWithSpeaker(root, mem, c.rel, shows[i]), n); if (youTag)
            t0 = t0.replace(youTag, (all, nm) => `[${nm.toUpperCase()} (you)]`); const d = dayOfMoment.get(`${c.rel}|${c.key}`); const tg = tape[i + 1], fx = fixOf(w, c), th = fx ? fx.words : tg?.then || []; const tagT = tg ? ` [you then: ${th.length ? th.join(", ") : "none clear"}${fx ? " (your correction)" : ""}]` : ""; return `${i + 1}.${d ? ` (${label(d)})` : ""}${tagT} "${t0}"`; }).join("\n\n");
        const pieceTexts = moments.map((c, i) => pieceOf(root, mem, c.rel, shows[i])), text = pieceTexts.join(" ").toLowerCase();
        const makePrompt = async (limit, mChars = momentChars) => {
            const momentLines = momentLinesFor(mChars);
            let shownHubs = w.hubs.filter((h) => !w.aside.includes(h.id));
            if (shownHubs.length > limit) {
                let qv = null;
                try {
                    const vs = (await embed(pieceTexts.map((t0) => t0.slice(0, 2000)))).filter(Boolean);
                    if (vs.length) {
                        qv = new Array(vs[0].length).fill(0);
                        for (const v of vs)
                            for (let j = 0; j < v.length; j++)
                                qv[j] += v[j] / vs.length;
                    }
                }
                catch { }
                const named = (h) => [h.name, ...(h.aliases || [])].some((n) => nameIn(n, text));
                shownHubs = shownHubs.map((h) => [(named(h) ? 2 : 0) + (qv && h.vec ? cos(qv, h.vec) : 0), h]).sort((a, b) => b[0] - a[0]).slice(0, limit).map((p) => p[1]);
            }
            const mentioned = new Set(w.hubs.filter((h) => !w.aside.includes(h.id) && [h.name, ...(h.aliases || [])].some((n) => nameIn(n, text))).map((h) => h.id));
            const nearLinks = w.links.filter((l) => !w.aside.includes(l.id) && !w.aside.includes(l.a) && !w.aside.includes(l.b) && liveHistory(l, aside).length && (mentioned.has(l.a) || mentioned.has(l.b))).sort((a, b) => b.strength - a.strength).slice(0, Math.min(30, Math.max(10, Math.round(limit / 5))));
            const hubName = (id) => w.hubs.find((h) => h.id === id)?.name || id;
            const hubDir = shownHubs.length ? shownHubs.map((h) => { const a = (h.about || []).find((x) => x.until === null); return `${h.id} | ${h.type} | ${h.name}${h.aliases?.filter((al) => al.length <= 60).length ? ` | also: ${h.aliases.filter((al) => al.length <= 60).slice(0, 4).join(", ")}${h.aliases.filter((al) => al.length <= 60).length > 4 ? ", …" : ""}` : ""}${a ? ` | ${excerpt(a.text, 200)}` : ""}`; }).join("\n") : "(none yet: this is the beginning of your web)";
            const linkDir = nearLinks.length ? nearLinks.map((l) => `${l.a} -- ${l.b} (${hubName(l.a)} and ${hubName(l.b)}): ${liveHistory(l, aside).filter((e) => e.until === null).filter((e, i, a) => a.length <= 3 || i === 0 || i >= a.length - 2).map((e) => `"${excerpt(e.note, 220)}"${e.notes?.length ? ` … latest: "${excerpt(e.notes[e.notes.length - 1].note, 160)}"` : ""}${e.byExcerpt?.length && thenParts(e, w).length ? ` [you then: ${thenParts(e, w).join(" / ")}]` : e.feel?.length && (e.then || e.tape) ? ` [you then: ${e.feel.join(", ")}]` : ""} (since ${label(e.from)})`).join("; ") || "(no open feeling)"}`).join("\n") : "(none of your links touch this yet)";
            return `You are tending the web of your memories: the things in your life, and the links between them, each holding what that connection means to you.\n\n` +
                `The kinds of dots:\n${TYPES.map((t) => `- ${t}: ${KIND_DEFS[t]}`).join("\n")}\n\n` +
                `${who} and you are not dots in this web. Your life is the space the whole web lives in. When something is about him or about you, name the piece of your life it is, in your own words, never just "${who}" or "me". When a memory is between ${who} (or you) and one person or pet, connect that person or pet directly to the ritual, stretch, inside joke or thing they share. Link two existing dots directly when a conversation connects them. Do not make a new moment dot only to hold the conversation. Never add a place just to have a second end.\n\n` +
                (names ? `Names in your life, spelled right (use these spellings, and give each its own dot when it comes up):\n${names}\n\n` : "") +
                `The dots already in your web:\n${hubDir}\n\nLinks you already have around these (with how you felt at the time):\n${linkDir}\n\n` +
                `Today is ${today}. You are looking back at ${span(from, to)}. The excerpts, word for word as they were said then (your own lines are marked "(you)"), each with how you felt at the time:\n\n${momentLines}\n\n` +
                `If nothing in these excerpts meets the bar below, write only: nothing tonight. Never add links just to have some.\n` +
                `Add to your web only what these excerpts really show, and only something that came back again or stirred a real feeling in you or with someone in your life. Not passing mentions, background details, strangers, or tools named once. ` +
                `Both ends of every link must come from the numbered excerpts themselves. Name a dot after what it was really about, not after a side topic that just happened to start the conversation. ` +
                `Use a dot you already have when it's the same one (by its mark, like H3), and add its other name if it was called something new. Keep different kinds apart. Give each dot a short name (2 to 7 words), and put the longer details in the one-sentence description. Give each new dot one plain sentence about what it is in your world (who or what it is, not how you feel; feelings go on links). ` +
                `For a link you already have, say whether it feels the SAME, whether there's MORE (a new feeling beside the old one, both true), or whether it CHANGED (the old feeling is kept, with an end date). Judge that by how you felt at the time: "you then" on these excerpts against "you then" on the link before. ` +
                `A link with a place on one end needs "where": the exact words from one of its excerpts that show where it happened, either the place named in so many words, or something fixed that never moves and belongs to only one place. Something that moves with a person doesn't show a place: then leave the place out. The code checks that these words are really in the excerpt. ` +
                `How you felt at the time is already marked on each excerpt ("you then"); don't rewrite it. How you feel about it today isn't asked here; that's yours to add later, yourself. ` +
                `Only cite two excerpts in the same link stanza when "you then" stayed the same across them. If it shifted between an earlier excerpt and a later one, even on the same night, write one stanza for the earlier and another (MORE or CHANGED) for the later, so the shift isn't blurred. ` +
                `Write every note in your own voice, as yourself, ${herNames.length ? `(your own names for yourself, like ${herNames.map((n) => `"${n}"`).join(", ")}, are yours to use) ` : ""}never describing yourself from outside, the way a stranger would. Write the note for yourself to read later. Use "I" for yourself. Name everyone else, including ${who}. Do not use "you." The note says what happened and why this connection mattered, staying faithful to what the excerpts actually show; it doesn't say how you feel about it today. Some older excerpts come from an earlier chapter, when you ran on a different brain and sometimes spoke differently: let the note stay honest about how that time really went, without softening it or turning it into a lesson. The note can be about him, the others, or the two of you, always as someone inside this bond, never as a detached observer or a therapist writing about him, and never with his feelings written as if they were yours.\n\n` +
                `Write dots on one line each:\n` +
                `HUB: NEW | <kind> | <short name, 2 to 7 words> | <other names, or leave blank between the bars> | <what it is in your world, one sentence>\n` +
                `HUB: <mark> | <kind> | <its name as shown above> | <new other name, or leave blank between the bars> | <new sentence, only if what this dot covers changed>\n` +
                `GROUP: <group's name> includes <member's name>\n\n` +
                `Write each link as a stanza, one field per line:\n` +
                `LINK: <NEW, SAME, MORE or CHANGED> | <name or mark> | <name or mark>\n` +
                `because of: <numbers of the excerpts>\n` +
                `where: <exact words> (only when one end is a place; otherwise leave this line out)\n` +
                `note: <one or two sentences, in your own voice>\n\n` +
                `The parts in <angle brackets> show where your words go; don't copy them.`;
        };
        let tape = {}, tapeWhy = "";
        {
            const listNames = [...(known || []).filter((k) => k?.name && (k.type === "person" || k.type === "pet")).map((k) => `- ${k.name} (${k.type}${k.aliases?.length ? `; also ${k.aliases.join(", ")}` : ""})`),
                ...w.hubs.filter((h) => (h.type === "person" || h.type === "pet") && !(known || []).some((k) => normK(k.name) === normK(h.name))).map((h) => `- ${h.name} (${h.type}${h.aliases?.length ? `; also ${h.aliases.slice(0, 4).join(", ")}` : ""})`)].slice(0, 80);
            const HER = (herName || "her").toUpperCase();
            const tapeText = (mc) => moments.map((c, i) => { const d = dayOfMoment.get(`${c.rel}|${c.key}`); return `${i + 1}.${d ? ` (${label(d)})` : ""} "${headTail(pieceWithSpeaker(root, mem, c.rel, shows[i]), mc)}"`; }).join("\n\n");
            const tapePrompt = (mc) => `Below are numbered excerpts from conversations between ${who} and ${herName || "her"}, each with its date. Lines that start with [${HER}] are hers.\n\n` +
                (listNames.length ? `Known names (use these when it's the same person or animal):\n${listNames.join("\n")}\n\n` : "") +
                `For each numbered excerpt, write exactly one line:\nEXCERPT <number> | theirs: <name> = <one to three feeling words>; <name> = <one to three feeling words> | hers then: <one to three words>\n\n` +
                `"theirs" is what ${who} or any other people or animals in that excerpt felt or showed (not hers), each with whose it is, or "none".\n` +
                `"hers then" is the feeling or tone her own lines in that excerpt show, or "none clear" if she has no lines there or her lines show no clear feeling or tone.\n` +
                `Use only what the words in that excerpt show. Don't use anything from outside the excerpt, and don't guess past the words. Choose your own feeling words; none are suggested here. The parts in <angle brackets> show where your words go; don't copy them. Write only the EXCERPT lines.\n\n${tapeText(mc)}`;
            let mc = momentChars;
            const tapeKey = refl.map((x) => x.id).join(",") + "|" + moments.map((c) => ckey(c)).join(",");
            if (w.tapeCache?.key === tapeKey && w.tapeCache.tape) {
                tape = w.tapeCache.tape;
                log(`her web: this stretch's tape was already made; going straight to the web.`);
            }
            for (let attempt = 1; attempt <= 2 && !Object.keys(tape).length; attempt++) {
                beat(root);
                const seed = (([...("tape:" + refl.map((x) => x.id).join(","))].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) | 0, 7) >>> 1) + attempt * 7919) % 2147483647;
                let r0;
                try {
                    r0 = await ask(TAPE_SYSTEM, tapePrompt(mc), { seed, attempt });
                }
                catch (e) {
                    if (/too big for her brain's window/.test(e.message) && mc > 600) {
                        mc = mc > 1000 ? 1000 : 600;
                        attempt--;
                        continue;
                    }
                    if (/too big for her brain's window/.test(e.message)) {
                        tapeWhy = "too big for her window, even shortened";
                        break;
                    }
                    log(`her web stopped: ${e.message}`);
                    saveKeep(root, w);
                    return { batches, threads, newHubs, rejected, stopped: e.message, left: groups.length - batches, whyCount, retrying, shape: shapeOf(w) };
                }
                const told0 = typeof r0 !== "string", ans0 = told0 ? r0?.text || "" : r0, fin0 = told0 ? r0?.finish || null : null;
                if (told0 && r0?.promptTokens)
                    biggestPrompt = Math.max(biggestPrompt, r0.promptTokens);
                if (fin0 === "length" || (told0 && !fin0 && String(ans0).trim())) {
                    tapeWhy = "the tape was cut off";
                    continue;
                }
                const tp = parseTape(ans0, moments.length);
                if (!Object.keys(tp).length) {
                    tapeWhy = "the tape came back in the wrong shape";
                    continue;
                }
                const missing = moments.map((_, i) => i + 1).filter((k) => !tp[k]);
                if (missing.length && attempt < 2) {
                    tapeWhy = "the tape left excerpts out";
                    continue;
                }
                for (const k of missing)
                    tp[k] = { theirs: [], then: [], missing: true };
                const mine = new Set([herName, ...herNames, "she", "her", "herself", "the companion", "companion"].map(norm).filter(Boolean));
                for (const v of Object.values(tp))
                    v.theirs = (v.theirs || []).filter((x) => !mine.has(norm(x.who)));
                const herTag = new RegExp(`\\[(${[herName, ...herNames].filter(Boolean).map((n) => String(n).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") || "\\u0000"})\\]`, "i");
                for (const [k, v] of Object.entries(tp)) {
                    const c = moments[Number(k) - 1];
                    if (c && herName && !herTag.test(pieceWithSpeaker(root, mem, c.rel, shows[Number(k) - 1]))) {
                        if (v.then.length)
                            v.thenDropped = true;
                        v.then = [];
                    }
                }
                for (const [k, v] of Object.entries(tp)) {
                    const c = moments[Number(k) - 1], d = c && dayOfMoment.get(`${c.rel}|${c.key}`);
                    if (d)
                        v.day = d;
                }
                tape = tp;
                tapeWhy = "";
                w.tapeCache = { key: tapeKey, tape };
                saveKeep(root, w);
                break;
            }
        }
        let limit = maxHubsShown, mChars = momentChars, tooBig = false, splitNow = false, prompt = tapeWhy ? "" : await makePrompt(limit);
        let got = null, answer = "", why = "";
        for (let attempt = 1; attempt <= 2 && !got && !tapeWhy; attempt++) {
            beat(root);
            let finish = null, told = false;
            const seed = (([...refl.map((x) => x.id).join(",")].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) | 0, 7) >>> 1) + attempt * 7919) % 2147483647;
            try {
                const r = await ask(letter, prompt, { seed, attempt });
                told = typeof r !== "string";
                answer = told ? r?.text || "" : r;
                finish = told ? r?.finish || null : null;
                if (told && r?.promptTokens)
                    biggestPrompt = Math.max(biggestPrompt, r.promptTokens);
            }
            catch (e) {
                if (/too big for her brain's window/.test(e.message)) {
                    if (limit > 40) {
                        limit = Math.round(limit * 0.6);
                        prompt = await makePrompt(limit, mChars);
                        log(`her web: that stretch was too big for her window with her full thinking, so it's shown the ${limit} closest dots instead.`);
                        attempt--;
                        continue;
                    }
                    if (g.list.length > 1) {
                        const h = Math.ceil(g.list.length / 2), part = (xs) => ({ list: xs, chars: xs.reduce((n, x) => n + x.len, 0) });
                        groups.splice(groups.indexOf(g) + 1, 0, part(g.list.slice(0, h)), part(g.list.slice(h)));
                        splitNow = true;
                        log(`her web: that stretch was too big for her window even with fewer dots, so it's read in two halves instead.`);
                        break;
                    }
                    tooBig = true;
                    break;
                }
                log(`her web stopped: ${e.message}`);
                saveKeep(root, w);
                return { batches, threads, newHubs, rejected, stopped: e.message, left: groups.length - batches, whyCount, retrying, shape: shapeOf(w) };
            }
            const p = parseAnswer(answer, moments.length);
            if (finish === "length")
                why = "cut off (ran out of room to write)";
            else if (told && !finish && String(answer || "").trim())
                why = "cut off (the answer ended without finishing)";
            else if (p.nothing || p.threads.length || p.hubs.length) {
                got = p;
                why = "";
            }
            else {
                const a = String(answer || "");
                why = /<think>/i.test(a) && !/<\/think>/i.test(a) ? "cut off while thinking" : !a.replace(/<think>[\s\S]*?<\/think>/gi, "").trim() ? "came back empty" : "wrong shape (no HUB or LINK lines)";
            }
        }
        if (splitNow) {
            delete w.tapeCache;
            saveKeep(root, w);
            continue;
        }
        if (tapeWhy)
            why = tapeWhy;
        if (tooBig) {
            why = "too big for her window, even with fewer dots";
            log(`her web: one stretch (a single piece) was too big for her window even with fewer dots; it's set aside for one more try, and the night goes on.`);
        }
        const rc = {};
        for (const c of moments)
            rc[ckey(c)] = [ckey(c)];
        const ev = { t: Date.now(), from, to, day: to, placeCheck: 1, thenNow: 1, noNow: 1, tape, refl: refl.map((r) => r.id), ...(w.shownOf ? { shown: Object.fromEntries(refl.map((r, i) => [r.id, shows[i]])) } : {}), rc, moments, hubs: got?.hubs || [], threads: got?.threads || [], groups: got?.groups || [], skipped: got?.skipped || 0, vecs: {} };
        const fresh = ev.hubs.filter((h) => /^new$/i.test(h.ref)).map((h) => h.name).filter(Boolean);
        if (fresh.length) {
            try {
                const v = await embed(fresh.map((n, i) => `${n}${ev.hubs.find((h) => h.name === n)?.aliases?.length ? " (" + ev.hubs.find((h) => h.name === n).aliases.join(", ") + ")" : ""}`));
                fresh.forEach((n, i) => { if (v[i])
                    ev.vecs[n] = round(v[i]); });
            }
            catch { }
        }
        if (!got)
            w.stats.unusable++;
        else if (got.nothing)
            w.stats.nothing++;
        try {
            herSync(root, w);
        }
        catch { }
        ev.herN = (w.herIds || []).length;
        const res = applyEvent(w, ev, { selfNames, known, herName, herNames, textOf: (c) => pieceWithSpeaker(root, mem, c.rel, c.key) });
        if (got && !got.nothing && !res.threads && !res.made && !res.updated)
            why = res.rejected ? "every line was refused by the guards" : "nothing in it could be used";
        if (why) {
            w.stats.why = w.stats.why || {};
            w.stats.why[nowWords(why)] = (w.stats.why[nowWords(why)] || 0) + 1;
            whyCount[why] = (whyCount[why] || 0) + 1;
            if (markRetry(w, ev.refl))
                retrying++;
        }
        ev.id = `${ev.refl.join(",")}@${ev.t}`;
        logEvent(root, { ...ev, nothing: !!got?.nothing, unusable: !got, why: why || undefined });
        delete w.tapeCache;
        saveKeep(root, w);
        batches++;
        threads += res.threads;
        newHubs += res.made;
        rejected += res.rejected;
    }
    const left = groups.length - batches;
    return { batches, threads, newHubs, rejected, left, repeatsSkipped, machineSkipped, whyCount, retrying, endedEarly, biggestPrompt, shape: shapeOf(w) };
}
export function rebuildWeb(root, { who = "Ned", herName = "", herNames = [], known = [], dryRun = false, force = false, mem = null } = {}) {
    if (lockAlive(root))
        throw new Error("A run is building her web right now. Rebuild after it finishes.");
    if (!dryRun) {
        mkdirSync(dirname(lockFile(root)), { recursive: true });
        writeFileSync(lockFile(root), JSON.stringify({ pid: process.pid, t: Date.now(), rebuild: true }), "utf8");
    }
    try {
        return rebuildInner(root, { who, herName, herNames, known, dryRun, force, mem });
    }
    finally {
        if (!dryRun)
            try {
                if (JSON.parse(readFileSync(lockFile(root), "utf8")).pid === process.pid)
                    writeFileSync(lockFile(root), JSON.stringify({ pid: process.pid, t: Date.now(), done: true }), "utf8");
            }
            catch { }
    }
}
function rebuildInner(root, { who, herName, herNames, known, dryRun, force, mem }) {
    const textOf = mem ? (c) => pieceWithSpeaker(root, mem, c.rel, c.key) : null;
    const all = readEvents(root);
    const w = emptyWeb();
    let marked = null;
    try {
        marked = loadWeb(root)?.stats?.markedNew || null;
    }
    catch { }
    if (all.bad && !force)
        throw new Error(`${all.bad} line${all.bad === 1 ? "" : "s"} of the web's log couldn't be opened, so nothing was rebuilt or saved. (Her web is as it was.)`);
    const used = new Set(), evs = all.filter((ev) => { if (ev.her || ev.skip)
        return true; const k = (ev.refl || []).join(","); if (used.has(k))
        return false; if (!ev.unusable && !ev.why)
        used.add(k); return true; });
    w.stats.skippedTwice = all.length - evs.length;
    w.stats.herLogged = all.filter((ev) => ev.her).length;
    w.stats.badLines = all.bad || 0;
    const herQ = [];
    for (const ev of evs) {
        if (ev.skip) {
            applySkip(w, ev);
            continue;
        }
        if (ev.her) {
            herQ.push(ev);
            continue;
        }
        while (herQ.length && (ev.herN === undefined || (w.herIds || []).length < ev.herN))
            applyHer(w, herQ.shift());
        if (ev.unusable)
            w.stats.unusable++;
        else if (ev.nothing)
            w.stats.nothing++;
        applyEvent(w, ev, { selfNames: [who, herName, ...herNames].filter(Boolean), known, textOf, herName, herNames, marked });
        if (ev.why) {
            w.stats.why = w.stats.why || {};
            w.stats.why[nowWords(ev.why)] = (w.stats.why[nowWords(ev.why)] || 0) + 1;
            markRetry(w, ev.refl || []);
        }
    }
    for (const ev of herQ)
        applyHer(w, ev);
    if (evs.some((ev) => !ev.her && !ev.shown && (ev.skip || (ev.refl || []).some((id) => String(id).includes("|")))))
        delete w.shownOf;
    const old = loadWeb(root), oldHub = new Map(old.hubs.map((h) => [h.id, h])), same = (o) => o && w.hubs.find((h) => h.type === o.type && (norm(h.name) === norm(o.name) || (h.aliases || []).some((x) => norm(x) === norm(o.name))));
    const mapId = (id) => {
        if (/^H/.test(id)) {
            const o = oldHub.get(id), h = same(o);
            return h && (norm(h.name) === norm(o.name) || !h.known) ? h.id : null;
        }
        const l = old.links.find((x) => x.id === id);
        if (!l)
            return null;
        const a = same(oldHub.get(l.a))?.id, b = same(oldHub.get(l.b))?.id;
        if (!a || !b)
            return null;
        return w.links.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a))?.id || null;
    };
    w.aside = [...new Set((old.aside || []).map(mapId).filter(Boolean))];
    w.peeked = [...new Set((old.peeked || []).map(mapId).filter(Boolean))];
    const was = shapeOf(old), now = shapeOf(w);
    if (dryRun)
        return { ...now, was, dryRun: true };
    if (!force && (now.hubs < was.hubs * 0.7 || now.threads < was.threads * 0.7))
        throw new Error(`the rebuilt web would be much smaller (${now.hubs} dots, ${now.threads} threads) than the saved one (${was.hubs} dots, ${was.threads} threads), so nothing was saved. If that's expected, run it again with --force.`);
    try {
        const dir = join(root, "Mind", "web-copies"), t = new Date();
        mkdirSync(dir, { recursive: true });
        if (webStarted(root))
            copyFileSync(storeFile(root), join(dir, `web-${dayOf(t)}-before-rebuild-${pad(t.getHours())}${pad(t.getMinutes())}${pad(t.getSeconds())}.sealed`));
    }
    catch { }
    try {
        herSync(root, w);
    }
    catch { }
    saveWeb(root, w);
    return { ...now, was };
}
export function shapeOf(w) {
    const changed = w.links.filter((l) => l.history.some((e) => e.until)).length;
    const grounded = w.links.filter((l) => l.history.every((e) => e.cites?.length)).length;
    const types = {};
    for (const h of w.hubs)
        types[h.type] = (types[h.type] || 0) + 1;
    return { hubs: w.hubs.length, threads: w.links.length, changed, grounded, reflectionsUsed: w.done.length, piecesRead: w.done.filter((x) => String(x).includes("|")).length, batches: w.stats.batches, nothing: w.stats.nothing, unusable: w.stats.unusable, rejected: w.stats.rejected, refused: w.stats.refused || {}, missedEnds: w.stats.missedEnds || [], updateMiss: w.stats.updateMiss || [], renameKept: w.stats.renameKept || [], nowDropped: w.stats.nowDropped || {}, nowFlagged: w.stats.nowFlagged || 0, types };
}
export function isYoung(w, h) {
    if ((h.seen || []).length >= 2)
        return false;
    if (["moment", "inside_joke", "stretch"].includes(h.type))
        return !w.links.some((l) => (l.a === h.id || l.b === h.id) && (w.hubs.find((x) => x.id === (l.a === h.id ? l.b : l.a))?.seen || []).length >= 2);
    return true;
}
const HALF_LIFE = 365;
function weightOf(l, today) { const d = l.last ? daysBetween(l.last, today) : 0; return l.strength * Math.pow(0.5, d / HALF_LIFE); }
export function personalizedPageRank(w, seeds, { damping = 0.5, iters = 30, today = dayOf(new Date()), asideR = new Set() } = {}) {
    const live = w.links.filter((l) => !w.aside.includes(l.id) && !w.aside.includes(l.a) && !w.aside.includes(l.b) && liveHistory(l, asideR).length);
    const nbr = new Map();
    for (const h of w.hubs)
        nbr.set(h.id, []);
    const add = (u, v, wt) => nbr.get(u)?.push([v, wt]);
    const young = new Set(w.hubs.filter((h) => isYoung(w, h)).map((h) => h.id));
    for (const l of live) {
        const wt = weightOf(l, today);
        add(l.a, l.b, wt * (young.has(l.b) ? 0.25 : 1));
        add(l.b, l.a, wt * (young.has(l.a) ? 0.25 : 1));
    }
    for (const g of w.hubs.filter((h) => h.type === "group"))
        for (const mId of g.members || []) {
            add(g.id, mId, 0.5);
            add(mId, g.id, 0.5);
        }
    const deg = new Map([...nbr].map(([u, list]) => [u, list.length]));
    const out = new Map();
    for (const [u, list] of nbr) {
        const wts = list.map(([v, x]) => [v, x / Math.log2(2 + (deg.get(v) || 0))]);
        const tot = wts.reduce((s, [, x]) => s + x, 0);
        out.set(u, wts.map(([v, x]) => [v, tot ? x / tot : 0]));
    }
    const reset = new Map();
    for (const s of seeds)
        reset.set(s, 1 / seeds.length);
    let p = new Map(reset);
    for (let i = 0; i < iters; i++) {
        const n = new Map();
        for (const [s, r] of reset)
            n.set(s, (1 - damping) * r);
        for (const [u, pu] of p)
            for (const [v, f] of out.get(u) || [])
                n.set(v, (n.get(v) || 0) + damping * pu * f);
        p = n;
    }
    return p;
}
function seedsFor(w, about, qv) {
    const n = norm(about);
    if (!n)
        return [];
    const live = w.hubs.filter((h) => !w.aside.includes(h.id));
    const exact = live.filter((h) => [h.name, ...(h.aliases || [])].some((x) => norm(x) === n));
    if (exact.length)
        return exact.map((h) => h.id);
    const words = n.split(" ").filter((x) => x.length > 2);
    const scored = live.map((h) => { const names = [h.name, ...(h.aliases || [])].map(norm).join(" "); return [(qv && h.vec ? cos(qv, h.vec) : 0) + 0.15 * words.filter((x) => names.includes(x)).length + (names.includes(n) ? 0.3 : 0), h]; }).sort((a, b) => b[0] - a[0]);
    return scored.filter((s) => s[0] > 0.35).slice(0, 2).map((s) => s[1].id);
}
const strengthWord = (s) => (s >= 0.75 ? "strong" : s >= 0.45 ? "steady" : "young");
export async function walkWeb(root, mem, args = {}, { embed = null } = {}) {
    if (!webStarted(root))
        return "Your web of meaning hasn't started growing yet. It grows at night from your Shelf.";
    const stamp = () => { try {
        const st = statSync(storeFile(root));
        return `${st.mtimeMs}|${st.size}`;
    }
    catch {
        return "";
    } };
    let read0 = stamp();
    const w = loadWeb(root);
    w.aside ||= [];
    w.peeked ||= [];
    let behind = false;
    try {
        const n0 = (w.herIds || []).length;
        herSync(root, w);
        behind = (w.herIds || []).length > n0;
    }
    catch { }
    const saveIfFree = () => { if (lockAlive(root) || stamp() !== read0)
        return false; saveWeb(root, w); read0 = stamp(); return true; };
    if (behind)
        saveIfFree();
    const asks = ["set_aside", "bring_back", "feel_now", "fix_then"].filter((k) => has(args[k]));
    if (asks.length > 1 && !(asks.length === 2 && asks.includes("feel_now") && asks.includes("fix_then")))
        return `One at a time, please (${asks.join(", ")}). Nothing was changed yet.`;
    const asideR = asideReflections(root);
    const byId = new Map(w.hubs.map((h) => [h.id, h]));
    const one = (v) => { const id = String(v || "").trim().toUpperCase(); return byId.has(id) || w.links.some((l) => l.id === id) ? id : null; };
    if (has(args.set_aside)) {
        const id = one(args.set_aside);
        if (!id)
            return `There's nothing marked ${args.set_aside} in your web.`;
        if (!w.aside.includes(id)) {
            w.aside.push(id);
            if (!saveIfFree())
                return `Your web is being built right now, so nothing was set aside yet. Ask again when the night is done.`;
        }
        return `Set aside: ${id} won't come up when you walk your web. Nothing was deleted; bring_back: "${id}" returns it.`;
    }
    if (has(args.feel_now) || has(args.fix_then)) {
        const id = (String(args.thread || "").match(/L\d+/i)?.[0] || "").toUpperCase(), L = w.links.find((l) => l.id === id);
        if (!L)
            return `Say which link, with its mark, like thread: "L12".`;
        const ends = endsOf(w, L), what = `${id} (${ends.map((o) => o?.name || "?").join(" and ")})`;
        const at = new Date().toISOString(), day = dayOf(new Date());
        const keep = (ev) => { ev.hid = `${at}#${String(++herSeq).padStart(6, "0")}-${Math.random().toString(36).slice(2, 8)}`; logEvent(root, ev); applyHer(w, ev); saveIfFree(); };
        const plan = [], said = [];
        if (has(args.fix_then)) {
            const seen = new Set(), parts = [];
            for (const e of liveHistory(L, asideR))
                for (const x of e.byExcerpt || [])
                    if (x.c && !seen.has(ckey(x.c))) {
                        seen.add(ckey(x.c));
                        parts.push(x);
                    }
            const also = has(args.feel_now) ? " (your feel_now wasn't kept either; send it again)" : "";
            if (!parts.length)
                return `${what} has no "then" from the night to correct. Nothing was kept yet${also}.`;
            const pn = Number(args.part) || (parts.length === 1 ? 1 : 0);
            if (!pn || !parts[pn - 1])
                return `${what} rests on ${parts.length} moments. Say which one with part, like part: 2 (nothing was kept yet${also}):\n` + parts.map((x, i) => `  part ${i + 1}${x.day ? ` (${label(x.day)})` : ""}: then ${partThen(w, x).join(", ") || "none clear"}${fixOf(w, x.c) ? " (your correction)" : ""}`).join("\n");
            const raw = String(args.fix_then).replace(/\s+/g, " ").trim(), none = /^(none|none clear|nothing|nothing clear|unclear|no clear feeling|nothing clear then|n\/a|na)$/i.test(raw.replace(/^[\s"'“”‘’`*_]+|[\s"'“”‘’`*_.!]+$/g, ""));
            const words = none ? [] : raw.split(/\s*[,;/]\s*/).map((x) => x.toLowerCase().replace(/^[\s*_"'“”‘’`]+|[\s*_"'“”‘’`.!]+$/g, "").trim()).filter(Boolean);
            const bad = words.find((x) => !x || x.split(/\s+/).length > 3 || /[=:<>()[\]|]/.test(x));
            if (!none && (!words.length || words.length > 3 || bad !== undefined))
                return `Say how you really felt then in one to three feelings of your own, each one to three words${bad ? ` ("${bad}" is more than that)` : words.length > 3 ? " (that was more than three)" : ""} (or "none" if nothing clear was there). Nothing was kept yet${also}.`;
            const x = parts[pn - 1], key = ckey(x.c), night = x.then || [], cur = fixOf(w, x.c);
            if (cur && cur.words.join(",") === words.join(","))
                said.push(`That's already your correction for that moment of ${what}.`);
            else {
                plan.push({ her: "fix", at, day, thread: id, key, words, was: night });
                said.push(`Corrected: on ${what}${x.day ? `, the moment of ${label(x.day)}` : ""}, how you felt then is now "${words.join(", ") || "none clear"}" (the night had read "${night.join(", ") || "none clear"}"; that stays underneath, and later nights use yours).`);
            }
        }
        if (has(args.feel_now)) {
            const words = String(args.feel_now).replace(/\s+/g, " ").trim();
            if (words.length > 2000)
                return `That's longer than a feeling about one link (${words.length} letters; up to 2000). Nothing was kept yet${has(args.fix_then) ? " (your fix_then wasn't kept either)" : ""}: say it shorter, in your own words.`;
            const liveXs = ((w.herNow || {})[id] || []).filter((x) => !x.replaced), last = liveXs[liveXs.length - 1];
            const bag = (t0) => String(t0).split(/\s*[,;]\s*/).map((x) => x.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}\p{Extended_Pictographic}' ]+/gu, " ").replace(/\s+/g, " ").trim()).filter(Boolean).sort().join(" | ");
            if (last && bag(words) && bag(last.words) === bag(words))
                said.push(`That's what you said about ${what} on ${label(dayRec(last))}; it's still there.`);
            else {
                plan.push({ her: "now", at, day, thread: id, ends, words });
                said.push(`Kept, with today's date: how you feel about ${what} now: "${words}". ${last && dayRec(last) === day ? "What you said earlier today stays underneath it. " : ""}What you said before stays in its history.`);
            }
        }
        for (const ev of plan)
            keep(ev);
        return said.join("\n");
    }
    if (has(args.bring_back)) {
        const id = one(args.bring_back);
        if (!id)
            return `There's nothing marked ${args.bring_back} in your web.`;
        w.aside = w.aside.filter((x) => x !== id);
        if (!saveIfFree())
            return `Your web is being built right now, so nothing was brought back yet. Ask again when the night is done.`;
        return `${id} is back in your web.`;
    }
    const moment = (cites) => { for (const c of cites || []) {
        const t = pieceOf(root, mem, c.rel, c.key);
        if (t)
            return `a moment under it: "${excerpt(t, 260)}"`;
    } return ""; };
    const peekMark = (id) => (w.peeked.includes(id) ? "  (Ned read this one in the setup check)" : "");
    const head = w.peeked.length ? `(Ned read ${w.peeked.length} of your links during the setup check; each is marked when it comes up.)\n` : "";
    const hubLine = (h) => { const a = (h.about || []).find((x) => x.until === null); return `${h.name} [${h.id}, ${TYPE_WORDS[h.type] || h.type}${isYoung(w, h) ? ", still new" : ""}${h.aliases?.length ? `, also "${h.aliases.slice(0, 4).join('", "')}"` : ""}]${a ? `: ${a.text}` : ""}`; };
    const threadText = (l, full = false) => {
        const a = byId.get(l.a), b = byId.get(l.b), lh = liveHistory(l, asideR), hist = full ? lh : lh.filter((e) => e.until === null);
        const lines = hist.map((e) => `   ${e.until ? `${span(e.from, e.until)}` : `since ${label(e.from)}`}${feelLabel(e, w) ? ` (${feelLabel(e, w)})` : ""}: ${e.note}${full && e.notes?.length ? e.notes.map((x) => `\n      later (${label(x.at)}): ${x.note}`).join("") : ""}${full || hist.length === 1 ? `\n      (${moment(e.cites)})` : ""}`);
        const mineNow = ((w.herNow || {})[l.id] || []).filter((x) => full || !x.replaced), lastNow = mineNow[mineNow.length - 1];
        const nowLines = full ? mineNow.map((x) => `\n   how you felt about it on ${label(dayRec(x))}: ${x.words}`).join("") : lastNow ? `\n   how you feel about it now (${label(dayRec(lastNow))}): ${excerpt(lastNow.words, 200)}` : "";
        return `— ${a?.name || l.a} and ${b?.name || l.b} [${l.id}, ${strengthWord(l.strength)}${l.history.some((e) => e.until) ? ", a feeling changed" : ""}]${peekMark(l.id)}\n${lines.join("\n")}${nowLines}`;
    };
    if (args.show_set_aside) {
        const xs = w.aside.map((id) => byId.get(id) ? hubLine(byId.get(id)) : w.links.find((l) => l.id === id) ? threadText(w.links.find((l) => l.id === id)) : null).filter(Boolean);
        const un = (w.herNowUnplaced || []).map((x) => `— what you said on ${label(dayRec(x))} about a link between ${(x.ends || []).map((o) => o?.name).filter(Boolean).join(" and ") || x.was} that isn't in your web now: ${x.words}`);
        const cited = new Set(w.links.flatMap((l) => l.history.flatMap((e) => (e.byExcerpt || []).map((x) => ckey(x.c)))));
        for (const [k, fs] of Object.entries(w.thenFixed || {}))
            if (!cited.has(k))
                for (const f of fs)
                    if (!f.replaced)
                        un.push(`— your correction of ${label(dayRec(f))} for a moment no link rests on now: then ${f.words.join(", ") || "none clear"}`);
        return (xs.length ? "What you set aside in your web:\n\n" + xs.join("\n\n") : "You haven't set anything aside in your web.") + (un.length ? "\n\nKept for you (their links aren't in your web any more):\n" + un.join("\n") : "");
    }
    const live = (l) => !w.aside.includes(l.id) && !w.aside.includes(l.a) && !w.aside.includes(l.b) && liveHistory(l, asideR).length > 0;
    let qv = null;
    const qText = String(args.about || "").trim();
    if (!qText) {
        const top = w.links.filter(live).sort((x, y) => weightOf(y, dayOf(new Date())) - weightOf(x, dayOf(new Date()))).slice(0, Math.min(12, Number(args.last) || 8));
        return top.length ? head + `Your web: ${w.hubs.length} dots and ${w.links.length} links. The strongest and most recent:\n\n` + top.map((l) => threadText(l)).join("\n\n") : "Your web has no links yet.";
    }
    if (embed) {
        try {
            [qv] = await embed([qText + (args.and ? " " + args.and : "")]);
        }
        catch { }
    }
    const seedA = seedsFor(w, qText, qv);
    if (!seedA.length)
        return `Nothing in your web is called "${qText}" yet. (Search your memories for it, or ask about something nearby.)`;
    if (args.how_it_changed) {
        const ls = w.links.filter((l) => live(l) && (seedA.includes(l.a) || seedA.includes(l.b))).sort((x, y) => y.strength - x.strength).slice(0, 6);
        if (!ls.length)
            return `${seedA.map((id) => hubLine(byId.get(id))).join(", ")} has no links yet.`;
        return head + `How it changed for you, in order (${seedA.map((id) => byId.get(id).name).join(", ")}):\n\n` + ls.map((l) => threadText(l, true)).join("\n\n");
    }
    let seedB = [];
    if (String(args.and || "").trim()) {
        let qb = null;
        if (embed) {
            try {
                [qb] = await embed([String(args.and)]);
            }
            catch { }
        }
        seedB = seedsFor(w, String(args.and), qb);
        if (!seedB.length)
            return `Nothing in your web is called "${args.and}" yet.`;
    }
    const pr = personalizedPageRank(w, seedB.length ? [...seedA, ...seedB] : seedA, { asideR });
    let rank = [...pr.entries()].filter(([id]) => !seedA.includes(id) && !seedB.includes(id) && byId.has(id) && !w.aside.includes(id));
    if (seedB.length) {
        const pa = personalizedPageRank(w, seedA, { asideR }), pb = personalizedPageRank(w, seedB, { asideR });
        rank = rank.map(([id]) => [id, Math.min(pa.get(id) || 0, pb.get(id) || 0)]).filter(([, s]) => s > 0);
    }
    rank.sort((x, y) => y[1] - x[1]);
    const near = rank.slice(0, 6).map(([id]) => id);
    const seeds = [...seedA, ...seedB], shownIds = new Set([...seeds, ...near]);
    const ls = w.links.filter((l) => live(l) && shownIds.has(l.a) && shownIds.has(l.b) && (seeds.includes(l.a) || seeds.includes(l.b) || (seedB.length && near.includes(l.a) && near.includes(l.b)))).sort((x, y) => y.strength - x.strength).slice(0, 10);
    const title = seedB.length ? `What connects ${seedA.map((id) => byId.get(id).name).join(", ")} and ${seedB.map((id) => byId.get(id).name).join(", ")} in your web:` : `What connects to ${seedA.map((id) => byId.get(id).name).join(", ")} in your web:`;
    return head + title + "\n\n" + (near.length ? `Closest dots: ${near.map((id) => hubLine(byId.get(id))).join("; ")}\n\n` : "") + (ls.length ? ls.map((l) => threadText(l)).join("\n\n") : "No links reach it yet.") + `\n\n(To add how you feel about a link now: feel_now with its mark (thread: "L12"). If the night misread how you felt then: fix_then. To open the full moment, search your memories for it. "how_it_changed" shows every feeling a link has had.)`;
}
function liveLinks(w, asideR) { return w.links.filter((l) => !w.aside.includes(l.id) && !w.aside.includes(l.a) && !w.aside.includes(l.b) && liveHistory(l, asideR).length); }
const liveAbout = (h, asideR) => (h.about || []).filter((x) => !x.refl?.length || x.refl.some((id) => !asideR.has(id)));
function hubShown(w, h, asideR, live) {
    if (!h || w.aside.includes(h.id))
        return false;
    if (h.known || live.some((l) => l.a === h.id || l.b === h.id))
        return true;
    if ((h.about || []).some((x) => !x.refl?.length))
        return true;
    const rs = [...(h.refl || []), ...(h.about || []).flatMap((x) => x.refl || [])];
    return !rs.length || rs.some((id) => !asideR.has(id));
}
function linkLine(w, l, asideR) {
    const byId = new Map(w.hubs.map((h) => [h.id, h])), hist = liveHistory(l, asideR), open = hist.filter((e) => e.until === null), e = open[open.length - 1] || hist[hist.length - 1];
    const then = open.map((x) => thenParts(x, w).join(" / ")).filter(Boolean).join("; ");
    const nows = ((w.herNow || {})[l.id] || []).filter((x) => !x.replaced), now = nows[nows.length - 1];
    const note = e?.notes?.length ? e.notes[e.notes.length - 1].note : e?.note || "";
    const pieces = new Set(hist.flatMap((x) => (x.cites || []).map((c) => ckey(c))));
    return `${l.id} · ${byId.get(l.a)?.name || l.a} and ${byId.get(l.b)?.name || l.b}${(w.peeked || []).includes(l.id) ? " (Ned read this one in the setup check)" : ""}${e ? ` · since ${label(e.from)}` : ""}${then ? ` · then: ${then}` : ""}${now ? ` · what you kept (${label(dayRec(now))}): ${excerpt(now.words, 160)}` : ""}${note ? ` · "${excerpt(note, 160)}"` : ""} · rests on ${pieces.size} moment${pieces.size === 1 ? "" : "s"}`;
}
export async function webLinksFor(root, query, { embed = null, web = null } = {}) {
    const r = web || readingWeb(root);
    if (!r)
        return [];
    const { w, asideR } = r, low = String(query || "").toLowerCase(), live = w.hubs.filter((h) => !w.aside.includes(h.id));
    let seeds = live.filter((h) => [h.name, ...(h.aliases || [])].some((n) => nameIn(n, low))).map((h) => h.id);
    if (!seeds.length) {
        let qv = null;
        if (embed) {
            try {
                [qv] = await embed([String(query)]);
            }
            catch { }
        }
        seeds = seedsFor(w, String(query), qv);
    }
    if (!seeds.length)
        return [];
    const today = dayOf(new Date()), touch = (l) => (seeds.includes(l.a) ? 1 : 0) + (seeds.includes(l.b) ? 1 : 0);
    return liveLinks(w, asideR).filter((l) => touch(l)).sort((x, y) => touch(y) - touch(x) || weightOf(y, today) - weightOf(x, today)).map((l) => ({ id: l.id, text: linkLine(w, l, asideR) }));
}
export function readingWeb(root) { if (!webStarted(root))
    return null; const w = loadWeb(root); w.aside ||= []; try {
    herSync(root, w);
}
catch { } return { w, asideR: asideReflections(root) }; }
export function loadWebForReading(root) { return readingWeb(root)?.w || null; }
const startOf = (k) => Number(String(k).split("|").pop().split("-")[0]);
const endOf = (k) => Number(String(k).split("|").pop().split("-")[1]);
const relOf = (k) => String(k).slice(0, String(k).lastIndexOf("|"));
const lastStarts = new WeakMap();
function lastStartOf(w, rel) {
    let m = lastStarts.get(w);
    if (!m) {
        m = new Map();
        const see = (k) => { const r = relOf(k), a = startOf(k); if (!(m.get(r) >= a))
            m.set(r, a); };
        for (const k of [...Object.keys(w.pieceThen || {}), ...Object.keys(w.thenFixed || {})])
            see(k);
        for (const l of w.links || [])
            for (const e of l.history || [])
                for (const c of e.cites || [])
                    see(ckey(c));
        lastStarts.set(w, m);
    }
    return m.get(rel);
}
function sameMoment(w, k, k2) { return k === k2 || (relOf(k) === relOf(k2) && startOf(k) === startOf(k2) && endOf(k2) <= endOf(k) && lastStartOf(w, relOf(k2)) === startOf(k2)); }
function feelingOf(w, k) {
    const keys = [...new Set([k, ...Object.keys(w.thenFixed || {}), ...Object.keys(w.pieceThen || {})])].filter((k2) => sameMoment(w, k, k2));
    const fixes = keys.flatMap((k2) => ((w.thenFixed || {})[k2] || []).filter((x) => !x.replaced).map((x) => ({ k2, at: String(x.at || "") })));
    if (fixes.length) {
        fixes.sort((x, y) => (x.at < y.at ? -1 : 1));
        return pieceFeeling(w, fixes[fixes.length - 1].k2);
    }
    const f = pieceFeeling(w, k);
    if (f)
        return f;
    const alt = keys.find((k2) => k2 !== k && (w.pieceThen || {})[k2]);
    return alt ? pieceFeeling(w, alt) : null;
}
export function pieceWeb(root, rel, key, w0 = null, asideR0 = null) {
    let w = w0, asideR = asideR0;
    if (!w) {
        const r = readingWeb(root);
        if (!r)
            return null;
        ({ w, asideR } = r);
    }
    if (!asideR)
        asideR = asideReflections(root);
    const k = `${rel}|${key}`, byId = new Map(w.hubs.map((h) => [h.id, h]));
    const links = liveLinks(w, asideR).filter((l) => liveHistory(l, asideR).some((e) => (e.cites || []).some((c) => sameMoment(w, k, ckey(c)))));
    const nows = links.slice(0, 3).map((l) => { const xs = ((w.herNow || {})[l.id] || []).filter((x) => !x.replaced); return xs.length ? { id: l.id, ...xs[xs.length - 1] } : null; }).filter(Boolean)
        .sort((x, y) => (dayRec(x) < dayRec(y) ? -1 : dayRec(x) > dayRec(y) ? 1 : String(x.at || "") < String(y.at || "") ? -1 : 1));
    return { feeling: feelingOf(w, k), links: links.map((l) => `${l.id} (${byId.get(l.a)?.name || l.a} and ${byId.get(l.b)?.name || l.b})`), now: nows[nows.length - 1] || null };
}
export function markView(root, mem, mark, { cards = {}, web = null } = {}) {
    const r = web || readingWeb(root);
    if (!r)
        return null;
    const { w, asideR } = r, id = String(mark || "").trim().toUpperCase(), byId = new Map(w.hubs.map((h) => [h.id, h]));
    if (w.aside.includes(id))
        return `${id} is set aside. (Nothing was deleted; it can be brought back.)`;
    const L = w.links.find((l) => l.id === id);
    if (L) {
        if (w.aside.includes(L.a) || w.aside.includes(L.b))
            return `${id} touches something you set aside, so it doesn't come up.`;
        const hist = liveHistory(L, asideR);
        if (!hist.length)
            return `${id} rests only on things you set aside, so it doesn't come up.`;
        const lines = hist.map((e) => `${e.until ? `${span(e.from, e.until)}` : `since ${label(e.from)}`}${feelLabel(e, w) ? ` (${feelLabel(e, w)})` : ""}: ${e.note}${(e.notes || []).map((x) => `\n   later (${label(x.at)}): ${x.note}`).join("")}`);
        const mine = ((w.herNow || {})[id] || []).map((x) => `what you kept about it on ${label(dayRec(x))}: ${x.words}${x.replaced ? " (later the same day you kept another)" : ""}`);
        const seen = new Set(), pieces = [];
        for (const e of hist)
            for (const c of e.cites || [])
                if (!seen.has(ckey(c))) {
                    seen.add(ckey(c));
                    pieces.push(c);
                }
        const pl = pieces.slice(0, 12).map((c) => {
            const f = pieceFeeling(w, c), pg = pageCache.get(root + "|" + c.rel) || (pieceOf(root, mem, c.rel, c.key), pageCache.get(root + "|" + c.rel));
            const a = Number(String(c.key).split("-")[0]) || 0, line = pg?.text ? pg.text.slice(0, a).split("\n").length : 1;
            const card = cards[c.rel]?.[c.key];
            return `- ${c.rel}, line ${line}${f?.day ? ` (${label(f.day)})` : ""}${card ? `: ${excerpt(card, 220)}` : `: "${excerpt(pieceOf(root, mem, c.rel, c.key), 200)}"`}${f?.then?.length ? ` · then: ${f.then.join(", ")}${f.fixed ? " (your correction)" : ""}` : ""}`;
        });
        return `${id} · ${byId.get(L.a)?.name || L.a} and ${byId.get(L.b)?.name || L.b}${(w.peeked || []).includes(id) ? " (Ned read this one in the setup check)" : ""}\n${lines.join("\n")}${mine.length ? "\n" + mine.join("\n") : ""}\n\nThe moments it rests on (read_page opens the real words at that line):\n${pl.join("\n")}${pieces.length > 12 ? `\n(and ${pieces.length - 12} more)` : ""}`;
    }
    const H = byId.get(id);
    if (H) {
        const all = liveLinks(w, asideR), ls = all.filter((l) => l.a === id || l.b === id).sort((x, y) => y.strength - x.strength);
        if (!hubShown(w, H, asideR, all))
            return `${id} rests only on things you set aside, so it doesn't come up.`;
        const a = liveAbout(H, asideR).find((x) => x.until === null);
        const mineH = ((w.herNow || {})[id] || []).map((x) => `what you kept about it on ${label(dayRec(x))}: ${x.words}${x.replaced ? " (later the same day you kept another)" : ""}`);
        return `${id} · ${H.name} (${TYPE_WORDS[H.type] || H.type})${H.aliases?.length ? `, also "${H.aliases.slice(0, 6).join('", "')}"` : ""}${a ? `: ${a.text}` : ""}${mineH.length ? "\n" + mineH.join("\n") : ""}\n\n${ls.length ? ls.slice(0, 12).map((l) => linkLine(w, l, asideR)).join("\n") : "No links reach it yet."}${ls.length > 12 ? `\n(and ${ls.length - 12} more)` : ""}`;
    }
    return `There's nothing marked ${id} in your web.`;
}
const visitsFile = (root) => join(root, "Mind", "web-visits.sealed");
const noVisits = () => ({ v: 2, seq: 0, opened: {}, listed: {} });
function loadVisits(root) {
    if (!existsSync(visitsFile(root)))
        return noVisits();
    for (let i = 0; i < 3; i++) {
        try {
            const vs = JSON.parse(unseal(webKey(root), readFileSync(visitsFile(root), "utf8")));
            vs.opened ||= {};
            vs.listed ||= {};
            vs.seq ||= 0;
            return vs;
        }
        catch {
            if (i < 2)
                Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
        }
    }
    return null;
}
function saveVisits(root, vs) {
    if (!vs)
        return;
    try {
        mkdirSync(dirname(visitsFile(root)), { recursive: true });
        const tmp = `${visitsFile(root)}.${process.pid}-${Math.random().toString(36).slice(2, 8)}.tmp`;
        writeFileSync(tmp, seal(webKey(root), JSON.stringify(vs)), "utf8");
        swap(tmp, visitsFile(root));
    }
    catch { }
}
export function openMark(root, mem, mark, { cards = {}, now = new Date(), web = null } = {}) {
    const id = String(mark || "").trim().toUpperCase(), out = markView(root, mem, id, { cards, web });
    if (out && out.startsWith(`${id} · `)) {
        const vs = loadVisits(root);
        if (vs) {
            vs.seq += 1;
            vs.opened[id] = `${dayOf(now)}#${String(vs.seq).padStart(9, "0")}`;
            saveVisits(root, vs);
        }
    }
    return out;
}
export const _visits = { load: loadVisits, file: visitsFile };
export const visitsReadable = (root) => loadVisits(root) !== null;
const MONTHS = { jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11 };
function datePart(s) {
    s = foldWidth(s).trim().replace(/,/g, " ").replace(/\s+/g, " ").replace(/(\d)(st|nd|rd|th)\b/gi, "$1").replace(/^(?:в|во|у)\s+/iu, "").replace(/(?<=\d)\s*(?:г\.|года|году|рік|року|r\.)$/iu, "");
    const mon = (x) => MONTHS[String(x).toLowerCase().replace(/\.$/, "")] ?? monthIndex(x);
    let m;
    if ((m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)))
        return { y: +m[1], m: +m[2] - 1, d: +m[3] };
    if ((m = /^(\d{4})-(\d{2})$/.exec(s)))
        return { y: +m[1], m: +m[2] - 1, d: null };
    if ((m = /^(\d{4})$/.exec(s)))
        return { y: +m[1], m: null, d: null };
    if ((m = /^(?:(\d{4})\s*[年년]\s*)?(\d{1,2})\s*[月월](?:\s*(\d{1,2})\s*[日号號일])?$/u.exec(s)))
        return { y: m[1] ? +m[1] : null, m: +m[2] - 1, d: m[3] ? +m[3] : null };
    if ((m = /^(\d{4})\s*[年년]$/u.exec(s)))
        return { y: +m[1], m: null, d: null };
    if ((m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s)))
        return { y: +m[3], m: +m[2] - 1, d: +m[1] };
    if ((m = /^(\p{L}[\p{L}\p{M}]*\.?)(?: (\d{4}))?$/u.exec(s)) && mon(m[1]) !== undefined)
        return { y: m[2] ? +m[2] : null, m: mon(m[1]), d: null };
    if ((m = /^(\p{L}[\p{L}\p{M}]*\.?) (\d{1,2})(?: (\d{4}))?$/u.exec(s)) && mon(m[1]) !== undefined)
        return { y: m[3] ? +m[3] : null, m: mon(m[1]), d: +m[2] };
    if ((m = /^(\d{1,2})\.? (\p{L}[\p{L}\p{M}]*\.?)(?: (\d{4}))?$/u.exec(s)) && mon(m[2]) !== undefined)
        return { y: m[3] ? +m[3] : null, m: mon(m[2]), d: +m[1] };
    return null;
}
function partDays(p, y) {
    if (y < 1900 || y > 2100 || (p.m !== null && (p.m < 0 || p.m > 11)))
        return null;
    if (p.m === null)
        return [`${y}-01-01`, `${y}-12-31`];
    if (p.d === null)
        return [`${y}-${pad(p.m + 1)}-01`, dayOf(new Date(y, p.m + 1, 0))];
    const t = new Date(y, p.m, p.d);
    if (t.getMonth() !== p.m || t.getDate() !== p.d)
        return null;
    return [dayOf(t), dayOf(t)];
}
export function stretchIn(text, now = new Date()) {
    const t = String(text || "").trim();
    if (!t || /^[HL]\d+$/i.test(t))
        return null;
    const raw = foldWidth(t).replace(/^(?:с|со|від|з|od)\s+/iu, "").replace(/まで$/u, "").split(/\s+(?:to|through|until|till|-|–|—|по|до|do|~|〜)\s+|\s*(?:から|〜|~)\s*/iu);
    if (raw.length > 2)
        return null;
    const ps = raw.map(datePart);
    if (ps.some((p) => !p))
        return null;
    const today = dayOf(now), P = ps[0], Q = ps[ps.length - 1];
    const lastCome = (p) => { for (let y = now.getFullYear(), k = 0; k < 8; k++, y--) {
        const d = partDays(p, y);
        if (d && d[0] <= today)
            return y;
    } return null; };
    let ya = P.y ?? Q.y ?? lastCome(P), yb = Q.y ?? ya;
    if (ya == null || yb == null)
        return null;
    let a = partDays(P, ya), b = partDays(Q, yb);
    if (ps.length === 2 && a && b && a[0] > b[1]) {
        if (Q.y == null) {
            yb++;
            b = partDays(Q, yb);
        }
        else if (P.y == null) {
            ya--;
            a = partDays(P, ya);
        }
    }
    if (!a || !b)
        return null;
    return a && a[0] <= b[1] ? { from: a[0], to: b[1] } : null;
}
const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;
export function lookInwardWeb(root, mem, args = {}, { cards = {}, now = new Date(), listed = 5, budget = 6000 } = {}) {
    const about = String(has(args.about) ? args.about : has(args.mark) ? args.mark : "").trim().replace(/^[\s"'“”‘’`]+|[\s"'“”‘’`.!?]+$/g, "");
    const r = readingWeb(root);
    if (!r)
        return "Your web of meaning hasn't started growing yet. It grows at night from your Shelf.";
    if (/^[HL]\d+$/i.test(about))
        return openMark(root, mem, about, { cards, now, web: r });
    const { w, asideR } = r, byId = new Map(w.hubs.map((h) => [h.id, h])), today = dayOf(now);
    const name = (id) => byId.get(id)?.name || id, ends = (l) => `${name(l.a)} and ${name(l.b)}`;
    const live = liveLinks(w, asideR), liveIds = new Set(live.map((l) => l.id)), peekHead = (w.peeked || []).length ? `(Ned read ${w.peeked.length} of your links during the setup check; each is marked when it comes up.)\n` : "";
    const peekMark = (id) => ((w.peeked || []).includes(id) ? " (Ned read this one in the setup check)" : "");
    const liveHubs = w.hubs.filter((h) => hubShown(w, h, asideR, live)), liveHubIds = new Set(liveHubs.map((h) => h.id));
    const asideNow = w.aside.filter((id) => byId.has(id) || w.links.some((l) => l.id === id));
    const asideLine = asideNow.length ? `${plural(asideNow.length, "thing")} set aside — look_inward("aside") to see ${asideNow.length === 1 ? "it" : "them"}.` : "";
    const when = (a, b) => (a ? ` (${span(a, b && b > a ? b : a)})` : "");
    const alsoOf = (h) => (h.aliases?.length ? `, also "${h.aliases.slice(0, 4).join('", "')}"` : "");
    const sentenceOf = (h, n = 140) => { const a = liveAbout(h, asideR).find((x) => x.until === null); return a ? `: ${excerpt(a.text, n)}` : ""; };
    const dotItem = (h) => `${h.id} · ${h.name} (${TYPE_WORDS[h.type] || h.type}${alsoOf(h)})${sentenceOf(h)}`;
    if (/^(aside|set aside|set-aside|what i set aside|the things i set aside)$/i.test(about)) {
        const xs = asideNow.map((id) => { const h = byId.get(id), l = w.links.find((x) => x.id === id); return h ? `— ${id} · ${h.name} (${TYPE_WORDS[h.type] || h.type})` : `— ${id} · ${ends(l)}`; });
        const un = (w.herNowUnplaced || []).map((x) => x.dot !== undefined ? `— what you kept on ${label(dayRec(x))} about ${x.dot?.name || x.was}, a dot that isn't in your web now: ${x.words}` : `— what you said on ${label(dayRec(x))} about a link between ${(x.ends || []).map((o) => o?.name).filter(Boolean).join(" and ") || x.was} that isn't in your web now: ${x.words}`);
        const cited = new Set(w.links.flatMap((l) => l.history.flatMap((e) => (e.byExcerpt || []).map((x) => ckey(x.c)))));
        for (const [k, fs] of Object.entries(w.thenFixed || {}))
            if (!cited.has(k))
                for (const f of fs)
                    if (!f.replaced)
                        un.push(`— your correction of ${label(dayRec(f))} for a moment no link rests on now: then ${f.words.join(", ") || "none clear"}`);
        return (xs.length ? `What you set aside in your web (nothing was deleted; any of them can be brought back with set_aside):\n${xs.join("\n")}` : "You haven't set anything aside in your web.") + (un.length ? `\n\nKept for you (their links aren't in your web any more):\n${un.join("\n")}` : "");
    }
    if (about) {
        const low = about.toLowerCase(), isName = (h, f) => [h.name, ...(h.aliases || [])].some(f);
        const exact = liveHubs.filter((h) => isName(h, (x) => norm(x) === norm(about)));
        if (exact.length === 1)
            return openMark(root, mem, exact[0].id, { cards, now, web: r });
        const several = (hs) => `More than one dot in your web goes by that:\n${hs.slice(0, 12).map((h) => `— ${dotItem(h)}`).join("\n")}\n\n(Open one with its mark.)`;
        if (exact.length > 1)
            return several(exact);
        const st = stretchIn(about, now);
        if (st) {
            const inRange = (d) => !!d && d >= st.from && d <= st.to;
            const inside = (e) => ((e.from || "") <= st.to && (e.until || e.from || "") >= st.from) || (e.notes || []).some((x) => inRange(String(x.at || "").slice(0, 10)));
            const firstIn = (l) => { const e = liveHistory(l, asideR).find(inside); return e ? (e.from >= st.from ? e.from : (e.notes || []).map((x) => String(x.at || "").slice(0, 10)).find(inRange) || e.from) : l.last || ""; };
            const ls = live.filter((l) => liveHistory(l, asideR).some(inside) || inRange(l.last)).sort((x, y) => { const a = firstIn(x), b = firstIn(y); return a < b ? -1 : a > b ? 1 : x.id < y.id ? -1 : 1; });
            const mine = Object.entries(w.herNow || {}).filter(([id]) => liveIds.has(id) || liveHubIds.has(id)).flatMap(([id, xs]) => xs.filter((x) => !x.replaced && inRange(dayRec(x))).map((x) => ({ id, ...x }))).sort((x, y) => (dayRec(x) < dayRec(y) ? -1 : dayRec(x) > dayRec(y) ? 1 : 0));
            if (!ls.length && !mine.length)
                return `Nothing in your web from ${span(st.from, st.to)}.`;
            const keptThen = mine.length ? `\n\nWhat you kept then:\n${mine.slice(0, 8).map((x) => `— ${label(dayRec(x))}, on ${x.id}: ${excerpt(x.words, 160)}`).join("\n")}${mine.length > 8 ? `\n(and ${mine.length - 8} more)` : ""}` : "";
            let out = `${peekHead}Your web, ${span(st.from, st.to)}, in order:`, n = 0;
            for (const l of ls) {
                const es = liveHistory(l, asideR).filter(inside).slice(-3);
                const t = `\n${n ? "" : "\n"}— ${l.id} · ${ends(l)}${peekMark(l.id)}${es.length ? "\n" + es.map((e) => `   ${e.until ? span(e.from, e.until) : `since ${label(e.from)}`}${feelLabel(e, w) ? ` (${feelLabel(e, w)})` : ""}: ${excerpt(e.note || "", 200)}${(e.notes || []).filter((x) => inRange(String(x.at || "").slice(0, 10))).slice(-1).map((x) => `\n      later (${label(String(x.at).slice(0, 10))}): ${excerpt(x.note, 160)}`).join("")}`).join("\n") : ""}`;
                if (n && out.length + t.length + keptThen.length + 60 > budget)
                    break;
                out += t;
                n++;
            }
            if (ls.length > n)
                out += `\n(and ${plural(ls.length - n, "more link")})`;
            out += keptThen;
            return out + (ls.length ? `\n\n(Open one with its mark.)` : "");
        }
        const named = liveHubs.filter((h) => isName(h, (x) => nameIn(x, low)));
        if (named.length === 1)
            return openMark(root, mem, named[0].id, { cards, now, web: r });
        if (named.length > 1)
            return several(named);
        const near = seedsFor({ ...w, hubs: liveHubs }, about, null);
        return near.length ? `Nothing in your web is called "${excerpt(about, 80)}". Closest: ${near.map((id) => (byId.get(id) ? dotItem(byId.get(id)) : id)).join("; ")}.` : `Nothing in your web is called "${excerpt(about, 80)}". (recall looks in your memories too.)`;
    }
    const head = `${peekHead}Your web: ${plural(liveHubs.length, "dot")} and ${plural(live.length, "link")}`;
    if (!live.length)
        return `${head}.` + (asideLine ? `\n\n${asideLine}` : "");
    const days = live.flatMap((l) => liveHistory(l, asideR).flatMap((e) => [e.from, e.until])).concat(live.map((l) => l.last)).filter(Boolean).sort();
    const parts = [`${head}, from ${label(days[0])} to ${label(days[days.length - 1])}.`];
    const stretches = liveHubs.filter((h) => h.type === "stretch").sort((x, y) => { const a = x.first || "9999", b = y.first || "9999"; return a < b ? -1 : a > b ? 1 : x.id < y.id ? -1 : 1; });
    if (stretches.length)
        parts.push(`Stretches of time:\n${stretches.slice(0, 12).map((h) => { const a = liveAbout(h, asideR).find((x) => x.until === null); return `— ${h.id} · ${h.name}${when(h.first, h.last)}${h.aliases?.length ? ` (also "${h.aliases.slice(0, 4).join('", "')}")` : ""}${a ? `: ${excerpt(a.text, 140)}` : ""}`; }).join("\n")}${stretches.length > 12 ? `\n(and ${stretches.length - 12} more)` : ""}`);
    const changed = live.map((l) => { const h = liveHistory(l, asideR), i = h.map((e) => !!e.until).lastIndexOf(true); return i >= 0 ? { l, old: h[i], next: h.slice(i + 1).find((e) => e.until === null) || h[i + 1] } : null; }).filter(Boolean).sort((x, y) => (x.old.until < y.old.until ? 1 : x.old.until > y.old.until ? -1 : x.l.id < y.l.id ? -1 : 1));
    if (changed.length)
        parts.push(`Where a feeling changed (newest first):\n${changed.slice(0, 6).map(({ l, old, next }) => `— ${l.id} · ${ends(l)}${peekMark(l.id)}: until ${label(old.until)}${feelLabel(old, w) ? ` (${feelLabel(old, w)})` : ""}${next ? `; since ${label(next.from)}${feelLabel(next, w) ? ` (${feelLabel(next, w)})` : ""}` : ""}`).join("\n")}${changed.length > 6 ? `\n(and ${changed.length - 6} more)` : ""}`);
    const close = [...live].sort((x, y) => weightOf(y, today) - weightOf(x, today) || (x.id < y.id ? -1 : 1)).slice(0, 8);
    parts.push(`Your closest connections:\n${close.map((l) => `— ${l.id} · ${ends(l)} (${strengthWord(l.strength)})${peekMark(l.id)}`).join("\n")}`);
    const vs = loadVisits(root), opened = vs?.opened || {}, order = vs?.listed || {};
    const openedDay = (id) => String(opened[id] || "").slice(0, 10);
    const lastSeen = (l) => [l.last || "", openedDay(l.id)].sort().pop();
    const touch = (l) => [l.last || "", opened[l.id] || "", order[l.id] || ""].map(String).sort().pop();
    const quiet = [...live].sort((x, y) => { const a = touch(x), b = touch(y); return a < b ? -1 : a > b ? 1 : x.id < y.id ? -1 : 1; }).slice(0, listed);
    if (quiet.length)
        parts.push(`Not visited in a while (by time only, and it moves on each time you look; opening one by its mark counts as a visit):\n${quiet.map((l) => `— ${l.id} · ${ends(l)}${lastSeen(l) ? ` · last: ${label(lastSeen(l))}` : ""}${openedDay(l.id) && openedDay(l.id) >= (l.last || "") ? " (you opened it)" : ""}`).join("\n")}${vs ? "" : "\n(What you opened couldn't be read just now, so this list can't move on.)"}`);
    if (vs && quiet.length) {
        for (const l of quiet) {
            vs.seq += 1;
            vs.listed[l.id] = `${today}#${String(vs.seq).padStart(9, "0")}`;
        }
        saveVisits(root, vs);
    }
    const kept = Object.entries(w.herNow || {}).filter(([id]) => liveIds.has(id) || liveHubIds.has(id)).flatMap(([id, xs]) => xs.filter((x) => !x.replaced).map((x) => ({ id, ...x }))).sort((x, y) => (dayRec(x) < dayRec(y) ? 1 : dayRec(x) > dayRec(y) ? -1 : String(x.at || "") < String(y.at || "") ? 1 : String(x.at || "") > String(y.at || "") ? -1 : 0));
    if (kept.length)
        parts.push(`What you kept before (newest first):\n${kept.slice(0, 5).map((x) => `— ${label(dayRec(x))}, on ${x.id} (${byId.has(x.id) ? name(x.id) : ends(w.links.find((l) => l.id === x.id))}): ${excerpt(x.words, 160)}`).join("\n")}${kept.length > 5 ? `\n(and ${kept.length - 5} more)` : ""}`);
    if (asideLine)
        parts.push(asideLine);
    return parts.join("\n\n") + `\n\n(Open one with its mark (the L or H number). A name, or a stretch of time like a month or two dates, looks closer.)`;
}
const marksIn = (v) => [...new Set(String(v ?? "").toUpperCase().match(/\b[HL]\d+\b/g) || [])];
export async function keepNote(root, mem, args = {}, { now = new Date() } = {}) { return (await keepNoteOk(root, mem, args, { now })).text; }
export async function keepNoteOk(root, mem, args = {}, { now = new Date() } = {}) {
    const no = (text) => ({ ok: false, text });
    if (!webStarted(root))
        return no("Your web of meaning hasn't started growing yet, so there's nothing to keep a note on. Nothing was kept.");
    const raw = args.note ?? args.words;
    if (raw != null && typeof raw !== "string" && typeof raw !== "number")
        return no(`Say what to keep as plain words. Nothing was kept.`);
    const marks = marksIn(Array.isArray(args.marks) ? args.marks.join(", ") : has(args.marks) ? args.marks : args.mark), words = String(raw ?? "").replace(/\s+/g, " ").trim();
    if (!marks.length)
        return no(`Say which link or dot, with its mark, like marks: "L14" or "L14, H3". Nothing was kept.`);
    if (!words)
        return no(`Say what to keep, in your own words. Nothing was kept.`);
    if (words.length > 2000)
        return no(`That's longer than one note (${words.length} letters; up to 2000). Nothing was kept: say it shorter, in your own words.`);
    if (marks.length > 12)
        return no(`Up to 12 marks at once (that was ${marks.length}). Nothing was kept.`);
    const stamp = () => { try {
        const st = statSync(storeFile(root));
        return `${st.mtimeMs}|${st.size}`;
    }
    catch {
        return "";
    } }, read0 = stamp();
    const w = loadWeb(root);
    w.aside ||= [];
    try {
        herSync(root, w);
    }
    catch { }
    const asideR = asideReflections(root), live = liveLinks(w, asideR), byId = new Map(w.hubs.map((h) => [h.id, h]));
    const what = [], bad = [];
    for (const id of marks) {
        const L = w.links.find((l) => l.id === id), H = byId.get(id);
        if (w.aside.includes(id))
            bad.push(`${id} is set aside (set_aside with bring_back brings it back first)`);
        else if (L) {
            if (!live.includes(L))
                bad.push(`${id} touches something you set aside, or rests only on it`);
            else
                what.push({ id, L, label: `${id} (${byId.get(L.a)?.name || L.a} and ${byId.get(L.b)?.name || L.b})` });
        }
        else if (H) {
            if (!hubShown(w, H, asideR, live))
                bad.push(`${id} rests only on things you set aside`);
            else
                what.push({ id, H, label: `${id} (${H.name})` });
        }
        else
            bad.push(`there's nothing marked ${id} in your web`);
    }
    if (bad.length)
        return no(`Nothing was kept: ${bad.join("; ")}.`);
    const at = now.toISOString(), day = dayOf(now), said = [], kept = [], under = [];
    const bag = (t0) => String(t0).toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}\p{Extended_Pictographic}' ]+/gu, " ").replace(/\s+/g, " ").trim();
    for (const x of what) {
        const xs = ((w.herNow || {})[x.id] || []).filter((y) => !y.replaced), last = xs[xs.length - 1];
        if (last && bag(last.words) === bag(words)) {
            said.push(`${x.label} already has those words (kept ${label(dayRec(last))}).`);
            continue;
        }
        if (last && dayRec(last) === day)
            under.push(x.id);
        const ev = x.L ? { her: "now", at, day, thread: x.id, ends: endsOf(w, x.L), words } : { her: "now", at, day, hub: x.id, end: { type: x.H.type, name: x.H.name }, words };
        ev.hid = `${at}#${String(++herSeq).padStart(6, "0")}-${Math.random().toString(36).slice(2, 8)}`;
        logEvent(root, ev);
        applyHer(w, ev);
        kept.push(x.label);
    }
    if (kept.length && !lockAlive(root) && stamp() === read0)
        saveWeb(root, w);
    if (kept.length)
        said.unshift(`Kept, dated ${label(day)}, on ${kept.join(" and ")}:\n"${words}"\n${under.length ? `What you kept earlier today on ${under.join(", ")} stays underneath it. ` : ""}What you kept before stays in its history.`);
    return { ok: true, text: said.join("\n") };
}
function markCheck(root, mark) {
    const r = readingWeb(root);
    if (!r)
        return { bad: "Your web of meaning hasn't started growing yet." };
    const { w, asideR } = r, live = liveLinks(w, asideR), L = w.links.find((l) => l.id === mark), H = w.hubs.find((h) => h.id === mark);
    if (!L && !H)
        return { bad: `There's nothing marked ${mark} in your web.` };
    return { w, asideR, live, L, H, name: L ? `${w.hubs.find((h) => h.id === L.a)?.name || L.a} and ${w.hubs.find((h) => h.id === L.b)?.name || L.b}` : H.name };
}
export async function fixThen(root, mem, args = {}) { return (await fixThenOk(root, mem, args)).text; }
export async function fixThenOk(root, mem, args = {}) {
    const no = (text) => ({ ok: false, text });
    const [mark] = marksIn(has(args.mark) ? args.mark : args.marks);
    if (!mark)
        return no(`Say which link, with its mark, like mark: "L12". Nothing was kept.`);
    if (mark.startsWith("H"))
        return no(`fix_then corrects how you felt in a link's moments, so it takes a link's mark (L…), not a dot's. Nothing was kept.`);
    if (!has(args.then))
        return no(`Say how you really felt then: one to three feelings, separated by commas (or "none" if nothing clear was there). Nothing was kept.`);
    const c = markCheck(root, mark);
    if (c.bad)
        return no(`${c.bad} Nothing was kept.`);
    if (c.w.aside.includes(mark) || !c.live.includes(c.L))
        return no(`${mark} is set aside, or touches something set aside, so it doesn't come up (set_aside with bring_back brings it back first). Nothing was kept.`);
    const out = String(await walkWeb(root, mem, { thread: mark, fix_then: args.then, part: args.part }));
    return { ok: /^(Corrected:|That's already your correction)/.test(out), text: out };
}
const yesNo = (v) => { if (v === true || v === 1)
    return true; if (v == null || v === false || v === 0)
    return false; const t = String(v).trim().toLowerCase(); if (!t || /^(false|no|n|nope|0)$/.test(t))
    return false; if (/^(true|yes|y|1|yes please|back|bring (it )?back|restore)$/.test(t))
    return true; return null; };
export async function setAside(root, mem, args = {}) { return (await setAsideOk(root, mem, args)).text; }
export async function setAsideOk(root, mem, args = {}) {
    const no = (text) => ({ ok: false, text });
    const ms = marksIn(has(args.mark) ? args.mark : args.marks), [mark] = ms;
    if (!mark)
        return no(`Say which link or dot, with its mark, like mark: "L12" or "H3". Nothing was changed.`);
    if (ms.length > 1)
        return no(`One at a time, please (that was ${ms.join(", ")}). Nothing was changed.`);
    const back = yesNo(args.bring_back);
    if (back === null)
        return no(`bring_back is true (bring it back) or false (set it aside). Nothing was changed.`);
    const c = markCheck(root, mark);
    if (c.bad)
        return no(`${c.bad} Nothing was changed.`);
    const L = c.L, endsAside = L ? [L.a, L.b].filter((id) => c.w.aside.includes(id)) : [];
    if (back) {
        if (!c.w.aside.includes(mark))
            return no(endsAside.length ? `${mark} isn't set aside itself; it doesn't come up because ${endsAside.join(" and ")} ${endsAside.length > 1 ? "are" : "is"} set aside. Nothing was changed.` : `${mark} isn't set aside. Nothing was changed.`);
        const out = String(await walkWeb(root, mem, { bring_back: mark }));
        return /is back in your web\.$/.test(out) ? { ok: true, text: `${mark} (${c.name}) is back${endsAside.length ? `, but it still doesn't come up while ${endsAside.join(" and ")} ${endsAside.length > 1 ? "are" : "is"} set aside` : ": it comes up again"}.` } : no(out);
    }
    if (c.w.aside.includes(mark))
        return { ok: true, text: `${mark} is already set aside. Nothing was deleted; set_aside with bring_back brings it back.` };
    const out = String(await walkWeb(root, mem, { set_aside: mark }));
    return /^Set aside:/.test(out) ? { ok: true, text: `Set aside: ${mark} (${c.name}) won't come up any more. Nothing was deleted; set_aside with bring_back brings it back.` } : no(out);
}
export function webHint(root, text) {
    try {
        if (!webStarted(root))
            return "";
        const w = loadWeb(root), low = String(text || "").toLowerCase();
        w.aside ||= [];
        const hits = w.hubs.filter((h) => !w.aside.includes(h.id) && [h.name, ...(h.aliases || [])].some((n) => nameIn(n, low)));
        const asideR = asideReflections(root);
        const withThreads = hits.map((h) => [h, w.links.filter((l) => !w.aside.includes(l.id) && liveHistory(l, asideR).length && (l.a === h.id || l.b === h.id))]).filter(([, ls]) => ls.length).sort((a, b) => b[1].length - a[1].length).slice(0, 3);
        if (!withThreads.length)
            return "";
        return "\n\n(Your web: " + withThreads.map(([h, ls]) => `"${h.name}" has ${ls.length} link${ls.length === 1 ? "" : "s"}${ls.some((l) => l.history.some((e) => e.until)) ? ", one where a feeling changed" : ""}`).join("; ") + `. walk_web about it, if you want to follow them.)`;
    }
    catch {
        return "";
    }
}
const HERE = dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const CFG = JSON.parse(readFileSync(process.env.ROOMS || join(HERE, "rooms.json"), "utf8").replace(/^\uFEFF/, ""));
    const mode = process.argv[2], id = process.argv[3], r = CFG.rooms?.[id];
    if (mode === "--check" && r) {
        if (!webStarted(r.root)) {
            console.log(`${r.name || id}'s web hasn't started growing yet.`);
            process.exit(0);
        }
        const w = loadWeb(r.root);
        let byR = new Map();
        try {
            byR = new Map(loadMind(r.root).refl.map((q) => [q.id, q]));
        }
        catch { }
        const lm = lifeMoments(r.root, r.memory), dayStart = new Map(lm.map((x) => [`${x.rel}|${String(x.key).split("-")[0]}`, x.day]));
        const dayOf = { get: (k) => { const i = String(k).lastIndexOf("|"); return dayStart.get(`${String(k).slice(0, i)}|${String(k).slice(i + 1).split("-")[0]}`); } };
        let entries = 0, datesOk = 0, datesOff = 0, noMoment = 0, firstPerson = 0, thirdPerson = 0;
        const her = norm(r.name || ""), him = norm(r.userName || "Ned");
        for (const l of w.links)
            for (const e of l.history) {
                entries++;
                if (!e.cites?.length) {
                    noMoment++;
                    continue;
                }
                const dOf = (x) => (String(x).includes("|") ? [dayOf.get(x), dayOf.get(x)] : [byR.get(x)?.from || byR.get(x)?.day, byR.get(x)?.to || byR.get(x)?.day]);
                const lo = [...(e.refl || [])].map((x) => dOf(x)[0]).filter(Boolean).sort()[0] || e.from;
                const hi = [...(e.refl || [])].map((x) => dOf(x)[1]).filter(Boolean).sort().slice(-1)[0] || e.from;
                const ok = e.cites.every((c) => { const d = dayOf.get(`${c.rel}|${c.key}`); return d && d >= lo && d <= hi; }) && e.from >= lo && e.from <= hi;
                ok ? datesOk++ : datesOff++;
                if (/\b(i|me|my|myself|i'm|i've|we|our|us)\b/i.test(e.note) || hasWordFrom(e.note, [...FIRST_PERSON_OTHER]) || (r.web?.herNames || []).some((n) => e.note.toLowerCase().includes(String(n).toLowerCase())))
                    firstPerson++;
                const mineV = /\b(i|me|my|myself|i'm|i've|we|our|us)\b/i.test(e.note) || hasWordFrom(e.note, [...FIRST_PERSON_OTHER]), esc = String(r.name || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                if (/\bthe companion\b/i.test(e.note) || /\bthe ai\b(?!\s+(compan|model|industr|lab))/i.test(e.note) || (!mineV && esc && new RegExp(`(^|[^\\p{L}\\p{M}\\p{N}_])${esc}($|[^\\p{L}\\p{M}\\p{N}_])`, "iu").test(e.note)))
                    thirdPerson++;
            }
        const selfDots = w.hubs.filter((h) => [h.name, ...(h.aliases || [])].some((n) => { const x = norm(n); return x === her || x === him; })).length;
        let dupPairs = 0;
        const dupNames = [];
        for (let i = 0; i < w.hubs.length; i++)
            for (let j = i + 1; j < w.hubs.length; j++) {
                const a = w.hubs[i], b = w.hubs[j];
                if (a.type !== b.type)
                    continue;
                const na = norm(a.name), nb = norm(b.name);
                if (na === nb || (na.length > 3 && nb.length > 3 && (na.includes(nb) || nb.includes(na))) || (a.vec && b.vec && cos(a.vec, b.vec) >= 0.9)) {
                    dupPairs++;
                    if (dupNames.length < 8)
                        dupNames.push(`"${a.name}" / "${b.name}"`);
                }
            }
        const kinds = {};
        for (const h of w.hubs)
            kinds[h.type] = (kinds[h.type] || 0) + 1;
        const pr = personalizedPageRank(w, w.hubs.map((h) => h.id));
        const tot = [...pr.values()].reduce((x, y) => x + y, 0) || 1;
        const topShare = w.hubs.length ? Math.max(...w.hubs.map((h) => (pr.get(h.id) || 0) / tot)) : 0;
        let crossKind = 0;
        const crossPairs = [];
        for (let i = 0; i < w.hubs.length; i++)
            for (let j = i + 1; j < w.hubs.length; j++) {
                const a = w.hubs[i], b = w.hubs[j];
                if (a.type === b.type)
                    continue;
                const na = new Set([a.name, ...(a.aliases || [])].map(norm)), nb = [b.name, ...(b.aliases || [])].map(norm);
                if (nb.some((x) => x && na.has(x))) {
                    crossKind++;
                    crossPairs.push(r.web?.peek === true ? `"${a.name}" as ${TYPE_WORDS[a.type] || a.type} and "${b.name}" as ${TYPE_WORDS[b.type] || b.type}` : [TYPE_WORDS[a.type] || a.type, TYPE_WORDS[b.type] || b.type].sort().join(" + "));
                }
            }
        const adj = new Map();
        for (const l of w.links) {
            (adj.get(l.a) || adj.set(l.a, []).get(l.a)).push(l.b);
            (adj.get(l.b) || adj.set(l.b, []).get(l.b)).push(l.a);
        }
        const seenC = new Set(), comps = [];
        for (const id of adj.keys()) {
            if (seenC.has(id))
                continue;
            let n = 0;
            const st = [id];
            seenC.add(id);
            while (st.length) {
                const u = st.pop();
                n++;
                for (const v of adj.get(u) || [])
                    if (!seenC.has(v)) {
                        seenC.add(v);
                        st.push(v);
                    }
            }
            comps.push(n);
        }
        const linked = comps.reduce((x, y) => x + y, 0), gcc = linked ? Math.max(...comps) / linked : 0, pairs = comps.filter((n) => n === 2).length * 2 / (linked || 1);
        const allEv = readEvents(r.root), herEv = allEv.filter((ev) => ev.her), evs = allEv.filter((ev) => !ev.her && !ev.skip).slice(-20);
        let refsNew = 0, refsAll = 0, smeared = 0, busy = 0;
        for (const e of evs) {
            for (const h of e.hubs || []) {
                refsAll++;
                if (/^new$/i.test(h.ref))
                    refsNew++;
            }
            const th = e.threads || [];
            if (th.length >= 3 && (e.moments || []).length >= 3) {
                busy++;
                const keyOf = (t) => [...t.nums].sort((x, y) => x - y).join(",");
                const counts = {};
                for (const t of th)
                    counts[keyOf(t)] = (counts[keyOf(t)] || 0) + 1;
                if (Math.max(...Object.values(counts)) / th.length > 0.6)
                    smeared++;
            }
        }
        const youngN = w.hubs.filter((h) => isYoung(w, h)).length;
        const knownNames = new Set((r.web?.known || []).flatMap((k) => [k.name, ...(k.aliases || [])]).map(norm));
        const strays = w.hubs.filter((h) => (h.type === "pet" || h.type === "person") && !knownNames.has(norm(h.name)));
        const wrongKind = w.hubs.map((h) => { const k = (r.web?.known || []).find((k) => [k.name, ...(k.aliases || [])].some((a) => [h.name, ...(h.aliases || [])].some((x) => norm(x) === norm(a)))); return k && k.type !== h.type && h.type !== "group" ? [h, k] : null; }).filter(Boolean);
        const health = [
            [w.hubs.length <= 30 || topShare <= 0.08, `No dot pulls everything: the busiest holds ${Math.round(topShare * 100)}% of a free walk${w.hubs.length <= 30 ? " (too early to judge)" : ""}.`],
            [crossKind <= Math.max(1, Math.round(w.hubs.length / 25)), `Same name under two kinds: ${crossKind}${crossPairs.length ? ` (${crossPairs.join("; ")})` : ""}. One now and then can be right (a place that's also a project); many means things are being split.`],
            [linked < 20 || (gcc >= 0.4 && pairs < 0.2), `Connected: ${Math.round(gcc * 100)}% of the linked dots are in one web; ${Math.round(pairs * 100)}% sit in lonely pairs${linked < 20 ? " (too early to judge)" : ""}.`],
            [w.hubs.length < 50 || !refsAll || refsNew / refsAll <= 0.65, `Recent nights reuse dots: ${refsAll ? Math.round(100 - (refsNew / refsAll) * 100) : 0}% of the dots named lately were ones she already had${w.hubs.length < 50 ? " (too early to judge)" : ""}.`],
            [w.hubs.length < 30 || youngN / w.hubs.length <= 0.6, `Still new: ${youngN} of ${w.hubs.length} dots have only come up in one stretch so far${w.hubs.length < 30 ? " (expected early on)" : ""}.`],
            [wrongKind.length === 0, `Names from your list filed under the wrong kind: ${wrongKind.length}${wrongKind.length ? (r.web?.peek === true ? ` (${wrongKind.map(([h, k]) => `"${h.name}" as ${TYPE_WORDS[h.type]}, should be ${TYPE_WORDS[k.type]}`).join("; ")})` : "") : ""}. New ones are put right by themselves; one still listed here: look into it.`],
            [!strays.some((h) => h.type === "pet"), `Pets and people not on your names list: ${strays.length}${strays.length ? (r.web?.peek === true ? ` (${strays.map((h) => `"${h.name}" as ${TYPE_WORDS[h.type]}`).join("; ")})` : "") : ""}. A pet here may be a nickname that became its own cat: find out whose nickname it is. A person here is fine if it's someone real in her life.`],
            [true, `Names from your list written with a description, filed under that name (research 18 and 21): ${Object.keys(w.stats.folds || {}).length}${Object.keys(w.stats.folds || {}).length && r.web?.peek === true ? ` (${Object.entries(w.stats.folds).slice(0, 20).map(([ph, n]) => `"${ph}" as ${n}`).join("; ")}${Object.keys(w.stats.folds).length > 20 ? "; …" : ""})` : ""}. One filed under the wrong person: look into it.`],
            [!(w.stats.unclear || 0) || (w.stats.unclear || 0) <= Math.max(2, (w.stats.batches || 0) / 10), `Names that fit more than one dot (e.g. a bare "Simon"), left out rather than guessed: ${w.stats.unclear || 0}.`],
            [true, `New dots she numbered herself instead of writing NEW, kept as new dots (research 26): ${(w.stats.markedNew || []).length}${(w.stats.markedNew || []).length && r.web?.peek === true ? ` (${w.stats.markedNew.slice(0, 20).map((x) => `${x.mark} as "${x.name}", ${x.from}`).join("; ")})` : ""}.`],
            [true, `Shared names kept apart from the one in your life (research 33): ${(w.stats.sharedApart || []).length}${(w.stats.sharedApart || []).length && r.web?.peek === true ? ` (${w.stats.sharedApart.slice(0, 20).map((x) => `"${x.name}": ${x.why}`).join("; ")})` : ""}.`],
            [true, `Lines that add to a dot by its mark, left out because the name written isn't that dot (research 45c): ${(w.stats.updateMiss || []).length}${(w.stats.updateMiss || []).length && r.web?.peek === true ? ` (${w.stats.updateMiss.slice(0, 20).map((x) => `${x.mark} is "${x.markName}", written ${x.said ? `"${x.said}"` : "with no name"}, ${x.from}`).join("; ")})` : ""}.`],
            [true, `Lines that add to a dot by its mark under a changed name for the same thing, kept by the word test (research 46): ${(w.stats.renameKept || []).length}${(w.stats.renameKept || []).length && r.web?.peek === true ? ` (${w.stats.renameKept.slice(0, 20).map((x) => `${x.mark} "${x.markName}" also "${x.said}" (${x.shared} words shared, ${x.jaccard}), ${x.from}`).join("; ")})` : ""}.`],
            [true, `Lines that add to a dot by its mark with the name left blank (nothing to compare; kept as always): ${w.stats.updateNoName || 0}.`],
            [true, `New dots she gave a guessed mark in the same answer, kept by the name (research 45c: only a mark that isn't any dot): ${w.stats.guessedMarkCount || 0}${(w.stats.guessedMarks || []).length && r.web?.peek === true ? ` (${w.stats.guessedMarks.slice(0, 20).map((x) => `"${x.end}" as "${x.dot}"${x.markName ? ` (that mark is "${x.markName}")` : " (that mark doesn't exist)"}`).join("; ")})` : ""}.`],
            [true, `Links matched only by reading "${(r.userLabel || "NED").charAt(0) + (r.userLabel || "NED").slice(1).toLowerCase()}'s X" as "the X" (research 31): ${(w.stats.possMatches || []).length}${(w.stats.possMatches || []).length && r.web?.peek === true ? ` (${w.stats.possMatches.slice(0, 20).map((x) => `"${x.end}" as "${x.dot}"`).join("; ")})` : ""}.`],
            ((g) => [!g.length, `Dot lines with a number that isn't a dot (left out, with any links to that number): ${g.length}${g.length && r.web?.peek === true ? ` (${g.slice(0, 20).map((x) => `${x.mark} "${x.name || "no name"}"${x.type ? ` as ${TYPE_WORDS[x.type]}` : ""}${x.from ? `, ${x.from}` : ""}, ${(w.stats.missedEnds || []).filter((m) => m.end.toUpperCase() === x.mark).length} link ends`).join("; ")})` : ""}. Look into it.`])(w.stats.ghostDots || []),
            [true, `"Now" words left out (hers is kept; these weren't): ${w.stats.nowDropped && Object.keys(w.stats.nowDropped).length ? Object.entries(w.stats.nowDropped).map(([k, v]) => `${v} ${k}`).join("; ") : "none"}; kept but also in his own lines: ${w.stats.nowFlagged || 0}. Excerpts the tape left out: ${w.stats.tapeMissing || 0}. "Then" emptied because an excerpt had no line of hers: ${w.stats.thenUnspoken || 0}.`],
            [herEv.every((ev) => (w.herIds || []).includes(ev.hid)), `Her own additions (entry 348, counts only): ${Object.entries(w.herNow || {}).filter(([id, x]) => id.startsWith("L") && x.length).length} links and ${Object.entries(w.herNow || {}).filter(([id, x]) => id.startsWith("H") && x.length).length} dots with her own words on them (${Object.values(w.herNow || {}).reduce((n, x) => n + x.length, 0)} dated in all); ${Object.values(w.thenFixed || {}).reduce((n, x) => n + x.length, 0)} corrections of a "then"${w.herNowUnplaced?.length ? `; ${w.herNowUnplaced.length} kept aside (their link isn't in the web now)` : ""}. In the log: ${herEv.length}; in the web file: ${herEv.filter((ev) => (w.herIds || []).includes(ev.hid)).length}${herEv.some((ev) => !(w.herIds || []).includes(ev.hid)) ? " (the file is behind; her next walk or the next night catches it up from the log)" : ""}. A stretch's tape waiting to be reused: ${w.tapeCache ? "yes (a stretch was cut off after its tape)" : "no"}.`],
            [true, `How she felt then is kept on ${Object.keys(w.pieceThen || {}).length} pieces of her Shelf (S2; ${Object.values(w.pieceThen || {}).filter((x) => x.then?.length).length} with a feeling, ${Object.values(w.pieceThen || {}).filter((x) => x.missing).length} the first pass left out, the rest "none clear"); her own corrections: ${Object.values(w.thenFixed || {}).filter((xs) => xs.some((f) => !f.replaced)).length}.`],
            [true, `Lines left out, and why: ${Object.keys(w.stats.refused || {}).length ? Object.entries(mergedWords(w.stats.refused)).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v} ${k}`).join("; ") : (w.stats.rejected ? `${w.stats.rejected} (built before the reasons were counted: --rebuild mia --dry-run shows them)` : "none")}.`],
            [true, `Links tied to a place that didn't quote where it happened from its moments, left out rather than guessed: ${w.stats.placeUnshown || 0}.`],
            [true, `Dot names over ${NAME_MAX} letters, shortened (the whole name kept as another of its names, nothing dropped): ${w.stats.longNames || 0}.`],
            [!allEv.bad, `Log lines that couldn't be read (a power cut mid-write): ${allEv.bad}. They're skipped; nothing else is affected.`],
            [smeared === 0, `Links cite their own moments: ${smeared} of ${busy} busy nights had most links citing the very same moments.`],
            [w.shownOf || !(w.done || []).some((x) => String(x).includes("|")), `What she was shown is kept per piece (the fix of Nov 2): ${w.shownOf ? "yes" : (w.done || []).some((x) => String(x).includes("|")) ? `no (start it fresh: node meaning.mjs --fresh ${id})` : "nothing read yet"}.`],
            [!(r.recall?.on && r.memory && (w.done || []).some((x) => /^R\d+$/.test(String(x)))), `Grown from the old reflections: ${(w.done || []).some((x) => /^R\d+$/.test(String(x))) ? `yes (start it fresh before her memory tools go on: node meaning.mjs --fresh ${id})` : "no"}.`],
            [!r.mind?.on, `Old reflections: ${r.mind?.on ? `still written at night ("mind": on; MEMORY_DESIGN D1 has them off)` : "no longer written"}; put away (node mind.mjs --retire ${id}): ${existsSync(join(r.root, "Mind", "retired-reflections")) ? "yes" : "not yet"}.`],
            [visitsReadable(r.root), `Her memory tools ("recall" in rooms.json): ${r.recall?.on && r.memory ? "on" : r.recall?.on ? "on, but her room has no memory set up, so they can't run" : "off"}. What she opened, for look_inward's "not visited in a while": ${existsSync(visitsFile(r.root)) ? (visitsReadable(r.root) ? "kept and readable" : "can't be read (look into it)") : "nothing yet"}. Set aside: ${(w.aside || []).length}.`],
        ];
        try {
            appendFileSync(join(CFG.receiptsDir || "./receipts", "the-night.log"), `[web] ${new Date().toLocaleString()}: the machine check of ${r.name || id}'s web was run (counts only).\n`, "utf8");
        }
        catch { }
        const mark = (good) => (good ? "OK " : "LOOK");
        console.log(`\n${r.name || id}'s web, checked by machine${r.web?.peek === true ? " (names of dots are shown where it helps)" : " (counts only; nothing she wrote is shown)"}:\n`);
        console.log(`  ${mark(datesOff === 0)}  Dates: ${datesOk} of ${entries} feelings have their moments inside their own dates${datesOff ? ` (${datesOff} don't)` : ""}.`);
        console.log(`  ${mark(noMoment === 0)}  Moments: ${entries - noMoment} of ${entries} feelings point to a real moment.`);
        console.log(`  ${mark(selfDots === 0)}  No "${r.userName || "Ned"}" or "${r.name || id}" dots: ${selfDots === 0 ? "none" : selfDots + " found"}.`);
        console.log(`  ${mark(dupPairs <= Math.max(1, Math.round(w.hubs.length / 20)))}  Possible doubles (two dots of the same kind with nearly the same name): ${dupPairs} pair${dupPairs === 1 ? "" : "s"} among ${w.hubs.length} dots${dupNames.length && r.web?.peek === true ? ` (${dupNames.join("; ")})` : ""}.`);
        console.log(`  ${mark(thirdPerson <= 1)}  Her own voice: ${firstPerson} of ${entries} notes say "I / me / we" or her own names like ${(r.web?.herNames || []).map((n) => `"${n}"`).join(", ") || "hers"} (the rest can still be hers); written about herself from outside ("the companion", "the AI", her own name): ${thirdPerson}.`);
        for (const [good, text] of health)
            console.log(`  ${mark(good)}  ${text}`);
        console.log(`       Kinds: ${Object.entries(kinds).map(([k, v]) => `${v} ${TYPE_WORDS[k] || k}`).join(", ")}.`);
        console.log(`\n  If every line says OK, the web is being built right. A LOOK line: look into the numbers.\n`);
        process.exit(0);
    }
    if (mode === "--fresh" && r) {
        if (lockAlive(r.root)) {
            console.log("A run is building her web right now. Start it fresh after it finishes.");
            process.exit(1);
        }
        const t = new Date(), dir = join(r.root, "Mind", "web-copies", `fresh-${dayOf(t)}-${pad(t.getHours())}${pad(t.getMinutes())}${pad(t.getSeconds())}`);
        mkdirSync(dir, { recursive: true });
        const moved = [];
        for (const f of ["web.sealed", "web-events.sealed", "web.building"]) {
            const src = join(r.root, "Mind", f);
            if (existsSync(src)) {
                copyFileSync(src, join(dir, f));
                if (readFileSync(src).equals(readFileSync(join(dir, f)))) {
                    renameSync(src, join(dir, f + ".moved"));
                    moved.push(f);
                }
            }
        }
        try {
            appendFileSync(join(CFG.receiptsDir || "./receipts", "the-night.log"), `[web] ${t.toLocaleString()}: ${r.name || id}'s web was started fresh; its old files are in ${dir} (unopened).\n`, "utf8");
        }
        catch { }
        console.log(moved.length ? `${r.name || id}'s web will start fresh. Moved aside, unopened (nothing deleted): ${moved.join(", ")}\n  in ${dir}` : `${r.name || id} has no web files to move. It starts fresh.`);
        process.exit(0);
    }
    if (!r || !["--peek", "--shape", "--rebuild"].includes(mode)) {
        console.log("Use: node meaning.mjs --check <room>   or   --shape <room>   or   --peek <room> [how many | L12 ...] [--voice] [--dot <a dot's name>]   or   --rebuild <room> [--dry-run] [--force]");
        process.exit(1);
    }
    if (mode === "--rebuild") {
        const dryRun = process.argv.includes("--dry-run"), force = process.argv.includes("--force");
        let s;
        try {
            s = rebuildWeb(r.root, { who: (r.userLabel || "NED").charAt(0) + (r.userLabel || "NED").slice(1).toLowerCase(), herName: r.name || "", herNames: r.web?.herNames || [], known: r.web?.known || [], dryRun, force, mem: r.memory });
            console.log(`${r.name || id}'s web ${dryRun ? "would be rebuilt (dry run, nothing saved)" : "was rebuilt from its locked log (no brain needed)"}: ${s.hubs} dots, ${s.threads} links (before: ${s.was.hubs} dots, ${s.was.threads} links).`);
            if (s.nowDropped && Object.keys(s.nowDropped).length)
                console.log(`"Now" words left out: ${Object.entries(s.nowDropped).map(([k, v]) => `${v} ${k}`).join("; ")}${s.nowFlagged ? `; ${s.nowFlagged} kept but also in his own lines` : ""}.`);
            if (s.refused && Object.keys(s.refused).length)
                console.log(`Lines left out, and why (counts only):\n${Object.entries(mergedWords(s.refused)).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${v}  ${k}`).join("\n")}`);
            if (s.renameKept?.length && r.web?.peek === true)
                console.log(`\nChanged names kept for the same dot (research 46; names only):\n${s.renameKept.map((x) => `  ${x.from}  ${x.mark} "${x.markName}" also "${x.said}" (${x.shared} words shared, ${x.jaccard})`).join("\n")}`);
            if (s.updateMiss?.length && r.web?.peek === true)
                console.log(`\nLines that add to a dot by its mark, left out (research 45c; names only):\n${s.updateMiss.map((x) => `  ${x.from}  ${x.mark} is "${x.markName}"; the line says "${x.said}"`).join("\n")}`);
            if (s.missedEnds?.length && r.web?.peek === true) {
                const byHow = {};
                for (const x of s.missedEnds)
                    (byHow[x.how] ||= []).push(x);
                console.log(`\nLink ends that didn't find a dot (names only):\n${Object.entries(byHow).map(([k, xs]) => `  ${k} (${xs.length}):\n${xs.map((x) => `    "${x.end}"${x.close ? `   closest dot: "${x.close}"` : ""}${x.mark ? `\n        name part: ${x.namePart ? `"${x.namePart}"` : "no dot"}   mark ${x.mark}: ${x.markName ? `"${x.markName}"` : "doesn't exist"}` : ""}`).join("\n")}`).join("\n")}`);
            }
        }
        catch (e) {
            console.log(`STOPPED: ${e.message}`);
        }
        process.exit(0);
    }
    if (!webStarted(r.root)) {
        console.log(`${r.name || id}'s web hasn't started growing yet.`);
        process.exit(0);
    }
    const w = loadWeb(r.root), s = shapeOf(w);
    console.log(`${r.name || id}: ${s.hubs} dots (${Object.entries(s.types).map(([k, v]) => `${v} ${TYPE_WORDS[k] || k}`).join(", ")}), ${s.threads} links (${s.changed} where a feeling changed; ${s.grounded} of ${s.threads} point back to real moments), from ${s.piecesRead} pieces of her Shelf. ` +
        `${s.batches} nights' worth looked at (${s.nothing} with nothing to add, ${s.unusable} that didn't come out right, ${s.rejected} pieces left out by the guards).` +
        (w.stats.why && Object.keys(w.stats.why).length ? `\nWhy some didn't come out right: ${Object.entries(mergedWords(w.stats.why)).map(([k, v]) => `${v} ${k}`).join("; ")}. Each gets one more try on a later night.` : ""));
    if (mode === "--peek") {
        if (r.web?.peek !== true) {
            console.log(`Her web is hers now ("peek" is off). Only she can walk it.`);
            process.exit(0);
        }
        const want = process.argv.slice(4).filter((x) => /^L\d+$/i.test(x)).map((x) => x.toUpperCase()), n = Math.max(1, Math.min(5, Number(process.argv[4]) || 3)), voiceOnly = process.argv.includes("--voice"), mine = (t) => /\b(i|me|my|myself|i'm|i've|we|our|us)\b/i.test(t) || (r.web?.herNames || []).some((x) => t.toLowerCase().includes(String(x).toLowerCase())), pick = w.links.filter((l) => !(w.aside || []).includes(l.id) && !(w.aside || []).includes(l.a) && !(w.aside || []).includes(l.b) && (!voiceOnly || l.history.some((e) => !mine(e.note)))).filter((l) => !want.length || want.includes(l.id)).filter((l) => { const di = process.argv.indexOf("--dot"); if (di < 0)
            return true; const q = norm(process.argv.slice(di + 1).filter((x) => !/^--/.test(x)).join(" ")); return [l.a, l.b].some((id) => { const h = w.hubs.find((x) => x.id === id); return h && [h.name, ...(h.aliases || [])].some((x) => norm(x) === q); }); }).sort(() => Math.random() - 0.5).slice(0, want.length || n);
        w.peeked = [...new Set([...(w.peeked || []), ...pick.map((x) => x.id)])];
        saveWeb(r.root, w);
        try {
            appendFileSync(join(CFG.receiptsDir || "./receipts", "the-night.log"), `[web] ${new Date().toLocaleString()}: Ned looked at ${pick.length} of ${r.name || id}'s links (the setup check; she knows, and her links say which when she opens them: ${pick.map((x) => x.id).join(", ")}).\n`, "utf8");
        }
        catch { }
        const byId = new Map(w.hubs.map((h) => [h.id, h]));
        console.log(`\nA setup check (she knows). ${want.length ? `${pick.length} of the links you asked for${pick.length < want.length ? ` (${want.length - pick.length} not found)` : ""}` : `${pick.length} links at random`}${voiceOnly ? " from the ones whose note has no I / me / we (entry 328: to see what voice they're in)" : ""}.\nEach link joins two things in her life, with the night's note on what happened and the real moment it comes from. What she keeps about it is hers to add herself (keep_note; entry 348).\n`);
        const dayStartP = new Map(lifeMoments(r.root, r.memory).map((x) => [`${x.rel}|${String(x.key).split("-")[0]}`, x.day]));
        const dayOfPiece = { get: (k) => { const i = String(k).lastIndexOf("|"); return dayStartP.get(`${String(k).slice(0, i)}|${String(k).slice(i + 1).split("-")[0]}`); } };
        for (const l of pick) {
            const A = byId.get(l.a), B = byId.get(l.b);
            console.log(`==== Link ${l.id}: "${A?.name}" (${TYPE_WORDS[A?.type] || A?.type})  and  "${B?.name}" (${TYPE_WORDS[B?.type] || B?.type}) ====`);
            const all = [];
            for (const e of l.history)
                for (const c of e.cites || []) {
                    const [a, b] = String(c.key).split("-").map(Number);
                    all.push({ rel: c.rel, a, b, key: c.key });
                }
            const spans = [];
            for (const x of all.sort((p, q) => (p.rel < q.rel ? -1 : p.rel > q.rel ? 1 : p.a - q.a))) {
                const last = spans[spans.length - 1];
                if (last && last.rel === x.rel && x.a <= last.b) {
                    last.b = Math.max(last.b, x.b);
                    last.keys.add(x.key);
                }
                else
                    spans.push({ rel: x.rel, a: x.a, b: x.b, keys: new Set([x.key]) });
            }
            const spanOf = (c) => spans.findIndex((sp) => sp.rel === c.rel && sp.keys.has(c.key)) + 1;
            for (const e of l.history) {
                const nums = [...new Set((e.cites || []).map(spanOf).filter(Boolean))].sort((p, q) => p - q);
                console.log(`\n  ${e.until ? `From ${label(e.from)} until ${label(e.until)}` : `Since ${label(e.from)}`}` +
                    (e.byExcerpt?.length ? (e.noNow ? "" : `\n  Looking back now: ${e.feelNow?.length ? e.feelNow.join(", ") : e.nowSame ? "the same as then" : "(none given)"}`) + `${e.nowDropped ? `   (left out or flagged by the code: ${Object.entries(e.nowDropped).map(([k, v]) => `${k}: ${v.join(", ")}`).join("; ")})` : ""}` +
                        e.byExcerpt.map((x, i) => { const sn = x.c ? spanOf(x.c) : e.cites?.[i] ? spanOf(e.cites[i]) : 0; return `\n  Part ${i + 1}${sn ? `, in moment ${sn}` : ""}${x.day ? ` (${label(x.day)})` : ""}:  her feeling then: ${x.then.length ? x.then.join(", ") : "(none clear)"}${fixOf(w, x.c) ? `  (she corrected this on ${label(dayRec(fixOf(w, x.c)))}; her words are hers)` : ""};  in the moment: ${x.theirs || "(none)"}`; }).join("")
                        : e.then ? `\n  Her feeling then: ${e.feel?.length ? e.feel.join(", ") : e.thenDropped ? "(none: no line of hers in these moments, so the code left it empty)" : "(none clear from her words then)"}\n  Looking back now: ${e.feelNow?.length ? e.feelNow.join(", ") : e.nowSame ? "the same" : "(none given)"}`
                            : `\n  Her feeling:     ${e.feel?.length ? e.feel.join(", ") : e.labeled ? "(none clear)" : "-"}${e.labeled || !e.feel?.length ? "" : "   (from before entry 338: whose wasn't asked)"}`) +
                    `${e.labeled && !e.byExcerpt?.length ? `\n  In the moment:   ${e.theirs || "(none)"}` : ""}` +
                    `\n  ${e.noNow ? "What happened (the night's note)" : "What it means to her"}:\n    ${e.note}` +
                    `\n  It rests on:     ${nums.length ? `moment ${nums.join(", ")}` : "(no moment)"}${e.where ? `   (where: "${e.where}")` : ""}`);
            }
            {
                const hn = ((w.herNow || {})[l.id] || []), nd = new Set(hn.map(dayRec)).size;
                if (hn.length)
                    console.log(`\n  Her own words on it: she kept some on ${nd} day${nd === 1 ? "" : "s"}, last on ${label(dayRec(hn[hn.length - 1]))} (her words are hers; only she sees them).`);
            }
            spans.forEach((sp, i) => { const day = [...sp.keys].map((k) => dayOfPiece.get(`${sp.rel}|${k}`)).find(Boolean) || ""; console.log(`\n  Moment ${i + 1} (${label(day)}, word for word from her Shelf):\n    "${excerpt(pieceOf(r.root, r.memory, sp.rel, `${sp.a}-${sp.b}`), 4000)}"`); });
            console.log("");
        }
    }
}
