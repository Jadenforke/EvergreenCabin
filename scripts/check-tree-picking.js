#!/usr/bin/env node

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const html=fs.readFileSync(path.join(__dirname,'..','site-planner.html'),'utf8');
function functionSource(name){
  const start=html.indexOf(`function ${name}(`);
  assert.notEqual(start,-1,`${name} is present`);
  const brace=html.indexOf('{',start);let depth=0;
  for(let i=brace;i<html.length;i++){
    if(html[i]==='{')depth++;
    if(html[i]==='}'&&--depth===0)return html.slice(start,i+1);
  }
  throw new Error(`Could not read ${name}`);
}

const context=vm.createContext({Math});
vm.runInContext(`${functionSource('toLocalXZ')}
  ${functionSource('toWorldXZ')}
  ${functionSource('rectTreeDisplacement')}
  ${functionSource('isPickMesh')}`,context);
context.building={x:10,z:-4,rot:Math.PI/6,def:{w:10,d:8}};

context.tree=[10,-4];
assert.equal(vm.runInContext('rectTreeDisplacement(building,tree[0],tree[1],2,.5).kill',context),true,
  'a tree in the building center is removed');

/* A local point near the right edge should be relocated beyond that edge,
   even when the building is rotated. */
const c=Math.cos(context.building.rot),s=Math.sin(context.building.rot);
context.tree=[10+4.8*c,-4-4.8*s];
context.moved=vm.runInContext('rectTreeDisplacement(building,tree[0],tree[1],2,.5)',context);
assert.equal(context.moved.kill,false,'an edge tree is relocated');
context.mx=context.moved.nx-10;context.mz=context.moved.nz+4;
const local=vm.runInContext('toLocalXZ(mx,mz,building.rot)',context);
assert.ok(local[0]>7,'the edge tree moves fully outside the clearance band');

context.tree=[10+12*c,-4-12*s];
assert.equal(vm.runInContext('rectTreeDisplacement(building,tree[0],tree[1],2,.5)',context),null,
  'a clear tree is left alone');

assert.equal(vm.runInContext("isPickMesh({isMesh:true,geometry:{},userData:{noPick:true}})",context),false,
  'a decorative light pool cannot select its parent structure');
assert.equal(vm.runInContext("isPickMesh({isMesh:true,geometry:{},userData:{}})",context),true,
  'visible structure geometry remains selectable');

console.log('tree and picking regression: center clears, edges move, glow areas ignore clicks');
