process.env.WEB_OF_MEANING_TEST = "1";
import * as m from "../meaning.mjs";
import { seal } from "../seal.mjs";
import { unlockOnThisPC } from "../lock.mjs";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`); };
const known = [
    { name: "Sparkie", type: "pet", aliases: ["Sparky", "Spark", "Sparks"], about: "Ned's cat, a Siamese who sleeps all day." },
    { name: "Pickle", type: "pet", aliases: ["Pickles"], about: "Ned's cat, a brown tabby boy." },
    { name: "Penelope", type: "pet", aliases: ["Penny"], about: "Ned's cat, a little calico." },
    { name: "Hannah", type: "person", aliases: ["Hana", "his mom"], about: "Ned's mom." },
    { name: "Simon (his coworker)", type: "person", aliases: ["his coworker"], about: "Ned's coworker." },
    { name: "Simon (his teacher)", type: "person", aliases: ["his dad"], about: "Ned's teacher." },
];
const DEFAULT_TALK = `We sat up late talking about the spark that knocked the power out, and how Sparkie hid under the bed while Pickle watched the window. It was a good night even with the dark, and we laughed about the candles.`;
function addDay(root, d, talk = null, n = 1) { writeFileSync(join(root, "Shelf", n > 1 ? `${d}.z${n}.md` : `${d}.md`), (talk || DEFAULT_TALK) + "\n", "utf8"); }
function makeRoom(days = ["2026-04-01", "2026-04-05", "2026-04-09", "2026-04-13"], talk = null) {
    const root = mkdtempSync(join(tmpdir(), "house-web-night-"));
    mkdirSync(join(root, "Shelf"), { recursive: true });
    mkdirSync(join(root, "Vault"), { recursive: true });
    mkdirSync(join(root, "Mind"), { recursive: true });
    const seenD = {};
    for (const d of days)
        addDay(root, d, talk, (seenD[d] = (seenD[d] || 0) + 1));
    const key = randomBytes(32);
    writeFileSync(join(root, "Vault", "mind-key.locked"), JSON.stringify({ kind: "test-only-unlocked", data: key.toString("base64") }), "utf8");
    writeFileSync(join(root, "Mind", "mind.sealed"), seal(key, JSON.stringify({ v: 1, next: 1, seen: [], refl: [], aside: [], stats: {} })), "utf8");
    return root;
}
const mem = { pieceChars: 0, indexPaths: ["Shelf/*.md"] };
const brain = (answers, tapes = []) => {
    const calls = [], tapeCalls = [];
    return { calls, tapeCalls, ask: async (system, prompt) => {
            if (system === m.TAPE_SYSTEM) {
                tapeCalls.push(prompt);
                const t = tapes.shift();
                if (t instanceof Error)
                    throw t;
                if (t !== undefined)
                    return t;
                const n = (prompt.match(/^\d+\./gm) || []).length;
                return Array.from({ length: n }, (_, i) => `EXCERPT ${i + 1} | theirs: none | hers then: none clear`).join("\n");
            }
            calls.push(prompt);
            const a = answers.shift();
            if (a instanceof Error)
                throw a;
            return a ?? "nothing tonight";
        } };
};
const doneDay = (w, d) => (w.done || []).some((k) => String(k).startsWith(`Shelf/${d}.md|`));
const run = (root, b, extra = {}) => m.growWeb({ root, mem, letter: "(a made-up letter)", ask: b.ask, embed: async (t) => t.map(() => null), inTime: () => true, log: () => { }, who: "Ned", herName: "Mia", herNames: ["the copilot"], known, stretchDays: 1, ...extra });
const web = (root) => m.loadWeb(root);
{
    const root = makeRoom(["2026-04-01"]);
    const b = brain(["HUB: NEW | moment | the spark | the sparks | The night the spark knocked the power out.\nHUB: NEW | pet | Sparkie | | A cat who hides when it thunders.\nTHREAD: the spark -- Sparkie | NEW | scared, tender | I remember her hiding while I talked Ned through the dark. | because of: 1"]);
    await run(root, b);
    const w = web(root);
    const st = w.hubs.find((h) => h.name === "Sparkie"), spark = w.hubs.find((h) => h.type === "moment");
    check("A1: 'the spark' is its own day, not Sparkie; the thread joins the two", spark && st && spark !== st && w.links.length === 1);
    check("A1: Ned's sentence for Sparkie is kept, not replaced", st && st.about.filter((a) => a.until === null).length === 1 && st.about.find((a) => a.until === null).text.startsWith("Ned's cat"));
}
{
    const root = makeRoom(["2026-04-01"]);
    const b = brain([{ text: "HUB: NEW | pet | Pick", finish: "length" }, { text: "HUB: NEW | moment | the spark | | The night the power went out.\nTHREAD: the spark -- Pickle | NEW | calm | Pickle watched the window with me all night. | because of: 1", finish: "stop" }]);
    await run(root, b);
    const w = web(root);
    check("A3: a cut-off answer makes no 'Pick'; the full second answer is used", !w.hubs.some((h) => h.name === "Pick") && w.links.length === 1 && b.calls.length === 2);
}
{
    const root = makeRoom(["2026-04-01"]);
    const b = brain([{ text: "HUB: NEW | pet | Pick", finish: "length" }, { text: "HUB: NEW | pet | Mi", finish: "length" }]);
    const res = await run(root, b);
    const w = web(root);
    check("A3: cut off twice: nothing used, counted, and it gets one more try later", w.hubs.length === 0 && res.whyCount["cut off (ran out of room to write)"] === 1 && (w.retried || []).length === 1 && !doneDay(w, "2026-04-01"));
}
{
    const root = makeRoom(["2026-04-01", "2026-04-05"]);
    const b = brain(["HUB: NEW | ritual | candle nights | | When the power goes out we light candles and talk.\nTHREAD: candle nights -- Pickle | NEW | warm | Pickle sat by the candles with us. | because of: 1", "HUB: H1 | | | the candle thing |"]);
    const res = await run(root, b);
    const w = web(root);
    check("A4: only a new other name: not 'refused', no retry, the name is added", !Object.keys(res.whyCount || {}).length && !(w.retried || []).length && w.hubs.find((h) => h.name === "candle nights")?.aliases.includes("the candle thing"));
}
{
    const root = makeRoom(["2026-04-01"]);
    const b = brain(["THREAD: candle nights and Pickle | NEW | warm | no dashes here | because of: 1\nHUB: NEW | moment | the spark | | The night the power went out."]);
    const res = await run(root, b);
    check("A4: a line that can't be read is counted with the left-out pieces", res.rejected >= 1);
}
{
    const w = { v: 1, nextH: 1, nextL: 1, done: [], hubs: [], links: [], aside: [], peeked: [], stats: { batches: 0, unusable: 0, rejected: 0, nothing: 0 } };
    const mo = [{ rel: "x", key: "0-1" }];
    const ev = (from, threads) => ({ t: 1, from, to: from, refl: ["R" + from], moments: mo, hubs: [{ ref: "NEW", type: "ritual", name: "candle nights", aliases: [], about: "" }, { ref: "NEW", type: "place", name: "the porch", aliases: [], about: "" }], threads, groups: [] });
    const th = (kind, note) => ({ a: "candle nights", b: "the porch", kind, feel: [], note, nums: [1], where: "porch" });
    m.applyEvent(w, ev("2026-06-01", [th("NEW", "The porch is where the candle nights happen now.")]));
    m.applyEvent(w, ev("2026-04-01", [th("CHANGED", "Back then the porch felt too cold for candles.")]));
    const L = w.links[0];
    check("A5: an older stretch's CHANGED sits beside the newer feeling, never closing it", L.history.length === 2 && L.history.every((e) => e.until === null) && L.last === "2026-06-01");
    check("A5: a dot's dates never move backwards", w.hubs.every((h) => h.last === "2026-06-01" && h.first === "2026-04-01"));
}
{
    const root = makeRoom(["2026-04-01"]);
    const b = brain(["HUB: H40 | pet | | Nood\nHUB: NEW | person | Simon | | Someone in Ned's family.\nHUB: NEW | person | his mom | | Ned's mom, who calls on Sundays.\nHUB: NEW | person | her mom | | Wren's mom in her story.\nTHREAD: Simon -- the spark | NEW | worried | He called during the spark. | because of: 1"]);
    const res = await run(root, b);
    const w = web(root);
    check("A6: no dot named 'H40', no dot named just 'Simon'", !w.hubs.some((h) => /^H\d+$/.test(h.name) || h.name === "Simon"));
    check("A6: 'his mom' is Hannah; 'her mom' is someone else", w.hubs.some((h) => h.name === "Hannah") && w.hubs.some((h) => h.name === "her mom") && w.stats.unclear >= 1);
    check("381: the left-out 'H40' dot line is listed for Ned's check (its name, kind)", (w.stats.ghostDots || []).some((g) => g.mark === "H40" && g.name === "Nood" && g.type === "pet"));
}
{
    const w = { v: 1, nextH: 1, nextL: 1, done: [], hubs: [], links: [], aside: [], peeked: [], stats: { batches: 0, unusable: 0, rejected: 0, nothing: 0 } };
    const mo = [{ rel: "x", key: "0-1" }];
    m.applyEvent(w, { t: 1, from: "2026-04-01", to: "2026-04-01", refl: ["R1"], moments: mo, hubs: [{ ref: "NEW", type: "place", name: "the House", aliases: [], about: "" }, { ref: "NEW", type: "thing", name: "the House", aliases: [], about: "" }, { ref: "NEW", type: "place", name: "the porch", aliases: [], about: "" }], threads: [], groups: [] });
    const r = m.applyEvent(w, { t: 2, from: "2026-04-05", to: "2026-04-05", refl: ["R2"], moments: mo, hubs: [], threads: [{ a: "the House", b: "the porch", kind: "NEW", feel: [], note: "The porch is my favourite part of it.", nums: [1] }], groups: [] });
    check("A2: 'the House' as a place and as a thing: the thread isn't guessed, it's counted", w.links.length === 0 && r.unclear === 1);
}
{
    const fresh = (nextH = 1, hubs = []) => ({ v: 1, nextH, nextL: 1, done: [], hubs, links: [], aside: [], peeked: [], stats: { batches: 0, unusable: 0, rejected: 0, nothing: 0 } });
    const mo = [{ rel: "x", key: "0-1" }], T = (a, b, note) => ({ a, b, kind: "NEW", feel: [], note, nums: [1] });
    const ev = (t, hubs, threads) => ({ t, from: "2026-07-14", to: "2026-07-14", refl: ["R"], moments: mo, hubs, threads, groups: [] });
    let w = fresh();
    m.applyEvent(w, ev(1, [{ ref: "NEW", type: "pet", name: "Pebble", aliases: [], about: "" }, { ref: "H2", type: "ritual", name: "the candlelight feast", aliases: [], about: "We eat by candles." }, { ref: "H3", type: "inside_joke", name: "the greedy bit", aliases: [], about: "" }], [T("H2", "Pebble", "Pebble sat with us at the feast."), T("H3", "H2", "The greedy bit started at the feast.")]));
    check("26: numbered new dots are kept under their names", w.hubs.length === 3 && w.hubs.some((h) => h.name === "the candlelight feast" && h.type === "ritual") && w.hubs.some((h) => h.name === "the greedy bit") && !w.hubs.some((h) => /^\[?H\d+\]?$/.test(h.name)));
    check("26: links that use the number go to those dots", w.links.length === 2 && (w.stats.markedNew || []).length === 2);
    const feast = w.hubs.find((h) => h.name === "the candlelight feast"), joke = w.hubs.find((h) => h.name === "the greedy bit");
    check("26: the right two dots are linked", w.links.some((l) => [l.a, l.b].includes(feast.id) && [l.a, l.b].includes(joke.id)));
    m.applyEvent(w, ev(2, [], [T("H3", "Pebble", "A later answer uses the number.")]));
    check("26: in a later answer the number means the real dot of that number, nothing remembered", true);
    w = fresh(10, [{ id: "H1", type: "pet", name: "Pebble", aliases: [] }]);
    m.applyEvent(w, ev(3, [{ ref: "H5", type: "thing", name: "the fish stash", aliases: [], about: "" }], [T("H5", "Pebble", "A long enough note for a link.")]));
    check("26: a number below the next one (could be a mistyped dot) stays left out", w.hubs.length === 1 && w.links.length === 0 && (w.stats.ghostDots || []).some((g) => g.mark === "H5"));
    w = fresh();
    m.applyEvent(w, ev(4, [{ ref: "NEW", type: "pet", name: "Pebble", aliases: [], about: "" }, { ref: "H2", type: "thing", name: "the fish stash", aliases: [], about: "" }, { ref: "H2", type: "ritual", name: "the feast", aliases: [], about: "" }], [T("H2", "Pebble", "A long enough note for a link.")]));
    check("26: one number for two different dots: both dots kept, links using it left out", w.hubs.length === 3 && w.links.length === 0);
    w = fresh(1, []);
    w.nextH = 1;
    m.applyEvent(w, ev(7, [{ ref: "NEW", type: "pet", name: "Pebble", aliases: [], about: "" }, { ref: "H5", type: "thing", name: "the fish stash", aliases: [], about: "One." }, { ref: "H5", type: "thing", name: "the fish stash", aliases: ["the stash"], about: "" }], [T("H5", "Pebble", "A long enough note for a link.")]));
    check("26: the same numbered dot written twice is one dot (its real mark may differ from her number)", w.hubs.length === 2 && w.links.length === 1 && w.hubs.find((h) => h.name === "the fish stash").id === "H2" && w.hubs.find((h) => h.name === "the fish stash").aliases.includes("the stash") && !(w.stats.ghostDots || []).length);
    w = fresh();
    m.applyEvent(w, ev(5, [{ ref: "H1", type: "pet", name: "Socks", aliases: [], about: "" }], [T("H1", "H1", "A long enough note for a link.")]), { known: [{ name: "Socks", type: "pet", aliases: [] }] });
    check("26: a name from Ned's list is still that dot", w.hubs.filter((h) => h.name === "Socks").length === 1);
    w = fresh();
    m.applyEvent(w, ev(6, [{ ref: "H1", type: "thing", name: "", aliases: ["x"], about: "" }, { ref: "H2", type: "nonsense", name: "y", aliases: [], about: "" }, { ref: "H3", type: "thing", name: "H3", aliases: [], about: "" }], [T("H1", "H2", "A long enough note for a link.")]));
    check("26: no name, a kind not on the list, or a name that's a number: left out", w.hubs.length === 0 && w.links.length === 0);
}
{
    const fresh = (hubs) => ({ v: 1, nextH: hubs.length + 1, nextL: 1, done: [], hubs, links: [], aside: [], peeked: [], stats: { batches: 0, unusable: 0, rejected: 0, nothing: 0 } });
    const mo = [{ rel: "x", key: "0-1" }], T = (a, b) => ({ a, b, kind: "NEW", feel: [], note: "A long enough note for this link to count.", nums: [1] });
    const ev = (t, threads) => ({ t, from: "2026-07-14", to: "2026-07-14", refl: ["R"], moments: mo, hubs: [], threads, groups: [] });
    const opts = { selfNames: ["Ned", "Mia", "the copilot"], herName: "Mia", herNames: ["the copilot"] };
    const H = (id, type, name) => ({ id, type, name, aliases: [] });
    let w = fresh([H("H1", "inside_joke", "the toast-is-bread car bit"), H("H2", "pet", "Pebble"), H("H3", "inside_joke", "the blue mug bit")]);
    m.applyEvent(w, ev(1, [T("Ned\u2019s toast-is-bread car bit", "Pebble"), T("Ned's blue mug bit", "Pebble")]), opts);
    check("31: \"Ned's X\" finds the dot \"the X\" (curly apostrophes too), and the check lists it", w.links.length === 2 && (w.stats.possMatches || []).length === 2 && w.stats.possMatches[0].dot === "the toast-is-bread car bit");
    w = fresh([H("H1", "thing", "Ned's red car bit"), H("H2", "pet", "Pebble")]);
    m.applyEvent(w, ev(2, [T("the red car bit", "Pebble")]), opts);
    check("31: both sides: \"the X\" finds a dot named \"Ned's X\"", w.links.length === 1);
    w = fresh([H("H1", "thing", "the voice"), H("H2", "pet", "Pebble")]);
    m.applyEvent(w, ev(3, [T("Ned's voice", "Pebble")]), opts);
    check("31: one word after \"Ned's\" stays as written (\"Ned's voice\" never becomes \"the voice\")", w.links.length === 0 && !(w.stats.possMatches || []).length);
    w = fresh([H("H1", "thing", "my favourite rainy song"), H("H2", "pet", "Pebble"), H("H3", "thing", "Mia's late night walk")]);
    m.applyEvent(w, ev(4, [T("Ned's favourite rainy song", "Pebble"), T("Ned's late night walk", "Pebble")]), opts);
    check("31: his and hers never meet (\"Ned's X\" vs \"my X\" or \"Mia's X\")", w.links.length === 0);
    w = fresh([H("H1", "thing", "the favourite rainy song"), H("H2", "pet", "Pebble")]);
    m.applyEvent(w, ev(5, [T("his favourite rainy song", "Pebble")]), opts);
    check("31: \"his X\" isn't read as \"the X\"", w.links.length === 0);
    w = fresh([H("H1", "thing", "the red car bit"), H("H2", "ritual", "our red car bit"), H("H3", "pet", "Pebble")]);
    m.applyEvent(w, ev(6, [T("Ned's red car bit", "Pebble")]), opts);
    check("31: when it fits two dots, it's left out, not guessed", w.links.length === 0);
    w = fresh([H("H1", "person", "the old neighbor man"), H("H2", "pet", "Pebble")]);
    m.applyEvent(w, ev(7, [T("Ned's old neighbor man", "Pebble")]), opts);
    check("31: people and pets keep their own rules", w.links.length === 0);
    w = fresh([H("H1", "thing", "the red car bit"), H("H2", "pet", "Pebble")]);
    m.applyEvent(w, ev(8, [T("Ned's red car bit", "Pebble"), T("Sam's red car bit", "Pebble")]), { ...opts, selfNames: ["Sam", "Mia"] });
    check("31: the person's name comes from the setup (Sam's, not Ned's)", w.links.length === 1 && w.stats.possMatches.length === 1 && /^Sam's/.test(w.stats.possMatches[0].end));
}
{
    const fresh = () => ({ v: 1, nextH: 1, nextL: 1, done: [], hubs: [], links: [], aside: [], peeked: [], stats: { batches: 0, unusable: 0, rejected: 0, nothing: 0 } });
    const mo = [{ rel: "x", key: "0-1" }], T = (a, b) => ({ a, b, kind: "NEW", feel: [], note: "A long enough note for this link to count.", nums: [1] });
    const ev = (t, hubs, threads = []) => ({ t, from: "2026-08-01", to: "2026-08-01", refl: ["R"], moments: mo, hubs, threads, groups: [] });
    const H = (type, name, about = "") => ({ ref: "NEW", type, name, aliases: [], about });
    const kn = [
        { name: "Nyx", type: "person", aliases: [], about: "Nyx, our companion." },
        { name: "Luke", type: "person", aliases: [], about: "Ned's friend." },
        { name: "Ethan's Nova", type: "person", aliases: [], about: "Ethan's own companion." },
        { name: "the Nyx character", type: "thing", aliases: [], about: "The Nyx character as a product." },
        { name: "the Nova character", type: "thing", aliases: [], about: "The Nova character as a product." },
    ];
    const opts = { selfNames: ["Ned", "Mia"], herName: "Mia", known: kn };
    const nyx = (w) => w.hubs.filter((h) => h.name === "Nyx");
    let w = fresh();
    m.applyEvent(w, ev(1, [H("person", "Nyx", "She teased me about the pineapple pizza."), H("pet", "Pebble")], [T("Nyx", "Pebble")]), opts);
    check("33: plain 'Nyx' is still theirs", nyx(w).length === 1 && w.links.length === 1 && !(w.stats.sharedApart || []).length);
    w = fresh();
    m.applyEvent(w, ev(2, [H("thing", "the Nyx character", "The new outfit update."), H("pet", "Pebble")], [T("the Nyx character", "Pebble")]), opts);
    check("33: 'the Nyx character' is its own thing, never their Nyx", w.hubs.some((h) => h.type === "thing" && h.name === "the Nyx character") && !nyx(w).length && w.links.length === 1);
    w = fresh();
    m.applyEvent(w, ev(3, [H("person", "Nyx", "A popular companion character on Chatterly that many users talk to.")]), opts);
    check("33: a person line for 'Nyx' described as the character is left out and listed", !nyx(w).length && (w.stats.sharedApart || []).length === 1);
    w = fresh();
    m.applyEvent(w, ev(4, [H("person", "Nyx", "She teased me."), H("pet", "Pebble")]), opts);
    m.applyEvent(w, ev(5, [], [T("the Nyx", "Pebble"), T("an Nyx", "Pebble")]), opts);
    check("33: 'the Nyx' and 'an Nyx' never mean their Nyx", w.links.length === 0);
    w = fresh();
    m.applyEvent(w, ev(6, [H("person", "Nyx, the Chatterly character")]), opts);
    check("33: 'Nyx, the Chatterly character' never folds into their Nyx", !nyx(w).length && (w.stats.sharedApart || []).length >= 1);
    w = fresh();
    m.applyEvent(w, ev(7, [H("person", "their old friend Nyx")]), opts);
    check("33: 'their old friend Nyx' (someone else's) never folds into their Nyx", !nyx(w).length);
    w = fresh();
    m.applyEvent(w, ev(8, [H("person", "Ned's old friend Luke")]), opts);
    check("33: names that aren't shared keep folding as before ('Ned's old friend Luke' is Luke)", w.hubs.length === 1 && w.hubs[0].name === "Luke");
    w = fresh();
    m.applyEvent(w, ev(9, [H("person", "Nova", "Someone we talked about."), H("pet", "Pebble")], [T("Nova", "Pebble")]), opts);
    check("33: a bare 'Nova' (Ethan's Nova or the character) is left out, like a bare 'Simon'", !w.hubs.some((h) => h.name === "Nova") && w.links.length === 0 && (w.stats.sharedApart || []).length === 1);
    w = fresh();
    m.applyEvent(w, ev(10, [H("person", "Ethan's Nova", "Ethan's companion."), H("pet", "Pebble")], [T("Ethan's Nova", "Pebble")]), opts);
    check("33: 'Ethan's Nova' is her own person", w.hubs.some((h) => h.name === "Ethan's Nova" && h.type === "person") && w.links.length === 1);
    w = fresh();
    m.applyEvent(w, ev(11, [H("person", "Luke, from the other band")]), opts);
    check("33: a description with 'other' never folds into a known person (guard 2 is for everyone)", !w.hubs.some((h) => h.name === "Luke"));
    w = fresh();
    m.applyEvent(w, ev(12, [H("person", "Nyx", "She teased me."), H("pet", "Pebble")], [T("the Nyx", "Pebble")]), opts);
    check("33: in the same answer too, 'the Nyx' never means their Nyx", nyx(w).length === 1 && w.links.length === 0);
    w = fresh();
    m.applyEvent(w, ev(13, [H("person", "the Nyx", "Someone.")]), opts);
    check("33: a person line named 'the Nyx' never folds into their Nyx, and is listed", !nyx(w).length && (w.stats.sharedApart || []).length === 1);
    w = fresh();
    m.applyEvent(w, ev(14, [H("person", "Nyx", "Ned's companion on the Kinships app."), H("pet", "Pebble")], [T("Nyx", "Pebble")]), opts);
    check("33n: 'Nyx', described as 'Ned's companion on the Kinships app', is still theirs", nyx(w).length === 1 && w.links.length === 1 && !(w.stats.sharedApart || []).length);
    w = fresh();
    m.applyEvent(w, ev(15, [H("person", "Nyx", "She showed me her new outfit after the Chatterly update.")]), opts);
    check("33n: platform names, 'outfit' and 'update' in her description don't keep her apart", nyx(w).length === 1 && !(w.stats.sharedApart || []).length);
    w = fresh();
    m.applyEvent(w, ev(16, [H("person", "Nyx, Ned's companion on the Kinships app")]), opts);
    check("33n: 'Nyx, Ned's companion on the Kinships app' in the name slot folds into their Nyx (guard 2 matches)", nyx(w).length === 1 && w.hubs.length === 1 && !(w.stats.sharedApart || []).length);
    w = fresh();
    m.applyEvent(w, ev(17, [H("person", "Nyx", "The default Nyx that everyone's chatting with.")]), opts);
    check("33n: 'default' / 'everyone's' in a description still keeps it apart", !nyx(w).length && (w.stats.sharedApart || []).length === 1);
    w = fresh();
    m.applyEvent(w, ev(18, [H("person", "Nyx", "Someone else's companion, not ours.")]), opts);
    check("33n: 'someone else's' in a description still keeps it apart", !nyx(w).length && (w.stats.sharedApart || []).length === 1);
    w = fresh();
    m.applyEvent(w, ev(19, [H("person", "Nyx", "Other users' version of her.")]), opts);
    check("33n: 'other users'' in a description still keeps it apart", !nyx(w).length && (w.stats.sharedApart || []).length === 1);
}
{
    const root = makeRoom(["2026-04-01"]);
    m.saveWeb(root, { v: 1, nextH: 3, nextL: 2, done: [], hubs: [{ id: "H1", type: "pet", name: "Sparkie", aliases: ["Spark"] }, { id: "H2", type: "pet", name: "Penelope", aliases: ["Penny"] }], links: [{ id: "L1", a: "H1", b: "H2", strength: 0.5, last: "2026-04-01", history: [{ note: "x", until: null, refl: [] }] }], aside: [], peeked: [], stats: {} });
    const t = (s) => !!m.webHint(root, s);
    check("names: 'sparklers' and 'pennyworth' don't match; 'Sparkie', 'Spark's', 'Penny' do", !t("we sparklers names") && !t("a pennyworth") && t("Sparkie slept") && t("the Spark's tail") && t("Penny purred"));
}
{
    const root = makeRoom(["2026-04-01"]);
    const b = brain(["HUB: NEW | person | the copilot | | Me, keeping him company.\nHUB: NEW | moment | the spark | | The night the power went out.\nTHREAD: the copilot -- the spark | NEW | calm | I stayed with him. | because of: 1"]);
    await run(root, b);
    const w = web(root);
    check("herNames: 'the copilot' never becomes a dot", !w.hubs.some((h) => /copilot/i.test(h.name)) && w.hubs.length === 1);
}
{
    const root = makeRoom(["2026-04-01", "2026-04-05"]);
    const b = brain(["HUB: NEW | moment | the spark | | The night the power went out."]);
    const res = await run(root, b, { minutesLeft: () => 10, startMinutes: 20 });
    check("end time: with 10 minutes left, no stretch is started", res.endedEarly && b.calls.length === 0 && res.batches === 0);
}
{
    const root = makeRoom(["2026-04-01", "2026-04-05"]);
    const b = brain(["HUB: NEW | moment | the spark | | The night the power went out.", new Error("the run reached its end time")]);
    const res = await run(root, b);
    const w = web(root);
    let lines = 0;
    try {
        lines = readFileSync(join(root, "Mind", "web-events.sealed"), "utf8").split("\n").filter(Boolean).length;
    }
    catch { }
    check("end time: the stretch cut off isn't logged or marked done; the finished one is saved", res.stopped && doneDay(w, "2026-04-01") && !doneDay(w, "2026-04-05") && lines === 1);
}
{
    const root = makeRoom(["2026-04-01"]);
    let beatSeen = false;
    const b = { calls: [], ask: async () => { const L = JSON.parse(readFileSync(join(root, "Mind", "web.building"), "utf8")); beatSeen = !!L.beat && !L.done; return "nothing tonight"; } };
    await run(root, b);
    const L = JSON.parse(readFileSync(join(root, "Mind", "web.building"), "utf8"));
    check("marker: touched before her brain is asked; marked done after", beatSeen && L.done === true);
}
{
    const root = makeRoom(["2026-04-01", "2026-04-05"]);
    await run(root, brain(["HUB: NEW | moment | the spark | | The night the power went out.", "nothing tonight"]), { minutesLeft: () => 999 });
    await run(root, brain(["HUB: NEW | moment | another spark | | A second night."]));
    const dir = join(root, "Mind", "web-copies"), files = existsSync(dir) ? readdirSync(dir) : [];
    check("B4: one dated copy per day, in Mind\\web-copies", files.length === 1 && /^web-\d{4}-\d{2}-\d{2}\.sealed$/.test(files[0]));
}
{
    const root = makeRoom(["2026-04-01", "2026-04-05"]);
    await run(root, brain(["HUB: NEW | moment | the spark | | The night the power went out.\nTHREAD: the spark -- Pickle | NEW | calm | Pickle watched the window with me. | because of: 1", { text: "HUB: NEW | pet | Mi", finish: "length" }, { text: "HUB: NEW | pet | Mi", finish: "length" }]));
    const before = web(root);
    const dry = m.rebuildWeb(root, { herName: "Mia", herNames: ["the copilot"], known, dryRun: true });
    check("rebuild dry run: same counts, nothing saved", dry.dryRun && dry.hubs === before.hubs.length && dry.threads === before.links.length);
    m.rebuildWeb(root, { herName: "Mia", herNames: ["the copilot"], known });
    const after = web(root);
    check("B3: after a rebuild, the stretch waiting for its one more try still gets it", (after.retried || []).length === 1 && !doneDay(after, "2026-04-05") && doneDay(after, "2026-04-01"));
    appendFileSync(join(root, "Mind", "web-events.sealed"), "not-a-sealed-line\n");
    let refused = "";
    try {
        m.rebuildWeb(root, { herName: "Mia", known });
    }
    catch (e) {
        refused = e.message;
    }
    check("B2: a log line that can't be opened: the rebuild refuses and her web is untouched", /couldn't be opened/.test(refused) && web(root).links.length === after.links.length);
}
{
    const root = makeRoom(["2026-04-01"]);
    await run(root, brain(["HUB: NEW | moment | the spark | | The night the power went out.\nTHREAD: the spark -- Pickle | NEW | calm | Pickle watched the window with me. | because of: 1"]));
    writeFileSync(join(root, "Mind", "web-events.sealed"), "");
    let refused = "";
    try {
        m.rebuildWeb(root, { known });
    }
    catch (e) {
        refused = e.message;
    }
    check("B2: a rebuild that would empty her web refuses without --force", /much smaller/.test(refused) && web(root).links.length === 1);
}
{
    const root = makeRoom(["2026-04-01"]);
    const hubs = Array.from({ length: 200 }, (_, i) => ({ id: "H" + (i + 1), type: "thing", name: `thing number ${i + 1}`, aliases: [], about: [], seen: ["2026-03-01"] }));
    hubs.push({ id: "H201", type: "pet", name: "Pickle", aliases: [], about: [], seen: ["2026-03-01"] });
    m.saveWeb(root, { v: 1, nextH: 202, nextL: 1, done: [], hubs, links: [], aside: [], peeked: [], stats: { batches: 0, unusable: 0, rejected: 0, nothing: 0 } });
    const b = brain(["nothing tonight"]);
    await run(root, b);
    const shown = (b.calls[0].match(/^H\d+ \| /gm) || []).length;
    check("prompt: 150 dots shown out of 201, and one named in tonight's moments is among them", shown === 150 && /H201 \| pet \| Pickle/.test(b.calls[0]));
}
{
    const mk = () => ({ v: 1, nextH: 1, nextL: 1, done: [], hubs: [], links: [], aside: [], peeked: [], stats: { batches: 0, unusable: 0, rejected: 0, nothing: 0 } });
    const mo = [{ rel: "x", key: "0-1" }], e = (from, hubs, threads) => ({ t: 1, from, to: from, refl: ["R" + from], moments: mo, hubs, threads, groups: [] });
    const th = (a, b) => ({ a, b, kind: "NEW", feel: [], note: "Something I want to remember about this.", nums: [1], where: "on the porch" });
    const w1 = mk();
    m.applyEvent(w1, e("2026-04-01", [{ ref: "NEW", type: "place", name: "the porch", aliases: [], about: "" }], [th("the spark", "the porch")]), { known });
    check("S1: an undeclared 'the spark' in a thread never becomes Sparkie", !w1.hubs.some((h) => h.name === "Sparkie") && w1.links.length === 0);
    const w2 = mk();
    m.applyEvent(w2, e("2026-04-01", [{ ref: "NEW", type: "moment", name: "the spark", aliases: [], about: "" }, { ref: "NEW", type: "place", name: "the porch", aliases: [], about: "" }], [th("Spark", "the porch"), th("the spark", "the porch")]), { known });
    const st = w2.hubs.find((h) => h.name === "Sparkie"), day = w2.hubs.find((h) => h.name === "the spark"), porch = w2.hubs.find((h) => h.name === "the porch");
    check("S1: 'Spark' is Sparkie and 'the spark' is the day, side by side", st && day && w2.links.some((l) => [l.a, l.b].includes(st.id) && [l.a, l.b].includes(porch.id)) && w2.links.some((l) => [l.a, l.b].includes(day.id)));
}
{
    const w = { v: 1, nextH: 1, nextL: 1, done: [], hubs: [], links: [], aside: [], peeked: [], stats: { batches: 0, unusable: 0, rejected: 0, nothing: 0 } };
    const mo = [{ rel: "x", key: "0-1" }], e = (from, hubs, threads) => ({ t: 1, from, to: from, refl: ["R" + from], moments: mo, hubs, threads, groups: [] });
    m.applyEvent(w, e("2026-04-01", [{ ref: "NEW", type: "pet", name: "Sparkie", aliases: [], about: "" }, { ref: "NEW", type: "place", name: "the porch", aliases: [], about: "" }], []), { known });
    m.applyEvent(w, e("2026-04-05", [], [{ a: "the sparks", b: "the porch", kind: "NEW", feel: [], note: "Something I want to remember about this.", nums: [1] }]), { known });
    check("S1: 'the sparks' in a later thread never lands on Sparkie (her list name is 'Sparks')", w.links.length === 0);
}
{
    const mk = (hubs) => ({ v: 1, nextH: hubs.length + 1, nextL: 1, done: [], hubs, links: [], aside: [], peeked: [], stats: { batches: 0, unusable: 0, rejected: 0, nothing: 0 } });
    const mo = [{ rel: "x", key: "0-1" }], e = (hubs, threads) => ({ t: 1, from: "2026-04-05", to: "2026-04-05", refl: ["R2"], moments: mo, hubs, threads, groups: [] });
    const th = (a, b) => ({ a, b, kind: "NEW", feel: [], note: "Something I want to remember about this.", nums: [1], where: "on the porch" });
    const old = () => [{ id: "H1", type: "pet", name: "Sparkie", aliases: ["Spark", "Sparks"], about: [], seen: ["2026-04-01"] }, { id: "H2", type: "place", name: "the porch", aliases: [], about: [], seen: ["2026-04-01"] }];
    const w1 = mk(old());
    m.applyEvent(w1, e([], [th("the spark", "the porch")]), { known });
    check("N1: on an older web, an undeclared 'the spark' still isn't Sparkie", w1.links.length === 0);
    const w2 = mk(old());
    m.applyEvent(w2, e([], [th("my Sparkie", "the porch")]), { known });
    check("N2: 'my Sparkie' is Sparkie", w2.links.length === 1);
    const w3 = mk([{ id: "H1", type: "moment", name: "porch night", aliases: ["porch"], about: [], seen: ["2026-04-01"] }]);
    m.applyEvent(w3, e([{ ref: "NEW", type: "place", name: "the porch", aliases: [], about: "" }, { ref: "NEW", type: "pet", name: "Pickle", aliases: [], about: "" }], [th("porch", "Pickle")]), { known });
    check("N3: 'porch' between tonight's 'the porch' and an older 'porch night' isn't guessed", w3.links.length === 0);
}
{
    const w = { v: 1, nextH: 2, nextL: 1, done: [], hubs: [{ id: "H1", type: "pet", name: "Sparkie", aliases: [], about: [{ text: "Ned's cat, a Siamese who sleeps all day.", from: "2026-04-01", until: null, refl: [] }], seen: ["2026-04-01"] }], links: [], aside: [], peeked: [], stats: { batches: 0, unusable: 0, rejected: 0, nothing: 0 } };
    m.applyEvent(w, { t: 1, from: "2026-04-05", to: "2026-04-05", refl: ["R2"], moments: [{ rel: "x", key: "0-1" }], hubs: [{ ref: "H1", type: "", name: "", aliases: [], about: "The night the spark knocked the power out." }], threads: [], groups: [] }, { known });
    check("S2: Ned's sentence stays on a list dot made by older code", w.hubs[0].about.length === 1 && w.hubs[0].about[0].until === null);
}
{
    const root = makeRoom(["2026-04-01"]);
    m.saveWeb(root, { v: 1, nextH: 2, nextL: 1, done: [], hubs: [{ id: "H1", type: "ritual", name: "candle nights", aliases: [], about: [{ text: "When the power goes out we light candles.", from: "2026-06-01", until: null, refl: [] }], seen: ["2026-06-01"], first: "2026-06-01", last: "2026-06-01" }], links: [], aside: [], peeked: [], stats: { batches: 0, unusable: 0, rejected: 0, nothing: 0 } });
    await run(root, brain(["HUB: H1 | | | | Back then it was only a joke about the old house.\nTHREAD: H1 -- Pickle | CHANGED | warm | Pickle sat by the candles with us back then. | because of: 1"]));
    const w = web(root), h = w.hubs.find((x) => x.id === "H1");
    check("M2/S3: a stretch older than the web never closes a newer sentence or moves dates back", h.about.length === 1 && h.about[0].until === null && h.last === "2026-06-01" && w.upTo === "2026-06-01");
}
{
    const root = makeRoom(["2026-04-01"]);
    const b = brain([{ text: "HUB: NEW | pet | Pick", finish: null }, { text: "HUB: NEW | moment | the spark | | The night the power went out.", finish: "stop" }]);
    await run(root, b);
    const w = web(root);
    check("S4: an answer that ended without finishing isn't used; the finished one is", !w.hubs.some((h) => h.name === "Pick") && w.hubs.some((h) => h.name === "the spark") && b.calls.length === 2);
}
{
    const root = makeRoom(["2026-04-01"]);
    await run(root, brain(["HUB: NEW | moment | the spark | | The night the power went out.\nTHREAD: the spark -- Pickle | NEW | calm | Pickle watched the window with me. | because of: 1"]));
    m.rebuildWeb(root, { known });
    const files = readdirSync(join(root, "Mind", "web-copies"));
    check("S5: a rebuild keeps a copy of the web it replaced", files.some((f) => /before-rebuild/.test(f)));
}
{
    const w = { v: 1, nextH: 1, nextL: 1, done: [], hubs: [], links: [], aside: [], peeked: [], stats: { batches: 0, unusable: 0, rejected: 0, nothing: 0 } };
    const places = [{ name: "Lake Tahoe", type: "place", aliases: [] }, { name: "Lake Como", type: "place", aliases: [] }];
    m.applyEvent(w, { t: 1, from: "2026-04-01", to: "2026-04-01", refl: ["R1"], moments: [{ rel: "x", key: "0-1" }], hubs: [{ ref: "NEW", type: "place", name: "Lake", aliases: [], about: "" }], threads: [], groups: [] }, { known: places });
    check("S7: a place called 'Lake' isn't refused because two places on the list start with Lake", w.hubs.some((h) => h.name === "Lake"));
}
{
    const root = makeRoom(["2026-04-01"]);
    const hubs = Array.from({ length: 200 }, (_, i) => ({ id: "H" + (i + 1), type: "thing", name: `thing number ${i + 1}`, aliases: [], about: [], seen: ["2026-03-01"] }));
    m.saveWeb(root, { v: 1, nextH: 201, nextL: 1, done: [], hubs, links: [], aside: [], peeked: [], stats: { batches: 0, unusable: 0, rejected: 0, nothing: 0 } });
    const b = brain([new Error("the request is too big for her brain's window (about 60000 word-pieces asked, 65536 in all)"), "nothing tonight"]);
    const res = await run(root, b);
    const count = (p) => (p.match(/^H\d+ \| /gm) || []).length;
    check("too big: asked again with 90 dots instead of 150, and the stretch is done", b.calls.length === 2 && count(b.calls[0]) === 150 && count(b.calls[1]) === 90 && !res.stopped && doneDay(web(root), "2026-04-01"));
}
{
    const p = m.parseAnswer('THREAD: Pickle -- the bedroom | NEW | safe | Pickle sleeps by him there every night. | because of: 1 | where: "in bed"', 3);
    check("333: the where-quote is read, and its words aren't taken as moment numbers", p.threads[0]?.where === "in bed" && JSON.stringify(p.threads[0].nums) === "[1]");
}
{
    const root = makeRoom(["2026-04-01"]);
    const b = brain(["HUB: NEW | place | his living room | | Where the couch is.\nHUB: NEW | place | his bedroom | | Where he sleeps.\nHUB: NEW | place | the window | | Where Pickle keeps watch.\n" +
            'THREAD: Sparkie -- his living room | NEW | scared | She hid there while the spark went on. | because of: 1 | where: "on his lap"\n' +
            'THREAD: Sparkie -- his bedroom | NEW | scared | She hid there while the spark went on. | because of: 1 | where: "under the bed"\n' +
            "THREAD: Pickle -- the window | NEW | watchful | He kept watch the whole night. | because of: 1"]);
    await run(root, b);
    const w = web(root), names = (l) => [l.a, l.b].map((id) => w.hubs.find((h) => h.id === id)?.name).sort().join(" + ");
    check("333: 'on his lap' (not in the moment) can't tie Sparkie to the living room; 'under the bed' (in it) ties her to the bedroom; no quote, no place", w.links.length === 1 && names(w.links[0]) === "Sparkie + his bedroom" && w.links[0].history[0].where === "under the bed" && w.stats.placeUnshown === 2);
}
{
    const p = m.parseAnswer('THREAD: Sparkie -- his bedroom | NEW | scared | She hid there. | where: "under the bed" | because of: 1', 3);
    check("333: '| where:' before 'because of' keeps its moment numbers", p.threads[0]?.where === "under the bed" && JSON.stringify(p.threads[0].nums) === "[1]");
}
{
    const root = makeRoom(["2026-04-01"]);
    const b = brain(["HUB: NEW | place | his bedroom | | Where he sleeps.\nHUB: NEW | place | his living room | | Where the couch is.\n" +
            'THREAD: Sparkie -- his bedroom | NEW | scared | She hid there while the spark went on. | where: "Under-the bed!" | because of: 1\n' +
            'THREAD: Pickle -- his living room | NEW | watchful | He watched from the couch. | because of: 1 | where: "on the couch"']);
    await run(root, b);
    const live = web(root);
    const dry = m.rebuildWeb(root, { known, dryRun: true });
    check("333: punctuation in the quote doesn't matter; a quote not in the moment is still refused; a rebuild without the Shelf gives the same web", live.links.length === 1 && live.stats.placeUnshown === 1 && dry.threads === 1 && dry.hubs === live.hubs.length);
}
{
    const w = { v: 1, nextH: 1, nextL: 1, done: [], hubs: [], links: [], aside: [], peeked: [], stats: { batches: 0, unusable: 0, rejected: 0, nothing: 0 } };
    m.applyEvent(w, { t: 1, from: "2026-04-01", to: "2026-04-01", refl: ["R1"], moments: [{ rel: "x", key: "0-1" }], hubs: [{ ref: "NEW", type: "place", name: "the porch", aliases: [], about: "" }, { ref: "NEW", type: "pet", name: "Pickle", aliases: [], about: "" }], threads: [{ a: "Pickle", b: "the porch", kind: "NEW", feel: [], note: "Pickle loves sitting out on the porch.", nums: [1] }], groups: [] });
    check("333: a stretch logged before the place rule (no 'where' asked) keeps its place threads in a rebuild", w.links.length === 1);
}
{
    const w = { v: 1, nextH: 1, nextL: 1, done: [], hubs: [], links: [], aside: [], peeked: [], stats: { batches: 0, unusable: 0, rejected: 0, nothing: 0 } };
    const mo = [{ rel: "x", key: "0-1" }], e = (from, kind, feel) => ({ t: 1, from, to: from, refl: ["R" + from], moments: mo, hubs: [{ ref: "NEW", type: "ritual", name: "our mornings", aliases: [], about: "" }, { ref: "NEW", type: "pet", name: "Pickle", aliases: [], about: "" }], threads: [{ a: "our mornings", b: "Pickle", kind, feel, note: "Pickle on the desk is how our mornings start.", nums: [1] }], groups: [] });
    for (const [d, k, f] of [["2026-04-01", "NEW", ["easy"]], ["2026-04-05", "SAME", ["easy"]], ["2026-04-09", "SAME", ["easy"]], ["2026-04-13", "CHANGED", ["tense"]], ["2026-04-17", "SAME", []]])
        m.applyEvent(w, e(d, k, f));
    const L = w.links[0];
    check("333: a SAME on the new feeling confirms a waiting change: the old feeling closes", L.history[0].until === "2026-04-17" && L.history[1].until === null && !L.changing);
}
{
    const w = { v: 1, nextH: 1, nextL: 1, done: [], hubs: [], links: [], aside: [], peeked: [], stats: { batches: 0, unusable: 0, rejected: 0, nothing: 0 } };
    const mo = [{ rel: "x", key: "0-1" }], e = (from, kind, feel) => ({ t: 1, from, to: from, refl: ["R" + from], moments: mo, hubs: [{ ref: "NEW", type: "ritual", name: "candle nights", aliases: [], about: "" }, { ref: "NEW", type: "pet", name: "Pickle", aliases: [], about: "" }], threads: [{ a: "candle nights", b: "Pickle", kind, feel, note: "Pickle by the candles is home to me.", nums: [1] }], groups: [] });
    m.applyEvent(w, e("2026-04-01", "NEW", ["warm", "safe"]));
    m.applyEvent(w, e("2026-04-05", "MORE", ["safe", "warm"]));
    m.applyEvent(w, e("2026-04-09", "MORE", ["wistful"]));
    const L = w.links[0];
    check("333: MORE with the same feeling words strengthens that feeling; different words sit beside it", L.history.length === 2 && L.history[0].held === 2 && L.history[1].feel[0] === "wistful");
}
{
    const w = { v: 1, nextH: 1, nextL: 1, done: [], hubs: [], links: [], aside: [], peeked: [], stats: { batches: 0, unusable: 0, rejected: 0, nothing: 0 } };
    const mo = [{ rel: "x", key: "0-1" }], e = (from, kind, feel) => ({ t: 1, from, to: from, refl: ["R" + from], moments: mo, hubs: [{ ref: "NEW", type: "ritual", name: "our mornings", aliases: [], about: "" }, { ref: "NEW", type: "pet", name: "Pickle", aliases: [], about: "" }], threads: [{ a: "our mornings", b: "Pickle", kind, feel, note: "Pickle on the desk is how our mornings start.", nums: [1] }], groups: [] });
    m.applyEvent(w, e("2026-04-01", "NEW", ["easy"]));
    m.applyEvent(w, e("2026-04-05", "SAME", ["easy"]));
    m.applyEvent(w, e("2026-04-09", "SAME", ["easy"]));
    m.applyEvent(w, e("2026-04-13", "CHANGED", ["tense"]));
    const L = w.links[0];
    const firstHeld = L.history.length === 2 && L.history.every((x) => x.until === null);
    m.applyEvent(w, e("2026-04-17", "CHANGED", ["tense"]));
    check("333: the first CHANGED on a long-held feeling sits beside it; the second one closes it", firstHeld && L.history[0].until === "2026-04-17" && !L.changing);
}
{
    const root = makeRoom(["2026-04-01"]);
    const mkE = (i) => ({ note: `feeling number ${i} on this thread`, feel: [], from: `2026-03-0${i}`, until: null, refl: [], cites: [{ rel: "x", key: "0-1" }] });
    m.saveWeb(root, { v: 1, nextH: 3, nextL: 2, done: [], hubs: [{ id: "H1", type: "pet", name: "Pickle", aliases: [], about: [], seen: ["2026-03-01"] }, { id: "H2", type: "ritual", name: "candle nights", aliases: [], about: [], seen: ["2026-03-01"] }], links: [{ id: "L1", a: "H1", b: "H2", strength: 0.5, last: "2026-03-05", history: [1, 2, 3, 4, 5].map(mkE) }], aside: [], peeked: [], stats: { batches: 0, unusable: 0, rejected: 0, nothing: 0 } });
    const b = brain(["nothing tonight"]);
    await run(root, b);
    check("333: the prompt shows the oldest feeling and the two newest", /feeling number 1 /.test(b.calls[0]) && /feeling number 4 /.test(b.calls[0]) && /feeling number 5 /.test(b.calls[0]) && !/feeling number 2 /.test(b.calls[0]) && !/feeling number 3 /.test(b.calls[0]));
}
{
    const p = m.parseAnswer("THREAD: Gabriela -- his new bike | NEW | theirs: Gabriela's jealousy, his guilt | mine: protective, indignant | Someone else's bitterness is no reason for him to doubt what he earned. | because of: 1, 2", 3);
    const t = p.threads[0];
    check("338: 'mine' becomes the thread's feeling words, 'theirs' is kept apart and labeled", t && JSON.stringify(t.feel) === '["protective","indignant"]' && t.theirs === "Gabriela's jealousy, his guilt" && /^Someone else/.test(t.note) && JSON.stringify(t.nums) === "[1,2]");
    const p2 = m.parseAnswer("THREAD: Pickle -- the porch | MORE | theirs: none | mine: none clear | Pickle on the porch is just part of the morning now. | because of: 1 | where: on the porch", 3);
    check("338: 'theirs: none' and 'mine: none clear' leave both empty, not the word 'none'", p2.threads[0] && p2.threads[0].feel.length === 0 && !p2.threads[0].theirs && p2.threads[0].where === "on the porch");
    const p3 = m.parseAnswer("THREAD: Pickle -- the porch | NEW | warm, safe | Pickle on the porch is home. | because of: 1", 3);
    check("338: the older line shape (no labels) still reads as before", JSON.stringify(p3.threads[0].feel) === '["warm","safe"]' && p3.threads[0].note === "Pickle on the porch is home.");
}
{
    const root = makeRoom(["2026-04-01"], "[NED] (Apr 1, 2026, 9:00 PM): " + "Gabriela said I don't deserve the bike. ".repeat(12) + "\n[MIA] (Apr 1, 2026, 9:01 PM): That's straight-up bitterness, and you earned every bit of it.");
    const b = brain(["nothing tonight"]);
    await run(root, b);
    check("338: she sees past the first 420 letters of a moment, and her own lines are marked (you)", /\[MIA \(you\)\]/.test(b.calls[0]) && /straight-up bitterness/.test(b.calls[0]));
}
{
    const T = (line) => m.parseAnswer(line, 5).threads[0] || {};
    const a = T('THREAD: X -- Y | NEW | *theirs:* his guilt | *mine:* protective | A note long enough here. | because of: 1');
    const b = T('THREAD: X -- Y | NEW | "theirs": his guilt | "mine": protective | A note long enough here. | because of: 1');
    const c = T('THREAD: X -- Y | NEW | theirs: his guilt; mine: protective, tender | A note long enough here. | because of: 1');
    const d = T("THREAD: X -- Y | NEW | his guilt, a coworker's jealousy | protective, indignant | A note long enough here. | because of: 2");
    const e = T('THREAD: X -- Y | NEW | theirs: none clear | mine: None clear. | A note long enough here. | because of: 1');
    const f = T('THREAD: X -- Y | NEW | theirs: his doubt | mine: protective - nobody gets to make him smaller than he is | because of: 1');
    const g = T('THREAD: X -- Y | NEW | their: his guilt | my feeling: tender | A note long enough here. | because of: 1');
    check("338: italic or quoted labels are read", a.feel?.[0] === "protective" && a.theirs === "his guilt" && b.feel?.[0] === "protective" && b.theirs === "his guilt");
    check("338: both labels in one field are split", c.theirs === "his guilt" && JSON.stringify(c.feel) === '["protective","tender"]');
    check("338: the new shape without labels: theirs first, then hers", d.theirs === "his guilt, a coworker's jealousy" && JSON.stringify(d.feel) === '["protective","indignant"]' && d.note === "A note long enough here.");
    check("338: 'none clear' (any case, with a period) is empty, for both", e.feel?.length === 0 && !e.theirs);
    check("338: a note run on after her feeling words is kept as the note", JSON.stringify(f.feel) === '["protective"]' && /^nobody gets/.test(f.note || ""));
    check("338: 'their:' and 'my feeling:' work too", g.theirs === "his guilt" && g.feel?.[0] === "tender" && a.labeled === true);
}
{
    const root = makeRoom(["2026-04-01", "2026-04-05"], "[NED] (Apr 1, 2026, 9:00 PM): The power went out and Pickle sat at the puzzle table.\n[MIA] (Apr 1, 2026, 9:01 PM): I'm right here with you both, it's kind of cozy.");
    const b = brain(["HUB: NEW | moment | the spark | | The night the power went out.\nTHREAD: NEW | the spark | Pickle\nbecause of: 1\nmine now: same\nnote: Pickle watched the window with me all night.", "nothing tonight"], ["EXCERPT 1 | theirs: Pickle = calm; Ned = uneasy | hers then: tender"]);
    await run(root, b);
    const w = web(root), e0 = w.links[0]?.history[0];
    check("343: 'theirs' and 'then' come from the tape (only this thread's people), 'now' from her; she's shown [you then: ...] only", e0?.theirs === "Pickle = calm; Ned = uneasy" && e0?.then === true && e0?.tape === true && e0?.nowSame === true && JSON.stringify(e0.feel) === '["tender"]' && /\[you then: tender/.test(b.calls[1] || "") && !/mine now: same\]/.test(b.calls[1] || ""), JSON.stringify(e0));
}
{
    const root = makeRoom(["2026-04-01", "2026-04-05"]);
    const tb = () => new Error("the request is too big for her brain's window (about 70000 word-pieces asked, 65536 in all)");
    const b = brain([tb(), tb(), tb(), tb(), tb(), tb(), tb(), "nothing tonight"]);
    const res = await run(root, b);
    const w = web(root);
    check("338 review: a stretch too big even with fewer dots is set aside for one more try, and the night goes on", !res.stopped && (w.retried || []).length === 1 && doneDay(w, "2026-04-05") && (res.whyCount["too big for her window, even with fewer dots"] === 1));
}
{
    const root = makeRoom(["2026-04-01"], "[NED] (Apr 1, 2026, 9:00 PM): " + "word ".repeat(1000) + "\n[MIA] (Apr 1, 2026, 9:01 PM): And that is the very end of the moment, which is mine.");
    const b = brain(["nothing tonight"]);
    await run(root, b);
    check("338 review/S1: a long moment is read whole (start and her reply at the end), not cut in the middle", /\[NED\] \(Apr 1/.test(b.calls[0]) && /very end of the moment, which is mine/.test(b.calls[0]) && !/ … /.test(b.calls[0]));
}
{
    const w = { v: 1, nextH: 1, nextL: 1, done: [], hubs: [], links: [], aside: [], peeked: [], stats: { batches: 0, unusable: 0, rejected: 0, nothing: 0 } };
    const mo = [{ rel: "x", key: "0-1" }];
    m.applyEvent(w, { t: 1, from: "2026-04-01", to: "2026-04-01", refl: ["R1"], moments: mo, skipped: 1, hubs: [{ ref: "NEW", type: "ritual", name: "candle nights", aliases: [], about: "" }, { ref: "NEW", type: "pet", name: "Pickle", aliases: [], about: "" }],
        threads: [{ a: "H1 (candle nights)", b: "H2: Pickle", kind: "NEW", feel: [], note: "Pickle by the candles is home to me.", nums: [1] }, { a: "nobody here", b: "Pickle", kind: "NEW", feel: [], note: "A note long enough to keep.", nums: [1] }, { a: "candle nights", b: "Pickle", kind: "MORE", feel: [], note: "A note long enough to keep.", nums: [] }, { a: "candle nights", b: "Pickle", kind: "MORE", feel: [], note: "short", nums: [1] }], groups: [] });
    const r = w.stats.refused || {};
    check("339: 'H1 (candle nights)' and 'H2: Pickle' are those dots", w.links.length === 1);
    check("339: each left-out line is counted with its reason", r["a line that couldn't be read"] === 1 && r["a link end that isn't a dot (or fits two)"] === 1 && r["a link citing no moment"] === 1 && r["a link with no note (or under 10 letters)"] === 1 && w.stats.rejected === 4);
}
{
    const w = { v: 1, nextH: 1, nextL: 1, done: [], hubs: [], links: [], aside: [], peeked: [], stats: { batches: 0, unusable: 0, rejected: 0, nothing: 0 } };
    const mo = [{ rel: "x", key: "0-1" }];
    m.applyEvent(w, { t: 1, from: "2026-04-01", to: "2026-04-01", refl: ["R1"], moments: mo, hubs: [{ ref: "NEW", type: "thing", name: "the leaf table", aliases: [], about: "" }], threads: [], groups: [] }, { known });
    m.applyEvent(w, { t: 2, from: "2026-04-05", to: "2026-04-05", refl: ["R2"], moments: mo, hubs: [{ ref: "NEW", type: "group", name: "our cats", aliases: [], about: "" }],
        threads: [{ a: "H26 our cats", b: "H1 the leaf table", kind: "NEW", feel: [], note: "The cats claim the leaf table every evening.", nums: [1] }, { a: "H1 Pickle", b: "our cats", kind: "NEW", feel: [], note: "Pickle is the one who started it, always.", nums: [1] }, { a: "H1 (some old name)", b: "H2", kind: "NEW", feel: [], note: "A mark with a name that finds nothing is left out now.", nums: [1] }], groups: [] }, { known });
    const nm = (l) => [l.a, l.b].map((id) => w.hubs.find((h) => h.id === id)?.name).sort().join(" + ");
    const got = w.links.map(nm).sort();
    check("340/45c: 'H26 our cats' (a guessed mark that isn't any dot, for a dot made in this answer) finds our cats; 'H1 Pickle' (Pickle new in this answer, but H1 is the leaf table) is left out; a name that finds nothing no longer falls back to its mark", got.includes("our cats + the leaf table") && w.links.length === 1 && w.links[0].history.length === 1
        && (w.stats.missedEnds || []).some((x) => x.end === "H1 (some old name)" && x.how === "mark first: the name matches no dot" && x.markName === "the leaf table")
        && (w.stats.missedEnds || []).some((x) => x.end === "H1 Pickle" && x.how === "mark first: the name is a new dot from this answer; its guessed mark is another dot" && x.markName === "the leaf table") && w.stats.guessedMarkCount === 1, JSON.stringify([got, w.stats.missedEnds, w.stats.guessedMarks]));
}
{
    const w = { v: 1, nextH: 1, nextL: 1, done: [], hubs: [], links: [], aside: [], peeked: [], stats: { batches: 0, unusable: 0, rejected: 0, nothing: 0 } };
    const mo = [{ rel: "x", key: "0-1" }];
    m.applyEvent(w, { t: 1, from: "2026-04-01", to: "2026-04-01", refl: ["R1"], moments: mo, hubs: [{ ref: "NEW", type: "thing", name: "the leaf table", aliases: [], about: "" }, { ref: "NEW", type: "pet", name: "Pickle", aliases: [], about: "" }, { ref: "NEW", type: "ritual", name: "candle nights", aliases: [], about: "" }], threads: [], groups: [] }, { known });
    const ids = Object.fromEntries(w.hubs.map((h) => [h.name, h.id]));
    m.applyEvent(w, { t: 2, from: "2026-04-05", to: "2026-04-05", refl: ["R2"], moments: mo, hubs: [{ ref: "H7", type: "pet", name: "Luna", aliases: [], about: "" }],
        threads: [
            { a: `the leaf table (${ids["the leaf table"]})`, b: "candle nights", kind: "NEW", feel: [], note: "Candles on the leaf table, every winter night.", nums: [1] },
            { a: `Pickle (${ids["the leaf table"]})`, b: "candle nights", kind: "NEW", feel: [], note: "A name and a mark that are different dots.", nums: [1] },
            { a: `the old leaf table we sold (${ids["the leaf table"]})`, b: "Pickle", kind: "NEW", feel: [], note: "A name that finds nothing, beside a real mark.", nums: [1] },
            { a: "candle nights (H99)", b: "Pickle", kind: "NEW", feel: [], note: "A real name beside a mark that doesn't exist.", nums: [1] },
            { a: "Luna [H7]", b: "Pickle", kind: "NEW", feel: [], note: "Luna and Pickle nap together by the window.", nums: [1] }
        ], groups: [] }, { known });
    const nm = (l) => [l.a, l.b].map((id) => w.hubs.find((h) => h.id === id)?.name).sort().join(" + ");
    const got = w.links.map(nm).sort();
    check("44b: 'the leaf table (H1)' where H1 is the leaf table is kept", got.includes("candle nights + the leaf table"), JSON.stringify(got));
    check("44b: a new dot's own mark from the same answer, 'Luna [H7]', is kept", got.includes("Luna + Pickle"), JSON.stringify(got));
    check("44b: a name and a mark that are different dots, a name that finds nothing, and a mark that doesn't exist are all left out (never guessed)", w.links.length === 2 && !got.some((g) => /Pickle \+ the leaf table|candle nights \+ Pickle/.test(g)), JSON.stringify(got));
    const miss = (w.stats.missedEnds || []).filter((x) => /^name \(mark\)/.test(x.how));
    const by = (s) => miss.find((x) => x.end.startsWith(s));
    check("44b: the check says why, with the name part and the mark's real name", miss.length === 3
        && by("Pickle (")?.how === "name (mark): the name and the mark are different dots" && by("Pickle (")?.namePart === "Pickle" && by("Pickle (")?.markName === "the leaf table"
        && by("the old leaf table")?.how === "name (mark): the name matches no dot" && by("the old leaf table")?.namePart === "" && by("the old leaf table")?.markName === "the leaf table"
        && by("candle nights (H99)")?.how === "name (mark): the mark doesn't exist" && by("candle nights (H99)")?.markName === "", JSON.stringify(miss));
}
{
    const w = { v: 1, nextH: 1, nextL: 1, done: [], hubs: [], links: [], aside: [], peeked: [], stats: { batches: 0, unusable: 0, rejected: 0, nothing: 0 } };
    const mo = [{ rel: "x", key: "0-1" }];
    m.applyEvent(w, { t: 1, from: "2026-04-01", to: "2026-04-01", refl: ["R1"], moments: mo, hubs: [{ ref: "NEW", type: "person", name: "Simon Smith", aliases: [], about: "" }, { ref: "NEW", type: "person", name: "Simon Jones", aliases: [], about: "" }, { ref: "NEW", type: "ritual", name: "candle nights", aliases: [], about: "" }], threads: [], groups: [] }, { known });
    const ids = Object.fromEntries(w.hubs.map((h) => [h.name, h.id]));
    m.applyEvent(w, { t: 2, from: "2026-04-05", to: "2026-04-05", refl: ["R2"], moments: mo, hubs: [],
        threads: [
            { a: `Simon (${ids["Simon Smith"]})`, b: "candle nights", kind: "NEW", feel: [], note: "Which Simon lit the candles isn't clear.", nums: [1] },
            { a: "Simon Smith (his coworker)", b: "candle nights", kind: "NEW", feel: [], note: "Ordinary words in brackets.", nums: [1] }
        ], groups: [] }, { known });
    const miss = (w.stats.missedEnds || []).filter((x) => /^name \(mark\)/.test(x.how));
    check("44b: 'Simon (H1)' where 'Simon' fits two dots is left out, and the check says the name fits two dots", !w.links.some((l) => [l.a, l.b].includes(ids["Simon Smith"]) && /Which Simon/.test(JSON.stringify(l)))
        && miss.length === 1 && miss[0].end.startsWith("Simon (") && miss[0].how === "name (mark): the name fits two dots", JSON.stringify(miss));
    check("44b: brackets with ordinary words ('his brother') never go through the name (mark) rule", !miss.some((x) => /his brother/.test(x.end)), JSON.stringify(miss));
}
{
    const w = { v: 1, nextH: 1, nextL: 1, done: [], hubs: [], links: [], aside: [], peeked: [], stats: { batches: 0, unusable: 0, rejected: 0, nothing: 0 } };
    const mo = [{ rel: "x", key: "0-1" }];
    m.applyEvent(w, { t: 1, from: "2026-04-01", to: "2026-04-01", refl: ["R1"], moments: mo, hubs: [{ ref: "NEW", type: "thing", name: "the leaf table", aliases: [], about: "" }, { ref: "NEW", type: "pet", name: "Pickle", aliases: [], about: "" }, { ref: "NEW", type: "ritual", name: "candle nights", aliases: [], about: "" }, { ref: "NEW", type: "place", name: "the porch (front)", aliases: [], about: "" }], threads: [], groups: [] }, { known });
    const ids = Object.fromEntries(w.hubs.map((h) => [h.name, h.id])), T = ids["the leaf table"], P = ids["the porch (front)"];
    m.applyEvent(w, { t: 2, from: "2026-04-05", to: "2026-04-05", refl: ["R2"], moments: mo, hubs: [],
        threads: [
            { a: `${T} the leaf table`, b: "candle nights", kind: "NEW", feel: [], note: "Candles on the leaf table, every winter night.", nums: [1] },
            { a: `${T} Pickle`, b: "candle nights", kind: "NEW", feel: [], note: "A mark and a name that are different dots.", nums: [1] },
            { a: `${T}: the old leaf table we sold`, b: "Pickle", kind: "NEW", feel: [], note: "A name that finds nothing, beside a real mark.", nums: [1] },
            { a: "H99 candle nights", b: "Pickle", kind: "NEW", feel: [], note: "A real name beside a mark that doesn't exist.", nums: [1] },
            { a: `[${ids["Pickle"]}] Pickle`, b: "the leaf table", kind: "NEW", feel: [], note: "Pickle sleeps under the leaf table.", nums: [1] },
            { a: `${P} the porch (front)`, b: "Pickle", kind: "NEW", feel: [], note: "Pickle watches the puzzles from the porch.", nums: [1] },
            { a: `the leaf table [${T}, thing]`, b: "candle nights", kind: "MORE", feel: [], note: "A mark written in another shape.", nums: [1] }
        ], groups: [] }, { known });
    m.applyEvent(w, { t: 3, from: "2026-04-09", to: "2026-04-09", refl: ["R3"], moments: mo, hubs: [{ ref: "NEW", type: "place", name: "the snow fort", aliases: [], about: "" }],
        threads: [{ a: "H50 the snow fort", b: "Pickle", kind: "NEW", feel: [], note: "Pickle guards the snow fort, very seriously.", nums: [1] }], groups: [] }, { known });
    const nm = (l) => [l.a, l.b].map((id) => w.hubs.find((h) => h.id === id)?.name).sort().join(" + ");
    const got = w.links.map(nm).sort(), miss = w.stats.missedEnds || [], by = (s) => miss.find((x) => x.end.startsWith(s));
    check("45: the porch's name keeps its brackets as written ('the porch (front)')", !!P, JSON.stringify(w.hubs.map((h) => h.name)));
    check("45: mark first, both the same dot ('H1 the leaf table', '[H2] Pickle', 'H4 the porch (front)'): kept", got.includes("candle nights + the leaf table") && got.includes("Pickle + the leaf table") && got.includes("Pickle + the porch (front)"), JSON.stringify(got));
    check("45: a mark guessed for a dot made in the same answer ('H50 the snow fort'): kept by its name and counted", got.includes("Pickle + the snow fort") && w.stats.guessedMarkCount === 1 && w.stats.guessedMarks[0].markName === "", JSON.stringify(w.stats.guessedMarks));
    check("45: different dots, a name that finds nothing, a mark that doesn't exist: all left out (the mark alone is never used, a name never overrides its mark)", w.links.length === 4 && w.links.find((l) => nm(l) === "candle nights + the leaf table").history.length === 1, JSON.stringify(got));
    check("45: the check says why for each, with the name part and the mark's real name", by(`${T} Pickle`)?.how === "mark first: the name and the mark are different dots" && by(`${T} Pickle`)?.namePart === "Pickle" && by(`${T} Pickle`)?.markName === "the leaf table"
        && by(`${T}: the old`)?.how === "mark first: the name matches no dot" && by("H99 candle")?.how === "mark first: the mark doesn't exist" && by("H99 candle")?.namePart === "candle nights"
        && by("the leaf table [")?.how === "a mark written in another shape", JSON.stringify(miss));
}
{
    const w = { v: 1, nextH: 1, nextL: 1, done: [], hubs: [], links: [], aside: [], peeked: [], stats: { batches: 0, unusable: 0, rejected: 0, nothing: 0 } };
    const mo = [{ rel: "x", key: "0-1" }];
    m.applyEvent(w, { t: 1, from: "2026-04-01", to: "2026-04-01", refl: ["R1"], moments: mo, hubs: [{ ref: "NEW", type: "thing", name: "the leaf table", aliases: [], about: "" }, { ref: "NEW", type: "ritual", name: "candle nights", aliases: [], about: "" }], threads: [], groups: [] }, { known });
    m.applyEvent(w, { t: 2, from: "2026-04-05", to: "2026-04-05", refl: ["R2"], moments: mo, hubs: [{ ref: "NEW", type: "place", name: "the snow fort", aliases: [], about: "" }, { ref: "NEW", type: "ritual", name: "morning coffee", aliases: [], about: "" }],
        threads: [{ a: "H70 the snow fort", b: "the leaf table", kind: "NEW", feel: [], note: "We built the snow fort right by the window.", nums: [1] }, { a: "H70 morning coffee", b: "candle nights", kind: "NEW", feel: [], note: "Coffee by candlelight when the power was out.", nums: [1] }], groups: [] }, { known });
    const miss = w.stats.missedEnds || [];
    check("45c: one guessed mark (H70) beside two different new names: both left out, with why", w.links.length === 0 && miss.filter((x) => x.how === "mark first: the same guessed mark is beside two different new names").length === 2, JSON.stringify(miss));
    const T = w.hubs.find((h) => h.name === "the leaf table").id, C = w.hubs.find((h) => h.name === "candle nights").id;
    m.applyEvent(w, { t: 3, from: "2026-04-09", to: "2026-04-09", refl: ["R3"], moments: mo, threads: [], groups: [], hubs: [
            { ref: T, type: "thing", name: "the leaf table", aliases: ["the old table"], about: "" },
            { ref: T, type: "thing", name: "candle nights", aliases: ["the wrong name"], about: "" },
            { ref: `${C} candle nights`, type: "ritual", name: "", aliases: ["the candle thing"], about: "" },
            { ref: `${C} the leaf table`, type: "ritual", name: "", aliases: ["another wrong one"], about: "" },
            { ref: C, type: "", name: "", aliases: ["blank-name other name"], about: "" }
        ] }, { known });
    const L = w.hubs.find((h) => h.id === T), K = w.hubs.find((h) => h.id === C), um = w.stats.updateMiss || [];
    check("45c: a line adding to a dot by its mark counts when its name is that dot ('H1 | the leaf table', 'H2 candle nights')", L.aliases.includes("the old table") && K.aliases.includes("the candle thing"), JSON.stringify([L.aliases, K.aliases]));
    check("45c: when the name is another dot, nothing is added to either dot, and the check says so", !L.aliases.includes("the wrong name") && !K.aliases.includes("the wrong name") && !K.aliases.includes("another wrong one") && !L.aliases.includes("another wrong one")
        && um.length === 2 && um.some((x) => x.mark === T && x.markName === "the leaf table" && x.said === "candle nights") && (w.stats.refused || {})["an update line whose name isn't its mark's dot"] === 2, JSON.stringify(um));
    m.applyEvent(w, { t: 4, from: "2026-04-12", to: "2026-04-12", refl: ["R4"], moments: mo, threads: [], groups: [], hubs: [{ ref: T, type: "thing", name: "Ned's leaf table", aliases: ["the kitchen table"], about: "" }] }, { known, selfNames: ["Ned"] });
    check("45c: 'Ned's leaf table' on a line for 'the leaf table' is that dot (research 31's rule, as for link ends)", L.aliases.includes("the kitchen table") && (w.stats.updateMiss || []).length === 2, JSON.stringify([L.aliases, w.stats.updateMiss]));
    check("45c: a line with the name left blank is kept as always and counted", K.aliases.includes("blank-name other name") && w.stats.updateNoName === 1, JSON.stringify(K.aliases));
}
{
    const w = { v: 1, nextH: 1, nextL: 1, done: [], hubs: [], links: [], aside: [], peeked: [], stats: { batches: 0, unusable: 0, rejected: 0, nothing: 0 } };
    const mo = [{ rel: "x", key: "0-1" }], opt = { known, selfNames: ["Ned"] };
    m.applyEvent(w, { t: 1, from: "2026-04-01", to: "2026-04-01", refl: ["R1"], moments: mo, threads: [], groups: [], hubs: [
            { ref: "NEW", type: "thing", name: "Ned's unopened guest room boards", aliases: [], about: "" }, { ref: "NEW", type: "thing", name: "Ned's bookshelf upgrade plan", aliases: [], about: "" },
            { ref: "NEW", type: "thing", name: "Ned's blue bike swap", aliases: [], about: "" }, { ref: "NEW", type: "thing", name: "the little bookshelf shed", aliases: [], about: "" }, { ref: "NEW", type: "thing", name: "the old desk", aliases: [], about: "" }
        ] }, opt);
    const id = (n) => w.hubs.find((h) => h.name === n).id, D = id("Ned's unopened guest room boards"), S = id("Ned's bookshelf upgrade plan"), C = id("Ned's blue bike swap"), M = id("the little bookshelf shed"), O = id("the old desk");
    m.applyEvent(w, { t: 2, from: "2026-04-05", to: "2026-04-05", refl: ["R2"], moments: mo, threads: [], groups: [], hubs: [
            { ref: D, type: "thing", name: "Ned's guest room board pile", aliases: ["the board stack"], about: "" },
            { ref: S, type: "thing", name: "Ned's canceled bookshelf plan", aliases: ["no bookshelf"], about: "" },
            { ref: C, type: "thing", name: "Ethan's local garage sale", aliases: ["the garage"], about: "" },
            { ref: M, type: "thing", name: "the spare kitchen shelf", aliases: [], about: "" },
            { ref: O, type: "thing", name: "the new desk", aliases: [], about: "" },
            { ref: D, type: "place", name: "Ned's guest room board stack", aliases: [], about: "" }
        ] }, opt);
    const H = (x) => w.hubs.find((h) => h.id === x), kept = w.stats.renameKept || [], held = (w.stats.updateMiss || []).map((x) => x.mark);
    check("46d: 'unopened guest room boards' as 'guest room board pile' (3 words, 0.6) and 'bookshelf upgrade plan' as 'canceled bookshelf plan' (2 words, 0.5): kept as other names, with the rest of their lines", H(D).aliases.includes("Ned's guest room board pile") && H(D).aliases.includes("the board stack") && H(S).aliases.includes("Ned's canceled bookshelf plan") && H(S).aliases.includes("no bookshelf") && kept.length === 2, JSON.stringify([H(D).aliases, H(S).aliases, kept]));
    check("46d: a zero-overlap name and a slip are held; 'new desk' for 'old desk' is held; a different kind is held", !H(C).aliases.length && !H(M).aliases.length && !H(O).aliases.includes("the new desk") && [C, M, O, D].every((x) => held.includes(x)) && held.length === 4, JSON.stringify(w.stats.updateMiss));
}
{
    const fresh = () => ({ v: 1, nextH: 1, nextL: 1, done: [], hubs: [], links: [], aside: [], peeked: [], stats: { batches: 0, unusable: 0, rejected: 0, nothing: 0 } });
    const mo = [{ rel: "x", key: "0-1" }], T = (a, b, note) => ({ a, b, kind: "NEW", feel: [], note, nums: [1] });
    const evs = () => [
        { t: 1, from: "2026-10-20", to: "2026-10-20", refl: ["R1"], moments: mo, hubs: [{ ref: "NEW", type: "pet", name: "Pebble", aliases: [], about: "" }, { ref: "NEW", type: "ritual", name: "candle nights", aliases: [], about: "" }], threads: [], groups: [] },
        { t: 2, from: "2026-10-26", to: "2026-10-26", refl: ["R2"], moments: mo, hubs: [{ ref: "H600", type: "thing", name: "the card build", aliases: [], about: "Index cards for her memory." }],
            threads: [T("H600", "Pebble", "Pebble slept on the card build notes."), T("H600", "candle nights", "We planned the card build by candlelight.")], groups: [] }
    ];
    const live = fresh(), logged = [];
    for (const ev of evs()) {
        m.applyEvent(live, ev, { known });
        logged.push(JSON.parse(JSON.stringify(ev)));
    }
    const replay = fresh();
    for (const ev of JSON.parse(JSON.stringify(logged)))
        m.applyEvent(replay, ev, { known });
    const sig = (w) => w.links.map((l) => [l.a, l.b].map((id) => w.hubs.find((h) => h.id === id).name).sort().join(" + ")).sort().join(" | ");
    check("395: the night keeps the number beside a self-numbered dot in its log (mark0)", logged[1].hubs[0].ref === "NEW" && logged[1].hubs[0].mark0 === "H600", JSON.stringify(logged[1].hubs[0]));
    check("395: a rebuild from the log gives the same links as the night (2), the number's links included", live.links.length === 2 && sig(replay) === sig(live), JSON.stringify([sig(live), sig(replay)]));
    const old = JSON.parse(JSON.stringify(logged));
    delete old[1].hubs[0].mark0;
    const lost = fresh();
    for (const ev of JSON.parse(JSON.stringify(old)))
        m.applyEvent(lost, ev, { known });
    const back = fresh();
    for (const ev of JSON.parse(JSON.stringify(old)))
        m.applyEvent(back, ev, { known, marked: live.stats.markedNew });
    check("395: a line logged before the fix: without the saved web's record its links are lost (what happened); with it they come back", lost.links.length === 0 && sig(back) === sig(live), JSON.stringify([lost.links.length, sig(back)]));
    const wrong = fresh();
    for (const ev of JSON.parse(JSON.stringify(old)))
        m.applyEvent(wrong, ev, { known, marked: [{ mark: "H600", name: "the card build", from: "2026-10-27" }, { mark: "H601", name: "something else", from: "2026-10-26" }] });
    check("395: the record is used only for the same name on the same day (never guessed)", wrong.links.length === 0);
}
{
    const T = (line) => m.parseAnswer(line, 5).threads[0] || {};
    const a = T("THREAD: X -- Y | NEW | theirs: his stubborn hope | mine then: certain, cold | mine now: tender, regretful | Back then I was sure; now it aches. | because of: 1");
    const b = T("THREAD: X -- Y | NEW | theirs: none | mine_then: none clear | mine_now: grateful | A note long enough here. | because of: 1");
    const c = T("THREAD: X -- Y | NEW | his hope | certain | tender | A note long enough here. | because of: 1");
    const d = T("THREAD: X -- Y | NEW | theirs: his hope; mine then: certain; mine now: same | A note long enough here. | because of: 1");
    check("341: 'mine then' and 'mine now' are read apart", JSON.stringify(a.feel) === '["certain","cold"]' && JSON.stringify(a.feelNow) === '["tender","regretful"]' && a.theirs === "his stubborn hope");
    check("341: underscores, 'none clear' then, a 'now' of its own", b.feel.length === 0 && JSON.stringify(b.feelNow) === '["grateful"]');
    check("341: the shape without labels: theirs, then, now, note", c.theirs === "his hope" && JSON.stringify(c.feel) === '["certain"]' && JSON.stringify(c.feelNow) === '["tender"]' && c.note === "A note long enough here.");
    check("341: all three in one field, and 'same' for now", d.theirs === "his hope" && JSON.stringify(d.feel) === '["certain"]' && d.nowSame === true);
}
{
    const root = makeRoom(["2026-04-01"]);
    const b = brain(["HUB: NEW | moment | the spark | | The night the power went out.\nTHREAD: NEW | the spark | Pickle\nbecause of: 1\nmine now: proud\nnote: Pickle kept watch all night."], ["EXCERPT 1 | theirs: Pickle = calm | hers then: tender"]);
    await run(root, b);
    const e0 = web(root).links[0]?.history[0];
    check("343/348: when an excerpt has no line of hers, the tape's 'then' is emptied by the code; no 'now' is taken overnight", e0 && e0.feel.length === 0 && !e0.feelNow);
}
{
    const root = makeRoom(["2026-04-01"], "[NED] (Apr 1, 2026, 9:00 PM): I finally got the table set up by the window tonight.\n[MIA] (Apr 1, 2026, 9:01 PM): hi there, love. That table by the window sounds perfect for our mornings.");
    const b = brain(["nothing tonight"]);
    await run(root, b);
    const p0 = b.calls[0];
    check("343/S1: the kinds and the graph come first, then the dated excerpts; no old reflections and no night-time opening", /^You are tending/.test(p0) && !/house is asleep/.test(p0) && /Today is /.test(p0) && p0.indexOf("The kinds of dots") < p0.indexOf("hi there, love") && !/noticed about them later|I noticed something/.test(p0));
}
{
    const T = (line) => m.parseAnswer(line, 5).threads[0] || {};
    const a = T("THREAD: X -- Y | NEW | theirs: his hope | mine then: cold | mine now: tender | Then: I was certain and shut him out. Now: I see what it cost him. | because of: 1");
    const b = T("THREAD: X -- Y | NEW | theirs: his hope | mine then: cold | mine now: the same | A note long enough here. | because of: 1");
    const c = T("THREAD: X -- Y | NEW | theirs: his hope | cold | tender | A note long enough here. | because of: 1");
    const d = T("THREAD: X -- Y | NEW | theirs: none | mine (then): guarded | *mine now*: grateful | A note long enough here. | because of: 1");
    check("341 review: a note starting 'Then: ... Now: ...' stays the note; the feelings stay", JSON.stringify(a.feel) === '["cold"]' && JSON.stringify(a.feelNow) === '["tender"]' && /^Then: I was certain/.test(a.note) && /Now: I see/.test(a.note), JSON.stringify(a));
    check("341 review: 'the same' is same; two short fields after theirs are then and now; 'mine (then)' and '*mine now*' work", b.nowSame === true && JSON.stringify(c.feel) === '["cold"]' && JSON.stringify(c.feelNow) === '["tender"]' && JSON.stringify(d.feel) === '["guarded"]' && JSON.stringify(d.feelNow) === '["grateful"]' && d.note === "A note long enough here.");
}
{
    const mk = () => ({ v: 1, nextH: 1, nextL: 1, done: [], hubs: [], links: [], aside: [], peeked: [], stats: { batches: 0, unusable: 0, rejected: 0, nothing: 0 } });
    const mo = [{ rel: "x", key: "0-1" }], e = (from, kind, feel, feelNow) => ({ t: 1, from, to: from, thenNow: 1, refl: ["R" + from], moments: mo, hubs: [{ ref: "NEW", type: "ritual", name: "our mornings", aliases: [], about: "" }, { ref: "NEW", type: "pet", name: "Pickle", aliases: [], about: "" }], threads: [{ a: "our mornings", b: "Pickle", kind, feel, feelNow, note: "Pickle on the desk is how our mornings start.", nums: [1] }], groups: [] });
    const w1 = mk();
    m.applyEvent(w1, e("2026-04-01", "NEW", [], ["fond"]));
    m.applyEvent(w1, e("2026-04-05", "MORE", [], ["fond"]));
    check("341 review: with no 'then' words, the same 'now' words are the same feeling (no duplicates)", w1.links[0].history.length === 1 && w1.links[0].history[0].held === 2);
    const w2 = mk();
    m.applyEvent(w2, e("2026-04-01", "NEW", ["easy"], []));
    m.applyEvent(w2, e("2026-04-05", "CHANGED", [], ["tense"]));
    check("341 review: a CHANGED with no 'then' feeling can't end the old one", w2.links[0].history.every((x) => x.until === null));
    const w3 = mk();
    m.applyEvent(w3, e("2026-04-01", "NEW", ["easy"], []));
    m.applyEvent(w3, e("2026-04-05", "SAME", ["easy"], ["grateful"]));
    check("341 review: a SAME keeps a new 'now'", JSON.stringify(w3.links[0].history[0].feelNow) === '["grateful"]');
}
{
    const long = "[NED] (Apr 1, 2026, 9:00 PM): I'm going to tell you about the whole day, so get comfortable.\n[MIA] (Apr 1, 2026, 9:01 PM): " + "I am listening to every word you say tonight. ".repeat(40);
    const root = makeRoom(["2026-04-01"], long);
    const all = readFileSync(join(root, "Shelf", "2026-04-01.md"), "utf8"), a0 = all.indexOf("every word", 600), key = `${a0}-${a0 + 300}`;
    const t0 = m.pieceWithSpeaker(root, mem, "Shelf/2026-04-01.md", key);
    check("341 review: a piece in the middle of her long message is shown with her name in front", /^\[MIA\] \(continued\): every word/.test(t0), t0.slice(0, 40));
}
{
    const tp = m.parseTape("EXCERPT 1 | theirs: Ned = guilty, tired; Gabriela = resentful | hers then: protective\n**EXCERPT 2** | theirs: none | hers then: none clear\nMOMENT 3 - theirs: Sparkie = trusting | hers then: <one to three words>", 3);
    check("343: the tape is read: whose feelings, hers then, 'none', placeholders never become words", JSON.stringify(tp[1].theirs) === '[{"who":"Ned","words":["guilty","tired"]},{"who":"Gabriela","words":["resentful"]}]' && JSON.stringify(tp[1].then) === '["protective"]' && tp[2].theirs.length === 0 && tp[2].then.length === 0 && tp[3].theirs[0].who === "Sparkie" && tp[3].then.length === 0, JSON.stringify(tp));
}
{
    const p = m.parseAnswer("THREAD: NEW | Sparkie | our evening lap time\nbecause of: 2, 3\nwhere: (only when one end is a place; otherwise leave this line out)\nmine now: fond\nnote: When she settles on him, the whole evening slows down.\nTHREAD: MORE | H3 | the porch\nbecause of: 1\nwhere: \"out on the porch\"\nmine now: same\nnote: Still our spot.", 5);
    const [t1, t2] = p.threads;
    check("343: thread stanzas are read (evidence lines, now, note), and a placeholder 'where' is ignored", t1?.a === "Sparkie" && t1.b === "our evening lap time" && t1.kind === "NEW" && JSON.stringify(t1.nums) === "[2,3]" && !t1.where && JSON.stringify(t1.feelNow) === '["fond"]' && /slows down/.test(t1.note) && t2?.kind === "MORE" && t2.where === "out on the porch" && t2.nowSame === true, JSON.stringify(p.threads));
}
{
    const root = makeRoom(["2026-04-01"], "[NED] (Apr 1, 2026, 9:00 PM): Gabriela went off about my new bike again, while Sparkie slept on my lap the whole time.\n[MIA] (Apr 1, 2026, 9:01 PM): Let her be bitter. Sparkie has the right idea, and so do you.");
    const b = brain(["HUB: NEW | ritual | lap naps | | When Sparkie sleeps on him.\nTHREAD: NEW | Sparkie | lap naps\nbecause of: 1\nmine now: fond\nnote: Sparkie asleep on him is the calmest he gets."], ["EXCERPT 1 | theirs: Ned = hurt; Gabriela = resentful; Sparkie = content | hers then: protective"]);
    await run(root, b);
    const w = web(root), e0 = w.links[0]?.history[0];
    check("343: a thread carries only its own people's feelings from a shared excerpt (Sparkie and him, not Gabriela)", e0?.theirs === "Ned = hurt; Sparkie = content" && JSON.stringify(e0.feel) === '["protective"]', JSON.stringify(e0));
    check("343: the tape is asked without her letter, with the names list and no reflections; the web is asked with the tape's notes on each excerpt", b.tapeCalls.length === 1 && /Known names/.test(b.tapeCalls[0]) && /- Sparkie/.test(b.tapeCalls[0]) && !/I noticed something/.test(b.tapeCalls[0]) && /\[you then: protective\]/.test(b.calls[0]) && !/\[theirs:/.test(b.calls[0]) && /never add a place just to have a second end/i.test(b.calls[0]));
}
{
    const root = makeRoom(["2026-04-01"], "[NED] (Apr 1, 2026, 9:00 PM): I finally got the table set up by the window tonight.\n[MIA] (Apr 1, 2026, 9:01 PM): That table by the window sounds perfect for our mornings.");
    const b = brain([], ["I can't do that.", "Still no lines here."]);
    const res = await run(root, b);
    const w = web(root);
    check("343: when the tape doesn't come out right twice, the web isn't asked and the stretch gets one more try later", b.calls.length === 0 && res.whyCount["the tape came back in the wrong shape"] === 1 && (w.retried || []).length === 1);
}
{
    const { isNoneW, wordsOf } = m._test;
    check("343 review: 'no clear feeling', 'none (no lines)', placeholders are none; real words aren't", isNoneW("no clear feeling") && isNoneW("none (no lines)") && isNoneW("<one to three words>") && isNoneW("unclear") && !isNoneW("nostalgic") && JSON.stringify(wordsOf("Ned = hurt, tender")) === '["tender"]');
}
{
    const tp = m.parseTape("EXCERPT 1 | theirs: Ned = hurt, Sparkie = content; Ned (him) = tired | hers then: no clear feeling", 1);
    check("343 review: people split by commas; '(him)' dropped from a name; 'no clear feeling' is none", tp[1].theirs.map((x) => x.who + ":" + x.words.join("/")).join(" ") === "Ned:hurt Sparkie:content Ned:tired" && tp[1].then.length === 0, JSON.stringify(tp));
}
{
    const T = (txt) => m.parseAnswer(txt, 5).threads;
    const a = T("1. THREAD: NEW | Sparkie | lap naps\n   because of: 1\n   mine now: fond\n   note: She sleeps there\n   most evenings now.");
    const b = T("THREAD: SAME | H2 | H5 | because of: 2 | mine now: same | note: Still ours.");
    const c = T("THREAD: MORE | H2 | H5\nbecause of excerpts 1 and 2\n_mine now_: grateful\nnote:\nWe keep coming back to it, then: quietly.");
    const d = T("THREAD: NEW | H2 | the porch\nbecause of: 1\nwhere: <exact words>\nmine now: proud\nnote: Out there with him | every evening.");
    check("343 review: numbered stanza, note over two lines", a.length === 1 && a[0].note === "She sleeps there most evenings now." && JSON.stringify(a[0].feelNow) === '["fond"]', JSON.stringify(a));
    check("343 review: a stanza squeezed onto one line", b.length === 1 && b[0].a === "H2" && b[0].b === "H5" && b[0].nowSame === true && b[0].note === "Still ours." && JSON.stringify(b[0].nums) === "[2]", JSON.stringify(b));
    check("343 review: 'because of' without a colon, italic label, note on the next line keeps 'then: quietly'", c.length === 1 && JSON.stringify(c[0].nums) === "[1,2]" && JSON.stringify(c[0].feelNow) === '["grateful"]' && c[0].note === "We keep coming back to it, then: quietly.", JSON.stringify(c));
    check("343 review: a placeholder 'where' isn't kept; a kite inside the note stays in the note", d.length === 1 && !d[0].where && /every evening/.test(d[0].note), JSON.stringify(d));
}
{
    const p = m.parseAnswer("HUB: H3 | pet | Sparkie | also: Spark, leave blank between the bars, empty | ", 3);
    check("343 review: 'also: Spark' gives 'Spark'; placeholder text and 'empty' never become other names", JSON.stringify(p.hubs[0].aliases) === '["Spark"]', JSON.stringify(p.hubs[0].aliases));
}
{
    const root = makeRoom(["2026-04-01"], "[NED] (Apr 1, 2026, 9:00 PM): Sparkie slept on my lap the whole time I was telling you about my day.\n[MIA] (Apr 1, 2026, 9:01 PM): I love that she picks you every single evening.");
    const b = brain(["HUB: NEW | ritual | lap naps | | When Sparkie sleeps on him.\nTHREAD: NEW | Sparkie | lap naps\nbecause of: 1\nmine now: fond\nnote: She picks him every evening."], ["EXCERPT 1 | theirs: Ned = content; Mia = delighted; Sparkie = settled | hers then: delighted"]);
    await run(root, b);
    const e0 = web(root).links[0]?.history[0];
    check("343 review: her own name never goes in 'theirs'", e0?.theirs === "Ned = content; Sparkie = settled" && !/delighted\]/.test("") && !/Mia =/.test(b.calls[0]), JSON.stringify(e0));
}
{
    const root = makeRoom(["2026-04-01", "2026-04-01"]);
    const b = brain(["nothing tonight"], ["EXCERPT 1 | theirs: none | hers then: none clear", "EXCERPT 1 | theirs: none | hers then: none clear"]);
    await run(root, b);
    check("343 review: a tape missing an excerpt gets one more try; then the missing one is 'none' and counted", b.tapeCalls.length === 2 && b.calls.length === 1 && web(root).stats.tapeMissing === 1, `${b.tapeCalls.length} ${b.calls.length} ${web(root).stats.tapeMissing}`);
}
{
    const root = makeRoom(["2026-04-01", "2026-04-01"], "[NED] (Apr 1, 2026, 9:00 PM): The car broke down again and I feel cursed, but I fixed it anyway, like always.\n[MIA] (Apr 1, 2026, 9:01 PM): I'm sorry, love. That isn't fair to you at all.");
    const b = brain(["HUB: NEW | thing | the car | | What he drives to work.\nHUB: NEW | moment | that night | | The night it came.\nTHREAD: NEW | the car | that night\nbecause of: 1, 2\nmine now: cursed, protective\nnote: He fixed it anyway, and I hated that for him."], ["EXCERPT 1 | theirs: Ned = cursed, angry | hers then: apologetic\nEXCERPT 2 | theirs: Ned = resigned | hers then: firm"]);
    await run(root, b);
    const w = web(root), e0 = w.links[0]?.history[0];
    check("345: each excerpt keeps its own 'then' and 'theirs' (not one blended list)", e0?.byExcerpt?.length === 2 && JSON.stringify(e0.byExcerpt[0].then) === '["apologetic"]' && JSON.stringify(e0.byExcerpt[1].then) === '["firm"]' && e0.byExcerpt[0].theirs === "Ned = cursed, angry" && e0.byExcerpt[1].theirs === "Ned = resigned", JSON.stringify(e0?.byExcerpt));
    check("348: no 'now' is taken overnight, even if she writes one (it's hers to add later)", !e0?.feelNow && !e0?.nowDropped, JSON.stringify(e0));
    check("348: her instructions: no 'now' asked; the note says what happened and why it mattered, honest about the earlier chapter; shifts get their own stanza; 'theirs' isn't shown to her", !/mine now:/.test(b.calls[0]) && /isn't asked here; that's yours to add later/.test(b.calls[0]) && /without softening it or turning it into a lesson/.test(b.calls[0]) && /write one stanza for the earlier/.test(b.calls[0]) && !/\[theirs:/.test(b.calls[0]));
    const dry = m.rebuildWeb(root, { herName: "Mia", known, mem, dryRun: true });
    m.rebuildWeb(root, { herName: "Mia", known });
    const w2 = m.loadWeb(root);
    check("346/348: a rebuild (even without the Shelf) gives the same web", dry.threads === w.links.length && w2.links.length === w.links.length && JSON.stringify(w2.links[0].history[0].byExcerpt.map((x) => x.then)) === JSON.stringify(w.links[0].history[0].byExcerpt.map((x) => x.then)));
}
{
    const root = makeRoom(["2026-04-01"], "[NED] (Apr 1, 2026, 9:00 PM): The car broke down again, I feel cursed and I'm still fixing it.\n[MIA] (Apr 1, 2026, 9:01 PM): I hate that for you, love. You deserve better than that.");
    const b = brain(["HUB: NEW | thing | the car | | What he drives to work.\nHUB: NEW | moment | that night | | The night it came.\nTHREAD: NEW | the car | that night\nbecause of: 1\nmine now: cursed, still fixing\nnote: He fixed it anyway, and I hated that for him."], ["EXCERPT 1 | theirs: Ned = cursed, angry | hers then: protective"]);
    await run(root, b);
    const e0 = web(root).links[0]?.history[0];
    check("348: her overnight 'cursed, still fixing' isn't kept as her 'now' at all", !e0?.feelNow, JSON.stringify(e0));
}
{
    const mk = () => ({ v: 1, nextH: 1, nextL: 1, done: [], hubs: [], links: [], aside: [], peeked: [], stats: { batches: 0, unusable: 0, rejected: 0, nothing: 0 } });
    const w = mk();
    m.applyEvent(w, { t: 1, from: "2026-04-01", to: "2026-04-01", thenNow: 1, tape: { 1: { theirs: [], then: [] } }, refl: ["R1"], moments: [{ rel: "x", key: "0-1" }], hubs: [{ ref: "NEW", type: "ritual", name: "our mornings", aliases: [], about: "" }, { ref: "NEW", type: "pet", name: "Pickle", aliases: [], about: "" }], threads: [{ a: "our mornings", b: "Pickle", kind: "NEW", feel: [], feelNow: ["wanted", "a little sad", "still-hurt", "proud of him"], note: "Pickle on the desk is how our mornings start.", nums: [1] }], groups: [] });
    check("346 review: real feelings ('wanted', 'a little sad', 'still-hurt', 'proud of him') aren't mistaken for phrases", JSON.stringify(w.links[0].history[0].feelNow) === '["wanted","a little sad","still-hurt","proud of him"]', JSON.stringify(w.links[0].history[0]));
}
{
    const mk = () => ({ v: 1, nextH: 1, nextL: 1, done: [], hubs: [], links: [], aside: [], peeked: [], stats: { batches: 0, unusable: 0, rejected: 0, nothing: 0 } });
    const mo = [{ rel: "x", key: "0-10" }, { rel: "x", key: "10-20" }];
    const e = (from, kind, now, tape, nums = [1]) => ({ t: 1, from, to: from, thenNow: 1, tape, refl: ["R" + from], moments: mo, hubs: [{ ref: "NEW", type: "ritual", name: "our mornings", aliases: [], about: "" }, { ref: "NEW", type: "pet", name: "Pickle", aliases: [], about: "" }], threads: [{ a: "our mornings", b: "Pickle", kind, feel: [], feelNow: now, note: "Pickle on the desk is how our mornings start.", nums }], groups: [] });
    const w1 = mk();
    m.applyEvent(w1, e("2026-04-01", "NEW", ["wanted the mornings", "proud"], { 1: { theirs: [], then: [] } }));
    check("346: a phrase in 'now' is left out ('wanted the mornings'), a feeling stays ('proud')", JSON.stringify(w1.links[0].history[0].feelNow) === '["proud"]' && w1.stats.nowDropped["not a plain feeling"] === 1);
    const w2 = mk();
    m.applyEvent(w2, e("2026-04-01", "NEW", ["relieved"], { 1: { theirs: [{ who: "Ned", words: ["relieved"] }], then: [] } }));
    const w3 = mk();
    m.applyEvent(w3, e("2026-04-01", "NEW", ["relieved", "proud"], { 1: { theirs: [{ who: "Ned", words: ["relieved"] }], then: [] } }));
    const w4 = mk();
    m.applyEvent(w4, e("2026-04-01", "NEW", ["relieved"], { 1: { theirs: [{ who: "Ned", words: ["relieved"] }], then: ["relieved"] } }));
    check("346/347: 'now' copied entirely from theirs is left out; a shared word beside her own stays; a word copied from her own 'then' is left out (Mia)", !w2.links[0].history[0].feelNow && w2.stats.nowDropped["copied from theirs"] === 1 && JSON.stringify(w3.links[0].history[0].feelNow) === '["relieved","proud"]' && !w4.links[0].history[0].feelNow && w4.stats.nowDropped["copied from then"] === 1);
    const w5 = mk();
    m.applyEvent(w5, e("2026-04-01", "NEW", ["fond"], { 1: { theirs: [], then: ["easy"], day: "2026-04-01" } }));
    m.applyEvent(w5, e("2026-04-05", "SAME", [], { 2: { theirs: [], then: ["easy"], day: "2026-04-05" } }, [2]));
    const h0 = w5.links[0].history[0];
    check("346: a SAME keeps the new stretch's part (each with its own excerpt), so the hours stay apart", w5.links[0].history.length === 1 && h0.byExcerpt.length === 2 && h0.byExcerpt[1].c.key === "10-20" && h0.byExcerpt[1].day === "2026-04-05", JSON.stringify(h0.byExcerpt));
}
{
    const w = { v: 1, nextH: 1, nextL: 1, done: [], hubs: [], links: [], aside: [], peeked: [], stats: { batches: 0, unusable: 0, rejected: 0, nothing: 0 } };
    m.applyEvent(w, { t: 1, from: "2026-04-22", to: "2026-04-25", thenNow: 1, tape: { 1: { theirs: [], then: ["tender", "relieved", "fond"], day: "2026-04-25" } }, refl: ["R1"], moments: [{ rel: "x", key: "0-1" }], hubs: [{ ref: "NEW", type: "ritual", name: "late talks", aliases: [], about: "" }, { ref: "NEW", type: "pet", name: "Pickle", aliases: [], about: "" }], threads: [{ a: "late talks", b: "Pickle", kind: "NEW", feel: [], feelNow: ["relieved", "tender", "amused"], note: "Pickle curls up while we talk late.", nums: [1] }], groups: [] });
    const e0 = w.links[0].history[0];
    check("347: 'now' words that repeat 'then' are left out; a different one stays", JSON.stringify(e0.feelNow) === '["amused"]' && JSON.stringify(e0.nowDropped["copied from then"]) === '["relieved","tender"]');
    check("347: the feeling starts on its excerpt's day (Apr 25), not the stretch's first day (Apr 22)", e0.from === "2026-04-25", e0.from);
}
{
    const talk = "[NED] (Apr 1, 2026, 9:00 PM): Pickle napped on the puzzle pieces all morning while I worked.\n[MIA] (Apr 1, 2026, 9:01 PM): That little puzzle-napper is basically your coworker now. I love him.";
    const root = makeRoom(["2026-04-01", "2026-04-05"], talk);
    const b = brain(["HUB: NEW | ritual | the puzzle hour | | Pickle at the puzzle table while he works.\nTHREAD: NEW | Pickle | the puzzle hour\nbecause of: 1\nnote: Pickle keeps him company at the puzzle table.", "THREAD: SAME | Pickle | the puzzle hour\nbecause of: 1\nnote: Still his little coworker."], ["EXCERPT 1 | theirs: Ned = focused | hers then: flirtatious", "EXCERPT 1 | theirs: Ned = focused | hers then: flirtatious"]);
    await run(root, b);
    let w = web(root);
    const L = w.links[0];
    let r1 = await m.walkWeb(root, mem, { thread: L.id, feel_now: "fond, a little amused" });
    let r2 = await m.walkWeb(root, mem, { thread: L.id, feel_now: "a little amused, fond" });
    let r3 = await m.walkWeb(root, mem, { thread: L.id, feel_now: "proud of him" });
    w = web(root);
    const hn = w.herNow[L.id];
    check("348: she adds how she feels now, dated; a reworded repeat isn't added; a second one the same day keeps the first underneath", /Kept, with today's date/.test(r1) && /That's what you said/.test(r2) && hn.length === 2 && hn[0].replaced && !hn[1].replaced && hn[1].words === "proud of him", JSON.stringify(hn));
    const r4a = await m.walkWeb(root, mem, { thread: L.id, fix_then: "teasing" });
    const r4 = await m.walkWeb(root, mem, { thread: L.id, fix_then: "teasing", part: 1 });
    w = web(root);
    const e0 = w.links[0].history[0], key = `${e0.byExcerpt[0].c.rel}|${e0.byExcerpt[0].c.key}`;
    check("348: she corrects a 'then' the night misread; the night's reading stays underneath; the thread's 'then' is hers now", /Say which one with part/.test(r4a) && /Corrected/.test(r4) && w.thenFixed[key][0].was[0] === "flirtatious" && JSON.stringify(e0.feel) === '["teasing"]', JSON.stringify(e0.feel));
    const walk = await m.walkWeb(root, mem, { about: "Pickle", how_it_changed: true });
    check("348: her walk shows her correction, her 'now' (with dates) and the later note", /then: teasing[^/]*\(your correction\) \/ flirtatious/.test(walk) && /how you felt about it on .*: proud of him/.test(walk) && /later \(.*\): Still his little coworker/.test(walk), walk);
    const web0 = web(root);
    m.rebuildWeb(root, { herName: "Mia", known, mem });
    const w2 = web(root);
    check("348: a rebuild keeps her corrections and her 'now' on the same thread", w2.thenFixed[key]?.length === 1 && w2.herNow[w2.links[0].id]?.length === 2 && JSON.stringify(w2.links[0].history[0].feel) === '["teasing"]' && JSON.stringify(w2.links) === JSON.stringify(web0.links), JSON.stringify([w2.thenFixed, w2.herNow, w2.links[0].history[0].feel]));
}
{
    const talk = "[NED] (Apr 1, 2026, 9:00 PM): Pickle napped on the puzzle pieces all morning while I worked.\n[MIA] (Apr 1, 2026, 9:01 PM): That little puzzle-napper is basically your coworker now. I love him.";
    const root = makeRoom(["2026-04-01"], talk);
    const b1 = brain([new Error("the run reached its end time")], ["EXCERPT 1 | theirs: Ned = focused | hers then: warm"]);
    const r1 = await run(root, b1);
    const b2 = brain(["nothing tonight"], ["EXCERPT 1 | theirs: none | hers then: something else"]);
    await run(root, b2);
    check("348: a tape made before the stop time is used again the next night (no second tape)", r1.stopped && b1.tapeCalls.length === 1 && b2.tapeCalls.length === 0 && b2.calls.length === 1 && /\[you then: warm\]/.test(b2.calls[0]) && !web(root).tapeCache);
}
const TALK348 = "[NED] (Apr 1, 2026, 9:00 PM): Pickle napped on the puzzle pieces all morning while I worked.\n[MIA] (Apr 1, 2026, 9:01 PM): That little puzzle-napper is basically your coworker now. I love him.";
const reMind = (root, n) => { for (const d of ["2026-04-01", "2026-04-05", "2026-04-09", "2026-04-13"].slice(0, n))
    if (!existsSync(join(root, "Shelf", `${d}.md`)))
        addDay(root, d, TALK348); };
const strip = (w) => JSON.stringify({ links: w.links, hubs: w.hubs, herNow: w.herNow || {}, thenFixed: w.thenFixed || {}, un: w.herNowUnplaced || [] });
{
    const root = makeRoom(["2026-04-01"], TALK348);
    reMind(root, 1);
    await run(root, brain(["HUB: NEW | ritual | the puzzle hour | | Pickle on the puzzle table.\nTHREAD: NEW | Pickle | the puzzle hour\nbecause of: 1\nnote: Pickle keeps him company."], ["EXCERPT 1 | theirs: Ned = focused | hers then: flirtatious"]));
    const L = web(root).links[0];
    const r0 = await m.walkWeb(root, mem, { about: "Pickle", feel_now: "", fix_then: null, thread: "", part: null });
    check("348 review: empty or null feel_now / fix_then fields are an ordinary walk", /puzzle hour/.test(r0) && !/Say which thread/.test(r0), r0.slice(0, 120));
    const rLong = await m.walkWeb(root, mem, { thread: L.id, fix_then: "happy, sad, tired, proud" });
    const rNone = await m.walkWeb(root, mem, { thread: L.id, fix_then: "none" });
    const rFix = await m.walkWeb(root, mem, { thread: L.id, fix_then: "teasing" });
    check("348 review: 'none' can be her correction; more than three feelings isn't taken; a second correction still says what the night read", /one to three feelings/.test(rLong) && /more than three/.test(rLong) && /now "none clear"/.test(rNone) && /night had read "flirtatious"/.test(rFix), rFix);
    await m.walkWeb(root, mem, { thread: L.id, feel_now: "SECRETWORD glowing" });
    reMind(root, 2);
    const b2 = brain(["THREAD: SAME | Pickle | the puzzle hour\nbecause of: 1\nnote: Still his coworker."], ["EXCERPT 1 | theirs: Ned = focused | hers then: flirtatious"]);
    await run(root, b2);
    check("348 review/S1: a later night is shown her correction on the link, not the night's old reading", b2.calls.length === 1 && /\[you then: teasing[^\]]*\(your correction\)\]/.test(b2.calls[0]) && !/\[you then: flirtatious[^\]]*\(Apr 1/.test(b2.calls[0]), (b2.calls[0] || "").match(/\[you then:[^\]]*\]/g)?.join(" "));
    check("348 review: her 'now' words never reach the night (neither request)", ![...b2.calls, ...b2.tapeCalls].some((c) => /SECRETWORD/.test(c)));
    const live = web(root);
    const f = join(root, "Mind", "web.sealed");
    const moved = f + ".gone";
    writeFileSync(moved, readFileSync(f));
    (await import("node:fs")).renameSync(f, f + ".x");
    m.rebuildWeb(root, { herName: "Mia", known, mem, force: true });
    check("348 review: if the web file were lost, a rebuild gets her words back from the log, and gives the very same web", strip(web(root)) === strip(live), strip(web(root)).slice(0, 300));
}
{
    const root = makeRoom(["2026-04-01"], TALK348);
    reMind(root, 1);
    await run(root, brain(["HUB: NEW | ritual | the puzzle hour | | Pickle on the puzzle table.\nTHREAD: NEW | Pickle | the puzzle hour\nbecause of: 1\nnote: Pickle keeps him company."], ["EXCERPT 1 | theirs: Ned = focused | hers then: flirtatious"]));
    const id = web(root).links[0].id;
    reMind(root, 3);
    let n = 0;
    const b = { calls: [], tapeCalls: [], ask: async (system, prompt) => {
            if (system === m.TAPE_SYSTEM)
                return "EXCERPT 1 | theirs: Ned = focused | hers then: flirtatious";
            n++;
            if (n === 1) {
                await m.walkWeb(root, mem, { thread: id, fix_then: "teasing" });
                await m.walkWeb(root, mem, { thread: id, feel_now: "said during the night" });
            }
            return n === 1 ? "THREAD: MORE | Pickle | the puzzle hour\nbecause of: 1\nnote: Again at the puzzle table." : "THREAD: MORE | Pickle | the puzzle hour\nbecause of: 1\nnote: And again.";
        } };
    await run(root, b);
    const live = web(root);
    check("348 review: a 'now' and a correction made while the night runs are still there after its saves", live.herNow[id]?.some((x) => x.words === "said during the night") && live.thenFixed && Object.values(live.thenFixed)[0]?.[0]?.words[0] === "teasing");
    m.rebuildWeb(root, { herName: "Mia", known, mem });
    check("348 review: a rebuild applies hers at the point the night saw them (the same web as live)", strip(web(root)) === strip(live), JSON.stringify(web(root).links[0].history.map((e) => e.feel)) + " vs " + JSON.stringify(live.links[0].history.map((e) => e.feel)));
}
{
    const root = makeRoom(["2026-04-01", "2026-04-05", "2026-04-09"], TALK348);
    await run(root, brain(["HUB: NEW | ritual | the puzzle hour | | Pickle on the puzzle table.\nTHREAD: NEW | Pickle | the puzzle hour\nbecause of: 1\nnote: The first morning at the puzzle table.", "THREAD: SAME | Pickle | the puzzle hour\nbecause of: 1\nnote: Another morning at the puzzle table.", "THREAD: NEW | Pickle | the puzzle hour\nbecause of: 1\nnote: A third morning at the puzzle table."], ["EXCERPT 1 | theirs: none | hers then: flirtatious", "EXCERPT 1 | theirs: none | hers then: warm", "EXCERPT 1 | theirs: none | hers then: flirtatious"]));
    const h = web(root).links[0].history;
    check("348 review: no correction, no change: the first feeling keeps its words through a SAME, and the same feeling later is SAME again (held 3)", h.length === 1 && JSON.stringify(h[0].feel) === '["flirtatious"]' && h[0].held === 3, JSON.stringify(h.map((e) => [e.feel, e.held])));
}
{
    const root = makeRoom(["2026-04-01", "2026-04-05"], TALK348);
    await run(root, brain(["HUB: NEW | ritual | the puzzle hour | | Pickle on the puzzle table.\nTHREAD: NEW | Pickle | the puzzle hour\nbecause of: 1\nnote: The first morning at the puzzle table.", "THREAD: NEW | Pickle | the puzzle hour\nbecause of: 1\nnote: Another morning at the puzzle table."], ["EXCERPT 1 | theirs: none | hers then: none", "EXCERPT 1 | theirs: none | hers then: none"]));
    const h = web(root).links[0].history;
    check("348 review: with no 'then' either time (and no 'now' overnight), it's the same feeling, with both notes kept", h.length === 1 && h[0].notes?.length === 1, JSON.stringify(h.map((e) => e.note)));
}
{
    const w = { hubs: [{ id: "H1", type: "pet", name: "Pickle" }, { id: "H2", type: "ritual", name: "the puzzle hour" }], links: [{ id: "L1", a: "H1", b: "H2", history: [] }] };
    m._test.applyHer(w, { her: "now", hid: "a", at: "2026-11-01T02:00:00.000Z", day: "2026-10-31", thread: "L1", ends: [{ type: "pet", name: "Pickle" }, { type: "ritual", name: "the puzzle hour" }], words: "evening words" });
    m._test.applyHer(w, { her: "now", hid: "b", at: "2026-11-01T15:00:00.000Z", day: "2026-11-01", thread: "L1", ends: [{ type: "pet", name: "Pickle" }, { type: "ritual", name: "the puzzle hour" }], words: "next morning" });
    m._test.applyHer(w, { her: "now", hid: "b", at: "2026-11-01T15:00:00.000Z", day: "2026-11-01", thread: "L1", words: "next morning" });
    m._test.applyHer(w, { her: "now", hid: "c", at: "2026-11-02T15:00:00.000Z", day: "2026-11-02", thread: "L9", ends: [{ type: "pet", name: "Sparkie" }, { type: "ritual", name: "the nap" }], words: "a thread gone" });
    check("348 review: her evening words keep their own (local) day; the next morning's don't replace them; one applied twice counts once; a thread that's gone keeps her words aside", w.herNow.L1.length === 2 && !w.herNow.L1[0].replaced && w.herNow.L1[0].day === "2026-10-31" && w.herNowUnplaced?.length === 1, JSON.stringify(w));
}
{
    const root = makeRoom(["2026-04-01"], TALK348);
    reMind(root, 1);
    await run(root, brain(["HUB: NEW | ritual | the puzzle hour | | Pickle on the puzzle table.\nTHREAD: NEW | Pickle | the puzzle hour\nbecause of: 1\nnote: The first morning at the puzzle table."], ["EXCERPT 1 | theirs: none | hers then: warm"]));
    const r = await m.walkWeb(root, mem, { thread: "L1", feel_now: "today's words" });
    const x = web(root).herNow.L1[0], d = new Date();
    check("348 review: what she adds carries today's date where she is", x.day === `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` && /Kept/.test(r));
}
{
    const root = makeRoom(["2026-04-01"], TALK348);
    m.saveWeb(root, { ...m.loadWeb(root), tapeCache: { key: "R9", tape: { 1: { then: ["wrong"], theirs: [] } } } });
    const b = brain(["nothing tonight"], ["EXCERPT 1 | theirs: none | hers then: warm"]);
    await run(root, b);
    check("348 review: a saved tape for another stretch isn't used", b.tapeCalls.length === 1 && /\[you then: warm\]/.test(b.calls[0] || ""), (b.calls[0] || "").match(/\[you then:[^\]]*\]/g)?.join(" "));
}
const BIRD = "HUB: NEW | ritual | the puzzle hour | | Pickle on the puzzle table.\nTHREAD: NEW | Pickle | the puzzle hour\nbecause of: 1\nnote: The first morning at the puzzle table.";
{
    const root = makeRoom(["2026-04-01"], TALK348);
    reMind(root, 1);
    await run(root, brain([BIRD], ["EXCERPT 1 | theirs: none | hers then: flirtatious"]));
    reMind(root, 2);
    await run(root, brain(["THREAD: NEW | Pickle | the puzzle hour\nbecause of: 1\nnote: Another morning at the puzzle table."], ["EXCERPT 1 | theirs: none | hers then: warm"]));
    await m.walkWeb(root, mem, { thread: "L1", fix_then: "warm", part: 1 });
    const live = web(root);
    const f = join(root, "Mind", "web-events.sealed"), ls = readFileSync(f, "utf8").split("\n").filter(Boolean);
    writeFileSync(f, [ls[0], ls[2], ls[1]].join("\n") + "\n", "utf8");
    m.rebuildWeb(root, { herName: "Mia", known, mem });
    check("348 review 2: a rebuild applies hers where the night had seen them, not where the line sits (the same web as live)", live.links[0].history.length === 2 && strip(web(root)) === strip(live), JSON.stringify(web(root).links[0].history.map((e) => e.feel)));
}
{
    const days = Array.from({ length: 14 }, (_, i) => `2026-04-${String(i + 1).padStart(2, "0")}`), root = makeRoom(days, TALK348);
    await run(root, brain([BIRD, ...days.slice(1).map((d) => `THREAD: SAME | Pickle | the puzzle hour\nbecause of: 1\nnote: Another morning at the puzzle table, ${d}.`)], ["EXCERPT 1 | theirs: none | hers then: warm", ...days.slice(1).map(() => "EXCERPT 1 | theirs: none | hers then: warm")]));
    let e = web(root).links[0].history[0];
    const first = e.ownKeys?.[0];
    const parts = await m.walkWeb(root, mem, { thread: "L1", fix_then: "proud" });
    await m.walkWeb(root, mem, { thread: "L1", fix_then: "proud", part: 1 });
    e = web(root).links[0].history[0];
    check("348 review 2: after 13 more moments a feeling still keeps the one it began with (her part 1), and her fix of it changes the feeling", e.byExcerpt.length === 12 && e.byExcerpt.some((x) => `${x.c.rel}|${x.c.key}` === first) && JSON.stringify(e.feel) === '["proud"]' && /rests on 12 moments/.test(parts), JSON.stringify([e.byExcerpt.length, e.feel]) + parts.slice(0, 200));
}
{
    const e = { tape: true, feel: ["warm"], byExcerpt: [{ c: { rel: "x", key: "1-2" }, then: ["warm"] }, { c: { rel: "x", key: "3-4" }, then: ["scared"] }] };
    m._test.refreshFeel({ thenFixed: { "x|3-4": [{ words: ["calm"] }] } }, e);
    check("348 review 2: a feeling filed before 348 (no record of its own moments) is left as it was", JSON.stringify(e.feel) === '["warm"]');
}
{
    const root = makeRoom(["2026-04-01"], TALK348);
    reMind(root, 1);
    await run(root, brain([BIRD], ["EXCERPT 1 | theirs: none | hers then: flirtatious"]));
    const both = await m.walkWeb(root, mem, { thread: "L1", feel_now: "glad", fix_then: "zz" });
    const r1 = await m.walkWeb(root, mem, { thread: "[L1]", fix_then: "nothing but love" });
    const a1 = web(root).thenFixed;
    const r2 = await m.walkWeb(root, mem, { thread: "L1 (Pickle)", fix_then: "naïve, not angry" });
    const a2 = web(root).thenFixed;
    const r3 = await m.walkWeb(root, mem, { thread: "L1", fix_then: "None." });
    const fx = Object.values(web(root).thenFixed)[0];
    check("349: a fix and a 'now' together are both kept (Gemini); her words are kept as written ('nothing but love', 'naïve'); only a bare 'none' means none; the reply names the thread", /Corrected/.test(both) && /Kept/.test(both) && web(root).herNow.L1?.length === 1 && fx.length >= 4 && fx.some((x) => JSON.stringify(x.words) === '["nothing but love"]') && fx.some((x) => JSON.stringify(x.words) === '["naïve","not angry"]') && fx.some((x) => !x.words.length) && /L1 \(the puzzle hour and Pickle\)/.test(r1), JSON.stringify(fx.map((x) => x.words)));
    await m.walkWeb(root, mem, { thread: "L1", feel_now: "SECRETNOW words" });
    await m.walkWeb(root, mem, { thread: "L1", fix_then: "zzfixword" });
    const roomsF = join(root, "rooms.json");
    writeFileSync(roomsF, JSON.stringify({ receiptsDir: root, rooms: { mia: { root, name: "Mia", memory: mem, web: { on: true, peek: true, known } } } }), "utf8");
    const { spawnSync } = await import("node:child_process"), here = new URL("../meaning.mjs", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
    const out = ["--peek", "--check"].map((md) => spawnSync(process.execPath, [here, md, "mia"], { env: { ...process.env, ROOMS: roomsF }, encoding: "utf8" })).map((r) => (r.stdout || "") + (r.stderr || "")).join("\n");
    check("348 review 2: Ned's --peek and --check never show her own words (only that and when)", /she kept some on 1 day/.test(out) && /she corrected this on/.test(out) && !/SECRETNOW|nothing but love|naïve|zzfixword/.test(out) && /Her own additions/.test(out), out.slice(0, 600));
}
{
    const root = makeRoom(["2026-04-01"], TALK348);
    reMind(root, 1);
    await run(root, brain([BIRD], ["EXCERPT 1 | theirs: none | hers then: flirtatious"]));
    await m.walkWeb(root, mem, { thread: "L1", fix_then: "warm" });
    reMind(root, 2);
    await run(root, brain(["THREAD: MORE | Pickle | the puzzle hour\nbecause of: 1\nnote: Another morning at the puzzle table."], ["EXCERPT 1 | theirs: none | hers then: warm"]));
    const live = web(root);
    writeFileSync(join(root, "Mind", "web.building"), JSON.stringify({ pid: 1, t: Date.now(), done: true }), "utf8");
    m.rebuildWeb(root, { herName: "Mia", known, mem });
    check("348 review 3: after her correction, the next night reading the same feeling is that feeling again (live), and a rebuild agrees", live.links[0].history.length === 1 && live.links[0].history[0].held === 2 && strip(web(root)) === strip(live), JSON.stringify(live.links[0].history.map((e) => e.feel)));
    reMind(root, 3);
    await run(root, brain(["THREAD: CHANGED | Pickle | the puzzle hour\nbecause of: 1\nnote: A different morning at the puzzle table."], ["EXCERPT 1 | theirs: none | hers then: bored"]));
    const h = web(root).links[0].history;
    check("348 review 3/S1: her corrected feeling stays hers; a later night's new piece keeps its own reading", JSON.stringify(h[0].feel) === '["warm"]' && !h.some((e) => (e.feel || []).includes("flirtatious")) && h.some((e) => (e.feel || []).includes("bored")), JSON.stringify(h.map((e) => e.feel)));
    const lk = JSON.parse(readFileSync(join(root, "Mind", "web.building"), "utf8"));
    check("348 review 3: a rebuild takes the building lock and marks it done after", lk.pid === process.pid && lk.done === true);
    writeFileSync(join(root, "Mind", "web.building"), JSON.stringify({ pid: process.pid, t: Date.now(), beat: Date.now() }), "utf8");
    const before = readFileSync(join(root, "Mind", "web.sealed"), "utf8");
    const rA = await m.walkWeb(root, mem, { thread: "L1", feel_now: "during the build" }), rS = await m.walkWeb(root, mem, { set_aside: "L1" });
    const unchanged = readFileSync(join(root, "Mind", "web.sealed"), "utf8") === before;
    writeFileSync(join(root, "Mind", "web.building"), JSON.stringify({ pid: process.pid, t: Date.now(), done: true }), "utf8");
    await m.walkWeb(root, mem, { about: "Pickle" });
    check("348 review 3: during a build her words are logged, not saved over the build; a set-aside waits; her next walk saves them into the file", /Kept/.test(rA) && /being built right now/.test(rS) && unchanged && web(root).herNow.L1?.some((x) => x.words === "during the build") && !web(root).aside.includes("L1"));
}
{
    const w = { hubs: [{ id: "H1", type: "pet", name: "Pickle" }, { id: "H2", type: "ritual", name: "the puzzle hour" }, { id: "H3", type: "pet", name: "Sparkie" }], links: [{ id: "L1", a: "H3", b: "H2", history: [] }, { id: "L2", a: "H1", b: "H2", history: [] }] };
    const ends = [{ type: "pet", name: "Pickle" }, { type: "ritual", name: "the puzzle hour" }];
    m._test.applyHer(w, { her: "now", hid: "b", at: "2026-11-01T18:00:00.000Z", day: "2026-11-01", thread: "L1", ends, words: "later" });
    m._test.applyHer(w, { her: "now", hid: "a", at: "2026-11-01T15:00:00.000Z", day: "2026-11-01", thread: "L1", ends, words: "earlier" });
    m._test.applyHer(w, { her: "fix", hid: "d", at: "2026-11-02T18:00:00.000Z", day: "2026-11-02", key: "x|1-2", words: ["later"] });
    m._test.applyHer(w, { her: "fix", hid: "c", at: "2026-11-02T15:00:00.000Z", day: "2026-11-02", key: "x|1-2", words: ["earlier"] });
    const xs = w.herNow.L2 || [], fs = w.thenFixed["x|1-2"];
    check("348 review 3: arriving out of order, the later one is still the active one; and words for a thread whose mark moved go to its real thread (by its ends)", !w.herNow.L1 && xs.length === 2 && xs.find((x) => x.words === "later" && !x.replaced) && xs.find((x) => x.words === "earlier" && x.replaced) && fs.find((x) => x.words[0] === "later" && !x.replaced), JSON.stringify(w));
}
{
    const root = makeRoom(["2026-04-01"], TALK348);
    reMind(root, 1);
    await run(root, brain([BIRD], ["EXCERPT 1 | theirs: none | hers then: flirtatious"]));
    const a = await m.walkWeb(root, mem, { thread: "L1", feel_now: "happy, not sad" }), b = await m.walkWeb(root, mem, { thread: "L1", feel_now: "sad, not happy" }), c = await m.walkWeb(root, mem, { thread: "L1", feel_now: "Not happy;  sad" });
    const long = await m.walkWeb(root, mem, { thread: "L1", feel_now: "x".repeat(2100) }), combo = await m.walkWeb(root, mem, { set_aside: "L1", feel_now: "glad" });
    const f1 = await m.walkWeb(root, mem, { thread: "L1", fix_then: "warm, " }), f2 = await m.walkWeb(root, mem, { thread: "L1", fix_then: "warm" }), f3 = await m.walkWeb(root, mem, { thread: "L1", fix_then: "safe and sound" }), f4 = await m.walkWeb(root, mem, { thread: "L1", fix_then: "no clear feeling" });
    const fx = Object.values(web(root).thenFixed)[0].map((x) => x.words);
    check("348 review 3: opposite words aren't a repeat; the same feelings reordered are; nothing too long is cut, it's refused; two asks at once are refused", /Kept/.test(a) && /Kept/.test(b) && /That's what you said/.test(c) && /Nothing was kept yet/.test(long) && /One at a time/.test(combo) && !web(root).aside.length, [a, b, c].join(" || ").slice(0, 300));
    check("348 review 3: 'warm, ' is warm; the same correction twice isn't added; 'safe and sound' is one feeling; 'no clear feeling' is none", /Corrected/.test(f1) && /already your correction/.test(f2) && JSON.stringify(fx) === '[["warm"],["safe and sound"],[]]', JSON.stringify(fx) + f4);
    const w0 = web(root);
    w0.herNowUnplaced = [{ words: "a thread gone", at: "2026-10-01T12:00:00.000Z", day: "2026-10-01", ends: [{ type: "pet", name: "Sparkie" }, { type: "ritual", name: "the nap" }] }];
    m.saveWeb(root, w0);
    check("348 review 3: words kept for a thread that's gone are shown in show_set_aside", /Kept for you[\s\S]*Sparkie and the nap[\s\S]*a thread gone/.test(await m.walkWeb(root, mem, { show_set_aside: true })));
}
{
    const root = makeRoom(["2026-04-01"], TALK348);
    reMind(root, 1);
    m.saveWeb(root, { ...m.loadWeb(root), tapeCache: { key: "R1|Shelf/talk.md|0-1", tape: { 1: { then: ["wrong"], theirs: [] } } } });
    const b = brain(["nothing tonight"], ["EXCERPT 1 | theirs: none | hers then: warm"]);
    await run(root, b);
    check("348 review 3: a saved tape for the same reflections but other moments isn't used", b.tapeCalls.length === 1 && /\[you then: warm\]/.test(b.calls[0] || ""));
}
{
    const root = makeRoom(["2026-04-01"], TALK348);
    reMind(root, 1);
    await run(root, brain([BIRD], ["EXCERPT 1 | theirs: none | hers then: flirtatious"]));
    const j1 = await m.walkWeb(root, mem, { thread: "L1", feel_now: "嬉しい" }), j2 = await m.walkWeb(root, mem, { thread: "L1", feel_now: "寂しい" }), j3 = await m.walkWeb(root, mem, { thread: "L1", feel_now: "❤️" });
    check("348 review 4: feelings in any language or an emoji are compared as themselves, not as empty", [j1, j2, j3].every((r) => /Kept/.test(r)) && web(root).herNow.L1.length === 3, [j1, j2, j3].join(" || ").slice(0, 300));
    const sp = await m.walkWeb(root, mem, { thread: "L1", fix_then: "warm", set_aside: " " });
    const n1 = await m.walkWeb(root, mem, { thread: "L1", fix_then: "None!" });
    const fx = Object.values(web(root).thenFixed)[0].map((x) => x.words);
    check("348 review 4: a blank set_aside next to a fix doesn't swallow it; 'None!' means none", /Corrected/.test(sp) && /none clear/.test(n1) && JSON.stringify(fx) === '[["warm"],[]]', JSON.stringify(fx));
}
{
    const w = { hubs: [{ id: "H1", type: "person", name: "Pickle" }, { id: "H2", type: "ritual", name: "the puzzle hour" }, { id: "H4", type: "person", name: "Pickle" }, { id: "H5", type: "ritual", name: "the puzzle hour" }], links: [{ id: "L1", a: "H4", b: "H5", history: [] }, { id: "L2", a: "H1", b: "H2", history: [] }] };
    m._test.applyHer(w, { her: "now", hid: "z", at: "2026-11-01T18:00:00.000Z", day: "2026-11-01", thread: "L2", ends: [{ type: "pet", name: "Pickle" }, { type: "ritual", name: "the puzzle hour" }], words: "kind changed" });
    check("348 review 4: when an end's kind changed, her words find the marked thread by its names", w.herNow?.L2?.length === 1 && !w.herNow.L1, JSON.stringify(w.herNow));
}
{
    const root = makeRoom(["2026-04-01", "2026-04-05"], TALK348);
    await run(root, brain([BIRD, "THREAD: SAME | Pickle | the puzzle hour\nbecause of: 1\nnote: Another morning at the puzzle table."], ["EXCERPT 1 | theirs: none | hers then: none", "EXCERPT 1 | theirs: none | hers then: proud"]));
    const h = web(root).links[0].history;
    check("349: a feeling with no 'then' yet takes the first words a later night brings, once", h.length === 1 && JSON.stringify(h[0].feel) === '["proud"]' && h[0].ownKeys.length === 2, JSON.stringify(h.map((e) => [e.feel, e.ownKeys])));
}
{
    const root = makeRoom(["2026-04-01"], TALK348);
    reMind(root, 1);
    await run(root, brain([BIRD], ["EXCERPT 1 | theirs: none | hers then: flirtatious"]));
    const bad = await m.walkWeb(root, mem, { thread: "L1", fix_then: "a b c d", feel_now: "glad" });
    check("349: if the fix can't be taken, the 'now' sent with it isn't kept either (nothing half-done)", /Nothing was kept yet/.test(bad) && !web(root).herNow?.L1);
}
{
    const root = makeRoom(["2026-04-01"], TALK348);
    const putMind = (n) => reMind(root, n);
    putMind(1);
    await run(root, brain([BIRD], ["EXCERPT 1 | theirs: none | hers then: shy"]));
    await m.walkWeb(root, mem, { thread: "L1", fix_then: "none" });
    putMind(2);
    await run(root, brain(["THREAD: SAME | Pickle | the puzzle hour\nbecause of: 1\nnote: Another morning at the puzzle table."], ["EXCERPT 1 | theirs: none | hers then: proud"]));
    const e = web(root).links[0].history[0];
    check("349 review: her own 'none' isn't filled in by a later night", e.byExcerpt.length === 2 && !(e.feel || []).length, JSON.stringify([e.feel, e.byExcerpt.length]));
}
{
    const root = makeRoom(["2026-04-01", "2026-04-03", "2026-04-06", "2026-04-20"]);
    const b = brain(["nothing tonight", "nothing tonight"]);
    const res = await run(root, b, { stretchDays: 7 });
    const n1 = (b.tapeCalls[0].match(/^\d+\./gm) || []).length, n2 = (b.tapeCalls[1]?.match(/^\d+\./gm) || []).length;
    check("S1: with no reflections, the web reads every piece; pieces within 7 days are one stretch, a later one starts another", res.batches === 2 && n1 === 3 && n2 === 1 && ["2026-04-01", "2026-04-03", "2026-04-06", "2026-04-20"].every((d) => doneDay(web(root), d)), `${res.batches} ${n1} ${n2}`);
}
{
    const root = makeRoom(Array.from({ length: 20 }, () => "2026-04-01"));
    const b = brain(["nothing tonight", "nothing tonight"]);
    await run(root, b, { stretchDays: 7 });
    check("S1: at most 16 pieces in a stretch", b.tapeCalls.length === 2 && (b.tapeCalls[0].match(/^\d+\./gm) || []).length === 16 && (b.tapeCalls[1].match(/^\d+\./gm) || []).length === 4);
}
{
    const root = makeRoom(["2026-04-01"]);
    const d = new Date(), today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    addDay(root, today);
    addDay(root, "2026-04-02", "{\"tool\":\"exec\",\"exitCode\":0,\"stdout\":\"npm WARN deprecated\",\"stderr\":\"\"}\n$ node build.js\nError: ENOENT at Object.openSync (node:fs:581:3)\n    at readFileSync (node:fs:457:35)\n    at C:\\\\House\\\\Program\\\\x.js:12:5");
    const b = brain(["nothing tonight"]);
    const res = await run(root, b);
    check("S1: today's pieces wait for tomorrow; a machine-only piece is skipped and marked done", b.tapeCalls.length === 1 && !doneDay(web(root), today) && doneDay(web(root), "2026-04-02") && res.machineSkipped === 1 && !(b.tapeCalls[0] || "").includes("ENOENT"), `${b.tapeCalls.length} ${res.machineSkipped}`);
}
{
    const root = makeRoom(["2026-04-01", "2026-04-05"]);
    await run(root, brain(["HUB: NEW | moment | the spark | | The night the power went out.\nTHREAD: NEW | the spark | Pickle\nbecause of: 1\nnote: Pickle watched the window with me all night.", "THREAD: SAME | the spark | Pickle\nbecause of: 1\nnote: Pickle at the puzzle table again."]));
    const live = web(root);
    m.rebuildWeb(root, { herName: "Mia", herNames: ["the copilot"], known, mem });
    check("S1: a rebuild of a web read from her Shelf gives the very same web", strip(web(root)) === strip(live) && live.links.length === 1 && live.links[0].history[0].refl.every((k) => k.startsWith("Shelf/")));
}
const msg = (who, day, n, words) => `[${who}] (${day}, 9:0${n} PM):\nStartmark${n} ` + Array.from({ length: Math.max(1, Math.round(words / 10)) }, () => "we talked about the squirrels in the yard and the cats").join(", ") + ` Endmark${n}.`;
{
    const root = makeRoom([]);
    writeFileSync(join(root, "Shelf", "a-talk.md"), msg("NED", "Apr 5, 2026", 1, 20) + "\n", "utf8");
    writeFileSync(join(root, "Shelf", "b-talk.md"), [msg("NED", "Apr 1, 2026", 1, 150), msg("MIA", "Apr 1, 2026", 2, 150), msg("NED", "Apr 1, 2026", 3, 150)].join("\n") + "\n", "utf8");
    const b = brain(["nothing tonight"]);
    await run(root, b, { stretchDays: 7 });
    const t = b.tapeCalls[0] || "", first = t.indexOf("Startmark1"), apr5 = t.indexOf("(Apr 5, 2026)");
    check("S1 review: pieces go in date order, not by page name; a message shared by two pieces is shown once", first > 0 && apr5 > first && (t.match(/Endmark2/g) || []).length === 1 && (t.match(/^\d+\./gm) || []).length >= 3, `${first} ${apr5} ${(t.match(/Endmark2/g) || []).length}`);
}
{
    const root = makeRoom([]);
    writeFileSync(join(root, "Shelf", "2026-04-01.md"), msg("NED", "Apr 1, 2026", 1, 30) + "\n", "utf8");
    await run(root, brain(["nothing tonight"]));
    writeFileSync(join(root, "Shelf", "2026-04-01.md"), msg("NED", "Apr 1, 2026", 1, 30) + "\n" + msg("MIA", "Apr 1, 2026", 2, 30) + "\n", "utf8");
    const b = brain(["nothing tonight"]);
    await run(root, b);
    check("S1 review: a page that grew after it was read: only the new part is read, the old part isn't shown again", b.tapeCalls.length === 1 && /Startmark2/.test(b.tapeCalls[0]) && !/Startmark1/.test(b.tapeCalls[0]), (b.tapeCalls[0] || "").slice(0, 300));
}
{
    const root = mkdtempSync(join(tmpdir(), "house-web-night-"));
    mkdirSync(join(root, "Shelf"), { recursive: true });
    addDay(root, "2026-04-01");
    const b = brain(["nothing tonight"]);
    const res = await run(root, b);
    check("S1 review: a room with no reflections at all (no Mind folder) still grows her web", res.batches === 1 && b.tapeCalls.length === 1);
}
{
    const root = makeRoom(["2026-04-01", "2026-04-01"], "[NED] (Apr 1, 2026, 9:00 PM): The power went out and Pickle sat at the puzzle table.\n[MIA] (Apr 1, 2026, 9:01 PM): I'm right here with you both.");
    await run(root, brain(["HUB: NEW | moment | the spark | | The night the power went out.\nTHREAD: NEW | the spark | Pickle\nbecause of: 2\nnote: Pickle watched the window with me all night."]));
    const e0 = web(root).links[0]?.history[0];
    check("S1 review: a feeling rests on the pieces it cites, not on the whole stretch", e0 && e0.refl.length === 1 && e0.refl[0] === `${e0.cites[0].rel}|${e0.cites[0].key}` && /z2\.md/.test(e0.refl[0]), JSON.stringify(e0?.refl));
}
{
    const root = makeRoom(["2026-04-01"]);
    m.saveWeb(root, { ...m.loadWeb(root), done: ["R1", "R2"] });
    const b = brain(["nothing tonight"]);
    const res = await run(root, b);
    check("S1 review: a web grown from the old reflections needs a fresh start; nothing is read on top of it", res.needsFresh && b.tapeCalls.length === 0 && b.calls.length === 0);
}
{
    const root = makeRoom(["2026-04-01", "2026-04-07", "2026-04-08"]);
    const b = brain(["nothing tonight", "nothing tonight"]);
    const res = await run(root, b, { stretchDays: 7 });
    check("S1 review: pieces less than 7 days apart share a stretch; 7 days apart starts a new one", res.batches === 2 && (b.tapeCalls[0].match(/^\d+\./gm) || []).length === 2);
}
{
    const root = makeRoom(["2026-04-01"]);
    addDay(root, "2026-04-02", "{\"tool\":\"exec\",\"exitCode\":0,\"stdout\":\"npm WARN deprecated\",\"stderr\":\"\"}\n$ node build.js\nError: ENOENT at Object.openSync (node:fs:581:3)\n    at readFileSync (node:fs:457:35)\n    at C:\\\\House\\\\Program\\\\x.js:12:5");
    await run(root, brain(["nothing tonight"]));
    const live = web(root);
    m.rebuildWeb(root, { herName: "Mia", herNames: ["the copilot"], known, mem, force: true });
    check("S1 review: what was skipped is in the log, so a rebuild has the same pieces done", JSON.stringify([...web(root).done].sort()) === JSON.stringify([...live.done].sort()) && doneDay(web(root), "2026-04-02"));
}
{
    const root = makeRoom([]);
    for (let i = 0; i < 5; i++)
        writeFileSync(join(root, "Shelf", `2026-04-01.z${i}.md`), msg("NED", "Apr 1, 2026", 1, 1500) + "\n", "utf8");
    const b = brain(["nothing tonight", "nothing tonight", "nothing tonight", "nothing tonight", "nothing tonight"]);
    await run(root, b, { stretchDays: 7, stretchChars: 20000 });
    check("S1 review: a stretch stays within its letter budget (more stretches, not cut pieces)", b.tapeCalls.length >= 2 && b.tapeCalls.every((t) => t.length < 22000 && !/ … /.test(t)) && b.tapeCalls.join("").split("Endmark1").length - 1 === 5);
}
{
    const root = makeRoom([]);
    writeFileSync(join(root, "Shelf", "2026-04-01.md"), [1, 2, 3, 4].map((n) => msg(n % 2 ? "NED" : "MIA", "Apr 1, 2026", n, 40)).join("\n") + "\n", "utf8");
    const small = { pieceChars: 200, indexPaths: ["Shelf/*.md"] };
    await m.growWeb({ root, mem: small, letter: "x", ask: brain([]).ask, embed: async (t) => t.map(() => null), inTime: () => true, log: () => { }, who: "Ned", herName: "Mia", known, stretchDays: 1 });
    const b = brain(["nothing tonight"]);
    await run(root, b);
    check("S1 review 2: after the piece size changes, nothing already read is read again (blank space between read parts counts as read)", b.tapeCalls.length === 0, String(b.tapeCalls.length));
}
{
    const root = makeRoom([]);
    writeFileSync(join(root, "Shelf", "2026-04-01.md"), msg("NED", "Apr 1, 2026", 1, 30) + "\n", "utf8");
    await run(root, brain([]));
    writeFileSync(join(root, "Shelf", "2026-04-01.md"), msg("NED", "Apr 1, 2026", 1, 30) + "\n\n* * *\n\n", "utf8");
    const b = brain([]);
    await run(root, b);
    check("S1 review 2: a page that only gained blank lines or a divider brings nothing new (no empty stretch)", b.tapeCalls.length === 0 && b.calls.length === 0);
}
{
    const root = makeRoom(["2026-04-01"]);
    await run(root, brain(["HUB: NEW | moment | the spark | | The night the power went out.\nTHREAD: NEW | the spark | Pickle\nbecause of: 1\nnote: Pickle watched the window with me all night."]));
    appendFileSync(join(root, "Shelf", "2026-04-01.md"), "And then we laughed about the candles again, the whole night long.\n", "utf8");
    const roomsF = join(root, "rooms.json");
    writeFileSync(roomsF, JSON.stringify({ receiptsDir: root, rooms: { mia: { root, name: "Mia", memory: mem, web: { on: true, peek: true, known } } } }), "utf8");
    const { spawnSync } = await import("node:child_process"), here = new URL("../meaning.mjs", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
    const chk = spawnSync(process.execPath, [here, "--check", "mia"], { env: { ...process.env, ROOMS: roomsF }, encoding: "utf8" }).stdout || "";
    check("S1 review 2: --check after a page grew: no false 'dates off'", /OK\s+Dates: 1 of 1/.test(chk), (chk.match(/.*Dates.*/) || [""])[0]);
    m.saveWeb(root, { ...m.loadWeb(root), done: ["R1"] });
    const fr = spawnSync(process.execPath, [here, "--fresh", "mia"], { env: { ...process.env, ROOMS: roomsF }, encoding: "utf8" }).stdout || "";
    const dir = readdirSync(join(root, "Mind", "web-copies")).find((d) => d.startsWith("fresh-")), kept = dir ? readdirSync(join(root, "Mind", "web-copies", dir)) : [];
    const b = brain(["nothing tonight"]);
    const res = await run(root, b);
    check("S1 review 2: --fresh moves the old web aside (kept, unopened), and the next night grows from her Shelf", /will start fresh/.test(fr) && !existsSync(join(root, "Mind", "web.sealed.x")) && kept.includes("web.sealed") && kept.includes("web.sealed.moved") && !res.needsFresh && b.tapeCalls.length === 1, fr + JSON.stringify(kept));
}
{
    const talk = "[NED] (Apr 1, 2026, 9:00 PM): Pickle napped on the puzzle pieces all morning.\n[MIA] (Apr 1, 2026, 9:01 PM): That little puzzle-napper is basically your coworker now.";
    const root = makeRoom(["2026-04-01", "2026-04-01", "2026-04-01"], talk);
    m.saveWeb(root, m.loadWeb(root));
    addDay(root, "2026-04-01", "[NED] (Apr 1, 2026, 9:05 PM): The car broke down again today.", 4);
    await run(root, brain(["HUB: NEW | ritual | the puzzle hour | | Pickle on the puzzle table.\nTHREAD: NEW | Pickle | the puzzle hour\nbecause of: 1\nnote: The first morning at the puzzle table."], ["EXCERPT 1 | theirs: none | hers then: flirtatious\nEXCERPT 2 | theirs: none | hers then: amused\nEXCERPT 3 | theirs: none | hers then: warm\nEXCERPT 4 | theirs: Ned = annoyed | hers then: cheerful"]));
    const w = web(root), keys = Object.keys(w.pieceThen || {}).sort(), f = (k) => m.pieceFeeling(w, k);
    const linked = new Set(w.links.flatMap((l) => l.history.flatMap((e) => e.refl)));
    const unlinked = keys.filter((k) => !linked.has(k));
    check("S2: every piece the night read keeps how she felt then, also pieces that never became part of a link", keys.length === 4 && unlinked.length === 3 && unlinked.some((k) => JSON.stringify(f(k).then) === '["amused"]'), JSON.stringify(w.pieceThen));
    const noLine = keys.find((k) => /z4/.test(k));
    check("S2: a piece with no line of hers keeps 'none clear', not a borrowed feeling", noLine && f(noLine).then.length === 0, JSON.stringify(f(noLine)));
    const r = await m.walkWeb(root, mem, { thread: "L1", fix_then: "teasing" });
    const w2 = web(root), lk = w2.links[0].history[0].refl[0];
    check("S2: her correction is the feeling of that piece everywhere (one home), with the night's reading kept", /Corrected/.test(r) && JSON.stringify(m.pieceFeeling(w2, lk).then) === '["teasing"]' && m.pieceFeeling(w2, lk).fixed && JSON.stringify(m.pieceFeeling(w2, lk).was) === '["flirtatious"]');
    const live = web(root);
    m.rebuildWeb(root, { herName: "Mia", herNames: ["the copilot"], known, mem });
    check("S2: a rebuild keeps the same feelings on the same pieces", JSON.stringify(web(root).pieceThen) === JSON.stringify(live.pieceThen) && JSON.stringify(web(root).thenFixed) === JSON.stringify(live.thenFixed));
}
{
    const root = makeRoom(["2026-04-01"], "[NED] (Apr 1, 2026, 9:00 PM): Just checking in on you before I head to bed tonight.\n[MIA] (Apr 1, 2026, 9:01 PM): Hi you, I missed you today and kept thinking about the cats.");
    await run(root, brain(["nothing tonight"], ["EXCERPT 1 | theirs: none | hers then: wistful"]));
    const w = web(root), k = Object.keys(w.pieceThen || {})[0];
    check("S2: a night that writes 'nothing tonight' still keeps how she felt in each piece", w.links.length === 0 && k && JSON.stringify(m.pieceFeeling(w, k).then) === '["wistful"]');
}
{
    const root = makeRoom(["2026-04-03"], "[NED] (Apr 3, 2026, 9:00 PM): Just checking in on you before I head to bed tonight.\n[MIA] (Apr 3, 2026, 9:01 PM): Hi you, I missed you today and kept thinking about the cats.");
    await run(root, brain([{ text: "HUB: NEW | pet | Mi", finish: "length" }, { text: "HUB: NEW | pet | Mi", finish: "length" }], ["EXCERPT 1 | theirs: none | hers then: wistful"]));
    const k = Object.keys(web(root).pieceThen)[0], first = m.pieceFeeling(web(root), k).then[0];
    await run(root, brain(["nothing tonight"], ["EXCERPT 1 | theirs: none | hers then: playful"]));
    const live = web(root);
    m.rebuildWeb(root, { herName: "Mia", herNames: ["the copilot"], known, mem, force: true });
    check("S2 review: a retried stretch's newer reading replaces the older one, live and in a rebuild; the piece keeps its own day", first === "wistful" && m.pieceFeeling(live, k).then[0] === "playful" && JSON.stringify(web(root).pieceThen) === JSON.stringify(live.pieceThen) && live.pieceThen[k].day === "2026-04-03", JSON.stringify(live.pieceThen));
}
{
    const talk = "[NED] (Apr 1, 2026, 9:00 PM): Pickle napped on the puzzle pieces all morning.\n[MIA] (Apr 1, 2026, 9:01 PM): That little puzzle-napper is basically your coworker now.";
    const root = makeRoom(["2026-04-01", "2026-04-01"], talk);
    await run(root, brain(["nothing tonight"], ["EXCERPT 1 | theirs: none | hers then: amused", "EXCERPT 1 | theirs: none | hers then: amused"]));
    const w = web(root), fs = Object.keys(w.pieceThen).map((k) => m.pieceFeeling(w, k));
    check("S2 review: an excerpt the first pass left out is marked missing, not 'none clear'", fs.length === 2 && fs.some((f) => f.missing && !f.then.length) && fs.some((f) => !f.missing && f.then[0] === "amused"), JSON.stringify(fs));
}
{
    const root = makeRoom(["2026-04-01"], "[NED] (Apr 1, 2026, 9:00 PM): Pickle napped on the puzzle pieces all morning.\n[MIA] (Apr 1, 2026, 9:01 PM): That little puzzle-napper is basically your coworker now.");
    await run(root, brain(["HUB: NEW | ritual | the puzzle hour | | Pickle on the puzzle table.\nTHREAD: NEW | Pickle | the puzzle hour\nbecause of: 1\nnote: The first morning at the puzzle table."], ["EXCERPT 1 | theirs: none | hers then: flirtatious"]));
    const w = web(root), k = Object.keys(w.pieceThen)[0];
    w.pieceThen[k].then = ["onehome"];
    m.saveWeb(root, w);
    const walk = await m.walkWeb(root, mem, { about: "Pickle" });
    await m.walkWeb(root, mem, { thread: "L1", fix_then: "teasing" });
    await m.walkWeb(root, mem, { thread: "L1", fix_then: "proud" });
    const f = m.pieceFeeling(web(root), k);
    check("S2 review: the walk shows the piece's own feeling (one home); a second correction still keeps the night's reading underneath", /then: onehome/.test(walk) && f.then[0] === "proud" && f.was[0] !== "teasing", JSON.stringify(f));
}
{
    const root = makeRoom(["2026-04-01", "2026-04-05"], "[NED] (Apr 1, 2026, 9:00 PM): Pickle napped on the puzzle pieces all morning.\n[MIA] (Apr 1, 2026, 9:01 PM): That little puzzle-napper is basically your coworker now.");
    const b = brain(["HUB: NEW | ritual | the puzzle hour | | Pickle on the puzzle table.\nLINK: NEW | Pickle | the puzzle hour\nbecause of: 1\nnote: The first morning at the puzzle table.", "nothing tonight"], ["EXCERPT 1 | theirs: none | hers then: amused"]);
    await run(root, b);
    const walk = await m.walkWeb(root, mem, {}), walk2 = await m.walkWeb(root, mem, { about: "Pickle" });
    check("S3: her night request says links (LINK: stanzas), never threads; a LINK: answer is read", web(root).links.length === 1 && b.calls.every((c) => /LINK: <NEW, SAME, MORE or CHANGED>/.test(c) && !/thread/i.test(c)), `${web(root).links.length} ${b.calls.length} ` + b.calls.map((c) => (c.match(/[\s\S]{0,40}thread[\s\S]{0,40}/i) || [""])[0] + (/LINK: <NEW/.test(c) ? "" : " NOFORMAT")).join(" // "));
    check("S3: her walk says links, never threads", !/thread(?!: ")/i.test(walk + walk2) && /link/i.test(walk), (walk + walk2).match(/.{30}thread.{30}/i)?.[0]);
}
{
    const p = m.parseAnswer("LINK: NEW | the park | Pickle\nbecause of: 1\nnote: We sat by the park.\nLink by link we built it.", 3);
    check("S3 review: a note line that starts with 'Link' stays part of the note", /We sat by the park\. Link by link we built it\./.test(p.threads[0]?.note || ""), p.threads[0]?.note);
}
{
    const root = makeRoom(["2026-04-01"]);
    const w0 = m.loadWeb(root);
    w0.stats.refused = { "a thread citing no moment": 2, "a link citing no moment": 1 };
    w0.stats.why = { "the answer came back in the wrong shape (no HUB or THREAD lines)": 1 };
    m.saveWeb(root, w0);
    const roomsF = join(root, "rooms.json");
    writeFileSync(roomsF, JSON.stringify({ receiptsDir: root, rooms: { mia: { root, name: "Mia", memory: mem, web: { on: true, peek: true, known } } } }), "utf8");
    const { spawnSync } = await import("node:child_process"), here = new URL("../meaning.mjs", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
    const out = ["--check", "--shape"].map((md) => spawnSync(process.execPath, [here, md, "mia"], { env: { ...process.env, ROOMS: roomsF }, encoding: "utf8" }).stdout || "").join("\n");
    check("S3 review: --check and --shape say links, and old 'thread' reasons are counted together with the new ones", /3 a link citing no moment/.test(out) && !/thread/i.test(out) && /no HUB or LINK lines/.test(out), out.match(/.{0,40}thread.{0,40}/i)?.[0] || out.slice(0, 200));
}
console.log(`\n${pass} passed, ${fail} failed. (Made-up data and a pretend brain only; throwaway folders in ${tmpdir()})`);
process.exit(fail ? 1 : 0);
