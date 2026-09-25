import test from 'node:test';
import assert from 'node:assert/strict';
import { RULESET, SHIFTS } from '../dist/core.js';
import { challengeURL, parseChallenge } from '../dist/social.js';

function query(extra={}) {
  return '?'+new URLSearchParams({challenge:'1',rules:RULESET,role:'2',score:'4173',shipped:'10',...extra});
}

test('challenge links round-trip each role and keep only current challenge parameters',()=>{
  for(const role of [0,1,2]) {
    const result={role,score:role===2?4173:2000,shipped:SHIFTS[role].stars[2]};
    const url=new URL(challengeURL(result,'https://example.test/chip-rush/?watch=owner&old=1#results'));
    assert.equal(url.origin,'https://example.test');assert.equal(url.pathname,'/chip-rush/');
    assert.equal(url.hash,'');assert.equal(url.searchParams.has('watch'),false);assert.equal(url.searchParams.has('old'),false);
    assert.equal(url.searchParams.get('rules'),RULESET);assert.equal(url.searchParams.size,5);
    assert.deepEqual(parseChallenge(url.search),{...result,stars:3});
  }
});

test('challenge parsing rejects absent markers, old rules, and missing result fields',()=>{
  assert.equal(parseChallenge(''),null);
  for(const extra of [{challenge:'0'},{challenge:'true'},{rules:'roles-v3'},{rules:''}])assert.equal(parseChallenge(query(extra)),null);
  for(const field of ['challenge','rules','role','score','shipped']) {
    const p=new URLSearchParams(query());p.delete(field);assert.equal(parseChallenge(p.toString()),null,field+' is required');
  }
});

test('challenge numeric fields reject signs, decimals, nonfinite values, markup, and overflow',()=>{
  for(const field of ['role','score','shipped']) {
    for(const value of ['', '-1','+1','1.5','1e2','NaN','Infinity',' 1','1 ','<script>','10000']) {
      assert.equal(parseChallenge(query({[field]:value})),null,field+' rejects '+JSON.stringify(value));
    }
  }
  assert.equal(parseChallenge(query({role:'3'})),null);
  assert.equal(parseChallenge(query({score:'9001'})),null);
  assert.equal(parseChallenge(query({shipped:'13'})),null);
  assert.equal(parseChallenge(query({role:'0',shipped:'9'})),null);
});

test('challenge stars are derived from role targets and cannot be supplied in the link',()=>{
  for(const [role,shift] of SHIFTS.entries()) {
    for(const shipped of [0,...shift.stars]) {
      const value=parseChallenge(query({role:String(role),score:String(shipped*100),shipped:String(shipped),stars:'3',name:'<img src=x>'}));
      assert.deepEqual(value,{role,score:shipped*100,shipped,stars:shift.stars.filter(target=>shipped>=target).length});
      assert.ok(Object.isFrozen(value));assert.equal('name' in value,false);
      assert.throws(()=>{value.stars=99;},TypeError);
    }
  }
});

test('valid zero and maximum counts parse without silently changing the challenge',()=>{
  assert.deepEqual(parseChallenge(query({role:'0',score:'0',shipped:'0'})),{role:0,score:0,shipped:0,stars:0});
  assert.deepEqual(parseChallenge(query({role:'2',score:'9000',shipped:'12'})),{role:2,score:9000,shipped:12,stars:3});
  assert.deepEqual(parseChallenge(query({role:'0',score:'6000',shipped:'8'})),{role:0,score:6000,shipped:8,stars:3});
});

test('challenge links cannot claim points unsupported by shipments and the one sourcing bonus',()=>{
  assert.equal(parseChallenge(query({score:'9000',shipped:'0'})),null);
  assert.equal(parseChallenge(query({score:'1561',shipped:'2'})),null);
  assert.deepEqual(parseChallenge(query({score:'60',shipped:'0'})),{role:2,score:60,shipped:0,stars:0});
  assert.deepEqual(parseChallenge(query({score:'1560',shipped:'2'})),{role:2,score:1560,shipped:2,stars:0});
});
