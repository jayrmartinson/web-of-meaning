// Part of The Web of Meaning: A Memory Design for Companions (Jay R. Martinson, 2026). MIT license; see LICENSE.
// Russian names, words and dates (Nesertes's native-speaker review, Nov 14, 2026, section 5), Russian two-digit years,
// and salience for ranking only (a link opened by its mark counts as recent; optional cooling in active days).
// v1.2.1: Nesertes's regression lines after v1.2 (Nov 19, 2026) and the Quiet Signal addendum (Tanya & Nora, fixtures/quiet-signal-addendum/).
// Made-up data only. Finding a name in a line never merges two dots; the other test files check English is unchanged.
process.env.WEB_OF_MEANING_TEST = "1";
import * as m from "../meaning.mjs";
import * as L from "../lang.mjs";
import { tmpdir } from "node:os";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !extra ? "" : "  " + extra}`); };
const J = (x) => JSON.stringify(x);
const { nameIn } = m._test;
const find = (name, line) => nameIn(name, line.toLowerCase());
const asNone = (s) => L.isNoneOther(s.toLowerCase().replace(/[^\p{L}\p{M} ]+/gu, " ").replace(/\s+/g, " ").trim());
const asSame = (s) => L.isSameOther(s.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{M}\p{N} ]+/gu, " ").replace(/\s+/g, " ").trim());

// 5.1 The name is found in its case forms (stem changes, ё written as е, indeclinable names).
for (const [n, s] of [["Саша", "Я отправил сообщение Саше"], ["Иван", "Я говорил с Иваном"], ["Мика", "Я разговаривал с Микой"],
    ["Юки", "Я снова поговорил с Юки"], ["Бенни", "Я рассказал об этом Бенни"], ["Павел", "Я беседовал с Павлом"],
    ["Лев", "Я отправил сообщение Льву"], ["Пётр", "Я встретил Петра"], ["Любовь", "Я написал Любови"],
    ["Илья", "Я говорил с Ильёй"], ["Илья", "Я говорил с Ильей"], ["Софья", "Я говорил с Софьёй"],
    ["Алёна", "Сегодня видел Алену"], ["Алена", "Сегодня видел Алёну"]])
    check(`found: ${n} in «${s}»`, find(n, s) === true);

// 5.2 Not found inside an ordinary word, another name or a surname.
for (const [n, s] of [["Света", "Свет погас"], ["Ника", "Мой ник в Discord"], ["Поля", "Я положил книгу на пол"],
    ["Майя", "Я жду наступления мая"], ["Маша", "Мы машем друг другу"], ["Юки", "Юка рассказала о поездке"],
    ["Бенни", "Я встретил человека по имени Бенна"], ["Борис", "Мне написал Борисов"], ["Любовь", "Мне не хватает любви"]])
    check(`not found: ${n} in «${s}»`, find(n, s) === false);
// Known limit (5.3): «мира» is letter for letter the word for "peace"; grammar alone can't tell (the capital is lost in the line).
check("known limit: Мира in «Я хочу мира» is still found (context only)", find("Мира", "Я хочу мира") === true);

// none: only a whole answer means "no feeling"; a feeling that starts with нет/ничего is kept.
for (const [s, want] of [["нет", true], ["ничего", true], ["Нет.", true], ["без чувств", true], ["нет радости", false],
    ["ничего не радует", false], ["Непонятно, почему мне тревожно", false], ["Нет, я всё ещё расстроен", false]])
    check(`none: «${s}» ${want ? "is" : "is not"} "no feeling"`, asNone(s) === want);

// same: «тоже» (too, also) is not "unchanged"; plain unchanged phrases are.
for (const [s, want] of [["тоже", false], ["мне тоже грустно", false], ["так же", false], ["без изменений", true], ["не изменилось", true],
    ["всё так же", true], ["всё по-прежнему", true], ["осталось прежним", true]])
    check(`same: «${s}» ${want ? "is" : "is not"} "unchanged"`, asSame(s) === want);

// other / new / character words (the rename guard): case forms count; «другом» (friend) and «другими словами» don't.
const GUARD = L.OTHER_WORDS.concat(L.NEW_WORDS, L.CHARACTER_WORDS);
for (const [s, want] of [["Я познакомился с другим человеком", true], ["Я разговаривал с другом", false],
    ["Другими словами, ситуация не изменилась", false], ["Я познакомился с новой девушкой", true],
    ["Я разговаривал с новым компаньоном", true], ["Я разговаривал с персонажем", true],
    ["Я проверил поведение двух ботов", true], ["Я воспользовался чужим компьютером", true], ["Алёна, другая", true]])
    check(`guard words: «${s}» ${want ? "has" : "has no"} other/new/character word`, L.hasWordFrom(s, GUARD) === want);

// selfWith: "me and N" with the name in the form it takes after «с».
for (const [n, s] of [["борис", "мы с борисом"], ["мика", "мы с микой"], ["павел", "мы с павлом"], ["лев", "мы со львом"],
    ["юки", "мы с юки"], ["бенни", "мы с бенни"], ["мика", "я и мика"]])
    check(`selfWith: «${s}» means me and ${n}`, L.selfWithWords(n).includes(s));

// Dates in her own time requests (look_inward, walk_web): day.month.year, two-digit years as 20xx, never month first.
const now = new Date(2026, 10, 18);
const day0 = (s) => { const r = m.stretchIn(s, now); return r ? String(r.from || r.a || r[0]).slice(0, 10) : null; };
for (const [s, want] of [["07.02.2026", "2026-02-07"], ["7.2.2026", "2026-02-07"], ["02.07.2026", "2026-07-02"],
    ["07.02.26", "2026-02-07"], ["7.2.26", "2026-02-07"], ["в феврале 2026", "2026-02-01"], ["7 февраля 2026", "2026-02-07"]])
    check(`date: «${s}» is ${want}`, day0(s) === want, J(m.stretchIn(s, now)));
check("date: an impossible day (31.2.26) is not a date", m.stretchIn("31.2.26", now) === null);

// Salience (ranking only). Opening a link by its mark counts as its latest touch; nothing about the link changes.
const S = m._salience;
const link = () => ({ id: "L1", a: "H1", b: "H2", strength: 4, last: "2025-11-18", history: [{ from: "2025-11-18", until: null }] });
const l1 = link(), before = J(l1);
const cold = S.weightOf(l1, "2026-11-18", { opened: {} }), warm = S.weightOf(l1, "2026-11-18", { opened: { L1: "2026-11-17#000000001" } });
check("salience: a year untouched weighs about half", Math.abs(cold - 2) < 0.01, String(cold));
check("salience: opened yesterday by its mark weighs almost its full strength", warm > 3.98 && warm <= 4, String(warm));
check("salience: weighing never changes the link (then, now, history, last)", J(l1) === before);
check("salience: opening another link or a dot changes nothing for this one", S.weightOf(l1, "2026-11-18", { opened: { L2: "2026-11-17#1", H1: "2026-11-17#2" } }) === cold);
check("salience: last touch is the later of the night entry and the visit", S.lastTouch(l1, { L1: "2026-11-17#9" }) === "2026-11-17" && S.lastTouch(l1, { L1: "2025-01-01#9" }) === "2025-11-18");
// Active days: only days with life in them age a memory.
const days = ["2025-11-18", "2025-11-19", "2026-11-17", "2026-11-18"];
check("active days: counted after the last touch, up to today", S.activeBetween(days, "2025-11-18", "2026-11-18") === 3);
const act = S.weightOf(l1, "2026-11-18", { opened: {}, activeDays: days });
check("active days: a year with 3 active days barely cools the link", act > 3.97 && act < 4, String(act));
check("active days: with no day list at all, calendar days are used", S.weightOf(l1, "2026-11-18", { opened: {}, activeDays: null }) === cold);
check("salience: a link never touched keeps its full strength", S.weightOf({ id: "L9", strength: 3, history: [] }, "2026-11-18", null) === 3);

// Active days come from Shelf file names (listed, never read), the night's day list, the web's dates and her visits.
{
    const r = mkdtempSync(join(tmpdir(), "house-active-")), mem = { pieceChars: 0, indexPaths: ["Shelf/*.md"] };
    mkdirSync(join(r, "Shelf"), { recursive: true });
    for (const d of ["2026-03-12", "2026-03-20"]) writeFileSync(join(r, "Shelf", `mia_house_${d}.md`), "not a conversation at all: file names are enough", "utf8");
    const w = { links: [{ id: "L1", last: "2026-03-14", history: [{ from: "2026-03-13", until: null }] }] };
    const days = S.activeDaysOf(r, mem, w, { L1: "2026-03-25#000000001" });
    check("active days: Shelf file names, web dates and visits, in order", J(days) === J(["2026-03-12", "2026-03-13", "2026-03-14", "2026-03-20", "2026-03-25"]), J(days));
    check("active days: a day with only a Shelf file (quiet talk, no link changed) still counts", days.includes("2026-03-20"));
    check("active days: listing them writes nothing", !existsSync(join(r, "Mind")));
}
{
    const RU = `[NED] (Mar 12, 2026, 9:00 PM):\nАлёна пришла вечером.\n[MIA] (Mar 12, 2026, 9:01 PM):\nМне было тепло.\n[NED] (Mar 15, 2026, 8:00 PM):\nДобрый вечер.\n`;
    const r = mkdtempSync(join(tmpdir(), "house-active-night-")), mem = { pieceChars: 0, indexPaths: ["Shelf/*.md"] };
    mkdirSync(join(r, "Shelf"), { recursive: true });
    writeFileSync(join(r, "Shelf", "thread.md"), RU, "utf8");
    await m.growWeb({ root: r, mem, letter: "x", known: [], selfNames: ["Ned"], ask: async (s) => (s === m.TAPE_SYSTEM ? "EXCERPT 1 | theirs: none | hers then: tender" : "nothing tonight"), embed: async (t) => t.map(() => null), inTime: () => true, log: () => {} });
    const f = S.activeDaysFile(r);
    check("night: the days it found pieces on are kept, sealed (never in plain text)", existsSync(f) && !readFileSync(f, "utf8").includes("2026-03"));
    const days = S.activeDaysOf(r, null, { links: [] }, {});
    check("night: a thread file with no date in its name still gives its days", J(days) === J(["2026-03-12", "2026-03-15"]), J(days));
}
{
    const PASTED = `[Ned]\nсмотри, что я нашёл:\n[NED] (Jan 3, 2026, 9:00 PM):\nстарое сообщение\n[Mia]\nпомню это\n[Ned]\nда\n`;
    const r = mkdtempSync(join(tmpdir(), "house-active-paste-")), mem = { pieceChars: 0, indexPaths: ["Shelf/*.md"] };
    mkdirSync(join(r, "Shelf"), { recursive: true });
    writeFileSync(join(r, "Shelf", "room_2026-03-20.md"), PASTED, "utf8");
    await m.growWeb({ root: r, mem, letter: "x", known: [], selfNames: ["Ned"], ask: async (s) => (s === m.TAPE_SYSTEM ? "EXCERPT 1 | theirs: none | hers then: tender" : "nothing tonight"), embed: async (t) => t.map(() => null), inTime: () => true, log: () => {} });
    const days = S.activeDaysOf(r, null, { links: [] }, {});
    check("night: a date inside pasted older text is not an active day (entry 287)", !days.includes("2026-01-03"), J(days));
}

// v1.2.1: Nesertes's regression lines after v1.2 (Nov 19, 2026; fixtures/quiet-signal-addendum/regression_lines_ru.md).
// 1. Names in -ий (5+ letters) take their noun case forms too; Сергей and Юрий as before; surnames, patronymics and adjectives don't.
for (const [n, s] of [["Дмитрий", "Я говорил с Дмитрием"], ["Дмитрий", "У Дмитрия сегодня отчёт"], ["Дмитрий", "Я написала Дмитрию"],
    ["Дмитрий", "Мы говорили о Дмитрии"], ["Василий", "Я накормила Василия"], ["Евгений", "Позвони Евгению"], ["Анатолий", "Мы ждали Анатолия"],
    ["Георгий", "Я видел Георгия"], ["Дмитрий", "Дмитрий пришёл"], ["Сергей", "Я говорил с Сергеем"], ["Сергей", "Сергея нет дома"],
    ["Юрий", "Я говорил с Юрием"], ["Юрий", "Юрию позвонили"], ["Дмитрий Петрович", "У Дмитрия Петровича отпуск"]])
    check(`found: ${n} in «${s}»`, find(n, s) === true);
for (const [n, s] of [["Дмитрий", "Мне написал Дмитриев"], ["Дмитрий", "Пришёл Иван Дмитриевич"], ["Анатолий", "Ольга Анатольевна дома"],
    ["Василий", "Я собрал васильки"], ["Василий", "Василиса пришла"], ["Русский", "Я говорю по-русски"], ["Тихий", "Было тихо"]])
    check(`not found: ${n} in «${s}»`, find(n, s) === false);
// Known limit: «Евгения» is both the woman's name and a case form of Евгений (like Ани and Аня below); finding never merges two dots.
check("known limit: Евгений in «Евгения пришла» is still found (a shared form)", find("Евгений", "Евгения пришла") === true);

// 2. "Мы с {n}" in the form a name takes after «с»: -ей after an unstressed -я, -ёй (or -ей) after a stressed one, -ью after a feminine -ь.
for (const [n, s] of [["таня", "мы с таней"], ["аня", "мы с аней"], ["мария", "мы с марией"], ["софья", "мы с софьей"], ["катя", "мы с катей"],
    ["любовь", "мы с любовью"], ["илья", "мы с ильёй"], ["илья", "мы с ильей"], ["игорь", "мы с игорем"], ["сергей", "мы с сергеем"],
    ["дмитрий", "мы с дмитрием"], ["маша", "мы с машей"]])
    check(`selfWith: «${s}» means me and ${n}`, L.selfWithWords(n).includes(s));
check("selfWith: English phrases unchanged («ned and me», «me and ned»)", J(L.selfWithWords("ned").filter((p) => /^[a-z ]+$/.test(p))) === J(["ned and me", "me and ned"]));
check("selfWith: other names in selfNames get the other languages' phrases only", L.selfWithWords("боря", true).includes("мы с борей") && !L.selfWithWords("nick", true).some((p) => /and me|me and/.test(p)));
// The same at the level of the graph: an "us" phrase is never a NEW dot, for every name in selfNames.
{
    const emptyW = () => ({ v: 1, nextH: 1, nextL: 1, done: [], shownOf: {}, hubs: [], links: [], aside: [], peeked: [], stats: { batches: 0, unusable: 0, rejected: 0, nothing: 0 } });
    const kept = (name, selfNames) => { const w = emptyW(); m.applyEvent(w, { t: 1, from: "2026-04-01", to: "2026-04-01", refl: [], moments: [], hubs: [{ ref: "NEW", type: "thing", name, aliases: [], about: "" }], threads: [], groups: [] }, { selfNames }); return w.hubs.length === 1; };
    for (const [name, sn] of [["мы с Таней", ["Таня"]], ["мы с Танёй", ["Таня"]], ["мы с Марией", ["Мария"]], ["мы с Ильей", ["Илья"]], ["мы с Ильёй", ["Илья"]],
        ["мы с Любовью", ["Любовь"]], ["мы с Борисом", ["Борис"]], ["мы с Борей", ["Борис", "Боря"]], ["мы с Борисом", ["Боря", "Борис"]], ["мы с Таней", ["Tanya", "Таня"]]])
        check(`graph: «${name}» with selfNames ${J(sn)} is "us", never a dot`, !kept(name, sn));
    check("graph: «мы с Дмитрием» with selfNames [Таня] is Tanya and Dmitry, kept", kept("мы с Дмитрием", ["Таня"]));
    // A nickname is not worked out from the full name: list it in selfNames (Борис, Боря).
    check("known limit: «мы с Борей» with only [Борис] listed is not \"us\" (list the nickname)", kept("мы с Борей", ["Борис"]));
    check("graph: English unchanged («Ned and me» is us; English phrases still come from the first name only)", !kept("Ned and me", ["Ned"]) && !kept("me and Ned", ["Ned", "Nick"]) && kept("Nick and me", ["Ned", "Nick"]));
}

// 3. Known limits: each word is letter for letter a real case form of the name; grammar alone can't decide (as «Я хочу мира»).
for (const [n, s] of [["Света", "Было видно в свете фар"], ["Света", "Мы второй час без света"], ["Поля", "Мы гуляли в поле"], ["Лена", "Я не пошла от лени"],
    ["Ника", "Мои ники в играх"], ["Маша", "Я машу тебе рукой"], ["Вера", "Я потерял веру"], ["Мира", "Он живёт в другом мире"], ["Любовь", "Это была любовь"]])
    check(`known limit: ${n} in «${s}» is still found (context only)`, find(n, s) === true);
check("not found: Любовь Петровна in «о большой любви» (a two-word name)", find("Любовь Петровна", "Сериал о большой любви") === false);
// 4. Two names sharing a form (known limit): a line about Ani is never proof about Anya.
check("known limit: «Я поговорил с Ани» can be Аня (genitive/dative/prepositional)", find("Аня", "Я поговорил с Ани") === true);
check("known limit: «Я встретил Мику» can be Мика (accusative)", find("Мика", "Я встретил Мику") === true);
check("Ани (indeclinable) is found only as written", find("Ани", "Я видел Аню") === false);

// The Quiet Signal addendum (Room 2, Tanya & Nora, Apr 1-5, 2026; fixtures/quiet-signal-addendum/): made up by Nesertes, never a real person.
{
    const QS = fileURLToPath(new URL("./fixtures/quiet-signal-addendum/", import.meta.url));
    const DAYS = ["2026-04-01", "2026-04-02", "2026-04-03", "2026-04-04", "2026-04-05"];
    const ru = Object.fromEntries(DAYS.map((d) => [d, readFileSync(join(QS, "RU_Test", `${d}.md`), "utf8")]));
    const en = DAYS.map((d) => readFileSync(join(QS, "EN_Reference", `${d}.md`), "utf8"));
    const turns = (t) => (t.match(/^\[(TANYA|NORA)\] \([A-Z][a-z]{2} \d{1,2}, 2026, \d{1,2}:\d{2} [AP]M\):$/gm) || []).length;
    check("addendum: five RU days and five EN days, 42 turns each, every turn with a speaker and a time", DAYS.every((d) => ru[d].length > 0) && Object.values(ru).reduce((n, t) => n + turns(t), 0) === 42 && en.reduce((n, t) => n + turns(t), 0) === 42);
    check("addendum: no day file looks like machine output (RU and EN)", !Object.values(ru).some(m.machineLike) && !en.some(m.machineLike));
    const r = mkdtempSync(join(tmpdir(), "house-quiet-addendum-")), mem = { pieceChars: 0, indexPaths: ["Shelf/*.md"] };
    mkdirSync(join(r, "Shelf"), { recursive: true });
    for (const d of DAYS) writeFileSync(join(r, "Shelf", `${d}.md`), ru[d], "utf8");
    const res = await m.growWeb({ root: r, mem, letter: "x", known: [], selfNames: ["Tanya", "Таня"], herName: "Nora", ask: async (s) => (s === m.TAPE_SYSTEM ? "EXCERPT 1 | theirs: none | hers then: calm" : "nothing tonight"), embed: async (t) => t.map(() => null), inTime: () => true, log: () => {} });
    check("addendum: the night skips nothing as machine output", res && res.machineSkipped === 0, J(res && res.machineSkipped));
    check("addendum: the night finds exactly five active days, Apr 1-5", J(S.activeDaysOf(r, null, { links: [] }, {})) === J(DAYS), J(S.activeDaysOf(r, null, { links: [] }, {})));
    // Names as the story uses them: every form of Дмитрий and Василий is found on the days they appear.
    const on = (n) => DAYS.filter((d) => find(n, ru[d]));
    check("addendum: Дмитрий is found on Apr 1, 2, 4, 5 (Дмитрий, Дмитрию, Дмитрия, с Дмитрием, о Дмитрии)", J(on("Дмитрий")) === J(["2026-04-01", "2026-04-02", "2026-04-04", "2026-04-05"]), J(on("Дмитрий")));
    check("addendum: Дима is found on Apr 2 (Диме)", J(on("Дима")) === J(["2026-04-02"]), J(on("Дима")));
    check("addendum: Василий is found on Apr 1, 3, 5 (Василия, Василию, Василий, с Василием)", J(on("Василий")) === J(["2026-04-01", "2026-04-03", "2026-04-05"]), J(on("Василий")));
    check("addendum: Ани is found only where Ани is written (Apr 2, 5)", J(on("Ани")) === J(["2026-04-02", "2026-04-05"]));
    // Separate people stay separate dots: Anya and Ani, Sveta, Polya, Lena, Lyubov Petrovna; Dmitry with Dima is one.
    const w = { v: 1, nextH: 1, nextL: 1, done: [], shownOf: {}, hubs: [], links: [], aside: [], peeked: [], stats: { batches: 0, unusable: 0, rejected: 0, nothing: 0 } };
    const P = (name, type = "person", aliases = []) => ({ ref: "NEW", type, name, aliases, about: "" });
    m.applyEvent(w, { t: 1, from: "2026-04-01", to: "2026-04-05", refl: [], moments: [], hubs: [P("Дмитрий", "person", ["Дима"]), P("Василий", "pet"), P("Аня"), P("Ани", "thing"), P("Поля"), P("Света"), P("Лена"), P("Любовь Петровна"), P("мы с Таней", "thing")], threads: [], groups: [] }, { selfNames: ["Tanya", "Таня"], herName: "Nora" });
    const names = w.hubs.map((h) => h.name).sort();
    check("addendum: eight separate dots (Anya and Ani apart, Dmitry with Dima as one), and no \"us\" dot", J(names) === J(["Ани", "Аня", "Василий", "Дмитрий", "Лена", "Любовь Петровна", "Поля", "Света"].sort()) && w.hubs.find((h) => h.name === "Дмитрий")?.aliases.includes("Дима"), J(w.hubs.map((h) => [h.name, h.aliases])));
}

console.log(`\n${pass} passed, ${fail} failed. (Made-up names and dates only; throwaway folders in ${tmpdir()})`);
process.exit(fail ? 1 : 0);
