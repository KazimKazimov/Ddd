#!/usr/bin/env node
/* Smoke tests for the engine:  node tests/test_engine.js
   1. the mock universe solves to the known answer;
   2. writing the mock universe to the data-file format and reading it back gives the same universe and the same answer;
   3. bond overrides, macro limits, percentile shocks and small-position sales behave. */
const path = require('path'), assert = require('assert');
const E = require(path.join(__dirname, '..', 'src', 'engine.js'));
const D0 = () => JSON.parse(JSON.stringify(E.DEFAULTS));
let U = E.buildUniverse(7);
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, what + ': ' + a + ' vs ' + b);

let r = E.solve(U, D0());
assert.ok(r.feasible, 'default solve is feasible');
near(r.m.net, 116.2, 0.3, 'default net alpha'); near(r.m.te, 85, 1, 'default tracking error');
console.log('1 default solve       net ' + r.m.net.toFixed(1) + ' bp, TE ' + r.m.te.toFixed(0) + ' bp');

const file = JSON.parse(JSON.stringify(E.exportData(U)));
const U2 = E.universeFromData(file);
assert.strictEqual(U2.n, U.n); assert.strictEqual(U2.bonds.length, U.bonds.length);
let dq = 0; for (let i = 0; i < U.n * U.n; i++) dq = Math.max(dq, Math.abs(U.Q[i] - U2.Q[i]));
assert.ok(dq < 1e-8, 'risk matrix survives the round trip');
const r2 = E.solve(U2, D0()); near(r2.m.net, r.m.net, 0.05, 'round-trip net alpha');
console.log('2 data-file round trip net ' + r2.m.net.toFixed(1) + ' bp');
U = U2;

let p = D0(); p.macMin = [-100, -100, -10, -100, -100, -100, -100]; p.macMax = [100, 100, 100, 5, 100, 100, 100];
r = E.solve(U, p); assert.ok(r.feasible);
const ex = f => { let s = 0; for (let i = 0; i < U.n; i++) s += (r.w[i] - U.wb[i]) * U.mr[i][f]; return s; };
assert.ok(ex(2) >= -10.4 && ex(3) <= 5.4, 'macro limits hold');
console.log('3 macro limits        VIX ' + ex(2).toFixed(1) + ', oil ' + ex(3).toFixed(1));

p = D0(); const held = []; U.bonds.forEach((d, k) => { if (d.w0 > 0.5) held.push(k); });
p.frozen = {}; p.frozen[held[0]] = 2; p.frozen[held[1]] = 1;
r = E.solve(U, p); const bw = E.mapBonds(U, r.w, { minCT: 5, minUSD: 10, nav: 5000, frozen: p.frozen }).bw;
assert.strictEqual(bw[held[0]], 0, 'excluded bond is sold'); assert.strictEqual(bw[held[1]], U.bonds[held[1]].w0, 'held bond is untouched');
console.log('4 bond overrides      ok');

p = D0(); p.caseShock = 'pct'; p.casePct = 99; p.caseMode = 'all'; p.caseSrc = 'rating';
r = E.solve(U, p); assert.ok(r.feasible && r.m.bear >= p.bear - 1, 'percentile shocks solve');
console.log('5 percentile shocks   net ' + r.m.net.toFixed(1) + ' bp');

p = D0(); p.small = { on: true, val: 0.25, unit: 'mv' };
r = E.solve(U, p); const hold = {}; for (let i = 0; i < U.n; i++) hold[U.B[i].c] = (hold[U.B[i].c] || 0) + r.w[i];
assert.ok(Object.values(hold).every(h => h < 1e-6 || h >= 0.25 - 1e-6), 'no small country positions remain');
console.log('6 small positions     sold ' + r.sold.length + ' countries');
console.log('all passed');
