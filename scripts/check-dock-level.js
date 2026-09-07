#!/usr/bin/env node

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const html=fs.readFileSync(path.join(__dirname,'..','site-planner.html'),'utf8');
const gapMatch=html.match(/const DOCK_SURFACE_GAP=([0-9.]+);/);
assert.ok(gapMatch,'dock surface gap is present');
const start=html.indexOf('function dockPartLevels('),brace=html.indexOf('{',start);
let depth=0,end=-1;
for(let i=brace;i<html.length;i++){
  if(html[i]==='{')depth++;
  if(html[i]==='}'&&--depth===0){end=i+1;break;}
}
assert.ok(start>=0&&end>brace,'dock part level helper is present');
const context=vm.createContext({});
vm.runInContext(`const DOCK_SURFACE_GAP=${Number(gapMatch[1])};${html.slice(start,end)}`,context);
const levels=JSON.parse(JSON.stringify(vm.runInContext('dockPartLevels(.28)',context)));
const close=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<1e-9,
  `${label}: ${actual} != ${expected}`);

close(levels.bottom,.02,'dock underside clears the surface by 2 cm');
close(levels.top,.30,'dock keeps its full deck thickness');
close(levels.deckCenter,.16,'dock mesh is centered between its faces');
close(levels.postCenter-.45,levels.top,'light posts start at the lowered deck surface');

console.log('dock level regression: drawn and floating docks sit nearly flush');
