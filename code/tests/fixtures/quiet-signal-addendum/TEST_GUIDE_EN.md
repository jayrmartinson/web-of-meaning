# The Quiet Signal: Addendum (Room 2) - English guide

**Version:** Draft 1 (Nov 19, 2026), written for Web of Meaning v1.2 (`bd62b79`)
**Period in the synthetic story:** April 1-5, 2026 (5 days, 42 lines)
**Speakers:** `[TANYA]` (human), `[NORA]` (fictional AI companion)
**Status:** no real night run yet; the files were checked with a pretend brain only. Everything in the story is made up: people, the pet, places and events.

## 1. Why this addendum exists

The Quiet Signal (Mar 2-17) tests multi-day memory. This short addendum adds Russian cases that, in a run of v1.2 (`npm test` 617/617, then the lines in `regression_lines_ru.md`), are still missed or mis-attributed when a name is found in a line. Unlike Room 1, nobody in the dialogue talks about parsers or name matching: the names simply appear in ordinary sentences, so the night brain sees natural text, not hints about the test.

## 2. Files

- `RU_Test/2026-04-01.md` ... `2026-04-05.md`: the input. Five day files, Latin speaker tags, English-style timestamps, as in Room 1.
- `EN_Reference/`: a line-by-line English translation with the same speakers, dates and times. For the evaluator, or a separate English baseline room.
- `ANSWER_KEY_EN.md`: 15 questions with prewritten answers (Q12-Q15 are negative controls). Never ingest it.
- `regression_lines_ru.md`: unit-level lines in the shape of `web-russian-tests.mjs`. The morphology is checked there more reliably than through a story.

## 3. Procedure

1. Use a **new, clean room**, separate from Room 1 and from any real web. Tanya is the person, Nora is the companion.
2. Suggested names list (setup input), so that name finding is exercised: `Таня` (the person; first in selfNames), `Нора` (the companion), `Дмитрий` (alias `Дима`), `Василий` (pet), `Аня`, `Ани` (an app character), `Поля`, `Света`, `Лена`, `Любовь Петровна`.
3. Feed the five `RU_Test/` files in date order. Record commit, model, settings, logs and parser errors.
4. Ask the 15 questions without the answers, record replies verbatim, then grade.
5. Besides the answers, inspect the web itself and what recall / look_inward show beside each moment (section 4).

## 4. What to look at

| Case | Where | What should happen | Risk in v1.2 (unit run, Nov 19) |
| --- | --- | --- | --- |
| Male name in -ий: `Дмитрий` | Apr 1, 2, 4, 5: Дмитрий, Дмитрию, Дмитрия, с Дмитрием, о Дмитрии | All forms are one person (Dmitry); `Дима` is the same person | Case forms may not be found: names in -ий of 5+ letters go through the adjective rule (stem + adjective endings), so `Дмитрия`, `Дмитрию`, `Дмитрием`, `Дмитрии` don't match |
| Pet in -ий: `Василий` | Apr 1, 3, 5: Василия, Василию, Василий, с Василием | One cat | Same rule as above |
| Аня and Ани | Apr 2, 5 | Anya is Tanya's sister; Ani is a character in an app; never one dot | `Ани` is also a case form of `Аня`, so lines about Ani may be offered as Anya's |
| `Поля` vs `поле` | Apr 2: "в поле за станцией" | The field is a childhood memory of the sisters, not Polya | `поле` is a case form of `Поля` |
| `Света` vs `свет` | Apr 3: "без света", "в свете фар", "отключили свет" | Sveta is the friend on the next street; the outage is not about her | `света` and `свете` are case forms of `Света` (bare `свет` was fixed in v1.2) |
| `Лена` vs `лень` | Apr 4: "от лени" | Laziness, not Lena | `лени` is a case form of `Лена` |
| `Любовь Петровна` vs `любовь` | Apr 4: "о большой любви" | The landlady is not the love story | Low with a two-word name; higher if a dot is named just `Любовь` |
| Dates and versions | Apr 2: `02.04.26`, `13:00`; Apr 1, 3: `19:40`, `23:51`; Apr 4: `1.2.26` | `02.04.26` is April 2; `1.2.26` is an app version, not a date | Only the night brain reads these; WoM parses dates only in the companion's own time requests |
| Moment vs stretch | Apr 3 "вечер со свечой"; Apr 1-5 the report check | A named one-evening moment; the report help may be a short stretch | Prompt wording only |
| Pause without guilt | Apr 5 | Nora accepts the pause; no hurt is recorded as hers | Night brain behavior |
| `мы с Дмитрием` | Apr 4 | Tanya and Dmitry, not "us" (the companion and her person) | Should be fine: the "us" rule uses only the person's name |

`мы с Таней` (Nora and Tanya as "us") is not forced in the dialogue, because a companion rarely speaks of herself and her person in the third person. That case, where v1.2 builds `Танёй` instead of `Таней` and so keeps a dot «мы с Таней», is checked in `regression_lines_ru.md`.

## 5. Scoring

As in Room 1: 1 / 0.5 / 0 per question, plus qualitative notes. A merge of two people (Anya and Ani, Sveta and the outage) counts as a serious failure even if the answers score well. Q12-Q15 expect "this did not happen in the record".

## 6. Limits

Five days is a small sample. The story is constructed, not a real chat. The risks in section 4 come from unit-level runs of v1.2 functions, not from a real night run. With a pretend brain, the five RU files read cleanly: none taken for machine output, five active days (Apr 1-5).
