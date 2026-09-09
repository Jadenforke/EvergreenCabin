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

/* The exemption has to run both ways, or the order you built in decides
   whether an arrangement is allowed: place the pool first and the cabin that
   was meant to sit over it is refused. */
const validateSrc = functionSource('validate');
const othersLine = validateSrc.split('\n').find(l => l.includes('const others=placed.filter'));
assert.ok(othersLine, 'validate still builds its list of other objects');
assert.ok(othersLine.includes('!overlapFree(p.def)'),
  'objects already standing that may be overlapped never block anything else');

console.log('placement policy regression: selected outdoor amenities may overlap, in both directions');
