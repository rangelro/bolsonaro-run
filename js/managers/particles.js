// ============================================================
// PARTICLES.JS — ParticleManager
// VFX leves usando THREE.Points, sem pós-processamento (mantém performance alta)
// ============================================================
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';

class Burst {
  constructor(points, velocities, life) {
    this.points = points;
    this.velocities = velocities;
    this.life = life;
    this.age = 0;
  }
}

export class ParticleManager {
  constructor(scene) {
    this.scene = scene;
    this.bursts = [];
  }

  _spawnBurst(position, color, count, speed, life, size) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const v = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.abs(Math.cos(phi)) + 0.3,
        Math.sin(phi) * Math.sin(theta)
      ).multiplyScalar(speed * (0.5 + Math.random() * 0.5));
      velocities.push(v);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color, size, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending
    });
    const points = new THREE.Points(geo, mat);
    this.scene.add(points);
    this.bursts.push(new Burst(points, velocities, life));
  }

  coinBurst(position) {
    this._spawnBurst(position, 0xffd54a, 10, 2.4, 0.5, 0.12);
  }

  impactBurst(position) {
    this._spawnBurst(position, 0xff5555, 14, 3.2, 0.55, 0.14);
  }

  powerupBurst(position, color) {
    this._spawnBurst(position, color, 16, 2.8, 0.6, 0.13);
  }

  update(dt) {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.age += dt;
      const posAttr = b.points.geometry.getAttribute('position');
      for (let j = 0; j < b.velocities.length; j++) {
        posAttr.array[j * 3] += b.velocities[j].x * dt;
        posAttr.array[j * 3 + 1] += (b.velocities[j].y - 2.0 * b.age) * dt; // gravidade leve
        posAttr.array[j * 3 + 2] += b.velocities[j].z * dt;
      }
      posAttr.needsUpdate = true;
      b.points.material.opacity = Math.max(0, 1 - b.age / b.life);

      if (b.age >= b.life) {
        this.scene.remove(b.points);
        b.points.geometry.dispose();
        b.points.material.dispose();
        this.bursts.splice(i, 1);
      }
    }
  }

  reset() {
    this.bursts.forEach(b => {
      this.scene.remove(b.points);
      b.points.geometry.dispose();
      b.points.material.dispose();
    });
    this.bursts = [];
  }
}
