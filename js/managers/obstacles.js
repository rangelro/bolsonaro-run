// ============================================================
// OBSTACLES.JS — ObstacleManager (com pooling de objetos)
// ============================================================
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { CONFIG, OBSTACLE_TYPES } from '../core/config.js';
import { randInt } from '../utils/utils.js';

// Contorno de estrela de 5 pontas (símbolo do PT) usado como emblema nos obstáculos altos.
function starShape(outerR, innerR) {
  const shape = new THREE.Shape();
  const pts = 5;
  for (let i = 0; i < pts * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = i * (Math.PI / pts) - Math.PI / 2;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

export class ObstacleManager {
  constructor(scene) {
    this.scene = scene;
    this.active = [];
    this.poolLow = [];
    this.poolHigh = [];
    this.timer = 0;
  }

  _createLow() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xf39c12, roughness: 0.5 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 0.6), mat);
    mesh.castShadow = true;
    return mesh;
  }

  _createHigh() {
    const group = new THREE.Group();
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x7f8c8d, roughness: 0.5 });
    const barMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.5 });

    const poleL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 8), poleMat);
    poleL.position.set(-1.1, 1.3, 0);
    group.add(poleL);
    const poleR = poleL.clone();
    poleR.position.x = 1.1;
    group.add(poleR);

    const bar = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.4, 0.4), barMat);
    bar.position.y = 2.05;
    group.add(bar);

    // Estrela branca do PT, na face da barra voltada para o jogador
    const starMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.4, emissive: 0xdadada, emissiveIntensity: 0.3
    });
    const star = new THREE.Mesh(
      new THREE.ExtrudeGeometry(starShape(0.14, 0.06), { depth: 0.04, bevelEnabled: false }),
      starMat
    );
    star.position.set(0, 2.05, 0.2);
    group.add(star);

    group.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return group;
  }

  _obtain(type) {
    const pool = type === OBSTACLE_TYPES.LOW ? this.poolLow : this.poolHigh;
    let mesh = pool.pop();
    if (!mesh) mesh = type === OBSTACLE_TYPES.LOW ? this._createLow() : this._createHigh();
    mesh.visible = true;
    return mesh;
  }

  _release(obs) {
    obs.visible = false;
    this.scene.remove(obs);
    const pool = obs.userData.obstacleType === OBSTACLE_TYPES.LOW ? this.poolLow : this.poolHigh;
    pool.push(obs);
  }

  spawn() {
    const laneIdx = randInt(0, 2);
    const type = Math.random() < 0.55 ? OBSTACLE_TYPES.LOW : OBSTACLE_TYPES.HIGH;
    const mesh = this._obtain(type);
    mesh.position.set(CONFIG.LANES_X[laneIdx], type === OBSTACLE_TYPES.LOW ? 0.45 : 0, CONFIG.SPAWN_Z);
    mesh.userData.laneIndex = laneIdx;
    mesh.userData.obstacleType = type;
    mesh.userData.passed = false;
    this.scene.add(mesh);
    this.active.push(mesh);
  }

  // Retorna a lista de obstáculos que colidiram nesta atualização (ainda não resolvidos)
  update(dt, distance) {
    this.timer += dt * 1000;
    const interval = Math.max(
      CONFIG.OBSTACLE_MIN_INTERVAL,
      CONFIG.OBSTACLE_BASE_INTERVAL - distance * CONFIG.OBSTACLE_DIFFICULTY_SCALE
    );
    if (this.timer > interval) {
      this.timer = 0;
      this.spawn();
    }

    const gameSpeed = this._lastSpeed || CONFIG.BASE_SPEED;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const obs = this.active[i];
      obs.position.z += gameSpeed * dt;
      if (obs.position.z > CONFIG.DESPAWN_Z) {
        this.active.splice(i, 1);
        this._release(obs);
      }
    }
  }

  setSpeed(speed) { this._lastSpeed = speed; }

  reset() {
    this.active.forEach(o => this._release(o));
    this.active = [];
    this.timer = 0;
  }
}
