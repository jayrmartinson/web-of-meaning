// Part of The Web of Meaning: A Memory Design for Companions (Jay R. Martinson, 2026). MIT license; see LICENSE.
// Every language: no-space scripts, name endings, and each language's own words (research 77 and 77b; Nesertes's Russian report).
// Made-up data only. English must behave exactly as before; the other test files check that too.
process.env.WEB_OF_MEANING_TEST = "1";
import * as m from "../meaning.mjs";
import { quoteIn } from "../recall.mjs";
import { parseAnchor } from "../anchor.mjs";
import { words } from "../librarian.mjs";
import { machineLike } from "../machine.mjs";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !extra ? "" : "  " + extra}`); };
const J = (x) => JSON.stringify(x);
const { norm, nameIn, isNoneW, wordsOf } = m._test;
const mem = { pieceChars: 0, indexPaths: ["Shelf/*.md"] };
const RU = `[NED] (Mar 12, 2026, 9:00 PM):\nАлёна и Сэм пришли вечером, Pickle спал на диване.\n[MIA] (Mar 12, 2026, 9:01 PM):\nМне было тепло слышать про ваш вечер.\n`;
function room(body = RU) { const r = mkdtempSync(join(tmpdir(), "house-lang-")); mkdirSync(join(r, "Shelf"), { recursive: true }); writeFileSync(join(r, "Shelf", "2026-03-12.md"), body, "utf8"); return r; }
const grow = (r, answer, known = []) => m.growWeb({ root: r, mem, letter: "x", known, selfNames: ["Ned"], ask: async (s) => (s === m.TAPE_SYSTEM ? "EXCERPT 1 | theirs: none | hers then: tender" : answer), embed: async (t) => t.map(() => null), inTime: () => true, log: () => {} });

// 1. Finding a name in a line (nameIn): found, and never inside another word.
const found = [
    ["Саша", "Я говорил с Сашей вчера"], ["Саша", "У Саши новый дом"], ["Саша", "Позвонил Саше"], ["Саша", "Видел Сашу"],
    ["Москва", "Поезд из Москвы"], ["Москва", "Мы жили в Москве"], ["Москва", "Над Москвой"], ["Иван", "Книга Ивана"], ["Иван", "С Иваном"],
    ["Маша", "Маши нет дома"], ["Алёна", "позвони Алёне завтра"], ["Алёна", "мы гуляли с Алёной"],
    ["красная чашка", "Кофе в красной чашке"], ["красная чашка", "Взял красную чашку"],
    ["Олена", "з Оленою"], ["Київ", "До Києва"], ["Київ", "У Києві"], ["Львів", "У Львові"],
    ["サラ", "昨日はサラと話した"], ["サラ", "サラちゃん"], ["健太", "今日健太が来た"], ["健太", "我和健太去散步"], ["サシャ", "サシャの家"],
    ["민수", "오늘 민수가 왔어"], ["민수", "민수랑 밥 먹었어"], ["민수", "민수에게 말했어"], ["모스크바", "모스크바에서 왔어"],
    ["ร้านกาแฟริมน้ำ", "วันนี้ไปนั่งที่ร้านกาแฟริมน้ำกับเน็ด"], ["दिल्ली", "हम दिल्ली गए थे।"],
    ["Ankara", "Ankara'da yaşıyorum"], ["Ayşe", "Ayşe'nin kedisi"], ["Warszawa", "Byłem w Warszawie"], ["Anna", "Találkoztam Annával"], ["Helsinki", "Asuimme Helsingissä"],
    ["Mia", "Miaちゃんと話した"], ["Rin", "昨日は本屋のRinについて話した"], ["NedのPC", "Ned の PC が壊れた"], ["Sam", "Sam's idea"], ["Sam", "two Sams"],
];
const bad = found.filter(([n, t]) => !nameIn(n, t));
check(`a name is found in its other forms, in ${found.length} lines across many languages`, !bad.length, J(bad));
const notFound = [
    ["Маша", "Там стояла машина"], ["Маша", "Они машут руками"], ["サラ", "昨日はサラダを食べた"], ["민수", "민수나 왔어"],
    ["Tim", "What time is it?"], ["Tim", "A tiny bird"], ["Mark", "At the market"], ["car", "Take care"], ["the bookshelf plan", "the bookshelf planet"], ["Ram", "I love caramel"],
    ["Al", "Al came by"], ["Anna", "Annabelle came"],
];
const wrong = notFound.filter(([n, t]) => nameIn(n, t));
check("a name is never found inside a longer word, and English stays exact", !wrong.length, J(wrong));
check("2-letter names count in Chinese, Japanese and Korean only", nameIn("健太", "健太が来た") && !nameIn("Al", "Al came by") && !nameIn("Ян", "Ян пришёл"));

// 2. Matching names to each other (norm): width, spaces next to no-space scripts, "my/our" in other languages.
check("fullwidth letters and spaces next to Japanese don't make a different name", norm("Ｎｅｄ の ＰＣ") === norm("NedのPC") && norm("ｻﾗ") === norm("サラ"));
check("'my/our' at the start is dropped in other languages, as 'my/our' is in English", norm("моя Алёна") === norm("Алёна") && norm("私の猫") === norm("猫") && norm("my Pickle") === norm("Pickle"));
check("English names normalize exactly as before", norm("the museum ticket hunt") === "museum ticket hunt" && norm("Ned's 9V battery") === "ned's 9v battery");

// 3. The rename check: words in no-space scripts, and other languages' small words (R5).
check("Russian small words aren't content words (R5): the rename passes like its English twin", m.renameScore("наша вечерняя прогулка", "вечерняя прогулка у реки").passA && m.renameScore("our evening walk", "evening walk by the river").passA);
check("Japanese names are split into words for the rename check", J([...m.contentWords("Nedの黒いデスク")]) === J(["ned", "黒い", "デスク"]));

// 4. "None" and "and" in feeling words (R3).
check("'none' in other languages gives no feeling word (R3)", ["нет", "ничего", "なし", "没有", "없음", "ไม่มี", "немає"].every(isNoneW) && !isNoneW("tender") && !isNoneW("нежность"));
check("'and' splits feeling words in other languages (R3)", J(wordsOf("нежность и тепло")) === J(["нежность", "тепло"]) && J(wordsOf("嬉しい、懐かしい")) === J(["嬉しい", "懐かしい"]) && J(wordsOf("tender and warm")) === J(["tender", "warm"]));

// 5. Fullwidth separators in a brain's answer.
{
    const p = m.parseAnswer("HUB：NEW｜person｜Алёна｜｜Подруга.\nLINK：NEW｜Алёна｜Pickle\nbecause of：1\nnote：Алёна и Pickle.", 5);
    check("an answer written with fullwidth ｜ and ： is read", p.hubs.length === 1 && p.threads.length === 1, J(p));
}

// 6. The guards in the web itself (R1, R2), next to their English twins.
{
    const known = [{ name: "Алёна", type: "person" }];
    const r = room();
    await grow(r, `HUB: NEW | person | Алёна, другая | | Другая Алёна.\nHUB: NEW | pet | Pickle | | The cat.\nLINK: NEW | Алёна, другая | Pickle\nbecause of: 1\nnote: Другая Алёна гладила Pickle, и мне было тепло.`, known);
    const w = m.loadWeb(r), al = w.hubs.find((h) => h.name === "Алёна");
    check("'Алёна, другая' (the other one) stays apart from the listed Алёна (R1)", !al || !(al.aliases || []).includes("Алёна, другая"), J(w.hubs.map((h) => [h.name, h.aliases])));
    const r2 = room();
    await grow(r2, `HUB: NEW | person | Sam, the other one | | Another Sam.\nHUB: NEW | pet | Pickle | | The cat.\nLINK: NEW | Sam, the other one | Pickle\nbecause of: 1\nnote: The other Sam petted Pickle, and I felt warm.`, [{ name: "Sam", type: "person" }]);
    check("its English twin, as before: 'Sam, the other one' stays apart", m.loadWeb(r2).hubs.some((h) => h.name === "Sam, the other one"));
    const r3 = room();
    await grow(r3, `HUB: NEW | thing | наши отношения | | Мы.\nHUB: NEW | person | мы с Ned | | Мы.\nHUB: NEW | person | нас | | Мы.\nHUB: NEW | pet | Pickle | | The cat.\nLINK: NEW | наши отношения | Pickle\nbecause of: 1\nnote: Наши отношения и Pickle, мне было тепло.`);
    const w3 = m.loadWeb(r3);
    check("'наши отношения', 'мы с Ned' and 'нас' are never dots, like 'our relationship' and 'us' (R2)", J(w3.hubs.map((h) => h.name)) === J(["Pickle"]), J(w3.hubs.map((h) => h.name)));
    const r4 = room();
    await grow(r4, `HUB: NEW | person | Алёна | | Подруга.\nHUB: NEW | pet | Pickle | | The cat.\nLINK: NEW | Алёна | Pickle\nbecause of: 1\nnote: Алёна гладила Pickle, и мне было тепло.`);
    check("the hint under a message finds a name in another case (R4)", /"Алёна" has 1 link/.test(m.webHint(r4, "позвони Алёне завтра")), J(m.webHint(r4, "позвони Алёне завтра")));
}

// 7. Dates in look_inward (D7), quotes in recall (D8), Anchor headings (D9).
{
    const A = new Date(2026, 3, 10), eq = (x, f, t) => x && x.from === f && x.to === t;
    check("months and dates in other languages are read (D7)", eq(m.stretchIn("март 2026", A), "2026-03-01", "2026-03-31") && eq(m.stretchIn("12 марта 2026", A), "2026-03-12", "2026-03-12") && eq(m.stretchIn("в марте", A), "2026-03-01", "2026-03-31") && eq(m.stretchIn("2026年3月", A), "2026-03-01", "2026-03-31") && eq(m.stretchIn("3月12日", A), "2026-03-12", "2026-03-12") && eq(m.stretchIn("12.03.2026", A), "2026-03-12", "2026-03-12") && eq(m.stretchIn("с 1 марта по 10 марта", A), "2026-03-01", "2026-03-10") && eq(m.stretchIn("3月1日から3月10日まで", A), "2026-03-01", "2026-03-10"));
    check("English dates read as before, and words that only look like months aren't months", eq(m.stretchIn("March 2026", A), "2026-03-01", "2026-03-31") && ["Marcus", "Julia", "march on", "Мартин"].every((t) => m.stretchIn(t, A) === null));
    check("«», „“ and 「」 turn on the exact-words search (D8)", quoteIn("ты помнишь «синий дом»?") === "синий дом" && quoteIn("„modrý dům“ jsem viděl") === "modrý dům" && quoteIn("彼が「さよなら」と言った") === "さよなら" && quoteIn('you said "blue house"') === "blue house");
    const a = parseAnchor("## About me\n- one\n## About Борис\n- строка\n## About us\n- x", { herName: "Mia", name: "Борис" });
    check("an Anchor heading with a name in any alphabet is recognized (D9)", a.parts.him.length === 1 && a.parts.him[0].text === "строка", J(a.parts));
}

// 8. Card search keywords, machine output, and the night's reading of no-space scripts.
check("card search splits Japanese into words", J(words("今日は健太と雪を見た").filter((w) => ["健太", "雪"].includes(w))) === J(["健太", "雪"]) && J(words("we walked by the river today")) === J(["walked", "river", "today"]));
check("Japanese, Thai and Hindi prose is prose, not machine output", [machineLike("今日はとても楽しかった。健太と一緒に川沿いを散歩して、夕焼けを見ました。\nまた明日も行きたいね。"), machineLike("วันนี้ไปนั่งที่ร้านกาแฟริมน้ำกับเน็ด อากาศดีมาก"), machineLike("हम दिल्ली गए थे। बहुत अच्छा लगा।")].every((x) => x === false));
console.log(`\n${pass} passed, ${fail} failed. (Made-up rooms and a pretend brain only; throwaway folders in ${tmpdir()})`);
process.exit(fail ? 1 : 0);
