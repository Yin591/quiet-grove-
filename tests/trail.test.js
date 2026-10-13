import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MeadowTrail, MeadowTrails } from '../src/trail.js';

function animal(x, z) {
  const obj = new THREE.Object3D();
  obj.position.set(x, 0, z);
  return { obj, target: new THREE.Vector3(), state: 'pause', stateTime: 0, nextStateAt: 2 };
}
const point = (x, z) => new THREE.Vector3(x, 0, z);
function draw(trail) {
  trail.begin(point(0, 0));
  trail.add(point(1, 0));
  trail.add(point(2, 1));
  trail.add(point(3, 1));
}

test('a click without a stroke does not start animal following', () => {
  const trail = new MeadowTrail([animal(0, 0)]);
  trail.begin(point(0, 0));
  assert.equal(trail.finish(), null);
  assert.equal(trail.samples.length, 0);
});

test('releasing a stroke preserves the preview route and glow anchor positions', () => {
  const trail = new MeadowTrail([animal(-2, 0)]);
  draw(trail);
  const preview = trail.samples.map(sample => sample.point.toArray());
  trail.finish();
  assert.deepEqual(trail.samples.map(sample => sample.point.toArray()), preview);
  trail.update(1 / 60);
  assert.deepEqual(trail.samples.map(sample => sample.point.toArray()), preview);
});

test('the closest animal to the start follows a smooth, ordered route', () => {
  const far = animal(5, 0);
  const near = animal(0.2, 0);
  const trail = new MeadowTrail([far, near]);
  draw(trail);
  assert.equal(trail.finish(), near);
  trail.update(1 / 60);
  assert.equal(near.trailFollowing, true);
  assert.equal(far.trailFollowing, undefined);
  assert.equal(near.state, 'walk');
  assert.ok(near.target.distanceTo(point(0, 0)) < 0.001);
  assert.ok(trail.samples.length > 4);
  for (let i = 1; i < trail.samples.length; i++) {
    assert.ok(trail.samples[i].point.distanceTo(trail.samples[i - 1].point) < 0.3);
  }
  assert.ok(trail.samples.at(-1).point.distanceTo(point(3, 1)) < 0.001);
});

test('completed sections fade, then the animal resumes free activity', () => {
  const follower = animal(-1, 0);
  const trail = new MeadowTrail([follower]);
  draw(trail);
  trail.finish();
  trail.update(0.1);
  assert.equal(trail.opacity(0), 1);
  follower.obj.position.copy(trail.samples[0].point);
  trail.update(0.1);
  const visited = trail.opacity(0);
  trail.update(2);
  assert.ok(trail.opacity(0) < visited);
  assert.equal(trail.opacity(trail.samples.length - 1), 1);
  while (trail.follower) {
    follower.obj.position.copy(follower.target);
    trail.update(0.1);
  }
  assert.equal(follower.trailFollowing, false);
  assert.equal(follower.state, 'pause');
  trail.update(6);
  assert.equal(trail.samples.length, 0);
});

test('new strokes release the previous follower and replace the route', () => {
  const follower = animal(0, 0);
  const trail = new MeadowTrail([follower]);
  draw(trail);
  trail.finish();
  trail.begin(point(5, 5));
  assert.equal(follower.trailFollowing, false);
  assert.equal(trail.follower, null);
  assert.equal(trail.samples.length, 1);
  assert.ok(trail.samples[0].point.distanceTo(point(5, 5)) < 0.001);
});

test('animals slow down while turning toward a route', () => {
  const follower = animal(0, -1);
  const trail = new MeadowTrail([follower]);
  draw(trail);
  trail.finish();
  trail.update(0.1);
  const aligned = follower.trailSpeed;
  follower.obj.rotation.y = Math.PI;
  trail.update(0.1);
  assert.ok(follower.trailSpeed < aligned);
});

function drawRoute(trails, x) {
  trails.begin(point(x, 0));
  trails.add(point(x + 2, 0));
  trails.finish();
  return trails.items.at(-1);
}

test('three routes coexist and starting a fourth removes only the oldest', () => {
  const animals = [animal(0, 0), animal(10, 0), animal(20, 0)];
  const trails = new MeadowTrails(animals);
  const first = drawRoute(trails, 0);
  const second = drawRoute(trails, 10);
  const third = drawRoute(trails, 20);
  assert.deepEqual(trails.items, [first, second, third]);
  assert.ok(animals.every(entry => entry.trailFollowing));
  trails.begin(point(30, 0));
  assert.equal(trails.items.length, 3);
  assert.deepEqual(trails.items.slice(0, 2), [second, third]);
  assert.equal(first.follower, null);
  assert.equal(animals[0].trailFollowing, false);
  assert.equal(trails.active.slot, first.slot);
  assert.equal(second.slot, 1);
  assert.equal(third.slot, 2);
});

test('an animal switches to its newest route while its previous route gently fades', () => {
  const follower = animal(0, 0);
  const trails = new MeadowTrails([follower]);
  const first = drawRoute(trails, 0);
  trails.begin(point(1, 1));
  assert.equal(first.follower, follower);
  trails.add(point(3, 1));
  const preview = trails.active.samples.map(sample => sample.point.toArray());
  trails.finish();
  const second = trails.items[1];
  assert.equal(first.follower, null);
  assert.equal(second.follower, follower);
  assert.equal(follower.trailFollowing, true);
  assert.deepEqual(second.samples.map(sample => sample.point.toArray()), preview);
  trails.update(2);
  assert.ok(first.opacity(first.samples.length - 1) < 1);
  trails.update(3);
  assert.deepEqual(trails.items, [second]);
});

test('the oldest route stays visible and smoothly fades when a fourth starts', () => {
  const trails = new MeadowTrails([animal(-1, 0), animal(9, 0), animal(19, 0)]);
  const first = drawRoute(trails, 0);
  const second = drawRoute(trails, 10);
  const third = drawRoute(trails, 20);
  const points = first.samples.map(sample => sample.point.toArray());
  trails.begin(point(30, 0));
  assert.ok(trails.visible.includes(first));
  assert.equal(first.opacity(0), 1);
  assert.deepEqual(first.samples.map(sample => sample.point.toArray()), points);
  trails.update(0.01);
  assert.ok(first.opacity(0) > 0.99);
  trails.update(1.49);
  assert.ok(Math.abs(first.opacity(0) - 0.5) < 0.001);
  assert.equal(second.opacity(0), 1);
  assert.equal(third.opacity(0), 1);
  trails.update(1.6);
  assert.ok(!trails.visible.includes(first));
  assert.equal(trails.items.length, 3);
});

test('drawing more routes during a fade preserves all outgoing transitions', () => {
  const trails = new MeadowTrails([animal(-1, 0), animal(9, 0), animal(19, 0)]);
  const first = drawRoute(trails, 0);
  const second = drawRoute(trails, 10);
  drawRoute(trails, 20);
  drawRoute(trails, 30);
  trails.update(0.5);
  const alpha = first.opacity(first.samples.length - 1);
  drawRoute(trails, 40);
  assert.ok(trails.visible.includes(first));
  assert.ok(trails.visible.includes(second));
  assert.equal(first.opacity(first.samples.length - 1), alpha);
  trails.update(3.1);
  assert.ok(!trails.visible.includes(first));
  assert.ok(!trails.visible.includes(second));
});
