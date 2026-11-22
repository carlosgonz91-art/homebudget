# HomeBudget backlog

Running list of bugs and ideas. Nothing here is being worked on right now.

## How this works

Carlos has ADHD and ideas arrive constantly, usually in the middle of something else.
Writing them down here keeps them from derailing whatever is already in progress.

Rules for anyone working on this repo, human or AI:

1. When Carlos reports a bug or an idea, add it to this file. Do not start fixing it.
2. Only write code when he explicitly says so, for example "fix 3 and 7" or "work the backlog".
3. After adding an item, reply in one or two lines. Confirm it is logged, nothing more.
4. If an item is unclear, add it anyway with a short note that it needs detail. Ask later, in a batch.
5. When an item is shipped, move it to Done with the version it went out in.

Exception: if something is actively broken for users right now, say so plainly and ask
whether to fix it immediately. Do not decide that on your own.

## Next patch

Items picked for the next release. Numbered so they are easy to refer to.

1. CLAUDE.md + BACKLOG.md rules: no code at all until Carlos says "build the patch". Everything else (bugs, ideas, changes) is only logged here. Questions and read-only checks are still answered right away. Override: if he explicitly says to do it now (e.g. "fix this now, don't wait for the patch", "fix only this issue now"), do just that item right away and ship it.
2. CLAUDE.md: add working notes learned so far: brief patch notes per release; test on Android/desktop only (no iPhone work); after a build, also save HomeBudget.html to his Downloads when the PC is linked; keep screenshots and test scripts out of the repo; same look and behavior app-wide.

## Later

Not scheduled. Ideas, nice-to-haves, things that need more thought.

- _(empty)_

## Needs detail

Logged but too vague to act on yet.

- _(empty)_

## Done

Shipped items, newest first. Keep the version number so it is possible to trace when
something changed.

- v1.86.0: Fidelity NetBenefits 401(k) statements ("Retirement Savings Statement" PDF) import as investment accounts (DTCC 401(k) · Carlos / · Hannah) with their funds; they count in Investments, positions, mix and net worth. SimpleFIN does not send these plans.
- v1.85.17: Budgets top card, removed the Income figure (same as the Income row). Income row says "$6,972" instead of "$6,972 received".
