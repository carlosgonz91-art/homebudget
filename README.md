# HomeBudget

A private budgeting app for one household. The whole app is one HTML file, plain JavaScript, no framework. Your data stays in the browser (IndexedDB). Live at https://carlosgonz91-art.github.io/homebudget/

## Folders

| Path | What it is |
|---|---|
| `src/homebudget.src.html` | The app source. **Edit this file.** |
| `vendor/pdfjs/` | pdf.js 3.11.174 (Apache-2.0), inlined into the build to read PDF statements |
| `build.py` | Builds `index.html` from the source and pdf.js |
| `index.html` | The built app. GitHub Pages serves it. **Never edit by hand**, it is overwritten on every build |
| `tests/` | `test_core.js` and `audit_test.js`, they load the built `index.html` |
| `sw.js`, `manifest.webmanifest`, `*.png` | Offline cache, install-as-app settings and icons |

## Build and test

Needs Python 3 and Node. Works on Windows, Mac and Linux.

```
python build.py
node tests/test_core.js
node tests/audit_test.js
```

Both tests should end with "ALL ... PASSED".

## Releasing a change

1. Edit `src/homebudget.src.html`.
2. Bump `APP_VERSION` in it, and the `CACHE` name in `sw.js`.
3. Run the build and both tests.
4. Commit the source, `index.html` and `sw.js` together, then push. GitHub Pages updates in about a minute.

## Notes

- Hard-coded merchant rules and mortgage values (`seedRules`, `seedLoan`, the `rv3` EMC rule) are intentional.
- Pinch-zoom is turned off on purpose (viewport meta in `build.py`).
- Stored data lives in the browser database `homebudget`. Do not rename stored fields, or saved data stops loading.
