// ============================================================
// CHASER.JS — personagem que persegue o jogador
// ============================================================
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { CONFIG } from '../core/config.js';
import { lerp } from '../utils/utils.js';

const ARM_LEN = 0.75;
const LEG_LEN = 0.8;
const HEAD_R = 0.36;
const HEAD_Y = 2.08;
const SHOULDER_Y = 1.57;
const SHOULDER_X = 0.70;
const HIP_X = 0.28;

// Box com pivô na extremidade superior (mesma técnica do player.js), para o braço/perna
// girar a partir do ombro/quadril em vez do meio do membro.
function pivotBoxGeo(w, h, d) {
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(0, -h / 2, 0);
  return geo;
}

export class Chaser {
  constructor(scene) {
    this.scene = scene;
    this.runPhase = 0;
    this.group = this._build();
    this.group.position.set(CONFIG.LANES_X[1], 0, CONFIG.CHASER_MAX_BEHIND);
    scene.add(this.group);
  }

  _build() {
    const group = new THREE.Group();
    // Lula: traje vermelho (PT), físico robusto, careca com cabelo grisalho nas
    // laterais/nuca, barba branca cheia, óculos — identidade visual sem depender de
    // boné/estrela na cabeça (isso lia mais como "torcedor do PT" do que como a pessoa).
    const suitMat    = new THREE.MeshStandardMaterial({ color: 0xcc1a1a, roughness: 0.6 });
    const skinMat    = new THREE.MeshStandardMaterial({ color: 0xb07040, roughness: 0.7 });
    const legMat     = new THREE.MeshStandardMaterial({ color: 0x7a0000, roughness: 0.7 });
    const shoeMat    = new THREE.MeshStandardMaterial({ color: 0x201a1a, roughness: 0.6 });
    const beardMat   = new THREE.MeshStandardMaterial({ color: 0xecece6, roughness: 0.9 });
    const hairMat    = new THREE.MeshStandardMaterial({ color: 0xd8d8d2, roughness: 0.85 }); // grisalho
    const glassesMat = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.4 });
    const starMat    = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.4, metalness: 0.3 });

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

    // Pino da estrela do PT no peito (detalhe discreto, não domina o rosto)
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), starMat);
    star.position.set(-0.32, 1.5, 0.31);
    group.add(star);

    // Cabeça
    const head = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R, 16, 16), skinMat);
    head.position.y = HEAD_Y;
    head.castShadow = true;
    group.add(head);

    // Cabelo grisalho — careca no topo e na testa (mesma técnica do player.js: phi
    // exclui a frente do rosto, theta pula o alto da cabeça), mais raso que o do
    // Bolsonaro pra ficar mais careca/branco, como o Lula.
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(HEAD_R + 0.015, 16, 10, 5.762, 4.183, 0.55, 1.35),
      hairMat
    );
    hair.position.y = HEAD_Y;
    hair.castShadow = true;
    group.add(hair);

    // Barba branca cheia, envolvendo o queixo/bochechas
    const beard = new THREE.Mesh(new THREE.SphereGeometry(0.30, 12, 10), beardMat);
    beard.scale.set(1.05, 0.85, 0.62);
    beard.position.set(0, 1.80, 0.14);
    group.add(beard);

    // Bigode
    const mustache = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.14), beardMat);
    mustache.position.set(0, 1.99, 0.30);
    group.add(mustache);

    // Óculos de armação escura
    const lensGeo = new THREE.BoxGeometry(0.14, 0.09, 0.03);
    const lensL = new THREE.Mesh(lensGeo, glassesMat);
    lensL.position.set(-0.13, HEAD_Y + 0.03, -0.31);
    group.add(lensL);
    const lensR = lensL.clone();
    lensR.position.x = 0.13;
    group.add(lensR);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.02), glassesMat);
    bridge.position.set(0, HEAD_Y + 0.03, -0.32);
    group.add(bridge);

    // ---- Braços: pivô no ombro ----
    const buildArm = (sign) => {
      const upper = new THREE.Group();
      upper.position.set(sign * SHOULDER_X, SHOULDER_Y, 0);
      const armMesh = new THREE.Mesh(pivotBoxGeo(0.28, ARM_LEN, 0.32), suitMat);
      armMesh.castShadow = true;
      upper.add(armMesh);

      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), skinMat);
      hand.position.y = -ARM_LEN - 0.06;
      hand.castShadow = true;
      upper.add(hand);

      group.add(upper);
      return upper;
    };
    const armL = buildArm(-1);
    const armR = buildArm(1);

    // ---- Pernas: pivô no quadril ----
    const buildLeg = (sign) => {
      const upper = new THREE.Group();
      upper.position.set(sign * HIP_X, LEG_LEN, 0);
      const legMesh = new THREE.Mesh(pivotBoxGeo(0.38, LEG_LEN, 0.42), legMat);
      legMesh.castShadow = true;
      upper.add(legMesh);

      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.46), shoeMat);
      shoe.position.set(0, -LEG_LEN - 0.02, 0.06);
      shoe.castShadow = true;
      upper.add(shoe);

      group.add(upper);
      return upper;
    };
    const legL = buildLeg(-1);
    const legR = buildLeg(1);

    group.userData = { legL, legR, armL, armR };
    group.scale.set(1.08, 1.08, 1.08);
    return group;
  }

  update(dt, now, gameSpeedFactor, targetX, gap) {
    this.group.position.x = lerp(this.group.position.x, targetX, 0.05);
    this.group.position.z = lerp(CONFIG.CHASER_MIN_BEHIND, CONFIG.CHASER_MAX_BEHIND, gap);

    // Fase acumulada (não tempo absoluto) — evita salto de pose quando gameSpeedFactor muda
    this.runPhase += dt * gameSpeedFactor * 1.0;
    const swing = Math.sin(this.runPhase * 0.95 + 1) * 0.5;
    this.group.userData.legL.rotation.x = swing;
    this.group.userData.legR.rotation.x = -swing;
    this.group.userData.armL.rotation.x = -swing;
    this.group.userData.armR.rotation.x = swing;
  }

  reset() {
    this.runPhase = 0;
    this.group.position.set(CONFIG.LANES_X[1], 0, CONFIG.CHASER_MAX_BEHIND);
  }
}
