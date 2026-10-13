import * as THREE from 'three';
import { gsap } from 'gsap';
import { scene, camera, renderer, setVh, skyUniforms, ambient, sun, hemi, sunMesh, sunGlow, grassUniforms, pollen, dust, dandelion, godRays, animals, updateAnimals, updateSparkles } from './scene.js';
import { bgm, audioState, startWebAudioFallback, stopWebAudioFallback, startAmbientPad, stopAmbientPad, fadeInBgm, fadeOutBgm } from './audio.js';
import { installSceneInteractions } from './interactions.js';
import { installMeadowTrail } from './trail-effects.js';

const { update: updateInteractions, viewOffset } = installSceneInteractions({ canvas: renderer.domElement, camera, grassUniforms });
const updateTrail = installMeadowTrail({ canvas: renderer.domElement, camera, scene, grassUniforms, animals });

/* ============================================================
   State & interactions
   ============================================================ */
const state = {
  music: false,
  particleSpeed: 0.55,   // hushed pre-entry; raised on enterSanctuary()
  mood: 'day',
  mouseX: 0, mouseY: 0,
  targetX: 0, targetY: 0,
  rayBoost: 0,
};

/* ---------- Toast ---------- */
const toastEl = document.getElementById('toast');
let toastTimer = null;
function toast(msg, dur = 2200) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), dur);
}

/* ---------- Music toggle wired to editorial UI ---------- */
const musicBtn = document.getElementById('musicBtn');
const hintEl = document.getElementById('hint');
const playerEl = document.getElementById('player');
const playBtn = document.getElementById('playBtn');
const playIcon = document.getElementById('playIcon');
const playerStatus = document.getElementById('playerStatus');
const enterCn = document.getElementById('enterCn');

const ICON_PLAY  = '<path d="M2 1 L11 6 L2 11 Z"/>';
const ICON_PAUSE = '<rect x="2" y="1.5" width="2.5" height="9" rx="0.5"/><rect x="7.5" y="1.5" width="2.5" height="9" rx="0.5"/>';

let everPlayed = false;
function setPlayingUI(playing) {
  if (playing) {
    everPlayed = true;
    playerEl.classList.add('playing');
    playIcon.innerHTML = ICON_PAUSE;
    playBtn.setAttribute('aria-label', 'Pause');
    playerStatus.textContent = '正 在 播 放';
    enterCn.textContent = '在 安 全 岛';
    hintEl.classList.add('fade');
  } else {
    playerEl.classList.remove('playing');
    playIcon.innerHTML = ICON_PLAY;
    playBtn.setAttribute('aria-label', 'Play');
    playerStatus.textContent = everPlayed ? '已 暂 停' : '点 击 播 放';
    enterCn.textContent = '进 入 安 全 岛';
  }
}

async function toggleMusic() {
  if (!state.music) {
    let ok = false;

    // Try real audio first
    try {
      const p = bgm.play();
      if (p !== undefined) await p;
      // play() resolved without throwing → audio is starting
      fadeInBgm();
      audioState.usingWebAudio = false;
      ok = true;
    } catch (err) {
      // Could be autoplay block (rare here since user clicked) or network/CORS
      ok = false;
    }

    // If audio failed (e.g. mp3 blocked / offline), fall back to WebAudio noise
    if (!ok) {
      try {
        startWebAudioFallback();
        audioState.usingWebAudio = true;
        ok = true;
        toast('使 用 备 用 环 境 音');
      } catch (e2) {
        toast('请 再 次 点 击 播 放');
        return;
      }
    }
    state.music = true;
    setPlayingUI(true);
    startAmbientPad();
    onMusicOn();
  } else {
    if (audioState.usingWebAudio) stopWebAudioFallback();
    else fadeOutBgm();
    stopAmbientPad();
    state.music = false;
    setPlayingUI(false);
    onMusicOff();
  }
}

musicBtn.addEventListener('click', toggleMusic);
playBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleMusic(); });

function onMusicOn() {
  gsap.to(grassUniforms.uWind, { value: 1.25, duration: 4.5, ease: 'power2.out' });
  gsap.to(state, { particleSpeed: 0.55, rayBoost: 0.18, duration: 4.5 });
  gsap.to(ambient, { intensity: 0.58, duration: 4.5 });
  gsap.to(sun,     { intensity: 0.82, duration: 4.5 });
  gsap.to(hemi,    { intensity: 0.58, duration: 4.5 });
  gsap.to(pollen.points.material,    { size: 0.10, opacity: 0.85, duration: 3 });
  gsap.to(dust.points.material,      { size: 0.04, opacity: 0.78, duration: 3 });
  gsap.to(dandelion.points.material, { size: 0.5,  opacity: 0.78, duration: 3 });
  gsap.to('#vignette', { opacity: 0.55, duration: 3 });
}

function onMusicOff() {
  gsap.to(grassUniforms.uWind, { value: 1.0, duration: 4.5 });
  gsap.to(state, { particleSpeed: 0.85, rayBoost: 0, duration: 4.5 });
  gsap.to(ambient, { intensity: 0.50, duration: 4.5 });
  gsap.to(sun,     { intensity: 0.72, duration: 4.5 });
  gsap.to(hemi,    { intensity: 0.50, duration: 4.5 });
  gsap.to(pollen.points.material,    { size: 0.085, opacity: 0.75, duration: 3 });
  gsap.to(dust.points.material,      { size: 0.035, opacity: 0.68, duration: 3 });
  gsap.to(dandelion.points.material, { size: 0.44, opacity: 0.7,  duration: 3 });
  if (state.mood === 'day') applyDayPalette();
  else                      applySunsetPalette();
  gsap.to('#vignette', { opacity: 1, duration: 3 });
}

/* ---------- Mood toggle ---------- */
const moodBtn = document.getElementById('moodBtn');
moodBtn.addEventListener('click', () => {
  if (state.mood === 'day') {
    state.mood = 'sunset';
    moodBtn.textContent = '午 后 时 分';
    moodBtn.classList.add('active');
    applySunsetPalette();
  } else {
    state.mood = 'day';
    moodBtn.textContent = '黄 昏 时 分';
    moodBtn.classList.remove('active');
    applyDayPalette();
  }
});

function applyDayPalette() {
  gsap.to(skyUniforms.uTop.value,    { r: 0.65, g: 0.84, b: 0.96, duration: 5 });
  gsap.to(skyUniforms.uMid.value,    { r: 0.84, g: 0.92, b: 0.78, duration: 5 });
  gsap.to(skyUniforms.uBottom.value, { r: 0.94, g: 0.96, b: 0.85, duration: 5 });
  gsap.to(scene.fog.color, { r: 0.78, g: 0.90, b: 0.66, duration: 5 });
  gsap.to(grassUniforms.uSunColor.value, { r: 1.00, g: 0.95, b: 0.75, duration: 5 });
  gsap.to(sun.color, { r: 1.00, g: 0.94, b: 0.78, duration: 5 });
  gsap.to(sunMesh.material.color, { r: 1.00, g: 0.94, b: 0.75, duration: 5 });
}

function applySunsetPalette() {
  gsap.to(skyUniforms.uTop.value,    { r: 0.94, g: 0.55, b: 0.42, duration: 6 });
  gsap.to(skyUniforms.uMid.value,    { r: 1.00, g: 0.78, b: 0.55, duration: 6 });
  gsap.to(skyUniforms.uBottom.value, { r: 1.00, g: 0.88, b: 0.65, duration: 6 });
  gsap.to(scene.fog.color, { r: 0.92, g: 0.72, b: 0.55, duration: 6 });
  gsap.to(grassUniforms.uSunColor.value, { r: 1.00, g: 0.65, b: 0.35, duration: 6 });
  gsap.to(sun.color, { r: 1.00, g: 0.68, b: 0.42, duration: 6 });
  gsap.to(sunMesh.material.color, { r: 1.00, g: 0.65, b: 0.38, duration: 6 });
}

/* ---------- Parallax: pointer / touch / gyroscope ---------- */
let useGyro = false;
let gyroZero = null;

function updateTargets(clientX, clientY) {
  state.targetX = (clientX / innerWidth - 0.5) * 2;
  state.targetY = (clientY / innerHeight - 0.5) * 2;
}
window.addEventListener('pointermove', (e) => { if (!useGyro && !(e.buttons & 5)) updateTargets(e.clientX, e.clientY); });
window.addEventListener('touchmove', (e) => {
  if (useGyro) return;
  const t = e.touches[0];
  if (t) updateTargets(t.clientX, t.clientY);
}, { passive: true });

function handleOrientation(e) {
  if (e.beta == null || e.gamma == null) return;
  if (!gyroZero) gyroZero = { beta: e.beta, gamma: e.gamma };
  const dg = e.gamma - gyroZero.gamma;
  const db = e.beta  - gyroZero.beta;
  state.targetX = Math.max(-0.6, Math.min(0.6, dg / 30));
  state.targetY = Math.max(-0.25, Math.min(0.25, db / 30));
}

const gyroBtn = document.getElementById('gyroBtn');
const hasGyro = 'DeviceOrientationEvent' in window;
if (!hasGyro) {
  gyroBtn.disabled = true;
  gyroBtn.style.opacity = 0.5;
  gyroBtn.textContent = '无 体 感';
}
gyroBtn.addEventListener('click', async () => {
  if (!hasGyro) { toast('当 前 设 备 不 支 持 体 感'); return; }
  if (useGyro) {
    window.removeEventListener('deviceorientation', handleOrientation);
    useGyro = false;
    gyroZero = null;
    gyroBtn.textContent = '开 启 体 感';
    gyroBtn.classList.remove('active');
    return;
  }
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== 'granted') { toast('未 授 权 体 感'); return; }
    } catch (err) { toast('授 权 失 败'); return; }
  }
  window.addEventListener('deviceorientation', handleOrientation);
  useGyro = true;
  gyroBtn.textContent = '已 启 用 体 感';
  gyroBtn.classList.add('active');
  toast('轻 轻 转 动 手 机');
});

/* ---------- Fullscreen ---------- */
const fsBtn = document.getElementById('fsBtn');

const fsLabel = document.getElementById('fsLabel');

function isFs() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}
async function enterFs() {
  const el = document.documentElement;
  try {
    if (el.requestFullscreen)      await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else throw new Error('unsupported');
    fsLabel.textContent = '退 出 全 屏';
  } catch (err) {
    toast('当 前 浏 览 器 不 支 持 全 屏');
  }
}
async function exitFs() {
  try {
    if (document.exitFullscreen)         await document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  } catch (err) { /* noop */ }
  fsLabel.textContent = '全 屏 体 验';
}
fsBtn.addEventListener('click', () => { if (isFs()) exitFs(); else enterFs(); });
document.addEventListener('fullscreenchange', () => {
  fsLabel.textContent = isFs() ? '退 出 全 屏' : '全 屏 体 验';
});
document.addEventListener('webkitfullscreenchange', () => {
  fsLabel.textContent = isFs() ? '退 出 全 屏' : '全 屏 体 验';
});

/* ---------- Entry ceremony — UI fades in only after user clicks ---------- */
const entryEl   = document.getElementById('entry');
const entryVeil = document.getElementById('entryVeil');
const entryCta  = document.getElementById('entryCta');

let entered = false;
async function enterSanctuary() {
  if (entered) return;
  entered = true;

  // 1. Disable CTA so it can't be re-clicked
  entryCta.style.pointerEvents = 'none';
  entryCta.disabled = true;

  // 2. Press feedback only: shrink → spring back. No fade, no blur, no lift.
  entryEl.classList.add('is-leaving');         // scale(0.96)
  setTimeout(() => {
    entryEl.style.transform = 'translate(-50%, -50%) scale(1.03)';
  }, 320);

  // 3. After the spring back finishes (720ms), hard-hide the entry,
  //    THEN reveal masthead + player. Nothing overlaps.
  setTimeout(() => {
    entryEl.classList.add('is-gone');
    entryVeil.classList.add('is-gone');

    // Now (and only now) let the rest of the UI in
    document.body.classList.remove('pre-entry');

    gsap.from('.masthead', { opacity: 0, y: -10, duration: 2.0, delay: 0.1, ease: 'power2.out' });
    gsap.from('.player',   { opacity: 0, y:  10, duration: 1.8, delay: 0.4, ease: 'power2.out',
                             onComplete() { gsap.set('.player', { clearProps: 'opacity,transform' }); } });
  }, 720);

  // Veil dims out gently in parallel
  entryVeil.classList.add('is-leaving');

  // Scene atmosphere lifts immediately on click (slow, 2.2s) — visible behind veil
  gsap.to(ambient, { intensity: 0.50, duration: 2.2, ease: 'power2.out' });
  gsap.to(sun,     { intensity: 0.72, duration: 2.2, ease: 'power2.out' });
  gsap.to(hemi,    { intensity: 0.50, duration: 2.2, ease: 'power2.out' });
  gsap.to(state,   { particleSpeed: 0.85, duration: 2.4, ease: 'power2.out' });

  // Start BGM right away — gives the entry click an immediate audible reward
  try {
    await bgm.play();
    state.music = true;
    setPlayingUI(true);
    startAmbientPad();
    onMusicOn();
    fadeInBgm();
    hintEl.classList.add('fade');
  } catch (err) {
    setPlayingUI(false);
  }
}

entryCta.addEventListener('click', enterSanctuary);
entryCta.addEventListener('touchend', (e) => { e.preventDefault(); enterSanctuary(); }, { passive: false });

/* ---------- Breath phase label — synced to .core animation cycle ---------- */
(function syncBreath() {
  const phaseEl = document.querySelector('.breath-orb .phase');
  const coreEl  = document.querySelector('.breath-orb .core');
  if (!phaseEl || !coreEl) return;

  function cycle() {
    // Inhale 4s
    phaseEl.style.opacity = '0';
    setTimeout(() => {
      phaseEl.textContent = '吸 气';
      phaseEl.style.opacity = '1';
    }, 300);

    // Switch to exhale after 4s
    setTimeout(() => {
      phaseEl.style.opacity = '0';
      setTimeout(() => {
        phaseEl.textContent = '呼 气';
        phaseEl.style.opacity = '1';
      }, 300);
    }, 4000);
  }
  cycle();
  setInterval(cycle, 10000);
})();

/* ---------- Resize ---------- */
function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.fov = (innerHeight > innerWidth) ? 68 : 58;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  setVh();
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 200));

/* ============================================================
   Animate
   ============================================================ */
const clock = new THREE.Clock();
const camBase = new THREE.Vector3(0, 5.2, 13);
const camLookAt = new THREE.Vector3(0, 1.4, -8);
const viewTarget = new THREE.Vector3();

function updateParticleSystem(ps, t) {
  const arr = ps.points.geometry.attributes.position.array;
  const halfA = ps.area / 2;
  const speedMul = state.particleSpeed;
  for (let i = 0; i < ps.count; i++) {
    arr[i * 3]     += ps.vel[i * 3]     * speedMul + Math.sin(t * 0.5 + ps.phase[i]) * 0.0018;
    arr[i * 3 + 1] += ps.vel[i * 3 + 1] * speedMul;
    arr[i * 3 + 2] += ps.vel[i * 3 + 2] * speedMul + Math.cos(t * 0.4 + ps.phase[i]) * 0.0014;
    if (arr[i * 3 + 1] > ps.yRange[1]) arr[i * 3 + 1] = ps.yRange[0];
    if (arr[i * 3]     >  halfA) arr[i * 3]     = -halfA;
    if (arr[i * 3]     < -halfA) arr[i * 3]     =  halfA;
    if (arr[i * 3 + 2] >  halfA - 4) arr[i * 3 + 2] = -halfA - 4;
    if (arr[i * 3 + 2] < -halfA - 4) arr[i * 3 + 2] =  halfA - 4;
  }
  ps.points.geometry.attributes.position.needsUpdate = true;
}

function animate() {
  // IMPORTANT: getElapsedTime() internally calls getDelta(), so calling
  // both back-to-back gives dt ≈ 0 and animals never move.
  // Use getDelta() ONCE per frame, then derive t from it.
  const dt = Math.min(0.05, clock.getDelta());
  const t  = clock.elapsedTime;

  grassUniforms.uTime.value = t;
  updateInteractions(dt);
  updateTrail(dt);

  updateParticleSystem(pollen, t);
  updateParticleSystem(dust, t);
  updateParticleSystem(dandelion, t);

  updateAnimals(dt, t);
  updateSparkles(dt);

  for (const r of godRays) {
    const dx = camera.position.x - r.position.x;
    const dz = camera.position.z - r.position.z;
    r.rotation.y = Math.atan2(dx, dz);
    r.material.uniforms.uTime.value = t;
    r.material.uniforms.uIntensity.value = r.userData.baseIntensity + state.rayBoost;
  }

  state.mouseX += (state.targetX - state.mouseX) * 0.03;
  state.mouseY += (state.targetY - state.mouseY) * 0.03;

  camera.position.x = camBase.x + Math.sin(t * 0.08) * 0.45 + state.mouseX * 0.7;
  camera.position.y = camBase.y + Math.sin(t * 0.10) * 0.18 - state.mouseY * 0.25;
  camera.position.z = camBase.z + Math.cos(t * 0.06) * 0.3;
  viewTarget.copy(camLookAt);
  viewTarget.x += viewOffset.x;
  viewTarget.y += viewOffset.y;
  camera.lookAt(viewTarget);

  const pulse = 28 + Math.sin(t * 0.18) * 0.7;
  sunGlow.scale.set(pulse, pulse, 1);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
