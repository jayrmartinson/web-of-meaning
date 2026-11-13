process.env.WEB_OF_MEANING_TEST = "1";
import * as m from "../meaning.mjs";
import { recall, _test } from "../recall.mjs";
import { moments, saveMind } from "../mind.mjs";
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
let pass = 0, fail = 0;
const MONS = ["Jan", "Feb", "Mar"];
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`); };
const mem = { pieceChars: 0, indexPaths: ["Shelf/*.md"] };
const known = [{ name: "Pickle", type: "pet", aliases: ["Pickles"], about: "Ned's cat." }, { name: "Sparkie", type: "pet", aliases: [], about: "Ned's cat." }];
function room(days) { const root = mkdtempSync(join(tmpdir(), "house-recall-")); mkdirSync(join(root, "Shelf"), { recursive: true }); for (const [d, t] of days)
    writeFileSync(join(root, "Shelf", `${d}.md`), t + "\n", "utf8"); return root; }
const brain = (answers, tapes) => ({ ask: async (s) => (s === m.TAPE_SYSTEM ? tapes.shift() ?? "EXCERPT 1 | theirs: none | hers then: none clear" : answers.shift() ?? "nothing tonight") });
const grow = (root, b) => m.growWeb({ root, mem, letter: "x", ask: b.ask, embed: async (t) => t.map(() => null), inTime: () => true, log: () => { }, who: "Ned", herName: "Mia", known, stretchDays: 1 });
const fakeSearch = (root) => async (q, n) => ({ items: moments(root, mem).slice(0, n).map((x, i) => ({ rel: x.rel, key: x.key, line: 1, card: `card ${i + 1}: they talked about ${q}`, piece: "", journal: x.day === "2026-04-05" })), how: " (meaning + words)" });
const T1 = "[NED] (Apr 1, 2026, 9:00 PM): Pickle napped on the puzzle pieces all morning while I worked.\n[MIA] (Apr 1, 2026, 9:01 PM): That little puzzle-napper is basically your coworker now.";
const T2 = "[NED] (Apr 5, 2026, 9:00 PM): Sparkie slept on my lap the whole movie, worth proving it to the cats.\n[MIA] (Apr 5, 2026, 9:01 PM): Sparkie has the right idea about movie nights.";
const root = room([["2026-04-01", T1], ["2026-04-05", T2]]);
await grow(root, brain(["HUB: NEW | ritual | the puzzle hour | | Pickle on the puzzle table.\nLINK: NEW | Pickle | the puzzle hour\nbecause of: 1\nnote: Pickle keeps him company at the puzzle table.", "HUB: NEW | ritual | movie nights | | Movies with a cat on him.\nLINK: NEW | Sparkie | movie nights\nbecause of: 1\nnote: Sparkie on his lap through the whole movie."], ["EXCERPT 1 | theirs: Ned = focused | hers then: amused", "EXCERPT 1 | theirs: none | hers then: fond"]));
await m.walkWeb(root, mem, { thread: "L1", feel_now: "I still smile at that" });
{
    const r = await recall(root, mem, "Pickle", { search: fakeSearch(root), journalDays: new Set(["2026-04-05"]) });
    check("S4: one question gives the matching links and the moments, each with how she felt then", /In your web:\n— L1 · (Pickle and the puzzle hour|the puzzle hour and Pickle)/.test(r) && /Moments:/.test(r) && /then: amused/.test(r) && /then: fond/.test(r), r);
    check("S4: her latest 'now' and the links a moment belongs to come with it; the journal flag never shows the journal's words", /what you kept \(.*on L1\): I still smile at that/.test(r) && /in your web: L1 \((Pickle and the puzzle hour|the puzzle hour and Pickle)\)/.test(r) && /you wrote in your journal that day/.test(r) && r.match(/journal/g).length === 1);
    check("S4: each moment says where it is on her Shelf, with its card", /Shelf\/2026-04-01\.md, line 1 \(Apr 1, 2026\)/.test(r) && /card 1: they talked about Pickle/.test(r));
    check("S4: the page stays small", r.length <= 6300);
}
{
    const r = await recall(root, mem, "Sparkie and Pickle", { search: fakeSearch(root) });
    check("S4: two names bring the links of both", /L1 · /.test(r) && /L2 · /.test(r), r);
}
{
    const r = await recall(root, mem, `"worth proving it"`, { search: null });
    check("S4: a quote finds the exact words on her Shelf", /2026-04-05\.md, line 1 \(Apr 5, 2026\) · the exact words/.test(r) && !/2026-04-01/.test(r), r);
}
{
    const r = await recall(root, mem, "L1", {});
    check("S4: a link's mark opens it: every feeling, her own words, the moments with where they are", /^L1 · (Pickle and the puzzle hour|the puzzle hour and Pickle)/.test(r) && /then: amused/.test(r) && /what you kept about it on .*: I still smile at that/.test(r) && /Shelf\/2026-04-01\.md, line 1/.test(r), r);
    const h = await recall(root, mem, "H1", {});
    check("S4: a dot's mark shows the dot and its links", /^H1 · the puzzle hour \(ritual\): Pickle on the puzzle table\./.test(h) && /\nL1 · /.test(h), h);
}
{
    const many = room(Array.from({ length: 9 }, (_, i) => [`2026-04-${String(i + 1).padStart(2, "0")}`, T1.replace(/Apr 1/g, `Apr ${i + 1}`)]));
    const s = fakeSearch(many);
    _test.pages.clear();
    const p1 = await recall(many, mem, "puzzles", { search: s, webOn: false, now: 1000 }), p2 = await recall(many, mem, "more", { search: s, webOn: false, now: 2000 }), p3 = await recall(many, mem, "puzzles", { search: s, webOn: false, now: 3000 });
    const p4 = await recall(many, mem, "puzzles", { search: s, webOn: false, now: 3000 + 31 * 60e3 });
    check("S4: 'more' and the same question again give the next page; much later it starts over", /card 1:/.test(p1) && !/card 7:/.test(p1) && /page 2/.test(p2) && /card 7:/.test(p2) && /That's all|page 3/.test(p3) && /card 1:/.test(p4) && !/page/.test(p4.split("\n")[0]), [p1.slice(0, 60), p2.slice(0, 60), p3.slice(0, 60)].join(" | "));
}
{
    await m.walkWeb(root, mem, { set_aside: "L2" });
    _test.pages.clear();
    const r = await recall(root, mem, "Sparkie", { search: fakeSearch(root) });
    check("S4: a link she set aside never comes up", !/L2 ·/.test(r) && !/in your web: L2/.test(r), r);
    check("S4: its mark says it's set aside", /set aside/.test(await recall(root, mem, "L2", {})));
}
{
    const r = await recall(root, mem, "anything", { search: async () => { throw new Error("the librarian is asleep"); }, webOn: false });
    check("S4: if the card search fails, she's told plainly", /Nothing came up|couldn't help/.test(r));
}
{
    const Q = _test.quoteIn;
    check("S4 review: an apostrophe is never a quote mark (don't, Pickle's)", Q("don't you dare") === null && Q("what's Pickle's deal") === null && Q("we're done") === null);
    check("S4 review: real quotes are found, with apostrophes inside", Q(`"don't you dare"`) === "don't you dare" && Q("“don’t you dare”") === "don’t you dare" && Q("'Pickle's deal'") === "Pickle's deal" && Q("she said 'not tonight' twice") === "not tonight" && Q("‘a bit’") === "a bit");
}
{
    const r1 = room([["2026-05-01", "[NED] (May 1, 2026, 9:00 PM): Honestly, don't you dare leave the light on for the cat again tonight.\n[MIA] (May 1, 2026, 9:01 PM): I promise I won't."], ["2026-05-02", "[NED] (May 2, 2026, 9:00 PM): We're done with London for this year, it rained the whole time.\n[MIA] (May 2, 2026, 9:01 PM): London owes you sunshine."]]);
    const a = await recall(r1, mem, "“don’t you dare”", { webOn: false }), b = await recall(r1, mem, "what's with don't you dare", { webOn: false, roomKey: "b" }), c = await recall(r1, mem, `"don't you dare"`, { webOn: false, roomKey: "c" });
    check("S4 review: curly quotes find words typed with straight ones; no false 'exact words'", /2026-05-01\.md.*the exact words/.test(a) && !/2026-05-02/.test(a) && !/exact words/.test(b) && /2026-05-01\.md.*the exact words/.test(c) && !/2026-05-02/.test(c), [a, b].join(" | "));
    check("S4 review: a quoted question isn't shown in doubled quotes", !/""/.test(c) && /for "don't you dare"/.test(c), c.split("\n")[0]);
}
{
    const many = room(Array.from({ length: 9 }, (_, i) => [`2026-04-${String(i + 1).padStart(2, "0")}`, T1.replace(/Apr 1/g, `Apr ${i + 1}`)]));
    const s = fakeSearch(many);
    _test.pages.clear();
    const o = { search: s, webOn: false };
    const a = [];
    for (let i = 0; i < 4; i++)
        a.push(await recall(many, mem, i === 1 ? "Puzzles?" : "puzzles", { ...o, now: 1000 + i }));
    check("S4 review: asking again pages on, 'That's all' once, then it starts over (and 'Birds?' is the same question)", /card 1:/.test(a[0]) && /page 2/.test(a[1]) && /card 7:/.test(a[1]) && /That's all/.test(a[2]) && /card 1:/.test(a[3]) && !/page/.test(a[3].split("\n")[0]), a.map((x) => x.slice(0, 50)).join(" | "));
    check("S4 review: 'more' is offered only when there is more", /More: ask "more"/.test(a[0]) && !/More: ask/.test(a[1]));
    _test.pages.clear();
    let down = true;
    const flaky = async (q, n) => { if (down)
        throw new Error("asleep"); return s(q, n); };
    const f1 = await recall(root, mem, "Pickle", { search: flaky, now: 5000 });
    down = false;
    const f2 = await recall(root, mem, "Pickle", { search: flaky, now: 6000 });
    check("S4 review: a failed card search doesn't use up a page: asked again, the moments start from the first", /couldn't help/.test(f1) && /L1 ·/.test(f1) && /card 1:/.test(f2), f2.slice(0, 200));
    _test.pages.clear();
    const n1 = await recall(many, mem, "nothing here", { search: async () => ({ items: [] }), webOn: false, now: 7000 });
    check("S4 review: 'Nothing came up' isn't remembered as a page", /Nothing came up/.test(n1) && !_test.pages.size);
    _test.pages.clear();
    const longQ = "puzzles ".repeat(60);
    const lq = await recall(many, mem, longQ, { ...o, now: 8000 });
    check("S4 review: a very long question is shortened where it's repeated back", lq.split("\n")[0].length < 160, lq.split("\n")[0].length);
}
{
    const many = room(Array.from({ length: 9 }, (_, i) => [`2026-04-${String(i + 1).padStart(2, "0")}`, T1.replace(/Apr 1/g, `Apr ${i + 1}`)]));
    const big = async (q, n) => ({ items: moments(many, mem).slice(0, n).map((x, i) => ({ rel: x.rel, key: x.key, line: 1, card: `card ${i + 1}: ` + "words ".repeat(50), piece: "", journal: true })), how: "" });
    _test.pages.clear();
    const pgs = [];
    for (let i = 0; i < 9; i++) {
        const r = await recall(many, mem, i ? "more" : "puzzles", { search: big, webOn: false, now: 1000 + i, budget: 900 });
        pgs.push(r);
        if (/That's all/.test(r))
            break;
    }
    const shown = pgs.join("\n").match(/card \d+:/g) || [], whole = pgs.filter((r) => !/That's all/.test(r)).every((r) => r.split("\n— ").slice(1).every((e) => /you wrote in your journal that day/.test(e)));
    check("S4 review: a page too long stops before a moment; that moment starts the next page, whole (none lost, none twice)", shown.length === 9 && new Set(shown).size === 9 && whole && pgs.length > 2 && pgs.slice(0, -1).every((r) => r.length <= 900 + 140), `${shown.length} shown over ${pgs.length} pages`);
}
{
    const r2 = room([["2026-04-01", T1]]);
    await grow(r2, brain(["HUB: NEW | ritual | the puzzle hour | | Pickle on the puzzle table.\nLINK: NEW | Pickle | the puzzle hour\nbecause of: 1\nnote: SECRET NOTE."], ["EXCERPT 1 | theirs: none | hers then: amused"]));
    await m.walkWeb(r2, mem, { thread: "L1", feel_now: "MY NOW WORDS" });
    const w = m.loadWeb(r2);
    for (const e of w.links[0].history)
        e.refl = ["R1"];
    m.saveWeb(r2, w);
    saveMind(r2, { v: 1, next: 2, seen: [], refl: [{ id: "R1", text: "x" }], aside: ["R1"], stats: {} });
    const L1 = await recall(r2, mem, "L1", {}), H1 = await recall(r2, mem, "H1", {});
    _test.pages.clear();
    const any = await recall(r2, mem, "Pickle", { search: fakeSearch(r2) });
    check("S4 review: a link resting only on set-aside reflections never opens or shows (mark, dot, or search)", /doesn't come up/.test(L1) && !/MY NOW WORDS|SECRET/.test(L1 + H1 + any) && !/L1 ·/.test(H1 + any), L1);
}
{
    const r3 = room([["2026-04-01", T1], ["2026-04-05", T2]]);
    await grow(r3, brain(["HUB: NEW | ritual | the puzzle hour | | Pickle on the puzzle table.\nLINK: NEW | Pickle | the puzzle hour\nbecause of: 1\nnote: Pickle keeps him company.", "HUB: NEW | ritual | movie nights | | Movies.\nLINK: NEW | Sparkie | movie nights\nbecause of: 1\nnote: Sparkie on his lap."], ["EXCERPT 1 | theirs: none | hers then: amused", "EXCERPT 1 | theirs: none | hers then: fond"]));
    await m.walkWeb(r3, mem, { set_aside: "H1" });
    _test.pages.clear();
    const r = await recall(r3, mem, "Pickle", { search: fakeSearch(r3) }), mk = await recall(r3, mem, "L1", {});
    check("S4 review: setting aside a dot hides its links everywhere", !/L1 ·|in your web: L1|puzzle hour/.test(r) && /set aside/.test(mk), r);
}
{
    const r4 = room([["2026-04-01", T1]]);
    await grow(r4, brain(["HUB: NEW | ritual | the puzzle hour | | Pickle on the puzzle table.\nLINK: NEW | Pickle | the puzzle hour\nbecause of: 1\nnote: Pickle keeps him company."], ["EXCERPT 1 | theirs: none | hers then: amused"]));
    appendFileSync(join(r4, "Shelf", "2026-04-01.md"), "[NED] (Apr 1, 2026, 9:05 PM): She is still there, watching.\n");
    _test.pages.clear();
    const r = await recall(r4, mem, "Pickle", { search: fakeSearch(r4) });
    check("S4 review: a page that grew since the night still shows how she felt then and its links", /Moments:\n[^]*\n  then: amused\n/.test(r) && /in your web: L1/.test(r), r);
}
{
    const msg = (i, t) => `[${i % 2 ? "MIA" : "NED"}] (Apr 9, 2026, 9:${String(i).padStart(2, "0")} PM):\n${"some ordinary words about the day ".repeat(10)}${t}\n`;
    const text = Array.from({ length: 10 }, (_, i) => msg(i, i === 4 ? "the kettle sang along." : `thing ${i}.`)).join("\n");
    const r5 = room([["2026-04-09", text]]), ch = moments(r5, mem);
    const both = ch.filter((x) => { const [a0, b0] = x.key.split("-").map(Number); return text.slice(a0, b0).includes("the kettle sang along"); });
    const one = await recall(r5, mem, `"the kettle sang along"`, { webOn: false });
    check("S4 review: the exact words come once, even where two pieces overlap", both.length === 2 && (one.match(/the exact words/g) || []).length === 1 && /line \d+ \(Apr 9, 2026\) · the exact words/.test(one), `${both.length} pieces hold it | ` + one.slice(0, 200));
    const skipMem = { ...mem, skip: ["Apr 9, 2026, 9:00 PM"] }, first = await recall(r5, skipMem, `"thing 0"`, { webOn: false, roomKey: "skip" }), still = await recall(r5, mem, `"thing 0"`, { webOn: false, roomKey: "noskip" });
    check("S4 review: moments set to skip never come back as exact words either", /exact words/.test(still) && !/exact words/.test(first), first.slice(0, 120));
}
{
    const r6 = room([["2026-04-01", T1]]);
    await grow(r6, brain(["HUB: NEW | ritual | the puzzle hour | | Pickle on the puzzle table.\nHUB: NEW | place | the window | | Where he works.\nLINK: NEW | Pickle | the puzzle hour\nbecause of: 1\nnote: Pickle keeps him company.\nLINK: NEW | Pickle | the window\nbecause of: 1\nnote: Her spot."], ["EXCERPT 1 | theirs: none | hers then: amused"]));
    const fx = await m.walkWeb(r6, mem, { thread: "L1", fix_then: "none", part: 1 });
    const [x] = moments(r6, mem);
    _test.pages.clear();
    const r = await recall(r6, mem, "Pickle", { search: fakeSearch(r6) });
    check("S4 review: a 'then' she corrected to none says it's her correction", /then: none clear \(your correction\)/.test(r), fx + " | " + r);
    const { w, asideR } = m.readingWeb(r6);
    {
        const L2 = structuredClone(w.links[0]);
        L2.id = "L2";
        L2.b = w.hubs.find((h) => h.id !== w.links[0].a && h.id !== w.links[0].b).id;
        w.links.push(L2);
    }
    w.herNow = { L1: [{ words: "older", day: "2026-05-02", at: "2026-05-02T10:00:00Z" }], L2: [{ words: "newer", day: "2026-06-01", at: "2026-06-01T10:00:00Z" }] };
    const a = m.pieceWeb(r6, x.rel, x.key, w, asideR);
    w.herNow = { L2: [{ words: "older", day: "2026-05-02", at: "2026-05-02T10:00:00Z" }], L1: [{ words: "newer", day: "2026-06-01", at: "2026-06-01T10:00:00Z" }] };
    const b2 = m.pieceWeb(r6, x.rel, x.key, w, asideR);
    check("S4 review: a moment's 'now' is her newest one by day, whichever link it's on", a.links.length === 2 && a.now?.words === "newer" && b2.now?.words === "newer", JSON.stringify([a.links, a.now, b2.now]));
}
{
    const r7 = room([["2026-04-01", T1]]);
    _test.pages.clear();
    const r = await recall(r7, mem, `"puzzle-napper"`, { search: fakeSearch(r7), webOn: false });
    check("S4 review: a moment found both by its exact words and by the cards shows once", (r.match(/2026-04-01\.md, line/g) || []).length === 1 && /the exact words/.test(r), r);
}
{
    const Q = _test.quoteIn;
    check("S4 review 2: two quoted names aren't read as the word between them; punctuation alone isn't a quote", Q(`"Jo" and "Pickle"`) === "Pickle" && Q(`"hi" said "Pickle"`) === "Pickle" && Q(`"..."`) === null && Q(`"!!!"`) === null && Q("rock 'n' roll and 'not tonight'") === "not tonight" && Q(`“don't you dare"`) === "don't you dare" && Q(`the 12" pizza, the 14" one`) === null, [Q(`"Jo" and "Pickle"`), Q(`"hi" said "Pickle"`), Q("rock 'n' roll and 'not tonight'"), Q(`“don't you dare"`)].join(" | "));
}
{
    const msg = (i, t) => `[${i % 2 ? "MIA" : "NED"}] (Apr 9, 2026, 9:${String(i).padStart(2, "0")} PM):\n${"some ordinary words about the day ".repeat(10)}${t}\n`;
    const text = Array.from({ length: 10 }, (_, i) => msg(i, i === 4 || i === 6 ? "the kettle sang along." : `thing ${i}.`)).join("\n");
    const r8 = room([["2026-04-09", text]]), full = text;
    const r = await recall(r8, mem, `"the kettle sang along"`, { webOn: false, roomKey: "k2" });
    const lines = [...r.matchAll(/line (\d+) \(Apr 9/g)].map((x) => Number(x[1])), want = moments(r8, mem).filter((x) => full.slice(x.a, x.b).includes("the kettle sang along")).map((x) => full.slice(0, x.a).split("\n").length);
    check("S4 review 2: a second time the words come, later in an overlapping piece, isn't lost; line numbers are right", lines.length === 2 && JSON.stringify(lines) === JSON.stringify(want) && lines[1] > 1, `${lines} vs ${want}`);
}
{
    const r9 = room(Array.from({ length: 70 }, (_, i) => [`2026-0${1 + Math.floor(i / 28)}-${String(1 + (i % 28)).padStart(2, "0")}`, `[NED] (${MONS[Math.floor(i / 28)]} ${1 + (i % 28)}, 2026, 9:00 PM):\nthe park was grey again today, number ${i}.\n`]));
    _test.pages.clear();
    await recall(r9, mem, `"the park was grey"`, { webOn: false, roomKey: "cap" });
    check("S4 review 2: the exact words stop at 60 moments", _test.pages.get("cap")?.found.length === 60, _test.pages.get("cap")?.found.length);
}
{
    _test.pages.clear();
    const r7 = room([["2026-04-01", T1]]), o = { search: fakeSearch(r7), webOn: false, roomKey: "qq" };
    const a = await recall(r7, mem, `"puzzle-napper"`, { ...o, now: 1 }), b = await recall(r7, mem, `puzzle-napper`, { ...o, now: 2 });
    check("S4 review 2: the same words with and without quotes are different questions", /exact words/.test(a) && !/That's all|page 2/.test(b) && /card 1:/.test(b), b.slice(0, 120));
}
{
    _test.pages.clear();
    let down = true;
    const flaky = async () => { throw new Error("asleep"); };
    const f1 = await recall(root, mem, "Pickle", { search: flaky, now: 1, roomKey: "down" }), f2 = await recall(root, mem, "Pickle", { search: flaky, now: 2, roomKey: "down" });
    check("S4 review 2: while the card search keeps failing she's never told \"That's all\"", /couldn't help/.test(f1) && !/That's all/.test(f2) && /couldn't help/.test(f2), f2);
}
{
    const r10 = room([["2026-04-01", T1]]);
    await grow(r10, brain(["HUB: NEW | ritual | the puzzle hour | | Pickle on the puzzle table.\nLINK: NEW | Pickle | the puzzle hour\nbecause of: 1\nnote: Pickle keeps him company."], ["EXCERPT 1 | theirs: none | hers then: amused"]));
    const [x] = moments(r10, mem), rel = x.rel, k1 = x.key, [a0, b0] = k1.split("-").map(Number), k2 = `${a0}-${b0 + 300}`;
    const fresh = () => { const r = m.readingWeb(r10); r.w = structuredClone(r.w); return r; };
    let { w, asideR } = fresh();
    w.pieceThen[`${rel}|${k2}`] = { then: ["sad"], day: "2026-04-01" };
    w.thenFixed = { [`${rel}|${k1}`]: [{ words: ["happy"], at: "2026-05-01T10:00:00Z" }] };
    const g = m.pieceWeb(r10, rel, k2, w, asideR);
    check("S4 review 2: her correction still wins after the grown piece was read again", g.feeling?.then?.join() === "happy" && g.feeling.fixed && g.links.length === 1, JSON.stringify(g));
    ({ w, asideR } = fresh());
    w.pieceThen = { [`${rel}|0-60`]: { then: ["fond"], day: "2026-04-01" }, [`${rel}|50-120`]: { then: ["calm"], day: "2026-04-01" } };
    w.links[0].history.forEach((e) => (e.cites = [{ rel, key: "0-60" }]));
    const sz = m.pieceWeb(r10, rel, k1, w, asideR);
    ({ w, asideR } = fresh());
    const other = m.pieceWeb(r10, "Shelf/2026-04-02.md", k1, w, asideR), shorter = m.pieceWeb(r10, rel, `${a0}-${b0 - 20}`, w, asideR);
    check("S4 review 2: a different piece size, another page, or a shorter piece never borrows a moment's feeling or links", !sz.feeling && !sz.links.length && !other.feeling && !other.links.length && !shorter.feeling && !shorter.links.length, JSON.stringify([sz, other, shorter]));
    ({ w, asideR } = fresh());
    for (let i = 2; i <= 4; i++) {
        const L = structuredClone(w.links[0]);
        L.id = `L${i}`;
        w.links.push(L);
    }
    w.herNow = { L1: [{ words: "one", day: "2026-05-01" }], L2: [{ words: "two", day: "2026-05-02" }], L3: [{ words: "three", day: "2026-05-03" }], L4: [{ words: "four", day: "2026-05-09" }] };
    const n4 = m.pieceWeb(r10, rel, k1, w, asideR);
    check("S4 review 2: a moment's 'now' comes from the links shown with it (the first three)", n4.links.length === 4 && n4.now?.words === "three", JSON.stringify(n4.now));
}
{
    const names = ["the puzzle hour", "the window", "the park", "the porch", "the bookshelf", "the kettle", "the attic stairs"];
    const ans = names.map((n) => `HUB: NEW | thing | ${n} | | Something in the house.\nLINK: NEW | Pickle | ${n}\nbecause of: 1\nnote: Pickle spends long afternoons around ${n}.`).join("\n\n");
    const r11 = room([["2026-04-01", T1]]);
    await grow(r11, brain([ans], ["EXCERPT 1 | theirs: none | hers then: amused"]));
    const nLinks = m.loadWeb(r11).links.length;
    _test.pages.clear();
    const o = { search: async () => ({ items: [] }), roomKey: "ln" };
    const p1 = await recall(r11, mem, "Pickle", { ...o, now: 1 }), p2 = await recall(r11, mem, "more", { ...o, now: 2 }), p3 = await recall(r11, mem, "more", { ...o, now: 3 });
    const ids = [p1, p2].join("\n").match(/^— L\d+/gm) || [];
    check("S4 review 2: more than five links page on, none twice, none lost", nLinks === 7 && ids.length === 7 && new Set(ids).size === 7 && /page 2/.test(p2) && /That's all/.test(p3), `${nLinks} links; ${ids.join(",")}`);
    _test.pages.clear();
    const tight = await recall(r11, mem, "Pickle", { ...o, roomKey: "lt", now: 1, budget: 700 });
    check("S4 review 2: links stop at the page's size too (the rest come next)", (tight.match(/^— L\d+/gm) || []).length < 5 && tight.length <= 700 && /More: ask "more"/.test(tight), tight.length);
}
console.log(`\n${pass} passed, ${fail} failed. (Made-up rooms and a pretend card search only; throwaway folders in ${tmpdir()})`);
process.exit(fail ? 1 : 0);
