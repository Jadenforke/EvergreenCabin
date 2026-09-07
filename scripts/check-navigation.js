#!/usr/bin/env node

/* Regression coverage for keyboard panning and the rotating north compass. */
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

const context = vm.createContext({Math});
vm.runInContext(`${functionSource('compassRotation')}\n${functionSource('arrowPanDelta')}\n${functionSource('arrowPanVector')}\n${functionSource('keyboardPanSpeed')}`, context);
const close = (actual, expected, label) =>
  assert.ok(Math.abs(actual-expected)<1e-9, `${label}: ${actual} != ${expected}`);
function delta(key,theta,step=10) {
  context.key=key;context.theta=theta;context.step=step;
  return vm.runInContext('arrowPanDelta(key,theta,step)',context);
}

let d=delta('ArrowUp',0);close(d.x,0,'north-up arrow x');close(d.z,-10,'north-up arrow z');
d=delta('ArrowRight',0);close(d.x,10,'east arrow x');close(d.z,0,'east arrow z');
d=delta('ArrowUp',Math.PI/2);close(d.x,-10,'orbited up arrow x');close(d.z,0,'orbited up arrow z');
d=delta('ArrowLeft',Math.PI/2);close(d.x,0,'orbited left arrow x');close(d.z,10,'orbited left arrow z');
context.keys=['ArrowUp','ArrowRight'];context.theta=0;
d=vm.runInContext('arrowPanVector(keys,theta)',context);
close(Math.hypot(d.x,d.z),1,'diagonal movement keeps one smooth speed');
close(vm.runInContext('keyboardPanSpeed(200,false)',context),230,'faster normal speed');
close(vm.runInContext('keyboardPanSpeed(200,true)',context),600,'turbo speed');
close(vm.runInContext('keyboardPanSpeed(10,false)',context),24,'close zoom minimum speed');
close(vm.runInContext("compassRotation(Math.PI/2,'3d')",context),-90,'3-D compass turn');
close(vm.runInContext("compassRotation(Math.PI/2,'plan')",context),0,'plan compass north-up');

console.log('navigation regression: smooth fast arrow panning and compass headings passed');
