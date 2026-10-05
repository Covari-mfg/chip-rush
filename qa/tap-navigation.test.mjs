import test from 'node:test';
import assert from 'node:assert/strict';
import {createTapNavigation} from '../dist/tap-navigation.js';

test('a first tap walks and a quick second tap to the same station is ignored', () => {
  const navigation = createTapNavigation();
  assert.equal(navigation.consume({target:'mill',time:100}), 'walk');
  assert.equal(navigation.consume({target:'mill',time:420}), 'ignore');
});

test('station labels and models share one destination despite different screen positions', () => {
  const navigation = createTapNavigation();
  assert.equal(navigation.consume({target:'lathe',x:120,y:160,time:100}), 'walk');
  assert.equal(navigation.consume({target:'lathe',x:330,y:290,time:250}), 'ignore');
});

test('tapping another station navigates there immediately', () => {
  const navigation = createTapNavigation();
  assert.equal(navigation.consume({target:'mill',time:100}), 'walk');
  assert.equal(navigation.consume({target:'shipping',time:200}), 'walk');
  assert.equal(navigation.consume({target:'shipping',time:300}), 'ignore');
});

test('a tap beyond the quiet interval starts a new navigation', () => {
  const navigation = createTapNavigation();
  assert.equal(navigation.consume({target:'mill',time:100}), 'walk');
  assert.equal(navigation.consume({target:'mill',time:451}), 'walk');
  assert.equal(navigation.consume({target:'mill',time:600}), 'ignore');
});

test('floor taps are ignored only near the preceding floor destination', () => {
  const navigation = createTapNavigation();
  assert.equal(navigation.consume({x:120,y:160,time:100}), 'walk');
  assert.equal(navigation.consume({x:132,y:169,time:200}), 'ignore');
  assert.equal(navigation.consume({x:120,y:160,time:300}), 'ignore');
  assert.equal(navigation.consume({x:140,y:180,time:400}), 'walk');
  assert.equal(navigation.consume({x:141,y:181,time:500}), 'ignore');
});

test('floor and station taps cannot form a pair even at the same screen point', () => {
  const navigation = createTapNavigation();
  assert.equal(navigation.consume({target:'mill',x:120,y:160,time:100}), 'walk');
  assert.equal(navigation.consume({x:120,y:160,time:200}), 'walk');
  assert.equal(navigation.consume({target:'mill',x:120,y:160,time:300}), 'walk');
});

test('rapid extra taps never dash or re-interact with the station', () => {
  const navigation = createTapNavigation();
  const results = [100,200,300,600,900].map(time => navigation.consume({target:'mill',time}));
  assert.deepEqual(results, ['walk','ignore','ignore','ignore','ignore']);
  assert.equal(navigation.consume({target:'mill',time:1251}), 'walk', 'A quiet interval allows a new navigation');
  assert.equal(navigation.consume({target:'mill',time:1300}), 'ignore');
});

test('a different destination interrupts suppression and navigates immediately', () => {
  const navigation = createTapNavigation();
  assert.equal(navigation.consume({target:'mill',time:100}), 'walk');
  assert.equal(navigation.consume({target:'mill',time:200}), 'ignore');
  assert.equal(navigation.consume({target:'shipping',time:300}), 'walk');
  assert.equal(navigation.consume({target:'shipping',time:400}), 'ignore');
});

test('reset prevents a tap before a pause or new shift from suppressing new navigation', () => {
  const navigation = createTapNavigation();
  assert.equal(navigation.consume({target:'office',time:100}), 'walk');
  navigation.reset();
  assert.equal(navigation.consume({target:'office',time:200}), 'walk');
  assert.equal(navigation.consume({target:'office',time:300}), 'ignore');
  navigation.reset();
  assert.equal(navigation.consume({target:'office',time:400}), 'walk', 'Reset also clears burst suppression');
});

test('a reversed or invalid timestamp cannot suppress a new navigation', () => {
  const navigation = createTapNavigation();
  assert.equal(navigation.consume({target:'mill',time:100}), 'walk');
  assert.equal(navigation.consume({target:'mill',time:90}), 'walk');
  assert.equal(navigation.consume({target:'mill',time:NaN}), 'walk');
  assert.equal(navigation.consume({target:'mill',time:100}), 'walk');
  assert.equal(navigation.consume({x:undefined,y:undefined,time:110}), 'walk');
  assert.equal(navigation.consume({x:undefined,y:undefined,time:120}), 'walk');
});
