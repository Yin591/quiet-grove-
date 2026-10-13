import * as THREE from 'three';

export class MeadowTrail {
  constructor(animals) {
    this.animals = animals;
    this.points = [];
    this.samples = [];
    this.follower = null;
    this.cursor = 0;
    this.time = 0;
    this.drawing = false;
    this.fadeAt = null;
  }

  release() {
    if (!this.follower) return;
    this.follower.trailFollowing = false;
    this.follower.trailSpeed = 1;
    this.follower.state = 'pause';
    this.follower.stateTime = 0;
    this.follower.nextStateAt = 1;
    this.follower = null;
  }

  begin(point) {
    this.release();
    this.points = [point.clone()];
    this.samples = [{ point: this.points[0], passedAt: null }];
    this.cursor = 0;
    this.drawing = true;
  }

  add(point) {
    if (!this.drawing || this.points.length >= 160) return;
    if (this.points.at(-1).distanceTo(point) < 0.16) return;
    this.points.push(point.clone());
    const curve = new THREE.CatmullRomCurve3(this.points);
    this.samples = curve.getSpacedPoints(Math.min(256, Math.ceil(curve.getLength() / 0.2)))
      .map(point => ({ point, passedAt: null }));
  }

  finish() {
    this.drawing = false;
    if (this.samples.length < 2) { this.samples = []; return null; }
    const start = this.samples[0].point;
    this.follower = this.animals.reduce((nearest, animal) =>
      !nearest || animal.obj.position.distanceToSquared(start) < nearest.obj.position.distanceToSquared(start)
        ? animal : nearest, null);
    if (this.follower) this.follower.trailFollowing = true;
    else this.samples.forEach(sample => { sample.passedAt = this.time + 3; });
    return this.follower;
  }

  opacity(index) {
    const passedAt = this.samples[index].passedAt;
    const alpha = passedAt === null ? 1 : 1 - THREE.MathUtils.smoothstep(this.time - passedAt, 0, 4);
    const fade = this.fadeAt === null ? 1 : 1 - THREE.MathUtils.smoothstep(this.time - this.fadeAt, 0, 3);
    return alpha * fade;
  }

  fadeOut() {
    this.release();
    this.drawing = false;
    this.fadeAt = this.time;
  }

  update(dt) {
    this.time += dt;
    if (this.follower) {
      const animal = this.follower;
      let sample = this.samples[this.cursor];
      while (sample && Math.hypot(sample.point.x - animal.obj.position.x, sample.point.z - animal.obj.position.z) < 0.15) {
        sample.passedAt = this.time;
        sample = this.samples[++this.cursor];
      }
      if (!sample) this.release();
      else {
        animal.target.copy(sample.point);
        animal.state = 'walk';
        const yaw = Math.atan2(sample.point.x - animal.obj.position.x, sample.point.z - animal.obj.position.z);
        animal.trailSpeed = 0.5 + Math.max(0, Math.cos(yaw - animal.obj.rotation.y)) * 0.5;
      }
    }
    if (!this.drawing && !this.follower && this.samples.length && this.samples.every((_, index) => this.opacity(index) === 0)) {
      this.samples = [];
    }
  }
}

export class MeadowTrails {
  constructor(animals) {
    this.animals = animals;
    this.items = [];
    this.retiring = [];
    this.active = null;
  }

  begin(point) {
    if (this.items.length === 3) {
      const oldest = this.items.shift();
      oldest.fadeOut();
      this.retiring.push(oldest);
    }
    const trail = new MeadowTrail(this.animals);
    trail.slot = [0, 1, 2].find(slot => this.items.every(item => item.slot !== slot));
    trail.begin(point);
    this.items.push(trail);
    this.active = trail;
  }

  add(point) {
    this.active.add(point);
  }

  finish() {
    const current = this.active;
    const follower = current.finish();
    if (follower) {
      for (const trail of this.items) {
        if (trail === current || trail.follower !== follower) continue;
        trail.release();
        trail.samples.forEach(sample => { sample.passedAt ??= trail.time; });
      }
      follower.trailFollowing = true;
    }
    this.active = null;
    return follower;
  }

  update(dt) {
    this.visible.forEach(trail => trail.update(dt));
    this.items = this.items.filter(trail => trail.samples.length > 0);
    this.retiring = this.retiring.filter(trail => trail.samples.length > 0);
  }

  get visible() {
    return [...this.retiring, ...this.items];
  }
}
