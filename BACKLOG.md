# HomeBudget backlog

Running list of bugs and ideas. Nothing here is being worked on right now.

## How this works

Carlos has ADHD and ideas arrive constantly, usually in the middle of something else.
Writing them down here keeps them from derailing whatever is already in progress.

Rules for anyone working on this repo, human or AI:

1. When Carlos reports a bug or an idea, add it to this file. Do not start fixing it.
2. Write no code until he says "build the patch". Exception: he explicitly says to do one thing now ("fix this now, don't wait for the patch").
3. After adding an item, reply in one or two lines. Confirm it is logged, nothing more.
4. If an item is unclear, add it anyway with a short note that it needs detail. Ask later, in a batch.
5. When an item is shipped, move it to Done with the version it went out in.

Exception: if something is actively broken for users right now, say so plainly and ask
whether to fix it immediately. Do not decide that on your own.

## Next patch

Items picked for the next release. Numbered so they are easy to refer to.

1. Bug: Overview → Investments & loans → Investments tab shows the 401(k) names as "DTCC 401 · Carlos" / "· Hannah". The "(k)" is dropped; should read "DTCC 401(k) · Carlos".
2. Same card (Overview → Investments & loans → Investments): the per-account bars only compare each account with the largest one and read as unclear progress bars. Remove that meaning; do not add percentages. Redesign the card so it looks clean with the extra accounts now there (5 accounts incl. the two 401(k)s, gain/loss, cash ready, updated time, Mix below). Rearrange for a tidy, consistent layout.
3. Investments: list retirement accounts last, under a light "Retirement" divider (a small heading/line, not a separate card). Retirement = the 401(k)s and the Traditional IRAs (••8240, ••8918). Apply on the Invest tab "Your accounts" list and the Overview Investments card. Sorting still applies within each group.

## Later

Not scheduled. Ideas, nice-to-haves, things that need more thought.

- _(empty)_

## Needs detail

Logged but too vague to act on yet.

- _(empty)_

## Done

Shipped items, newest first. Keep the version number so it is possible to trace when
something changed.

- (docs) CLAUDE.md: "build the patch" rule with fix-now override, plus working notes.
- v1.86.0: Fidelity NetBenefits 401(k) statements ("Retirement Savings Statement" PDF) import as investment accounts (DTCC 401(k) · Carlos / · Hannah) with their funds; they count in Investments, positions, mix and net worth. SimpleFIN does not send these plans.
- v1.85.17: Budgets top card, removed the Income figure (same as the Income row). Income row says "$6,972" instead of "$6,972 received".
