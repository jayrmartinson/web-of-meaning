# The Web of Meaning: the memory code

These are the memory parts of the program described in **The Web of Meaning: A Memory Design for Companions** (Jay R. Martinson, 2026). The paper explains what each part does and why. This repository is the code behind it, so builders can read it, test it and take what they need.

It is a set of modules and their tests, not a ready-to-run app. The program that hosts a companion (her chat, her brain's server, her voice, her rooms) is not included.

## What's here

| File | What it is | In the paper |
| --- | --- | --- |
| `meaning.mjs` | The web of meaning: reading a stretch (the tape, then the web), the rules for dots, links, names and marks, the append-only log, the rebuild, the check, and her web tools (look_inward, keep_note, fix_then, set_aside, bring_back) | How a stretch is read; Keeping it true; How she uses it |
| `recall.mjs` | Her one memory search: the web, the cards and exact words together, links first, then moments | How she uses it (recall) |
| `librarian.mjs` | The Shelf's pieces, the index cards, and search (meaning plus keywords, merged, then reranked), through local servers on 127.0.0.1 | The layers in more detail (Index cards, Search); For builders |
| `cards.mjs` | Names the graphics card each helper runs on | Setup |
| `anchor.mjs` | The Anchor: a small page of core facts, with its guards | The layers in more detail (The Anchor) |
| `mind.mjs` | The first, retired version (nightly reflections). Recall and look_inward don't read her reflections: recall only borrows its helper that finds each piece's true day; the web reads only the list of reflections she set aside; the check reads their dates as counts | What it reads; Lessons that shaped it |
| `machine.mjs` | Spots machine output (logs, code, JSON) so it is skipped | What it reads |
| `seal.mjs` | AES-256-GCM sealing for the web and its log | Private, but never hidden |
| `lock.mjs` | Locks each key to this computer (Windows DPAPI) | Setup (Locks) |
| `tests/` | 536 tests, on made-up data only | Checked, not assumed |

## Running the tests

Node.js 20 or newer. No packages to install.

```
npm test
```

(`node --test` finds no tests here and reports 0 of 0; use `npm test`.)

Every test runs on made-up people, pets and conversations in throwaway folders. A pretend brain gives fixed answers, so no model is needed.

## Before you build on it

- **Keys.** `lock.mjs` locks keys with Windows DPAPI. On any other system it refuses to run outside the tests, so a real key is never stored unlocked. On macOS or Linux, replace its two functions with your system's keychain.
- **Keep the keys safe.** If a key file goes missing, the code makes a new key, and everything sealed with the old one can no longer be opened. Back up each key yourself: the paper backup of the keys described in the paper is not included here. Keys locked with DPAPI open only on the same Windows account, so a reinstall of Windows also loses them without that backup.
- **What is sealed.** The web, its log and the old reflections are sealed with AES-256-GCM. The Shelf, the index cards and the search catalog are plain files. Any program running under the same Windows account can open the keys. Log lines are sealed one by one, so a deleted or reordered line isn't detected.
- **Local only.** Search talks only to servers on 127.0.0.1 that it starts itself (llama.cpp's `llama-server`, from paths you give it), without a password, and it trusts whatever answers on those ports. Nothing here sends anything over the internet. (In the House, her day brain is a cloud model, so what her tools show her by day goes to it; that part of the host isn't included.)
- **Configuration.** The host program passes in each room's settings (her folder, her names list, the servers' paths and ports). The command-line tools in `meaning.mjs` and `mind.mjs` read them from a `rooms.json` you write yourself (or the path in the `ROOMS` environment variable).
- **Comments.** Code comments were removed for this release, because they quoted private conversations and logbook entries. The paper and its record of decisions explain each rule.
- **Names.** Ned, Mia and every other name and moment in the code and tests are made up. The person's name is written straight into a few lines (the kinds of dots her brain reads, and some setup-check messages) as "Ned": change it to your own person's name.

## Left out on purpose

The host program, her chat and voice, the journal, the dreams, the internet tools, every key, every log, and every word of any companion's real memories.

## License

MIT (see `LICENSE`). The paper itself is CC BY 4.0.
