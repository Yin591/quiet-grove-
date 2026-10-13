import * as THREE from 'three';
import { MeadowTrails } from './trail.js';

export function installMeadowTrail({ canvas, camera, scene, grassUniforms, animals }) {
  const trails = new MeadowTrails(animals);
  const mask = document.createElement('canvas');
  mask.width = mask.height = 512;
  const ctx = mask.getContext('2d');
  const texture = new THREE.CanvasTexture(mask);
  texture.generateMipmaps = false;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  grassUniforms.uTrailMap.value = texture;

  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 32;
  const glowCtx = glowCanvas.getContext('2d');
  const glow = glowCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
  glow.addColorStop(0, 'rgba(255,247,205,1)');
  glow.addColorStop(0.1875, 'rgba(255,231,165,.5)');
  glow.addColorStop(1, 'rgba(255,218,140,0)');
  glowCtx.fillStyle = glow;
  glowCtx.fillRect(0, 0, 32, 32);
  const motes = Array.from({ length: 64 * 3 }, () => ({
    size: 0.7 + Math.random() * 0.9,
    phase: Math.random() * Math.PI * 2,
    speed: 0.45 + Math.random() * 0.25,
    height: 0.34 + Math.random() * 0.12,
    offsetSide: (Math.random() - 0.5) * 0.64,
    offsetAlong: (Math.random() - 0.5) * 0.44,
  }));
  let positions = new Float32Array(motes.length * 3);
  let colors = new Float32Array(motes.length * 3);
  let sizes = new Float32Array(motes.length);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setDrawRange(0, 0);
  const material = new THREE.PointsMaterial({
    map: new THREE.CanvasTexture(glowCanvas), size: 0.28 * 4 / 3, vertexColors: true,
    transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = `attribute float aSize;\n${shader.vertexShader}`
      .replace('gl_PointSize = size;', 'gl_PointSize = size * aSize;');
  };
  const lights = new THREE.Points(geometry, material);
  lights.frustumCulled = false;
  scene.add(lights);

  function reserveLights(count) {
    if (count <= sizes.length) return;
    const capacity = Math.max(count, sizes.length * 2);
    geometry.dispose();
    positions = new Float32Array(capacity * 3);
    colors = new Float32Array(capacity * 3);
    sizes = new Float32Array(capacity);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  }

  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const groundPoint = new THREE.Vector3();
  const hitboxes = animals.map(animal => animal.hit);
  let active = null;

  function locate(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
    if (Math.abs(pointer.x) > 1 || Math.abs(pointer.y) > 1) return null;
    camera.updateMatrixWorld();
    ray.setFromCamera(pointer, camera);
    if (!ray.ray.intersectPlane(ground, groundPoint) || groundPoint.distanceTo(camera.position) > 40) return null;
    return groundPoint;
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || document.body.classList.contains('pre-entry')) return;
    const point = locate(event);
    if (!point || ray.intersectObjects(hitboxes, false).length) return;
    active = { id: event.pointerId, point: point.clone(), x: event.clientX, y: event.clientY, drawing: false };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!active || active.id !== event.pointerId || !(event.buttons & 1)) return;
    const point = locate(event);
    if (!point) return;
    if (!active.drawing && Math.hypot(event.clientX - active.x, event.clientY - active.y) < 6) return;
    if (!active.drawing) {
      trails.begin(active.point);
      active.drawing = true;
      canvas.style.cursor = 'crosshair';
    }
    trails.add(point);
  });
  function finish(event) {
    if (!active || event.pointerId !== active.id) return;
    const { id, drawing } = active;
    active = null;
    if (drawing) trails.finish();
    canvas.style.cursor = '';
    if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  }
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);
  canvas.addEventListener('lostpointercapture', finish);

  const scale = mask.width / 90;
  function paintTrail(visible) {
    ctx.clearRect(0, 0, mask.width, mask.height);
    ctx.lineWidth = 0.75 * scale;
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.shadowBlur = 2;
    for (const trail of visible) {
      for (let i = 1; i < trail.samples.length; i++) {
        const a = trail.samples[i - 1].point;
        const b = trail.samples[i].point;
        const alpha = trail.opacity(i - 1) * 0.8;
        if (alpha <= 0) continue;
        const length = Math.hypot(b.x - a.x, b.z - a.z) || 1;
        const green = Math.round(((b.x - a.x) / length * 0.5 + 0.5) * 255);
        const blue = Math.round(((b.z - a.z) / length * 0.5 + 0.5) * 255);
        ctx.strokeStyle = ctx.shadowColor = `rgba(255,${green},${blue},${alpha})`;
        ctx.beginPath();
        ctx.moveTo((a.x + 45) * scale, (41 - a.z) * scale);
        ctx.lineTo((b.x + 45) * scale, (41 - b.z) * scale);
        ctx.stroke();
      }
    }
    texture.needsUpdate = true;
  }

  let maskTime = 0;
  let hadSamples = false;
  return (dt) => {
    trails.update(dt);
    const visible = trails.visible;
    maskTime += dt;
    if (maskTime >= 0.05 && (visible.length || hadSamples)) {
      paintTrail(visible);
      maskTime = 0;
      hadSamples = visible.length > 0;
    }
    reserveLights(visible.length * 64);
    let count = 0;
    for (const trail of visible) {
      let moteIndex = 0;
      for (let i = 1; i < trail.samples.length && moteIndex < 64; i += 4) {
        const mote = motes[trail.slot * 64 + moteIndex++];
        const phase = trail.time * mote.speed + mote.phase;
        const alpha = trail.opacity(i) * (0.74 + Math.sin(phase) * 0.18);
        const point = trail.samples[i].point;
        const before = trail.samples[i - 1].point;
        const after = trail.samples[Math.min(i + 1, trail.samples.length - 1)].point;
        const length = Math.hypot(after.x - before.x, after.z - before.z) || 1;
        const dx = (after.x - before.x) / length;
        const dz = (after.z - before.z) / length;
        positions.set([
          point.x - dz * mote.offsetSide + dx * mote.offsetAlong + Math.sin(phase * 0.8) * 0.08,
          mote.height + Math.sin(phase * 0.9) * 0.065,
          point.z + dx * mote.offsetSide + dz * mote.offsetAlong + Math.cos(phase * 0.7) * 0.065,
        ], count * 3);
        colors.set([alpha, alpha * 0.88, alpha * 0.52], count * 3);
        sizes[count] = mote.size;
        count++;
      }
    }
    geometry.setDrawRange(0, count);
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    geometry.attributes.aSize.needsUpdate = true;
  };
}
