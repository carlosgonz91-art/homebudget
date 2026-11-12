# HomeBudget
A private budgeting app for one household. The whole app is one HTML file, plain JavaScript, no framework.
Your data stays in your browser (IndexedDB) and is never sent anywhere. It reads bank statements in CSV, OFX
and PDF form, and can pull balances and transactions from your banks through SimpleFIN.
Live at https://carlosgonz91-art.github.io/homebudget/

## Folders
| Path | What it is |
|---|---|
| `src/homebudget.src.html` | The app source: title, styles, markup and script. **Edit this file.** |
| `vendor/pdfjs/` | pdf.js 3.11.174 (Apache-2.0), built into the app so it can read PDF statements |
| `build.py` | Builds `index.html` from the source and pdf.js |
| `index.html` | The built app that GitHub Pages serves. **Never edit by hand**, every build overwrites it |
| `tests/` | `test_core.js` and `audit_test.js`. They read the built `index.html`, so build first |
| `sw.js` | Service worker: keeps a copy of the app so it opens offline |
| `manifest.webmanifest`, `*.png` | Install-as-an-app settings and icons |

## Build and test
Needs Python 3 and Node. Works on Windows, Mac and Linux. Run these from the repo folder:
```
python build.py
node tests/test_core.js
node tests/audit_test.js
```
The build prints the finished file size. Both tests should end with "ALL ... PASSED".

## Releasing a change
1. Edit `src/homebudget.src.html` (and `sw.js` if the offline files changed).
2. Bump `APP_VERSION` in the source, and the `CACHE` name in `sw.js`, so phones pick up the new version.
3. Run the build and both tests.
4. Commit the source, `index.html` and `sw.js` together, then push to `main`.

## Deploy (GitHub Pages)
GitHub Pages serves the files straight from the repo: **Settings > Pages > Deploy from a branch**, branch `main`,
folder `/ (root)`. Nothing is built on GitHub, so the committed `index.html` is what visitors get. Always run
`python build.py` before you commit, or the site will still show the old app.

After a push the site updates in about a minute. The app checks the network first, so a reload picks up the new
version; the next open after that runs it. On a phone where it is installed, close and reopen the app.

## Notes
- The built-in merchant rules and mortgage values (`seedRules`, `seedLoan`, the `rv3` EMC rule) are meant to be there.
- Pinch-zoom is turned off on purpose (the viewport line in `build.py`).
- Saved data lives in the browser database `homebudget`. Do not rename stored fields, or saved data stops loading.
