// Part of The Web of Meaning: A Memory Design for Companions (Jay R. Martinson, 2026). MIT license; see LICENSE.
// Comments were removed for this release; the paper explains each part and why it was built that way.
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, renameSync } from "node:fs";
import { dirname, join, basename } from "node:path";
export const PARTS = ["her", "him", "us"];
const HEAD = { her: "About me", him: "About Ned", us: "About us" };
export const LIMITS = { total: 3200, line: 150, lines: { her: 15, him: 25, us: 15 } };
const LOCK = /^\\?\[anchor\\?\]\s*/i;
const unescapeMd = (s) => s.replace(/\\([\\`*_{}\[\]()#+\-.!>|~])/g, "$1");
const enc = (o) => JSON.stringify(o).replace(/-->/g, "--\\u003e");
const lc = (s) => String(s || "").toLowerCase().normalize("NFC").replace(/[^\p{L}\p{M} ]/gu, "").trim();
function partOf(heading, { herName = "Mia", name = "Ned" } = {}) {
    const h = lc(heading);
    if (h === "about me" || h === "about her" || h === `about ${lc(herName)}`)
        return "her";
    if (h === "about him" || h === `about ${lc(name)}`)
        return "him";
    if (h === "about us")
        return "us";
    return null;
}
export function parseAnchor(text, opts = {}) {
    let t = text;
    if (Buffer.isBuffer(t))
        t = t[0] === 0xff && t[1] === 0xfe ? t.toString("utf16le") : t.toString("utf8");
    t = String(t || "").replace(/^﻿/, "");
    const a = { parts: { her: [], him: [], us: [] }, doc: [], other: [], broken: [] };
    let part = null;
    for (const raw of t.split(/\r?\n/)) {
        const h = raw.match(/^\s*#{1,6}\s+(.*?)\s*$/);
        if (h) {
            part = partOf(h[1], opts);
            a.doc.push(part ? { head: part, raw } : { raw });
            if (!part)
                a.other.push(raw);
            continue;
        }
        const m = raw.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/);
        if (!m || !part) {
            a.doc.push({ raw });
            if (raw.trim() && !/^\s*<!--[\s\S]*-->\s*$/.test(raw))
                a.other.push(raw);
            continue;
        }
        let body = m[1], meta = {}, noteRaw = null, broken = false;
        const c = body.match(/<!--((?:(?!-->)[\s\S])*)-->\s*$/);
        if (c) {
            noteRaw = c[0];
            body = body.slice(0, c.index);
            try {
                meta = JSON.parse(c[1].trim());
                if (!meta || typeof meta !== "object" || Array.isArray(meta))
                    throw 0;
            }
            catch {
                meta = {};
                broken = true;
                if (/lock/i.test(c[1]))
                    meta.locked = true;
            }
        }
        body = unescapeMd(body.replace(/<!--[\s\S]*?-->/g, "")).replace(/\s+/g, " ").trim();
        if (LOCK.test(body)) {
            meta.locked = true;
            body = body.replace(LOCK, "");
        }
        if (!body) {
            a.doc.push({ raw });
            continue;
        }
        const line = { ...meta, key: typeof meta.key === "string" && meta.key ? meta.key : null, text: body, locked: !!meta.locked, from: meta.from || "Ned" };
        if (broken) {
            line.brokenNote = noteRaw;
            a.broken.push(body);
        }
        a.parts[part].push(line);
        a.doc.push({ line, part });
    }
    const used = new Set(PARTS.flatMap((p) => a.parts[p].filter((l) => l.key).map((l) => l.key)));
    const n = { her: 0, him: 0, us: 0 };
    for (const p of PARTS)
        for (const l of a.parts[p])
            if (!l.key) {
                let k;
                do
                    k = `${p}.line${++n[p]}`;
                while (used.has(k));
                l.key = k;
                used.add(k);
            }
    return a;
}
const noteOf = (l) => { const { text, locked, brokenNote, ...rest } = l; return brokenNote ? ` ${brokenNote}` : ` <!-- ${enc({ ...rest, ...(locked ? { locked: true } : {}) })} -->`; };
const lineOut = (l) => `- ${l.locked ? "[anchor] " : ""}${l.text}${noteOf(l)}`;
export function formatAnchor(a) {
    const out = [], done = new Set(), doc = a.doc || [];
    const emit = (p) => { if (done.has(p))
        return; done.add(p); for (const l of a.parts[p])
        out.push(lineOut(l)); };
    let cur = null;
    for (const d of doc) {
        if (d.head) {
            if (cur)
                emit(cur);
            cur = d.head;
            out.push(d.raw);
            continue;
        }
        if (d.line) {
            emit(d.part);
            continue;
        }
        if (/^\s*#{1,6}\s/.test(d.raw)) {
            if (cur)
                emit(cur);
            cur = null;
        }
        out.push(d.raw);
    }
    if (cur)
        emit(cur);
    for (const p of PARTS)
        if (!done.has(p) && a.parts[p].length) {
            out.push("", `# ${HEAD[p]}`);
            emit(p);
        }
    return out.join("\n").replace(/\n*$/, "\n");
}
export function renderAnchor(a, { myVoice = true, name = "Ned" } = {}) {
    const head = { her: myVoice ? "About me" : "About you", him: `About ${name}`, us: myVoice ? "About us" : `About you and ${name}` };
    const blocks = PARTS.filter((p) => a.parts[p].length).map((p) => `${head[p]}:\n${a.parts[p].map((l) => `- ${l.text}`).join("\n")}`);
    return blocks.length ? `${myVoice ? "My Anchor" : "Your Anchor"}\n${blocks.join("\n\n")}` : "";
}
export function checkAnchor(a, limits = LIMITS, opts = {}) {
    const problems = [], seen = new Set();
    for (const p of PARTS) {
        if (a.parts[p].length > limits.lines[p])
            problems.push(`${HEAD[p]}: ${a.parts[p].length} lines (the limit is ${limits.lines[p]})`);
        for (const l of a.parts[p]) {
            if (l.text.length > limits.line)
                problems.push(`a line is ${l.text.length} letters long (the limit is ${limits.line}): "${l.text.slice(0, 40)}..."`);
            if (seen.has(l.key))
                problems.push(`two lines share the key ${l.key}`);
            seen.add(l.key);
        }
    }
    const total = renderAnchor(a, opts).length;
    if (total > limits.total)
        problems.push(`the whole Anchor is ${total} letters (the limit is ${limits.total})`);
    if ((a.other || []).length)
        problems.push(`${a.other.length} line(s) outside the three parts are kept but not shown to her`);
    if ((a.broken || []).length)
        problems.push(`${a.broken.length} line(s) have a note that can't be read (kept as written): ${a.broken.map((x) => `"${x.slice(0, 30)}"`).join(", ")}`);
    return problems;
}
export const normQuote = (s) => String(s || "").toLowerCase().replace(/[’‘`']/g, "").replace(/[^\p{L}\p{N}\s]+/gu, " ").replace(/\s+/g, " ").trim();
export const MIN_QUOTE = 8;
const hasWords = (hay, needle) => ` ${hay} `.includes(` ${needle} `);
export function quoteFound(quote, text) {
    const q = normQuote(quote);
    return q.length >= MIN_QUOTE && hasWords(normQuote(text), q);
}
const COMMON = new Set("a an the and but or so if then when after before since until while in on at to from with without for of by as is are was were be been i im ive id ill me my mine we us our ours you your he him his she her hers they them their it its this that these those there here one two three four five six seven eight nine ten every each all some no not yes about once twice also still always never often sometimes today tonight yesterday tomorrow monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december spring summer fall autumn winter".split(" "));
const bare = (w) => String(w || "").replace(/[’‘`]/g, "'").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}']+$/gu, "").replace(/'s$/i, "").replace(/'$/, "");
export function namesIn(text, knownNames = []) {
    const out = new Set(), known = new Set(knownNames.map((k) => normQuote(k)).filter(Boolean));
    for (const w of String(text || "").split(/\s+/).map(bare).filter(Boolean)) {
        const k = normQuote(w);
        if (known.has(k)) {
            out.add(k);
            continue;
        }
        if (/^\p{Lu}/u.test(w) && !COMMON.has(k))
            out.add(k);
    }
    const flat = ` ${normQuote(text)} `;
    for (const k of known)
        if (k.includes(" ") && flat.includes(` ${k} `))
            out.add(k);
    return out;
}
const dropped = (oldText, newText, knownNames) => { const now = ` ${normQuote(newText)} `; return [...namesIn(oldText, knownNames)].filter((n) => !now.includes(` ${n} `)); };
export function dayOf(when) {
    if (when === null || when === undefined || when === "")
        return "";
    const t = new Date(typeof when === "number" ? when : String(when));
    if (isNaN(t))
        return String(when).slice(0, 10);
    const p = (x) => String(x).padStart(2, "0");
    return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
}
export function applyChanges(a0, changes, { shelfAt = () => "", jayAt = null, letter = "", now = new Date(), limits = LIMITS, knownNames = [], render = {} } = {}) {
    const parts = structuredClone(a0.parts);
    const byKey = new Map();
    for (const p of PARTS)
        for (const l of parts[p])
            if (!byKey.has(l.key))
                byKey.set(l.key, l);
    const a = { parts, doc: (a0.doc || []).map((d) => (d.line ? { line: byKey.get(d.line.key) || d.line, part: d.part } : d)), other: [...(a0.other || [])], broken: [...(a0.broken || [])] };
    const applied = [], rejected = [], madeKeys = new Set();
    const finds = (key) => { const r = []; for (const p of PARTS)
        a.parts[p].forEach((l, i) => { if (l.key === key)
            r.push({ p, i, l }); }); return r; };
    const no = (c, why) => rejected.push({ change: c, why });
    for (const c of changes || []) {
        if (!c || c.op === "no_change")
            continue;
        if (!["add", "update", "retire"].includes(c.op)) {
            no(c, "unknown kind of change");
            continue;
        }
        const hits = c.key ? finds(c.key) : [];
        if (hits.length > 1) {
            no(c, `more than one line has the key ${c.key}`);
            continue;
        }
        const hit = hits[0] || null;
        const proofs = c.soft && !c.correction ? (c.evidence || []) : [{ quote: c.quote, when: c.when }];
        if (!proofs.length || proofs.some((e) => !quoteFound(e?.quote, shelfAt(e?.when)))) {
            no(c, "its quote isn't on her Shelf at that moment");
            continue;
        }
        if (c.correction && (typeof jayAt !== "function" || !quoteFound(c.quote, jayAt(c.when)))) {
            no(c, "a correction must quote Ned's own words");
            continue;
        }
        if (c.soft && !c.correction && new Set(proofs.map((e) => dayOf(e.when)).filter(Boolean)).size < 2) {
            no(c, "a softer thing goes on only after it came up on two different days");
            continue;
        }
        if (c.op === "retire") {
            if (!hit) {
                no(c, "no line with that key");
                continue;
            }
            if (hit.l.locked && !c.correction) {
                no(c, "an anchor line changes only by Ned's correction");
                continue;
            }
            const lost = [...namesIn(hit.l.text, knownNames)];
            if (lost.length && !c.correction) {
                no(c, `it would drop ${lost.join(", ")}`);
                continue;
            }
            a.parts[hit.p].splice(hit.i, 1);
            a.doc = a.doc.filter((d) => d.line !== hit.l);
            applied.push({ ...c, old: hit.l.text });
            continue;
        }
        const text = String(c.text || "").replace(/\s+/g, " ").trim();
        if (!text) {
            no(c, "empty line");
            continue;
        }
        if (LOCK.test(text)) {
            no(c, "only Ned marks a line [anchor]");
            continue;
        }
        if (text.length > limits.line) {
            no(c, `the line is longer than ${limits.line} letters`);
            continue;
        }
        if (/<!--|-->/.test(text)) {
            no(c, "the line contains a page note");
            continue;
        }
        const part = c.op === "add" ? c.part : hit?.p;
        if (c.op === "add") {
            if (!PARTS.includes(c.part)) {
                no(c, "unknown part");
                continue;
            }
            if (hit) {
                no(c, "that key is already used (an update changes it)");
                continue;
            }
            if (a.parts[c.part].length >= limits.lines[c.part]) {
                no(c, `${HEAD[c.part]} is full`);
                continue;
            }
        }
        else {
            if (!hit) {
                no(c, "no line with that key");
                continue;
            }
            if (hit.l.locked && !c.correction) {
                no(c, "an anchor line changes only by Ned's correction");
                continue;
            }
            const lost = dropped(hit.l.text, text, knownNames);
            if (lost.length && !c.correction) {
                no(c, `it would drop ${lost.join(", ")} from the line`);
                continue;
            }
        }
        if (PARTS.some((p) => a.parts[p].some((l) => l !== hit?.l && normQuote(l.text) === normQuote(text)))) {
            no(c, "another line already says this");
            continue;
        }
        if (part === "her" && letter && normQuote(text).length >= MIN_QUOTE && hasWords(normQuote(letter), normQuote(text))) {
            no(c, "her letter already says it");
            continue;
        }
        let key = c.key;
        if (!key) {
            let i = 0;
            do
                key = `${part}.n${now.getTime()}-${++i}`;
            while (finds(key).length || madeKeys.has(key));
        }
        madeKeys.add(key);
        const last = proofs[proofs.length - 1];
        const line = { key, text, locked: c.op === "update" ? hit.l.locked : false, from: c.correction ? "Ned's correction" : "her", added: dayOf(now), quote: last.quote, when: last.when, ...(c.soft && !c.correction ? { days: [...new Set(proofs.map((e) => dayOf(e.when)))] } : {}) };
        if (c.op === "add")
            a.parts[part].push(line);
        else {
            a.parts[part][hit.i] = line;
            a.doc = a.doc.map((d) => (d.line === hit.l ? { line, part } : d));
        }
        if (renderAnchor(a, render).length > limits.total) {
            if (c.op === "add")
                a.parts[part].pop();
            else {
                a.parts[part][hit.i] = hit.l;
                a.doc = a.doc.map((d) => (d.line === line ? { line: hit.l, part } : d));
            }
            no(c, `the whole Anchor would pass ${limits.total} letters`);
            continue;
        }
        applied.push({ ...c, key, old: hit ? hit.l.text : null });
    }
    return { anchor: a, applied, rejected };
}
export function readAnchor(path, opts) {
    if (!existsSync(path))
        return null;
    return parseAnchor(readFileSync(path), opts);
}
export function saveAnchor(path, a, now = new Date()) {
    const hist = join(dirname(path), "anchor-history");
    if (existsSync(path)) {
        mkdirSync(hist, { recursive: true });
        copyFileSync(path, join(hist, `${basename(path, ".md")}-${now.toISOString().replace(/[:.]/g, "-")}.md`));
    }
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, formatAnchor(a), "utf8");
    renameSync(tmp, path);
}
export function anchorText(path, opts) {
    try {
        const a = readAnchor(path, opts);
        return a ? renderAnchor(a, opts) : "";
    }
    catch {
        return "";
    }
}
export function anchorProblems(path, opts) {
    try {
        const a = readAnchor(path, opts);
        return a ? checkAnchor(a, LIMITS, opts) : [];
    }
    catch (e) {
        return [`the Anchor can't be read: ${e.message}`];
    }
}
