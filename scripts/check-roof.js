#!/usr/bin/env node

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const html=fs.readFileSync(path.join(__dirname,'..','site-planner.html'),'utf8');
function functionSource(name){
  const start=html.indexOf(`function ${name}(`);
  assert.notEqual(start,-1,`${name} is present`);
  const brace=html.indexOf('{',start);
  let depth=0;
  for(let i=brace;i<html.length;i++){
    if(html[i]==='{')depth++;
    if(html[i]==='}'&&--depth===0)return html.slice(start,i+1);
  }
  throw new Error(`Could not read ${name}`);
}

const context=vm.createContext({Math});
vm.runInContext(`${functionSource('pointInPoly')}
  ${functionSource('polyMid')}
  ${functionSource('roofPeakPoint')}`,context);
context.rect=[[-6,-3],[6,-3],[6,3],[-6,3]];
context.tall=[[-2,-8],[2,-8],[2,8],[-2,8]];
context.notched=[[-6,-4],[6,-4],[6,4],[2,4],[2,0],[-2,0],[-2,4],[-6,4]];

const result=expr=>JSON.parse(JSON.stringify(vm.runInContext(expr,context)));
assert.deepEqual(result('roofPeakPoint(rect)'),[0,0],
  'wide roof peaks at its center instead of along a sideways ridge');
assert.deepEqual(result('roofPeakPoint(tall)'),[0,0],
  'deep roof also peaks at its center');
context.notchedPeak=result('roofPeakPoint(notched)');
assert.equal(vm.runInContext('pointInPoly(notchedPeak[0],notchedPeak[1],notched)',context),true,
  'an irregular roof keeps its peak inside its actual outline');

console.log('roof regression: centered hip-roof peaks passed');
