// Part of The Web of Meaning: A Memory Design for Companions (Jay R. Martinson, 2026). MIT license; see LICENSE.
// Comments were removed for this release; the paper explains each part and why it was built that way.
import { cardLabel } from "./cards.mjs";
import { wordsIn, hasNoSpaceScript, STOP_ALL } from "./lang.mjs";
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, lstatSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
const HEADER = /^\\?​?\[([A-Z][A-Z0-9 _-]*)\]\s*\((.+?)\):\s*$/;
const CHUNK_WORDS = 350;
const BATCH = 8;
let server = null, ready = null;
export function startLibrarian(cfg, log = console.log) {
    if (ready && !server)
        return ready.then(async (base) => { try {
            const h = await fetch(`${base}/health`);
            if (h.ok)
                return base;
        }
        catch { } ready = null; return startLibrarian(cfg, log); }, () => startLibrarian(cfg, log));
    if (ready)
        return ready;
    const L = cfg.librarian;
    if (!L)
        return (ready = Promise.reject(new Error("No librarian in rooms.json")));
    const base = `http://127.0.0.1:${L.port || 28431}`;
    ready = (async () => {
        try {
            const h = await fetch(`${base}/health`);
            if (h.ok)
                return base;
        }
        catch { }
        if (!existsSync(L.exe))
            throw new Error(`The librarian program is missing (${L.exe}).`);
        if (!existsSync(L.model))
            throw new Error(`The librarian model is missing (${L.model}).`);
        server = spawn(L.exe, ["-m", L.model, "--embedding", "--host", "127.0.0.1", "--port", String(L.port || 28431),
            "-ngl", "99", "-c", "8192", "-b", "8192", "-ub", "2048"], {
            env: { ...process.env, CUDA_DEVICE_ORDER: "PCI_BUS_ID", CUDA_VISIBLE_DEVICES: String(L.gpu ?? "1") },
            stdio: "ignore", windowsHide: true,
        });
        server.on("exit", (code) => { log(`Librarian stopped (${code}).`); server = null; ready = null; });
        for (let i = 0; i < 120; i++) {
            await new Promise((r) => setTimeout(r, 500));
            try {
                const h = await fetch(`${base}/health`);
                if (h.ok) {
                    log(`Librarian is ready (the House's shared search helper, on ${cardLabel(L.gpu ?? "1")}).`);
                    return base;
                }
            }
            catch { }
        }
        throw new Error("The librarian did not start within a minute.");
    })();
    ready.catch(() => { ready = null; });
    return ready;
}
export async function embedFor(cfg, texts) { const base = await startLibrarian(cfg), out = []; for (let i = 0; i < texts.length; i += BATCH)
    out.push(...(await embedSafely(base, texts.slice(i, i + BATCH).map((t) => whole(t))))); return out; }
export function stopLibrarian() { try {
    server?.kill();
}
catch { } try {
    rrServer?.kill();
}
catch { } }
let rrServer = null, rrReady = null;
function startReranker(cfg, log = console.log) {
    if (rrReady && !rrServer)
        return rrReady.then(async (base) => { try {
            const h = await fetch(`${base}/health`);
            if (h.ok)
                return base;
        }
        catch { } rrReady = null; return startReranker(cfg, log); }, () => startReranker(cfg, log));
    if (rrReady)
        return rrReady;
    const R = cfg.reranker;
    if (!R)
        return (rrReady = Promise.reject(new Error("No reranker in rooms.json")));
    const base = `http://127.0.0.1:${R.port || 28432}`;
    rrReady = (async () => {
        try {
            const h = await fetch(`${base}/health`);
            if (h.ok)
                return base;
        }
        catch { }
        if (!existsSync(R.exe))
            throw new Error(`The reranker program is missing (${R.exe}).`);
        if (!existsSync(R.model))
            throw new Error(`The reranker model is missing (${R.model}).`);
        rrServer = spawn(R.exe, ["-m", R.model, "--reranking", "--host", "127.0.0.1", "--port", String(R.port || 28432),
            "-ngl", "99", "-c", "8192", "-b", "8192", "-ub", "8192"], {
            env: { ...process.env, CUDA_DEVICE_ORDER: "PCI_BUS_ID", CUDA_VISIBLE_DEVICES: String(R.gpu ?? "0") },
            stdio: "ignore", windowsHide: true,
        });
        rrServer.on("exit", (code) => { log(`Reranker stopped (${code}).`); rrServer = null; rrReady = null; });
        for (let i = 0; i < 120; i++) {
            await new Promise((r) => setTimeout(r, 500));
            try {
                const h = await fetch(`${base}/health`);
                if (h.ok) {
                    log(`Reranker is ready (on ${cardLabel(R.gpu ?? "0")}).`);
                    return base;
                }
            }
            catch { }
        }
        throw new Error("The reranker did not start within a minute.");
    })();
    rrReady.catch(() => { rrReady = null; });
    return rrReady;
}
export async function rerank(cfg, query, docs) {
    const base = await startReranker(cfg);
    const res = await fetch(`${base}/v1/rerank`, { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(60000),
        body: JSON.stringify({ query: whole(query), documents: docs.map((d) => whole(d)), top_n: docs.length }) });
    if (!res.ok)
        throw new Error(`reranker ${res.status}`);
    const j = await res.json();
    return (j.results || j.data || []).map((r) => ({ index: r.index, score: r.relevance_score ?? r.score ?? 0 }));
}
const STOP = new Set("a an the and or but if of to in on at by for with from as is are was were be been am i you he she it we they me him her us them my your his its our their this that these those there here what which who whom whose when where why how not no yes do does did done have has had will would can could should just so than then too very also about into over under again more most some any all each other such only own same s t don ll re ve m d o ok okay".split(" "));
export const words = (t) => (String(t).toLowerCase().normalize("NFC").match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}'’-]*/gu) || []).flatMap((w) => (hasNoSpaceScript(w) ? wordsIn(w) : [w])).map((w) => w.replace(/['’]s$/, "")).filter((w) => (w.length > 1 || hasNoSpaceScript(w)) && !STOP.has(w) && !STOP_ALL.has(w));
const kwIndexes = new Map();
function keywordIndex(root, mem, c) {
    let cm = 0;
    try {
        cm = statSync(cardsPath(root, mem)).mtimeMs;
    }
    catch { }
    const key = `${c._mtime}|${cm}`, have = kwIndexes.get(root);
    if (have && have.key === key)
        return have;
    const cards = loadCards(root, mem), docs = [], len = [], tf = [], df = new Map();
    for (const [rel, f] of Object.entries(c.files)) {
        let text = "";
        try {
            text = readFileSync(join(root, rel), "utf8").replace(/^﻿/, "");
        }
        catch {
            continue;
        }
        (f.chunks || []).forEach((ch, i) => {
            if (ch.a === undefined)
                return;
            const w = words(`${cards[rel]?.[cardKey(ch)] || ""} ${text.slice(ch.a, ch.b)}`), m = new Map();
            for (const x of w)
                m.set(x, (m.get(x) || 0) + 1);
            for (const x of m.keys())
                df.set(x, (df.get(x) || 0) + 1);
            docs.push({ rel, i });
            len.push(w.length);
            tf.push(m);
        });
    }
    const idx = { key, docs, len, tf, df, avg: len.reduce((a, b) => a + b, 0) / Math.max(1, len.length) };
    kwIndexes.set(root, idx);
    return idx;
}
function bm25(idx, query, k1 = 1.2, b = 0.75) {
    const q = [...new Set(words(query))], N = idx.docs.length, out = [];
    if (!q.length)
        return out;
    for (let d = 0; d < N; d++) {
        let s = 0;
        const m = idx.tf[d];
        for (const t of q) {
            const f = m.get(t);
            if (!f)
                continue;
            const n = idx.df.get(t) || 0;
            s += Math.log(1 + (N - n + 0.5) / (n + 0.5)) * (f * (k1 + 1)) / (f + k1 * (1 - b + b * idx.len[d] / idx.avg));
        }
        if (s > 0)
            out.push({ ...idx.docs[d], b: s });
    }
    return out.sort((x, y) => y.b - x.b);
}
async function embedSafely(base, texts) {
    try {
        return await embed(base, texts);
    }
    catch (err) {
        if (!/too large|batch size/i.test(String(err.message)))
            throw err;
        const out = [];
        for (let t of texts) {
            for (;;) {
                try {
                    out.push(...(await embed(base, [t])));
                    break;
                }
                catch (e) {
                    if (!/too large|batch size/i.test(String(e.message)) || t.length < 400)
                        throw e;
                    t = t.slice(0, Math.floor(t.length * 0.7));
                }
            }
        }
        return out;
    }
}
async function embed(base, texts) {
    const res = await fetch(`${base}/v1/embeddings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input: texts, model: "librarian" }) });
    if (!res.ok)
        throw new Error(`Librarian error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    return data.data.sort((a, b) => a.index - b.index).map((d) => normalize(Float32Array.from(d.embedding)));
}
function normalize(v) { let n = 0; for (const x of v)
    n += x * x; n = Math.sqrt(n) || 1; for (let i = 0; i < v.length; i++)
    v[i] /= n; return v; }
function listFiles(root, patterns) {
    const out = [];
    for (const p of patterns) {
        const [dir, pat] = [dirname(p), p.split("/").pop()];
        const full = join(root, dir);
        if (!existsSync(full))
            continue;
        const rx = new RegExp("^" + pat.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$", "i");
        for (const n of readdirSync(full))
            if (rx.test(n) && lstatSync(join(full, n)).isFile() && !/(^|[\\/])(diary|journal|attic|secrets?)([\\/]|$)/i.test(`${dir}/${n}`))
                out.push(`${dir}/${n}`);
    }
    return out;
}
const MAX_CHARS = 3500;
function chunkSmall(text, units, size) {
    const chunks = [];
    for (const u of units) {
        let a = u.a;
        while (a < u.b) {
            let b = Math.min(u.b, a + size);
            if (b < u.b) {
                const sp = text.lastIndexOf(" ", b);
                if (sp > a + size / 2)
                    b = sp;
            }
            chunks.push({ a, b, h: u.a });
            a = b;
            while (a < u.b && /\s/.test(text[a]))
                a++;
        }
    }
    return chunks;
}
function chunkFile(raw, pieceChars = 0) {
    const text = raw.replace(/^\uFEFF/, "");
    const lines = text.split(/\r?\n/);
    const starts = [];
    {
        let pos = 0;
        for (const l of text.split("\n")) {
            starts.push(pos);
            pos += l.length + 1;
        }
    }
    const isThread = lines.some((l) => HEADER.test(l.trim()));
    const units = [];
    let cur = null;
    for (let i = 0; i < lines.length; i++) {
        const newUnit = isThread ? HEADER.test(lines[i].trim()) : (lines[i].trim() === "" && cur && cur.words > 0);
        if (!cur || newUnit) {
            if (cur && cur.words)
                units.push(cur);
            cur = { a: starts[i], b: starts[i], words: 0 };
        }
        cur.b = starts[i] + lines[i].length;
        cur.words += lines[i].split(/\s+/).filter(Boolean).length;
    }
    if (cur && cur.words)
        units.push(cur);
    if (pieceChars > 0)
        return { text, chunks: chunkSmall(text, units, pieceChars) };
    const chunks = [];
    let i = 0;
    while (i < units.length) {
        const u = units[i];
        if (u.b - u.a > MAX_CHARS) {
            for (let a = u.a; a < u.b; a += MAX_CHARS - 300)
                chunks.push({ a, b: Math.min(u.b, a + MAX_CHARS) });
            i++;
            continue;
        }
        let j = i, words = 0;
        while (j < units.length && units[j].b - units[j].a <= MAX_CHARS && (j === i || (words + units[j].words <= CHUNK_WORDS && units[j].b - units[i].a <= MAX_CHARS))) {
            words += units[j].words;
            j++;
        }
        chunks.push({ a: units[i].a, b: units[j - 1].b });
        if (j >= units.length)
            break;
        i = j > i + 1 ? j - 1 : j;
    }
    return { text, chunks };
}
const lineOf = (text, pos) => { let n = 1; for (let k = 0; k < pos; k++)
    if (text.charCodeAt(k) === 10)
        n++; return n; };
const catalogs = new Map();
function catalogFile(root, mem) { return join(root, mem.indexDir || "Index", "catalog.json"); }
function loadCatalog(root, mem) {
    let onDisk = 0;
    try {
        onDisk = statSync(catalogFile(root, mem)).mtimeMs;
    }
    catch { }
    if (catalogs.has(root) && catalogs.get(root)._mtime === onDisk)
        return catalogs.get(root);
    let c = { files: {} };
    try {
        c = JSON.parse(readFileSync(catalogFile(root, mem), "utf8"));
    }
    catch { }
    c._mtime = onDisk;
    for (const f of Object.values(c.files))
        f.vecs = f.vecs.map((b) => { const buf = Buffer.from(b, "base64"); return new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)); });
    catalogs.set(root, c);
    return c;
}
function saveCatalog(root, mem, c) {
    const out = { files: {}, ...(c.pieceChars ? { pieceChars: c.pieceChars } : {}) };
    for (const [k, f] of Object.entries(c.files))
        out.files[k] = { ...f, vecs: f.vecs.map((v) => Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString("base64")) };
    const file = catalogFile(root, mem);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file + ".tmp", JSON.stringify(out), "utf8");
    renameSync(file + ".tmp", file);
    try {
        c._mtime = statSync(file).mtimeMs;
    }
    catch { }
}
const cardsPath = (root, mem) => join(root, mem.indexDir || "Index", "cards.json");
const redoPath = (root, mem) => join(dirname(cardsPath(root, mem)), "cards-redo.json");
export function loadRedo(root, mem) { try {
    return JSON.parse(readFileSync(redoPath(root, mem), "utf8"));
}
catch {
    return {};
} }
export function saveRedo(root, mem, redo) { const f = redoPath(root, mem); writeFileSync(f + ".tmp", JSON.stringify(redo), "utf8"); renameSync(f + ".tmp", f); }
export function loadCards(root, mem) { try {
    return JSON.parse(readFileSync(cardsPath(root, mem), "utf8"));
}
catch {
    return {};
} }
export function saveCards(root, mem, cards) {
    const f = cardsPath(root, mem);
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f + ".tmp", JSON.stringify(cards), "utf8");
    renameSync(f + ".tmp", f);
}
export const cardKey = (ch) => `${ch.a}-${ch.b}`;
const whole = (t) => t.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
const pieceText = (rel, text, ch, fc) => { const card = fc[cardKey(ch)]; return whole(`title: ${rel} | text: ${card ? card + "\n\n" : ""}${text.slice(ch.a, ch.b).replace(/\u200B/g, "")}`); };
export function conversationFiles(root, mem, firstDir = "") {
    const pats = (mem.indexPaths || []).filter((p) => /^Shelf\//.test(p));
    pats.sort((x, y) => (firstDir && y.startsWith(firstDir) ? 1 : 0) - (firstDir && x.startsWith(firstDir) ? 1 : 0));
    return pats.flatMap((p) => listFiles(root, [p]).sort().reverse());
}
export function setCard(root, mem, rel, line, text) {
    const { text: page, chunks } = fileChunks(root, mem, rel);
    let pos = 0;
    for (let n = 1; n < Math.max(1, Number(line) || 1); n++) {
        const nl = page.indexOf("\n", pos);
        if (nl < 0) {
            pos = page.length;
            break;
        }
        pos = nl + 1;
    }
    const want = Math.max(1, Number(line) || 1);
    const ch = chunks.find((x) => lineOf(page, x.a) === want) || chunks.find((x) => x.a <= pos && pos < x.b) || chunks.find((x) => x.a >= pos);
    if (!ch)
        throw new Error(`No piece of ${rel} at line ${line}.`);
    const cards = loadCards(root, mem), fc = cards[rel] || (cards[rel] = {}), k = cardKey(ch), before = fc[k] || "";
    fc[k] = String(text || "").replace(/\s+/g, " ").trim().slice(0, 600);
    saveCards(root, mem, cards);
    try {
        const redo = loadRedo(root, mem);
        if (redo[rel]?.includes(k)) {
            redo[rel] = redo[rel].filter((x) => x !== k);
            saveRedo(root, mem, redo);
        }
    }
    catch { }
    return { before, after: fc[k] };
}
export function fileChunks(root, mem, rel) { return chunkFile(readFileSync(join(root, rel), "utf8"), Number(mem.pieceChars) || 0); }
export async function updateCatalog(cfg, root, mem, log = () => { }) {
    const base = await startLibrarian(cfg, log);
    const c = loadCatalog(root, mem);
    const size = Number(mem.pieceChars) || 0;
    if ((c.pieceChars || 0) !== size) {
        c.files = {};
        c.pieceChars = size;
        log(`Librarian is re-reading this room in pieces of ${size || "the usual"} size.`);
    }
    const files = listFiles(root, mem.indexPaths || []);
    const cards = loadCards(root, mem);
    let changed = 0, pieces = 0;
    for (const rel of files) {
        const st = statSync(join(root, rel));
        const old = c.files[rel], fc = cards[rel] || {};
        if (old && old.mtime === st.mtimeMs && old.size === st.size && (old.chunks.length === 0 || old.chunks[0].a !== undefined)) {
            const redo = old.chunks.map((ch, i) => ((fc[cardKey(ch)] || "") !== ((old.cards || [])[i] || "") ? i : -1)).filter((i) => i >= 0);
            if (!redo.length)
                continue;
            const text = readFileSync(join(root, rel), "utf8").replace(/^\uFEFF/, "");
            for (let i = 0; i < redo.length; i += BATCH) {
                const idx = redo.slice(i, i + BATCH), v = await embedSafely(base, idx.map((k) => pieceText(rel, text, old.chunks[k], fc)));
                idx.forEach((k, j) => { old.vecs[k] = v[j]; });
            }
            old.cards = old.chunks.map((ch) => fc[cardKey(ch)] || "");
            saveCatalog(root, mem, c);
            changed++;
            pieces += redo.length;
            log(`Librarian re-read ${redo.length} pieces of ${rel} with their index cards.`);
            continue;
        }
        const { text, chunks } = chunkFile(readFileSync(join(root, rel), "utf8"), size);
        const vecs = [];
        for (let i = 0; i < chunks.length; i += BATCH) {
            const batch = chunks.slice(i, i + BATCH).map((ch) => pieceText(rel, text, ch, fc));
            vecs.push(...(await embedSafely(base, batch)));
        }
        c.files[rel] = { mtime: st.mtimeMs, size: st.size, chunks, vecs, cards: chunks.map((ch) => fc[cardKey(ch)] || "") };
        saveCatalog(root, mem, c);
        changed++;
        pieces += chunks.length;
        log(`Librarian read ${rel} (${chunks.length} pieces).`);
    }
    for (const rel of Object.keys(c.files))
        if (!files.includes(rel))
            delete c.files[rel];
    saveCatalog(root, mem, c);
    return { changed, pieces, files: files.length };
}
export function skippedPiece(mem, text, ch) {
    if (!Array.isArray(mem.skip) || !mem.skip.length || ch.a === undefined)
        return false;
    const line = (at) => text.slice(at, text.indexOf("\n", at) < 0 ? undefined : text.indexOf("\n", at));
    const head = ch.h !== undefined ? line(ch.h).trim() : "";
    const m = HEADER.exec((head || line(ch.a)).trim());
    return !!(m && mem.skip.includes(m[2].trim()));
}
export async function searchMemory(cfg, root, mem, query, max = 6, opts = {}) {
    if (Number(mem.results) > 0 && !opts.items)
        max = Math.min(max, Number(mem.results));
    const from = mem.skipInView && opts.inViewFrom ? Date.parse(opts.inViewFrom) : NaN;
    await updateCatalog(cfg, root, mem);
    const base = await startLibrarian(cfg);
    const [q] = await embedSafely(base, [whole(`task: search result | query: ${query}`)]);
    const c = loadCatalog(root, mem);
    const cards = opts.raw ? {} : loadCards(root, mem);
    const scored = [];
    for (const [rel, f] of Object.entries(c.files))
        f.vecs.forEach((v, i) => { let s = 0; for (let k = 0; k < v.length; k++)
            s += v[k] * q[k]; scored.push({ rel, i, s }); });
    scored.sort((a, b) => b.s - a.s);
    let order = scored.slice(0, 400), how = "";
    if (mem.hybrid && !opts.raw && opts.minScore === undefined) {
        try {
            const kw = bm25(keywordIndex(root, mem, c), query).slice(0, 200), rrf = new Map(), id = (h) => `${h.rel}#${h.i}`, dense = new Map();
            scored.slice(0, 200).forEach((h, r) => { dense.set(id(h), h); rrf.set(id(h), (rrf.get(id(h)) || 0) + 1 / (60 + r + 1)); });
            kw.forEach((h, r) => rrf.set(id(h), (rrf.get(id(h)) || 0) + 1 / (60 + r + 1)));
            const sByKey = new Map(scored.map((h) => [id(h), h.s]));
            let fused = [...rrf.entries()].sort((x, y) => y[1] - x[1]).map(([k]) => { const [rel, i] = [k.slice(0, k.lastIndexOf("#")), Number(k.slice(k.lastIndexOf("#") + 1))]; return { rel, i, s: sByKey.get(k) ?? 0 }; });
            how = " (meaning + words)";
            if (cfg.reranker && mem.rerank !== false) {
                try {
                    const top = fused.slice(0, Number(mem.rerankTop) || 30), tx = new Map();
                    const docs = top.map((h) => { const ch = c.files[h.rel].chunks[h.i]; if (!tx.has(h.rel))
                        tx.set(h.rel, readFileSync(join(root, h.rel), "utf8").replace(/^\uFEFF/, "")); const card = cards[h.rel]?.[cardKey(ch)] || ""; return `${card}\n${tx.get(h.rel).slice(ch.a, ch.b)}`.slice(0, 2500); });
                    const ranked = await rerank(cfg, query, docs);
                    if (ranked.length) {
                        fused = [...ranked.map((r) => top[r.index]).filter(Boolean), ...fused.slice(top.length)];
                        how = " (meaning + words, reranked)";
                    }
                }
                catch (e) {
                    how = ` (meaning + words; the reranker couldn't help: ${e.message})`;
                }
            }
            order = fused;
        }
        catch (e) {
            how = ` (meaning only: ${e.message})`;
        }
    }
    const out = [], want = Math.min(Math.max(1, max), opts.items ? 60 : 15), texts = new Map(), items = [];
    const raw = [];
    for (const h of order) {
        if (out.length >= want)
            break;
        if (opts.minScore !== undefined && h.s < opts.minScore)
            break;
        const ch = c.files[h.rel].chunks[h.i];
        if (!texts.has(h.rel))
            texts.set(h.rel, readFileSync(join(root, h.rel), "utf8").replace(/^\uFEFF/, ""));
        const text = texts.get(h.rel);
        if (ch.a === undefined)
            continue;
        const head = ch.h !== undefined ? text.slice(ch.h, text.indexOf("\n", ch.h) < 0 ? undefined : text.indexOf("\n", ch.h)).trim() : "";
        if (skippedPiece(mem, text, ch))
            continue;
        if (!isNaN(from)) {
            const m = HEADER.exec(head || text.slice(ch.a, text.indexOf("\n", ch.a)).trim());
            const t = m ? Date.parse(m[2]) : NaN;
            if (!isNaN(t) && t >= from)
                continue;
        }
        let piece = text.slice(ch.a, ch.b).replace(/\u200B/g, "");
        if (head && ch.h < ch.a)
            piece = head.replace(/\u200B/g, "") + "\n…" + piece;
        const card = cards[h.rel]?.[cardKey(ch)];
        let jnote = "";
        if (opts.journalDays?.size) {
            const lines = [head, ...piece.split("\n", 40)].filter(Boolean), hm = lines.map((l) => HEADER.exec(l.replace(/\u200B/g, "").trim())).find(Boolean), tt = hm ? Date.parse(hm[2]) : NaN;
            if (!isNaN(tt)) {
                const d = new Date(tt), day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                if (opts.journalDays.has(day))
                    jnote = `\n(There's a journal entry from that day, ${d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.)`;
            }
        }
        out.push(`— ${h.rel}, from line ${lineOf(text, ch.a)} (closeness ${h.s.toFixed(2)})${card ? `\n(its index card: “${card}”)` : ""}${jnote}:\n${piece.length > 3000 ? piece.slice(0, 3000) + " …" : piece}`);
        raw.push({ rel: h.rel, s: h.s, piece });
        if (opts.items)
            items.push({ rel: h.rel, key: cardKey(ch), line: lineOf(text, ch.a), card: card || "", piece, journal: !!jnote, s: h.s });
    }
    if (opts.raw)
        return { pieces: raw, top: scored.slice(0, 3).map((h) => +h.s.toFixed(3)) };
    if (opts.items)
        return { items, how };
    return out.length ? out.join("\n\n") : "The catalog is empty.";
}
