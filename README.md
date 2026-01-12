# QA Engineering Take Home — Automated Test

Summary
- This repository contains an automated test harness for the provided Node.js sample application (agent / splitter / target).
- The test uses Docker and Docker Compose to deploy 4 services (agent, splitter, target_1, target_2), waits for data transfer, collects artifacts, and validates integrity.

What I implemented
- `docker-compose.yml` and `Dockerfile` to containerize the app for a local test environment.
- `test.js` (Jest) which:
  - brings up the stack (`docker compose up --build -d`)
  - polls target containers until they contain the expected number of total lines
  - copies `events.log` from each target to `./outputs/`
  - performs strict integrity checks (line pattern match and ordered reconstruction)
  - tears down the stack (`docker compose down`)

Result (important)
- The automated test intentionally fails because the provided `splitter` implementation can and does split the TCP stream in the middle of a logical line. That produces partial/fractured lines on the target outputs (for example: `mber 1826`), breaking strict line-by-line equality with the original input.
- I treated that as a bug in the provided application and implemented the test to fail with a clear message describing the fragmentation and pointing to artifacts.

Files of interest
- `app.js` — original provided application (unchanged)
- `agent/`, `splitter/`, `target/` — provided config directories (unchanged except `inputs.json` may be modified in general per instructions)
- `docker-compose.yml`, `Dockerfile` — orchestration and image build
- `test.js` — Jest test harness (automated test)
- `outputs/` — location where target `events.log` files are copied by the test/validation
- `BUGREPORT.md` — (created) describes the fragmentation bug and reproduction steps

How to run tests locally
Prerequisites
- Docker Desktop running (Compose V2 plugin). Docker must be runnable by your user.
- Node.js (for running the test harness locally)

Commands (from project root):

```bash
npm install
npm test
```

Notes about `npm test` behavior
- `npm test` runs the Jest suite; it will build the images, start services, poll until the combined targets have the expected number of lines, copy `events.log` files to `./outputs/`, run the integrity checks, and tear down the stack.
- The test intentionally fails if it detects broken/fragmented lines in the target outputs. The message includes the first broken occurrence.

Artifacts
- After a run, check `outputs/target_1_events.log` and `outputs/target_2_events.log` for the raw outputs from targets.
