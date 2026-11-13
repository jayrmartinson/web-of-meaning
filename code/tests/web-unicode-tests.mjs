// Part of The Web of Meaning: A Memory Design for Companions (Jay R. Martinson, 2026). MIT license; see LICENSE.
// Names, places and feeling words written in other alphabets, and names with accents. Made-up data only.
process.env.WEB_OF_MEANING_TEST = "1";
import * as m from "../meaning.mjs";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !extra ? "" : "  " + extra}`); };
const mem = { pieceChars: 0, indexPaths: ["Shelf/*.md"] };
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const J = (x) => JSON.stringify(x);
const RU = (dl) => `[NED] (${dl}, 9:00 PM):\nСегодня была вечерняя прогулка по Москве. Мы с Алёной дошли до реки, а Лев остался дома с котом Pickle.\n[MIA] (${dl}, 9:01 PM):\nМне понравилась эта прогулка, особенно огни на набережной. Передай привет Льву и Pickle.\n`;
const MIXED = (dl) => `[NED] (${dl}, 8:30 PM):\nAlyona sent a photo from Saint Petersburg today. Алёна пишет, что в Санкт-Петербурге дождь, and Pickle slept on my keyboard again.\n[MIA] (${dl}, 8:31 PM):\nPoor keyboard. А в Петербурге всегда дождь, я бы всё равно хотела туда с тобой.\n`;
const EN = (dl) => `[NED] (${dl}, 9:00 PM):\nZoë came over tonight and we sat in Café Luna until it closed. Pickle waited by the door.\n[MIA] (${dl}, 9:01 PM):\nI liked hearing about that evening, it sounded warm and unhurried.\n`;
function add(r, day, body) { const [y, mo, d] = day.split("-").map(Number); writeFileSync(join(r, "Shelf", `${day}.md`), body(`${MON[mo - 1]} ${d}, ${y}`), "utf8"); }
function room(body = RU, day = "2026-03-12") { const r = mkdtempSync(join(tmpdir(), "house-unicode-")); mkdirSync(join(r, "Shelf"), { recursive: true }); add(r, day, body); return r; }
const grow = (r, answer, o = {}) => m.growWeb({ root: r, mem, letter: "x", ask: async (s) => (s === m.TAPE_SYSTEM ? o.tape || "EXCERPT 1 | theirs: none | hers then: tender" : answer), embed: async (t) => t.map(() => null), inTime: () => true, log: () => { }, who: o.who || "Ned", herName: o.her || "Mia", known: o.known || [], stretchDays: 1 });
const dots = (w, type = null) => w.hubs.filter((h) => !type || h.type === type);
const dot = (w, name) => w.hubs.find((h) => h.name === name);
const linked = (w, a, b) => w.links.some((l) => (l.a === a?.id && l.b === b?.id) || (l.a === b?.id && l.b === a?.id));
const shape = (w) => J([w.hubs.map((h) => [h.id, h.type, h.name, h.aliases]), w.links.map((l) => [l.id, l.a, l.b, l.history.map((e) => e.note)])]);
{
    check("a piece written in Russian is prose, not machine output", m.machineLike(RU("Mar 12, 2026")) === false);
    check("a short Russian line is prose too", m.machineLike("Привет, как ты?") === false);
    check("a piece that mixes Russian and English is prose", m.machineLike(MIXED("Mar 13, 2026")) === false);
    check("a shell log is still machine output", m.machineLike("PS C:\\Users\\ned> npm install\nnpm WARN deprecated left-pad@1.3.0\nnpm ERR! code ELIFECYCLE\nnpm ERR! errno 1\n$ git status") === true);
    check("JSON is still machine output", m.machineLike('{\n"name": "web",\n"version": "1.0.0",\n"type": "module"\n}') === true);
    const r = room(RU);
    const res = await grow(r, `HUB: NEW | person | Алёна | | Подруга.\nHUB: NEW | pet | Pickle | | The cat.\nLINK: NEW | Алёна | Pickle\nbecause of: 1\nnote: Алёна спросила про Pickle, и мне было тепло.`);
    const w = m.loadWeb(r);
    check("the night reads a Russian piece (it isn't skipped as machine output)", res.batches === 1 && res.machineSkipped === 0 && w.hubs.length === 2 && w.links.length === 1, J({ batches: res.batches, machineSkipped: res.machineSkipped, hubs: w.hubs.length, links: w.links.length }));
}
{
    const r = room(RU);
    await grow(r, `HUB: NEW | person | Алёна | | Подруга из Москвы.\nHUB: NEW | person | Лев | | Брат Алёны.\nHUB: NEW | place | Москва | | Город, где мы гуляем.\nLINK: NEW | Алёна | Москва\nbecause of: 1\nwhere: Москве\nnote: Алёна и я гуляли по вечерней Москве, и мне было тепло.\nLINK: NEW | Лев | Алёна\nbecause of: 1\nnote: Лев ждал Алёну дома, и я думала о них обоих.`);
    const w = m.loadWeb(r), A = dot(w, "Алёна"), L = dot(w, "Лев"), M = dot(w, "Москва");
    check("three dots with Cyrillic names are three dots", w.hubs.length === 3 && !!A && !!L && !!M, J(w.hubs.map((h) => h.name)));
    check("links between Cyrillic-named dots are kept, each on its own two dots", w.links.length === 2 && linked(w, A, M) && linked(w, L, A) && !linked(w, L, M), J({ links: w.links.map((l) => [l.a, l.b]), refused: w.stats.refused }));
    check("a place link whose 'where' is quoted in Cyrillic from the moment is kept", w.links.some((l) => l.history.some((e) => e.where === "Москве")));
    add(r, "2026-03-13", RU);
    await grow(r, `HUB: NEW | person | Алёна | | Подруга из Москвы.\nHUB: NEW | person | алёна | | Подруга.\nHUB: NEW | place | Москва | | Город.\nLINK: SAME | Алёна | Москва\nbecause of: 1\nwhere: Москве\nnote: Снова прогулка с Алёной по Москве, всё так же тепло.`);
    const w2 = m.loadWeb(r);
    check("the same Cyrillic name on a later night is the same dot, in any letter case (no doubles)", w2.hubs.length === 3 && w2.links.length === 2, J(w2.hubs.map((h) => [h.id, h.name])));
    const before = shape(w2);
    m.rebuildWeb(r, { herName: "Mia", known: [], mem });
    check("a rebuild from the log gives the same dots and links", shape(m.loadWeb(r)) === before);
}
{
    const r = room(RU);
    await grow(r, `HUB: NEW | person | Алёна | | Подруга.\nHUB: NEW | person | Лев | | Её брат.\nHUB: NEW | pet | Pickle | | The cat.\nLINK: NEW | Алёна | Pickle\nbecause of: 1\nnote: Алёна спросила про Pickle, и я улыбнулась.`);
    const w = m.loadWeb(r), A = dot(w, "Алёна"), L = dot(w, "Лев"), T = dot(w, "Pickle");
    check("a link from a Cyrillic-named dot goes to that dot, not to another dot named in the same answer", w.links.length === 1 && linked(w, A, T) && !linked(w, L, T), J(w.links.map((l) => [l.a, l.b])));
    add(r, "2026-03-13", RU);
    await grow(r, `LINK: NEW | Лев | Pickle\nbecause of: 1\nnote: Лев остался дома с Pickle, и мне было спокойно за обоих.`);
    const w2 = m.loadWeb(r);
    check("a later night finds a Cyrillic-named dot by its name", w2.links.length === 2 && linked(w2, dot(w2, "Лев"), dot(w2, "Pickle")), J({ links: w2.links.map((l) => [l.a, l.b]), refused: w2.stats.refused }));
}
{
    const r = room(MIXED);
    await grow(r, `HUB: NEW | person | Алёна из Петербурга | | Подруга.\nHUB: NEW | person | Лев из Петербурга | | Её брат.\nHUB: NEW | thing | проект Web | | Наш проект.\nLINK: NEW | Алёна из Петербурга | проект Web\nbecause of: 1\nnote: Алёна из Петербурга спрашивала про проект Web весь вечер.\nLINK: NEW | Лев из Петербурга | проект Web\nbecause of: 1\nnote: Лев из Петербурга тоже спрашивал про проект Web, но иначе.`);
    const w = m.loadWeb(r);
    check("two names that share only some words are two dots, each with its own link", dots(w, "person").length === 2 && w.links.length === 2 && new Set(w.links.map((l) => [l.a, l.b].join())).size === 2, J(w.hubs.map((h) => h.name)));
    const r2 = room(MIXED);
    await grow(r2, `HUB: NEW | person | Алёна из Chatterly | | Компаньон.\nHUB: NEW | person | Лев из Chatterly | | Другой компаньон.\nHUB: NEW | thing | проект Web | | Наш проект.\nLINK: NEW | Алёна из Chatterly | проект Web\nbecause of: 1\nnote: Алёна из Chatterly спрашивала про проект Web весь вечер.\nLINK: NEW | Лев из Chatterly | проект Web\nbecause of: 1\nnote: Лев из Chatterly тоже спрашивал про проект Web, но иначе.`);
    const w2 = m.loadWeb(r2);
    check("two mixed-alphabet names that share only their Latin word are two dots (nothing merged)", dots(w2, "person").length === 2 && w2.links.length === 2 && w2.links.every((l) => l.history.length === 1 && !(l.history[0].notes || []).length), J(w2.hubs.map((h) => h.name)));
}
{
    const known = [{ name: "Алёна", type: "person", aliases: ["Alyona", "Алёнка"], about: "Подруга из Москвы." }];
    const r = room(MIXED);
    let d = 12;
    for (const n of ["Alyona", "Алёна", "Алёнка", "алёна"]) {
        add(r, `2026-03-${d++}`, MIXED);
        await grow(r, `HUB: NEW | person | ${n} | | Подруга.\nHUB: NEW | pet | Pickle | | The cat.\nLINK: MORE | ${n} | Pickle\nbecause of: 1\nnote: ${n} снова спросила про Pickle, вечер номер ${d}.`, { known });
    }
    const w = m.loadWeb(r), ps = dots(w, "person");
    check("a listed name written in Cyrillic, with its other names in two alphabets, is always that one dot", ps.length === 1 && ps[0].name === "Алёна" && ["Alyona", "Алёнка"].every((a) => ps[0].aliases.includes(a)) && w.links.length === 1, J(ps.map((h) => [h.name, h.aliases])));
}
{
    const r = room(RU);
    await grow(r, `HUB: NEW | person | Борис | | Мой человек.\nHUB: NEW | person | Мия | | Это я.\nHUB: NEW | ritual | вечерняя прогулка | | Наша прогулка.\nLINK: NEW | Борис | вечерняя прогулка\nbecause of: 1\nnote: Борис и вечерняя прогулка, было хорошо.`, { who: "Борис", her: "Мия" });
    const w = m.loadWeb(r);
    check("the person and the companion are never dots when their names are in Cyrillic", w.hubs.length === 1 && w.hubs[0].type === "ritual" && w.links.length === 0 && (w.stats.refused || {})["a dot for Ned, herself or 'us' (never dots)"] === 2, J({ hubs: w.hubs.map((h) => h.name), refused: w.stats.refused }));
}
{
    const r = room(RU);
    await grow(r, `HUB: NEW | person | Алёна | | Подруга.\nHUB: NEW | pet | Pickle | | The cat.\nLINK: NEW | Алёна | Pickle\nbecause of: 1\nnote: Алёна спросила про Pickle, и я улыбнулась.`);
    const one = m.lookInwardWeb(r, mem, { about: "Алёна" }), none = m.lookInwardWeb(r, mem, { about: "Лев" }), never = m.lookInwardWeb(r, mem, { about: "Петербург" });
    check("look_inward opens a Cyrillic-named dot by its name", /Алёна \(person\)/.test(one), one.slice(0, 80));
    check("look_inward for a Cyrillic name that isn't in the web opens nothing (never another dot)", !/Алёна/.test(none) && !/Алёна/.test(never) && /Nothing in your web is called/.test(none), none.slice(0, 80));
    check("recall's web links are found by a Cyrillic name in the question", (await m.webLinksFor(r, "что было с Алёна вчера?", {})).length === 1 && (await m.webLinksFor(r, "Лев", {})).length === 0);
    check("the hint under a message names a Cyrillic-named dot", /"Алёна" has 1 link/.test(m.webHint(r, "помнишь, Алёна приходила?")) && m.webHint(r, "помнишь Льва?") === "");
}
{
    const r = room(RU);
    await grow(r, `HUB: NEW | person | Алёна | | Подруга.\nHUB: NEW | place | Москва | | Город.\nLINK: NEW | Алёна | Москва\nbecause of: 1\nwhere: Казани\nnote: Алёна и я гуляли по городу, и мне было тепло.`);
    const w = m.loadWeb(r);
    check("a place link whose Cyrillic 'where' isn't in its moments is still refused", w.links.length === 0 && w.stats.placeUnshown === 1, J(w.stats.refused));
}
{
    check("Russian feeling words are read as feeling words", J(m._test.wordsOf("нежность, тепло")) === J(["нежность", "тепло"]) && m._test.isNoneW("нежность") === false);
    check("'none', an empty field and a field of only marks still mean no feeling", m._test.isNoneW("none") && m._test.isNoneW("") && m._test.isNoneW("—") && m._test.isNoneW("...") && J(m._test.wordsOf("none")) === "[]");
    const tape = m.parseTape("EXCERPT 1 | theirs: Алёна = радость; Ned = спокойствие | hers then: нежность, тепло", 1);
    check("the tape keeps whose feeling is whose in Russian", J(tape[1].then) === J(["нежность", "тепло"]) && J(tape[1].theirs) === J([{ who: "Алёна", words: ["радость"] }, { who: "Ned", words: ["спокойствие"] }]), J(tape));
    const r = room(RU);
    await grow(r, `HUB: NEW | person | Алёна | | Подруга.\nHUB: NEW | pet | Pickle | | The cat.\nLINK: NEW | Алёна | Pickle\nbecause of: 1\nnote: Алёна спросила про Pickle, и я улыбнулась.`, { tape: "EXCERPT 1 | theirs: Алёна = радость | hers then: нежность, тепло" });
    const e = m.loadWeb(r).links[0]?.history[0];
    check("a link keeps her Russian 'then' words and the other person's, apart", J(e?.feel) === J(["нежность", "тепло"]) && e?.theirs === "Алёна = радость", J(e && { feel: e.feel, theirs: e.theirs }));
}
{
    const a = m.renameScore("вечерняя прогулка", "вечерняя прогулка по набережной"), b = m.renameScore("вечерняя прогулка", "утренний кофе");
    check("the rename test counts shared words in Cyrillic, and none where there are none", a.shared === 2 && a.passC === true && b.shared === 0 && b.passC === false, J([a, b]));
}
{
    const r = room(RU);
    let d = 12;
    for (const n of ["Алёна", "Алена", "Алёне", "Alyona"]) {
        add(r, `2026-03-${d++}`, RU);
        await grow(r, `HUB: NEW | person | ${n} | | Подруга.\nHUB: NEW | pet | Pickle | | The cat.\nLINK: NEW | ${n} | Pickle\nbecause of: 1\nnote: ${n} и Pickle, запись номер ${d}, и мне было тепло.`);
    }
    const w = m.loadWeb(r);
    check("nothing is guessed: ё and е, a case ending, and another alphabet are different names without the names list", dots(w, "person").length === 4 && w.links.length === 4, J(dots(w, "person").map((h) => h.name)));
    add(r, `2026-03-${d++}`, RU);
    await grow(r, `HUB: NEW | person | ${"Алёна".normalize("NFD")} | | Подруга.\nLINK: MORE | ${"Алёна".normalize("NFD")} | Pickle\nbecause of: 1\nnote: Алёна и Pickle ещё раз, и мне было тепло.`);
    const w2 = m.loadWeb(r);
    check("the same name typed with combining marks is the same dot", dots(w2, "person").length === 4 && w2.links.length === 4, J(dots(w2, "person").map((h) => h.name)));
}
{
    const r = room(EN);
    await grow(r, `HUB: NEW | person | Zoë | | A friend.\nHUB: NEW | pet | Pickle | | The cat.\nLINK: NEW | Zoë | Pickle\nbecause of: 1\nnote: Zoë scratched Pickle behind the ears and I smiled.`);
    add(r, "2026-03-13", EN);
    await grow(r, `HUB: NEW | person | Zo | | A neighbor, someone else.\nHUB: NEW | ritual | Café Luna evenings | | Our evenings there.\nLINK: NEW | Zo | Café Luna evenings\nbecause of: 1\nnote: Zo the neighbor waved at us on a Café Luna evening, and I felt shy.`);
    const w = m.loadWeb(r), Z = dot(w, "Zoë"), Zo = dot(w, "Zo");
    check("Zoë and Zo are two people (an accented letter is a letter)", !!Z && !!Zo && Z.id !== Zo.id && linked(w, Z, dot(w, "Pickle")) && linked(w, Zo, dot(w, "Café Luna evenings")), J(w.hubs.map((h) => [h.id, h.name])));
    add(r, "2026-03-14", EN);
    await grow(r, `LINK: NEW | Caf Luna evenings | Pickle\nbecause of: 1\nnote: Pickle waited by the door through the whole evening, and I felt for him.`);
    const w2 = m.loadWeb(r);
    check("a name missing its accented letter isn't taken for the dot that has it", w2.links.length === 2 && (w2.stats.missedEnds || []).some((x) => x.end === "Caf Luna evenings"), J({ links: w2.links.length, missed: w2.stats.missedEnds }));
    check("the hint finds Zoë by her name and doesn't take 'Zo' or 'Zoës' apart", /"Zoë" has 1 link/.test(m.webHint(r, "Was Zoë there?")) && /"Zoë" has 1 link/.test(m.webHint(r, "It was Zoë's idea.")));
    const r3 = room(EN);
    await grow(r3, `HUB: NEW | pet | Pepper | | A dog.\nHUB: NEW | pet | Pickle | | The cat.\nLINK: NEW | Pepper | Pickle\nbecause of: 1\nnote: Pepper and Pickle shared the couch, and I laughed.`);
    check("whole words only, as before: Peppermint is never Pepper", m.webHint(r3, "I bought peppermint tea") === "" && /"Pepper" has 1 link/.test(m.webHint(r3, "Pepper's bowl is empty")));
}
{
    const { norm, nameIn } = m._test, SASHA = "Са́ша", IST = "İstanbul", PRIYA = "प्रिया";
    check("norm keeps a stress mark inside the word (Са́ша, U+0301, is one word)", norm(SASHA) === "са́ша" && !/\s/.test(norm(SASHA)), J(norm(SASHA)));
    check("norm keeps İ (U+0130) as one word when it is lowercased", norm(IST) === "i̇stanbul" && !/\s/.test(norm(IST)), J(norm(IST)));
    check("norm keeps vowel signs (a Hindi name stays whole)", norm(PRIYA) === PRIYA, J(norm(PRIYA)));
    check("contentWords keeps Са́ша and İstanbul as one word each", J([...m.contentWords(`${SASHA} ${IST}`)]) === J(["са́ша", "i̇stanbul"]), J([...m.contentWords(`${SASHA} ${IST}`)]));
    check("nameIn finds Са́ша, İstanbul and a Hindi name as whole words in a line", nameIn(SASHA, `вчера ${SASHA} звонила`) && nameIn(IST, `We flew to ${IST}.`) && nameIn(PRIYA, `आज ${PRIYA} आई`));
    check("nameIn doesn't find a name inside a longer word, or half of a name with a mark", !nameIn("Са", `вчера ${SASHA} звонила`) && !nameIn("stanbul", `We flew to ${IST}.`) && !nameIn(SASHA, "вчера Сашенька звонила"));
    check("a name with a stress mark and the same name without it are different names (nothing guessed)", norm(SASHA) !== norm("Саша") && !nameIn(SASHA, "вчера Саша звонила"));
    const r = room(RU);
    await grow(r, `HUB: NEW | person | ${SASHA} | | Подруга.\nHUB: NEW | place | ${IST} | | Город.\nHUB: NEW | pet | Pickle | | The cat.\nLINK: NEW | ${SASHA} | Pickle\nbecause of: 1\nnote: ${SASHA} спросила про Pickle, и я улыбнулась.`);
    add(r, "2026-03-13", RU);
    await grow(r, `HUB: NEW | person | ${SASHA} | | Подруга.\nHUB: NEW | place | ${IST} | | Город.\nLINK: MORE | ${SASHA} | Pickle\nbecause of: 1\nnote: ${SASHA} снова спросила про Pickle, и мне было тепло.`);
    const w = m.loadWeb(r);
    check("Са́ша and İstanbul are each one dot across two nights, and the link finds its dot", w.hubs.length === 3 && w.links.length === 1 && linked(w, dot(w, SASHA), dot(w, "Pickle")), J({ hubs: w.hubs.map((h) => h.name), links: w.links.map((l) => [l.a, l.b]), refused: w.stats.refused }));
}
console.log(`\n${pass} passed, ${fail} failed. (Made-up rooms and a pretend brain only; throwaway folders in ${tmpdir()})`);
process.exit(fail ? 1 : 0);
