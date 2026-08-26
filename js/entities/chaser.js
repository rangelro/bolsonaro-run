// ============================================================
// CHASER.JS — personagem que persegue o jogador
// ============================================================
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { CONFIG } from '../core/config.js';
import { lerp } from '../utils/utils.js';

export class Chaser {
  constructor(scene) {
    this.scene = scene;
    this.group = this._build();
    this.group.position.set(CONFIG.LANES_X[1], 0, CONFIG.CHASER_MAX_BEHIND);
    scene.add(this.group);
  }

  _build() {
    const group = new THREE.Group();
    // Lula: traje vermelho (PT), pele morena, boné vermelho, barba branca, físico robusto
    const suitMat   = new THREE.MeshStandardMaterial({ color: 0xcc1a1a, roughness: 0.6 });
    const skinMat   = new THREE.MeshStandardMaterial({ color: 0xb07040, roughness: 0.7 });
    const capMat    = new THREE.MeshStandardMaterial({ color: 0xaa0000, roughness: 0.6 });
    const legMat    = new THREE.MeshStandardMaterial({ color: 0x7a0000, roughness: 0.7 });
    const beardMat  = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.9 });
    const starMat   = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.4, metalness: 0.3 });

    // Torso mais robusto (Lula é mais encorpado)
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.15, 0.6), suitMat);
    torso.position.y = 1.2;
    torso.castShadow = true;
    group.add(torso);

    // Barriga arredondada
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 12), suitMat);
    belly.scale.set(1, 0.75, 0.85);
    belly.position.set(0, 0.95, 0.22);
    group.add(belly);

    // Cabeça
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 16), skinMat);
    head.position.y = 2.08;
    head.castShadow = true;
    group.add(head);

    // Barba branca
    const beard = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.28, 0.22), beardMat);
    beard.position.set(0, 1.85, 0.22);
    group.add(beard);

    // Bigode
    const mustache = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.15), beardMat);
    mustache.position.set(0, 1.96, 0.28);
    group.add(mustache);

    // Boné vermelho (aba + copa)
    const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.22, 16), capMat);
    capTop.position.y = 2.34;
    capTop.castShadow = true;
    group.add(capTop);
    const capBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.05, 16), capMat);
    capBrim.position.set(0, 2.23, 0.07);
    group.add(capBrim);

    // Estrela dourada no boné (símbolo PT)
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), starMat);
    star.position.set(0, 2.47, 0.3);
    group.add(star);

    // Pernas
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.8, 0.42), legMat);
    legL.position.set(-0.28, 0.4, 0);
    legL.castShadow = true;
    group.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.28;
    group.add(legR);

    // Braços
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.75, 0.32), suitMat);
    armL.position.set(-0.70, 1.2, 0);
    armL.castShadow = true;
    group.add(armL);
    const armR = armL.clone();
    armR.position.x = 0.70;
    group.add(armR);

    group.userData = { legL, legR, armL, armR };
    group.scale.set(1.08, 1.08, 1.08);
    return group;
  }

  update(dt, now, gameSpeedFactor, targetX, gap) {
    this.group.position.x = lerp(this.group.position.x, targetX, 0.05);
    this.group.position.z = lerp(CONFIG.CHASER_MIN_BEHIND, CONFIG.CHASER_MAX_BEHIND, gap);

    const swing = Math.sin(now * 0.006 * gameSpeedFactor * 0.95 + 1) * 0.5;
    this.group.userData.legL.rotation.x = swing;
    this.group.userData.legR.rotation.x = -swing;
    this.group.userData.armL.rotation.x = -swing;
    this.group.userData.armR.rotation.x = swing;
  }

  reset() {
    this.group.position.set(CONFIG.LANES_X[1], 0, CONFIG.CHASER_MAX_BEHIND);
  }
}
