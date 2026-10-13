import * as THREE from 'three';

export function installSceneInteractions({ canvas, camera, grassUniforms }) {
  const defaultZoom = camera.zoom;
  let targetZoom = defaultZoom;
  let previousPoint = null;
  let previousSample = null;
  let strokeDistance = 0;
  let drag = null;
  const targetView = new THREE.Vector2();
  const viewOffset = new THREE.Vector2();
  const pointer = new THREE.Vector2();
  const ray = new THREE.Raycaster();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.25);
  const hit = new THREE.Vector3();
  const movement = new THREE.Vector2();

  function resetStroke() {
    previousPoint = null;
    previousSample = null;
    strokeDistance = 0;
  }

  canvas.addEventListener('wheel', (event) => {
    if (event.ctrlKey) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2
      ? canvas.getBoundingClientRect().height : 1;
    const delta = THREE.MathUtils.clamp(event.deltaY * unit, -120, 120);
    targetZoom = THREE.MathUtils.clamp(targetZoom * Math.exp(-delta * 0.0008), 0.88, 1.18);
  }, { passive: false });

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 1) return;
    event.preventDefault();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = 'grabbing';
    resetStroke();
  });

  function endDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const id = drag.id;
    drag = null;
    canvas.style.cursor = '';
    if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    resetStroke();
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('lostpointercapture', endDrag);
  canvas.addEventListener('auxclick', (event) => {
    if (event.button === 1) event.preventDefault();
  });
  canvas.addEventListener('dblclick', (event) => {
    if (event.button !== 0) return;
    if (drag) endDrag({ pointerId: drag.id });
    targetZoom = defaultZoom;
    targetView.set(0, 0);
    resetStroke();
  });

  function updateBreeze(event, rect) {
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    camera.updateMatrixWorld();
    ray.setFromCamera(pointer, camera);
    if (!ray.ray.intersectPlane(ground, hit) || hit.distanceTo(camera.position) > 55) {
      resetStroke();
      return;
    }

    const center = grassUniforms.uBreezeCenter.value;
    center.set(hit.x, hit.z);
    const elapsed = previousSample ? event.timeStamp - previousSample.time : Infinity;
    if (previousSample && elapsed <= 180) {
      const distance = Math.hypot(event.clientX - previousSample.x, event.clientY - previousSample.y)
        / Math.min(rect.width, rect.height);
      strokeDistance = Math.min(0.3, strokeDistance * Math.exp(-elapsed / 180) + distance);
      const speed = THREE.MathUtils.clamp(distance * 1000 / Math.max(8, elapsed) / 1.3, 0, 1);
      const range = THREE.MathUtils.clamp(strokeDistance / 0.18, 0, 1);
      const strength = distance > 0 ? 0.035 + 0.365 * (speed * 0.65 + range * 0.35) : 0;
      movement.copy(center).sub(previousPoint);
      if (movement.lengthSq() > 0.0001) {
        grassUniforms.uBreezeDirection.value.copy(movement).normalize();
      }
      grassUniforms.uBreezeStrength.value = Math.max(grassUniforms.uBreezeStrength.value, strength);
      grassUniforms.uBreezeRadius.value = 1.1 + range * 1.1;
    } else {
      strokeDistance = 0;
    }
    previousSample = { x: event.clientX, y: event.clientY, time: event.timeStamp };
    if (!previousPoint) previousPoint = new THREE.Vector2();
    previousPoint.copy(center);
  }

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    if (drag) {
      if (!(event.buttons & 4)) { endDrag({ pointerId: drag.id }); return; }
      event.preventDefault();
      targetView.x = THREE.MathUtils.clamp(targetView.x - (event.clientX - drag.x) / rect.width * 8, -2.4, 2.4);
      targetView.y = THREE.MathUtils.clamp(targetView.y + (event.clientY - drag.y) / rect.height * 3.5, -1.1, 1.1);
      drag.x = event.clientX;
      drag.y = event.clientY;
      return;
    }
    if (event.buttons & 1) { resetStroke(); return; }
    updateBreeze(event, rect);
  });
  canvas.addEventListener('pointerleave', resetStroke);

  function update(dt) {
    const smooth = 1 - Math.exp(-8 * dt);
    const zoom = THREE.MathUtils.lerp(camera.zoom, targetZoom, smooth);
    if (Math.abs(zoom - camera.zoom) > 0.000001) {
      camera.zoom = zoom;
      camera.updateProjectionMatrix();
    }
    viewOffset.lerp(targetView, smooth);
    grassUniforms.uBreezeStrength.value *= Math.exp(-2.8 * dt);
  }
  return { update, viewOffset };
}
