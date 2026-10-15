import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import { createHarbor } from '../dist/assets/harbor.js';

test('every boat has separated hull/deck surfaces and avoids receiving self-shadows',()=>{
  const harbor=createHarbor();let boats=0;
  harbor.traverse(node=>{
    if(node.name!=='boat-hull')return;
    boats++;
    const deck=node.parent.getObjectByName('boat-deck');
    node.geometry.computeBoundingBox();deck.geometry.computeBoundingBox();
    assert.ok(node.position.y+node.geometry.boundingBox.max.y<deck.position.y+deck.geometry.boundingBox.min.y);
    node.parent.traverse(part=>{if(part.isMesh)assert.equal(part.receiveShadow,false);});
  });
  assert.equal(boats,13);
});

test('an installed part sends a fishing boat past the quay during play',()=>{
  const harbor=createHarbor(),fleet=harbor.userData.fleet;
  const game={elapsed:32,shipped:1,installed:[{arrived:32}],config:{duration:220,passTarget:6},window:{open:false},quay:[],tender:{phase:'docked',remaining:0,cargo:[]}};
  harbor.userData.update(game,.1,32);
  const before=fleet[0].mesh.position.clone(),waiting=fleet[1].mesh.position.clone();
  game.elapsed=47;harbor.userData.update(game,.1,32);
  assert.ok(before.distanceTo(fleet[0].mesh.position)>5);
  assert.equal(waiting.distanceTo(fleet[1].mesh.position),0);
  assert.ok(fleet[0].mesh.visible);
  game.elapsed=90;harbor.userData.update(game,.1,32);
  assert.equal(fleet[0].mesh.visible,false);
  assert.ok(new THREE.Box3().setFromObject(harbor).isEmpty()===false);
});
