const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

describe('QA Take Home Test', () => {
  beforeAll(async () => {
    // Build and start the services
    console.log('Building and starting services...');
    execSync('docker-compose up --build -d', { stdio: 'inherit' });

    // Poll until both target files contain the same total number of lines as the source
    console.log('Waiting for data transfer (polling)...');

    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

    const getLines = (svc) => {
      try {
        const cid = execSync(`docker compose ps -q ${svc}`).toString().trim();
        if (!cid) return 0;
        const cmd = `docker exec ${cid} sh -c "if [ -f /app/events.log ]; then wc -l < /app/events.log; else echo 0; fi"`;
        const out = execSync(cmd).toString().trim();
        return parseInt(out) || 0;
      } catch (e) {
        return 0;
      }
    };

    const originalData = fs.readFileSync('./agent/inputs/large_1M_events.log', 'utf8');
    const originalLines = originalData.trim().split('\n').length;

    jest.setTimeout(10 * 60 * 1000); // 10 minutes
    const timeoutMs = 8 * 60 * 1000; // 8 minutes
    const pollIntervalMs = 3000; // 3s
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const t1 = getLines('target_1');
      const t2 = getLines('target_2');
      const combined = (t1 || 0) + (t2 || 0);
      console.log(`target_1=${t1} target_2=${t2} combined=${combined} / original=${originalLines}`);
      if (combined >= originalLines && originalLines > 0) {
        console.log('Detected completed transfer to targets.');
        return;
      }
      await sleep(pollIntervalMs);
    }

    throw new Error('Timeout waiting for targets to receive complete data');
  }, 900000); // 15 minutes timeout for beforeAll

  afterAll(() => {
    // Stop and remove containers
    console.log('Stopping services...');
    execSync('docker-compose down', { stdio: 'inherit' });
  });

  test('Validates data received on Target nodes', () => {
    // Copy output files from containers
    const outputDir = path.join(__dirname, 'outputs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    execSync('docker cp $(docker-compose ps -q target_1):/app/events.log ./outputs/target_1_events.log');
    execSync('docker cp $(docker-compose ps -q target_2):/app/events.log ./outputs/target_2_events.log');

    // Read the files
    const target1Data = fs.readFileSync('./outputs/target_1_events.log', 'utf8');
    const target2Data = fs.readFileSync('./outputs/target_2_events.log', 'utf8');

    // Read original data
    const originalData = fs.readFileSync('./agent/inputs/large_1M_events.log', 'utf8');

    // Split into lines
    const originalLines = originalData.trim().split('\n');
    const target1Lines = target1Data.trim().split('\n');
    const target2Lines = target2Data.trim().split('\n');

    // Strict integrity check: ensure lines were not split mid-line by the splitter.
    // The expected format is: "This is event number <N>" per line.
    const linePattern = /^This is event number \d+$/;
    const findInvalid = (lines) => {
      for (let idx = 0; idx < lines.length; idx++) {
        if (!linePattern.test(lines[idx])) return { idx: idx + 1, line: lines[idx] };
      }
      return null;
    };

    const bad1 = findInvalid(target1Lines);
    const bad2 = findInvalid(target2Lines);
    if (bad1 || bad2) {
      const sample = bad1 || bad2;
      throw new Error(`Detected fragmented/broken lines in target outputs. This indicates the provided application
splits the stream mid-line. First broken occurrence: target line ${sample.idx}: "${sample.line}"\n`);
    }

    // Validate that combined lines match original
    const combinedLines = [];
    let i = 0, j = 0;
    while (i < target1Lines.length || j < target2Lines.length) {
      if (i < target1Lines.length) combinedLines.push(target1Lines[i++]);
      if (j < target2Lines.length) combinedLines.push(target2Lines[j++]);
    }

    expect(combinedLines).toEqual(originalLines);

    // Additional check: target1 should have odd lines, target2 even
    // Since alternating starting with first to target1
    expect(target1Lines.length).toBe(Math.ceil(originalLines.length / 2));
    expect(target2Lines.length).toBe(Math.floor(originalLines.length / 2));

    for (let k = 0; k < target1Lines.length; k++) {
      expect(target1Lines[k]).toBe(originalLines[k * 2]);
    }
    for (let k = 0; k < target2Lines.length; k++) {
      expect(target2Lines[k]).toBe(originalLines[k * 2 + 1]);
    }
  });
});