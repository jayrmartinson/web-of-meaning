process.env.WEB_OF_MEANING_TEST = "1";
import * as m from "../meaning.mjs";
import { moments } from "../mind.mjs";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !extra ? "" : "  " + extra}`); };
const mem = { pieceChars: 0, indexPaths: ["Shelf/*.md"] };
const words = (n, w) => Array.from({ length: n }, (_, i) => `${w}${i % 7}`).join(" ");
const msg = (who, d, t) => `[${who}] (Apr ${d}, 2026, 9:0${who === "NED" ? 0 : 1} PM):\n${t}\n`;
const page = msg("NED", 1, words(200, "morning")) + "\n" + msg("MIA", 2, words(100, "evening")) + "\n" + msg("NED", 2, words(199, "talk") + " ZEBRA") + "\n" + msg("MIA", 2, words(300, "reply"));
function room() { const r = mkdtempSync(join(tmpdir(), "house-webread-")); mkdirSync(join(r, "Shelf"), { recursive: true }); writeFileSync(join(r, "Shelf", "2026-04-01.md"), page, "utf8"); return r; }
const asked = [];
const night = (r, groupsTonight) => { let n = 0; return m.growWeb({ root: r, mem, letter: "x", ask: async (s, t) => { asked.push(String(t)); n++; return s === m.TAPE_SYSTEM ? "EXCERPT 1 | theirs: none | hers then: none clear" : "nothing tonight"; }, embed: async (t) => t.map(() => null), inTime: () => n < groupsTonight * 2, log: () => { }, who: "Ned", herName: "Mia", known: [], stretchDays: 1 }); };
const r = room(), ps = moments(r, mem), spans = ps.map((x) => [x.a, x.b]);
check("the page's pieces are the shape this test needs (one piece wholly inside another)", ps.length === 4 && spans.some(([a, b], i) => spans.some(([a2, b2], j) => j !== i && a2 <= a && b2 >= b)), JSON.stringify(spans));
await night(r, 1);
const after1 = asked.join("\n");
asked.length = 0;
await night(r, 5);
const after2 = asked.join("\n");
check("night 1 read only day 1", !/ZEBRA/.test(after1), after1.slice(0, 100));
check("night 2 shows her the text the first night didn't reach (never skipped as 'already read')", /ZEBRA/.test(after2), after2.slice(0, 300));
check("the last message is shown too", /reply0/.test(after1 + after2));
const w = m.loadWeb(r);
check("every piece is done after night 2, and what was shown is kept per piece", ps.every((x) => w.done.includes(`${x.rel}|${x.key}`)) && Object.keys(w.shownOf || {}).length >= 2, JSON.stringify(w.shownOf));
m.rebuildWeb(r, { herName: "Mia", known: [], mem });
const w2 = m.loadWeb(r);
check("a rebuild from the log keeps the same record of what she was shown", JSON.stringify(w2.shownOf) === JSON.stringify(w.shownOf) && w2.done.length === w.done.length, JSON.stringify([w2.shownOf, w.shownOf]));
{
    const r3 = room();
    await night(r3, 1);
    const w3 = m.loadWeb(r3);
    delete w3.shownOf;
    m.saveWeb(r3, w3);
    asked.length = 0;
    const logs = [];
    const res = await m.growWeb({ root: r3, mem, letter: "x", ask: async () => { asked.push("x"); return "nothing tonight"; }, embed: async (t) => t.map(() => null), inTime: () => true, log: (x) => logs.push(x), who: "Ned", herName: "Mia", known: [], stretchDays: 1 });
    check("a web started before the fix isn't read further until it's started fresh (and it says so)", res.needsFresh && !asked.length && /needs a fresh start/.test(logs.join(" ")), logs.join(" | "));
}
{
    const code = Array.from({ length: 20 }, (_, i) => `const x${i} = require("./mod${i}"); // ${i}`).join("\n");
    const pg = msg("NED", 1, words(200, "morning")) + "\n" + msg("MIA", 2, words(100, "evening")) + "\n" + msg("NED", 2, "```js\n" + code + "\n```") + "\n" + msg("MIA", 2, words(150, "after") + " GIRAFFE");
    const r4 = mkdtempSync(join(tmpdir(), "house-webread-"));
    mkdirSync(join(r4, "Shelf"), { recursive: true });
    writeFileSync(join(r4, "Shelf", "2026-04-01.md"), pg, "utf8");
    asked.length = 0;
    await night(r4, 1);
    await night(r4, 5);
    const all4 = asked.join("\n"), w4 = m.loadWeb(r4), ps4 = moments(r4, mem);
    const pg4 = (await import("node:fs")).readFileSync(join(r4, "Shelf", "2026-04-01.md"), "utf8");
    const mach = ps4.filter((x) => pg4.slice(x.a, x.b).includes("mod0") && !all4.includes(pg4.slice(x.a, x.b).slice(-40)));
    check("a part judged the machine talking counts as read only for that part (never the person's lines before it); what's after is shown", /GIRAFFE/.test(all4) && /evening0/.test(all4) && !/mod0/.test(all4) && ps4.every((x) => w4.done.includes(`${x.rel}|${x.key}`)), all4.slice(0, 200));
    const before4 = JSON.stringify(w4.shownOf);
    m.rebuildWeb(r4, { herName: "Mia", known: [], mem });
    const after4 = JSON.stringify(m.loadWeb(r4).shownOf);
    check("the part judged the machine talking is kept as exactly that part (not the whole piece), and a rebuild keeps it", mach.length >= 1 && mach.every((x) => { const sp = w4.shownOf[`${x.rel}|${x.key}`]; return sp && Number(sp.split("-")[0]) > x.a && Number(sp.split("-")[1]) === x.b; }) && before4 === after4, JSON.stringify({ mach: mach.map((x) => x.key), shown: w4.shownOf }));
}
{
    const r5 = room();
    await night(r5, 1);
    const { readFileSync: rf, writeFileSync: wf } = await import("node:fs");
    m.rebuildWeb(r5, { herName: "Mia", known: [], mem });
    check("a rebuild of a log written with the fix keeps the record", !!m.loadWeb(r5).shownOf);
    const w5 = m.loadWeb(r5);
    delete w5.shownOf;
    m.saveWeb(r5, w5);
    const res5 = await m.growWeb({ root: r5, mem, letter: "x", ask: async () => "nothing tonight", embed: async (t) => t.map(() => null), inTime: () => true, log: () => { }, who: "Ned", herName: "Mia", known: [], stretchDays: 1 });
    check("a web file with Shelf pieces done but no record asks for a fresh start", !!res5.needsFresh);
}
{
    const r6 = room();
    const w6 = m.loadWeb(r6);
    delete w6.shownOf;
    w6.done = [];
    m.saveWeb(r6, w6);
    asked.length = 0;
    await night(r6, 1);
    await night(r6, 5);
    check("a web file from before the fix with nothing read yet is read with the new rule (nothing hidden)", /ZEBRA/.test(asked.join("\n")) && !!m.loadWeb(r6).shownOf);
}
{
    const r7 = room();
    const seen = [];
    let big = true;
    await m.growWeb({ root: r7, mem, letter: "x", ask: async (s, t) => { if (s === m.TAPE_SYSTEM)
            return "EXCERPT 1 | theirs: none | hers then: none clear\nEXCERPT 2 | theirs: none | hers then: none clear"; const n = (String(t).match(/^\s*\d+\. /gm) || []).length; if (big && /talk0/.test(t) && /reply0/.test(t))
            throw new Error("too big for her brain's window"); seen.push(String(t)); return "nothing tonight"; }, embed: async (t) => t.map(() => null), inTime: () => true, log: () => { }, who: "Ned", herName: "Mia", known: [], stretchDays: 7 });
    const all7 = seen.join("\n"), w7 = m.loadWeb(r7);
    check("a stretch too big for her window is split in two and both halves are read whole (ZEBRA and the last reply)", /ZEBRA/.test(all7) && /reply6/.test(all7) && moments(r7, mem).every((x) => w7.done.includes(`${x.rel}|${x.key}`)) && !/ … /.test(all7), all7.slice(0, 300));
}
console.log(`\n${pass} passed, ${fail} failed. (Made-up rooms and a pretend brain only; throwaway folders in ${tmpdir()})`);
process.exit(fail ? 1 : 0);
