// ============================================================
// COINS.JS — CoinManager
// ============================================================
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { CONFIG } from '../core/config.js';
import { randInt, dist2D } from '../utils/utils.js';

const PATTERNS = [
  // cada padrão é uma lista de {laneOffset, zStep} relativa ao ponto de spawn
  [0, 1, 2, 3, 4],                // linha reta de 5 moedas em 1 faixa
  [0, 1, 2],                      // linha curta
  [0, 1, 2, 3, 4, 5, 6],          // linha longa
];

export class CoinManager {
  constructor(scene) {
    this.scene = scene;
    this.active = [];
    this.pool = [];
    this.timer = 0;
    this._lastSpeed = CONFIG.BASE_SPEED;
  }

  _createCoin() {
    const geo = new THREE.TorusGeometry(0.32, 0.11, 8, 16);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffd54a, emissive: 0x8a6a10, emissiveIntensity: 0.5, roughness: 0.35, metalness: 0.6
    });
    const mesh = new THREE.Mesh(geo, mat);
    return mesh;
  }

  _obtain() {
    let c = this.pool.pop();
    if (!c) c = this._createCoin();
    c.visible = true;
    return c;
  }

  _release(c) {
    c.visible = false;
    this.scene.remove(c);
    this.pool.push(c);
  }

  spawnRow() {
    const laneIdx = randInt(0, 2);
    const pattern = PATTERNS[randInt(0, PATTERNS.length - 1)];
    pattern.forEach((step) => {
      const c = this._obtain();
      c.position.set(CONFIG.LANES_X[laneIdx], 1.1, CONFIG.SPAWN_Z - step * CONFIG.COIN_ROW_SPACING);
      c.userData.collected = false;
      c.userData.baseX = CONFIG.LANES_X[laneIdx];
      this.scene.add(c);
      this.active.push(c);
    });
  }

  setSpeed(speed) { this._lastSpeed = speed; }

  // playerPos: THREE.Vector3 ; magnetActive: bool
  // Retorna quantas moedas foram coletadas neste frame
  update(dt, playerPos, magnetActive) {
    this.timer += dt;
    if (this.timer > 1 / CONFIG.COIN_SPAWN_CHANCE_PER_SEC) {
      this.timer = 0;
      if (Math.random() < 0.85) this.spawnRow();
    }

    let collected = 0;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const c = this.active[i];
      c.position.z += this._lastSpeed * dt;
      c.rotation.z += dt * 4;

      if (magnetActive) {
        const d = dist2D(c.position.x, c.position.z, playerPos.x, playerPos.z);
        if (d < CONFIG.COIN_MAGNET_RADIUS) {
          c.position.x += (playerPos.x - c.position.x) * Math.min(1, dt * 6);
          c.position.z += (playerPos.z - c.position.z) * Math.min(1, dt * 6);
        }
      }

      // coleta: mesma faixa aproximada e perto do jogador em Z
      const closeEnough = dist2D(c.position.x, c.position.z, playerPos.x, playerPos.z) < 0.9;
      if (!c.userData.collected && closeEnough) {
        c.userData.collected = true;
        collected++;
        this.active.splice(i, 1);
        this._release(c);
        continue;
      }

      if (c.position.z > CONFIG.DESPAWN_Z) {
        this.active.splice(i, 1);
        this._release(c);
      }
    }
    return collected;
  }

  reset() {
    this.active.forEach(c => this._release(c));
    this.active = [];
    this.timer = 0;
  }
}
