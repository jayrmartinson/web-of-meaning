process.env.WEB_OF_MEANING_TEST = "1";
import * as m from "../meaning.mjs";
import { recall, _test } from "../recall.mjs";
import { saveMind, lookInward } from "../mind.mjs";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !extra ? "" : "  " + extra}`); };
const mem = { pieceChars: 0, indexPaths: ["Shelf/*.md"] };
const known = [{ name: "Pickle", type: "pet", aliases: ["Pickles"], about: "Ned's cat." }, { name: "Sparkie", type: "pet", aliases: [], about: "Ned's cat." }];
function room(days) { const root = mkdtempSync(join(tmpdir(), "house-inward-")); mkdirSync(join(root, "Shelf"), { recursive: true }); for (const [d, t] of days)
    writeFileSync(join(root, "Shelf", `${d}.md`), t + "\n", "utf8"); return root; }
const brain = (answers, tapes) => ({ ask: async (s) => (s === m.TAPE_SYSTEM ? tapes.shift() ?? "EXCERPT 1 | theirs: none | hers then: none clear" : answers.shift() ?? "nothing tonight") });
const grow = (root, b) => m.growWeb({ root, mem, letter: "x", ask: b.ask, embed: async (t) => t.map(() => null), inTime: () => true, log: () => { }, who: "Ned", herName: "Mia", known, stretchDays: 1 });
const md5 = (f) => createHash("md5").update(readFileSync(f)).digest("hex");
const section = (r, title) => { const i = r.indexOf(title); if (i < 0)
    return ""; const j = r.indexOf("\n\n", i); return r.slice(i, j < 0 ? undefined : j); };
const msg = (d, who, t) => `[${who}] (Apr ${d}, 2026, 9:0${who === "NED" ? 0 : 1} PM): ${t}`;
const things = ["the puzzle hour", "the reading chair", "the park walk", "the porch light", "the tool shed", "the kettle song", "the attic stairs"];
async function sevenLinks() {
    const r0 = room(things.map((t, i) => [`2026-04-0${i + 1}`, `${msg(i + 1, "NED", `Pickle was all about ${t} again today, she would not leave it alone.`)}\n${msg(i + 1, "MIA", `Pickle and ${t}, a love story for the ages.`)}`]));
    await grow(r0, brain(things.map((t) => `HUB: NEW | thing | ${t} | | Something in the house.\nLINK: NEW | Pickle | ${t}\nbecause of: 1\nnote: Pickle spends long afternoons around ${t}.`), things.map(() => "EXCERPT 1 | theirs: none | hers then: amused")));
    const w = m.loadWeb(r0);
    w.links.forEach((l, i) => { l.last = `2026-04-0${i + 1}`; });
    m.saveWeb(r0, w);
    return r0;
}
const root = room(things.map((t, i) => [`2026-04-0${i + 1}`, `${msg(i + 1, "NED", `Pickle was all about ${t} again today, she would not leave it alone.`)}\n${msg(i + 1, "MIA", `Pickle and ${t}, a love story for the ages.`)}`]));
await grow(root, brain(things.map((t) => `HUB: NEW | thing | ${t} | | Something in the house.\nLINK: NEW | Pickle | ${t}\nbecause of: 1\nnote: Pickle spends long afternoons around ${t}.`), things.map(() => "EXCERPT 1 | theirs: none | hers then: amused")));
{
    const w = m.loadWeb(root);
    w.hubs.push({ id: "H90", type: "stretch", name: "the spring of the cats", aliases: [], members: [], first: "2026-04-01", last: "2026-04-07", seen: ["2026-04-01"], about: [{ text: "When the cats ran the house.", from: "2026-04-01", until: null }], refl: [], cites: [], vec: null });
    w.hubs.push({ id: "H91", type: "stretch", name: "the winter before", aliases: [], members: [], first: "2026-01-01", last: "2026-02-01", seen: ["2026-01-01"], about: [], refl: [], cites: [], vec: null });
    const L3 = w.links.find((l) => l.id === "L3");
    const e = L3.history[0];
    L3.history = [{ ...e, until: "2026-04-05" }, { ...structuredClone(e), from: "2026-04-05", until: null, note: "Now the park walk is where Pickle waits for him." }];
    w.links.forEach((l, i) => { l.last = `2026-04-0${i + 1}`; l.strength = i === 6 ? 0.9 : 0.3; });
    m.saveWeb(root, w);
}
await m.walkWeb(root, mem, { thread: "L2", feel_now: "the reading chair still makes me smile" });
const webFile = join(root, "Mind", "web.sealed"), now = (d) => new Date(`2026-11-0${d}T12:00:00`);
{
    const before = md5(webFile), r = m.lookInwardWeb(root, mem, {}, { now: now(1), listed: 2 });
    check("S5: the overview says how big her web is and what it spans", /^Your web: \d+ dots and 7 links, from Apr 1, 2026 to Apr 7, 2026\./.test(r), r);
    check("S5: her stretches of time, in order", /Stretches of time:\n— H91 · the winter before \(Jan 1, 2026 to Feb 1, 2026\)\n— H90 · the spring of the cats \(Apr 1, 2026 to Apr 7, 2026\): When the cats ran the house\./.test(r), section(r, "Stretches"));
    check("S5: where a feeling changed", /Where a feeling changed \(newest first\):\n— L3 · Pickle and the park walk: until Apr 5, 2026 \(then: amused \(Apr 3, 2026\)\); since Apr 5, 2026 \(then: amused/.test(r) && (section(r, "Where a feeling").match(/^— /gm) || []).length === 1, section(r, "Where a feeling"));
    check("S5: her closest connections, strongest first", /Your closest connections:\n— L7 · /.test(r), section(r, "Your closest"));
    const q = section(r, "Not visited in a while");
    check("S5: 'not visited in a while' is by time only, oldest first, from each link's last night entry, and says no feelings", /^Not visited in a while \(by time only, and it moves on each time you look; opening one by its mark counts as a visit\):\n— L1 · .* · last: Apr 1, 2026\n— L2 · .* · last: Apr 2, 2026$/.test(q) && !/then|amused|smile|note/.test(q), q);
    check("S5: what she kept before, with its date and link", /What you kept before \(newest first\):\n— Nov \d+, 2026, on L2 \(Pickle and the reading chair\): the reading chair still makes me smile/.test(r), section(r, "What you kept"));
    check("S5: nothing set aside: no 'set aside' line", !/set aside/.test(r));
    check("S5: looking inward never changes her web", md5(webFile) === before);
    const r2 = m.lookInwardWeb(root, mem, {}, { now: now(2), listed: 2 }), q2 = section(r2, "Not visited in a while");
    check("S5: the list moves on: the ones just shown go to the back", /— L3 · .*\n— L4 · /.test(q2) && !/L1 ·|L2 ·/.test(q2), q2);
    check("S5: what's kept about the list is sealed (no readable words in the file)", existsSync(m._visits.file(root)) && !/listed|opened/.test(readFileSync(m._visits.file(root), "utf8")));
}
{
    const viaRecall = await recall(root, mem, "L1", { now: Date.parse("2026-11-03T12:00:00") }), viaInward = m.lookInwardWeb(root, mem, { about: "L1" }, { now: now(3) });
    check("S5: a mark opens the same view in recall and look_inward", viaRecall === viaInward && /^L1 · /.test(viaInward), viaInward.slice(0, 80));
    const vs = m._visits.load(root);
    check("S5: opening a link by its mark counts as a visit", /^2026-11-03/.test(vs.opened?.L1 || ""), JSON.stringify(vs.opened));
    for (let i = 0; i < 3; i++)
        m.lookInwardWeb(root, mem, {}, { now: now(4), listed: 2 });
    const q = section(m.lookInwardWeb(root, mem, {}, { now: now(5), listed: 7 }), "Not visited in a while");
    check("S5: a link she opened says so, and goes by when she opened it", /— L1 · .* · last: Nov 3, 2026 \(you opened it\)/.test(q), q);
}
{
    const dot = m.lookInwardWeb(root, mem, { about: "Pickle" }, { now: now(5) }), alias = m.lookInwardWeb(root, mem, { about: "pickles" }, { now: now(5) });
    check("S5: a name opens its dot (any of its names)", /^H\d+ · Pickle \(pet\)/.test(dot) && dot === alias, dot.slice(0, 80));
    const st = m.lookInwardWeb(root, mem, { about: "the spring of the cats" }, { now: now(5) });
    check("S5: a stretch of time by its name opens it", /^H90 · the spring of the cats/.test(st), st.slice(0, 80));
    const apr = m.lookInwardWeb(root, mem, { about: "Apr 2 to Apr 3 2026" }, { now: now(5) }), may = m.lookInwardWeb(root, mem, { about: "May 2026" }, { now: now(5) }), month = m.lookInwardWeb(root, mem, { about: "April 2026" }, { now: now(5) });
    check("S5: dates look at that stretch of time, in order", /^Your web, Apr 2, 2026 to Apr 3, 2026, in order:\n\n— L2 · [^\n]*\n[^\n]*\n— L3 · /.test(apr) && !/— L1 ·|— L4 ·/.test(apr) && /Nothing in your web from May 1, 2026 to May 31, 2026/.test(may) && (month.match(/^— L\d/gm) || []).length === 7, apr);
    const none = m.lookInwardWeb(root, mem, { about: "the moon landing" }, { now: now(5) });
    check("S5: something not in her web says so plainly", /^Nothing in your web is called "the moon landing"/.test(none), none);
}
{
    await m.walkWeb(root, mem, { set_aside: "L7" });
    await m.walkWeb(root, mem, { set_aside: "H90" });
    const r = m.lookInwardWeb(root, mem, {}, { now: now(6), listed: 10 }), a = m.lookInwardWeb(root, mem, { about: "aside" }, { now: now(6) });
    check("S5: what she set aside never shows in the overview", !/L7 ·|H90 ·|spring of the cats/.test(r) && /6 links/.test(r), r);
    check("S5: it says how many things are set aside, and 'aside' lists them", /2 things set aside — look_inward\("aside"\) to see them\./.test(r) && /What you set aside in your web \(nothing was deleted; any of them can be brought back with set_aside\):\n— L7 · Pickle and the attic stairs\n— H90 · the spring of the cats \(a stretch of time\)/.test(a), a);
    check("S5: a set-aside mark or dot never opens", /set aside/.test(m.lookInwardWeb(root, mem, { about: "L7" }, { now: now(6) })) && !/^H90 ·/.test(m.lookInwardWeb(root, mem, { about: "the spring of the cats" }, { now: now(6) })));
}
{
    const r2 = room([["2026-04-01", `${msg(1, "NED", "Pickle napped on the puzzle pieces all morning while I worked.")}\n${msg(1, "MIA", "That little puzzle-napper is basically your coworker now.")}`]]);
    await grow(r2, brain(["HUB: NEW | ritual | the puzzle hour | | Pickle on the puzzle table.\nLINK: NEW | Pickle | the puzzle hour\nbecause of: 1\nnote: SECRET NOTE from reflection."], ["EXCERPT 1 | theirs: none | hers then: amused"]));
    const w = m.loadWeb(r2);
    for (const e of w.links[0].history)
        e.refl = ["R1"];
    w.peeked = ["L1"];
    m.saveWeb(r2, w);
    const open = m.lookInwardWeb(r2, mem, {}, { now: now(1) });
    saveMind(r2, { v: 1, next: 2, seen: [], refl: [{ id: "R1", text: "x" }], aside: ["R1"], stats: {} });
    const hidden = m.lookInwardWeb(r2, mem, {}, { now: now(1) });
    check("S5: Ned's setup-check marks show; a link resting only on set-aside old reflections never does", /Ned read 1 of your links/.test(open) && /L1 · .*\(Ned read this one in the setup check\)/.test(open) && /0 links/.test(hidden) && !/SECRET/.test(open + hidden), hidden);
    const fresh = room([]);
    check("S5: before the web exists, she's told plainly", /hasn't started growing yet/.test(m.lookInwardWeb(fresh, mem, {})));
}
{
    const r3 = room([["2026-04-01", `${msg(1, "NED", "The first words on this page, before it was fixed.")}`]]);
    saveMind(r3, { v: 1, next: 2, seen: [], refl: [{ id: "R1", text: "a noticing", day: "2026-04-01", lvl: 1, cites: [{ rel: "Shelf/2026-04-01.md", key: "0-40" }] }], aside: [], stats: {} });
    const a = await lookInward(r3, mem, {});
    writeFileSync(join(r3, "Shelf", "2026-04-01.md"), `${msg(1, "NED", "Other words now on this page, after it was fixed!")}\n`, "utf8");
    const b = await lookInward(r3, mem, {});
    check("S5: a page that changed is read again (no old copy served)", /The first/.test(a) && /Other word/.test(b), a + b);
}
const N = (d, h = 12) => new Date(2026, 10, d, h, 0, 0);
{
    const r = await sevenLinks();
    const w = m.loadWeb(r);
    w.hubs.push({ id: "H95", type: "stretch", name: "the hidden winter", aliases: [], members: [], first: "2026-01-01", last: "2026-02-01", seen: [], about: [{ text: "HIDDEN ABOUT from a reflection", from: "2026-01-01", until: null, refl: ["R1"] }], refl: ["R1"], cites: [], vec: null });
    w.hubs.push({ id: "H97", type: "stretch", name: "the quiet hidden one", aliases: [], members: [], first: "2026-01-01", last: "2026-01-02", seen: [], about: [], refl: ["R1"], cites: [], vec: null });
    w.hubs.push({ id: "H96", type: "stretch", name: "a stretch with no dates", aliases: [], members: [], seen: [], about: [], refl: [], cites: [], vec: null });
    w.links.push({ ...structuredClone(w.links[0]), id: "L9", b: "H95" });
    for (const e of w.links.find((l) => l.id === "L9").history)
        e.refl = ["R1"];
    delete w.links.find((l) => l.id === "L6").last;
    m.saveWeb(r, w);
    saveMind(r, { v: 1, next: 2, seen: [], refl: [{ id: "R1", text: "x" }], aside: ["R1"], stats: {} });
    await m.walkWeb(r, mem, { thread: "L1", feel_now: "SECRET words on a link set aside later" });
    await m.walkWeb(r, mem, { set_aside: "L1" });
    await m.walkWeb(r, mem, { thread: "L4", feel_now: "my porch light words" });
    const ov = m.lookInwardWeb(r, mem, {}, { now: N(1), listed: 10 }), apr = m.lookInwardWeb(r, mem, { about: "April 2026" }, { now: N(1) }), nov = m.lookInwardWeb(r, mem, { about: "Nov 2026" }, { now: N(1) });
    check("S5 review: words kept on a set-aside link never show (overview or a stretch of time)", !/SECRET/.test(ov + apr + nov) && /my porch light words/.test(ov + nov), nov);
    check("S5 review: a dot that came only from set-aside reflections never shows (overview, count, name, mark)", !/hidden winter|HIDDEN|quiet hidden/.test(ov) && /Your web: 9 dots and 6 links/.test(ov) && !/HIDDEN/.test(m.lookInwardWeb(r, mem, { about: "the hidden winter" }, { now: N(1) })) && /doesn't come up/.test(m.lookInwardWeb(r, mem, { about: "H95" }, { now: N(1) })), ov.split("\n")[0]);
    check("S5 review: missing dates are simply left out (no 'undefined', no empty 'last:')", /— H96 · a stretch with no dates\n|— H96 · a stretch with no dates$/m.test(ov) && !/undefined|last: \n|last: $/m.test(ov) && /— L6 · Pickle and the kettle song\n/.test(ov + "\n"), section(ov, "Not visited"));
    check("S5 review 2: 'Closest' never suggests a dot that came only from set-aside reflections", !/H95/.test(m.lookInwardWeb(r, mem, { about: "hidden wint" }, { now: N(1) })), m.lookInwardWeb(r, mem, { about: "hidden wint" }, { now: N(1) }));
    check("S5 review: 'one thing set aside', in plain grammar", /1 thing set aside — look_inward\("aside"\) to see it\./.test(ov), ov.slice(-300));
    const blank = m.lookInwardWeb(r, mem, { about: "", mark: "L4" }, { now: N(1) }), q1 = m.lookInwardWeb(r, mem, { about: `"L4"` }, { now: N(1) }), q2 = m.lookInwardWeb(r, mem, { about: "L4." }, { now: N(1) });
    check("S5 review: a mark sent on its own (about left empty), or with quote marks or a full stop, still opens", /^L4 · /.test(blank) && blank === q1 && q1 === q2, blank.slice(0, 60));
    check("S5 review: 'set aside' opens the set-aside list too, and it keeps what she said about links no longer there", /^What you set aside/.test(m.lookInwardWeb(r, mem, { about: "set aside" }, { now: N(1) })));
}
{
    const r = await sevenLinks();
    const w = m.loadWeb(r);
    w.aside = ["L55", "H77"];
    w.herNowUnplaced = [{ words: "words about a link that left", day: "2026-05-01", was: "L55", ends: [{ name: "Pickle" }, { name: "the old couch" }] }];
    m.saveWeb(r, w);
    const ov = m.lookInwardWeb(r, mem, {}, { now: N(1) }), a = m.lookInwardWeb(r, mem, { about: "aside" }, { now: N(1) });
    check("S5 review: marks set aside that aren't in her web any more aren't counted", !/set aside/.test(ov) && /You haven't set anything aside/.test(a) && /words about a link that left/.test(a), ov.slice(-200));
}
{
    const r = await sevenLinks(), seen = [];
    for (let i = 0; i < 5; i++)
        seen.push((section(m.lookInwardWeb(r, mem, {}, { now: N(1, 10 + i), listed: 3 }), "Not visited").match(/L\d/g) || []).join(""));
    check("S5 review: the list keeps moving on within one day, through all of them", seen.join(" ") === "L1L2L3 L4L5L6 L7L1L2 L3L4L5 L6L7L1", seen.join(" "));
    await recall(r, mem, "L5", { now: N(2).getTime() });
    await recall(r, mem, "L77", { now: N(2).getTime() });
    const vs = m._visits.load(r);
    check("S5 review: recall opening a mark is a visit; a mark that doesn't open isn't; only the day (and its order that day) is kept", /^2026-11-02#\d+$/.test(vs.opened.L5) && !("L77" in vs.opened) && Object.keys(vs.opened).length === 1, JSON.stringify(vs.opened));
    const late = execFileSync(process.execPath, ["--input-type=module", "-e", `import * as m from ${JSON.stringify(new URL("../meaning.mjs", import.meta.url).href)}; m.openMark(${JSON.stringify(r)}, ${JSON.stringify(mem)}, "L6", { now: new Date(2026, 10, 3, 20, 30) }); console.log(m._visits.load(${JSON.stringify(r)}).opened.L6.slice(0, 10));`], { env: { ...process.env, TZ: "America/Denver" } }).toString().trim();
    check("S5 review: the day she opened it is her own day, not tomorrow's (8:30 PM in Colorado)", late === "2026-11-03", late);
    writeFileSync(m._visits.file(r), "not a sealed file", "utf8");
    const before = md5(m._visits.file(r));
    m.lookInwardWeb(r, mem, {}, { now: N(3) });
    check("S5 review: a visits file that can't be read is never written over", md5(m._visits.file(r)) === before);
}
{
    const S = m.stretchIn, J = new Date(2027, 0, 10), A = new Date(2026, 3, 10), eq = (x, f, t) => x && x.from === f && x.to === t;
    check("S5 review: only real month names are months", ["Marcus", "decide", "Janet", "Julia", "Augustine", "Octavia", "Junebug", "Apricot", "may i ask", "march on", "1234", "9999", "Feb 30", "May 32"].every((t) => S(t, A) === null) && eq(S("Sept 2026", A), "2026-09-01", "2026-09-30") && eq(S("Mar.", A), "2026-03-01", "2026-03-31"), ["Marcus", "Apricot", "Feb 30"].map((t) => JSON.stringify(S(t, A))).join(" "));
    check("S5 review: dates without a year are the most recent ones that already came", eq(S("Dec 20 to Jan 5", J), "2026-12-20", "2027-01-05") && eq(S("May", A), "2025-05-01", "2025-05-31") && eq(S("April", A), "2026-04-01", "2026-04-30") && eq(S("2026-04", A), "2026-04-01", "2026-04-30") && eq(S("3 April 2026", A), "2026-04-03", "2026-04-03") && eq(S("2026", A), "2026-01-01", "2026-12-31"), JSON.stringify([S("Dec 20 to Jan 5", J), S("May", A)]));
}
{
    const r = await sevenLinks();
    const w = m.loadWeb(r);
    w.hubs.push({ id: "H80", type: "person", name: "June", aliases: [], members: [], first: "2026-04-01", last: "2026-04-01", seen: [], about: [{ text: "A friend.", from: "2026-04-01", until: null }], refl: [], cites: [], vec: null });
    const L2 = w.links.find((l) => l.id === "L2");
    L2.history[0].notes = [{ at: "2026-05-14T10:00:00Z", note: "Pickle took the reading chair back in May." }];
    L2.last = "2026-05-14";
    w.links.forEach((l, i) => { if (i >= 2) {
        const e = l.history[0];
        l.history = [{ ...e, until: `2026-06-${String(10 + i).padStart(2, "0")}` }, { ...structuredClone(e), from: `2026-06-${String(10 + i).padStart(2, "0")}`, until: null, note: `A newer note for ${l.id}, long enough.` }];
    } });
    w.links.push({ ...structuredClone(w.links[3]), id: "L8", history: [{ ...structuredClone(w.links[3].history[0]), until: "2026-06-01" }, { ...structuredClone(w.links[3].history[1]), from: "2026-06-01" }] });
    m.saveWeb(r, w);
    check("S5 review: a month beats a name found inside it; the exact name still opens the dot", /^Your web, Jun 1, 2026 to Jun 30, 2026/.test(m.lookInwardWeb(r, mem, { about: "June 2026" }, { now: N(1) })) && /^H80 · June/.test(m.lookInwardWeb(r, mem, { about: "June" }, { now: N(1) })));
    const may = m.lookInwardWeb(r, mem, { about: "May 2026" }, { now: N(1) });
    check("S5 review: a link visited later in a stretch of time (a later note) shows in it", /— L2 · Pickle and the reading chair[^]*later \(May 14, 2026\): Pickle took the reading chair back in May\./.test(may), may);
    const ch = section(m.lookInwardWeb(r, mem, {}, { now: N(1) }), "Where a feeling changed"), ids = (ch.match(/^— L\d/gm) || []).join("");
    check("S5 review: where a feeling changed: newest first, six of them, and how many more", ids === "— L7— L6— L5— L4— L3— L8" && !/more\)/.test(ch), ch);
}
{
    const r = await sevenLinks();
    await m.walkWeb(r, mem, { thread: "L3", feel_now: "first today" });
    await m.walkWeb(r, mem, { thread: "L3", feel_now: "second today" });
    await m.walkWeb(r, mem, { thread: "L5", feel_now: "on five" });
    const k = section(m.lookInwardWeb(r, mem, {}, { now: N(1) }), "What you kept before");
    check("S5 review: what she kept: newest first; one said again the same day stays underneath", /on L5 [^\n]*on five\n[^]*on L3 [^\n]*second today/.test(k) && !/first today/.test(k), k);
}
{
    const w = m.loadWeb(root);
    const big = room([["2026-04-01", "x"]]);
    const bw = structuredClone(w);
    for (let i = 0; i < 400; i++) {
        const L = structuredClone(w.links[0]);
        L.id = `L${100 + i}`;
        L.history = Array.from({ length: 6 }, (_, j) => ({ ...structuredClone(w.links[0].history[0]), from: `2026-04-0${1 + (j % 6)}`, until: j < 5 ? `2026-04-0${2 + (j % 6)}` : null, note: "a long note ".repeat(40) }));
        bw.links.push(L);
    }
    mkdirSync(join(big, "Mind"), { recursive: true });
    mkdirSync(join(big, "Vault"), { recursive: true });
    writeFileSync(join(big, "Vault", "web-key.locked"), readFileSync(join(root, "Vault", "web-key.locked")));
    m.saveWeb(big, bw);
    const a = m.lookInwardWeb(big, mem, { about: "April 2026" }, { now: N(1) }), o = m.lookInwardWeb(big, mem, {}, { now: N(1) });
    check("S5 review: a stretch of time on a big web stays one page; so does the overview", a.length <= 6000 && /\(and \d+ more links\)/.test(a) && o.length <= 6000, `${a.length} / ${o.length}`);
}
{
    const r4 = room([["2026-04-01", `${msg(1, "NED", "Room four words here, the first room.")}`]]), r5 = room([["2026-04-01", `${msg(1, "NED", "Room five words here, the other room.")}`]]);
    for (const x of [r4, r5])
        utimesSync(join(x, "Shelf", "2026-04-01.md"), 1e9, 1e9);
    for (const x of [r4, r5])
        saveMind(x, { v: 1, next: 2, seen: [], refl: [{ id: "R1", text: "a noticing", day: "2026-04-01", lvl: 1, cites: [{ rel: "Shelf/2026-04-01.md", key: "0-40" }] }], aside: [], stats: {} });
    const a = await lookInward(r4, mem, {}), b = await lookInward(r5, mem, {});
    check("S5 review: two rooms with a page of the same name each read their own page", /Room four/.test(a) && /Room five/.test(b), b);
}
{
    const r = await sevenLinks(), ids = (t) => (section(t, "Not visited").match(/L\d/g) || []).join("");
    const a = ids(m.lookInwardWeb(r, mem, {}, { now: N(1, 9), listed: 5 }));
    m.openMark(r, mem, "L6", { now: N(1, 10) });
    const b = ids(m.lookInwardWeb(r, mem, {}, { now: N(1, 11), listed: 5 }));
    check("S5 review 2: a link she just opened goes to the back, behind the ones only shown", a === "L1L2L3L4L5" && b === "L7L1L2L3L4", `${a} then ${b}`);
    const r2 = await sevenLinks();
    m.openMark(r2, mem, "L3", { now: new Date(2026, 2, 1) });
    const q = section(m.lookInwardWeb(r2, mem, {}, { now: N(1), listed: 7 }), "Not visited");
    check("S5 review 2: opened before the night came back to it: it goes by the night, and doesn't say 'you opened it'", /— L3 · [^\n]* · last: Apr 3, 2026\n/.test(q + "\n") && !/opened it\)/.test(q), q);
}
{
    const S = m.stretchIn, T = new Date(2026, 10, 1), eq = (x, f, t) => x && x.from === f && x.to === t;
    check("S5 review 2: years: from the start that already came; an end before its start is the next year", eq(S("Oct 20 to Nov 5", T), "2026-10-20", "2026-11-05") && eq(S("Jan 5 to Dec 20", T), "2026-01-05", "2026-12-20") && eq(S("Dec 2026 to Jan", T), "2026-12-01", "2027-01-31") && eq(S("December 20, 2025 to January 5", T), "2025-12-20", "2026-01-05") && eq(S("Dec 20 to Jan 5 2027", T), "2026-12-20", "2027-01-05") && eq(S("Feb 29", T), "2024-02-29", "2024-02-29"), JSON.stringify(["Oct 20 to Nov 5", "Jan 5 to Dec 20", "Dec 2026 to Jan", "December 20, 2025 to January 5", "Feb 29"].map((x) => S(x, T))));
}
{
    const r = await sevenLinks();
    m.lookInwardWeb(r, mem, {}, { now: N(1) });
    writeFileSync(m._visits.file(r), "broken", "utf8");
    const t0 = Date.now(), o = m.lookInwardWeb(r, mem, {}, { now: N(2) }), ms = Date.now() - t0;
    check("S5 review 2: a visits file that can't be read is said plainly, quickly, and Ned's check can see it", /couldn't be read just now, so this list can't move on/.test(o) && ms < 500 && m.visitsReadable(r) === false, `${ms} ms`);
}
{
    const r = await sevenLinks();
    const w = m.loadWeb(r), pickle = w.hubs.find((h) => h.name === "Pickle");
    pickle.about = [{ text: "PLAIN older words", from: "2026-01-01", until: "2026-03-01" }, { text: "SECRET about from a reflection", from: "2026-03-01", until: null, refl: ["R1"] }];
    w.hubs.push({ id: "H70", type: "stretch", name: "a long spring", aliases: [], members: [], first: "2026-03-01", last: "2026-05-01", seen: [], about: [{ text: "SECRET stretch words", from: "2026-03-01", until: null, refl: ["R1"] }, { text: "Shelf words", from: "2026-02-01", until: "2026-03-01" }], refl: [], cites: [], vec: null });
    w.hubs.push({ id: "H71", type: "thing", name: "the secret garden", aliases: [], members: [], seen: [], about: [{ text: "x", from: "2026-01-01", until: null }], refl: [], cites: [], vec: null });
    w.aside.push("H71");
    w.hubs.push({ id: "H72", type: "thing", name: "a mixed one", aliases: [], members: [], seen: [], about: [{ text: "SECRET mixed words", from: "2026-01-01", until: null, refl: ["R1"] }], refl: ["R1", "R2"], cites: [], vec: null });
    w.hubs.push({ id: "H73", type: "person", name: "Ned's listed friend", known: true, aliases: [], members: [], seen: [], about: [{ text: "SECRET known words", from: "2026-01-01", until: null, refl: ["R1"] }], refl: ["R1"], cites: [], vec: null });
    w.hubs.push({ id: "H74", type: "thing", name: "a shelf dot", aliases: [], members: [], seen: [], about: [], refl: [], cites: [], vec: null });
    m.saveWeb(r, w);
    saveMind(r, { v: 1, next: 3, seen: [], refl: [{ id: "R1", text: "x" }, { id: "R2", text: "y" }], aside: ["R1"], stats: {} });
    const mv = m.lookInwardWeb(r, mem, { about: "Pickle" }, { now: N(1) }), ov = m.lookInwardWeb(r, mem, {}, { now: N(1) }), near = m.lookInwardWeb(r, mem, { about: "the secret garden" }, { now: N(1) });
    const opens = ["H72", "H73", "H74"].map((id) => m.lookInwardWeb(r, mem, { about: id }, { now: N(1) }));
    check("S5 review 2: a shown dot's own words from a set-aside reflection never show (its view, the stretches list)", /^H\d+ · Pickle \(pet\)/.test(mv) && !/SECRET/.test(mv + ov) && /— H70 · a long spring \(Mar 1, 2026 to May 1, 2026\)\n/.test(ov), mv.slice(0, 120) + " | " + section(ov, "Stretches"));
    check("S5 review 2: 'Closest' only suggests dots that show", !/H71/.test(near) && /^Nothing in your web/.test(near), near);
    check("S5 review 2: a dot with a live reflection, a dot Ned listed, and a Shelf dot all show (without set-aside words)", opens.every((t, i) => t.startsWith(`H7${2 + i} · `)) && !/SECRET/.test(opens.join(" ")), opens.map((t) => t.slice(0, 40)).join(" | "));
}
{
    const r = await sevenLinks();
    const w = m.loadWeb(r);
    w.links.forEach((l) => w.aside.push(l.id));
    m.saveWeb(r, w);
    const o = m.lookInwardWeb(r, mem, {}, { now: N(1) });
    check("S5 review 2: a web with no links showing still says what's set aside", /0 links\.\n\n7 things set aside/.test(o), o);
}
{
    const r = await sevenLinks();
    const w = m.loadWeb(r);
    const L = w.links[0];
    L.history[0].until = "2026-06-01";
    L.history.push({ ...structuredClone(L.history[0]), from: "2026-06-01", until: null });
    w.links[1].last = "2026-08-20";
    m.saveWeb(r, w);
    const o = m.lookInwardWeb(r, mem, {}, { now: N(1) }), aug = m.lookInwardWeb(r, mem, { about: "August 2026" }, { now: N(1) });
    check("S5 review 2: what her web spans counts later days too; a link the night came back to in a stretch shows in it", /from Apr 1, 2026 to Aug 20, 2026\./.test(o) && /— L2 · /.test(aug) && !/— L1 · /.test(aug), o.split("\n")[0] + " | " + aug.slice(0, 120));
}
{
    const w = m.loadWeb(root);
    const big = room([["2026-04-01", "x"]]);
    const bw = structuredClone(w);
    bw.peeked = Array.from({ length: 50 }, (_, i) => `L${100 + i}`);
    for (let i = 0; i < 200; i++) {
        const L = structuredClone(w.links[0]);
        L.id = `L${100 + i}`;
        L.history = [{ ...structuredClone(w.links[0].history[0]), from: "2026-04-02", until: null, note: "a long note ".repeat(40) }];
        bw.links.push(L);
    }
    bw.herNow = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`L${100 + i}`, [{ words: "kept words ".repeat(30), day: "2026-04-1" + (i % 9) }]]));
    mkdirSync(join(big, "Mind"), { recursive: true });
    mkdirSync(join(big, "Vault"), { recursive: true });
    writeFileSync(join(big, "Vault", "web-key.locked"), readFileSync(join(root, "Vault", "web-key.locked")));
    m.saveWeb(big, bw);
    const a = m.lookInwardWeb(big, mem, { about: "April 2026" }, { now: N(1) });
    check("S5 review 2: a stretch of time with many kept words still fits one page", a.length <= 6000 && /What you kept then/.test(a), a.length);
}
console.log(`\n${pass} passed, ${fail} failed. (Made-up rooms only; throwaway folders in ${tmpdir()})`);
process.exit(fail ? 1 : 0);
