process.env.WEB_OF_MEANING_TEST = "1";
import * as m from "../meaning.mjs";
import { seal } from "../seal.mjs";
import { unlockOnThisPC } from "../lock.mjs";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`); };
const mk = () => ({ v: 1, nextH: 1, nextL: 1, done: [], hubs: [], links: [], aside: [], peeked: [], stats: { batches: 0, unusable: 0, rejected: 0, nothing: 0 } });
const mo = [{ rel: "x", key: "0-1" }];
const ev = (from, hubs, threads = [], groups = []) => ({ t: Date.parse(from), from, to: from, refl: ["R" + from], moments: mo, hubs, threads, groups });
const hub = (type, name, aliases = [], about = "") => ({ ref: "NEW", type, name, aliases, about });
const cats = [{ name: "Penelope", type: "pet", aliases: ["Penny", "Penellope"] }, { name: "Pickle", type: "pet", aliases: [] }, { name: "Sparkie", type: "pet", aliases: ["Sparky"] }, { name: "Kit", type: "person", aliases: ["Kitti", "Kitty"] }];
{
    const w = mk();
    m.applyEvent(w, ev("2026-04-01", [hub("stretch", "the cold weeks")]));
    m.applyEvent(w, ev("2026-04-10", [hub("stretch", "the cold weeks")]));
    m.applyEvent(w, ev("2026-06-01", [hub("stretch", "the cold weeks")]));
    check("c: same-named stretches 7 weeks apart stay two, 9 days apart are one", w.hubs.length === 2);
}
{
    const w = mk();
    m.applyEvent(w, ev("2026-04-01", [hub("group", "the cats", ["Penny", "Pickle", "Sparky", "the furballs"], "All three cats.")]), { known: cats });
    const g = w.hubs.find((h) => h.type === "group");
    check("b/M23: 'the cats' with the cats as other names stays a group of 3 members", g && g.members.length === 3 && JSON.stringify(g.aliases) === '["the furballs"]');
}
{
    const w = mk();
    m.applyEvent(w, ev("2026-04-01", [hub("person", "Pickle"), hub("pet", "Kitti"), hub("group", "Pickle and Kit")]), { known: cats });
    check("M23: 'Pickle' written as a person is the cat; 'Kitti' written as a pet is Kit", w.hubs.find((h) => h.name === "Pickle")?.type === "pet" && w.hubs.find((h) => h.name === "Kit")?.type === "person" && w.hubs.length === 3);
}
{
    const w = mk();
    m.applyEvent(w, ev("2026-04-01", [hub("pet", "Bean")]));
    m.applyEvent(w, ev("2026-04-02", [hub("group", "the gang", ["Bean"])]));
    check("M17: a group can't take a cat's name as its other name", (w.hubs.find((h) => h.type === "group")?.aliases || []).length === 0);
}
{
    const w = mk();
    const r = m.applyEvent(w, ev("2026-04-01", [hub("person", "Ned"), hub("thing", "our relationship")], [{ a: "x", b: "y", kind: "NEW", feel: [], note: "no real moment under this one", nums: [] }]), { selfNames: ["Ned", "Mia"] });
    check("guards: no Ned dot, no 'our relationship' dot, no thread without a moment", w.hubs.length === 0 && w.links.length === 0 && r.rejected === 3);
}
{
    const hubs = [{ id: "H1", type: "place", name: "home", seen: ["a", "b"] }, { id: "H2", type: "pet", name: "Pickle", seen: ["a", "b"] }, { id: "H3", type: "place", name: "the porch", seen: ["a", "b"] }];
    const link = (id, a, b) => ({ id, a, b, strength: 0.5, last: "2026-10-01", history: [{ until: null, refl: [] }] });
    const links = [link("L1", "H1", "H2"), link("L2", "H2", "H3")];
    for (let i = 4; i < 16; i++) {
        hubs.push({ id: "H" + i, type: "thing", name: "t" + i, seen: ["a", "b"] });
        links.push(link("L" + i, "H1", "H" + i));
    }
    const p = m.personalizedPageRank({ hubs, links, aside: [] }, ["H2"], { today: "2026-10-01" });
    check("1: a dot tied to 13 things doesn't outrank a quiet neighbour", p.get("H3") > p.get("H1"));
}
{
    const p = m.parseAnswer("HUB: NEW | group | the cats | Penelope, Pickle, Sparkie, the house cats\nHUB: NEW | pet | Mochi | The grey cat who knocks cups, keys and pens off the desk.\nHUB: NEW | pet | Sparkie | Sparky, the queen | All white, the queen.", 3);
    check("7/M23: a sentence in the names spot is the description; a comma list of names stays names", p.hubs[0].aliases.length === 4 && !p.hubs[0].about && p.hubs[1].aliases.length === 0 && /grey cat/.test(p.hubs[1].about) && p.hubs[2].aliases.length === 2);
}
{
    const w = mk();
    w.hubs.push({ id: "H1", type: "pet", name: "Pickle", aliases: [] }, { id: "H2", type: "place", name: "the porch", aliases: [] });
    const r = m.applyEvent(w, { ...ev("2026-04-02", [], [{ a: "H1", b: "H2", kind: "NEW", feel: [], note: "Bean naps on the porch rail.", nums: [1] }]), ids: { H1: { type: "pet", name: "Bean" } } });
    check("M24 E1: a lost dot's number isn't reused for another dot", w.links.length === 0 && r.rejected === 1);
}
const root = mkdtempSync(join(tmpdir(), "house-web-test-"));
mkdirSync(join(root, "Mind"), { recursive: true });
{
    m.saveWeb(root, { ...mk(), hubs: [{ id: "H1", type: "person", name: "Kit", aliases: ["Kitti"] }, { id: "H2", type: "pet", name: "Pickle", aliases: [] }, { id: "H3", type: "person", name: "Nyx", aliases: [] }],
        links: [{ id: "L1", a: "H1", b: "H2", strength: 0.5, last: "2026-04-01", history: [{ note: "x", until: null, refl: [] }] }, { id: "L2", a: "H3", b: "H2", strength: 0.5, last: "2026-04-01", history: [{ note: "x", until: null, refl: [] }] }] });
    const t = (s) => !!m.webHint(root, s);
    check("6/M23: Kit's, Nyx's, Pickle's, Kit’s and Kitti match; kite and nyxlike don't", t("Kit's room") && t("Nyx's song") && t("Pickle's bowl") && t("Kit’s curly") && t("kitti was sweet") && !t("the kite burst") && !t("nyxlike"));
}
{
    const E = [
        ev("2026-04-01", [hub("pet", "Bean"), hub("place", "the porch")]),
        ev("2026-04-05", [hub("pet", "Pickle"), hub("thing", "the radio")], [{ a: "H4", b: "H2", kind: "NEW", feel: ["warm"], note: "The radio hums on the porch side of the house.", nums: [1], where: "porch" }]),
        ev("2026-04-09", [], [{ a: "H1", b: "H4", kind: "NEW", feel: ["fond"], note: "Bean sleeps on the warm radio every night.", nums: [1] }, { a: "H3", b: "H2", kind: "NEW", feel: ["happy"], note: "Pickle loves sitting out on the porch.", nums: [1], where: "porch" }])
    ];
    const live = mk();
    for (const e of E)
        m.applyEvent(live, e, { known: [{ name: "Pickle", type: "pet", aliases: [] }] });
    live.aside = ["H4", "L3"];
    live.peeked = ["L2"];
    m.saveWeb(root, live);
    const key = unlockOnThisPC(JSON.parse(readFileSync(join(root, "Vault", "web-key.locked"), "utf8")));
    writeFileSync(join(root, "Mind", "web-events.sealed"), E.map((e) => seal(key, JSON.stringify(e))).join("\n") + "\n");
    m.rebuildWeb(root, { known: [{ name: "Pickle", type: "pet", aliases: ["Bean"] }] });
    const w = m.loadWeb(root), id = (n) => w.hubs.find((h) => h.name === n)?.id, link = (a, b) => w.links.find((l) => (l.a === id(a) && l.b === id(b)) || (l.a === id(b) && l.b === id(a)))?.id;
    check("a: after 'Bean is Pickle' + rebuild, all threads, set-asides and the peek mark land on the right dots", w.links.length === 3 && link("the radio", "the porch") && link("Pickle", "the radio") && link("Pickle", "the porch") && w.aside.includes(id("the radio")) && w.aside.includes(link("Pickle", "the porch")) && w.peeked.includes(link("Pickle", "the radio")));
}
{
    const r3 = mkdtempSync(join(tmpdir(), "house-web-test-"));
    mkdirSync(join(r3, "Mind"));
    writeFileSync(join(r3, "Mind", "web.building"), JSON.stringify({ pid: process.pid, t: Date.now() - 3 * 3600e3, beat: Date.now() - 2 * 3600e3 }));
    let refusedOld = false;
    try {
        m.rebuildWeb(r3, {});
    }
    catch {
        refusedOld = true;
    }
    writeFileSync(join(r3, "Mind", "web.building"), JSON.stringify({ pid: process.pid, t: Date.now(), beat: Date.now() }));
    let refusedNew = false;
    try {
        m.rebuildWeb(r3, {});
    }
    catch {
        refusedNew = true;
    }
    check("M24 E3: a marker quiet for 2 hours doesn't block; a fresh one does", !refusedOld && refusedNew);
}
console.log(`\n${pass} passed, ${fail} failed. (Made-up data only; a throwaway folder: ${root})`);
process.exit(fail ? 1 : 0);
