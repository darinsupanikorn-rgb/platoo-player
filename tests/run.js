// ─── platoo-player: Test Runner ───
// Run all tests: node tests/run.js

import { execSync } from 'child_process';
import { readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const testFiles = readdirSync(__dirname).filter(f => f.endsWith('.test.js') && f !== 'run.js');

console.log(`\nRunning ${testFiles.length} test file(s)...\n`);

let totalPassed = 0;
let totalFailed = 0;

for (const file of testFiles) {
  const filePath = join(__dirname, file);
  try {
    const output = execSync(`node "${filePath}"`, {
      encoding: 'utf-8',
      env: { ...process.env, NODE_OPTIONS: '' },
      timeout: 10000
    });
    console.log(output);
    // Parse results
    const match = output.match(/Pass:\s*(\d+)\s*\|\s*Fail:\s*(\d+)/);
    if (match) {
      totalPassed += parseInt(match[1]);
      totalFailed += parseInt(match[2]);
    }
  } catch (e) {
    console.log(e.stdout || e.message);
    totalFailed++;
  }
}

console.log('═══════════════════════════════════');
console.log(`  GRAND TOTAL: ${totalPassed + totalFailed} | Pass: ${totalPassed} | Fail: ${totalFailed}`);
console.log('═══════════════════════════════════\n');
process.exit(totalFailed > 0 ? 1 : 0);
