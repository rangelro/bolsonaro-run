// ============================================================
// PLAYER.JS — personagem controlado pelo usuário
// ============================================================
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { CONFIG } from '../core/config.js';
import { clamp, lerp } from '../utils/utils.js';

// ---- proporções do corpo (unidades de mundo) ----
const SHOE_H = 0.10;
const SHIN_LEN = 0.34;
const THIGH_LEN = 0.34;
const HIP_Y = SHOE_H + SHIN_LEN + THIGH_LEN;      // 0.78 — altura do quadril
const HIP_HALF_W = 0.17;                          // metade da distância entre os quadris
const TORSO_H = 0.86;
const TORSO_BOTTOM_Y = HIP_Y - 0.04;              // leve sobreposição com o quadril
const TORSO_CENTER_Y = TORSO_BOTTOM_Y + TORSO_H / 2;
const NECK_H = 0.10;
const HEAD_R = 0.30;
const SHOULDER_X = 0.60;
const ARM_LEN = 0.58;

// Box com pivô deslocado para a extremidade superior (0,0,0) em vez do centro,
// assim a rotação do membro gira em torno da articulação (quadril/ombro/joelho/cotovelo).
function pivotBoxGeo(w, h, d) {
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(0, -h / 2, 0);
  return geo;
}

export const SKINS = ['selecao', 'presidiario', 'presidente'];

// Textura procedural de listras (uniforme de presidiário) — gerada uma vez e
// reaproveitada; cada face de BoxGeometry tem UV própria 0..1, então a mesma
// textura já rende listras em torso, quadril e pernas sem ajuste por peça.
let _stripeTexCache = null;
function getStripeTexture() {
  if (_stripeTexCache) return _stripeTexCache;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f2f2ee';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#181818';
  const stripeW = 8;
  for (let x = 0; x < 64; x += stripeW * 2) ctx.fillRect(x, 0, stripeW, 64);
  _stripeTexCache = new THREE.CanvasTexture(c);
  return _stripeTexCache;
}

export class Player {
  constructor(scene, skin = 'selecao') {
    this.scene = scene;
    this.skin = SKINS.includes(skin) ? skin : 'selecao';
    this.lane = 1;
    this.targetX = CONFIG.LANES_X[1];

    this.isJumping = false;
    this.isSliding = false;
    this.jumpStartTime = 0;
    this.slideStartTime = 0;

    this.shieldActive = false;
    this.invulnerable = false;
    this.invulnerableUntil = 0;
    this.runPhase = 0;

    this._flashTimer = null;
    this._flashlightOn = false;

    this.group = new THREE.Group();
    this.group.position.set(CONFIG.LANES_X[1], 0, CONFIG.PLAYER_Z);
    scene.add(this.group);

    this._buildShieldVisual();  // cria this.shieldMesh (ainda não anexado ao group)
    this._buildFlashlight();    // cria a lanterna (ainda não anexada ao group)
    this._buildBody();          // monta o corpo e reanexa shield + lanterna por último
  }

  // Materiais dependem da skin escolhida; forma/pose do corpo é sempre a mesma.
  _skinMaterials(skin) {
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf5c8a0, roughness: 0.7 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0xb0ada8, roughness: 0.8 }); // grisalho
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.6 });

    if (skin === 'presidiario') {
      const stripedMat = new THREE.MeshStandardMaterial({ map: getStripeTexture(), roughness: 0.8 });
      return {
        jerseyMat: stripedMat, shortsMat: stripedMat, greenMat: stripedMat,
        cuffMat: stripedMat, shinMat: stripedMat, skinMat, hairMat, shoeMat
      };
    }
    if (skin === 'presidente') {
      const suitMat  = new THREE.MeshStandardMaterial({ color: 0x14141c, roughness: 0.45, metalness: 0.1 });
      const shirtMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f2, roughness: 0.5 });
      return {
        jerseyMat: suitMat, shortsMat: suitMat, greenMat: shirtMat,
        cuffMat: shirtMat, shinMat: suitMat, skinMat, hairMat, shoeMat
      };
    }
    // 'selecao' (padrão) — camisa da seleção brasileira, calção azul
    const jerseyMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.6 }); // amarelo CBF
    const greenMat  = new THREE.MeshStandardMaterial({ color: 0x009c3b, roughness: 0.6 }); // verde seleção
    const shortsMat = new THREE.MeshStandardMaterial({ color: 0x003082, roughness: 0.7 }); // azul CBF
    return { jerseyMat, shortsMat, greenMat, cuffMat: greenMat, shinMat: skinMat, skinMat, hairMat, shoeMat };
  }

  // Troca a roupa do personagem em tempo real (usado pelo seletor de skins do menu).
  setSkin(skin) {
    if (!SKINS.includes(skin) || skin === this.skin) return;
    this.skin = skin;
    this._buildBody();
  }

  _buildBody() {
    const group = this.group;
    while (group.children.length) group.remove(group.children[0]);

    const mats = this._skinMaterials(this.skin);
    const { jerseyMat, greenMat, skinMat, shortsMat, shinMat, cuffMat, hairMat, shoeMat } = mats;

    // ---- Quadril (mais estreito que o tronco — afunila a silhueta) ----
    const hips = new THREE.Mesh(new THREE.BoxGeometry(0.60, 0.22, 0.46), shortsMat);
    hips.position.set(0, TORSO_BOTTOM_Y - 0.02, 0);
    hips.castShadow = true;
    group.add(hips);

    // ---- Torso — mais largo nos ombros que no quadril ----
    // Também é o pai de tudo que fica "acima do quadril" (adornos, ombreiras,
    // pescoço, cabeça, cabelo e braços), assim tudo acompanha o lean/bob/yaw
    // do tronco na corrida em vez de ficar parado (o que antes parecia "tremer").
    const HALF_TORSO_H = TORSO_H / 2;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.02, TORSO_H, 0.52), jerseyMat);
    torso.position.set(0, TORSO_CENTER_Y, 0);
    torso.rotation.x = 0.12; // tronco levemente inclinado à frente na corrida
    torso.castShadow = true;
    group.add(torso);

    // Adornos específicos de cada skin (gola/faixa da seleção, ou terno+gravata+faixa presidencial)
    this._buildTorsoDecor(torso, this.skin, { greenMat, HALF_TORSO_H });

    // Ombreiras — alargam a silhueta em V e servem de ponto de fixação dos braços
    const padGeo = new THREE.BoxGeometry(0.20, 0.20, 0.36);
    const padL = new THREE.Mesh(padGeo, jerseyMat);
    padL.position.set(-SHOULDER_X, HALF_TORSO_H - 0.10, 0);
    padL.castShadow = true;
    torso.add(padL);
    const padR = padL.clone();
    padR.position.x = SHOULDER_X;
    torso.add(padR);

    // Pescoço
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, NECK_H, 10), skinMat);
    neck.position.set(0, HALF_TORSO_H + NECK_H / 2, 0);
    torso.add(neck);

    // Cabeça
    const head = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R, 16, 16), skinMat);
    head.position.y = HALF_TORSO_H + NECK_H + HEAD_R;
    head.castShadow = true;
    torso.add(head);

    // Cabelo curto grisalho — careca na coroa (thetaStart>0 pula o topo) e entradas na
    // testa (phi exclui ~115° na frente, phi=3π/2, o rosto do personagem); cobre só
    // laterais/nuca, como o corte do Bolsonaro. thetaStart/thetaLength ficam por baixo
    // do topo até a base da nuca; phiStart/phiLength cobrem os dois lados + trás.
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(HEAD_R + 0.015, 16, 10, 5.712, 4.283, 0.4, 1.6),
      hairMat
    );
    hair.position.y = head.position.y;
    hair.castShadow = true;
    torso.add(hair);

    // ---- Braços: segmento único (ombro -> mão), sem articulação de cotovelo ----
    // Pendurados no torso (não no group raiz) para acompanhar o lean/bob/yaw dele.
    const buildArm = (sign) => {
      const upper = new THREE.Group();
      upper.position.set(sign * SHOULDER_X, HALF_TORSO_H - 0.10, 0);
      const armMesh = new THREE.Mesh(pivotBoxGeo(0.22, ARM_LEN, 0.24), jerseyMat);
      armMesh.castShadow = true;
      upper.add(armMesh);

      const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.10, 0.25), cuffMat);
      cuff.position.y = -ARM_LEN + 0.07;
      upper.add(cuff);

      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), skinMat);
      hand.position.y = -ARM_LEN - 0.06;
      hand.castShadow = true;
      upper.add(hand);

      torso.add(upper);
      return { upper };
    };
    const armL = buildArm(-1);
    const armR = buildArm(1);

    // ---- Pernas: coxa (quadril) -> canela (joelho) -> tênis ----
    const buildLeg = (sign) => {
      const upper = new THREE.Group();
      upper.position.set(sign * HIP_HALF_W, HIP_Y, 0);
      const upperMesh = new THREE.Mesh(pivotBoxGeo(0.30, THIGH_LEN, 0.32), shortsMat);
      upperMesh.castShadow = true;
      upper.add(upperMesh);

      const lower = new THREE.Group();
      lower.position.set(0, -THIGH_LEN, 0);
      upper.add(lower);

      const lowerMesh = new THREE.Mesh(pivotBoxGeo(0.24, SHIN_LEN, 0.26), shinMat);
      lowerMesh.castShadow = true;
      lower.add(lowerMesh);

      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.28, SHOE_H, 0.40), shoeMat);
      shoe.position.set(0, -SHIN_LEN - SHOE_H / 2 + 0.02, 0.05);
      shoe.castShadow = true;
      lower.add(shoe);

      group.add(upper);
      return { upper, lower };
    };
    const legL = buildLeg(-1);
    const legR = buildLeg(1);

    group.userData = { legL, legR, armL, armR, torso, head, bodyMat: jerseyMat, torsoBaseY: TORSO_CENTER_Y };

    if (this.shieldMesh) group.add(this.shieldMesh); // escudo sempre por último (transparência)
    if (this.flashlightProp) {
      group.add(this.flashlightProp);
      group.add(this.flashlight);
      group.add(this.flashlight.target);
    }
  }

  // Adornos que diferenciam cada skin visualmente além da cor base.
  _buildTorsoDecor(torso, skin, { greenMat, HALF_TORSO_H }) {
    if (skin === 'selecao') {
      // Gola verde
      const collar = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.09, 0.54), greenMat);
      collar.position.set(0, HALF_TORSO_H - 0.07, 0);
      torso.add(collar);

      // Faixa verde diagonal (detalhe da camisa)
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.08, 0.54), greenMat);
      stripe.position.set(0, 0.14, 0);
      torso.add(stripe);
      return;
    }

    if (skin === 'presidente') {
      // Colarinho branco da camisa social, à mostra por cima do paletó
      const collar = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.08, 0.50), greenMat /* shirtMat */);
      collar.position.set(0, HALF_TORSO_H - 0.06, 0);
      torso.add(collar);

      // Gravata escura
      const tieMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 });
      const tie = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.55, 0.05), tieMat);
      tie.position.set(0, 0.04, 0.27);
      torso.add(tie);

      // Faixa presidencial — diagonal verde com friso amarelo, do ombro ao quadril oposto
      const sashGreenMat  = new THREE.MeshStandardMaterial({ color: 0x009c3b, roughness: 0.5 });
      const sashYellowMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.5 });
      const sashBase = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.20, 0.03), sashGreenMat);
      sashBase.position.set(0, 0, 0.27);
      sashBase.rotation.z = 0.62;
      torso.add(sashBase);
      const sashTrim = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.06, 0.031), sashYellowMat);
      sashTrim.position.set(0, 0, 0.271);
      sashTrim.rotation.z = 0.62;
      torso.add(sashTrim);
      return;
    }

    // 'presidiario' — sem adornos extras, o uniforme listrado já dá a identidade
  }

  _buildShieldVisual() {
    const geo = new THREE.SphereGeometry(1.15, 16, 16);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x4ad4ff, transparent: true, opacity: 0.28,
      emissive: 0x1c8fd6, emissiveIntensity: 0.6
    });
    this.shieldMesh = new THREE.Mesh(geo, mat);
    this.shieldMesh.position.y = 1.2;
    this.shieldMesh.visible = false;
    // não anexa ao group aqui — _buildBody() o adiciona (e readiciona a cada troca de skin)
  }

  setShield(active) {
    this.shieldActive = active;
    this.shieldMesh.visible = active;
  }

  // Lanterna que acende à noite: objeto físico (corpo + lente) preso à altura do
  // peito/mão + SpotLight de verdade em forma de cone apontando pra frente (-Z).
  // Construída uma vez e persiste através de trocas de skin, como o escudo.
  _buildFlashlight() {
    const propGroup = new THREE.Group();
    propGroup.position.set(0.34, 1.30, 0.30);
    propGroup.rotation.x = -0.15; // aponta um pouco pra frente/baixo

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.4, metalness: 0.5 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.22, 10), bodyMat);
    body.rotation.x = Math.PI / 2;
    propGroup.add(body);

    const lensMat = new THREE.MeshStandardMaterial({
      color: 0xfff6d0, emissive: 0xfff6d0, emissiveIntensity: 0, roughness: 0.3
    });
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.02, 10), lensMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.z = -0.12;
    propGroup.add(lens);

    this.flashlightProp = propGroup;
    this.flashlightLensMat = lensMat;

    // distance/angle/penumbra/decay dão o formato de cone; sem sombra (custo baixo)
    this.flashlight = new THREE.SpotLight(0xfff2c0, 0, 20, 0.46, 0.4, 1.4);
    this.flashlight.position.copy(propGroup.position);
    this.flashlight.target = new THREE.Object3D();
    this.flashlight.target.position.set(0, 0.4, -14); // à frente do personagem, mirando o chão adiante
  }

  // Liga/desliga a lanterna (chamado pelo Game conforme o ciclo dia/noite).
  setFlashlightOn(on) {
    this._flashlightOn = on;
  }

  moveLane(dir) {
    this.lane = clamp(this.lane + dir, 0, 2);
    this.targetX = CONFIG.LANES_X[this.lane];
  }

  jump(now) {
    if (this.isJumping || this.isSliding) return false;
    this.isJumping = true;
    this.jumpStartTime = now;
    return true;
  }

  slide(now) {
    if (this.isSliding || this.isJumping) return false;
    this.isSliding = true;
    this.slideStartTime = now;
    return true;
  }

  // Retorna true se sofreu impacto "de verdade" (sem escudo disponível).
  // NOTA: assinatura mudou de hit() para hit(now) — ver aviso no final da resposta.
  hit(now) {
    if (this.shieldActive) {
      this.setShield(false);
      return false;
    }
    this.invulnerable = true;
    this.invulnerableUntil = now + 600;
    return true;
  }

  update(dt, now, gameSpeedFactor) {
    const g = this.group;
    const ud = g.userData;

    // Movimento lateral suave
    g.position.x = lerp(g.position.x, this.targetX, Math.min(1, dt * 10));

    // Inclinação lateral ao trocar de faixa, proporcional à distância até o alvo
    const lateralDiff = this.targetX - g.position.x;
    const targetTilt = clamp(lateralDiff * 0.9, -0.25, 0.25);
    g.rotation.z = lerp(g.rotation.z, targetTilt, Math.min(1, dt * 8));

    // Pulo
    if (this.isJumping) {
      const t = (now - this.jumpStartTime) / CONFIG.JUMP_DURATION;
      if (t >= 1) {
        this.isJumping = false;
        g.position.y = 0;
      } else {
        g.position.y = Math.sin(Math.min(t, 1) * Math.PI) * CONFIG.JUMP_HEIGHT;
      }
    }

    // Deslize — a origem do group já está nos pés, então só a escala precisa mudar
    if (this.isSliding) {
      const t = (now - this.slideStartTime) / CONFIG.SLIDE_DURATION;
      if (t >= 1) {
        this.isSliding = false;
        g.scale.y = 1;
        this.shieldMesh.scale.y = 1;
        this.flashlightProp.scale.y = 1;
      } else {
        g.scale.y = 0.55;
        this.shieldMesh.scale.y = 1 / 0.55; // contra-escala para o escudo não achatar
        this.flashlightProp.scale.y = 1 / 0.55; // idem para a lanterna
      }
    }

    // Lanterna: acende/apaga com um fade suave (o Game liga via setFlashlightOn)
    const flashTargetI = this._flashlightOn ? 2.2 : 0;
    this.flashlight.intensity = lerp(this.flashlight.intensity, flashTargetI, Math.min(1, dt * 3));
    const lensTargetI = this._flashlightOn ? 1.4 : 0;
    this.flashlightLensMat.emissiveIntensity = lerp(this.flashlightLensMat.emissiveIntensity, lensTargetI, Math.min(1, dt * 3));

    // Invulnerabilidade por timestamp — não sobrevive a um reset como setTimeout faria
    this.invulnerable = now < this.invulnerableUntil;

    // Reseta o bob do tronco a cada frame; a corrida reaplica o valor animado abaixo
    ud.torso.position.y = ud.torsoBaseY;

    if (this.isSliding) {
      ud.armL.upper.rotation.set(0, 0, 0);
      ud.armR.upper.rotation.set(0, 0, 0);
      ud.legL.upper.rotation.set(0, 0, 0);
      ud.legR.upper.rotation.set(0, 0, 0);
      ud.legL.lower.rotation.set(0, 0, 0);
      ud.legR.lower.rotation.set(0, 0, 0);
      ud.torso.rotation.y = 0;
    } else if (this.isJumping) {
      const t = clamp((now - this.jumpStartTime) / CONFIG.JUMP_DURATION, 0, 1);
      const raise = Math.sin(t * Math.PI); // pico no ápice do pulo — braços sobem, joelhos dobram
      ud.armL.upper.rotation.x = -1.1 * raise;
      ud.armR.upper.rotation.x = -1.1 * raise;
      ud.legL.upper.rotation.x = 0.2 * raise;
      ud.legR.upper.rotation.x = 0.2 * raise;
      ud.legL.lower.rotation.x = 0.9 * raise;
      ud.legR.lower.rotation.x = 0.9 * raise;
      ud.torso.rotation.y = 0;
    } else {
      this.runPhase += dt * gameSpeedFactor * 1.0; // gameSpeedFactor é a velocidade real (14~36), não um multiplicador 0-1
      const swingL = Math.sin(this.runPhase) * 0.55;
      const swingR = -swingL;

      ud.legL.upper.rotation.x = swingL;
      ud.legR.upper.rotation.x = swingR;
      ud.armL.upper.rotation.x = -swingL;
      ud.armR.upper.rotation.x = -swingR;

      // a perna que vai para trás flexiona o joelho
      ud.legL.lower.rotation.x = Math.max(0, -swingL) * 1.2;
      ud.legR.lower.rotation.x = Math.max(0, -swingR) * 1.2;

      ud.torso.rotation.y = -swingL * 0.18; // contra-rotação leve acompanhando os braços
      ud.torso.position.y = ud.torsoBaseY + Math.sin(this.runPhase * 2) * 0.04; // bob vertical
    }

    if (this.shieldMesh.visible) {
      this.shieldMesh.rotation.y += dt * 1.5;
    }
  }

  flashDamage() {
    const mat = this.group.userData.bodyMat;
    if (this.group.userData.baseColor === undefined) {
      this.group.userData.baseColor = mat.color.getHex();
    }
    mat.color.setHex(0xff3b3b);
    if (this._flashTimer) clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => {
      mat.color.setHex(this.group.userData.baseColor);
      this._flashTimer = null;
    }, 180);
  }

  reset() {
    this.lane = 1;
    this.targetX = CONFIG.LANES_X[1];
    this.isJumping = false;
    this.isSliding = false;
    this.invulnerable = false;
    this.invulnerableUntil = 0;
    this.runPhase = 0;
    this.setShield(false);

    const g = this.group;
    g.position.set(CONFIG.LANES_X[1], 0, CONFIG.PLAYER_Z);
    g.scale.set(1, 1, 1);
    g.rotation.set(0, 0, 0);
    this.shieldMesh.scale.y = 1;
    this.flashlightProp.scale.y = 1;

    const ud = g.userData;
    ud.armL.upper.rotation.set(0, 0, 0);
    ud.armR.upper.rotation.set(0, 0, 0);
    ud.legL.upper.rotation.set(0, 0, 0);
    ud.legR.upper.rotation.set(0, 0, 0);
    ud.legL.lower.rotation.set(0, 0, 0);
    ud.legR.lower.rotation.set(0, 0, 0);
    ud.torso.rotation.y = 0;
    ud.torso.position.y = ud.torsoBaseY;

    if (this._flashTimer) { clearTimeout(this._flashTimer); this._flashTimer = null; }
    if (ud.baseColor !== undefined) ud.bodyMat.color.setHex(ud.baseColor);
  }

  get position() { return this.group.position; }
}
