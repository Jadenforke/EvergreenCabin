#!/usr/bin/env node

/* Regression coverage for the planner's pure container magnet. The function
   is loaded from site-planner.html so this test exercises the shipped code,
   while the browser-only terrain/stack query is replaced with a flat site. */
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
vm.runInContext(`
  let placed=[], contSnap=null, magOff=false;
  const contReach=()=>1.6;
  const contTopUnder=()=>-Infinity;
  const box=(d,x,z,r)=>({cx:x,cz:z,hw:d.w/2,hd:d.d/2,rot:r||0});
  ${functionSource('toLocalXZ')}
  ${functionSource('toWorldXZ')}
  ${functionSource('obbHit')}
  ${functionSource('snapContainer')}
  ${functionSource('containerLevelTarget')}
  ${functionSource('containersTouch')}
  ${functionSource('containerWasOn')}
`, context);

const sizes = {
  cont20:{kind:'container',w:2.44,d:6.06,h:2.59},
  cont40:{kind:'container',w:2.44,d:12.19,h:2.59}
};
const rad = deg => deg*Math.PI/180;
const close = (actual, expected, label) =>
  assert.ok(Math.abs(actual-expected)<1e-8, `${label}: ${actual} != ${expected}`);
const sameAngle = (actual, expected, label) =>
  close(Math.atan2(Math.sin(actual-expected),Math.cos(actual-expected)),0,label);

/* A foundation/skirt is stored as a child of the rotated container. Its world
   corner must therefore round-trip back to the original local corner before
   the parent transform is applied again. */
for (const deg of [100,190]) {
  const local=[1.22,6.095],rot=rad(deg),worldPoint=world(local[0],local[1],rot);
  context.dx=worldPoint[0]; context.dz=worldPoint[1]; context.rot=rot;
  const roundTrip=vm.runInContext('toLocalXZ(dx,dz,rot)',context);
  close(roundTrip[0],local[0],`${deg}° skirt local x`);
  close(roundTrip[1],local[1],`${deg}° skirt local z`);
}

close(vm.runInContext('containerLevelTarget(10,14)',context),14,
  'a magnetically connected run shares one flat floor');
close(vm.runInContext('containerLevelTarget(10,10.2)',context),10.2,
  'a small floor difference is fully evened');

/* Undo must remember actual courses, rather than inferring them from a
   partly restored scene where a same-level perpendicular neighbour may sit
   inside the long box's footprint. */
context.lower={def:sizes.cont40,x:0,z:0,rot:0};
context.stacked={def:sizes.cont20,x:0,z:2,rot:0};
context.sameCourse={def:sizes.cont20,x:0,z:2,rot:Math.PI/2};
context.oldY=new Map([[context.lower,10],[context.stacked,12.59],[context.sameCourse,10]]);
assert.equal(vm.runInContext('containerWasOn(stacked,lower,oldY)',context),true,
  'undo preserves a genuine upper course');
assert.equal(vm.runInContext('containerWasOn(sameCourse,lower,oldY)',context),false,
  'undo does not turn an adjacent same-course box into a new storey');

function world(lx,lz,rot) {
  const c=Math.cos(rot),s=Math.sin(rot);
  return [lx*c+lz*s,-lx*s+lz*c];
}
function run(baseDef, nextDef, baseDeg, nextDeg, perpendicular) {
  const baseRot=rad(baseDeg), nextRot=rad(nextDeg);
  context.currentPlaced=[{type:'obj',def:baseDef,x:17,z:-9,rot:baseRot}];
  vm.runInContext('placed=currentPlaced',context);
  const projectedDepth=perpendicular?nextDef.w:nextDef.d;
  const q=world(0,(baseDef.d+projectedDepth)/2,baseRot);
  const expected={x:17+q[0],z:-9+q[1]};
  context.nextDef=nextDef; context.nextRot=nextRot;
  const result=vm.runInContext(
    `snapContainer(nextDef, ${expected.x+0.25}, ${expected.z-0.2}, nextRot, null, ${!perpendicular})`,context);
  close(result.x,expected.x,`${baseDeg}/${nextDeg} x`);
  close(result.z,expected.z,`${baseDeg}/${nextDeg} z`);
  sameAngle(result.rot,nextRot,`${baseDeg}/${nextDeg} rotation`);
  context.baseBox={cx:17,cz:-9,hw:baseDef.w/2,hd:baseDef.d/2,rot:baseRot};
  context.nextBox={cx:result.x,cz:result.z,hw:nextDef.w/2,hd:nextDef.d/2,rot:result.rot};
  assert.equal(vm.runInContext('obbHit(baseBox,nextBox)',context),false,
    `${baseDeg}/${nextDeg} flush faces count as clear`);
  context.baseCont={def:baseDef,x:17,z:-9,rot:baseRot,mesh:{position:{y:10}}};
  context.nextCont={def:nextDef,x:result.x,z:result.z,rot:result.rot,mesh:{position:{y:10.7}}};
  assert.equal(vm.runInContext('containersTouch(baseCont,nextCont)',context),true,
    `${baseDeg}/${nextDeg} corner connection joins one flat floor group`);
  const inward=world(0,-0.01,baseRot);
  context.nextBox.cx+=inward[0]; context.nextBox.cz+=inward[1];
  assert.equal(vm.runInContext('obbHit(baseBox,nextBox)',context),true,
    `${baseDeg}/${nextDeg} a 1 cm inward move overlaps`);
}

for (const baseDef of Object.values(sizes)) {
  for (const nextDef of Object.values(sizes)) {
    run(baseDef,nextDef,100,100,false);
    run(baseDef,nextDef,190,190,false);
    run(baseDef,nextDef,100,190,true);
    run(baseDef,nextDef,190,100,true);
  }
}

console.log('container snap regression: 16 rotated 20/40 ft combinations passed');
