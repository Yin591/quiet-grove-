import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installSceneInteractions } from '../src/interactions.js';

function setup() {
  const canvas = new EventTarget();
  canvas.style = {};
  let captured = null;
  canvas.setPointerCapture = (id) => { captured = id; };
  canvas.hasPointerCapture = (id) => captured === id;
  canvas.releasePointerCapture = () => { captured = null; };
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800 });
  const camera = new THREE.PerspectiveCamera(54, 1.25, 0.1, 250);
  camera.position.set(0, 5.2, 13);
  camera.lookAt(0, 1.4, -8);
  camera.updateMatrixWorld();
  const grassUniforms = {
    uBreezeCenter: { value: new THREE.Vector2() },
    uBreezeDirection: { value: new THREE.Vector2() },
    uBreezeStrength: { value: 0 },
    uBreezeRadius: { value: 1.1 },
  };
  const { update, viewOffset } = installSceneInteractions({ canvas, camera, grassUniforms });
  const send = (type, props) => {
    const event = new Event(type, { cancelable: true });
    Object.defineProperties(event, Object.fromEntries(
      Object.entries(props).map(([key, value]) => [key, { value }])
    ));
    canvas.dispatchEvent(event);
    return event;
  };
  return { camera, grassUniforms, update, viewOffset, send };
}

test('wheel zoom moves smoothly and stays inside the small zoom range', () => {
  const { camera, update, send } = setup();
  for (let i = 0; i < 100; i++) send('wheel', { deltaY: -120, deltaMode: 0 });
  update(1 / 60);
  assert.ok(camera.zoom > 1 && camera.zoom < 1.18);
  for (let i = 0; i < 120; i++) update(1 / 60);
  assert.ok(Math.abs(camera.zoom - 1.18) < 0.001);
  for (let i = 0; i < 100; i++) send('wheel', { deltaY: 120, deltaMode: 0 });
  for (let i = 0; i < 120; i++) update(1 / 60);
  assert.ok(Math.abs(camera.zoom - 0.88) < 0.001);
});

test('line wheel units match pixels, and browser pinch zoom remains available', () => {
  const pixels = setup();
  const lines = setup();
  pixels.send('wheel', { deltaY: -48, deltaMode: 0 });
  lines.send('wheel', { deltaY: -3, deltaMode: 1 });
  pixels.update(0.1);
  lines.update(0.1);
  assert.equal(pixels.camera.zoom, lines.camera.zoom);
  const before = setup();
  const event = before.send('wheel', { deltaY: -100, deltaMode: 0, ctrlKey: true });
  before.update(0.1);
  assert.equal(event.defaultPrevented, false);
  assert.equal(before.camera.zoom, 1);
});

test('moving over grass creates a localized breeze that fades after leaving', () => {
  const { grassUniforms, update, send } = setup();
  send('pointermove', { clientX: 500, clientY: 650 });
  const first = grassUniforms.uBreezeCenter.value.clone();
  send('pointermove', { clientX: 560, clientY: 650 });
  assert.ok(grassUniforms.uBreezeCenter.value.x > first.x);
  assert.ok(grassUniforms.uBreezeStrength.value > 0);
  assert.ok(grassUniforms.uBreezeDirection.value.x > 0);
  send('pointerleave', {});
  for (let i = 0; i < 180; i++) update(1 / 60);
  assert.ok(grassUniforms.uBreezeStrength.value < 0.001);
});

test('sky pointer movement does not trigger a grass gust', () => {
  const { grassUniforms, send } = setup();
  send('pointermove', { clientX: 500, clientY: 20 });
  assert.equal(grassUniforms.uBreezeStrength.value, 0);
});


test('breeze stays gentle and responds to movement speed', () => {
  const slow = setup();
  const fast = setup();
  for (const item of [slow, fast]) {
    item.send('pointermove', { clientX: 500, clientY: 650, timeStamp: 0 });
    assert.equal(item.grassUniforms.uBreezeStrength.value, 0);
  }
  slow.send('pointermove', { clientX: 540, clientY: 650, timeStamp: 120 });
  fast.send('pointermove', { clientX: 540, clientY: 650, timeStamp: 16 });
  assert.ok(fast.grassUniforms.uBreezeStrength.value > slow.grassUniforms.uBreezeStrength.value);
  assert.ok(fast.grassUniforms.uBreezeStrength.value <= 0.4);
});

test('a wider continuous stroke increases breeze strength and affected area', () => {
  const short = setup();
  const wide = setup();
  for (const item of [short, wide]) {
    item.send('pointermove', { clientX: 500, clientY: 650, timeStamp: 0 });
    item.send('pointermove', { clientX: 510, clientY: 650, timeStamp: 16 });
  }
  for (let i = 2; i <= 5; i++) {
    wide.send('pointermove', { clientX: 500 + i * 10, clientY: 650, timeStamp: i * 16 });
  }
  assert.ok(wide.grassUniforms.uBreezeStrength.value > short.grassUniforms.uBreezeStrength.value);
  assert.ok(wide.grassUniforms.uBreezeRadius.value > short.grassUniforms.uBreezeRadius.value);
});

test('only middle drag changes the view, with smooth limits and clean release', () => {
  const { send, update, viewOffset } = setup();
  send('pointerdown', { button: 0, pointerId: 1, clientX: 500, clientY: 400 });
  send('pointermove', { buttons: 1, clientX: 700, clientY: 500 });
  update(1 / 60);
  assert.equal(viewOffset.length(), 0);
  const down = send('pointerdown', { button: 1, pointerId: 2, clientX: 500, clientY: 400 });
  assert.equal(down.defaultPrevented, true);
  send('pointermove', { buttons: 4, clientX: 2000, clientY: 2000 });
  update(1 / 60);
  assert.ok(viewOffset.x < 0 && viewOffset.x > -2.4);
  assert.ok(viewOffset.y > 0 && viewOffset.y < 1.1);
  for (let i = 0; i < 120; i++) update(1 / 60);
  assert.ok(Math.abs(viewOffset.x + 2.4) < 0.001);
  assert.ok(Math.abs(viewOffset.y - 1.1) < 0.001);
  send('pointerup', { button: 1, pointerId: 2 });
  const held = viewOffset.clone();
  send('pointermove', { buttons: 0, clientX: 0, clientY: 0 });
  update(1 / 60);
  assert.ok(viewOffset.distanceTo(held) < 0.001);
});

test('double click smoothly restores default zoom and view, then allows new input', () => {
  const { camera, send, update, viewOffset } = setup();
  for (let i = 0; i < 20; i++) send('wheel', { deltaY: -120, deltaMode: 0 });
  send('pointerdown', { button: 1, pointerId: 2, clientX: 500, clientY: 400 });
  send('pointermove', { buttons: 4, clientX: 800, clientY: 600 });
  send('pointerup', { button: 1, pointerId: 2 });
  for (let i = 0; i < 120; i++) update(1 / 60);
  const zoomBefore = camera.zoom;
  const viewBefore = viewOffset.length();

  send('dblclick', { button: 0 });
  assert.equal(camera.zoom, zoomBefore);
  assert.equal(viewOffset.length(), viewBefore);
  update(1 / 60);
  assert.ok(camera.zoom > 1 && camera.zoom < zoomBefore);
  assert.ok(viewOffset.length() > 0 && viewOffset.length() < viewBefore);
  for (let i = 0; i < 120; i++) update(1 / 60);
  assert.ok(Math.abs(camera.zoom - 1) < 0.001);
  assert.ok(viewOffset.length() < 0.001);

  send('wheel', { deltaY: 120, deltaMode: 0 });
  send('pointerdown', { button: 1, pointerId: 3, clientX: 500, clientY: 400 });
  send('pointermove', { buttons: 4, clientX: 600, clientY: 400 });
  send('pointerup', { button: 1, pointerId: 3 });
  update(1 / 60);
  assert.ok(camera.zoom < 1);
  assert.ok(viewOffset.x < -0.01);
});
