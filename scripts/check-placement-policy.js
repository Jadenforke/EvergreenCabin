#!/usr/bin/env node

/* Regression coverage for amenities that intentionally ignore collisions. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'site-planner.html'), 'utf8');
function functionSource(name) {
  const start = html.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is present`);
  const brace = html.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < html.length; i++) {
    if (html[i] === '{') depth++;
    if (html[i] === '}' && --depth === 0) return html.slice(start, i + 1);
  }
  throw new Error(`Could not read ${name}`);
}

const context = vm.createContext({});
vm.runInContext(functionSource('overlapFree'), context);
for (const kind of ['pool','adiron','pchair','firepit','barrel']) {
  context.item = {kind};
  assert.equal(vm.runInContext('overlapFree(item)', context), true,
    `${kind} may overlap other objects`);
}
for (const kind of ['container','cabin','shed','pavilion']) {
  context.item = {kind};
  assert.equal(vm.runInContext('overlapFree(item)', context), false,
    `${kind} keeps collision checks`);
}

console.log('placement policy regression: selected outdoor amenities may overlap');
