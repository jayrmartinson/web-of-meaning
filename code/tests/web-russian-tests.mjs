// Part of The Web of Meaning: A Memory Design for Companions (Jay R. Martinson, 2026). MIT license; see LICENSE.
// Russian names, words and dates (Nesertes's native-speaker review, Nov 14, 2026, section 5), Russian two-digit years,
// and salience for ranking only (a link opened by its mark counts as recent; optional cooling in active days).
// Made-up data only. Finding a name in a line never merges two dots; the other test files check English is unchanged.
process.env.WEB_OF_MEANING_TEST = "1";
import * as m from "../meaning.mjs";
import * as L from "../lang.mjs";
import { tmpdir } from "node:os";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
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

console.log(`\n${pass} passed, ${fail} failed. (Made-up names and dates only; throwaway folders in ${tmpdir()})`);
process.exit(fail ? 1 : 0);
