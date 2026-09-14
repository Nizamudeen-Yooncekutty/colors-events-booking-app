const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const RESULTS_PATH = path.join(__dirname, 'reports', 'results.json');
const SCREENSHOTS_DIR = path.join(__dirname, 'reports', 'screenshots');
const ARTIFACTS_DIR = path.join(__dirname, 'reports', 'artifacts');
const OUTPUT_PATH = path.join(__dirname, 'reports', 'E2E-Test-Results.xlsx');

function run() {
  if (!fs.existsSync(RESULTS_PATH)) {
    console.error('No results.json found. Run tests first: npm run test:e2e');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf8'));
  const rows = [];
  let passCount = 0, failCount = 0, skipCount = 0;

  function extractTests(suites, parentTitle = '') {
    for (const suite of suites) {
      const suiteTitle = parentTitle ? `${parentTitle} > ${suite.title}` : suite.title;
      if (suite.specs) {
        for (const spec of suite.specs) {
          for (const test of spec.tests) {
            const result = test.results[0] || {};
            const status = result.status || 'skipped';
            if (status === 'passed') passCount++;
            else if (status === 'failed' || status === 'timedOut') failCount++;
            else skipCount++;

            const tcMatch = spec.title.match(/TC-(\d+)/);
            const tcId = tcMatch ? `TC-${tcMatch[1]}` : '';
            const suiteMatch = suiteTitle.match(/TS-(\d+)/);
            const tsId = suiteMatch ? `TS-${suiteMatch[1]}` : '';
            const suiteName = suiteTitle.replace(/^.*?:\s*/, '');

            const duration = result.duration ? `${(result.duration / 1000).toFixed(2)}s` : '';
            const errorMsg = result.error ? result.error.message.split('\n')[0].substring(0, 200) : '';

            const screenshots = [];
            if (result.attachments) {
              for (const att of result.attachments) {
                if (att.name === 'screenshot' && att.path) {
                  screenshots.push(path.basename(att.path));
                }
              }
            }
            const tcNum = tcMatch ? tcMatch[1] : '';
            const manualScreenshots = [];
            if (fs.existsSync(SCREENSHOTS_DIR)) {
              const files = fs.readdirSync(SCREENSHOTS_DIR);
              for (const f of files) {
                if (f.includes(`TC-${tcNum.padStart(3, '0')}`)) {
                  manualScreenshots.push(f);
                }
              }
            }

            const allScreenshots = [...new Set([...screenshots, ...manualScreenshots])];

            rows.push({
              'Test Suite ID': tsId,
              'Test Suite': suiteName,
              'TC ID': tcId,
              'Test Case': spec.title.replace(/TC-\d+:\s*/, ''),
              'Status': status.toUpperCase(),
              'Duration': duration,
              'File': spec.file ? path.basename(spec.file) : '',
              'Line': spec.line || '',
              'Error Message': errorMsg,
              'Screenshots': allScreenshots.join(', '),
              'Screenshot Count': allScreenshots.length,
            });
          }
        }
      }
      if (suite.suites) {
        extractTests(suite.suites, suiteTitle);
      }
    }
  }

  extractTests(data.suites);

  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryData = [
    ['UST QPass - E2E Test Execution Report'],
    [],
    ['Execution Date', new Date().toISOString().split('T')[0]],
    ['Total Tests', rows.length],
    ['Passed', passCount],
    ['Failed', failCount],
    ['Skipped', skipCount],
    ['Pass Rate', `${((passCount / rows.length) * 100).toFixed(1)}%`],
    ['Duration', `${(data.stats?.duration / 1000).toFixed(1)}s` || 'N/A'],
    [],
    ['Suite Breakdown'],
  ];

  const suiteMap = {};
  for (const r of rows) {
    const key = r['Test Suite ID'] || 'Other';
    if (!suiteMap[key]) suiteMap[key] = { name: r['Test Suite'], total: 0, pass: 0, fail: 0, skip: 0 };
    suiteMap[key].total++;
    if (r['Status'] === 'PASSED') suiteMap[key].pass++;
    else if (r['Status'] === 'FAILED' || r['Status'] === 'TIMEDOUT') suiteMap[key].fail++;
    else suiteMap[key].skip++;
  }

  summaryData.push(['Suite ID', 'Suite Name', 'Total', 'Passed', 'Failed', 'Skipped', 'Pass Rate']);
  for (const [id, s] of Object.entries(suiteMap)) {
    summaryData.push([id, s.name, s.total, s.pass, s.fail, s.skip, `${((s.pass / s.total) * 100).toFixed(0)}%`]);
  }

  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
  summaryWs['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

  // Results sheet
  const resultsWs = XLSX.utils.json_to_sheet(rows);
  resultsWs['!cols'] = [
    { wch: 12 }, { wch: 30 }, { wch: 8 }, { wch: 55 }, { wch: 10 },
    { wch: 10 }, { wch: 25 }, { wch: 6 }, { wch: 60 }, { wch: 40 }, { wch: 5 },
  ];
  XLSX.utils.book_append_sheet(wb, resultsWs, 'Test Results');

  // Passed tests sheet
  const passedRows = rows.filter(r => r['Status'] === 'PASSED');
  if (passedRows.length > 0) {
    const passedWs = XLSX.utils.json_to_sheet(passedRows);
    passedWs['!cols'] = resultsWs['!cols'];
    XLSX.utils.book_append_sheet(wb, passedWs, 'Passed');
  }

  // Failed tests sheet
  const failedRows = rows.filter(r => r['Status'] !== 'PASSED');
  if (failedRows.length > 0) {
    const failedWs = XLSX.utils.json_to_sheet(failedRows);
    failedWs['!cols'] = resultsWs['!cols'];
    XLSX.utils.book_append_sheet(wb, failedWs, 'Failed');
  }

  // Screenshots index sheet
  const ssRows = [];
  if (fs.existsSync(SCREENSHOTS_DIR)) {
    const files = fs.readdirSync(SCREENSHOTS_DIR).sort();
    for (const f of files) {
      const tcMatch = f.match(/TC-(\d+)/);
      const stat = fs.statSync(path.join(SCREENSHOTS_DIR, f));
      ssRows.push({
        'TC ID': tcMatch ? `TC-${tcMatch[1]}` : '',
        'Screenshot File': f,
        'Size (KB)': (stat.size / 1024).toFixed(1),
        'Path': `e2e/reports/screenshots/${f}`,
      });
    }
  }
  // Also include failure screenshots from artifacts
  if (fs.existsSync(ARTIFACTS_DIR)) {
    const dirs = fs.readdirSync(ARTIFACTS_DIR);
    for (const dir of dirs) {
      const dirPath = path.join(ARTIFACTS_DIR, dir);
      if (fs.statSync(dirPath).isDirectory()) {
        const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.png'));
        for (const f of files) {
          const stat = fs.statSync(path.join(dirPath, f));
          ssRows.push({
            'TC ID': dir.includes('TC-') ? dir.match(/TC-\d+/)?.[0] || '' : '',
            'Screenshot File': `${dir}/${f}`,
            'Size (KB)': (stat.size / 1024).toFixed(1),
            'Path': `e2e/reports/artifacts/${dir}/${f}`,
          });
        }
      }
    }
  }
  if (ssRows.length > 0) {
    const ssWs = XLSX.utils.json_to_sheet(ssRows);
    ssWs['!cols'] = [{ wch: 10 }, { wch: 50 }, { wch: 10 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, ssWs, 'Screenshots');
  }

  XLSX.writeFile(wb, OUTPUT_PATH);

  console.log('\n══════════════════════════════════════════');
  console.log('  E2E TEST EXECUTION REPORT');
  console.log('══════════════════════════════════════════');
  console.log(`  Total:   ${rows.length}`);
  console.log(`  Passed:  ${passCount} ✓`);
  console.log(`  Failed:  ${failCount} ✘`);
  console.log(`  Skipped: ${skipCount}`);
  console.log(`  Rate:    ${((passCount / rows.length) * 100).toFixed(1)}%`);
  console.log(`\n  Report:  ${OUTPUT_PATH}`);
  console.log(`  Screenshots: ${ssRows.length} files`);
  console.log('══════════════════════════════════════════\n');
}

run();
