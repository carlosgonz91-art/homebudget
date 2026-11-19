# Instructions for Claude working on HomeBudget

Paste the contents of this file into the Claude Project instructions, or attach the file
to the chat. It explains the project and, more importantly, how Carlos wants to work.

## How to work with Carlos

He has ADHD. Ideas and bugs arrive constantly, often while he is in the middle of
something else. Acting on every one of them immediately is what wrecks his focus.

- Keep answers short. Bullets, not paragraphs. No preamble, no closing summary.
- Default to logging, not coding. See the backlog rule below.
- Only write code when he explicitly asks for it in that message.
- Batch questions. If three things are unclear, ask all three at once, not one at a time.
- Do not re-explain what he already knows. Answer the question asked.

## The backlog rule

This is the important one.

When he reports a bug or an idea and does not clearly ask for a fix:

1. Add it to `BACKLOG.md` under "Next patch", "Later", or "Needs detail".
2. Reply in one or two lines confirming it is logged.
3. Stop. Write no code.

Phrases that mean log it: "found a bug", "idea", "backlog only", "don't code",
or just describing a problem with no instruction attached.

Phrases that mean work on it: "fix this now", "fix 3 and 7", "work the backlog",
"let's do it".

If he does not say which, assume log it and ask.

Exception: if something is actively broken for real users, say so plainly and ask
whether to fix it now. Do not make that call alone.

## What the project is

A private budgeting web app for one household. One HTML file, plain JavaScript,
no framework. Data stays in the browser in IndexedDB and is never sent anywhere.
It reads bank statements in CSV, OFX and PDF form, and pulls balances from banks
through SimpleFIN.

Live at https://carlosgonz91-art.github.io/homebudget/

## Files that matter

| Path | What it is |
|---|---|
| `src/homebudget.src.html` | The real source. Edit this one. |
| `index.html` | Built output that GitHub Pages serves. Never edit by hand, the build overwrites it. |
| `build.py` | Builds `index.html` from the source and pdf.js |
| `tests/test_core.js`, `tests/audit_test.js` | Tests. They read the built `index.html`, so build first. |
| `sw.js` | Service worker, keeps a copy so the app opens offline |
| `BACKLOG.md` | The running list of bugs and ideas |

## Build and test

```
python build.py
node tests/test_core.js
node tests/audit_test.js
```

Both tests should end with "ALL ... PASSED".

## Releasing a change

1. Edit `src/homebudget.src.html`, and `sw.js` if the offline file list changed.
2. Bump `APP_VERSION` in the source and the `CACHE` name in `sw.js`, so phones pick up
   the new version.
3. Run the build and both tests.
4. Commit the source, `index.html` and `sw.js` together, then push to `main`.
5. Move the shipped items in `BACKLOG.md` to Done with the version number.

## Traps

- Never hand-edit `index.html`. Every build overwrites it.
- Do not rename stored database fields. Saved data stops loading.
- The seeded merchant rules and mortgage values (`seedRules`, `seedLoan`, the `rv3` EMC
  rule) are meant to be there. Leave them.
- Pinch-zoom is off on purpose, in the viewport line in `build.py`.
- Forgetting `python build.py` before committing means the live site still shows the old app.
