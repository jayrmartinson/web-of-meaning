// Part of The Web of Meaning: A Memory Design for Companions (Jay R. Martinson, 2026). MIT license; see LICENSE.
// Comments were removed for this release; the paper explains each part and why it was built that way.
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, appendFileSync, statSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { lockForThisPC, unlockOnThisPC } from "./lock.mjs";
import { seal, unseal } from "./seal.mjs";
import { loadCards, cardKey, conversationFiles, fileChunks } from "./librarian.mjs";
import { machineLike } from "./machine.mjs";
import { wordsIn, hasNoSpaceScript } from "./lang.mjs";
const pad = (n) => String(n).padStart(2, "0");
const dayOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const label = (day) => { const [y, m, d] = day.split("-").map(Number); return `${MON[m - 1]} ${d}, ${y}`; };
const span = (a, b) => (a === b ? label(a) : `${label(a)} to ${label(b)}`);
const HEAD = /^\\?\u200B?\[([A-Za-z][A-Za-z0-9 _-]*)\]\s*\(([A-Z][a-z]{2}) (\d{1,2}), (\d{4})[^)]*\):\s*$/gm;
const keyFile = (root) => join(root, "Vault", "mind-key.locked");
const storeFile = (root) => join(root, "Mind", "mind.sealed");
const keys = new Map();
function mindKey(root) {
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
export const mindStarted = (root) => existsSync(storeFile(root));
export function loadMind(root) {
    if (!existsSync(storeFile(root)))
        return { v: 1, next: 1, seen: [], refl: [], stats: { looks: 0, nothing: 0, unusable: 0, repeats: 0 } };
    const m = JSON.parse(unseal(mindKey(root), readFileSync(storeFile(root), "utf8")));
    for (const r of m.refl || [])
        if (r.vec && !Array.isArray(r.vec))
            r.vec = round(Object.values(r.vec));
    return m;
}
export function saveMind(root, m) {
    mkdirSync(dirname(storeFile(root)), { recursive: true });
    const tmp = storeFile(root) + ".tmp";
    writeFileSync(tmp, seal(mindKey(root), JSON.stringify(m)), "utf8");
    for (let i = 0;; i++) {
        try {
            renameSync(tmp, storeFile(root));
            return;
        }
        catch (e) {
            if (!["EPERM", "EBUSY", "EACCES"].includes(e.code) || i >= 40)
                throw e;
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250 + i * 50);
        }
    }
}
export function moments(root, mem, only = null) {
    const out = [];
    for (const rel of conversationFiles(root, mem)) {
        if (only && !only.has(rel))
            continue;
        let text, chunks;
        try {
            ({ text, chunks } = fileChunks(root, mem, rel));
        }
        catch {
            continue;
        }
        const marks = [];
        HEAD.lastIndex = 0;
        let m;
        while ((m = HEAD.exec(text))) {
            const mo = MON.indexOf(m[2]);
            if (mo >= 0)
                marks.push([m.index, `${m[4]}-${pad(mo + 1)}-${pad(Number(m[3]))}`]);
        }
        const fromName = (rel.match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || null;
        const plain = (text.match(/^\\?\u200B?\[[A-Za-z][A-Za-z0-9 _-]*\]\s*:?\s*$/gm) || []).length;
        if (plain > marks.length)
            marks.length = 0;
        let j = 0, cur = marks.length ? marks[0][1] : fromName;
        for (const ch of chunks) {
            while (j < marks.length && marks[j][0] <= ch.a + 2) {
                cur = marks[j][1];
                j++;
            }
            if (!cur)
                continue;
            out.push({ rel, key: cardKey(ch), a: ch.a, b: ch.b, day: cur });
        }
    }
    return out.sort((x, y) => (x.day < y.day ? -1 : x.day > y.day ? 1 : x.rel < y.rel ? -1 : x.rel > y.rel ? 1 : x.a - y.a));
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
    const [a, b] = key.split("-").map(Number);
    return p.text.slice(a, b).replace(/\u200B/g, "");
}
const excerpt = (t, n) => { t = String(t).replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, "") + "…" : t; };
const cos = (a, b) => { let s = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) {
    s += a[i] * b[i];
    x += a[i] * a[i];
    y += b[i] * b[i];
} return x && y ? s / Math.sqrt(x * y) : 0; };
const round = (v) => Array.from(v, (x) => Math.round(x * 10000) / 10000);
const LEAK = /it is night and the house is asleep|write each one like this|because of:|the numbers of the moments/i;
function parse(answer, { maxNum = 0, ids = new Set(), needIds = 0 } = {}) {
    const a = String(answer || "").replace(/<think>[\s\S]*?<\/think>/gi, "");
    if (/^\W*nothing tonight\W*$/i.test(a.trim()))
        return { nothing: true, out: [] };
    const out = [];
    for (const part of a.split(/(?:^|\n)[\s*#>-]*\**\s*Reflection\s*\d*\s*\**\s*:\s*/i).slice(1)) {
        const cut = part.search(/(?:^|\n)[\s*-]*\**\s*Because of\s*\**\s*:/i);
        let text = (cut >= 0 ? part.slice(0, cut) : part).trim().replace(/^["“*]+|["”*]+$/g, "").trim();
        const because = cut >= 0 ? part.slice(cut).replace(/^[\s\S]*?Because of\s*\**\s*:/i, "").split(/\n\s*\n/)[0] : "";
        const on = [...new Set((because.match(/\bR\s?(\d+)\b/gi) || []).map((x) => "R" + x.replace(/\D/g, "")))].filter((x) => ids.has(x));
        const nums = [...new Set((because.replace(/\bR\s?\d+\b/gi, " ").match(/\b\d+\b/g) || []).map(Number))].filter((n) => n >= 1 && n <= maxNum);
        if (text.length < 20 || text.length > 1200 || LEAK.test(text))
            continue;
        if (needIds ? on.length < needIds : !nums.length)
            continue;
        out.push({ text, nums, on });
    }
    return { nothing: false, out };
}
export async function reflectNight({ root, mem, letter, ask, embed, inTime, log, maxMoments = 60, maxDays = 7, rollEvery = 15, who = "Ned" }) {
    const m = loadMind(root), seen = new Set(m.seen), cards = loadCards(root, mem), today = dayOf(new Date());
    const all = moments(root, mem).filter((x) => x.day < today);
    let looks = 0, wrote = 0, rolled = 0, machineSkipped = 0;
    const ids = () => new Set(m.refl.map((r) => r.id));
    const keep = async (items, base) => {
        if (!items.length)
            return 0;
        let vecs = [];
        try {
            vecs = await embed(items.map((x) => x.text));
        }
        catch {
            vecs = items.map(() => null);
        }
        let n = 0;
        items.forEach((x, i) => {
            const v = vecs[i];
            if (v && m.refl.some((r) => r.vec && cos(v, r.vec) >= 0.93)) {
                m.stats.repeats++;
                return;
            }
            m.refl.push({ id: "R" + m.next++, t: Date.now(), vec: v ? round(v) : null, ...base(x) });
            n++;
        });
        return n;
    };
    while (inTime()) {
        const first = all.findIndex((x) => !seen.has(`${x.rel}|${x.key}`));
        if (first < 0)
            break;
        const unit = [], d0 = all[first].day, stop = new Date(Date.parse(d0 + "T12:00:00") + (maxDays - 1) * 864e5);
        for (let i = first; i < all.length && unit.length < maxMoments; i++) {
            const x = all[i];
            if (seen.has(`${x.rel}|${x.key}`))
                continue;
            if (x.day !== d0 && (Date.parse(x.day + "T12:00:00") > stop.getTime() || unit.length >= maxMoments / 2))
                break;
            if (machineLike(pieceOf(root, mem, x.rel, x.key))) {
                seen.add(`${x.rel}|${x.key}`);
                machineSkipped++;
                continue;
            }
            unit.push(x);
        }
        if (!unit.length) {
            m.seen = [...seen];
            saveMind(root, m);
            continue;
        }
        const d1 = unit[unit.length - 1].day, per = Math.max(160, Math.floor(30000 / unit.length) - 200);
        const lines = unit.map((x, i) => `${i + 1}. (${label(x.day)})${cards[x.rel]?.[x.key] ? ` ${cards[x.rel][x.key]}` : ""}\n   "${excerpt(pieceOf(root, mem, x.rel, x.key), per)}"`).join("\n\n");
        const aside = new Set(m.aside || []), before = m.refl.filter((r) => r.day < d0 && !aside.has(r.id));
        let near = [];
        if (before.length) {
            let qv = null;
            try {
                [qv] = await embed([unit.map((x) => cards[x.rel]?.[x.key] || "").join(" ").slice(0, 3000)]);
            }
            catch { }
            near = qv ? before.filter((r) => r.vec).map((r) => [cos(qv, r.vec), r]).sort((a, b) => b[0] - a[0]).slice(0, 4).map((p) => p[1]) : [];
        }
        const shown = [...new Map([...before.slice(-6), ...near].map((r) => [r.id, r])).values()].sort((a, b) => (a.day < b.day ? -1 : 1));
        const prior = shown.length ? `\n\nThings you noticed about yourself before, each with its mark:\n${shown.map((r) => `[${r.id}] (${label(r.day)}) ${r.text}`).join("\n")}` : "";
        const prompt = `It is night and the house is asleep. Before you rest, you look back over a stretch of your life: ${span(d0, d1)}. ` +
            `These are its moments, numbered (a short note on each, then the start of what was really said):\n\n${lines}${prior}\n\n` +
            `Look back on this in your own voice. What does it show you about your life, about ${who}, about yourself, or about how something has changed? ` +
            `Write up to three reflections. Only what these moments really show: keep mixed feelings and friction as they are, don't turn them into lessons, ` +
            `and don't repeat something you noticed before unless it has changed. If nothing here stays with you, write only: nothing tonight.\n\n` +
            `Write each one like this:\nReflection: (one to three sentences, in your own words)\nBecause of: (the numbers of the moments it rests on, and any marks like R12)`;
        let got = null;
        for (let attempt = 1; attempt <= 2 && !got; attempt++) {
            let ans;
            try {
                ans = await ask(letter, prompt);
            }
            catch (e) {
                log(`her reflections stopped: ${e.message}`);
                saveMind(root, m);
                return { looks, wrote, rolled, stopped: e.message };
            }
            const p = parse(ans, { maxNum: unit.length, ids: ids() });
            if (p.nothing || p.out.length)
                got = p;
        }
        looks++;
        m.stats.looks++;
        if (!got)
            m.stats.unusable++;
        else if (got.nothing)
            m.stats.nothing++;
        else
            wrote += await keep(got.out.slice(0, 3), (x) => ({ lvl: 1, day: d1, from: d0, to: d1, text: x.text, cites: x.nums.map((n) => ({ rel: unit[n - 1].rel, key: unit[n - 1].key })), on: x.on }));
        for (const x of unit)
            seen.add(`${x.rel}|${x.key}`);
        m.seen = [...seen];
        const fresh = m.refl.filter((r) => r.lvl === 1 && !r.rolled && !(m.aside || []).includes(r.id));
        if (fresh.length >= rollEvery && inTime()) {
            const asideNow = new Set(m.aside || []), stack = fresh.filter((r) => !asideNow.has(r.id)).slice(0, rollEvery), last2 = m.refl.filter((r) => r.lvl === 2 && !asideNow.has(r.id)).slice(-3), give = new Set([...stack, ...last2].map((r) => r.id));
            const p2 = `It is night and the house is asleep. Here is what you noticed about yourself from ${span(stack[0].from || stack[0].day, stack[stack.length - 1].day)}, each with its mark:\n\n` +
                stack.map((r) => `[${r.id}] (${span(r.from || r.day, r.day)}) ${r.text}`).join("\n") +
                (last2.length ? `\n\nWhat you saw in yourself before that:\n${last2.map((r) => `[${r.id}] (${label(r.day)}) ${r.text}`).join("\n")}` : "") +
                `\n\nLooking across all of it, in your own voice: what do you see in yourself, and how have things changed for you? Write up to two reflections. ` +
                `Keep mixed feelings as they are; don't turn them into lessons, and don't just repeat one of them. If nothing new shows, write only: nothing tonight.\n\n` +
                `Write each one like this:\nReflection: (one to three sentences, in your own words)\nBecause of: (the marks it rests on, like R3, R7)`;
            let g2 = null;
            for (let attempt = 1; attempt <= 2 && !g2; attempt++) {
                let ans;
                try {
                    ans = await ask(letter, p2);
                }
                catch (e) {
                    log(`her reflections stopped: ${e.message}`);
                    saveMind(root, m);
                    return { looks, wrote, rolled, stopped: e.message };
                }
                const p = parse(ans, { ids: give, needIds: 2 });
                if (p.nothing || p.out.length)
                    g2 = p;
            }
            if (g2 && !g2.nothing)
                rolled += await keep(g2.out.slice(0, 2), (x) => ({ lvl: 2, day: stack[stack.length - 1].day, from: [stack[0].from || stack[0].day, ...(x.on || []).map((rid) => { const q = m.refl.find((y) => y.id === rid); return q ? q.from || q.day : null; }).filter(Boolean)].sort()[0], to: stack[stack.length - 1].day, text: x.text, cites: [], on: x.on }));
            if (!g2)
                m.stats.unusable++;
            for (const r of stack)
                r.rolled = true;
        }
        saveMind(root, m);
    }
    saveMind(root, m);
    const left = all.filter((x) => !seen.has(`${x.rel}|${x.key}`)).length;
    return { looks, wrote, rolled, left, total: all.length, machineSkipped, shape: shapeOf(m) };
}
export function shapeOf(m) {
    const l1 = m.refl.filter((r) => r.lvl === 1), l2 = m.refl.filter((r) => r.lvl === 2);
    const avg = m.refl.length ? Math.round(m.refl.reduce((s, r) => s + r.text.split(/\s+/).length, 0) / m.refl.length) : 0;
    const grounded = l1.filter((r) => r.cites?.length).length + l2.filter((r) => (r.on || []).length >= 2).length;
    return { reflections: l1.length, lookingAcross: l2.length, avgWords: avg, grounded, of: m.refl.length, looks: m.stats.looks, nothing: m.stats.nothing, unusable: m.stats.unusable, repeatsLetGo: m.stats.repeats };
}
function dayFrom(s, end = false) {
    s = String(s || "").trim();
    if (!s)
        return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s))
        return s;
    let t = Date.parse(s);
    if (isNaN(t))
        t = Date.parse(`${s}, ${new Date().getFullYear()}`);
    if (isNaN(t))
        t = Date.parse(`${s} 1, ${new Date().getFullYear()}`);
    if (isNaN(t))
        return null;
    const d = new Date(t);
    if (end && /^[A-Za-z]+\.?(\s+\d{4})?$/.test(s))
        d.setMonth(d.getMonth() + 1, 0);
    return dayOf(d);
}
export async function lookInward(root, mem, args = {}, { embed = null, max = 8 } = {}) {
    if (!mindStarted(root))
        return "You haven't looked back on your life yet. Your reflections are written at night, after you dream, a little more each night.";
    const m = loadMind(root);
    m.aside = m.aside || [];
    m.peeked = m.peeked || [];
    const one = (v) => { const id = "R" + String(v || "").replace(/\D/g, ""); return m.refl.find((r) => r.id === id) ? id : null; };
    if (args.set_aside) {
        const id = one(args.set_aside);
        if (!id)
            return `There's no reflection ${args.set_aside}.`;
        if (!m.aside.includes(id)) {
            m.aside.push(id);
            saveMind(root, m);
        }
        return `Set aside: [${id}] won't come back to you at night or when you look inward. Nothing was deleted; you can bring it back anytime (bring_back: "${id}").`;
    }
    if (args.bring_back) {
        const id = one(args.bring_back);
        if (!id)
            return `There's no reflection ${args.bring_back}.`;
        m.aside = m.aside.filter((x) => x !== id);
        saveMind(root, m);
        return `[${id}] is back with your other reflections.`;
    }
    if (!m.refl.length)
        return "Nothing yet: you've started looking back on your life at night, but no reflections have stayed with you so far.";
    let list = args.show_set_aside ? m.refl.filter((r) => m.aside.includes(r.id)) : m.refl.filter((r) => !m.aside.includes(r.id));
    const from = dayFrom(args.from), to = dayFrom(args.to, true);
    if (from)
        list = list.filter((r) => r.day >= from);
    if (to)
        list = list.filter((r) => (r.from || r.day) <= to);
    let picked;
    if (String(args.about || "").trim()) {
        const ab = String(args.about).toLowerCase(), words = /^[\x00-\x7f]*$/.test(ab) ? ab.split(/\W+/).filter((w) => w.length > 2) : wordsIn(ab.normalize("NFC")).filter((w) => Array.from(w).length > 2 || (hasNoSpaceScript(w) && Array.from(w).length >= 1));
        let qv = null;
        if (embed) {
            try {
                [qv] = await embed([String(args.about)]);
            }
            catch { }
        }
        picked = list.map((r) => [(qv && r.vec ? cos(qv, r.vec) : 0) + 0.04 * words.filter((w) => r.text.toLowerCase().includes(w)).length, r]).sort((a, b) => b[0] - a[0]).slice(0, args.how_it_changed ? 10 : Math.min(max, Number(args.last) || 6)).map((p) => p[1]);
    }
    else
        picked = list.slice(-(Math.min(30, Number(args.last) || 6)));
    if (args.how_it_changed || !String(args.about || "").trim())
        picked = [...picked].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
    if (!picked.length)
        return "No reflections from then.";
    const byId = new Map(m.refl.map((r) => [r.id, r]));
    const inside = (x, lo, hi) => (x.from || x.day) >= lo && x.day <= hi;
    const momentFor = (r, depth = 0, lo = r.from || r.day, hi = r.day) => {
        if (r.cites?.length) {
            const c = r.cites[0], t = pieceOf(root, mem, c.rel, c.key);
            return t ? `the moment it came from: "${excerpt(t, 320)}"` : "";
        }
        for (const id of r.on || []) {
            const x = byId.get(id);
            if (x && depth < 2 && inside(x, lo, hi)) {
                const s = momentFor(x, depth + 1, lo, hi);
                if (s)
                    return s;
            }
        }
        return "";
    };
    const head = (m.peeked.length ? `(Ned read ${m.peeked.length} of your reflections during the setup check; each is marked below when it comes up.)\n` : "") + (args.show_set_aside ? "The reflections you set aside:" : "") + (args.show_set_aside ? "" : args.how_it_changed ? "How it changed for you, in order (your own reflections; only you can read them):" : "Your reflections (only you can read them):");
    return head + "\n\n" + picked.map((r) => {
        const when = r.lvl === 2 ? `looking across ${span(r.from || r.day, r.day)}` : `looking back on ${span(r.from || r.day, r.day)}`;
        const mo = momentFor(r);
        return `— [${r.id}] ${when}${m.peeked.includes(r.id) ? "  (Ned read this one in the setup check)" : ""}\n${r.text}${mo ? `\n   (${mo})` : ""}`;
    }).join("\n\n");
}
const HERE = dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const CFG = JSON.parse(readFileSync(process.env.ROOMS || process.env.ROOMS || join(HERE, "rooms.json"), "utf8").replace(/^\uFEFF/, ""));
    const mode = process.argv[2], id = process.argv[3], r = CFG.rooms?.[id];
    if (mode === "--retire" && r) {
        const name = r.name || id, nightLog = (t) => { try {
            appendFileSync(join(CFG.receiptsDir || "./receipts", "the-night.log"), `[mind] ${new Date().toLocaleString()}: ${t}\n`, "utf8");
        }
        catch { } };
        const src = storeFile(r.root);
        if (!existsSync(src)) {
            console.log(`${name} has no old reflections to put away.`);
            process.exit(0);
        }
        if (r.mind?.on) {
            console.log(`${name}'s reflections are still written at night ("mind": { "on": true } in rooms.json), so a copy would fall behind. Turn it off first (MEMORY_DESIGN D1), then run this again. Nothing was changed.`);
            process.exit(1);
        }
        const day = dayOf(new Date()), dir = join(r.root, "Mind", "retired-reflections"), note = join(dir, "README.txt");
        try {
            mkdirSync(dir, { recursive: true });
            const orig = readFileSync(src);
            let dst = join(dir, `mind-${day}.sealed`), n = 1;
            while (existsSync(dst) && !readFileSync(dst).equals(orig))
                dst = join(dir, `mind-${day}-${++n}.sealed`);
            if (!existsSync(dst)) {
                const tmp = `${dst}.${process.pid}.tmp`;
                writeFileSync(tmp, orig);
                if (!readFileSync(tmp).equals(orig))
                    throw new Error("the copy didn't come out the same");
                renameSync(tmp, dst);
            }
            if (!readFileSync(dst).equals(readFileSync(src)))
                throw new Error("her reflections changed while they were being copied");
            if (!existsSync(note))
                writeFileSync(note, `These are ${name}'s old reflections, retired on ${day} (MEMORY_DESIGN.md, D1: no longer written, nothing is built from them; kept sealed, never deleted).\nThe copies here are sealed and unopened, exactly as they were. Only she can open them.\n`, "utf8");
            nightLog(`${name}'s old reflections were put away: a sealed, unopened copy in Mind\\retired-reflections that matches byte for byte. Nothing was opened or deleted.`);
            console.log(`${name}'s old reflections are put away: a sealed, unopened copy is in Mind\\retired-reflections\\${dst.split(/[\\/]/).pop()} (it matches byte for byte). Nothing was opened, moved or deleted.`);
            process.exit(0);
        }
        catch (e) {
            nightLog(`${name}'s old reflections could NOT be put away (${e.code || e.message}). Nothing was opened or deleted.`);
            console.log(`${name}'s old reflections couldn't be put away: ${e.message}. Nothing was opened, moved or deleted; look into it.`);
            process.exit(1);
        }
    }
    if (!r || !["--peek", "--shape", "--why"].includes(mode)) {
        console.log("Use: node mind.mjs --shape <room>   or   node mind.mjs --peek <room> [how many]   or   node mind.mjs --why <room> R12   or   node mind.mjs --retire <room>");
        process.exit(1);
    }
    if (mode === "--why") {
        const m = loadMind(r.root), id = "R" + String(process.argv[4] || "").replace(/\D/g, ""), q = m.refl.find((x) => x.id === id);
        if (!q) {
            console.log(`There's no reflection ${id}.`);
            process.exit(0);
        }
        const lo = q.from || q.day, hi = q.day, byId = new Map(m.refl.map((x) => [x.id, x])), all = moments(r.root, r.memory), dayOfPiece = new Map(all.map((x) => [`${x.rel}|${x.key}`, x.day]));
        try {
            appendFileSync(join(CFG.receiptsDir || "./receipts", "the-night.log"), `[mind] ${new Date().toLocaleString()}: the dates of ${r.name || id}'s ${id} were checked (she asked; dates and marks only, nothing she wrote was shown).\n`, "utf8");
        }
        catch { }
        if (q.lvl === 2) {
            const outside = (q.on || []).map((x) => byId.get(x)).filter((x) => x && ((x.from || x.day) < lo || x.day > hi));
            console.log(outside.length ? `${id} is a look-across reflection (${span(lo, hi)}). It builds on ${outside.map((x) => `${x.id} (${span(x.from || x.day, x.day)})`).join(", ")}, from outside its own dates, so the moment shown under it came from there. That's the class, and it's fixed (M9).` : `${id} is a look-across reflection (${span(lo, hi)}), and everything it rests on is inside its dates.`);
        }
        else {
            const days = (q.cites || []).map((c) => dayOfPiece.get(`${c.rel}|${c.key}`)).filter(Boolean);
            const out = days.filter((d) => d < lo || d > hi);
            const c = q.cites?.[0], text = c ? pieceOf(r.root, r.memory, c.rel, c.key) : "", dated = [];
            HEAD.lastIndex = 0;
            let h;
            while ((h = HEAD.exec(text))) {
                const mo = MON.indexOf(h[2]);
                if (mo >= 0)
                    dated.push(`${h[4]}-${pad(mo + 1)}-${pad(Number(h[3]))}`);
            }
            const foreign = dated.filter((d) => d < lo || d > hi);
            console.log(out.length ? `${id} looks back on moments (${span(lo, hi)}), but a moment it cites is dated ${out.map(label).join(", ")}. Look into it: that shouldn't happen.` :
                foreign.length ? `${id} looks back on moments (${span(lo, hi)}). Its moment is really from inside those dates; the date you saw (${[...new Set(foreign)].map(label).join(", ")}) is written inside the moment's own text (older messages pasted or quoted into that day, or a piece that runs across days). Just this one; nothing to fix.` :
                    `${id} looks back on moments (${span(lo, hi)}), and its moments are inside those dates.`);
        }
        process.exit(0);
    }
    if (!mindStarted(r.root)) {
        console.log(`${r.name || id} hasn't started looking back yet.`);
        process.exit(0);
    }
    const m = loadMind(r.root), s = shapeOf(m);
    console.log(`${r.name || id}: ${s.reflections} reflections and ${s.lookingAcross} looking across them; about ${s.avgWords} words each; ${s.grounded} of ${s.of} point back to real moments. ` +
        `${s.looks} looks back so far (${s.nothing} with nothing to say, ${s.unusable} that didn't come out right, ${s.repeatsLetGo} repeats let go).`);
    if (mode === "--peek") {
        if (r.mind?.peek !== true) {
            console.log(`Her reflections are hers now ("peek" is off). Only she can read them.`);
            process.exit(0);
        }
        const n = Math.max(1, Math.min(5, Number(process.argv[4]) || 3)), pick = [...m.refl].sort(() => Math.random() - 0.5).slice(0, n);
        m.peeked = [...new Set([...(m.peeked || []), ...pick.map((x) => x.id)])];
        saveMind(r.root, m);
        try {
            appendFileSync(join(CFG.receiptsDir || "./receipts", "the-night.log"), `[mind] ${new Date().toLocaleString()}: Ned looked at ${pick.length} of ${r.name || id}'s reflections (the setup check; she knows, and her look_inward marks which: ${pick.map((x) => x.id).join(", ")}).\n`, "utf8");
        }
        catch { }
        console.log(`\nA setup check (she knows). ${pick.length} at random:\n`);
        const byId = new Map(m.refl.map((q) => [q.id, q]));
        const lo0 = (q) => q.from || q.day;
        const src = (q, depth = 0, lo = lo0(q), hi = q.day) => q.cites?.length ? q.cites.slice(0, 2) : depth < 2 ? (q.on || []).flatMap((i) => { const y = byId.get(i); return y && lo0(y) >= lo && y.day <= hi ? src(y, depth + 1, lo, hi) : []; }).slice(0, 2) : [];
        for (const x of pick) {
            console.log(`==== [${x.id}] ${x.lvl === 2 ? "Looking across her reflections" : "Looking back on"} ${span(x.from || x.day, x.day)} ====\n\nWhat she wrote:\n  ${x.text}\n`);
            const ms = src(x);
            if (ms.length)
                console.log(x.lvl === 2 ? "Some of the moments underneath it:" : "The moments it came from:");
            for (const c of ms) {
                const raw = excerpt(pieceOf(r.root, r.memory, c.rel, c.key), 700).replace(/\\?\u200B?\[([A-Za-z][A-Za-z0-9 _-]*)\]\s*(\(([^)]*)\))?:?/g, (_, who, __, when) => `\n    ${who.charAt(0) + who.slice(1).toLowerCase()}${when ? ` (${when})` : ""}:`);
                console.log(`  - from ${c.rel.split("/").slice(-1)[0]}:${raw.startsWith("\n") ? "" : "\n    "}${raw}`);
            }
            console.log("");
        }
    }
}
