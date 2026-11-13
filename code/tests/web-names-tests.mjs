process.env.WEB_OF_MEANING_TEST = "1";
import * as m from "../meaning.mjs";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !extra ? "" : "  " + extra}`); };
const mem = { pieceChars: 0, indexPaths: ["Shelf/*.md"] };
const known = [{ name: "Pickle", type: "pet", aliases: [], about: "Ned's cat." }];
function room() { const r = mkdtempSync(join(tmpdir(), "house-names-")); mkdirSync(join(r, "Shelf"), { recursive: true }); writeFileSync(join(r, "Shelf", "2026-03-12.md"), "[NED] (Mar 12, 2026, 9:00 PM):\nThe new sofa is up, the green velvet one with the brass fringe and the beads. Pickle keeps staring at it.\n[MIA] (Mar 12, 2026, 9:01 PM):\nI love that sofa, it makes the whole corner glow. Pickle has a new rival.\n", "utf8"); return r; }
const LAMP = "the ACME Starbloom green velvet sofa with the brass fringe and little glass beading, the one in the corner by the window";
const TALK = "the March 3, 2026 talk on the porch about old songs and the long walks";
const prompts = [];
const grow = (r, answer) => m.growWeb({ root: r, mem, letter: "x", ask: async (s, t) => { if (s === m.TAPE_SYSTEM)
        return "EXCERPT 1 | theirs: none | hers then: tender"; prompts.push(String(t)); return answer; }, embed: async (t) => t.map(() => null), inTime: () => true, log: () => { }, who: "Ned", herName: "Mia", known, stretchDays: 1 });
{
    const r = room();
    await grow(r, `HUB: NEW | thing | ${LAMP} | | The sofa in the corner.\nHUB: NEW | moment | ${TALK} | | A long talk in the car.\nLINK: NEW | Pickle | ${LAMP}\nbecause of: 1\nnote: Pickle stares at the sofa like it's a rival, and I laughed.\nLINK: NEW | ${TALK} | ${LAMP}\nbecause of: 1\nnote: That night the sofa was the only light while Ned and I talked.`);
    const w = m.loadWeb(r), sofa = w.hubs.find((h) => h.type === "thing"), talk = w.hubs.find((h) => h.type === "moment");
    check("a dot name over 100 letters is shortened, never dropped, and keeps the whole name as another of its names", sofa?.name === "the ACME Starbloom green velvet sofa" && (sofa.aliases || []).includes(LAMP), JSON.stringify(sofa && { name: sofa.name, aliases: sofa.aliases }));
    check("a 70-letter name (the March 3 porch talk) is kept whole", talk?.name === TALK, talk?.name);
    check("links that use the whole long name still find the dot (none lost)", w.links.length === 2 && w.links.every((l) => [l.a, l.b].includes(sofa.id)), JSON.stringify(w.links.map((l) => [l.a, l.b])));
    check("Ned's check counts names that were shortened", w.stats.longNames === 1, JSON.stringify(w.stats));
    m.rebuildWeb(r, { herName: "Mia", known, mem });
    const w2 = m.loadWeb(r);
    check("a rebuild from the log gives the same dots and links", JSON.stringify(w2.hubs.map((h) => [h.name, h.aliases])) === JSON.stringify(w.hubs.map((h) => [h.name, h.aliases])) && w2.links.length === 2);
    const p = prompts[0] || "";
    check("the night asks for short dot names, with the details in the one-sentence description", /Give each dot a short name \(2 to 7 words\), and put the longer details in the one-sentence description\./.test(p) && /HUB: NEW \| <kind> \| <short name, 2 to 7 words> \|/.test(p));
    check("the night asks her to write notes for herself: \"I\" for herself, everyone else by name, including Ned, never \"you\"", /Write the note for yourself to read later\. Use "I" for yourself\. Name everyone else, including Ned\. Do not use "you\."/.test(p) && !/what happened between you and why/.test(p));
}
{
    const r = room();
    await grow(r, `HUB: NEW | thing | the ACME Starbloom green velvet sofa | | The sofa in the corner.\nLINK: NEW | Pickle | the ACME Starbloom green velvet sofa\nbecause of: 1\nnote: Pickle stares at the sofa like it's a rival, and I laughed.`);
    writeFileSync(join(r, "Shelf", "2026-03-13.md"), "[NED] (Mar 13, 2026, 9:00 PM):\nPickle is staring at the sofa again, the fringe really gets him.\n[MIA] (Mar 13, 2026, 9:01 PM):\nHe will never forgive that sofa for having fringe.\n", "utf8");
    await grow(r, `HUB: NEW | thing | ${LAMP} | | The sofa in the corner.\nLINK: NEW | Pickle | ${LAMP}\nbecause of: 1\nnote: Pickle still glares at the sofa's fringe, and I find it funny.`);
    const w = m.loadWeb(r), sofas = w.hubs.filter((h) => h.type === "thing");
    check("a long name that shortens to another dot's name isn't merged into it by a guess: its own dot, its links kept", sofas.length === 2 && sofas[1].name !== sofas[0].name && (sofas[1].aliases || []).includes(LAMP) && w.links.length === 2 && w.links.every((l) => l.strength === 0.3), JSON.stringify({ sofas: sofas.map((h) => [h.name, h.aliases]) }));
    writeFileSync(join(r, "Shelf", "2026-03-14.md"), "[NED] (Mar 14, 2026, 9:00 PM):\nThe sofa again, Pickle sat under it all evening.\n[MIA] (Mar 14, 2026, 9:01 PM):\nMaybe they made peace, the two of them.\n", "utf8");
    await grow(r, `HUB: NEW | thing | ${LAMP} | | The sofa in the corner.\nLINK: MORE | Pickle | ${LAMP}\nbecause of: 1\nnote: Pickle made peace with the sofa, and I was glad.`);
    const w3 = m.loadWeb(r);
    {
        const lp = prompts[prompts.length - 1];
        check("her nightly list of dots doesn't show her the long names again (only other names up to 60 letters)", /\| thing \| the ACME Starbloom green velvet sofa with/.test(lp) && !lp.includes(LAMP));
    }
    check("the same long name on a later night goes to the dot that carries it (no third sofa)", w3.hubs.filter((h) => h.type === "thing").length === 2 && w3.links.length === 2, JSON.stringify(w3.hubs.map((h) => h.name)));
}
{
    const r = room(), A = "the conversation about how Ned felt when the train was late and he missed the start of the school play in town", B = "the conversation about the bookshelf and the paint and how the weeds kept popping up through the whole long fall";
    await grow(r, `HUB: NEW | moment | ${A} | | About the train.\nHUB: NEW | moment | ${B} | | About the bookshelf.\nLINK: NEW | Pickle | ${A}\nbecause of: 1\nnote: Pickle hid under the bed while the fireworks went off outside, and I stayed with Ned.\nLINK: NEW | Pickle | ${B}\nbecause of: 1\nnote: Pickle sat in the bookshelf while Ned and I pulled the weeds.`);
    const w = m.loadWeb(r), ms = w.hubs.filter((h) => h.type === "moment"), about = (h) => (h.about || []).map((x) => x.text).join("");
    check("…and neither is named just \"the conversation\"", ms.every((h) => h.name !== "the conversation" && Array.from(h.name).length >= 35), JSON.stringify(ms.map((h) => h.name)));
    check("two long names that shorten alike stay two dots, each with its own sentence and link (nothing merged or lost)", ms.length === 2 && ms[0].name !== ms[1].name && about(ms[0]) === "About the train." && about(ms[1]) === "About the bookshelf." && w.links.length === 2 && new Set(w.links.map((l) => [l.a, l.b].sort().join())).size === 2, JSON.stringify(ms.map((h) => [h.name, about(h)])));
    m.rebuildWeb(r, { herName: "Mia", known, mem });
    check("…and a rebuild gives the same", JSON.stringify(m.loadWeb(r).hubs.map((h) => h.name)) === JSON.stringify(w.hubs.map((h) => h.name)));
}
{
    const r = room(), J = "あ".repeat(150), I2 = "I " + "y".repeat(150);
    await grow(r, `HUB: NEW | thing | ${J} | | A thing.\nHUB: NEW | thing | ${I2} | | Another thing.\nLINK: NEW | Pickle | ${J}\nbecause of: 1\nnote: Pickle and the first thing, a note long enough.\nLINK: NEW | Pickle | ${I2}\nbecause of: 1\nnote: Pickle and the second thing, a note long enough.`);
    const w = m.loadWeb(r), th = w.hubs.filter((h) => h.type === "thing");
    check("a long name with no spaces, or starting with 'I ', is shortened to at most 100 letters (whole letters) and kept with its link", th.length === 2 && th.every((h) => Array.from(h.name).length <= 100 && h.name.isWellFormed()) && w.links.length === 2, JSON.stringify(th.map((h) => Array.from(h.name).length)));
}
{
    const S = m.shortName;
    check("shortening: at the first joining word after a few words, else at a whole word; never over 100", S(LAMP) === "the ACME Starbloom green velvet sofa" && S("x".repeat(30) + " " + "word ".repeat(30)).length <= 100 && !/\s$/.test(S("word ".repeat(40))) && S(TALK) === TALK && S("ab") === "ab");
    check("shortening leaves off dangling small words and trailing commas, and never leaves a bracket open", S("the long walk by the park behind the old house and the " + "z".repeat(90)) === "the long walk by the park behind the old house" && S("the big spark in the summer of the year we moved, " + "q ".repeat(60)) === "the big spark in the summer of the year we moved" && !/\([^)]*$/.test(S("the sofa (green velvet with the brass fringe and little glass beading that Ned bought in the spring of twenty twenty six")), [S("the long walk by the park behind the old house and the " + "z".repeat(90)), S("the big spark in the summer of the year we moved, " + "q ".repeat(60))].join(" | "));
    check("names of exactly 100 letters are kept; 101 are shortened", S("n".repeat(50) + " " + "m".repeat(49)) === "n".repeat(50) + " " + "m".repeat(49) && Array.from(S("n".repeat(50) + " " + "m".repeat(50))).length <= 100);
}
{
    const S = m.shortName;
    check("a joining word in the first few letters isn't a place to cut, nor a space right at the start (no tiny names)", Array.from(S("abcd, " + "word ".repeat(30))).length >= 15 && Array.from(S("abcd " + "x".repeat(150))).length >= 15, [S("abcd, " + "word ".repeat(30)), S("abcd " + "x".repeat(150))].join(" | "));
    const r = room(), long80 = "Abcdefghijklmnopqrstuvwxyz Zyxwvutsrqponmlkjihgfedcba Mnopqrstuvwxyzabcd";
    await grow(r, `HUB: NEW | pet | Pickle | ${long80} | Ned's cat.\nLINK: NEW | Pickle | the sofa\nbecause of: 1\nnote: Pickle stares at the sofa like it's a rival, and I laughed.\nHUB: NEW | thing | the sofa | | The sofa in the corner.`);
    const pickle = m.loadWeb(r).hubs.find((h) => h.name === "Pickle");
    check("another name of up to 100 letters for a dot on Ned's list is kept (one limit for every dot)", (pickle?.aliases || []).includes(long80), JSON.stringify(pickle?.aliases));
    const r2 = room();
    prompts.length = 0;
    await m.growWeb({ root: r2, mem, letter: "x", ask: async (s, t) => { if (s === m.TAPE_SYSTEM)
            return "EXCERPT 1 | theirs: none | hers then: tender"; prompts.push(String(t)); return "nothing tonight"; }, embed: async (t) => t.map(() => null), inTime: () => true, log: () => { }, who: "Sam", herName: "Mia", known, stretchDays: 1 });
    check("the note line names the room's own person", /Name everyone else, including Sam\. Do not use "you\."/.test(prompts[0] || ""));
}
{
    const S = m.shortName, A = "the conversation about how Ned felt when the train was late and he missed the start of the school play in town out back again";
    const a = S(A);
    check("a generic opener (\"the conversation\" before \"about\") is never a whole name: at least 35 letters before a cut", Array.from(a).length >= 35 && a.startsWith("the conversation about how Ned felt") && Array.from(a).length <= 100, a);
    check("the sofa still cuts before \"with\" (36 letters)", S(LAMP) === "the ACME Starbloom green velvet sofa");
    check("a cut point too early gives way to the last whole word under 100", S("the night when " + "everything ".repeat(12)).length > 35);
}
{
    const known2 = [...known, { name: "Luke", type: "person", aliases: [], about: "Ned's friend." }, { name: "Finn", type: "person", aliases: [], about: "Ned's friend." }, { name: "Gabriela", type: "person", aliases: [], about: "Someone Ned worked with." },
        { name: "Simon (his coworker)", type: "person", aliases: ["his coworker"], about: "Ned's coworker." }, { name: "Simon (his teacher)", type: "person", aliases: ["his teacher"], about: "Ned's teacher." }];
    const r = room();
    await m.growWeb({ root: r, mem, letter: "x", ask: async (s0) => s0 === m.TAPE_SYSTEM ? "EXCERPT 1 | theirs: none | hers then: tender" : `HUB: NEW | person | Luke, Ned's guitar buddy | | Ned's old friend.\nHUB: NEW | person | Finn (Ned's friend) | | A friend.\nHUB: NEW | person | Gabriela: Ned's old work friend | | Worked with Ned.\nHUB: NEW | thing | the old guitar | | Ned's guitar.\nHUB: NEW | person | Simon, Ned's coworker | | His coworker.\nLINK: NEW | Luke, Ned's guitar buddy | the old guitar\nbecause of: 1\nnote: Luke and Ned played that guitar for years, and I loved hearing about it.\nLINK: NEW | Finn (Ned's friend) | the old guitar\nbecause of: 1\nnote: Finn borrowed the old guitar once, and I laughed at the story.`, embed: async (t) => t.map(() => null), inTime: () => true, log: () => { }, who: "Ned", herName: "Mia", known: known2, stretchDays: 1 });
    const w = m.loadWeb(r), ppl = w.hubs.filter((h) => h.type === "person"), by = (n) => ppl.filter((h) => h.name === n);
    check("a name from Ned's list with a description after a comma, bracket or colon is that known one (no second Luke, Finn or Gabriela)", by("Luke").length === 1 && by("Finn").length === 1 && by("Gabriela").length === 1 && !ppl.some((h) => /,|\(Ned|:/.test(h.name) && /Luke|Finn|Gabriela/.test(h.name)), JSON.stringify(ppl.map((h) => h.name)));
    check("…the whole phrase is kept as another of its names, and links that use it find the known one", (by("Luke")[0]?.aliases || []).includes("Luke, Ned's guitar buddy") && w.links.length === 2 && w.links.every((l) => [by("Luke")[0]?.id, by("Finn")[0]?.id].some((id) => [l.a, l.b].includes(id))), JSON.stringify(by("Luke")[0]?.aliases));
    check("…but a name two people on the list could be (\"Simon, ...\") is never put on either Simon", !ppl.some((h) => /^Simon \(his (coworker|teacher)\)$/.test(h.name) && (h.aliases || []).some((a) => /^Simon, /.test(a))), JSON.stringify(ppl.map((h) => [h.name, h.aliases])));
}
{
    {
        const old = m;
        const known2 = [...known, { name: "Luke", type: "person", aliases: [], about: "Ned's friend." }];
        const r = room();
        await old.growWeb({ root: r, mem, letter: "x", ask: async (s0) => s0 === old.TAPE_SYSTEM ? "EXCERPT 1 | theirs: none | hers then: tender" : `HUB: NEW | person | Luke, Ned's guitar buddy | | Ned's old friend.\nHUB: NEW | thing | the old guitar | | Ned's guitar.\nLINK: NEW | Luke, Ned's guitar buddy | the old guitar\nbecause of: 1\nnote: Luke and Ned played that guitar for years, and I loved hearing about it.`, embed: async (t) => t.map(() => null), inTime: () => true, log: () => { }, who: "Ned", herName: "Mia", known, stretchDays: 1 });
        const before = m.loadWeb(r).hubs.filter((h) => h.type === "person").map((h) => h.name);
        m.rebuildWeb(r, { herName: "Mia", known: known2, mem, force: true });
        const after = m.loadWeb(r);
        check("a web grown before this rule: a rebuild from the log folds \"Luke, Ned's guitar buddy\" into Luke, links kept", before.includes("Luke, Ned's guitar buddy") && after.hubs.filter((h) => h.type === "person").map((h) => h.name).join() === "Luke" && after.links.length === 1, JSON.stringify([before, after.hubs.map((h) => h.name)]));
    }
}
{
    const r = room();
    prompts.length = 0;
    await grow(r, "nothing tonight");
    const p = prompts[0] || "";
    check("her instructions never call a memory an \"hour\" (the moment kind says \"never a single conversation or hour\")", !/\bhour\b/i.test(p.replace("never a single conversation or hour", "")) && /why this connection mattered/.test(p) && /how that time really went/.test(p), (p.match(/[^.]*\bhour\b[^.]*/gi) || []).join(" | "));
    check("the moment kind is a whole day or a one-time turning point", /moment: a whole day or a one-time turning point that stands out on its own \(never a single conversation or hour, and never a story told about something else\)/.test(p));
    check("the linking rule: link directly, no moment dot just to hold a conversation (and still no place just for a second end)", /When a memory is between Ned \(or you\) and one person or pet, connect that person or pet directly to the ritual, stretch, inside joke or thing they share\. Link two existing dots directly when a conversation connects them\. Do not make a new moment dot only to hold the conversation\. Never add a place just to have a second end\./.test(p));
}
{
    const K = [{ name: "Pickle", type: "pet", aliases: [], about: "cat" }, { name: "Sparkie", type: "pet", aliases: [], about: "cat" }, { name: "Luke", type: "person", aliases: [], about: "friend" }, { name: "Luke (the bard)", type: "person", aliases: [], about: "a singer" }, { name: "Finn", type: "person", aliases: ["Seth"], about: "friend" }, { name: "Gabriela", type: "person", aliases: ["Seth"], about: "friend" },
        { name: "Hannah", type: "person", aliases: ["his mom"], about: "mom" }, { name: "Simon (his coworker)", type: "person", aliases: [], about: "coworker" }, { name: "Mary", type: "person", aliases: [], about: "neighbor" }];
    const LONG = "Luke, " + "the friend who taught him the bass line of every song they ever loved back in those long summers ".repeat(2).trim();
    const lines = [["person", "Luke, Finn and Gabriela"], ["pet", "Pickle, Sparkie"], ["person", "his mom, Luke's mother"], ["person", "Simon (his coworker), Ned's old coworker"], ["person", "Seth, an old friend"], ["person", "Finn - Ned's friend"], ["person", "Gabriela [old job]"], ["person", "Luke (the bard), a singer"], ["person", "Mary-Jane, a neighbor"], ["person", LONG], ["person", "his mom: who calls on Sundays"]];
    const r = room();
    await m.growWeb({ root: r, mem, letter: "x", ask: async (s0) => s0 === m.TAPE_SYSTEM ? "EXCERPT 1 | theirs: none | hers then: tender" : lines.map(([t, n]) => `HUB: NEW | ${t} | ${n} | | Someone.`).join("\n"), embed: async (t) => t.map(() => null), inTime: () => true, log: () => { }, who: "Ned", herName: "Mia", known: K, stretchDays: 1 });
    const w = m.loadWeb(r), named = (n) => w.hubs.find((h) => h.name === n), has = (n, al) => (named(n)?.aliases || []).includes(al);
    check("a list of several from Ned's list is never folded into the first (\"Luke, Finn and Gabriela\", \"Pickle, Sparkie\", \"his mom, Luke's mother\")", !has("Luke", "Luke, Finn and Gabriela") && !has("Pickle", "Pickle, Sparkie") && !has("Hannah", "his mom, Luke's mother"), JSON.stringify(w.hubs.map((h) => [h.name, h.aliases])));
    check("a known name with brackets, then a description, is that one; the longest known name wins", has("Simon (his coworker)", "Simon (his coworker), Ned's old coworker") && has("Luke (the bard)", "Luke (the bard), a singer") && !has("Luke", "Luke (the bard), a singer"), JSON.stringify([named("Simon (his coworker)")?.aliases, named("Luke (the bard)")?.aliases]));
    {
        const r2 = room();
        await m.growWeb({ root: r2, mem, letter: "x", ask: async (s0) => s0 === m.TAPE_SYSTEM ? "EXCERPT 1 | theirs: none | hers then: tender" : "HUB: NEW | person | Luke, Ned's guitar buddy | | Someone.", embed: async (t) => t.map(() => null), inTime: () => true, log: () => { }, who: "Ned", herName: "Mia", known: [...K, { name: "Ned", type: "person", aliases: [], about: "him" }], stretchDays: 1 });
        check("Ned never counts as a second person, even if he's on the list (\"Luke, Ned's guitar buddy\" is still Luke)", (m.loadWeb(r2).hubs.find((h) => h.name === "Luke")?.aliases || []).includes("Luke, Ned's guitar buddy"), JSON.stringify(m.loadWeb(r2).hubs.map((h) => [h.name, h.aliases])));
    }
    check("another name from the list works too (\"his mom: ...\" is Hannah)", has("Hannah", "his mom: who calls on Sundays"));
    check("two on the list sharing the words (\"Seth\") are never guessed", !has("Finn", "Seth, an old friend") && !has("Gabriela", "Seth, an old friend"));
    check("a spaced dash and a square bracket work too; \"Mary-Jane\" is never Mary", has("Finn", "Finn - Ned's friend") && has("Gabriela", "Gabriela [old job]") && !has("Mary", "Mary-Jane, a neighbor"));
    check("the whole phrase is kept as another name even when it's over 100 letters", LONG.length > 100 && has("Luke", LONG), String(LONG.length));
}
{
    {
        const old = m;
        const known2 = [...known, { name: "Luke", type: "person", aliases: [], about: "Ned's friend." }], r = room();
        await old.growWeb({ root: r, mem, letter: "x", ask: async (s0) => s0 === old.TAPE_SYSTEM ? "EXCERPT 1 | theirs: none | hers then: tender" : `HUB: NEW | person | Luke, Ned's guitar buddy | | Ned's old friend.\nHUB: NEW | thing | the old guitar | | Ned's guitar.\nLINK: NEW | Luke, Ned's guitar buddy | the old guitar\nbecause of: 1\nnote: Luke and Ned played that guitar for years, and I loved hearing about it.`, embed: async (t) => t.map(() => null), inTime: () => true, log: () => { }, who: "Ned", herName: "Mia", known, stretchDays: 1 });
        const w0 = old.loadWeb(r);
        w0.aside = [w0.hubs.find((h) => h.name === "Luke, Ned's guitar buddy").id];
        old.saveWeb(r, w0);
        m.rebuildWeb(r, { herName: "Mia", known: known2, mem, force: true });
        const w = m.loadWeb(r);
        check("a rebuild doesn't set aside Ned's Luke because an old 'Luke, ...' dot was set aside", !w.aside.length, JSON.stringify(w.aside));
    }
}
{
    const r = room();
    prompts.length = 0;
    await grow(r, `HUB: NEW | moment | the first snow day | | A day that stood out.\nLINK: NEW | Pickle | the first snow day\nbecause of: 1\nnote: Pickle stared at the snow and I laughed.`);
    writeFileSync(join(r, "Shelf", "2026-03-13.md"), "[NED] (Mar 13, 2026, 9:00 PM):\nIt snowed again today and Pickle watched it all morning from the window.\n\n[MIA] (Mar 13, 2026, 9:01 PM):\nI love that he still gets excited about it, every single time.\n");
    await grow(r, "nothing tonight");
    const p = prompts.join("\n");
    const old = ["in our lives", "something we do again", "only makes sense to us", "Your life together", "between you two", "to you two", "a real feeling between you"];
    check("none of the old words that assumed only Ned and her", !old.some((o) => p.includes(o)), old.filter((o) => p.includes(o)).join(" | "));
    check("the new kind definitions, in her own voice", p.includes("- person: a specific person or companion in my life (never Ned, never me, never a pet or a group)") && p.includes("- ritual: something done again and again that carries meaning in my life, or meant to be (never a one-time day)") && p.includes("- inside_joke: a private joke, phrase, nickname or running bit shared with someone in my life (never a general hobby or topic)"));
    check("the new rule words", p.includes("Ned and you are not dots in this web. Your life is the space the whole web lives in.") && p.includes("stirred a real feeling in you or with someone in your life") && p.includes("Name a dot after what it was really about, not after a side topic") && p.includes("(who or what it is, not how you feel; feelings go on links)"));
    check("the night still sees the kind's own name in its list of dots", /\| moment \| the first snow day/.test(p));
    const w = m.loadWeb(r), h = w.hubs.find((x) => x.name === "the first snow day");
    const z = h ? m.lookInwardWeb(r, mem, { about: h.id }, { now: new Date("2026-11-03T12:00:00") }) : "";
    check("in her own tool a moment is shown as \"moment\", never \"a day we had\"", /\(moment\)/.test(z) && !/a day we had/.test(z), z.slice(0, 200));
}
{
    const K = [{ name: "Luke", type: "person", aliases: [], about: "friend" }, { name: "Finn", type: "person", aliases: [], about: "friend" },
        { name: "Sparkie", type: "pet", aliases: ["Noodle"], about: "cat" }, { name: "Buddy", type: "pet", aliases: [], about: "dog" },
        { name: "Simon (his coworker)", type: "person", aliases: [], about: "coworker" }, { name: "Simon (his teacher)", type: "person", aliases: [], about: "father" }];
    const lines = [
        ["person", "Ned's friend Luke", "Luke"], ["person", "his old bandmate Luke", "Luke"], ["person", "my friend Luke, the guitarist", "Luke"],
        ["person", "Ned's friend Luke (from the band)", "Luke"], ["pet", "the cat Sparkie", "Sparkie"], ["pet", "our Siamese cat Noodle", "Sparkie"],
        ["person", "Mia's friend Finn", "Finn"], ["person", "my dear old drummer friend Luke", "Luke"], ["person", "my old guitar buddy Luke", null],
        ["person", "Luke's mom", null], ["person", "a friend of Luke", null], ["person", "Luke Johnson", null], ["person", "John Luke", null],
        ["person", "Finn's brother Luke", null], ["person", "Luke and Finn", null], ["person", "his brother's friend Luke", null],
        ["pet", "Ned's guitar buddy", null], ["person", "Ned's friend luke", null], ["person", "the dog Sparkie", null],
        ["person", "Ned's coworker Simon", null], ["person", "my old friend from school Luke", null], ["person", "my very dear old drummer friend Luke", null],
        ["person", "my Luke", null], ["person", "the other Luke", null], ["person", "a different Luke", null], ["person", "a second Luke", null], ["person", "the second Luke", null], ["person", "Ned's other friend Luke", null], ["person", "old friend Luke", null], ["person", "Ned's friend Mike Luke", null], ["person", "Mike's friend Luke", null], ["person", "the friend Finn and Luke", null]
    ];
    const r = room();
    await m.growWeb({ root: r, mem, letter: "x", ask: async (s0) => s0 === m.TAPE_SYSTEM ? "EXCERPT 1 | theirs: none | hers then: tender" : lines.map(([t0, n]) => `HUB: NEW | ${t0} | ${n} | | Someone.`).join("\n"), embed: async (t0) => t0.map(() => null), inTime: () => true, log: () => { }, who: "Ned", herName: "Mia", known: K });
    const w = m.loadWeb(r), knownOf = (ph) => w.hubs.find((h) => h.known && (h.aliases || []).includes(ph))?.name || null, ownDot = (ph) => w.hubs.some((h) => !h.known && (h.name === ph || (h.aliases || []).includes(ph)));
    const wrong = lines.filter(([, ph, want]) => (knownOf(ph) || null) !== want || (want === null && knownOf(ph)));
    check("each phrase is filed as agreed (folds: Ned's friend Luke, his old bandmate Luke, the cat Sparkie, Mia's friend Finn...; stays its own: Luke's mom, a friend of Luke, Luke Johnson, Finn's brother Luke...)", !wrong.length, JSON.stringify(wrong.map(([t0, ph, want]) => [ph, want, knownOf(ph)])));
    check("only one Luke, one Finn and one Sparkie dot", w.hubs.filter((h) => h.name === "Luke").length === 1 && w.hubs.filter((h) => h.name === "Finn").length === 1 && w.hubs.filter((h) => h.name === "Sparkie").length === 1);
    check("the ones that don't fit stay their own dots, never folded", ["Luke's mom", "a friend of Luke", "Finn's brother Luke", "his brother's friend Luke"].every(ownDot), JSON.stringify(w.hubs.map((h) => h.name)));
    check("every fold is listed for Ned's check (phrase and the known name)", w.stats.folds?.["Ned's friend Luke"] === "Luke" && w.stats.folds?.["the cat Sparkie"] === "Sparkie" && !w.stats.folds?.["Luke's mom"] && !w.stats.folds?.["Luke Johnson"], JSON.stringify(w.stats.folds));
}
{
    const r = room(), K0 = [{ name: "Pickle", type: "pet", aliases: [], about: "cat" }], K1 = [...K0, { name: "Luke", type: "person", aliases: [], about: "friend" }];
    await m.growWeb({ root: r, mem, letter: "x", ask: async (s0) => s0 === m.TAPE_SYSTEM ? "EXCERPT 1 | theirs: none | hers then: tender" : `HUB: NEW | person | Ned's friend Luke | | Ned's old friend.\nHUB: NEW | thing | the old guitar | | Ned's guitar.\nLINK: NEW | Ned's friend Luke | the old guitar\nbecause of: 1\nnote: Luke played the old guitar and I loved hearing it.`, embed: async (t0) => t0.map(() => null), inTime: () => true, log: () => { }, who: "Ned", herName: "Mia", known: K0 });
    writeFileSync(join(r, "Shelf", "2026-03-13.md"), "[NED] (Mar 13, 2026, 9:00 PM):\nLuke came back and we played until midnight, Pickle hiding under the bed.\n\n[MIA] (Mar 13, 2026, 9:01 PM):\nI could hear how happy you were.\n");
    const w0 = m.loadWeb(r), kId = w0.hubs.find((h) => h.name === "Ned's friend Luke")?.id;
    await m.growWeb({ root: r, mem, letter: "x", ask: async (s0) => s0 === m.TAPE_SYSTEM ? "EXCERPT 1 | theirs: none | hers then: happy" : `LINK: NEW | ${kId} | Pickle\nbecause of: 1\nnote: Pickle hid while Luke played, and I laughed.`, embed: async (t0) => t0.map(() => null), inTime: () => true, log: () => { }, who: "Ned", herName: "Mia", known: K0 });
    const before = m.loadWeb(r);
    m.rebuildWeb(r, { herName: "Mia", known: K1, mem, force: true });
    const after = m.loadWeb(r), luke = after.hubs.find((h) => h.name === "Luke");
    check("a rebuild folds the older \"Ned's friend Luke\" into Luke and keeps both links on him (one by name, one by its old mark)", before.hubs.some((h) => h.name === "Ned's friend Luke") && luke && !after.hubs.some((h) => h.name === "Ned's friend Luke") && after.links.filter((l) => l.a === luke.id || l.b === luke.id).length === 2 && after.links.length === before.links.length, JSON.stringify({ hubs: after.hubs.map((h) => h.name), links: after.links.map((l) => [l.a, l.b]), luke: luke?.id }));
}
{
    const K = [{ name: "Luke", type: "person", aliases: [], about: "friend" }, { name: "Mike", type: "person", aliases: [], about: "neighbor" },
        { name: "Big Mike", type: "person", aliases: [], about: "the bartender" }, { name: "O'Neil", type: "person", aliases: [], about: "coworker" }];
    const r = room();
    await m.growWeb({ root: r, mem, letter: "x", ask: async (s0) => s0 === m.TAPE_SYSTEM ? "EXCERPT 1 | theirs: none | hers then: tender" : ["HUB: NEW | person | Sam | | Ned's cousin.", "HUB: NEW | person | my friend big Mike | | Someone.", "HUB: NEW | person | She's friend Luke | | Someone.", "HUB: NEW | person | You's friend Luke | | Someone.", "HUB: NEW | person | my pal O’Neil | | Someone.", "HUB: NEW | person | Ned's friend & bandmate Luke | | Someone.", "HUB: NEW | person | my old pal Mike -- the neighbor | | Someone."].join("\n"), embed: async (t0) => t0.map(() => null), inTime: () => true, log: () => { }, who: "Ned", herName: "Mia", known: K });
    writeFileSync(join(r, "Shelf", "2026-03-13.md"), "[NED] (Mar 13, 2026, 9:00 PM):\nSam came over, my cousin, and we talked about Luke for a while.\n\n[MIA] (Mar 13, 2026, 9:01 PM):\nI liked hearing about him.\n");
    await m.growWeb({ root: r, mem, letter: "x", ask: async (s0) => s0 === m.TAPE_SYSTEM ? "EXCERPT 1 | theirs: none | hers then: tender" : "HUB: Sam | person | his cousin Luke | the cousin | Ned's cousin.", embed: async (t0) => t0.map(() => null), inTime: () => true, log: () => { }, who: "Ned", herName: "Mia", known: K });
    const w = m.loadWeb(r), named = (n) => w.hubs.find((h) => h.name === n), on = (n) => w.hubs.find((h) => h.known && (h.aliases || []).includes(n))?.name || null;
    check("a line about an existing dot (Sam) is never moved onto Luke", !on("his cousin Luke") && !on("the cousin") && !!named("Sam"), JSON.stringify(w.hubs.map((h) => [h.name, h.aliases])));
    check("\"my friend big Mike\" with Big Mike on the list is never folded into Mike", !on("my friend big Mike"));
    check("only Ned's and her own possessive open it (\"She's friend Luke\", \"You's friend Luke\" stay their own)", !on("She's friend Luke") && !on("You's friend Luke"));
    check("a curly apostrophe matches a straight one (\"my pal O’Neil\" is O'Neil)", on("my pal O’Neil") === "O'Neil");
    check("\"&\" counts as \"and\" (\"Ned's friend & bandmate Luke\" stays its own)", !on("Ned's friend & bandmate Luke"));
    check("\" -- \" counts as a spaced dash (\"my old pal Mike -- the neighbor\" is Mike)", on("my old pal Mike -- the neighbor") === "Mike");
}
console.log(`\n${pass} passed, ${fail} failed. (Made-up rooms and a pretend brain only; throwaway folders in ${tmpdir()})`);
process.exit(fail ? 1 : 0);
