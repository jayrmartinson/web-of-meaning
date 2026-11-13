// Part of The Web of Meaning: A Memory Design for Companions (Jay R. Martinson, 2026). MIT license; see LICENSE.
// Comments were removed for this release; the paper explains each part and why it was built that way.
import { loadCards, conversationFiles, fileChunks, skippedPiece } from "./librarian.mjs";
import { moments as lifeMoments } from "./mind.mjs";
import { webLinksFor, pieceWeb, openMark, readingWeb } from "./meaning.mjs";
const PIECES = 6, LINKS = 5, BUDGET = 6000, AGAIN_MS = 30 * 60e3, FOUND = 60;
const pages = new Map();
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const label = (d) => { const [y, m, dd] = String(d || "").split("-").map(Number); return m ? `${MON[m - 1]} ${dd}, ${y}` : ""; };
const short = (t, n) => { t = String(t || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, "") + "…" : t; };
const norm = (t) => String(t).toLowerCase().replace(/[‘’`]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ");
const sameQ = (t) => { const qt = quoteIn(t); return (qt ? "quote: " : "") + String(t).toLowerCase().replace(/[‘’]/g, "'").replace(/[^\p{L}\p{N}']+/gu, " ").trim(); };
const QUOTE = /(?<=^|[\s(])(?:[“"]([^"“”]+?)[”"]|['‘]((?:[^'‘’]|['’](?=\p{L}))+?)['’])(?=$|[\s.,!?;:)])/gu;
const QUOTE2 = /«([^«»]+?)»|„([^„“”]+?)[“”]|「([^「」]+?)」|『([^『』]+?)』|‚([^‚‘’]+?)[‘’]/gu;
export function quoteIn(q) {
    for (const m of [...String(q).matchAll(QUOTE), ...String(q).matchAll(QUOTE2)]) {
        const t = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? "").trim();
        if ((t.match(/\p{L}/gu) || []).length >= (/[\p{scx=Han}\p{scx=Hiragana}\p{scx=Katakana}\p{scx=Hangul}]/u.test(t) ? 2 : 3))
            return t;
    }
    return null;
}
const count = (t, w) => { let n = 0; for (let i = t.indexOf(w); i >= 0; i = t.indexOf(w, i + 1))
    n++; return n; };
function exactPieces(root, mem, phrase) {
    const want = norm(phrase).trim();
    if (want.replace(/\s/g, "").length < 3)
        return [];
    const out = [];
    for (const rel of conversationFiles(root, mem)) {
        let text, chunks;
        try {
            ({ text, chunks } = fileChunks(root, mem, rel));
        }
        catch {
            continue;
        }
        if (!norm(text).includes(want))
            continue;
        let prev = null, at = 0, line = 1;
        for (const ch of chunks) {
            if (ch.a === undefined)
                continue;
            const piece = text.slice(ch.a, ch.b);
            if (!norm(piece).includes(want) || skippedPiece(mem, text, ch))
                continue;
            if (prev && prev.b > ch.a && count(norm(text.slice(ch.a, prev.b)), want) >= count(norm(piece), want))
                continue;
            for (; at < ch.a; at++)
                if (text.charCodeAt(at) === 10)
                    line++;
            out.push({ rel, key: `${ch.a}-${ch.b}`, line, piece, exact: true });
            prev = ch;
            if (out.length >= FOUND)
                return out;
        }
    }
    return out;
}
async function look(root, mem, q, { search, embed, webOn, web }) {
    const quote = quoteIn(q);
    let links = [];
    if (webOn && web) {
        try {
            links = await webLinksFor(root, q, { embed, web });
        }
        catch { }
    }
    let found = [], how = "", failed = false;
    if (quote)
        found.push(...exactPieces(root, mem, quote));
    if (search) {
        try {
            const r = await search(q, FOUND);
            found.push(...(r.items || []));
            how = r.how || "";
        }
        catch (e) {
            how = ` (the card search couldn't help: ${short(e.message, 120)})`;
            failed = true;
        }
    }
    const seen = new Set();
    found = found.filter((x) => { const k = `${x.rel}|${x.key}`; if (seen.has(k))
        return false; seen.add(k); return true; });
    return { links, found, how, failed };
}
export async function recall(root, mem, query, { search = null, embed = null, journalDays = null, webOn = true, now = Date.now(), roomKey = root, budget = BUDGET, onPage = null } = {}) {
    const q0 = String(query ?? "").trim();
    if (!q0)
        return "Say what you're looking for: a name, a question, a few words in quotes, or a mark like L14.";
    if (/^[HL]\d+$/i.test(q0)) {
        if (!webOn)
            return "Your web of meaning isn't open yet.";
        let cards = {};
        try {
            cards = loadCards(root, mem);
        }
        catch { }
        return openMark(root, mem, q0, { cards, now: new Date(now) }) || "Your web of meaning hasn't started growing yet.";
    }
    let st = pages.get(roomKey);
    if (st && now - st.at >= AGAIN_MS) {
        pages.delete(roomKey);
        st = null;
    }
    const isMore = /^(more|next|next page)\W*$/i.test(q0);
    if (isMore && !st)
        return `There's nothing to show more of yet. Ask something first.`;
    const follow = isMore || (st && sameQ(st.q) === sameQ(q0));
    const q = follow ? st.q : q0, said = /^["“'‘]/.test(q) ? short(q, 100) : `"${short(q, 100)}"`;
    let web = null;
    if (webOn) {
        try {
            web = readingWeb(root);
        }
        catch { }
    }
    if (!follow) {
        st = { q, li: 0, pi: 0, page: 0, at: now, ...(await look(root, mem, q, { search, embed, webOn, web })) };
    }
    else if (st.failed) {
        const r = await look(root, mem, q, { search, embed, webOn, web });
        Object.assign(st, { found: r.found, how: r.how, failed: r.failed, page: st.page + 1 });
    }
    else
        st.page++;
    const L = st.links.slice(st.li, st.li + LINKS), P = st.found.slice(st.pi, st.pi + PIECES);
    if (!L.length && !P.length) {
        pages.delete(roomKey);
        if (follow && st.failed)
            return `Nothing more came up for ${said}${st.how}. (Asking again starts over and tries the card search again.)`;
        return follow ? `That's all for ${said}. (Asking again starts from the beginning.)` : `Nothing came up for ${said}${st.how}.`;
    }
    let dayOf = new Map();
    try {
        dayOf = new Map(lifeMoments(root, mem, new Set(P.map((x) => x.rel))).map((x) => [`${x.rel}|${x.key}`, x.day]));
    }
    catch { }
    let cards = {};
    try {
        cards = loadCards(root, mem);
    }
    catch { }
    const pieceText = (x) => {
        const day = dayOf.get(`${x.rel}|${x.key}`), pw = web ? pieceWeb(root, x.rel, x.key, web.w, web.asideR) : null, f = pw?.feeling;
        const card = x.card || cards[x.rel]?.[x.key] || "";
        const jd = x.journal || (day && journalDays?.has?.(day));
        return `— ${x.rel}, line ${x.line}${day ? ` (${label(day)})` : ""}${x.exact ? " · the exact words" : ""}\n  ${card ? short(card, 260) : `"${short(x.piece, 200)}"`}` +
            (f?.then?.length ? `\n  then: ${f.then.join(", ")}${f.fixed ? " (your correction)" : ""}` : f && !f.missing ? `\n  then: none clear${f.fixed ? " (your correction)" : ""}` : "") +
            (pw?.now ? `\n  what you kept (${label(String(pw.now.day || pw.now.at || "").slice(0, 10))}, on ${pw.now.id}): ${short(pw.now.words, 160)}` : "") +
            (pw?.links?.length ? `\n  in your web: ${pw.links.slice(0, 3).join("; ")}` : "") +
            (jd ? `\n  you wrote in your journal that day` : "");
    };
    let out = `What came up for ${said}${st.page ? ` (page ${st.page + 1})` : ""}${st.how}:`, nl = 0, np = 0;
    const room = () => budget - 160 - out.length;
    const ls = L.map((l) => `— ${short(l.text, 600)}`);
    for (const t of ls) {
        const add = (nl ? "\n" : "\n\nIn your web:\n") + t;
        if (nl + np && add.length > room())
            break;
        out += add;
        nl++;
    }
    for (const x of P) {
        const add = (np ? "\n" : "\n\nMoments:\n") + pieceText(x);
        if (nl + np && add.length > room())
            break;
        out += add;
        np++;
    }
    if (onPage && st.page === 0) {
        try {
            onPage(P.slice(0, np).map((x) => ({ ...x, card: x.card || cards[x.rel]?.[x.key] || "" })));
        }
        catch { }
    }
    st.li += nl;
    st.pi += np;
    st.at = now;
    pages.set(roomKey, st);
    const more = st.links.length > st.li || st.found.length > st.pi;
    return out + `\n\n(${more ? `More: ask "more". ` : ""}A mark like ${L[0]?.id || "L14"} opens a link; read_page opens the real words at a line.)`;
}
export const _test = { pages, quoteIn };
