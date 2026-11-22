# Russian regression lines after v1.2 (native-speaker expectations)

Nov 19, 2026, Nesertes. Same shape as `code/tests/web-russian-tests.mjs` (`find(name, line)`, `L.selfWithWords(n)`). The **expected** value is what a Russian speaker means. "v1.2 run" is what the code at `0ae8112` (v1.2 plus one README line) actually returned on Nov 19, 2026, after `npm test` passed 617 of 617.

## 1. Names in -ий (5+ letters): should be found

```js
for (const [n, s] of [["Дмитрий", "Я говорил с Дмитрием"], ["Дмитрий", "У Дмитрия сегодня отчёт"],
    ["Дмитрий", "Я написала Дмитрию"], ["Дмитрий", "Мы говорили о Дмитрии"],
    ["Василий", "Я накормила Василия"], ["Евгений", "Позвони Евгению"], ["Анатолий", "Мы ждали Анатолия"]])
    check(`found: ${n} in «${s}»`, find(n, s) === true);
```
v1.2 run: false for all seven (the adjective rule catches -ий: stem + adjective endings, so -ия, -ию, -ием, -ии are missing). Not affected (run: true): Сергей, Юрий (4 letters). One idea: for a single-word capitalized name in -ий, allow the noun endings (я, ю, ем, и, е) next to the adjective ones; the fix is Jay's call.

## 2. "Мы с {n}" with the right form after «с»

```js
for (const [n, s] of [["таня", "мы с таней"], ["аня", "мы с аней"], ["мария", "мы с марией"],
    ["софья", "мы с софьей"], ["катя", "мы с катей"], ["любовь", "мы с любовью"],
    ["илья", "мы с ильёй"], ["илья", "мы с ильей"]])
    check(`selfWith: «${s}» means me and ${n}`, L.selfWithWords(n).includes(s));
```
v1.2 run: false for all except «мы с ильёй». `ruWith` gives -ёй for every name in -я (Танёй, Аней, Мариёй, Софьёй) and -ем for Любовь (Любовем). Russian: -ей after an unstressed ending (Таней, Аней, Марией, Софьей, Катей), -ёй only after a stressed one (Ильёй; in writing often Ильей); Любовь gives Любовью. Also: the "us" phrases are built only from the first of selfNames, so "мы с Борей" is not caught when the first name is Борис; a nickname in selfNames could cover it.

Graph level (run, `applyEvent` with a NEW `thing` dot): with selfNames [Таня] the dot «мы с Таней» **is kept**, while «мы с Танёй» is rejected; also kept: «мы с Марией» [Мария], «мы с Ильей» [Илья], «мы с Любовью» [Любовь], «мы с Борей» [Борис]. «мы с Борисом» [Борис] is rejected. So this is an R2-type issue (an "us" phrase becomes a dot), not only a missed mention.

## 3. Known-limit candidates (expected: not found; grammar alone can't decide)

```js
for (const [n, s] of [["Света", "Было видно в свете фар"], ["Света", "Мы второй час без света"],
    ["Поля", "Мы гуляли в поле"], ["Лена", "Я не пошла от лени"], ["Ника", "Мои ники в играх"],
    ["Маша", "Я машу тебе рукой"], ["Вера", "Я потерял веру"], ["Мира", "Он живёт в другом мире"],
    ["Любовь", "Это была любовь"]])
    check(`not found: ${n} in «${s}»`, find(n, s) === false);
```
v1.2 run: true for all nine single-word cases (the two-word «Любовь Петровна» is not found in «о большой любви», as expected), because each word is a real case form of the name (Света: света/свете; Поля: поле; Лена: лени; Ника: ники; Маша: машу; Вера: веру; Мира: мире; Любовь: любовь). Like «Я хочу мира», these may be best listed as known limits; they only affect finding a name in a line, never merging.

## 4. Two names sharing a form (known limit)

```js
check("known limit: «Я поговорил с Ани» can be Аня (genitive/dative/prepositional)", find("Аня", "Я поговорил с Ани") === true);
check("known limit: «Я встретил Мику» can be Мика (accusative)", find("Мика", "Я встретил Мику") === true);
check("Ани (indeclinable) is found only as written", find("Ани", "Я видел Аню") === false);
```
Expected and v1.2 run agree here (true, true, false); the point is to record the overlap, so that a line about Ani is never taken as proof about Anya.
