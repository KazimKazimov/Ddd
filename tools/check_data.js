#!/usr/bin/env node
/* Check a data file with the engine itself, then solve once with the default limits.
     node tools/check_data.js data/my_universe.json
   It is the definitive test: if this passes, the page will run on the file. */
const fs = require('fs'), path = require('path');
const E = require(path.join(__dirname, '..', 'src', 'engine.js'));
const file = process.argv[2];
if (!file) { console.error('usage: node tools/check_data.js <data.json>'); process.exit(2); }
let U;
try { U = E.universeFromData(JSON.parse(fs.readFileSync(file, 'utf8'))); }
catch (e) { console.error('FAILED: ' + e.message); process.exit(1); }
const sum = a => Array.from(a).reduce((x, y) => x + y, 0);
console.log('countries        ', E.countries().length);
console.log('buckets          ', U.n, '(country x type x rating)');
console.log('bonds            ', U.bonds.length);
console.log('index weight     ', sum(U.wb).toFixed(2) + '% (scaled to 100)');
console.log('portfolio weight ', sum(U.w0).toFixed(2) + '%  -> cash ' + (100 - sum(U.w0)).toFixed(2) + '%');
console.log('index DTS        ', Math.round(U.benchDts * 100));
console.log('index exp. return', U.benchRet.toFixed(2) + '%');
console.log('macro factors    ', E.macm().length ? E.macm().map(m => m.name).join(', ') : 'none');
const vols = U.B.map(b => b.vol);
console.log('spread vol range ', (Math.min(...vols) * 100).toFixed(0) + '% to ' + (Math.max(...vols) * 100).toFixed(0) + '% a year');
const noUp = U.B.filter(b => !b.hasUp).length, noDn = U.B.filter(b => !b.hasDn).length;
console.log('buckets with no upside scenario', noUp, '| no downside scenario', noDn);
const p = JSON.parse(JSON.stringify(E.DEFAULTS));
p.macMin = E.macm().map(() => -100); p.macMax = E.macm().map(() => 100);
const c = E.cases(U, p); c.sofr = p.sofr;
const m0 = E.metrics(U, U.w0, c);
console.log('current portfolio: alpha ' + m0.alpha.toFixed(1) + ' bp, tracking error ' + m0.te.toFixed(0) + ' bp, beta ' + m0.beta.toFixed(2));
const t = Date.now(), r = E.solve(U, p);
console.log('default solve:     net alpha ' + r.m.net.toFixed(1) + ' bp, tracking error ' + r.m.te.toFixed(0) + ' bp, beta ' + r.m.beta.toFixed(2) +
  ', turnover ' + r.m.turnover.toFixed(1) + '%, feasible ' + r.feasible + ' (' + (Date.now() - t) + ' ms)');
console.log('OK');
