import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CAR_PARK_POS,
  CYCLE_ANCHOR,
  DRINK_CATALOG,
  HELD_ITEM_LABELS,
  KID_SIT_POS,
  MAX_WATER_CAPACITY,
  MILKMAN_PARK_POS,
  RENTABLE_BUILDINGS,
  SNACKS_CART_ANCHOR,
  SNACKS_CART_PRICE_CENTS,
  SNACK_STATIONS,
  SNACK_TRAY_SPOTS,
  STATIONS,
  SUPERMARKET_AISLE_POS,
  SUPERMARKET_BOUNDS,
  SUPERMARKET_COUNTER_POS,
  SUPERMARKET_FURNITURE_POS,
  SUPERMARKET_PICKUP_POS,
  TRASH_BIN_POS,
  TRAY_SPOTS,
  WATER_TAP_POS,
  drinkToHotItem,
  formatMoney,
  heldFurnitureKind,
} from './constants.ts';
import {
  type TargetLookup,
  canPlaceFurnitureAt,
  getFacingAngleForSeat,
  getFurnitureDropSpot,
  isOwnerInsideSupermarket,
} from './engine.ts';
import type {
  CafeFurniture,
  FootpathPedestrian,
  HeldItem,
  ProjectedLabel,
  ShiftSnapshot,
  ShopBuildingId,
  TeaCustomer,
  WorldSave,
} from './types.ts';

const _projVec = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _camPos = new THREE.Vector3();

export function detectSoftwareWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

function makeAsphaltTexture(maxAniso: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#33363D';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 3200; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 42 + Math.floor(Math.random() * 26);
    ctx.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.fillStyle = '#FDE68A';
  for (let x = 20; x < 512; x += 128) {
    ctx.fillRect(x, 246, 68, 18);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function makeSidewalkTexture(maxAniso: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#CBB9A1';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#AE9A7E';
  ctx.lineWidth = 3;
  for (let x = 0; x <= 256; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }
  for (let y = 0; y <= 256; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(22, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function makeWoodTexture(maxAniso: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#9C6635';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#7C4D25';
  ctx.lineWidth = 2;
  for (let y = 16; y < 256; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function makeShopSignTexture(
  title: string,
  subtitle: string,
  accentHex: string,
  maxAniso: number
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 192;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#FFFDF9';
  ctx.fillRect(0, 0, 512, 192);

  ctx.fillStyle = accentHex;
  ctx.fillRect(0, 0, 512, 36);
  ctx.fillRect(0, 162, 512, 30);

  ctx.fillStyle = '#1B1410';
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, 256, 96);

  ctx.fillStyle = '#574336';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(subtitle, 256, 138);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

interface CharacterRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  leftHipPivot: THREE.Group;
  rightHipPivot: THREE.Group;
  leftKneePivot: THREE.Group;
  rightKneePivot: THREE.Group;
  leftShoulderPivot: THREE.Group;
  rightShoulderPivot: THREE.Group;
  heldCupGroup: THREE.Group;
  heldCupMeshes: THREE.Mesh[];
  heldTeaFill: THREE.Mesh;
  heldSugarDots: THREE.Mesh;
  heldBiscuitMesh: THREE.Group;
  heldCupcakeMesh: THREE.Group;
  heldPlateMesh: THREE.Group;
  heldSamosaMesh: THREE.Group;
  heldPakoraMesh: THREE.Group;
  carriedChairMesh: THREE.Group;
  carriedTableMesh: THREE.Group;
}

function buildWoodChairGroup(scale = 1): THREE.Group {
  const g = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x9c6635,
    roughness: 0.72,
  });
  const cushionMat = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    roughness: 0.85,
  });

  // 4 legs grounded at y = 0
  for (const [lx, lz] of [
    [-0.17, -0.17],
    [0.17, -0.17],
    [-0.17, 0.17],
    [0.17, 0.17],
  ]) {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.024, 0.44, 8),
      woodMat
    );
    leg.position.set(lx, 0.22, lz);
    leg.castShadow = true;
    g.add(leg);
  }

  // Seat base & warm cushion
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.055, 0.44), woodMat);
  seat.position.set(0, 0.45, 0);
  seat.castShadow = true;
  seat.receiveShadow = true;
  g.add(seat);

  const cushion = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.04, 0.38),
    cushionMat
  );
  cushion.position.set(0, 0.495, 0.01);
  g.add(cushion);

  // Backrest posts + curved/slatted back (placed on -Z so seated character faces +Z!)
  for (const bx of [-0.17, 0.17]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.48, 8),
      woodMat
    );
    post.position.set(bx, 0.7, -0.18);
    post.castShadow = true;
    g.add(post);
  }
  const topSlat = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.14, 0.045),
    woodMat
  );
  topSlat.position.set(0, 0.86, -0.18);
  topSlat.castShadow = true;
  g.add(topSlat);

  g.scale.setScalar(scale);
  return g;
}

function buildWoodTableGroup(scale = 1): THREE.Group {
  const g = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x854d27,
    roughness: 0.68,
  });
  const topMat = new THREE.MeshStandardMaterial({
    color: 0xb0723b,
    roughness: 0.55,
  });
  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.7,
    roughness: 0.35,
  });

  // Heavy cast-iron pedestal + wooden tabletop
  const basePlate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.36, 0.05, 14),
    ironMat
  );
  basePlate.position.y = 0.025;
  basePlate.receiveShadow = true;
  g.add(basePlate);

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.065, 0.72, 10),
    ironMat
  );
  stem.position.y = 0.4;
  stem.castShadow = true;
  g.add(stem);

  const apron = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 0.06, 0.76),
    woodMat
  );
  apron.position.y = 0.75;
  g.add(apron);

  const top = new THREE.Mesh(
    new THREE.BoxGeometry(0.92, 0.065, 0.92),
    topMat
  );
  top.position.y = 0.81;
  top.castShadow = true;
  top.receiveShadow = true;
  g.add(top);

  // Small brass tea coaster on table center
  const coaster = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.015, 12),
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.65,
      roughness: 0.3,
    })
  );
  coaster.position.y = 0.85;
  g.add(coaster);

  g.scale.setScalar(scale);
  return g;
}

function buildHeldItemVisualGroup(): {
  group: THREE.Group;
  cupMeshes: THREE.Mesh[];
  fillMesh: THREE.Mesh;
  sugarMesh: THREE.Mesh;
  biscuitMesh: THREE.Group;
  cupcakeMesh: THREE.Group;
  plateMesh: THREE.Group;
  samosaMesh: THREE.Group;
  pakoraMesh: THREE.Group;
} {
  const group = new THREE.Group();
  group.visible = false;

  const cupBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.078, 0.21, 14),
    new THREE.MeshStandardMaterial({ color: 0xfff8ed, roughness: 0.55 })
  );
  const cupSleeve = new THREE.Mesh(
    new THREE.CylinderGeometry(0.095, 0.088, 0.08, 14),
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 })
  );
  cupSleeve.position.y = -0.01;
  group.add(cupBody, cupSleeve);

  const fillMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.088, 0.088, 0.038, 12),
    new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.35 })
  );
  fillMesh.position.y = 0.088;
  group.add(fillMesh);

  const sugarMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.042, 10),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 })
  );
  sugarMesh.position.y = 0.098;
  group.add(sugarMesh);

  // Rs.20-style Tea Biscuit Pack
  const biscuitMesh = new THREE.Group();
  const packBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.17, 0.075, 0.23),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.42 })
  );
  const packBand = new THREE.Mesh(
    new THREE.BoxGeometry(0.176, 0.04, 0.1),
    new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.5 })
  );
  const packCookie = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.052, 0.025, 12),
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.78 })
  );
  packCookie.position.set(0, 0.048, 0);
  biscuitMesh.add(packBody, packBand, packCookie);
  biscuitMesh.visible = false;
  group.add(biscuitMesh);

  // Frosted Mini Cupcake
  const cupcakeMesh = new THREE.Group();
  const liner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.095, 0.068, 0.1, 14),
    new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.78 })
  );
  liner.position.y = -0.02;
  const cakeTop = new THREE.Mesh(
    new THREE.SphereGeometry(0.095, 14, 10),
    new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.75 })
  );
  cakeTop.position.y = 0.035;
  const frosting = new THREE.Mesh(
    new THREE.SphereGeometry(0.082, 14, 10),
    new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.45 })
  );
  frosting.scale.set(1.05, 0.72, 1.05);
  frosting.position.y = 0.082;
  const cherry = new THREE.Mesh(
    new THREE.SphereGeometry(0.024, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 })
  );
  cherry.position.y = 0.145;
  cupcakeMesh.add(liner, cakeTop, frosting, cherry);
  cupcakeMesh.visible = false;
  group.add(cupcakeMesh);

  // Paper Plate for Samosa & Pakora
  const plateMesh = new THREE.Group();
  const plateDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.145, 0.125, 0.024, 16),
    new THREE.MeshStandardMaterial({ color: 0xfefce8, roughness: 0.7 })
  );
  plateDisc.position.y = -0.035;
  const plateRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.138, 0.012, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.65 })
  );
  plateRim.rotation.x = Math.PI / 2;
  plateRim.position.y = -0.022;
  plateMesh.add(plateDisc, plateRim);
  plateMesh.visible = false;
  group.add(plateMesh);

  // Aloo Samosa Triangles + Mint Chutney Cup
  const samosaMesh = new THREE.Group();
  const samosaMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.65,
  });
  for (const [sx, sz, ry] of [
    [-0.042, 0.01, 0.3],
    [0.045, -0.02, -0.5],
  ]) {
    const tri = new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.105, 3), samosaMat);
    tri.position.set(sx, 0.02, sz);
    tri.rotation.y = ry;
    samosaMesh.add(tri);
  }
  const chutneyDot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.024, 0.02, 10),
    new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.5 })
  );
  chutneyDot.position.set(0.01, -0.012, 0.065);
  samosaMesh.add(chutneyDot);
  samosaMesh.visible = false;
  group.add(samosaMesh);

  // Besan Crispy Pakoras Cluster
  const pakoraMesh = new THREE.Group();
  const pakoraMat = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    roughness: 0.72,
  });
  for (const [px, py, pz, sc] of [
    [-0.045, 0.015, -0.02, 1.0],
    [0.042, 0.012, -0.03, 0.92],
    [0.0, 0.048, 0.0, 1.05],
    [-0.02, 0.01, 0.048, 0.88],
    [0.052, 0.01, 0.042, 0.85],
  ]) {
    const fritter = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.042 * sc, 0),
      pakoraMat
    );
    fritter.position.set(px, py, pz);
    pakoraMesh.add(fritter);
  }
  pakoraMesh.visible = false;
  group.add(pakoraMesh);

  return {
    group,
    cupMeshes: [cupBody, cupSleeve],
    fillMesh,
    sugarMesh,
    biscuitMesh,
    cupcakeMesh,
    plateMesh,
    samosaMesh,
    pakoraMesh,
  };
}

function applyCupContentsVisual(
  cupGroup: THREE.Group,
  cupMeshes: THREE.Mesh[],
  fillMesh: THREE.Mesh,
  sugarMesh: THREE.Mesh,
  biscuitMesh: THREE.Group,
  cupcakeMesh: THREE.Group,
  plateMesh: THREE.Group,
  samosaMesh: THREE.Group,
  pakoraMesh: THREE.Group,
  item: HeldItem
): void {
  if (!item || item === 'carried_chair' || item === 'carried_table') {
    cupGroup.visible = false;
    return;
  }
  cupGroup.visible = true;

  if (item === 'biscuit_pack') {
    cupMeshes.forEach((m) => (m.visible = false));
    fillMesh.visible = false;
    sugarMesh.visible = false;
    biscuitMesh.visible = true;
    cupcakeMesh.visible = false;
    plateMesh.visible = false;
    samosaMesh.visible = false;
    pakoraMesh.visible = false;
    return;
  }

  if (item === 'cupcake') {
    cupMeshes.forEach((m) => (m.visible = false));
    fillMesh.visible = false;
    sugarMesh.visible = false;
    biscuitMesh.visible = false;
    cupcakeMesh.visible = true;
    plateMesh.visible = false;
    samosaMesh.visible = false;
    pakoraMesh.visible = false;
    return;
  }

  if (
    item === 'paper_plate' ||
    item === 'raw_samosa' ||
    item === 'raw_pakora' ||
    item === 'hot_samosa' ||
    item === 'hot_pakora'
  ) {
    cupMeshes.forEach((m) => (m.visible = false));
    fillMesh.visible = false;
    sugarMesh.visible = false;
    biscuitMesh.visible = false;
    cupcakeMesh.visible = false;
    plateMesh.visible = true;
    const showSamosa = item === 'raw_samosa' || item === 'hot_samosa';
    const showPakora = item === 'raw_pakora' || item === 'hot_pakora';
    samosaMesh.visible = showSamosa;
    pakoraMesh.visible = showPakora;
    if (showSamosa) {
      samosaMesh.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
          if (mat.color.getHex() !== 0x16a34a) {
            mat.color.setHex(item === 'raw_samosa' ? 0xfde68a : 0xd97706);
          }
        }
      });
    }
    if (showPakora) {
      pakoraMesh.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
          mat.color.setHex(item === 'raw_pakora' ? 0xfbbf24 : 0xb45309);
        }
      });
    }
    return;
  }

  cupMeshes.forEach((m) => (m.visible = true));
  biscuitMesh.visible = false;
  cupcakeMesh.visible = false;
  plateMesh.visible = false;
  samosaMesh.visible = false;
  pakoraMesh.visible = false;

  const fillMat = fillMesh.material as THREE.MeshStandardMaterial;

  if (item === 'empty_cup') {
    fillMesh.visible = false;
    sugarMesh.visible = false;
  } else if (item === 'cup_with_tea') {
    fillMesh.visible = true;
    fillMat.color.setHex(0x3f2e21);
    sugarMesh.visible = false;
  } else if (item === 'cup_with_tea_sugar') {
    fillMesh.visible = true;
    fillMat.color.setHex(0x451a03);
    sugarMesh.visible = true;
  } else if (item === 'cup_with_tea_water') {
    fillMesh.visible = true;
    fillMat.color.setHex(0x9a5b25);
    sugarMesh.visible = true;
  } else if (item === 'cup_with_doodh_patti_mix') {
    fillMesh.visible = true;
    fillMat.color.setHex(0xf3e8d8);
    sugarMesh.visible = true;
  } else if (item === 'cup_with_coffee') {
    fillMesh.visible = true;
    fillMat.color.setHex(0x29150b);
    sugarMesh.visible = false;
  } else if (item === 'cup_with_coffee_sugar') {
    fillMesh.visible = true;
    fillMat.color.setHex(0x29150b);
    sugarMesh.visible = true;
  } else if (item === 'cup_with_coffee_water') {
    fillMesh.visible = true;
    fillMat.color.setHex(0x451a03);
    sugarMesh.visible = true;
  } else if (item === 'hot_tea') {
    fillMesh.visible = true;
    fillMat.color.setHex(0xc27838);
    sugarMesh.visible = false;
  } else if (item === 'hot_doodh_patti') {
    fillMesh.visible = true;
    fillMat.color.setHex(0xeab370);
    sugarMesh.visible = false;
  } else if (item === 'hot_coffee') {
    fillMesh.visible = true;
    fillMat.color.setHex(0x3b2114);
    sugarMesh.visible = false;
  }
}

function buildHumanRig(
  shirtHex: string,
  hairHex: string,
  isVendor: boolean,
  isOwner = false
): CharacterRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const pantsMat = new THREE.MeshStandardMaterial({
    color: isVendor ? 0x1e293b : isOwner ? 0x27272a : 0x334155,
    roughness: 0.8,
  });
  const shirtMat = new THREE.MeshStandardMaterial({
    color: isVendor ? 0xea580c : isOwner ? 0xf8fafc : shirtHex,
    roughness: 0.65,
  });
  const vestMat = new THREE.MeshStandardMaterial({
    color: 0x0f766e,
    roughness: 0.72,
  });
  const ownerApronMat = new THREE.MeshStandardMaterial({
    color: 0x15803d,
    roughness: 0.7,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xd99b66,
    roughness: 0.65,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: isVendor ? 0x451a03 : 0x18181b,
    roughness: 0.85,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: hairHex,
    roughness: 0.8,
  });

  if (isVendor) {
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.44, 24),
      new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.78,
      })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.015;
    root.add(halo);
  }

  const pelvis = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.16, 0.28),
    pantsMat
  );
  pelvis.position.set(0, 0.73, 0);
  pelvis.castShadow = true;
  bodyGroup.add(pelvis);

  const buildLeg = (offsetX: number) => {
    const hipPivot = new THREE.Group();
    hipPivot.position.set(offsetX, 0.72, 0);

    const hipSocket = new THREE.Mesh(
      new THREE.SphereGeometry(0.095, 10, 10),
      pantsMat
    );
    hipPivot.add(hipSocket);

    const thigh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.095, 0.082, 0.34, 10),
      pantsMat
    );
    thigh.position.set(0, -0.17, 0);
    thigh.castShadow = true;
    hipPivot.add(thigh);

    const kneePivot = new THREE.Group();
    kneePivot.position.set(0, -0.34, 0);
    hipPivot.add(kneePivot);

    const kneeJoint = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 10, 10),
      pantsMat
    );
    kneePivot.add(kneeJoint);

    const shin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.078, 0.068, 0.3, 10),
      pantsMat
    );
    shin.position.set(0, -0.15, 0);
    shin.castShadow = true;
    kneePivot.add(shin);

    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.09, 0.24),
      shoeMat
    );
    shoe.position.set(0, -0.335, 0.045);
    shoe.castShadow = true;
    kneePivot.add(shoe);

    bodyGroup.add(hipPivot);
    return { hipPivot, kneePivot };
  };

  const leftLeg = buildLeg(-0.125);
  const rightLeg = buildLeg(0.125);

  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.56, 0.3),
    shirtMat
  );
  torso.position.set(0, 1.06, 0);
  torso.castShadow = true;
  bodyGroup.add(torso);

  if (isVendor) {
    const vest = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.44, 0.32),
      vestMat
    );
    vest.position.set(0, 1.04, 0);
    vest.castShadow = true;
    bodyGroup.add(vest);

    const pocket = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.14, 0.04),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6 })
    );
    pocket.position.set(0.12, 1.0, 0.17);
    bodyGroup.add(pocket);
  } else if (isOwner) {
    const apron = new THREE.Mesh(
      new THREE.BoxGeometry(0.49, 0.48, 0.32),
      ownerApronMat
    );
    apron.position.set(0, 1.0, 0.01);
    apron.castShadow = true;
    bodyGroup.add(apron);

    const nameTag = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.07, 0.03),
      new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.4 })
    );
    nameTag.position.set(-0.11, 1.15, 0.17);
    bodyGroup.add(nameTag);
  }

  // Dedicated Head Group pivoted at neck base (y=1.34) for realistic sipping & idle head motion
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.34, 0);
  bodyGroup.add(headGroup);

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.095, 0.12, 10),
    skinMat
  );
  neck.position.set(0, 0.05, 0);
  headGroup.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 14), skinMat);
  head.position.set(0, 0.25, 0);
  head.castShadow = true;
  headGroup.add(head);

  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.3,
  });
  const eyeGeo = new THREE.SphereGeometry(0.03, 8, 8);
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.075, 0.27, 0.195);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.075, 0.27, 0.195);
  headGroup.add(leftEye, rightEye);

  if (isVendor) {
    const capBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.23, 0.24, 0.11, 16),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.55 })
    );
    capBase.position.set(0, 0.44, 0);
    const capBrim = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.04, 0.2),
      vestMat
    );
    capBrim.position.set(0, 0.4, 0.19);
    headGroup.add(capBase, capBrim);
  } else {
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.232, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
      hairMat
    );
    hair.position.set(0, 0.28, -0.02);
    headGroup.add(hair);

    if (isOwner) {
      const mustache = new THREE.Mesh(
        new THREE.BoxGeometry(0.13, 0.032, 0.04),
        hairMat
      );
      mustache.position.set(0, 0.19, 0.21);
      headGroup.add(mustache);
    }
  }

  const buildArm = (offsetX: number) => {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(offsetX, 1.26, 0);

    const shoulderCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 10, 10),
      shirtMat
    );
    shoulderPivot.add(shoulderCap);

    const sleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.078, 0.07, 0.24, 10),
      shirtMat
    );
    sleeve.position.set(0, -0.12, 0);
    sleeve.castShadow = true;
    shoulderPivot.add(sleeve);

    const forearm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.056, 0.24, 10),
      skinMat
    );
    forearm.position.set(0, -0.34, 0);
    forearm.castShadow = true;
    shoulderPivot.add(forearm);

    const hand = new THREE.Mesh(
      new THREE.SphereGeometry(0.062, 10, 10),
      skinMat
    );
    hand.position.set(0, -0.48, 0);
    shoulderPivot.add(hand);

    bodyGroup.add(shoulderPivot);
    return shoulderPivot;
  };

  const leftShoulderPivot = buildArm(-0.32);
  const rightShoulderPivot = buildArm(0.32);

  // Held cup/snack attached physically to the right hand so lifting hand brings it straight to mouth!
  const heldVisual = buildHeldItemVisualGroup();
  heldVisual.group.position.set(-0.04, -0.49, 0.07);
  heldVisual.group.rotation.x = Math.PI / 2;
  rightShoulderPivot.add(heldVisual.group);

  const carriedChairMesh = buildWoodChairGroup(0.68);
  carriedChairMesh.position.set(0, 0.92, 0.56);
  carriedChairMesh.visible = false;
  bodyGroup.add(carriedChairMesh);

  const carriedTableMesh = buildWoodTableGroup(0.55);
  carriedTableMesh.position.set(0, 0.92, 0.58);
  carriedTableMesh.visible = false;
  bodyGroup.add(carriedTableMesh);

  return {
    root,
    bodyGroup,
    headGroup,
    leftHipPivot: leftLeg.hipPivot,
    rightHipPivot: rightLeg.hipPivot,
    leftKneePivot: leftLeg.kneePivot,
    rightKneePivot: rightLeg.kneePivot,
    leftShoulderPivot,
    rightShoulderPivot,
    heldCupGroup: heldVisual.group,
    heldCupMeshes: heldVisual.cupMeshes,
    heldTeaFill: heldVisual.fillMesh,
    heldSugarDots: heldVisual.sugarMesh,
    heldBiscuitMesh: heldVisual.biscuitMesh,
    heldCupcakeMesh: heldVisual.cupcakeMesh,
    heldPlateMesh: heldVisual.plateMesh,
    heldSamosaMesh: heldVisual.samosaMesh,
    heldPakoraMesh: heldVisual.pakoraMesh,
    carriedChairMesh,
    carriedTableMesh,
  };
}

function animateRigPose(
  rig: CharacterRig,
  walkCycle: number,
  isMoving: boolean,
  isSitting: boolean,
  isDrinking: boolean,
  drinkPhase: number,
  idleClock: number,
  dt: number
): void {
  if (isSitting) {
    rig.leftHipPivot.rotation.x = THREE.MathUtils.damp(
      rig.leftHipPivot.rotation.x,
      -1.42,
      16,
      dt
    );
    rig.rightHipPivot.rotation.x = THREE.MathUtils.damp(
      rig.rightHipPivot.rotation.x,
      -1.42,
      16,
      dt
    );
    rig.leftKneePivot.rotation.x = THREE.MathUtils.damp(
      rig.leftKneePivot.rotation.x,
      1.42,
      16,
      dt
    );
    rig.rightKneePivot.rotation.x = THREE.MathUtils.damp(
      rig.rightKneePivot.rotation.x,
      1.42,
      16,
      dt
    );
    rig.bodyGroup.position.y = THREE.MathUtils.damp(
      rig.bodyGroup.position.y,
      -0.23,
      16,
      dt
    );
    rig.bodyGroup.rotation.z = THREE.MathUtils.damp(
      rig.bodyGroup.rotation.z,
      0,
      14,
      dt
    );
  } else if (isMoving) {
    const swing = Math.sin(walkCycle) * 0.62;
    rig.leftHipPivot.rotation.x = swing;
    rig.rightHipPivot.rotation.x = -swing;

    rig.leftKneePivot.rotation.x = Math.max(0, -Math.sin(walkCycle) * 0.68);
    rig.rightKneePivot.rotation.x = Math.max(0, Math.sin(walkCycle) * 0.68);

    rig.bodyGroup.position.y = Math.abs(Math.sin(walkCycle)) * 0.045;
    rig.bodyGroup.rotation.z = Math.cos(walkCycle) * 0.03;
  } else {
    rig.leftHipPivot.rotation.x = THREE.MathUtils.damp(
      rig.leftHipPivot.rotation.x,
      0,
      14,
      dt
    );
    rig.rightHipPivot.rotation.x = THREE.MathUtils.damp(
      rig.rightHipPivot.rotation.x,
      0,
      14,
      dt
    );
    rig.leftKneePivot.rotation.x = THREE.MathUtils.damp(
      rig.leftKneePivot.rotation.x,
      0,
      14,
      dt
    );
    rig.rightKneePivot.rotation.x = THREE.MathUtils.damp(
      rig.rightKneePivot.rotation.x,
      0,
      14,
      dt
    );
    rig.bodyGroup.position.y = THREE.MathUtils.damp(
      rig.bodyGroup.position.y,
      Math.sin(idleClock * 1.8) * 0.008,
      10,
      dt
    );
    rig.bodyGroup.rotation.z = THREE.MathUtils.damp(
      rig.bodyGroup.rotation.z,
      0,
      14,
      dt
    );
  }

  // Expressive Drinking / Eating + Natural Head Animation
  if (isDrinking) {
    const sip = (Math.sin(drinkPhase) + 1) * 0.5; // 0..1 smooth lift-and-sip rhythm
    const armLiftX = -1.25 - sip * 0.85; // lifts right hand cleanly up to mouth!
    rig.rightShoulderPivot.rotation.x = THREE.MathUtils.damp(
      rig.rightShoulderPivot.rotation.x,
      armLiftX,
      14,
      dt
    );
    rig.rightShoulderPivot.rotation.z = THREE.MathUtils.damp(
      rig.rightShoulderPivot.rotation.z,
      0.24 + sip * 0.18,
      14,
      dt
    );
    rig.rightShoulderPivot.rotation.y = THREE.MathUtils.damp(
      rig.rightShoulderPivot.rotation.y,
      -0.25,
      14,
      dt
    );
    rig.leftShoulderPivot.rotation.x = THREE.MathUtils.damp(
      rig.leftShoulderPivot.rotation.x,
      0.08,
      12,
      dt
    );

    rig.headGroup.rotation.x = THREE.MathUtils.damp(
      rig.headGroup.rotation.x,
      0.02 + sip * 0.24,
      14,
      dt
    );
    rig.headGroup.rotation.z = THREE.MathUtils.damp(
      rig.headGroup.rotation.z,
      Math.sin(drinkPhase * 0.5) * 0.06,
      12,
      dt
    );
    rig.headGroup.rotation.y = THREE.MathUtils.damp(
      rig.headGroup.rotation.y,
      0,
      12,
      dt
    );
  } else {
    rig.rightShoulderPivot.rotation.z = THREE.MathUtils.damp(
      rig.rightShoulderPivot.rotation.z,
      0,
      12,
      dt
    );
    rig.rightShoulderPivot.rotation.y = THREE.MathUtils.damp(
      rig.rightShoulderPivot.rotation.y,
      0,
      12,
      dt
    );
    rig.headGroup.rotation.x = THREE.MathUtils.damp(
      rig.headGroup.rotation.x,
      isMoving ? 0.04 : 0,
      12,
      dt
    );
    rig.headGroup.rotation.z = THREE.MathUtils.damp(
      rig.headGroup.rotation.z,
      0,
      12,
      dt
    );
    rig.headGroup.rotation.y = THREE.MathUtils.damp(
      rig.headGroup.rotation.y,
      isMoving ? 0 : Math.sin(idleClock * 1.1) * 0.14,
      8,
      dt
    );
  }
}

interface CycleVisuals {
  group: THREE.Group;
  awningGroup: THREE.Group;
  cupMeshes: THREE.Mesh[];
  coffeeJarGroup: THREE.Group;
  milkCrateGroup: THREE.Group;
  milkPacketMeshes: THREE.Mesh[];
  biscuitBoxGroup: THREE.Group;
  biscuitStockMeshes: THREE.Mesh[];
  cupcakeBoxGroup: THREE.Group;
  cupcakeStockMeshes: THREE.Group[];
  waterFillMesh: THREE.Mesh;
  trayVisuals: Array<ReturnType<typeof buildHeldItemVisualGroup>>;
  kettleGroup: THREE.Group;
  burnerFlame: THREE.Mesh;
  kettleCupMesh: THREE.Mesh;
  steamPuffs: THREE.Mesh[];
}

function buildChaiCycleGroup(
  woodTex: THREE.CanvasTexture,
  maxAniso: number
): CycleVisuals {
  const group = new THREE.Group();
  group.position.set(CYCLE_ANCHOR.x, 0, CYCLE_ANCHOR.z);

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.72,
    roughness: 0.3,
  });
  const bikePaintMat = new THREE.MeshStandardMaterial({
    color: 0xb91c1c,
    metalness: 0.35,
    roughness: 0.38,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.9,
    roughness: 0.16,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x171717,
    roughness: 0.9,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    map: woodTex,
    roughness: 0.78,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    metalness: 0.82,
    roughness: 0.24,
  });
  const cartBodyMat = new THREE.MeshStandardMaterial({
    color: 0x0f766e,
    roughness: 0.58,
  });

  // Authentic Pakistani 4-Wheel Readi (Thela) Wheels — zero bicycle parts!
  const buildReadiWheel = (wx: number, wz: number, radius: number) => {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(wx, radius, wz);

    const tire = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.062, 12, 26),
      tireMat
    );
    tire.castShadow = true;
    wheelGroup.add(tire);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(radius - 0.075, 0.025, 8, 24),
      chromeMat
    );
    wheelGroup.add(rim);

    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.14, 12),
      bikePaintMat
    );
    hub.rotation.x = Math.PI / 2;
    wheelGroup.add(hub);

    for (let s = 0; s < 8; s++) {
      const spoke = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, (radius - 0.07) * 2, 6),
        frameMat
      );
      spoke.rotation.z = (s * Math.PI) / 8;
      wheelGroup.add(spoke);
    }

    const fender = new THREE.Mesh(
      new THREE.TorusGeometry(radius + 0.085, 0.032, 8, 18, Math.PI * 0.9),
      bikePaintMat
    );
    fender.rotation.z = Math.PI * 0.05;
    wheelGroup.add(fender);

    group.add(wheelGroup);
  };

  // 4 Sturdy Spoked Cart Wheels at all four corners + steel axles
  buildReadiWheel(-3.05, -0.76, 0.36);
  buildReadiWheel(-3.05, 0.76, 0.36);
  buildReadiWheel(3.05, -0.76, 0.36);
  buildReadiWheel(3.05, 0.76, 0.36);

  for (const ax of [-3.05, 3.05]) {
    const axle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.032, 1.62, 10),
      chromeMat
    );
    axle.rotation.x = Math.PI / 2;
    axle.position.set(ax, 0.36, 0);
    group.add(axle);
  }

  // Steel under-chassis frame beams connecting all 4 wheels
  for (const bz of [-0.62, 0.62]) {
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(6.8, 0.08, 0.08),
      frameMat
    );
    beam.position.set(0, 0.48, bz);
    group.add(beam);
  }

  // Pakistani Wooden Push-Cart Handles on the right side
  for (const hz of [-0.55, 0.55]) {
    const handleArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.032, 0.62, 8),
      woodMat
    );
    handleArm.rotation.z = Math.PI / 2;
    handleArm.position.set(3.86, 0.84, hz);
    group.add(handleArm);
  }
  const pushCrossBar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 1.18, 10),
    bikePaintMat
  );
  pushCrossBar.rotation.x = Math.PI / 2;
  pushCrossBar.position.set(4.14, 0.84, 0);
  group.add(pushCrossBar);

  // Pakistani Truck-Art Teal & Gold Wooden Readi Chassis (7.4m long x 1.64m wide/deep)
  const cartCabinet = new THREE.Mesh(
    new THREE.BoxGeometry(7.16, 0.36, 1.46),
    cartBodyMat
  );
  cartCabinet.position.set(0, 0.68, 0);
  cartCabinet.castShadow = true;
  cartCabinet.receiveShadow = true;
  group.add(cartCabinet);

  // Colorful painted trim panels along front & back of Readi
  for (const tz of [-0.74, 0.74]) {
    const trimBand = new THREE.Mesh(
      new THREE.BoxGeometry(7.18, 0.08, 0.03),
      bikePaintMat
    );
    trimBand.position.set(0, 0.54, tz);
    group.add(trimBand);
  }

  const deck = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.12, 1.64), woodMat);
  deck.position.set(0, 0.88, 0);
  deck.castShadow = true;
  deck.receiveShadow = true;
  group.add(deck);

  // Brass Counter Rail around front & back edges
  for (const rz of [-0.79, 0.79]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(7.42, 0.04, 0.04),
      brassMat
    );
    rail.position.set(0, 0.95, rz);
    group.add(rail);
  }

  // Painted Readi Signboard on customer-facing (+Z) side of cart
  const cartSignTex = makeShopSignTexture(
    'CHAIWALA EXPRESS READI',
    'HOT CHAI · DOODH PATTI · BISCUITS & CUPCAKES',
    '#EA580C',
    maxAniso
  );
  const cartSignBoard = new THREE.Mesh(
    new THREE.PlaneGeometry(4.1, 0.34),
    new THREE.MeshStandardMaterial({ map: cartSignTex, roughness: 0.45 })
  );
  cartSignBoard.position.set(0, 0.7, 0.745);
  group.add(cartSignBoard);

  // Convert world station coordinates to cart-local X/Z cleanly
  const lx = (worldX: number) => worldX - CYCLE_ANCHOR.x;
  const lz = (worldZ: number) => worldZ - CYCLE_ANCHOR.z;

  // Blue Gas Cylinder beside the Kettle under the cart
  const gasCylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.48, 14),
    new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 })
  );
  gasCylinder.position.set(lx(STATIONS.kettle.x), 0.3, -0.88);
  gasCylinder.castShadow = true;
  group.add(gasCylinder);

  // Canopy Frame & Striped Awning + Warm Decorative Bulbs covering full wider deck
  const postMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    roughness: 0.78,
  });
  for (const [px, pz] of [
    [-3.55, -0.7],
    [-3.55, 0.7],
    [3.55, -0.7],
    [3.55, 0.7],
  ]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.032, 1.52, 8),
      postMat
    );
    post.position.set(px, 1.66, pz);
    post.castShadow = true;
    group.add(post);
  }

  // Auto-Hiding Striped Awning Canopy (hides when player works at stall so items & player stay 100% clear!)
  const awningGroup = new THREE.Group();
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(7.36, 0.09, 1.82),
    new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.65 })
  );
  roof.position.set(0, 2.42, 0);
  roof.castShadow = true;
  awningGroup.add(roof);

  for (let s = 0; s < 6; s++) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.11, 1.84),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.65 })
    );
    stripe.position.set(-2.75 + s * 1.1, 2.43, 0);
    awningGroup.add(stripe);
  }

  // Warm String Bulbs along canopy front
  const bulbGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfacc15,
    emissiveIntensity: 1.5,
  });
  for (let b = 0; b < 7; b++) {
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.048, 8, 8),
      bulbGlowMat
    );
    bulb.position.set(-3.0 + b * 1.0, 2.34, 0.89);
    awningGroup.add(bulb);
  }
  group.add(awningGroup);

  // 4 Integrated Free Space Mats across the ENTIRE lower/front side of the wooden deck!
  const trayVisuals: Array<ReturnType<typeof buildHeldItemVisualGroup>> = [];
  for (const spot of TRAY_SPOTS) {
    const trayLocalX = lx(spot.x);
    const trayLocalZ = lz(spot.z);

    const trayRim = new THREE.Mesh(
      new THREE.BoxGeometry(0.92, 0.014, 0.56),
      brassMat
    );
    trayRim.position.set(trayLocalX, 0.944, trayLocalZ);
    group.add(trayRim);

    const trayInlay = new THREE.Mesh(
      new THREE.BoxGeometry(0.84, 0.018, 0.48),
      new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.45 })
    );
    trayInlay.position.set(trayLocalX, 0.947, trayLocalZ);
    trayInlay.receiveShadow = true;
    group.add(trayInlay);

    const trayVis = buildHeldItemVisualGroup();
    trayVis.group.position.set(trayLocalX, 1.06, trayLocalZ);
    group.add(trayVis.group);
    trayVisuals.push(trayVis);
  }

  // Cupcake Display Box (STATIONS.cupcake_box)
  const cupcakeBoxX = lx(STATIONS.cupcake_box.x);
  const cupcakeBoxZ = lz(STATIONS.cupcake_box.z);
  const cupcakeBoxGroup = new THREE.Group();
  cupcakeBoxGroup.position.set(cupcakeBoxX, 1.04, cupcakeBoxZ);
  const cupcakeBoxBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.54, 0.16, 0.52),
    new THREE.MeshStandardMaterial({ color: 0xfda4af, roughness: 0.65 })
  );
  cupcakeBoxBase.castShadow = true;
  const cupcakeGlass = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.18, 0.5),
    new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.35,
      roughness: 0.15,
    })
  );
  cupcakeGlass.position.y = 0.16;
  cupcakeBoxGroup.add(cupcakeBoxBase, cupcakeGlass);

  const cupcakeStockMeshes: THREE.Group[] = [];
  for (let i = 0; i < 6; i++) {
    const cg = new THREE.Group();
    const liner = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.04, 0.07, 10),
      new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.75 })
    );
    const frost = new THREE.Mesh(
      new THREE.SphereGeometry(0.056, 10, 8),
      new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0xf472b6 : 0xfbbf24,
        roughness: 0.45,
      })
    );
    frost.position.y = 0.045;
    cg.add(liner, frost);
    cg.position.set(
      -0.15 + (i % 3) * 0.15,
      0.11,
      i < 3 ? -0.1 : 0.1
    );
    cupcakeBoxGroup.add(cg);
    cupcakeStockMeshes.push(cg);
  }
  group.add(cupcakeBoxGroup);

  // Biscuit Box (STATIONS.biscuit_box)
  const biscuitBoxX = lx(STATIONS.biscuit_box.x);
  const biscuitBoxZ = lz(STATIONS.biscuit_box.z);
  const biscuitBoxGroup = new THREE.Group();
  biscuitBoxGroup.position.set(biscuitBoxX, 1.02, biscuitBoxZ);
  const biscuitTray = new THREE.Mesh(
    new THREE.BoxGeometry(0.54, 0.14, 0.52),
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 })
  );
  biscuitTray.castShadow = true;
  biscuitBoxGroup.add(biscuitTray);

  const biscuitStockMeshes: THREE.Mesh[] = [];
  const biscuitGeo = new THREE.BoxGeometry(0.13, 0.09, 0.18);
  const biscuitMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.45,
  });
  for (let i = 0; i < 6; i++) {
    const bm = new THREE.Mesh(biscuitGeo, biscuitMat);
    bm.position.set(-0.15 + (i % 3) * 0.15, 0.1, i < 3 ? -0.1 : 0.1);
    biscuitBoxGroup.add(bm);
    biscuitStockMeshes.push(bm);
  }
  group.add(biscuitBoxGroup);

  // Cup Basket (STATIONS.cups)
  const cupsX = lx(STATIONS.cups.x);
  const cupsZ = lz(STATIONS.cups.z);
  const basket = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.24, 0.54),
    new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.85 })
  );
  basket.position.set(cupsX, 0.94, cupsZ);
  basket.castShadow = true;
  group.add(basket);

  const cupMeshes: THREE.Mesh[] = [];
  const cupGeo = new THREE.CylinderGeometry(0.065, 0.05, 0.14, 10);
  const cupMat = new THREE.MeshStandardMaterial({
    color: 0xfffdf9,
    roughness: 0.55,
  });
  for (let i = 0; i < 20; i++) {
    const stackIdx = Math.floor(i / 10);
    const heightIdx = i % 10;
    const cm = new THREE.Mesh(cupGeo, cupMat);
    cm.position.set(
      cupsX + (stackIdx === 0 ? -0.11 : 0.11),
      1.04 + heightIdx * 0.036,
      cupsZ
    );
    group.add(cm);
    cupMeshes.push(cm);
  }

  // Tea Leaves Tin (STATIONS.tea_tin)
  const teaX = lx(STATIONS.tea_tin.x);
  const teaZ = lz(STATIONS.tea_tin.z);
  const teaTin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.34, 16),
    new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.45,
      metalness: 0.25,
    })
  );
  teaTin.position.set(teaX, 1.1, teaZ);
  teaTin.castShadow = true;
  group.add(teaTin);

  const teaLid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.17, 0.05, 16),
    brassMat
  );
  teaLid.position.set(teaX, 1.28, teaZ);
  group.add(teaLid);

  // Coffee Beans Jar (STATIONS.coffee_jar)
  const coffeeX = lx(STATIONS.coffee_jar.x);
  const coffeeZ = lz(STATIONS.coffee_jar.z);
  const coffeeJarGroup = new THREE.Group();
  coffeeJarGroup.position.set(coffeeX, 1.08, coffeeZ);
  const coffeeJar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.145, 0.145, 0.3, 16),
    new THREE.MeshStandardMaterial({
      color: 0x451a03,
      roughness: 0.4,
      metalness: 0.2,
    })
  );
  coffeeJar.castShadow = true;
  const coffeeLid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.155, 0.155, 0.05, 16),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.45 })
  );
  coffeeLid.position.y = 0.16;
  coffeeJarGroup.add(coffeeJar, coffeeLid);
  group.add(coffeeJarGroup);

  // Sugar Jar (STATIONS.sugar_jar)
  const sugarX = lx(STATIONS.sugar_jar.x);
  const sugarZ = lz(STATIONS.sugar_jar.z);
  const sugarJar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.155, 0.155, 0.3, 16),
    new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.72,
      roughness: 0.15,
    })
  );
  sugarJar.position.set(sugarX, 1.08, sugarZ);
  group.add(sugarJar);

  const sugarInside = new THREE.Mesh(
    new THREE.CylinderGeometry(0.125, 0.125, 0.18, 12),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 })
  );
  sugarInside.position.set(sugarX, 1.02, sugarZ);
  group.add(sugarInside);

  // Cycle Water Jug (STATIONS.water_jug)
  const waterX = lx(STATIONS.water_jug.x);
  const waterZ = lz(STATIONS.water_jug.z);
  const waterShell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.17, 0.38, 16),
    new THREE.MeshStandardMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.45,
      roughness: 0.12,
    })
  );
  waterShell.position.set(waterX, 1.12, waterZ);
  group.add(waterShell);

  const waterFillMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.145, 0.145, 0.32, 14),
    new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.85,
      roughness: 0.18,
    })
  );
  waterFillMesh.position.set(waterX, 0.94, waterZ);
  group.add(waterFillMesh);

  const waterCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.11, 0.06, 12),
    new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.5 })
  );
  waterCap.position.set(waterX, 1.33, waterZ);
  group.add(waterCap);

  // Milk Packets Crate (STATIONS.milk_crate)
  const milkX = lx(STATIONS.milk_crate.x);
  const milkZ = lz(STATIONS.milk_crate.z);
  const milkCrateGroup = new THREE.Group();
  milkCrateGroup.position.set(milkX, 1.04, milkZ);
  const crateBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.2, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.7 })
  );
  crateBox.castShadow = true;
  milkCrateGroup.add(crateBox);

  const milkPacketMeshes: THREE.Mesh[] = [];
  const packetGeo = new THREE.BoxGeometry(0.11, 0.16, 0.08);
  const packetMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.4,
  });
  for (let i = 0; i < 4; i++) {
    const pm = new THREE.Mesh(packetGeo, packetMat);
    pm.position.set(i % 2 === 0 ? -0.09 : 0.09, 0.12, i < 2 ? -0.09 : 0.09);
    milkCrateGroup.add(pm);
    milkPacketMeshes.push(pm);
  }
  group.add(milkCrateGroup);

  // Kettle Stove (STATIONS.kettle)
  const kettleX = lx(STATIONS.kettle.x);
  const kettleZ = lz(STATIONS.kettle.z);
  const stoveBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.14, 0.48),
    frameMat
  );
  stoveBase.position.set(kettleX, 1.0, kettleZ);
  group.add(stoveBase);

  const burnerFlame = new THREE.Mesh(
    new THREE.TorusGeometry(0.15, 0.03, 8, 18),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 2.2,
    })
  );
  burnerFlame.rotation.x = Math.PI / 2;
  burnerFlame.position.set(kettleX, 1.08, kettleZ);
  burnerFlame.visible = false;
  group.add(burnerFlame);

  const kettleGroup = new THREE.Group();
  kettleGroup.position.set(kettleX, 1.1, kettleZ);

  const kettleBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.19, 0.3, 16),
    brassMat
  );
  kettleBody.position.y = 0.15;
  kettleBody.castShadow = true;
  kettleGroup.add(kettleBody);

  const kettleLid = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 12, 8),
    brassMat
  );
  kettleLid.position.y = 0.3;
  kettleGroup.add(kettleLid);

  const spout = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.045, 0.22, 8),
    brassMat
  );
  spout.position.set(0.18, 0.22, 0);
  spout.rotation.z = -0.65;
  kettleGroup.add(spout);

  const kettleHandle = new THREE.Mesh(
    new THREE.TorusGeometry(0.15, 0.02, 8, 16, Math.PI),
    frameMat
  );
  kettleHandle.position.y = 0.28;
  kettleGroup.add(kettleHandle);
  group.add(kettleGroup);

  const kettleCupMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.06, 0.16, 12),
    new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.4 })
  );
  kettleCupMesh.position.set(kettleX + 0.3, 1.04, kettleZ + 0.15);
  kettleCupMesh.visible = false;
  group.add(kettleCupMesh);

  const steamPuffs: THREE.Mesh[] = [];
  const steamMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.65,
    roughness: 1,
  });
  for (let i = 0; i < 4; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), steamMat);
    puff.position.set(kettleX, 1.5 + i * 0.2, kettleZ);
    puff.visible = false;
    group.add(puff);
    steamPuffs.push(puff);
  }

  return {
    group,
    awningGroup,
    cupMeshes,
    coffeeJarGroup,
    milkCrateGroup,
    milkPacketMeshes,
    biscuitBoxGroup,
    biscuitStockMeshes,
    cupcakeBoxGroup,
    cupcakeStockMeshes,
    waterFillMesh,
    trayVisuals,
    kettleGroup,
    burnerFlame,
    kettleCupMesh,
    steamPuffs,
  };
}

interface SnacksCartVisuals {
  group: THREE.Group;
  plotSignGroup: THREE.Group;
  awningGroup: THREE.Group;
  samosaStockMeshes: THREE.Mesh[];
  pakoraStockMeshes: THREE.Mesh[];
  burnerFlame: THREE.Mesh;
  kadhaiFoodMesh: THREE.Mesh;
  steamPuffs: THREE.Mesh[];
  trayVisuals: Array<ReturnType<typeof buildHeldItemVisualGroup>>;
}

function buildSnacksCartGroup(
  woodTex: THREE.CanvasTexture,
  maxAniso: number
): SnacksCartVisuals {
  const group = new THREE.Group();
  group.position.set(SNACKS_CART_ANCHOR.x, 0, SNACKS_CART_ANCHOR.z);

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.72,
    roughness: 0.3,
  });
  const redPaintMat = new THREE.MeshStandardMaterial({
    color: 0xb91c1c,
    roughness: 0.42,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.9,
    roughness: 0.16,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x171717,
    roughness: 0.9,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    map: woodTex,
    roughness: 0.78,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.75,
    roughness: 0.25,
  });

  // 4 Spoked Readi Wheels + Axles + Left Push Handles
  for (const [wx, wz] of [
    [-2.0, -0.76],
    [-2.0, 0.76],
    [2.0, -0.76],
    [2.0, 0.76],
  ]) {
    const wg = new THREE.Group();
    wg.position.set(wx, 0.36, wz);
    const tire = new THREE.Mesh(
      new THREE.TorusGeometry(0.36, 0.06, 12, 24),
      tireMat
    );
    tire.castShadow = true;
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.285, 0.024, 8, 22),
      chromeMat
    );
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.14, 10),
      redPaintMat
    );
    hub.rotation.x = Math.PI / 2;
    wg.add(tire, rim, hub);
    for (let s = 0; s < 8; s++) {
      const sp = new THREE.Mesh(
        new THREE.CylinderGeometry(0.011, 0.011, 0.56, 6),
        frameMat
      );
      sp.rotation.z = (s * Math.PI) / 8;
      wg.add(sp);
    }
    group.add(wg);
  }

  for (const ax of [-2.0, 2.0]) {
    const axle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 1.6, 10),
      chromeMat
    );
    axle.rotation.x = Math.PI / 2;
    axle.position.set(ax, 0.36, 0);
    group.add(axle);
  }

  for (const hz of [-0.52, 0.52]) {
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.52, 8),
      woodMat
    );
    arm.rotation.z = Math.PI / 2;
    arm.position.set(-2.58, 0.84, hz);
    group.add(arm);
  }
  const pushBar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.034, 0.034, 1.12, 10),
    redPaintMat
  );
  pushBar.rotation.x = Math.PI / 2;
  pushBar.position.set(-2.82, 0.84, 0);
  group.add(pushBar);

  // Crimson & Gold 2nd Readi Body (4.8m x 1.64m)
  const cabinet = new THREE.Mesh(
    new THREE.BoxGeometry(4.6, 0.36, 1.46),
    redPaintMat
  );
  cabinet.position.set(0, 0.68, 0);
  cabinet.castShadow = true;
  cabinet.receiveShadow = true;
  group.add(cabinet);

  const deck = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.12, 1.64), woodMat);
  deck.position.set(0, 0.88, 0);
  deck.castShadow = true;
  deck.receiveShadow = true;
  group.add(deck);

  for (const rz of [-0.79, 0.79]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(4.82, 0.04, 0.04),
      brassMat
    );
    rail.position.set(0, 0.95, rz);
    group.add(rail);
  }

  const signTex = makeShopSignTexture(
    'GARAM SAMOSA & PAKORA',
    'ALOO SAMOSA $0.80 · CRISPY PAKORA $0.70',
    '#B91C1C',
    maxAniso
  );
  const signBoard = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 0.34),
    new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.45 })
  );
  signBoard.position.set(0, 0.7, 0.745);
  group.add(signBoard);

  // Canopy posts + auto-hiding striped roof
  for (const [px, pz] of [
    [-2.25, -0.7],
    [-2.25, 0.7],
    [2.25, -0.7],
    [2.25, 0.7],
  ]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.032, 1.52, 8),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.78 })
    );
    post.position.set(px, 1.66, pz);
    post.castShadow = true;
    group.add(post);
  }

  const awningGroup = new THREE.Group();
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(4.86, 0.09, 1.82),
    redPaintMat
  );
  roof.position.set(0, 2.42, 0);
  roof.castShadow = true;
  awningGroup.add(roof);
  for (let s = 0; s < 4; s++) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.11, 1.84),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.65 })
    );
    stripe.position.set(-1.65 + s * 1.1, 2.43, 0);
    awningGroup.add(stripe);
  }
  group.add(awningGroup);

  const lx = (wx: number) => wx - SNACKS_CART_ANCHOR.x;
  const lz = (wz: number) => wz - SNACKS_CART_ANCHOR.z;

  // Gas Cylinder under Kadhai
  const cyl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.48, 14),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 })
  );
  cyl.position.set(lx(SNACK_STATIONS.kadhai.x), 0.3, -0.88);
  group.add(cyl);

  // 1. Hot Oil Kadhai Fryer
  const kx = lx(SNACK_STATIONS.kadhai.x);
  const kz = lz(SNACK_STATIONS.kadhai.z);
  const fryerBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.14, 0.62),
    frameMat
  );
  fryerBase.position.set(kx, 1.0, kz);
  group.add(fryerBase);

  const burnerFlame = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.032, 8, 18),
    new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 2.4,
    })
  );
  burnerFlame.rotation.x = Math.PI / 2;
  burnerFlame.position.set(kx, 1.08, kz);
  burnerFlame.visible = false;
  group.add(burnerFlame);

  const kadhaiRim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.29, 0.17, 0.19, 18),
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.78,
      roughness: 0.32,
    })
  );
  kadhaiRim.position.set(kx, 1.18, kz);
  kadhaiRim.castShadow = true;
  group.add(kadhaiRim);

  const hotOil = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.25, 0.03, 16),
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.15,
      metalness: 0.2,
    })
  );
  hotOil.position.set(kx, 1.26, kz);
  group.add(hotOil);

  const kadhaiFoodMesh = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.11, 0),
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6 })
  );
  kadhaiFoodMesh.position.set(kx, 1.3, kz);
  kadhaiFoodMesh.visible = false;
  group.add(kadhaiFoodMesh);

  const steamPuffs: THREE.Mesh[] = [];
  const steamMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.6,
    roughness: 1,
  });
  for (let i = 0; i < 3; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), steamMat);
    puff.position.set(kx, 1.45 + i * 0.2, kz);
    puff.visible = false;
    group.add(puff);
    steamPuffs.push(puff);
  }

  // 2. Aloo Samosa Raw Pastry Tray
  const sx = lx(SNACK_STATIONS.samosa_prep.x);
  const sz = lz(SNACK_STATIONS.samosa_prep.z);
  const samosaTray = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.08, 0.5),
    chromeMat
  );
  samosaTray.position.set(sx, 0.98, sz);
  group.add(samosaTray);
  const samosaStockMeshes: THREE.Mesh[] = [];
  const rawSamosaMat = new THREE.MeshStandardMaterial({
    color: 0xfde68a,
    roughness: 0.7,
  });
  for (let i = 0; i < 6; i++) {
    const sm = new THREE.Mesh(
      new THREE.ConeGeometry(0.072, 0.11, 3),
      rawSamosaMat
    );
    sm.position.set(
      sx - 0.16 + (i % 3) * 0.16,
      1.07,
      sz + (i < 3 ? -0.1 : 0.1)
    );
    sm.rotation.y = i * 0.6;
    group.add(sm);
    samosaStockMeshes.push(sm);
  }

  // 3. Besan Pakora Batter Bowl
  const px = lx(SNACK_STATIONS.pakora_prep.x);
  const pz = lz(SNACK_STATIONS.pakora_prep.z);
  const pakoraBowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.17, 0.22, 16),
    chromeMat
  );
  pakoraBowl.position.set(px, 1.05, pz);
  group.add(pakoraBowl);
  const pakoraStockMeshes: THREE.Mesh[] = [];
  const batterMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.8,
  });
  for (let i = 0; i < 4; i++) {
    const pm = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.075, 0),
      batterMat
    );
    pm.position.set(
      px + (i % 2 === 0 ? -0.07 : 0.07),
      1.15,
      pz + (i < 2 ? -0.07 : 0.07)
    );
    group.add(pm);
    pakoraStockMeshes.push(pm);
  }

  // 4. Serving Paper Plates Stack
  const plx = lx(SNACK_STATIONS.snack_plates.x);
  const plz = lz(SNACK_STATIONS.snack_plates.z);
  const plateMat = new THREE.MeshStandardMaterial({
    color: 0xfefce8,
    roughness: 0.65,
  });
  for (let i = 0; i < 6; i++) {
    const pl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.16, 0.025, 16),
      plateMat
    );
    pl.position.set(plx, 0.96 + i * 0.028, plz);
    group.add(pl);
  }

  // 5. Two Showcase Free-Space Trays for Auto-Pickup!
  const trayVisuals: Array<ReturnType<typeof buildHeldItemVisualGroup>> = [];
  for (const spot of SNACK_TRAY_SPOTS) {
    const tx = lx(spot.x);
    const tz = lz(spot.z);
    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.016, 0.56),
      brassMat
    );
    rim.position.set(tx, 0.944, tz);
    const inlay = new THREE.Mesh(
      new THREE.BoxGeometry(0.86, 0.02, 0.48),
      new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.45 })
    );
    inlay.position.set(tx, 0.948, tz);
    group.add(rim, inlay);

    const tv = buildHeldItemVisualGroup();
    tv.group.position.set(tx, 1.06, tz);
    group.add(tv.group);
    trayVisuals.push(tv);
  }

  // Reserved Plot Marker Signboard (shown BEFORE player buys 2nd Readi)
  const plotSignGroup = new THREE.Group();
  plotSignGroup.position.set(SNACKS_CART_ANCHOR.x, 0.11, SNACKS_CART_ANCHOR.z);
  const outline = new THREE.Mesh(
    new THREE.BoxGeometry(4.6, 0.025, 1.6),
    new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      transparent: true,
      opacity: 0.35,
      roughness: 0.85,
    })
  );
  outline.position.y = 0.015;
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.065, 1.35, 8),
    woodMat
  );
  post.position.y = 0.68;
  post.castShadow = true;
  const plotTex = makeShopSignTexture(
    '2ND READI SPACE',
    `SAMOSA & PAKORA · ${formatMoney(SNACKS_CART_PRICE_CENTS)}`,
    '#B91C1C',
    maxAniso
  );
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(1.75, 0.68, 0.08),
    [
      woodMat,
      woodMat,
      woodMat,
      woodMat,
      new THREE.MeshStandardMaterial({ map: plotTex, roughness: 0.45 }),
      woodMat,
    ]
  );
  board.position.y = 1.35;
  board.castShadow = true;
  plotSignGroup.add(outline, post, board);

  return {
    group,
    plotSignGroup,
    awningGroup,
    samosaStockMeshes,
    pakoraStockMeshes,
    burnerFlame,
    kadhaiFoodMesh,
    steamPuffs,
    trayVisuals,
  };
}

interface RentableBuildingVisuals {
  id: ShopBuildingId;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  roofGroup: THREE.Group;
  rentedBanner: THREE.Mesh;
  ownerRig: CharacterRig;
}

function buildRentableBuildings(
  scene: THREE.Scene,
  maxAniso: number
): RentableBuildingVisuals[] {
  const results: RentableBuildingVisuals[] = [];
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xfbf7ef,
    roughness: 0.64,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x854d27,
    roughness: 0.72,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.45,
    roughness: 0.38,
  });
  const glowStripMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.0,
  });

  for (const b of RENTABLE_BUILDINGS) {
    const group = new THREE.Group();
    const { minX, maxX, minZ, maxZ } = b.bounds;
    const w = maxX - minX;
    const d = maxZ - minZ;
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;

    const wallMat = new THREE.MeshStandardMaterial({
      color: b.wallHex,
      roughness: 0.84,
    });
    const awningMat = new THREE.MeshStandardMaterial({
      color: b.awningHex,
      roughness: 0.62,
    });

    // Walk-In Interior Floor & Threshold Welcome Mat
    const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), floorMat);
    floor.position.set(cx, 0.115, cz);
    floor.receiveShadow = true;
    group.add(floor);

    const doorCenter = (b.doorMinX + b.doorMaxX) / 2;
    const doorWidth = b.doorMaxX - b.doorMinX;
    const mat = new THREE.Mesh(
      new THREE.BoxGeometry(doorWidth - 0.15, 0.025, 0.65),
      awningMat
    );
    mat.position.set(doorCenter, 0.138, maxZ + 0.08);
    group.add(mat);

    // Back Wall, Left Wall, Right Wall
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(w, 3.0, 0.24),
      wallMat
    );
    backWall.position.set(cx, 1.61, minZ);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    group.add(backWall);

    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 3.0, d),
      wallMat
    );
    leftWall.position.set(minX, 1.61, cz);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    group.add(leftWall);

    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 3.0, d),
      wallMat
    );
    rightWall.position.set(maxX, 1.61, cz);
    rightWall.castShadow = true;
    rightWall.receiveShadow = true;
    group.add(rightWall);

    // Front Side Walls Leaving Wide Open Walk-In Doorway
    const leftFrontW = b.doorMinX - minX;
    if (leftFrontW > 0.2) {
      const lfw = new THREE.Mesh(
        new THREE.BoxGeometry(leftFrontW, 3.0, 0.24),
        wallMat
      );
      lfw.position.set(minX + leftFrontW / 2, 1.61, maxZ);
      lfw.castShadow = true;
      group.add(lfw);
    }
    const rightFrontW = maxX - b.doorMaxX;
    if (rightFrontW > 0.2) {
      const rfw = new THREE.Mesh(
        new THREE.BoxGeometry(rightFrontW, 3.0, 0.24),
        wallMat
      );
      rfw.position.set(b.doorMaxX + rightFrontW / 2, 1.61, maxZ);
      rfw.castShadow = true;
      group.add(rfw);
    }

    // Doorframe Pillars + Warm Interior Glow Bar
    for (const px of [b.doorMinX, b.doorMaxX]) {
      const pillar = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 3.0, 0.26),
        trimMat
      );
      pillar.position.set(px, 1.61, maxZ);
      group.add(pillar);
    }

    const glowBar = new THREE.Mesh(
      new THREE.BoxGeometry(w - 0.8, 0.1, 0.16),
      glowStripMat
    );
    glowBar.position.set(cx, 2.9, minZ + 0.28);
    group.add(glowBar);

    const accentHex = `#${b.awningHex.toString(16).padStart(6, '0')}`;
    const signTex = makeShopSignTexture(
      b.shopName.toUpperCase(),
      `OWNER: ${b.ownerName.toUpperCase()} · ${formatMoney(b.weeklyRentCents)}/WK`,
      accentHex,
      maxAniso
    );
    const innerSign = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.min(4.8, w - 0.9), 0.92),
      new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.42 })
    );
    innerSign.position.set(cx, 2.34, minZ + 0.16);
    group.add(innerSign);

    // Interior Owner Desk / Counter + Ledger Book
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.86, 0.66),
      woodMat
    );
    counter.position.set(b.counterPos.x, 0.54, b.counterPos.z);
    counter.castShadow = true;
    counter.receiveShadow = true;
    group.add(counter);

    const ledger = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.07, 0.26),
      new THREE.MeshStandardMaterial({ color: b.awningHex, roughness: 0.5 })
    );
    ledger.position.set(b.counterPos.x + 0.35, 1.0, b.counterPos.z + 0.06);
    ledger.rotation.y = -0.2;
    group.add(ledger);

    // Auto-Hiding Roof + Front Awning + Roof Signboard
    const roofGroup = new THREE.Group();
    const roofDeck = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.35, 0.2, d + 0.35),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.72 })
    );
    roofDeck.position.set(cx, 3.18, cz);
    roofDeck.castShadow = true;
    roofGroup.add(roofDeck);

    const frontAwning = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.2, 0.15, 0.95),
      awningMat
    );
    frontAwning.position.set(cx, 2.74, maxZ + 0.42);
    frontAwning.rotation.x = 0.22;
    frontAwning.castShadow = true;
    roofGroup.add(frontAwning);

    const roofSign = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.min(5.2, w - 0.6), 1.05),
      new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.42 })
    );
    roofSign.position.set(cx, 3.76, maxZ + 0.15);
    roofGroup.add(roofSign);

    group.add(roofGroup);

    // "RENTED SHOP" gold plaque visible on front counter when leased by player
    const rentedTex = makeShopSignTexture(
      'RENTED BY YOU',
      'WEEKLY SHOP LEASE ACTIVE',
      '#15803D',
      maxAniso
    );
    const rentedBanner = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.44),
      new THREE.MeshStandardMaterial({ map: rentedTex, roughness: 0.4 })
    );
    rentedBanner.position.set(b.counterPos.x, 0.58, b.counterPos.z + 0.34);
    rentedBanner.visible = false;
    group.add(rentedBanner);

    // Owner NPC standing inside behind counter
    const ownerRig = buildHumanRig(b.ownerShirtHex, '#1C1917', false, true);
    ownerRig.root.position.set(b.ownerPos.x, 0.135, b.ownerPos.z);
    ownerRig.root.rotation.y = 0;
    scene.add(ownerRig.root);

    scene.add(group);
    results.push({
      id: b.id,
      bounds: b.bounds,
      roofGroup,
      rentedBanner,
      ownerRig,
    });
  }

  return results;
}

interface SupermarketVisuals {
  group: THREE.Group;
  pickupCrate: THREE.Mesh;
  roofGroup: THREE.Group;
}

function buildOpenSupermarket(maxAniso: number): SupermarketVisuals {
  const group = new THREE.Group();
  const minX = SUPERMARKET_BOUNDS.minX;
  const maxX = SUPERMARKET_BOUNDS.maxX;
  const minZ = SUPERMARKET_BOUNDS.minZ;
  const maxZ = SUPERMARKET_BOUNDS.maxZ;
  const w = maxX - minX; // 8.4m
  const d = maxZ - minZ; // 5.0m
  const cx = (minX + maxX) / 2; // 8.6
  const cz = (minZ + maxZ) / 2; // -6.3

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xfaf5ec,
    roughness: 0.62,
  });
  const borderMat = new THREE.MeshStandardMaterial({
    color: 0x0f766e,
    roughness: 0.65,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xeadbc8,
    roughness: 0.82,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.55,
    roughness: 0.35,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x854d27,
    roughness: 0.75,
  });
  const glowStripMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.9,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xbae6fd,
    transparent: true,
    opacity: 0.35,
    roughness: 0.15,
    metalness: 0.25,
  });

  // 1. Bright Clean Interior Floor & Threshold Welcome Mat (open doorway!)
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), floorMat);
  floor.position.set(cx, 0.115, cz);
  floor.receiveShadow = true;
  group.add(floor);

  const thresholdStrip = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.02, 0.16),
    borderMat
  );
  thresholdStrip.position.set(cx, 0.135, maxZ);
  group.add(thresholdStrip);

  const welcomeMat = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.025, 0.72),
    borderMat
  );
  welcomeMat.position.set(6.7, 0.138, maxZ + 0.12);
  group.add(welcomeMat);

  // 2. Back Wall + Side Walls + Corner Front Pillars
  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(w, 3.05, 0.26),
    wallMat
  );
  backWall.position.set(cx, 1.64, minZ);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  group.add(backWall);

  const signTex = makeShopSignTexture(
    'CHAI SUPERMARKET',
    'TEA · BISCUITS · CUPCAKES · CHAIRS & TABLES',
    '#15803D',
    maxAniso
  );

  // Interior Back-Wall Signboard (remains visible even when roof hides!)
  const innerSignBoard = new THREE.Mesh(
    new THREE.PlaneGeometry(5.6, 1.05),
    new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.42 })
  );
  innerSignBoard.position.set(cx, 2.38, minZ + 0.16);
  group.add(innerSignBoard);

  // Right Wall
  const rightRearWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 3.05, d * 0.52),
    wallMat
  );
  rightRearWall.position.set(maxX, 1.64, minZ + d * 0.26);
  rightRearWall.castShadow = true;
  rightRearWall.receiveShadow = true;
  group.add(rightRearWall);

  const rightFrontLowWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.85, d * 0.48),
    wallMat
  );
  rightFrontLowWall.position.set(maxX, 0.54, maxZ - d * 0.24);
  const rightFrontGlass = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 1.85, d * 0.48),
    glassMat
  );
  rightFrontGlass.position.set(maxX, 1.9, maxZ - d * 0.24);
  group.add(rightFrontLowWall, rightFrontGlass);

  // Left Wall rear half (leaves wide doorway facing Water Tap & sidewalk)
  const leftRearWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 3.05, 2.4),
    wallMat
  );
  leftRearWall.position.set(minX, 1.64, minZ + 1.2);
  leftRearWall.castShadow = true;
  group.add(leftRearWall);

  // Front Entrance Pillars supporting roof
  for (const bx of [minX + 0.14, maxX - 0.14]) {
    const pillar = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 3.05, 0.26),
      trimMat
    );
    pillar.position.set(bx, 1.64, maxZ);
    pillar.castShadow = true;
    group.add(pillar);
  }

  // Warm Interior Glow Strip & Light
  const backLight = new THREE.Mesh(
    new THREE.BoxGeometry(w - 0.8, 0.1, 0.18),
    glowStripMat
  );
  backLight.position.set(cx, 2.95, minZ + 0.32);
  group.add(backLight);

  const interiorLight = new THREE.PointLight(0xfff3d6, 1.7, 12);
  interiorLight.position.set(cx, 2.75, cz + 0.2);
  group.add(interiorLight);

  // 3. Auto-Hiding Supermarket Roof Group (visible outside, hidden the moment player walks inside!)
  const roofGroup = new THREE.Group();
  const roofDeck = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.4, 0.2, d + 0.35),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.72 })
  );
  roofDeck.position.set(cx, 3.24, cz);
  roofDeck.castShadow = true;
  roofDeck.receiveShadow = true;
  roofGroup.add(roofDeck);

  const gableCap = new THREE.Mesh(
    new THREE.BoxGeometry(w - 0.5, 0.34, d - 0.6),
    new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.65 })
  );
  gableCap.position.set(cx, 3.48, cz);
  roofGroup.add(gableCap);

  const frontAwning = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.3, 0.16, 1.05),
    new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.6 })
  );
  frontAwning.position.set(cx, 2.78, maxZ + 0.42);
  frontAwning.rotation.x = 0.22;
  frontAwning.castShadow = true;
  roofGroup.add(frontAwning);

  const roofSignBoard = new THREE.Mesh(
    new THREE.PlaneGeometry(6.6, 1.25),
    new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.42 })
  );
  roofSignBoard.position.set(cx, 3.92, maxZ + 0.15);
  roofGroup.add(roofSignBoard);

  group.add(roofGroup);

  // 4. Checkout Counter + Register + Recipe Book inside Supermarket
  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.88, 0.7),
    woodMat
  );
  counter.position.set(
    SUPERMARKET_COUNTER_POS.x,
    0.56,
    SUPERMARKET_COUNTER_POS.z
  );
  counter.castShadow = true;
  counter.receiveShadow = true;
  group.add(counter);

  const register = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.3, 0.34),
    trimMat
  );
  register.position.set(
    SUPERMARKET_COUNTER_POS.x + 0.55,
    1.15,
    SUPERMARKET_COUNTER_POS.z
  );
  const recipeBook = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.08, 0.28),
    new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.45 })
  );
  recipeBook.position.set(
    SUPERMARKET_COUNTER_POS.x - 0.45,
    1.04,
    SUPERMARKET_COUNTER_POS.z + 0.05
  );
  recipeBook.rotation.y = 0.22;
  group.add(register, recipeBook);

  // 5. Low Stocked Grocery Aisle Gondola (Tea, Sugar, Coffee Beans, Biscuits, Cupcakes & Cups)
  const gondola = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.96, 0.74),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.65 })
  );
  gondola.position.set(
    SUPERMARKET_AISLE_POS.x,
    0.6,
    SUPERMARKET_AISLE_POS.z
  );
  gondola.castShadow = true;
  group.add(gondola);

  const teaMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.5 });
  const sugarMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.8 });
  const biscuitMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45 });
  const cupcakeBoxMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.5 });
  const cupMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.5 });

  for (let i = 0; i < 6; i++) {
    const px = SUPERMARKET_AISLE_POS.x - 1.12 + i * 0.44;
    const itemBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.3, 0.28),
      i % 4 === 0
        ? teaMat
        : i % 4 === 1
          ? sugarMat
          : i % 4 === 2
            ? biscuitMat
            : cupcakeBoxMat
    );
    itemBox.position.set(px, 1.24, SUPERMARKET_AISLE_POS.z - 0.15);
    const cupSleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.085, 0.32, 10),
      cupMat
    );
    cupSleeve.position.set(px, 1.24, SUPERMARKET_AISLE_POS.z + 0.18);
    group.add(itemBox, cupSleeve);
  }

  // 6. Furniture Display Rug with Sample Table & Chair inside Supermarket
  const displayRug = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 0.02, 1.55),
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.9 })
  );
  displayRug.position.set(
    SUPERMARKET_FURNITURE_POS.x,
    0.145,
    SUPERMARKET_FURNITURE_POS.z
  );
  group.add(displayRug);

  const sampleTable = buildWoodTableGroup(0.82);
  sampleTable.position.set(
    SUPERMARKET_FURNITURE_POS.x - 0.25,
    0.15,
    SUPERMARKET_FURNITURE_POS.z
  );
  const sampleChair = buildWoodChairGroup(0.85);
  sampleChair.position.set(
    SUPERMARKET_FURNITURE_POS.x + 0.52,
    0.15,
    SUPERMARKET_FURNITURE_POS.z
  );
  sampleChair.rotation.y = -Math.PI / 2;
  group.add(sampleTable, sampleChair);

  // 7. Supermarket Furniture Pickup Crate Pad at Entrance
  const pickupPad = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.03, 0.9),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.7 })
  );
  pickupPad.position.set(
    SUPERMARKET_PICKUP_POS.x,
    0.145,
    SUPERMARKET_PICKUP_POS.z
  );
  group.add(pickupPad);

  const pickupCrate = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.52, 0.58),
    woodMat
  );
  pickupCrate.position.set(
    SUPERMARKET_PICKUP_POS.x,
    0.42,
    SUPERMARKET_PICKUP_POS.z
  );
  pickupCrate.castShadow = true;
  pickupCrate.visible = false;
  group.add(pickupCrate);

  return { group, pickupCrate, roofGroup };
}

function buildWaterTapGroup(): THREE.Group {
  const group = new THREE.Group();
  group.position.set(WATER_TAP_POS.x, 0.11, WATER_TAP_POS.z);

  const stoneBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 0.18, 0.85),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85 })
  );
  stoneBase.position.y = 0.09;
  stoneBase.receiveShadow = true;
  group.add(stoneBase);

  const drum = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.92, 16),
    new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35 })
  );
  drum.position.set(0, 0.64, -0.08);
  drum.castShadow = true;
  group.add(drum);

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.22, 0.08, 14),
    new THREE.MeshStandardMaterial({ color: 0x0c4a6e, roughness: 0.5 })
  );
  cap.position.set(0, 1.13, -0.08);
  group.add(cap);

  const pipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.26, 8),
    new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.85,
      roughness: 0.2,
    })
  );
  pipe.rotation.x = Math.PI / 2;
  pipe.position.set(0, 0.62, 0.24);
  group.add(pipe);

  const bucket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.12, 0.24, 12),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.5 })
  );
  bucket.position.set(0, 0.3, 0.26);
  group.add(bucket);

  return group;
}

function buildTrashBinGroup(): THREE.Group {
  const group = new THREE.Group();
  group.position.set(TRASH_BIN_POS.x, 0.11, TRASH_BIN_POS.z);

  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.06, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85 })
  );
  pad.position.y = 0.03;
  pad.receiveShadow = true;
  group.add(pad);

  const binBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.2, 0.62, 16),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.68 })
  );
  binBody.position.y = 0.36;
  binBody.castShadow = true;
  group.add(binBody);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.25, 0.035, 8, 18),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4 })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.67;
  group.add(rim);

  const hood = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.25, 0.14, 16, 1, false, 0, Math.PI * 1.4),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 })
  );
  hood.position.set(0, 0.74, -0.02);
  hood.rotation.y = Math.PI * 0.8;
  group.add(hood);

  return group;
}

interface CarVisuals {
  group: THREE.Group;
  bodyMat: THREE.MeshStandardMaterial;
  wheels: THREE.Mesh[];
}

function buildCustomerCarGroup(): CarVisuals {
  const group = new THREE.Group();
  group.position.set(24, 0, CAR_PARK_POS.z);
  group.visible = false;

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.28,
    metalness: 0.45,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.15,
    metalness: 0.5,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.9,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xd4d4d8,
    metalness: 0.85,
    roughness: 0.25,
  });

  const lowerBody = new THREE.Mesh(
    new THREE.BoxGeometry(3.45, 0.58, 1.56),
    bodyMat
  );
  lowerBody.position.set(0, 0.56, 0);
  lowerBody.castShadow = true;
  lowerBody.receiveShadow = true;
  group.add(lowerBody);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.85, 0.52, 1.38),
    bodyMat
  );
  cabin.position.set(0.15, 1.08, 0);
  cabin.castShadow = true;
  group.add(cabin);

  const frontGlass = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.38, 1.24),
    glassMat
  );
  frontGlass.position.set(0.15, 1.08, 0);
  group.add(frontGlass);

  const sideGlass = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.36, 1.42),
    glassMat
  );
  sideGlass.position.set(0.15, 1.08, 0);
  group.add(sideGlass);

  const driverHead = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xd99b66, roughness: 0.65 })
  );
  driverHead.position.set(-0.1, 1.06, -0.32);
  group.add(driverHead);

  const headMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfacc15,
    emissiveIntensity: 1.5,
  });
  for (const lz of [-0.52, 0.52]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.24), headMat);
    hl.position.set(-1.74, 0.58, lz);
    group.add(hl);
  }

  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0x991b1b,
    emissiveIntensity: 1.0,
  });
  for (const lz of [-0.52, 0.52]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.24), tailMat);
    tl.position.set(1.74, 0.58, lz);
    group.add(tl);
  }

  const wheels: THREE.Mesh[] = [];
  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16);
  wheelGeo.rotateX(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.24, 12);
  rimGeo.rotateX(Math.PI / 2);

  for (const [wx, wz] of [
    [-1.08, -0.78],
    [-1.08, 0.78],
    [1.08, -0.78],
    [1.08, 0.78],
  ]) {
    const w = new THREE.Mesh(wheelGeo, tireMat);
    w.position.set(wx, 0.32, wz);
    w.castShadow = true;
    const r = new THREE.Mesh(rimGeo, rimMat);
    w.add(r);
    group.add(w);
    wheels.push(w);
  }

  return { group, bodyMat, wheels };
}

interface MilkmanVisuals {
  group: THREE.Group;
  wheels: THREE.Mesh[];
}

function buildMilkmanBikeGroup(): MilkmanVisuals {
  const group = new THREE.Group();
  group.position.set(-24, 0, MILKMAN_PARK_POS.z);
  group.visible = false;

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x0369a1,
    metalness: 0.55,
    roughness: 0.35,
  });
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.85,
    roughness: 0.25,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x171717,
    roughness: 0.9,
  });

  const wheels: THREE.Mesh[] = [];
  for (const wx of [0.78, -0.78]) {
    const w = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.08, 10, 20),
      tireMat
    );
    w.position.set(wx, 0.34, 0);
    w.castShadow = true;
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.14, 10),
      metalMat
    );
    hub.rotation.x = Math.PI / 2;
    w.add(hub);
    group.add(w);
    wheels.push(w);
  }

  const engine = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.34, 0.32),
    new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.7,
      roughness: 0.35,
    })
  );
  engine.position.set(0, 0.48, 0);
  group.add(engine);

  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.22, 0.32), frameMat);
  tank.position.set(0.26, 0.82, 0);
  tank.castShadow = true;
  group.add(tank);

  const seat = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.12, 0.28),
    new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.8 })
  );
  seat.position.set(-0.28, 0.78, 0);
  group.add(seat);

  const fork = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.76, 8),
    metalMat
  );
  fork.position.set(0.64, 0.68, 0);
  fork.rotation.z = 0.28;
  group.add(fork);

  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 0.62, 8),
    metalMat
  );
  handle.rotation.x = Math.PI / 2;
  handle.position.set(0.52, 1.02, 0);
  group.add(handle);

  const headlamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 10, 10),
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfacc15,
      emissiveIntensity: 1.5,
    })
  );
  headlamp.position.set(0.75, 0.86, 0);
  group.add(headlamp);

  const rearRack = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.08, 0.76),
    metalMat
  );
  rearRack.position.set(-0.74, 0.74, 0);
  group.add(rearRack);

  for (const cz of [-0.3, 0.3]) {
    const can = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.16, 0.48, 14),
      metalMat
    );
    can.position.set(-0.72, 0.72, cz);
    can.castShadow = true;
    const canNeck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.14, 0.12, 12),
      metalMat
    );
    canNeck.position.set(-0.72, 1.0, cz);
    group.add(can, canNeck);
  }

  const milkBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.3, 0.4),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 })
  );
  milkBox.position.set(-0.76, 0.94, 0);
  milkBox.castShadow = true;
  group.add(milkBox);

  const rider = buildHumanRig('#0284C7', '#1C1917', false);
  rider.root.position.set(-0.18, 0.15, 0);
  rider.root.rotation.y = Math.PI / 2;
  rider.leftHipPivot.rotation.x = -0.6;
  rider.rightHipPivot.rotation.x = -0.6;
  rider.leftKneePivot.rotation.x = 0.85;
  rider.rightKneePivot.rotation.x = 0.85;
  rider.leftShoulderPivot.rotation.x = -0.85;
  rider.rightShoulderPivot.rotation.x = -0.85;

  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.245, 14, 12),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 })
  );
  helmet.position.set(0, 1.62, 0);
  rider.bodyGroup.add(helmet);

  group.add(rider.root);

  return { group, wheels };
}

function buildStreetEnvironment(scene: THREE.Scene, maxAniso: number): void {
  const asphaltTex = makeAsphaltTexture(maxAniso);
  asphaltTex.repeat.set(22, 1);
  const sidewalkTex = makeSidewalkTexture(maxAniso);
  sidewalkTex.repeat.set(30, 4);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(180, 180),
    new THREE.MeshStandardMaterial({ color: 0x7c9a63, roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  scene.add(ground);

  const road = new THREE.Mesh(
    new THREE.BoxGeometry(120, 0.04, 6.6),
    new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.88 })
  );
  road.position.set(0, 0, 5.0);
  road.receiveShadow = true;
  scene.add(road);

  const sidewalk = new THREE.Mesh(
    new THREE.BoxGeometry(120, 0.14, 11.4),
    new THREE.MeshStandardMaterial({ map: sidewalkTex, roughness: 0.85 })
  );
  sidewalk.position.set(0, 0.04, -3.95);
  sidewalk.receiveShadow = true;
  scene.add(sidewalk);

  const curb = new THREE.Mesh(
    new THREE.BoxGeometry(120, 0.17, 0.28),
    new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.9 })
  );
  curb.position.set(0, 0.06, 1.85);
  curb.receiveShadow = true;
  scene.add(curb);

  const lampPostMat = new THREE.MeshStandardMaterial({
    color: 0x27272a,
    metalness: 0.6,
    roughness: 0.4,
  });
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.4,
  });
  for (const lx of [-15.2, -7.8, 13.2, 20.2]) {
    const lamp = new THREE.Group();
    lamp.position.set(lx, 0.11, 1.25);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 3.6, 8),
      lampPostMat
    );
    pole.position.y = 1.8;
    pole.castShadow = true;
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.1, 0.75),
      lampPostMat
    );
    arm.position.set(0, 3.55, 0.35);
    const lantern = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 10, 10),
      bulbMat
    );
    lantern.position.set(0, 3.42, 0.65);
    lamp.add(pole, arm, lantern);
    scene.add(lamp);
  }

  const treeCoords = [
    [-18.0, 1.0],
    [-7.5, 1.0],
    [13.3, 1.0],
    [21.2, 1.0],
    [-18, 9.5],
    [-7, 9.8],
    [4, 9.6],
    [15, 9.5],
  ];
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 1.8, 8);
  trunkGeo.translate(0, 0.9, 0);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x6b4423,
    roughness: 0.92,
  });
  const trunks = new THREE.InstancedMesh(
    trunkGeo,
    trunkMat,
    treeCoords.length
  );
  trunks.castShadow = true;

  const crownGeo = new THREE.IcosahedronGeometry(1.15, 1);
  const crownMat = new THREE.MeshStandardMaterial({
    color: 0x4d7c0f,
    roughness: 0.82,
  });
  const crowns = new THREE.InstancedMesh(
    crownGeo,
    crownMat,
    treeCoords.length
  );
  crowns.castShadow = true;

  const dummy = new THREE.Object3D();
  const colorVar = new THREE.Color();
  treeCoords.forEach(([tx, tz], i) => {
    const scale = 0.88 + (i % 3) * 0.14;
    dummy.position.set(tx, 0, tz);
    dummy.scale.set(scale, scale, scale);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);

    dummy.position.set(tx, 2.2 * scale, tz);
    dummy.scale.set(scale, scale * 1.1, scale);
    dummy.updateMatrix();
    crowns.setMatrixAt(i, dummy.matrix);

    colorVar.setHex(i % 2 === 0 ? 0x4d7c0f : 0x65a30d);
    crowns.setColorAt(i, colorVar);
  });
  trunks.computeBoundingSphere();
  crowns.computeBoundingSphere();
  scene.add(trunks, crowns);
}

function buildHelperMatGroup(): THREE.Group {
  const g = new THREE.Group();
  g.position.set(KID_SIT_POS.x, 0.11, KID_SIT_POS.z);

  const mat = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 0.03, 0.78),
    new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.92 })
  );
  mat.position.y = 0.015;
  mat.receiveShadow = true;
  g.add(mat);

  const tinBowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.1, 0.08, 12),
    new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.7,
      roughness: 0.35,
    })
  );
  tinBowl.position.set(0.05, 0.06, 0.32);
  g.add(tinBowl);

  return g;
}

export class Chai3DSceneController {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  public readonly isSoftwareGl: boolean;

  private playerRig: CharacterRig;
  private ownerRig: CharacterRig;
  private helperRig: CharacterRig;
  private helperMatGroup: THREE.Group;
  private cycleVisuals: CycleVisuals;
  private snacksCartVisuals: SnacksCartVisuals;
  private supermarketVisuals: SupermarketVisuals;
  private rentableBuildingVisuals: RentableBuildingVisuals[];
  private carVisuals: CarVisuals;
  private milkmanVisuals: MilkmanVisuals;
  private targetRing: THREE.Mesh;
  private placementGhostRing: THREE.Mesh;
  private customerRigs = new Map<string, CharacterRig>();
  private pedestrianRigs = new Map<string, { rig: CharacterRig; bag: THREE.Mesh }>();
  private furnitureMeshes = new Map<string, THREE.Group>();

  private frameId = 0;
  private disposed = false;
  private resizeObserver: ResizeObserver;

  constructor(container: HTMLElement) {
    this.container = container;
    this.isSoftwareGl = detectSoftwareWebGL();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf6d8ae);
    this.scene.fog = new THREE.Fog(0xf6d8ae, 34, 78);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.2, 130);
    this.camera.position.set(0.5, 8.1, 10.8);
    this.camera.lookAt(0, 0.8, 0.0);

    const hemi = new THREE.HemisphereLight(0xbae6fd, 0x8b6f4e, 0.9);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff1d0, 2.1);
    sun.position.set(10, 16, 9);
    sun.castShadow = !this.isSoftwareGl;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 52;
    sun.shadow.camera.left = -24;
    sun.shadow.camera.right = 24;
    sun.shadow.camera.top = 16;
    sun.shadow.camera.bottom = -16;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);

    const rimLight = new THREE.DirectionalLight(0xfdba74, 0.55);
    rimLight.position.set(-10, 8, -10);
    this.scene.add(rimLight);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    buildStreetEnvironment(this.scene, maxAniso);

    const woodTex = makeWoodTexture(maxAniso);

    this.cycleVisuals = buildChaiCycleGroup(woodTex, maxAniso);
    this.scene.add(this.cycleVisuals.group);

    this.snacksCartVisuals = buildSnacksCartGroup(woodTex, maxAniso);
    this.scene.add(this.snacksCartVisuals.group);
    this.scene.add(this.snacksCartVisuals.plotSignGroup);

    // Open Walk-In Supermarket + All Open Rentable Buildings + Water Tap + Trash Bin
    this.supermarketVisuals = buildOpenSupermarket(maxAniso);
    this.scene.add(this.supermarketVisuals.group);
    this.rentableBuildingVisuals = buildRentableBuildings(this.scene, maxAniso);
    this.scene.add(buildWaterTapGroup());
    this.scene.add(buildTrashBinGroup());

    this.carVisuals = buildCustomerCarGroup();
    this.scene.add(this.carVisuals.group);

    this.milkmanVisuals = buildMilkmanBikeGroup();
    this.scene.add(this.milkmanVisuals.group);

    this.playerRig = buildHumanRig('#EA580C', '#1C1917', true);
    this.scene.add(this.playerRig.root);

    this.ownerRig = buildHumanRig('#0F766E', '#1C1917', false, true);
    this.scene.add(this.ownerRig.root);

    this.helperMatGroup = buildHelperMatGroup();
    this.scene.add(this.helperMatGroup);
    this.helperRig = buildHumanRig('#78716C', '#1C1917', false);
    this.helperRig.root.scale.setScalar(0.68);
    this.scene.add(this.helperRig.root);

    this.targetRing = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 0.62, 24),
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
      })
    );
    this.targetRing.rotation.x = -Math.PI / 2;
    this.targetRing.position.y = 0.13;
    this.targetRing.visible = false;
    this.scene.add(this.targetRing);

    this.placementGhostRing = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.48, 20),
      new THREE.MeshBasicMaterial({
        color: 0x22c55e,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      })
    );
    this.placementGhostRing.rotation.x = -Math.PI / 2;
    this.placementGhostRing.position.y = 0.14;
    this.placementGhostRing.visible = false;
    this.scene.add(this.placementGhostRing);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);
    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
    });
  }

  private handleResize(): void {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private updateHeldVisual(rig: CharacterRig, holding: HeldItem): void {
    const furnKind = heldFurnitureKind(holding);
    rig.carriedChairMesh.visible = furnKind === 'chair';
    rig.carriedTableMesh.visible = furnKind === 'table';

    applyCupContentsVisual(
      rig.heldCupGroup,
      rig.heldCupMeshes,
      rig.heldTeaFill,
      rig.heldSugarDots,
      rig.heldBiscuitMesh,
      rig.heldCupcakeMesh,
      rig.heldPlateMesh,
      rig.heldSamosaMesh,
      rig.heldPakoraMesh,
      holding
    );
    if (holding) {
      rig.leftShoulderPivot.rotation.x = furnKind ? -1.05 : 0.08;
      rig.rightShoulderPivot.rotation.x = furnKind ? -1.05 : -0.92;
      if (furnKind) {
        rig.leftShoulderPivot.rotation.x = -1.05;
      }
    }
  }

  private syncPlacedFurniture(furniture: CafeFurniture[]): void {
    const activeIds = new Set(furniture.map((f) => f.id));
    for (const [id, mesh] of this.furnitureMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(mesh);
        mesh.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const m = child as THREE.Mesh;
            m.geometry?.dispose();
            if (Array.isArray(m.material)) {
              m.material.forEach((mat) => mat.dispose());
            } else {
              m.material?.dispose();
            }
          }
        });
        this.furnitureMeshes.delete(id);
      }
    }

    for (const f of furniture) {
      let mesh = this.furnitureMeshes.get(f.id);
      if (!mesh) {
        mesh =
          f.kind === 'chair'
            ? buildWoodChairGroup(1)
            : buildWoodTableGroup(1);
        this.scene.add(mesh);
        this.furnitureMeshes.set(f.id, mesh);
      }
      mesh.position.set(f.x, 0.11, f.z);
      mesh.rotation.y = f.rotationY;
    }
  }

  private syncCustomerRigs(
    customers: TeaCustomer[],
    furniture: CafeFurniture[],
    elapsedSec: number,
    dt: number
  ): void {
    const activeIds = new Set(customers.map((c) => c.id));
    for (const [id, rig] of this.customerRigs.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(rig.root);
        this.customerRigs.delete(id);
      }
    }

    for (const c of customers) {
      let rig = this.customerRigs.get(c.id);
      if (!rig) {
        rig = buildHumanRig(c.shirtColor, c.hairColor, false);
        this.scene.add(rig.root);
        this.customerRigs.set(c.id, rig);
      }
      rig.root.position.set(c.x, 0.11, c.z);

      const isWalking = c.status === 'walking_in' || c.status === 'walking_out';
      const seatedChair = c.seatedChairId
        ? furniture.find((f) => f.id === c.seatedChairId)
        : null;
      const isSitting = !isWalking && Boolean(seatedChair);
      const isDrinking = c.status === 'drinking';

      if (isWalking) {
        const destX =
          c.status === 'walking_in'
            ? c.targetX
            : c.seq % 2 === 0
              ? -12.5
              : 13.5;
        const destZ = c.status === 'walking_in' ? c.targetZ : 0.95;
        rig.root.rotation.y =
          typeof c.yaw === 'number'
            ? c.yaw
            : Math.atan2(destX - c.x, destZ - c.z);
        animateRigPose(
          rig,
          c.walkCycle,
          true,
          false,
          false,
          0,
          elapsedSec + c.seq,
          dt
        );
        const armSwing = Math.sin(c.walkCycle) * 0.5;
        rig.leftShoulderPivot.rotation.x = -armSwing;
        rig.rightShoulderPivot.rotation.x = armSwing;
        rig.heldCupGroup.visible = false;
      } else {
        if (seatedChair) {
          rig.root.rotation.y = getFacingAngleForSeat(seatedChair, furniture);
        } else {
          rig.root.rotation.y = Math.atan2(
            CYCLE_ANCHOR.x - c.x,
            CYCLE_ANCHOR.z - c.z
          );
        }

        if (isDrinking) {
          const item = drinkToHotItem(c.orderDrink);
          applyCupContentsVisual(
            rig.heldCupGroup,
            rig.heldCupMeshes,
            rig.heldTeaFill,
            rig.heldSugarDots,
            rig.heldBiscuitMesh,
            rig.heldCupcakeMesh,
            rig.heldPlateMesh,
            rig.heldSamosaMesh,
            rig.heldPakoraMesh,
            item
          );
        } else {
          rig.heldCupGroup.visible = false;
          rig.leftShoulderPivot.rotation.x = THREE.MathUtils.damp(
            rig.leftShoulderPivot.rotation.x,
            0,
            12,
            dt
          );
          rig.rightShoulderPivot.rotation.x = THREE.MathUtils.damp(
            rig.rightShoulderPivot.rotation.x,
            0,
            12,
            dt
          );
        }

        animateRigPose(
          rig,
          c.walkCycle,
          false,
          isSitting,
          isDrinking,
          elapsedSec * 3.6 + c.seq * 0.9,
          elapsedSec + c.seq,
          dt
        );
      }
    }
  }

  private syncPedestrianRigs(
    pedestrians: FootpathPedestrian[],
    elapsedSec: number,
    dt: number
  ): void {
    const activeIds = new Set(pedestrians.map((p) => p.id));
    for (const [id, entry] of this.pedestrianRigs.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(entry.rig.root);
        this.pedestrianRigs.delete(id);
      }
    }

    for (const ped of pedestrians) {
      let entry = this.pedestrianRigs.get(ped.id);
      if (!entry) {
        const rig = buildHumanRig(ped.shirtColor, ped.hairColor, false);
        const bag = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 0.22, 0.16),
          new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.78 })
        );
        bag.position.set(0, -0.55, 0.04);
        bag.visible = ped.hasBag;
        rig.leftShoulderPivot.add(bag);
        this.scene.add(rig.root);
        entry = { rig, bag };
        this.pedestrianRigs.set(ped.id, entry);
      }

      const { rig } = entry;
      rig.root.position.set(ped.x, 0.11, ped.z);
      rig.root.rotation.y = ped.yaw;
      rig.heldCupGroup.visible = false;

      animateRigPose(
        rig,
        ped.walkCycle,
        true,
        false,
        false,
        0,
        elapsedSec + ped.seq,
        dt
      );
      const armSwing = Math.sin(ped.walkCycle) * 0.45;
      rig.leftShoulderPivot.rotation.x = ped.hasBag ? -armSwing * 0.35 : -armSwing;
      rig.rightShoulderPivot.rotation.x = armSwing;
    }
  }

  public syncAndRender(
    shift: ShiftSnapshot,
    world: WorldSave,
    target: TargetLookup | null,
    dt: number,
    elapsedSec: number
  ): ProjectedLabel[] {
    // 1. Player transform, sitting pose & articulated animation
    const p = shift.player;
    const isOnRoad = p.z > 1.85;
    const isInSupermarket =
      p.x >= SUPERMARKET_BOUNDS.minX - 0.1 &&
      p.x <= SUPERMARKET_BOUNDS.maxX + 0.1 &&
      p.z >= SUPERMARKET_BOUNDS.minZ - 0.1 &&
      p.z <= SUPERMARKET_BOUNDS.maxZ + 0.25;

    let isInAnyShop = isInSupermarket;
    for (const rb of this.rentableBuildingVisuals) {
      const insideBuilding =
        p.x >= rb.bounds.minX - 0.1 &&
        p.x <= rb.bounds.maxX + 0.1 &&
        p.z >= rb.bounds.minZ - 0.1 &&
        p.z <= rb.bounds.maxZ + 0.25;
      rb.roofGroup.visible = !insideBuilding;
      rb.rentedBanner.visible = world.rentedShops.some(
        (r) => r.buildingId === rb.id
      );
      animateRigPose(
        rb.ownerRig,
        0,
        false,
        false,
        false,
        0,
        elapsedSec + rb.bounds.minX,
        dt
      );
      if (insideBuilding) isInAnyShop = true;
    }

    const baseGroundY = isOnRoad ? 0.02 : isInAnyShop ? 0.135 : 0.11;
    const isPlayerSitting = Boolean(p.sittingChairId);

    // Auto-hide Supermarket Roof & Readi Awnings when player stands close!
    this.supermarketVisuals.roofGroup.visible = !isInSupermarket;
    const isWorkingAtStall =
      p.x >= CYCLE_ANCHOR.x - 4.4 &&
      p.x <= CYCLE_ANCHOR.x + 4.4 &&
      p.z >= CYCLE_ANCHOR.z - 2.7 &&
      p.z <= CYCLE_ANCHOR.z + 2.5;
    this.cycleVisuals.awningGroup.visible = !isWorkingAtStall;

    const isWorkingAtSnacks =
      world.hasSnacksCart &&
      p.x >= SNACKS_CART_ANCHOR.x - 3.2 &&
      p.x <= SNACKS_CART_ANCHOR.x + 3.2 &&
      p.z >= SNACKS_CART_ANCHOR.z - 2.7 &&
      p.z <= SNACKS_CART_ANCHOR.z + 2.5;
    this.snacksCartVisuals.awningGroup.visible = !isWorkingAtSnacks;

    this.playerRig.root.position.set(p.x, baseGroundY, p.z);
    this.playerRig.root.rotation.y = p.yaw;

    animateRigPose(
      this.playerRig,
      p.walkCycle,
      p.isMoving && !isPlayerSitting,
      isPlayerSitting,
      false,
      0,
      elapsedSec,
      dt
    );
    if (!p.holding) {
      if (p.isMoving && !isPlayerSitting) {
        const armSwing = Math.sin(p.walkCycle) * 0.55;
        this.playerRig.leftShoulderPivot.rotation.x = -armSwing;
        this.playerRig.rightShoulderPivot.rotation.x = armSwing;
      } else {
        this.playerRig.leftShoulderPivot.rotation.x = THREE.MathUtils.damp(
          this.playerRig.leftShoulderPivot.rotation.x,
          0,
          14,
          dt
        );
        this.playerRig.rightShoulderPivot.rotation.x = THREE.MathUtils.damp(
          this.playerRig.rightShoulderPivot.rotation.x,
          0,
          14,
          dt
        );
      }
    }
    this.updateHeldVisual(this.playerRig, p.holding);

    // 1b. Dynamic Supermarket Owner NPC
    const owner = shift.supermarketOwner;
    const isOwnerInside =
      owner.x >= SUPERMARKET_BOUNDS.minX - 0.1 &&
      owner.x <= SUPERMARKET_BOUNDS.maxX + 0.1 &&
      owner.z >= SUPERMARKET_BOUNDS.minZ - 0.1 &&
      owner.z <= SUPERMARKET_BOUNDS.maxZ + 0.2;
    const ownerGroundY = isOwnerInside ? 0.135 : 0.11;
    const isOwnerDrinking = owner.phase === 'drinking_chai';
    const isOwnerMoving =
      owner.phase === 'walking_to_stall' ||
      owner.phase === 'returning_to_store' ||
      ((owner.phase === 'patrol_inside' || owner.phase === 'stroll_outside') &&
        Math.hypot(owner.targetX - owner.x, owner.targetZ - owner.z) > 0.16);

    this.ownerRig.root.position.set(owner.x, ownerGroundY, owner.z);
    this.ownerRig.root.rotation.y = owner.yaw;

    if (isOwnerDrinking) {
      applyCupContentsVisual(
        this.ownerRig.heldCupGroup,
        this.ownerRig.heldCupMeshes,
        this.ownerRig.heldTeaFill,
        this.ownerRig.heldSugarDots,
        this.ownerRig.heldBiscuitMesh,
        this.ownerRig.heldCupcakeMesh,
        this.ownerRig.heldPlateMesh,
        this.ownerRig.heldSamosaMesh,
        this.ownerRig.heldPakoraMesh,
        drinkToHotItem(owner.orderDrink)
      );
    } else {
      this.ownerRig.heldCupGroup.visible = false;
      if (isOwnerMoving) {
        const armSwing = Math.sin(owner.walkCycle) * 0.45;
        this.ownerRig.leftShoulderPivot.rotation.x = -armSwing;
        this.ownerRig.rightShoulderPivot.rotation.x = armSwing;
      } else {
        this.ownerRig.leftShoulderPivot.rotation.x = THREE.MathUtils.damp(
          this.ownerRig.leftShoulderPivot.rotation.x,
          0,
          12,
          dt
        );
        this.ownerRig.rightShoulderPivot.rotation.x = THREE.MathUtils.damp(
          this.ownerRig.rightShoulderPivot.rotation.x,
          0,
          12,
          dt
        );
      }
    }

    animateRigPose(
      this.ownerRig,
      owner.walkCycle,
      isOwnerMoving,
      false,
      isOwnerDrinking,
      elapsedSec * 3.5,
      elapsedSec + 2.4,
      dt
    );

    // 1c. Poor Kid / Helper ("Chotu") Rig
    const helper = shift.helper;
    const helperSitting = helper.status === 'sitting';
    this.helperMatGroup.visible = helperSitting;
    this.helperRig.root.position.set(helper.x, 0.11, helper.z);
    if (helperSitting) {
      const lookYaw = Math.atan2(p.x - helper.x, p.z - helper.z);
      this.helperRig.root.rotation.y =
        Math.hypot(p.x - helper.x, p.z - helper.z) < 4.5 ? lookYaw : 0;
      this.helperRig.heldCupGroup.visible = false;
      animateRigPose(
        this.helperRig,
        0,
        false,
        true,
        false,
        0,
        elapsedSec + 4.1,
        dt
      );
    } else {
      const isHelperMoving =
        helper.task !== 'idle' &&
        helper.task !== 'waiting_boil' &&
        helper.actionTimer <= 0;
      this.helperRig.root.rotation.y = helper.yaw;
      animateRigPose(
        this.helperRig,
        helper.walkCycle,
        isHelperMoving,
        false,
        false,
        0,
        elapsedSec + 4.1,
        dt
      );
      if (!helper.holding) {
        if (isHelperMoving) {
          const armSwing = Math.sin(helper.walkCycle) * 0.5;
          this.helperRig.leftShoulderPivot.rotation.x = -armSwing;
          this.helperRig.rightShoulderPivot.rotation.x = armSwing;
        } else {
          this.helperRig.leftShoulderPivot.rotation.x = THREE.MathUtils.damp(
            this.helperRig.leftShoulderPivot.rotation.x,
            0,
            12,
            dt
          );
          this.helperRig.rightShoulderPivot.rotation.x = THREE.MathUtils.damp(
            this.helperRig.rightShoulderPivot.rotation.x,
            0,
            12,
            dt
          );
        }
      }
      this.updateHeldVisual(this.helperRig, helper.holding);
    }

    // 2. Smooth Wide Follow Camera covering expanded left & right plaza
    _camTarget.set(p.x * 0.72, 0.85, p.z * 0.45 - 0.3);
    _camPos.set(p.x * 0.72 + 0.25, 9.75, p.z * 0.45 + 8.85);
    this.camera.position.x = THREE.MathUtils.damp(
      this.camera.position.x,
      _camPos.x,
      5.5,
      dt
    );
    this.camera.position.y = THREE.MathUtils.damp(
      this.camera.position.y,
      _camPos.y,
      5.5,
      dt
    );
    this.camera.position.z = THREE.MathUtils.damp(
      this.camera.position.z,
      _camPos.z,
      5.5,
      dt
    );
    this.camera.lookAt(_camTarget);

    // 3. Chai Readi Cups, Water Level, 4 Free Spaces, Biscuits, Cupcakes & Level 2 Props
    const cupsLeft = Math.min(20, Math.max(0, shift.inventory.cups));
    for (let i = 0; i < this.cycleVisuals.cupMeshes.length; i++) {
      this.cycleVisuals.cupMeshes[i].visible = i < cupsLeft;
    }

    const biscuitCount = Math.min(6, Math.max(0, shift.inventory.biscuits));
    for (let i = 0; i < this.cycleVisuals.biscuitStockMeshes.length; i++) {
      this.cycleVisuals.biscuitStockMeshes[i].visible = i < biscuitCount;
    }

    const cupcakeCount = Math.min(6, Math.max(0, shift.inventory.cupcakes));
    for (let i = 0; i < this.cycleVisuals.cupcakeStockMeshes.length; i++) {
      this.cycleVisuals.cupcakeStockMeshes[i].visible = i < cupcakeCount;
    }

    const waterRatio = Math.max(
      0.04,
      Math.min(1, shift.inventory.water / MAX_WATER_CAPACITY)
    );
    this.cycleVisuals.waterFillMesh.visible = shift.inventory.water > 0;
    this.cycleVisuals.waterFillMesh.scale.y = waterRatio;
    this.cycleVisuals.waterFillMesh.position.y = 0.94 + waterRatio * 0.16;

    const trays = shift.trayItems ?? [shift.trayItem ?? null, null, null, null];
    for (let i = 0; i < this.cycleVisuals.trayVisuals.length; i++) {
      const tv = this.cycleVisuals.trayVisuals[i];
      applyCupContentsVisual(
        tv.group,
        tv.cupMeshes,
        tv.fillMesh,
        tv.sugarMesh,
        tv.biscuitMesh,
        tv.cupcakeMesh,
        tv.plateMesh,
        tv.samosaMesh,
        tv.pakoraMesh,
        trays[i] ?? null
      );
    }

    this.cycleVisuals.coffeeJarGroup.visible =
      world.unlockedRecipes.includes('coffee');
    this.cycleVisuals.milkCrateGroup.visible =
      world.unlockedRecipes.includes('doodh_patti');
    if (this.cycleVisuals.milkCrateGroup.visible) {
      const pk = Math.min(4, Math.max(0, shift.inventory.milkPackets));
      for (let i = 0; i < this.cycleVisuals.milkPacketMeshes.length; i++) {
        this.cycleVisuals.milkPacketMeshes[i].visible = i < pk;
      }
    }

    // 3b. 2nd Readi (Samosa & Pakora Cart) vs Reserved Plot Signboard
    this.snacksCartVisuals.group.visible = world.hasSnacksCart;
    this.snacksCartVisuals.plotSignGroup.visible = !world.hasSnacksCart;
    const snackTrays = shift.snackTrayItems ?? [null, null];
    if (world.hasSnacksCart) {
      const sCount = Math.min(6, Math.max(0, shift.inventory.samosaMix));
      for (let i = 0; i < this.snacksCartVisuals.samosaStockMeshes.length; i++) {
        this.snacksCartVisuals.samosaStockMeshes[i].visible = i < sCount;
      }
      const pCount = Math.min(4, Math.max(0, shift.inventory.pakoraMix));
      for (let i = 0; i < this.snacksCartVisuals.pakoraStockMeshes.length; i++) {
        this.snacksCartVisuals.pakoraStockMeshes[i].visible = i < pCount;
      }
      for (let i = 0; i < this.snacksCartVisuals.trayVisuals.length; i++) {
        const tv = this.snacksCartVisuals.trayVisuals[i];
        applyCupContentsVisual(
          tv.group,
          tv.cupMeshes,
          tv.fillMesh,
          tv.sugarMesh,
          tv.biscuitMesh,
          tv.cupcakeMesh,
          tv.plateMesh,
          tv.samosaMesh,
          tv.pakoraMesh,
          snackTrays[i] ?? null
        );
      }

      const isFrying = shift.fryer.status === 'frying';
      const isFryReady = shift.fryer.status === 'ready';
      this.snacksCartVisuals.burnerFlame.visible = isFrying;
      this.snacksCartVisuals.kadhaiFoodMesh.visible = isFrying || isFryReady;
      const foodMat = this.snacksCartVisuals.kadhaiFoodMesh
        .material as THREE.MeshStandardMaterial;
      foodMat.color.setHex(
        isFryReady
          ? 0xd97706
          : shift.fryer.fryingSnack === 'pakora'
            ? 0xf59e0b
            : 0xfde68a
      );
      if (isFrying) {
        this.snacksCartVisuals.kadhaiFoodMesh.rotation.y = elapsedSec * 4;
      }
      for (let i = 0; i < this.snacksCartVisuals.steamPuffs.length; i++) {
        const puff = this.snacksCartVisuals.steamPuffs[i];
        if (isFrying || isFryReady) {
          puff.visible = true;
          const cyc = (elapsedSec * 1.5 + i * 0.33) % 1;
          puff.position.y = 1.4 + cyc * 0.85;
          puff.scale.setScalar(0.65 + cyc * 0.85);
        } else {
          puff.visible = false;
        }
      }
    }

    // 4. Kettle Flame, Liquid Tint & Steam
    const isBrewing = shift.kettle.status === 'brewing';
    const isReady = shift.kettle.status === 'ready';
    this.cycleVisuals.burnerFlame.visible = isBrewing;
    this.cycleVisuals.kettleCupMesh.visible = isBrewing || isReady;

    const kCupMat = this.cycleVisuals.kettleCupMesh
      .material as THREE.MeshStandardMaterial;
    if (shift.kettle.brewingDrink === 'doodh_patti') {
      kCupMat.color.setHex(0xeab370);
    } else if (shift.kettle.brewingDrink === 'coffee') {
      kCupMat.color.setHex(0x451a03);
    } else {
      kCupMat.color.setHex(0xfef3c7);
    }

    if (isBrewing) {
      this.cycleVisuals.kettleGroup.position.y =
        1.1 + Math.sin(elapsedSec * 28) * 0.012;
    } else {
      this.cycleVisuals.kettleGroup.position.y = 1.1;
    }

    for (let i = 0; i < this.cycleVisuals.steamPuffs.length; i++) {
      const puff = this.cycleVisuals.steamPuffs[i];
      if (isBrewing || isReady) {
        puff.visible = true;
        const cycle = (elapsedSec * 1.4 + i * 0.25) % 1;
        puff.position.y = 1.46 + cycle * 0.95;
        puff.scale.setScalar(0.7 + cycle * 0.9);
      } else {
        puff.visible = false;
      }
    }

    // 5. Milkman Motorcycle Position & Wheels
    const mk = shift.milkman;
    this.milkmanVisuals.group.visible = mk.phase !== 'away';
    if (mk.phase !== 'away') {
      const prevX = this.milkmanVisuals.group.position.x;
      this.milkmanVisuals.group.position.set(mk.x, 0, mk.z);
      const moved = mk.x - prevX;
      for (const w of this.milkmanVisuals.wheels) {
        w.rotation.z -= moved * 2.8;
      }
    }

    // 6. Customer Car Position, Color & Wheels
    const car = shift.carCustomer;
    this.carVisuals.group.visible = car.phase !== 'away';
    if (car.phase !== 'away') {
      const prevX = this.carVisuals.group.position.x;
      this.carVisuals.group.position.set(car.x, 0, car.z);
      this.carVisuals.bodyMat.color.set(car.carColor);
      const moved = car.x - prevX;
      for (const w of this.carVisuals.wheels) {
        w.rotation.z -= moved * 2.6;
      }
    }

    // 7. Placed Cafe Chairs & Tables + Supermarket Pickup Crate
    this.syncPlacedFurniture(world.furniture);
    this.supermarketVisuals.pickupCrate.visible =
      world.pendingFurniture.length > 0;

    // 8. Walk-up & Seated Customers + Footpath Passerby Pedestrians
    this.syncCustomerRigs(shift.customers, world.furniture, elapsedSec, dt);
    this.syncPedestrianRigs(shift.pedestrians ?? [], elapsedSec, dt);

    // 9. Highlight Target Ring & Furniture Placement Preview Ring
    if (heldFurnitureKind(p.holding)) {
      const drop = getFurnitureDropSpot(p);
      const valid = canPlaceFurnitureAt(drop.x, drop.z, world.furniture, world);
      this.placementGhostRing.visible = true;
      this.placementGhostRing.position.set(drop.x, 0.13, drop.z);
      (this.placementGhostRing.material as THREE.MeshBasicMaterial).color.setHex(
        valid ? 0x22c55e : 0xef4444
      );
      this.targetRing.visible = false;
    } else {
      this.placementGhostRing.visible = false;
      if (target) {
        this.targetRing.visible = true;
        const ringY =
          target.kind === 'car' || target.kind === 'milkman' ? 0.04 : 0.14;
        this.targetRing.position.set(target.x, ringY, target.z);
        const pulse = 1 + Math.sin(elapsedSec * 7) * 0.08;
        this.targetRing.scale.set(pulse, pulse, 1);
      } else {
        this.targetRing.visible = false;
      }
    }

    this.renderer.render(this.scene, this.camera);

    // 10. Project 3D Screen Labels
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const labels: ProjectedLabel[] = [];

    const project = (wx: number, wy: number, wz: number) => {
      _projVec.set(wx, wy, wz);
      _projVec.project(this.camera);
      return {
        x: ((_projVec.x + 1) / 2) * w,
        y: (-(_projVec.y - 1) / 2) * h,
        visible: _projVec.z > -1 && _projVec.z < 1,
      };
    };

    if (shift.kettle.status !== 'idle') {
      const kp = project(STATIONS.kettle.x, 2.2, STATIONS.kettle.z);
      const kettleInfo = shift.kettle.brewingDrink
        ? DRINK_CATALOG[shift.kettle.brewingDrink]
        : undefined;
      const dName = kettleInfo ? kettleInfo.name : 'Chai';
      labels.push({
        id: 'kettle',
        kind: 'kettle',
        ...kp,
        text:
          shift.kettle.status === 'ready'
            ? `${dName} Ready! [E]`
            : `Boiling ${dName} ${Math.round(shift.kettle.progress * 100)}%`,
        progress: shift.kettle.progress,
      });
    }

    if (world.hasSnacksCart && shift.fryer.status !== 'idle') {
      const fp = project(SNACK_STATIONS.kadhai.x, 2.15, SNACK_STATIONS.kadhai.z);
      const fInfo = shift.fryer.fryingSnack
        ? DRINK_CATALOG[shift.fryer.fryingSnack]
        : undefined;
      const sName = fInfo ? fInfo.name : 'Samosa';
      labels.push({
        id: 'fryer',
        kind: 'fryer',
        ...fp,
        text:
          shift.fryer.status === 'ready'
            ? `Hot ${sName} Ready! [E]`
            : `Frying ${sName} ${Math.round(shift.fryer.progress * 100)}%`,
        progress: shift.fryer.progress,
      });
    }

    for (let idx = 0; idx < TRAY_SPOTS.length; idx++) {
      const item = trays[idx];
      if (item && HELD_ITEM_LABELS[item]) {
        const spot = TRAY_SPOTS[idx];
        const tp = project(spot.x, 1.52, spot.z);
        labels.push({
          id: `counter_tray_${idx}`,
          kind: 'counter_tray',
          ...tp,
          text: HELD_ITEM_LABELS[item],
        });
      }
    }

    if (world.hasSnacksCart) {
      for (let idx = 0; idx < SNACK_TRAY_SPOTS.length; idx++) {
        const item = snackTrays[idx];
        if (item && HELD_ITEM_LABELS[item]) {
          const spot = SNACK_TRAY_SPOTS[idx];
          const tp = project(spot.x, 1.52, spot.z);
          labels.push({
            id: `snack_tray_${idx}`,
            kind: 'counter_tray',
            ...tp,
            text: HELD_ITEM_LABELS[item],
          });
        }
      }
    } else {
      const spPos = project(SNACKS_CART_ANCHOR.x, 2.05, SNACKS_CART_ANCHOR.z);
      const hasSnacksRecipe =
        world.unlockedRecipes.includes('samosa') ||
        world.unlockedRecipes.includes('pakora');
      labels.push({
        id: 'snacks_plot',
        kind: 'snacks_plot',
        ...spPos,
        text: hasSnacksRecipe
          ? `Buy 2nd Readi (${formatMoney(SNACKS_CART_PRICE_CENTS)}) [E]`
          : '2nd Readi Spot (Learn Samosa Recipe First)',
      });
    }

    // Poor Kid / Chotu Helper Label
    const hp = project(helper.x, helperSitting ? 1.48 : 1.58, helper.z);
    if (helperSitting) {
      labels.push({
        id: 'helper_kid',
        kind: 'helper',
        ...hp,
        text: 'Poor Boy (Chotu) [E]',
        subText: '$0.25 Help / Hire',
      });
    } else {
      labels.push({
        id: 'helper_kid',
        kind: 'helper',
        ...hp,
        text: 'Chotu (Helper)',
        subText: helper.statusNote || 'Working',
      });
    }

    // Building Owner Labels (for all 3 Rentable Street Shops)
    for (const b of RENTABLE_BUILDINGS) {
      const rec = world.rentedShops.find((r) => r.buildingId === b.id);
      const isDue = Boolean(rec && world.day >= rec.nextRentDueDay);
      const bop = project(b.ownerPos.x, 2.05, b.ownerPos.z);
      labels.push({
        id: `building_owner_${b.id}`,
        kind: 'building_owner',
        ...bop,
        text: !rec
          ? `${b.ownerName} · ${b.shopName}`
          : isDue
            ? `${b.ownerName} · RENT DUE!`
            : `${b.shopName} (Yours)`,
        subText: !rec
          ? `${formatMoney(b.weeklyRentCents)}/wk [E]`
          : isDue
            ? `${formatMoney(b.weeklyRentCents)} [E]`
            : `Paid Day ${rec.nextRentDueDay}`,
        urgent: isDue,
      });
    }

    for (const c of shift.customers) {
      if (c.status === 'waiting') {
        const cp = project(c.x, c.seatedChairId ? 1.85 : 1.72, c.z);
        const ratio = Math.max(0, c.patience / c.maxPatience);
        const info = DRINK_CATALOG[c.orderDrink] ?? DRINK_CATALOG.tea;
        labels.push({
          id: c.id,
          kind: 'customer',
          ...cp,
          text: `${info.name} ${formatMoney(info.priceCents)}`,
          subText: ratio < 0.28 ? 'HURRY' : undefined,
          progress: ratio,
          urgent: ratio < 0.28,
        });
      }
    }

    if (owner.phase === 'ordering_chai') {
      const op = project(owner.x, 1.75, owner.z);
      const ratio = Math.max(0, owner.patience / owner.maxPatience);
      const info = DRINK_CATALOG[owner.orderDrink] ?? DRINK_CATALOG.tea;
      labels.push({
        id: 'owner_customer',
        kind: 'owner',
        ...op,
        text: `Mart Owner: ${info.name} ${formatMoney(info.priceCents)}`,
        subText: ratio < 0.28 ? 'HURRY' : '[E]',
        progress: ratio,
        urgent: ratio < 0.28,
      });
    } else if (owner.phase === 'walking_to_stall' || owner.phase === 'stroll_outside') {
      const op = project(owner.x, 2.05, owner.z);
      labels.push({
        id: 'owner_roam',
        kind: 'owner',
        ...op,
        text:
          owner.phase === 'walking_to_stall'
            ? 'Mart Owner (Coming for Chai)'
            : 'Mart Owner',
      });
    }

    if (car.phase === 'waiting') {
      const carP = project(car.x, 1.85, car.z);
      const ratio = Math.max(0, car.patience / car.maxPatience);
      const info = DRINK_CATALOG[car.orderDrink] ?? DRINK_CATALOG.tea;
      labels.push({
        id: 'car_customer',
        kind: 'car',
        ...carP,
        text: `Car: ${car.qtyServed}/${car.qtyTotal} ${info.name} (${formatMoney(info.priceCents)})`,
        subText: ratio < 0.28 ? 'HURRY' : '[E]/[F]',
        progress: ratio,
        urgent: ratio < 0.28,
      });
    }

    if (mk.phase === 'parked') {
      const mp = project(mk.x, 2.15, mk.z);
      labels.push({
        id: 'milkman',
        kind: 'milkman',
        ...mp,
        text: 'Milkman [E] Milk Packets',
        subText: `${Math.ceil(mk.timer)}s`,
      });
    }

    const wtPos = project(WATER_TAP_POS.x, 1.65, WATER_TAP_POS.z);
    labels.push({
      id: 'water_tap',
      kind: 'water_tap',
      ...wtPos,
      text: 'Free Water [E]',
    });

    const tbPos = project(TRASH_BIN_POS.x, 1.35, TRASH_BIN_POS.z);
    labels.push({
      id: 'trash_bin',
      kind: 'trash',
      ...tbPos,
      text: 'Trash Bin',
    });

    const smPos = project(
      SUPERMARKET_COUNTER_POS.x + 1.9,
      2.45,
      SUPERMARKET_COUNTER_POS.z - 0.4
    );
    labels.push({
      id: 'supermarket',
      kind: 'supermarket',
      ...smPos,
      text: isOwnerInsideSupermarket(owner)
        ? 'Chai Supermarket [E]'
        : 'Supermarket (Owner Away)',
    });

    if (world.pendingFurniture.length > 0) {
      const pkPos = project(
        SUPERMARKET_PICKUP_POS.x,
        1.5,
        SUPERMARKET_PICKUP_POS.z
      );
      labels.push({
        id: 'supermarket_pickup',
        kind: 'supermarket_pickup',
        ...pkPos,
        text: `Pickup Furniture (${world.pendingFurniture.length}) [E]`,
      });
    }

    return labels;
  }

  public scheduleNextFrame(tickFn: () => void): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync
        ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
        : null;
      if (sync) {
        gl.flush();
        const poll = () => {
          if (this.disposed) return;
          const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            this.frameId = window.setTimeout(poll, 5);
          } else {
            gl.deleteSync(sync);
            this.frameId = window.setTimeout(tickFn, 80);
          }
        };
        this.frameId = window.setTimeout(poll, 5);
      } else {
        this.frameId = window.setTimeout(tickFn, 80);
      }
    } else {
      this.frameId = requestAnimationFrame(tickFn);
    }
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.resizeObserver.disconnect();
    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material?.dispose();
        }
      }
    });
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
