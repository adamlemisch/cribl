BUG REPORT — Stream fragmentation in provided sample app

Summary
- The sample application splits the TCP stream arbitrarily when forwarding from `splitter` to `target` services.
- This results in logical lines being fractured across writes to the target `events.log` files (e.g. `mber 1826`, `75`, etc.).

Observed behavior
- Combined line counts on `target_1` and `target_2` match the original input (no lost lines), but many lines are broken into fragments, so strict line-by-line reconstruction fails.
- Example broken fragments observed during local runs:
  - `mber 1826` (a suffix of "This is event number 1826")
  - `75` (fragment appearing as a standalone line)
- The test harness detected the first broken occurrence and failed with a clear message indicating the target line number and the fragment content.

Why this is a bug
- The sample application is expected (for this test) to preserve logical lines (events). Splitting in the middle of a line makes it impossible to do a strict line-by-line equality check between source and combined targets.
- A robust splitter should buffer and forward whole lines (or include an application-level framing mechanism) so receivers get complete events.

Reproduction steps
1. From project root, ensure Docker Desktop is running.
2. Run:

```bash
npm install
npm test
```

3. The Jest test will build and run containers, poll for completion, copy target `events.log` files to `./outputs/`, and then fail with a fragmentation error.
4. Inspect `./outputs/target_1_events.log` and `./outputs/target_2_events.log` to see raw fragments.

Files & artifacts
- `./outputs/target_1_events.log`
- `./outputs/target_2_events.log`
- `test.js` — the test harness that detects fragmentation and fails intentionally