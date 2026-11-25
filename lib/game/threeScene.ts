import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  BANK_SHOP,
  BUYER_SHOP,
  CAR_PARK_POS,
  CHILLING_DURATION,
  COLD_CART_ANCHOR,
  COLD_CART_PRICE_CENTS,
  COLD_STATIONS,
  COLD_TRAY_SPOTS,
  CYCLE_ANCHOR,
  DRINK_CATALOG,
  HELD_ITEM_LABELS,
  HELPER_NPCS,
  HELPER_NPC_IDS,
  MAX_WATER_CAPACITY,
  MILKMAN_PARK_POS,
  RENTABLE_BUILDINGS,
  type RentableBuildingConfig,
  SNACKS_CART_ANCHOR,
  SNACKS_CART_PRICE_CENTS,
  SNACK_STATIONS,
  SNACK_TRAY_SPOTS,
  STATIONS,
  SUPERMARKET_AISLE_POS,
  SUPERMARKET_BOUNDS,
  SUPERMARKET_COUNTER_POS,
  SUPERMARKET_PICKUP_POS,
  TRASH_BIN_POS,
  TRAY_SPOTS,
  WATER_TAP_POS,
  WOOD_MASTER_SHOP,
  drinkToHotItem,
  formatMoney,
  getShopKitchenBounds,
  getShopKitchenStations,
  heldFurnitureKind,
} from './constants.ts';
import {
  type TargetLookup,
  applySalesBoostCents,
  canPlaceFurnitureAt,
  findInteractTargetForPlayer,
  getDrinkStockStatus,
  getFacingAngleForSeat,
  getFurnitureDropSpot,
  getShiftBeggarKids,
  getShiftHelpers,
  getShiftShopVisitors,
  getStallLookTargetForDrink,
  isMenuItemEnabled,
  isOwnerInsideSupermarket,
} from './engine.ts';
import type {
  BeggarKidCustomer,
  CafeFurniture,
  FootpathPedestrian,
  HeldItem,
  HelperNpcId,
  Player3DState,
  ProjectedLabel,
  ShiftSnapshot,
  ShopBuildingId,
  ShopVisitorState,
  TeaCustomer,
  WorldSave,
} from './types.ts';

const _projVec = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _camTarget2 = new THREE.Vector3();
const _camPos2 = new THREE.Vector3();

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
  heldSodaGroup: THREE.Group;
  heldSodaIceCollar: THREE.Mesh;
  heldConeGroup: THREE.Group;
  heldConeScoop: THREE.Mesh;
  heldConeIceRing: THREE.Mesh;
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

interface ColdHeldExtras {
  sodaGroup?: THREE.Group;
  sodaIceCollar?: THREE.Mesh;
  coneGroup?: THREE.Group;
  coneScoop?: THREE.Mesh;
  coneIceRing?: THREE.Mesh;
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
  sodaGroup: THREE.Group;
  sodaIceCollar: THREE.Mesh;
  coneGroup: THREE.Group;
  coneScoop: THREE.Mesh;
  coneIceRing: THREE.Mesh;
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

  // Cold Drink Soda Bottle + Frost Ice Collar
  const sodaGroup = new THREE.Group();
  const bottleBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.056, 0.062, 0.19, 14),
    new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      roughness: 0.22,
      metalness: 0.15,
    })
  );
  bottleBody.position.y = 0.02;
  const bottleNeck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.052, 0.07, 12),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.25,
    })
  );
  bottleNeck.position.y = 0.145;
  const bottleCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.024, 12),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45 })
  );
  bottleCap.position.y = 0.188;
  const bottleLabel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.061, 0.061, 0.075, 14),
    new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.5 })
  );
  bottleLabel.position.y = 0.02;
  const sodaIceCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.078, 0.09, 12),
    new THREE.MeshStandardMaterial({
      color: 0xbae6fd,
      emissive: 0x0284c7,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.78,
      roughness: 0.2,
    })
  );
  sodaIceCollar.position.y = -0.025;
  sodaIceCollar.visible = false;
  sodaGroup.add(bottleBody, bottleNeck, bottleCap, bottleLabel, sodaIceCollar);
  sodaGroup.visible = false;
  group.add(sodaGroup);

  // Waffle Cone & Scoop Ice Cream
  const coneGroup = new THREE.Group();
  const coneBody = new THREE.Mesh(
    new THREE.ConeGeometry(0.076, 0.2, 12),
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.78 })
  );
  coneBody.rotation.x = Math.PI;
  coneBody.position.y = -0.02;
  const coneScoop = new THREE.Mesh(
    new THREE.SphereGeometry(0.086, 14, 12),
    new THREE.MeshStandardMaterial({ color: 0xf9a8d4, roughness: 0.45 })
  );
  coneScoop.position.y = 0.092;
  coneScoop.visible = false;
  const coneIceRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.088, 0.022, 8, 14),
    new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.4,
      roughness: 0.25,
    })
  );
  coneIceRing.rotation.x = Math.PI / 2;
  coneIceRing.position.y = 0.068;
  coneIceRing.visible = false;
  coneGroup.add(coneBody, coneScoop, coneIceRing);
  coneGroup.visible = false;
  group.add(coneGroup);

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
    sodaGroup,
    sodaIceCollar,
    coneGroup,
    coneScoop,
    coneIceRing,
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
  item: HeldItem,
  coldExtras?: ColdHeldExtras
): void {
  if (!item || item === 'carried_chair' || item === 'carried_table') {
    cupGroup.visible = false;
    return;
  }
  cupGroup.visible = true;

  if (coldExtras?.sodaGroup) coldExtras.sodaGroup.visible = false;
  if (coldExtras?.coneGroup) coldExtras.coneGroup.visible = false;

  if (
    item === 'cold_bottle' ||
    item === 'cold_bottle_iced' ||
    item === 'chilled_cold_drink'
  ) {
    cupMeshes.forEach((m) => (m.visible = false));
    fillMesh.visible = false;
    sugarMesh.visible = false;
    biscuitMesh.visible = false;
    cupcakeMesh.visible = false;
    plateMesh.visible = false;
    samosaMesh.visible = false;
    pakoraMesh.visible = false;
    if (coldExtras?.sodaGroup) {
      coldExtras.sodaGroup.visible = true;
      if (coldExtras.sodaIceCollar) {
        coldExtras.sodaIceCollar.visible =
          item === 'cold_bottle_iced' || item === 'chilled_cold_drink';
        const icMat = coldExtras.sodaIceCollar
          .material as THREE.MeshStandardMaterial;
        icMat.emissiveIntensity = item === 'chilled_cold_drink' ? 0.85 : 0.3;
      }
    }
    return;
  }

  if (
    item === 'empty_cone' ||
    item === 'cone_with_mix' ||
    item === 'iced_cream_mix' ||
    item === 'ready_ice_cream'
  ) {
    cupMeshes.forEach((m) => (m.visible = false));
    fillMesh.visible = false;
    sugarMesh.visible = false;
    biscuitMesh.visible = false;
    cupcakeMesh.visible = false;
    plateMesh.visible = false;
    samosaMesh.visible = false;
    pakoraMesh.visible = false;
    if (coldExtras?.coneGroup) {
      coldExtras.coneGroup.visible = true;
      if (coldExtras.coneScoop) {
        coldExtras.coneScoop.visible = item !== 'empty_cone';
        const sMat = coldExtras.coneScoop
          .material as THREE.MeshStandardMaterial;
        sMat.color.setHex(item === 'ready_ice_cream' ? 0xf472b6 : 0xfef3c7);
      }
      if (coldExtras.coneIceRing) {
        coldExtras.coneIceRing.visible =
          item === 'iced_cream_mix' || item === 'ready_ice_cream';
        const rMat = coldExtras.coneIceRing
          .material as THREE.MeshStandardMaterial;
        rMat.emissiveIntensity = item === 'ready_ice_cream' ? 0.75 : 0.25;
      }
    }
    return;
  }

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
  isOwner = false,
  isGirl = false
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
  } else if (isGirl) {
    const frockSkirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.36, 0.34, 14),
      shirtMat
    );
    frockSkirt.position.set(0, 0.67, 0);
    frockSkirt.castShadow = true;
    bodyGroup.add(frockSkirt);
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
    } else if (isGirl) {
      const ribbonMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        roughness: 0.5,
      });
      for (const side of [-1, 1] as const) {
        const braid = new THREE.Mesh(
          new THREE.CylinderGeometry(0.055, 0.042, 0.24, 8),
          hairMat
        );
        braid.position.set(side * 0.23, 0.2, -0.04);
        braid.rotation.z = side * 0.22;
        headGroup.add(braid);

        const ribbon = new THREE.Mesh(
          new THREE.SphereGeometry(0.045, 8, 8),
          ribbonMat
        );
        ribbon.position.set(side * 0.22, 0.31, -0.02);
        headGroup.add(ribbon);
      }
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
    heldSodaGroup: heldVisual.sodaGroup,
    heldSodaIceCollar: heldVisual.sodaIceCollar,
    heldConeGroup: heldVisual.coneGroup,
    heldConeScoop: heldVisual.coneScoop,
    heldConeIceRing: heldVisual.coneIceRing,
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
  dt: number,
  isMarketing = false
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
    const bounceY = isMarketing
      ? Math.abs(Math.sin(idleClock * 2.8)) * 0.045
      : Math.sin(idleClock * 1.8) * 0.008;
    rig.bodyGroup.position.y = THREE.MathUtils.damp(
      rig.bodyGroup.position.y,
      bounceY,
      12,
      dt
    );
    rig.bodyGroup.rotation.z = THREE.MathUtils.damp(
      rig.bodyGroup.rotation.z,
      isMarketing ? Math.sin(idleClock * 2.8) * 0.05 : 0,
      14,
      dt
    );
  }

  // Expressive Drinking / Eating, Energetic 3D Marketing Waving, or Natural Idle Motion
  if (isDrinking) {
    const sip = (Math.sin(drinkPhase) + 1) * 0.5;
    const armLiftX = -1.25 - sip * 0.85;
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
    rig.leftShoulderPivot.rotation.z = THREE.MathUtils.damp(
      rig.leftShoulderPivot.rotation.z,
      0,
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
  } else if (isMarketing && !isMoving && !isSitting) {
    const wave = Math.sin(idleClock * 5.4);
    const sway = Math.cos(idleClock * 5.4);
    rig.leftShoulderPivot.rotation.x = THREE.MathUtils.damp(
      rig.leftShoulderPivot.rotation.x,
      -2.18 + wave * 0.42,
      14,
      dt
    );
    rig.leftShoulderPivot.rotation.z = THREE.MathUtils.damp(
      rig.leftShoulderPivot.rotation.z,
      -0.36 - sway * 0.28,
      14,
      dt
    );
    rig.rightShoulderPivot.rotation.x = THREE.MathUtils.damp(
      rig.rightShoulderPivot.rotation.x,
      -2.18 - wave * 0.42,
      14,
      dt
    );
    rig.rightShoulderPivot.rotation.z = THREE.MathUtils.damp(
      rig.rightShoulderPivot.rotation.z,
      0.36 + sway * 0.28,
      14,
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
      -0.06,
      12,
      dt
    );
    rig.headGroup.rotation.z = THREE.MathUtils.damp(
      rig.headGroup.rotation.z,
      wave * 0.07,
      12,
      dt
    );
    rig.headGroup.rotation.y = THREE.MathUtils.damp(
      rig.headGroup.rotation.y,
      Math.sin(idleClock * 2.3) * 0.44,
      10,
      dt
    );
  } else {
    rig.leftShoulderPivot.rotation.z = THREE.MathUtils.damp(
      rig.leftShoulderPivot.rotation.z,
      0,
      12,
      dt
    );
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

interface ColdCartVisuals {
  group: THREE.Group;
  plotSignGroup: THREE.Group;
  awningGroup: THREE.Group;
  iceBlockStockMeshes: THREE.Mesh[];
  sodaStockMeshes: THREE.Mesh[];
  coneStockMeshes: THREE.Mesh[];
  mixFillMesh: THREE.Mesh;
  chillerCoil: THREE.Mesh;
  chillerItemMesh: THREE.Mesh;
  steamPuffs: THREE.Mesh[];
  trayVisuals: Array<ReturnType<typeof buildHeldItemVisualGroup>>;
}

function buildColdCartGroup(
  woodTex: THREE.CanvasTexture,
  maxAniso: number
): ColdCartVisuals {
  const group = new THREE.Group();
  group.position.set(COLD_CART_ANCHOR.x, 0, COLD_CART_ANCHOR.z);

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.72,
    roughness: 0.3,
  });
  const bluePaintMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
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

  // 4 Spoked Wheels + Axles
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
      bluePaintMat
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

  const cabinet = new THREE.Mesh(
    new THREE.BoxGeometry(4.6, 0.38, 1.46),
    bluePaintMat
  );
  cabinet.position.set(0, 0.68, 0);
  cabinet.castShadow = true;
  cabinet.receiveShadow = true;
  group.add(cabinet);

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(4.8, 0.12, 1.64),
    chromeMat
  );
  deck.position.set(0, 0.89, 0);
  deck.castShadow = true;
  deck.receiveShadow = true;
  group.add(deck);

  for (const rz of [-0.79, 0.79]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(4.82, 0.04, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.55 })
    );
    rail.position.set(0, 0.96, rz);
    group.add(rail);
  }

  const signTex = makeShopSignTexture(
    'ICE COLD DRINKS & ICE CREAM',
    'COLD DRINK $0.75 · ICE CREAM $0.90',
    '#0284C7',
    maxAniso
  );
  const signBoard = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 0.34),
    new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.45 })
  );
  signBoard.position.set(0, 0.7, 0.745);
  group.add(signBoard);

  for (const [px, pz] of [
    [-2.25, -0.7],
    [-2.25, 0.7],
    [2.25, -0.7],
    [2.25, 0.7],
  ]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.032, 1.52, 8),
      chromeMat
    );
    post.position.set(px, 1.66, pz);
    post.castShadow = true;
    group.add(post);
  }

  const awningGroup = new THREE.Group();
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(4.86, 0.09, 1.82),
    bluePaintMat
  );
  roof.position.set(0, 2.42, 0);
  roof.castShadow = true;
  awningGroup.add(roof);
  for (let s = 0; s < 4; s++) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.11, 1.84),
      new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.55 })
    );
    stripe.position.set(-1.65 + s * 1.1, 2.43, 0);
    awningGroup.add(stripe);
  }
  group.add(awningGroup);

  const lx = (wx: number) => wx - COLD_CART_ANCHOR.x;
  const lz = (wz: number) => wz - COLD_CART_ANCHOR.z;

  // 1. Electric Ice Chiller Drum
  const cx = lx(COLD_STATIONS.chiller.x);
  const cz = lz(COLD_STATIONS.chiller.z);
  const chillerBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.24, 0.58),
    frameMat
  );
  chillerBase.position.set(cx, 1.07, cz);
  group.add(chillerBase);

  const chillerBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 0.34, 18),
    chromeMat
  );
  chillerBody.position.set(cx, 1.28, cz);
  chillerBody.castShadow = true;
  group.add(chillerBody);

  const chillerCoil = new THREE.Mesh(
    new THREE.TorusGeometry(0.245, 0.028, 8, 20),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 2.0,
    })
  );
  chillerCoil.rotation.x = Math.PI / 2;
  chillerCoil.position.set(cx, 1.44, cz);
  chillerCoil.visible = false;
  group.add(chillerCoil);

  const chillerItemMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.18, 12),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.25 })
  );
  chillerItemMesh.position.set(cx, 1.46, cz);
  chillerItemMesh.visible = false;
  group.add(chillerItemMesh);

  const steamPuffs: THREE.Mesh[] = [];
  const frostMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.65,
    roughness: 0.9,
  });
  for (let i = 0; i < 3; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), frostMat);
    puff.position.set(cx, 1.54 + i * 0.18, cz);
    puff.visible = false;
    group.add(puff);
    steamPuffs.push(puff);
  }

  // 2. Crushed Ice Blocks Insulated Cooler Box
  const ix = lx(COLD_STATIONS.ice_box.x);
  const iz = lz(COLD_STATIONS.ice_box.z);
  const iceBoxBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.22, 0.46),
    new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.45 })
  );
  iceBoxBody.position.set(ix, 1.06, iz);
  group.add(iceBoxBody);
  const iceBlockStockMeshes: THREE.Mesh[] = [];
  const iceCubeMat = new THREE.MeshStandardMaterial({
    color: 0xbae6fd,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.25,
    transparent: true,
    opacity: 0.86,
    roughness: 0.15,
  });
  for (let i = 0; i < 6; i++) {
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.1, 0.11),
      iceCubeMat
    );
    cube.position.set(
      ix - 0.14 + (i % 3) * 0.14,
      1.19,
      iz + (i < 3 ? -0.08 : 0.08)
    );
    group.add(cube);
    iceBlockStockMeshes.push(cube);
  }

  // 3. Cold Drink Bottles Crate
  const sx = lx(COLD_STATIONS.soda_crate.x);
  const sz = lz(COLD_STATIONS.soda_crate.z);
  const crateBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.16, 0.44),
    new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.55 })
  );
  crateBox.position.set(sx, 1.03, sz);
  group.add(crateBox);
  const sodaStockMeshes: THREE.Mesh[] = [];
  const bottleStockMat = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9,
    roughness: 0.25,
  });
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.046, 0.18, 10),
      bottleStockMat
    );
    b.position.set(
      sx - 0.15 + (i % 3) * 0.15,
      1.16,
      sz + (i < 3 ? -0.09 : 0.09)
    );
    group.add(b);
    sodaStockMeshes.push(b);
  }

  // 4. Creamy Ice Cream Mix Tub
  const mx = lx(COLD_STATIONS.icecream_tub.x);
  const mz = lz(COLD_STATIONS.icecream_tub.z);
  const tubMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.18, 0.22, 16),
    chromeMat
  );
  tubMesh.position.set(mx, 1.06, mz);
  group.add(tubMesh);
  const mixFillMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.18, 0.06, 16),
    new THREE.MeshStandardMaterial({ color: 0xfbcfe8, roughness: 0.4 })
  );
  mixFillMesh.position.set(mx, 1.15, mz);
  group.add(mixFillMesh);

  // 5. Waffle Cones Stack
  const wcx = lx(COLD_STATIONS.cone_stack.x);
  const wcz = lz(COLD_STATIONS.cone_stack.z);
  const coneStand = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.08, 0.36),
    chromeMat
  );
  coneStand.position.set(wcx, 0.99, wcz);
  group.add(coneStand);
  const coneStockMeshes: THREE.Mesh[] = [];
  const coneStockMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.78,
  });
  for (let i = 0; i < 6; i++) {
    const cm = new THREE.Mesh(
      new THREE.ConeGeometry(0.045, 0.15, 10),
      coneStockMat
    );
    cm.rotation.x = Math.PI;
    cm.position.set(
      wcx - 0.12 + (i % 3) * 0.12,
      1.11,
      wcz + (i < 3 ? -0.07 : 0.07)
    );
    group.add(cm);
    coneStockMeshes.push(cm);
  }

  // 6. Two Cold Showcase Trays
  const trayVisuals: Array<ReturnType<typeof buildHeldItemVisualGroup>> = [];
  for (const spot of COLD_TRAY_SPOTS) {
    const tx = lx(spot.x);
    const tz = lz(spot.z);
    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.016, 0.56),
      bluePaintMat
    );
    rim.position.set(tx, 0.95, tz);
    const inlay = new THREE.Mesh(
      new THREE.BoxGeometry(0.86, 0.02, 0.48),
      new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.35 })
    );
    inlay.position.set(tx, 0.954, tz);
    group.add(rim, inlay);

    const tv = buildHeldItemVisualGroup();
    tv.group.position.set(tx, 1.07, tz);
    group.add(tv.group);
    trayVisuals.push(tv);
  }

  // Reserved 3rd Readi Plot Board
  const plotSignGroup = new THREE.Group();
  plotSignGroup.position.set(COLD_CART_ANCHOR.x, 0.11, COLD_CART_ANCHOR.z);
  const outline = new THREE.Mesh(
    new THREE.BoxGeometry(4.6, 0.025, 1.6),
    new THREE.MeshStandardMaterial({
      color: 0xbae6fd,
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
    '3RD READI SPACE',
    `COLD DRINKS & ICE CREAM · ${formatMoney(COLD_CART_PRICE_CENTS)}`,
    '#0284C7',
    maxAniso
  );
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.68, 0.08), [
    woodMat,
    woodMat,
    woodMat,
    woodMat,
    new THREE.MeshStandardMaterial({ map: plotTex, roughness: 0.45 }),
    woodMat,
  ]);
  board.position.y = 1.35;
  board.castShadow = true;
  plotSignGroup.add(outline, post, board);

  return {
    group,
    plotSignGroup,
    awningGroup,
    iceBlockStockMeshes,
    sodaStockMeshes,
    coneStockMeshes,
    mixFillMesh,
    chillerCoil,
    chillerItemMesh,
    steamPuffs,
    trayVisuals,
  };
}

interface ShopKitchenVisuals {
  group: THREE.Group;
  cupMeshes: THREE.Mesh[];
  coffeeJarGroup: THREE.Group;
  milkCrateGroup: THREE.Group;
  milkPacketMeshes: THREE.Mesh[];
  biscuitStockMeshes: THREE.Mesh[];
  cupcakeStockMeshes: THREE.Group[];
  waterFillMesh: THREE.Mesh;
  trayVisuals: Array<ReturnType<typeof buildHeldItemVisualGroup>>;
  kettleGroup: THREE.Group;
  burnerFlame: THREE.Mesh;
  kettleCupMesh: THREE.Mesh;
  steamPuffs: THREE.Mesh[];
}

function buildShopKitchenGroup(
  b: RentableBuildingConfig,
  woodTex: THREE.CanvasTexture
): { group: THREE.Group; visuals: ShopKitchenVisuals } {
  const group = new THREE.Group();
  const kb = getShopKitchenBounds(b);
  const ks = getShopKitchenStations(b);

  const kw = kb.maxX - kb.minX;
  const kd = kb.maxZ - kb.minZ;
  const kcx = (kb.minX + kb.maxX) / 2;
  const kcz = (kb.minZ + kb.maxZ) / 2;

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.55,
    roughness: 0.32,
  });
  const counterBodyMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.65,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    map: woodTex,
    roughness: 0.72,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.7,
    roughness: 0.35,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    metalness: 0.75,
    roughness: 0.25,
  });

  // Kitchen Counter Base & Top Deck
  const cabinet = new THREE.Mesh(
    new THREE.BoxGeometry(kw, 0.82, kd),
    counterBodyMat
  );
  cabinet.position.set(kcx, 0.52, kcz);
  cabinet.castShadow = true;
  cabinet.receiveShadow = true;
  group.add(cabinet);

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(kw + 0.1, 0.08, kd + 0.1),
    woodMat
  );
  deck.position.set(kcx, 0.96, kcz);
  deck.castShadow = true;
  deck.receiveShadow = true;
  group.add(deck);

  const frontRail = new THREE.Mesh(
    new THREE.BoxGeometry(kw + 0.08, 0.035, 0.04),
    steelMat
  );
  frontRail.position.set(kcx, 1.01, kb.maxZ + 0.02);
  group.add(frontRail);

  // 3 Serving Trays along front edge of indoor kitchen counter
  const trayVisuals: Array<ReturnType<typeof buildHeldItemVisualGroup>> = [];
  for (const spot of ks.trays) {
    const trayRim = new THREE.Mesh(
      new THREE.BoxGeometry(0.82, 0.014, 0.46),
      brassMat
    );
    trayRim.position.set(spot.x, 1.005, spot.z);
    group.add(trayRim);

    const trayInlay = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, 0.018, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.45 })
    );
    trayInlay.position.set(spot.x, 1.008, spot.z);
    group.add(trayInlay);

    const trayVis = buildHeldItemVisualGroup();
    trayVis.group.position.set(spot.x, 1.12, spot.z);
    group.add(trayVis.group);
    trayVisuals.push(trayVis);
  }

  // Cupcake Display Box
  const cupcakeBoxGroup = new THREE.Group();
  cupcakeBoxGroup.position.set(ks.cupcake_box.x, 1.08, ks.cupcake_box.z);
  const cupcakeBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.14, 0.44),
    new THREE.MeshStandardMaterial({ color: 0xfda4af, roughness: 0.65 })
  );
  cupcakeBase.castShadow = true;
  const cupcakeGlass = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.16, 0.42),
    new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.35,
      roughness: 0.15,
    })
  );
  cupcakeGlass.position.y = 0.14;
  cupcakeBoxGroup.add(cupcakeBase, cupcakeGlass);

  const cupcakeStockMeshes: THREE.Group[] = [];
  for (let i = 0; i < 6; i++) {
    const cg = new THREE.Group();
    const liner = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.036, 0.065, 10),
      new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.75 })
    );
    const frost = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 10, 8),
      new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0xf472b6 : 0xfbbf24,
        roughness: 0.45,
      })
    );
    frost.position.y = 0.04;
    cg.add(liner, frost);
    cg.position.set(-0.12 + (i % 3) * 0.12, 0.1, i < 3 ? -0.09 : 0.09);
    cupcakeBoxGroup.add(cg);
    cupcakeStockMeshes.push(cg);
  }
  group.add(cupcakeBoxGroup);

  // Biscuit Box
  const biscuitBoxGroup = new THREE.Group();
  biscuitBoxGroup.position.set(ks.biscuit_box.x, 1.07, ks.biscuit_box.z);
  const biscuitTray = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.12, 0.44),
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 })
  );
  biscuitTray.castShadow = true;
  biscuitBoxGroup.add(biscuitTray);

  const biscuitStockMeshes: THREE.Mesh[] = [];
  const biscuitGeo = new THREE.BoxGeometry(0.11, 0.08, 0.15);
  const biscuitMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.45,
  });
  for (let i = 0; i < 6; i++) {
    const bm = new THREE.Mesh(biscuitGeo, biscuitMat);
    bm.position.set(-0.12 + (i % 3) * 0.12, 0.09, i < 3 ? -0.09 : 0.09);
    biscuitBoxGroup.add(bm);
    biscuitStockMeshes.push(bm);
  }
  group.add(biscuitBoxGroup);

  // Cup Basket
  const basket = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.22, 0.46),
    new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.85 })
  );
  basket.position.set(ks.cups.x, 1.0, ks.cups.z);
  basket.castShadow = true;
  group.add(basket);

  const cupMeshes: THREE.Mesh[] = [];
  const cupGeo = new THREE.CylinderGeometry(0.058, 0.045, 0.13, 10);
  const cupMat = new THREE.MeshStandardMaterial({
    color: 0xfffdf9,
    roughness: 0.55,
  });
  for (let i = 0; i < 20; i++) {
    const stackIdx = Math.floor(i / 10);
    const heightIdx = i % 10;
    const cm = new THREE.Mesh(cupGeo, cupMat);
    cm.position.set(
      ks.cups.x + (stackIdx === 0 ? -0.095 : 0.095),
      1.09 + heightIdx * 0.032,
      ks.cups.z
    );
    group.add(cm);
    cupMeshes.push(cm);
  }

  // Tea Leaves Tin
  const teaTin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.145, 0.145, 0.32, 16),
    new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.45,
      metalness: 0.25,
    })
  );
  teaTin.position.set(ks.tea_tin.x, 1.15, ks.tea_tin.z);
  teaTin.castShadow = true;
  group.add(teaTin);

  const teaLid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.155, 0.155, 0.045, 16),
    brassMat
  );
  teaLid.position.set(ks.tea_tin.x, 1.32, ks.tea_tin.z);
  group.add(teaLid);

  // Coffee Beans Jar
  const coffeeJarGroup = new THREE.Group();
  coffeeJarGroup.position.set(ks.coffee_jar.x, 1.14, ks.coffee_jar.z);
  const coffeeJar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.135, 0.135, 0.28, 16),
    new THREE.MeshStandardMaterial({
      color: 0x451a03,
      roughness: 0.4,
      metalness: 0.2,
    })
  );
  coffeeJar.castShadow = true;
  const coffeeLid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.145, 0.145, 0.045, 16),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.45 })
  );
  coffeeLid.position.y = 0.15;
  coffeeJarGroup.add(coffeeJar, coffeeLid);
  group.add(coffeeJarGroup);

  // Sugar Jar
  const sugarJar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.28, 16),
    new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.72,
      roughness: 0.15,
    })
  );
  sugarJar.position.set(ks.sugar_jar.x, 1.14, ks.sugar_jar.z);
  group.add(sugarJar);

  const sugarInside = new THREE.Mesh(
    new THREE.CylinderGeometry(0.115, 0.115, 0.16, 12),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 })
  );
  sugarInside.position.set(ks.sugar_jar.x, 1.08, ks.sugar_jar.z);
  group.add(sugarInside);

  // Water Jug
  const waterShell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.155, 0.155, 0.36, 16),
    new THREE.MeshStandardMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.45,
      roughness: 0.12,
    })
  );
  waterShell.position.set(ks.water_jug.x, 1.18, ks.water_jug.z);
  group.add(waterShell);

  const waterFillMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.135, 0.135, 0.3, 14),
    new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.85,
      roughness: 0.18,
    })
  );
  waterFillMesh.position.set(ks.water_jug.x, 1.0, ks.water_jug.z);
  group.add(waterFillMesh);

  const waterCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.095, 0.105, 0.055, 12),
    new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.5 })
  );
  waterCap.position.set(ks.water_jug.x, 1.38, ks.water_jug.z);
  group.add(waterCap);

  // Milk Packets Crate
  const milkCrateGroup = new THREE.Group();
  milkCrateGroup.position.set(ks.milk_crate.x, 1.1, ks.milk_crate.z);
  const crateBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.18, 0.36),
    new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.7 })
  );
  crateBox.castShadow = true;
  milkCrateGroup.add(crateBox);

  const milkPacketMeshes: THREE.Mesh[] = [];
  const packetGeo = new THREE.BoxGeometry(0.1, 0.14, 0.075);
  const packetMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.4,
  });
  for (let i = 0; i < 4; i++) {
    const pm = new THREE.Mesh(packetGeo, packetMat);
    pm.position.set(i % 2 === 0 ? -0.08 : 0.08, 0.11, i < 2 ? -0.08 : 0.08);
    milkCrateGroup.add(pm);
    milkPacketMeshes.push(pm);
  }
  group.add(milkCrateGroup);

  // Kettle Stove
  const stoveBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.14, 0.46),
    frameMat
  );
  stoveBase.position.set(ks.kettle.x, 1.07, ks.kettle.z);
  group.add(stoveBase);

  const burnerFlame = new THREE.Mesh(
    new THREE.TorusGeometry(0.14, 0.028, 8, 18),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 2.2,
    })
  );
  burnerFlame.rotation.x = Math.PI / 2;
  burnerFlame.position.set(ks.kettle.x, 1.15, ks.kettle.z);
  burnerFlame.visible = false;
  group.add(burnerFlame);

  const kettleGroup = new THREE.Group();
  kettleGroup.position.set(ks.kettle.x, 1.16, ks.kettle.z);

  const kettleBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.18, 0.28, 16),
    brassMat
  );
  kettleBody.position.y = 0.14;
  kettleBody.castShadow = true;
  kettleGroup.add(kettleBody);

  const kettleLid = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 12, 8),
    brassMat
  );
  kettleLid.position.y = 0.28;
  kettleGroup.add(kettleLid);

  const spout = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.04, 0.2, 8),
    brassMat
  );
  spout.position.set(0.16, 0.2, 0);
  spout.rotation.z = -0.65;
  kettleGroup.add(spout);

  const kettleHandle = new THREE.Mesh(
    new THREE.TorusGeometry(0.14, 0.018, 8, 16, Math.PI),
    frameMat
  );
  kettleHandle.position.y = 0.26;
  kettleGroup.add(kettleHandle);
  group.add(kettleGroup);

  const kettleCupMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.055, 0.15, 12),
    new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.4 })
  );
  kettleCupMesh.position.set(ks.kettle.x + 0.26, 1.1, ks.kettle.z + 0.14);
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
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), steamMat);
    puff.position.set(ks.kettle.x, 1.56 + i * 0.18, ks.kettle.z);
    puff.visible = false;
    group.add(puff);
    steamPuffs.push(puff);
  }

  return {
    group,
    visuals: {
      group,
      cupMeshes,
      coffeeJarGroup,
      milkCrateGroup,
      milkPacketMeshes,
      biscuitStockMeshes,
      cupcakeStockMeshes,
      waterFillMesh,
      trayVisuals,
      kettleGroup,
      burnerFlame,
      kettleCupMesh,
      steamPuffs,
    },
  };
}

interface RentableBuildingVisuals {
  id: ShopBuildingId;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  roofGroup: THREE.Group;
  rentedBanner: THREE.Mesh;
  ownerRig: CharacterRig;
  kitchen: ShopKitchenVisuals;
}

function buildRentableBuildings(
  scene: THREE.Scene,
  woodTex: THREE.CanvasTexture,
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

    // Doorframe Pillars + Warm Interior Glow Bars
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

    const sideGlow = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.1, d - 1.2),
      glowStripMat
    );
    sideGlow.position.set(minX + 0.28, 2.86, cz);
    group.add(sideGlow);

    const accentHex = `#${b.awningHex.toString(16).padStart(6, '0')}`;
    const signTex = makeShopSignTexture(
      b.shopName.toUpperCase(),
      `OWNER: ${b.ownerName.toUpperCase()} · ${formatMoney(b.weeklyRentCents)}/WK · EMPTY FLOOR FOR RENT`,
      accentHex,
      maxAniso
    );
    const innerSign = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.min(5.2, w - 1.2), 0.92),
      new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.42 })
    );
    innerSign.position.set(b.counterPos.x + 0.8, 2.34, minZ + 0.16);
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

    // Built-in Indoor Cafe Kitchen on Right-Back Half of Shop
    const builtKitchen = buildShopKitchenGroup(b, woodTex);
    group.add(builtKitchen.group);

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
      new THREE.PlaneGeometry(Math.min(6.4, w - 0.8), 1.15),
      new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.42 })
    );
    roofSign.position.set(cx, 3.82, maxZ + 0.15);
    roofGroup.add(roofSign);

    group.add(roofGroup);

    // "RENTED SHOP" gold plaque visible on front counter when leased by player
    const rentedTex = makeShopSignTexture(
      'RENTED BY YOU',
      'KITCHEN & DINING OPEN',
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
      kitchen: builtKitchen.visuals,
    });
  }

  return results;
}

interface BuyerShopVisuals {
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  roofGroup: THREE.Group;
  buyerRig: CharacterRig;
}

function buildBuyerShopGroup(
  scene: THREE.Scene,
  maxAniso: number
): BuyerShopVisuals {
  const group = new THREE.Group();
  const { minX, maxX, minZ, maxZ } = BUYER_SHOP.bounds;
  const w = maxX - minX;
  const d = maxZ - minZ;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xf8f5ff,
    roughness: 0.64,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    color: BUYER_SHOP.wallHex,
    roughness: 0.84,
  });
  const awningMat = new THREE.MeshStandardMaterial({
    color: BUYER_SHOP.awningHex,
    roughness: 0.6,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    roughness: 0.72,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.45,
    roughness: 0.38,
  });
  const glowStripMat = new THREE.MeshStandardMaterial({
    color: 0xf3e8ff,
    emissive: 0x9333ea,
    emissiveIntensity: 0.9,
  });

  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), floorMat);
  floor.position.set(cx, 0.115, cz);
  floor.receiveShadow = true;
  group.add(floor);

  const doorCenter = (BUYER_SHOP.doorMinX + BUYER_SHOP.doorMaxX) / 2;
  const doorWidth = BUYER_SHOP.doorMaxX - BUYER_SHOP.doorMinX;
  const welcomeMat = new THREE.Mesh(
    new THREE.BoxGeometry(doorWidth - 0.15, 0.025, 0.65),
    awningMat
  );
  welcomeMat.position.set(doorCenter, 0.138, maxZ + 0.08);
  group.add(welcomeMat);

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(w, 3.0, 0.24), wallMat);
  backWall.position.set(cx, 1.61, minZ);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  group.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.0, d), wallMat);
  leftWall.position.set(minX, 1.61, cz);
  leftWall.castShadow = true;
  group.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.0, d), wallMat);
  rightWall.position.set(maxX, 1.61, cz);
  rightWall.castShadow = true;
  group.add(rightWall);

  const leftFrontW = BUYER_SHOP.doorMinX - minX;
  if (leftFrontW > 0.2) {
    const lfw = new THREE.Mesh(
      new THREE.BoxGeometry(leftFrontW, 3.0, 0.24),
      wallMat
    );
    lfw.position.set(minX + leftFrontW / 2, 1.61, maxZ);
    lfw.castShadow = true;
    group.add(lfw);
  }
  const rightFrontW = maxX - BUYER_SHOP.doorMaxX;
  if (rightFrontW > 0.2) {
    const rfw = new THREE.Mesh(
      new THREE.BoxGeometry(rightFrontW, 3.0, 0.24),
      wallMat
    );
    rfw.position.set(BUYER_SHOP.doorMaxX + rightFrontW / 2, 1.61, maxZ);
    rfw.castShadow = true;
    group.add(rfw);
  }

  for (const px of [BUYER_SHOP.doorMinX, BUYER_SHOP.doorMaxX]) {
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

  const signTex = makeShopSignTexture(
    'SECOND-HAND BUYER · RAZA BHAI',
    'SELL READI STALLS, CHAIRS & TABLES (-50% CASH)',
    '#7C3AED',
    maxAniso
  );
  const innerSign = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.min(5.2, w - 0.8), 0.92),
    new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.42 })
  );
  innerSign.position.set(cx, 2.34, minZ + 0.16);
  group.add(innerSign);

  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 0.86, 0.68),
    woodMat
  );
  counter.position.set(
    BUYER_SHOP.counterPos.x,
    0.54,
    BUYER_SHOP.counterPos.z
  );
  counter.castShadow = true;
  counter.receiveShadow = true;
  group.add(counter);

  // Decorative second-hand crates & stacked wooden goods inside corners
  const crateMat = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    roughness: 0.8,
  });
  for (const [bx, bz, bh] of [
    [minX + 0.7, minZ + 0.8, 0.65],
    [minX + 0.7, minZ + 1.55, 0.48],
    [maxX - 0.75, minZ + 0.85, 0.7],
    [maxX - 0.75, minZ + 1.65, 0.52],
  ]) {
    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, bh, 0.68),
      crateMat
    );
    crate.position.set(bx, 0.14 + bh / 2, bz);
    crate.castShadow = true;
    group.add(crate);
  }

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
    new THREE.PlaneGeometry(Math.min(5.6, w - 0.6), 1.05),
    new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.42 })
  );
  roofSign.position.set(cx, 3.76, maxZ + 0.15);
  roofGroup.add(roofSign);
  group.add(roofGroup);

  const buyerRig = buildHumanRig(
    BUYER_SHOP.buyerShirtHex,
    '#1C1917',
    false,
    true
  );
  buyerRig.root.position.set(
    BUYER_SHOP.buyerPos.x,
    0.135,
    BUYER_SHOP.buyerPos.z
  );
  buyerRig.root.rotation.y = 0;
  scene.add(buyerRig.root);

  scene.add(group);
  return {
    bounds: BUYER_SHOP.bounds,
    roofGroup,
    buyerRig,
  };
}

interface BankVisuals {
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  roofGroup: THREE.Group;
  bankerRig: CharacterRig;
}

function buildBankShopGroup(scene: THREE.Scene, maxAniso: number): BankVisuals {
  const group = new THREE.Group();
  const { minX, maxX, minZ, maxZ } = BANK_SHOP.bounds;
  const w = maxX - minX;
  const d = maxZ - minZ;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;

  const floorMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.62 });
  const wallMat = new THREE.MeshStandardMaterial({ color: BANK_SHOP.wallHex, roughness: 0.82 });
  const awningMat = new THREE.MeshStandardMaterial({ color: BANK_SHOP.awningHex, roughness: 0.58 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.45, roughness: 0.38 });
  const glowStripMat = new THREE.MeshStandardMaterial({ color: 0xdbeafe, emissive: 0x2563eb, emissiveIntensity: 0.85 });

  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), floorMat);
  floor.position.set(cx, 0.115, cz);
  floor.receiveShadow = true;
  group.add(floor);

  const doorCenter = (BANK_SHOP.doorMinX + BANK_SHOP.doorMaxX) / 2;
  const doorWidth = BANK_SHOP.doorMaxX - BANK_SHOP.doorMinX;
  const welcomeMat = new THREE.Mesh(new THREE.BoxGeometry(doorWidth - 0.1, 0.025, 0.55), awningMat);
  welcomeMat.position.set(doorCenter, 0.138, maxZ + 0.08);
  group.add(welcomeMat);

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(w, 2.7, 0.24), wallMat);
  backWall.position.set(cx, 1.46, minZ);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  group.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.7, d), wallMat);
  leftWall.position.set(minX, 1.46, cz);
  leftWall.castShadow = true;
  group.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.7, d), wallMat);
  rightWall.position.set(maxX, 1.46, cz);
  rightWall.castShadow = true;
  group.add(rightWall);

  const leftFrontW = BANK_SHOP.doorMinX - minX;
  if (leftFrontW > 0.2) {
    const lfw = new THREE.Mesh(new THREE.BoxGeometry(leftFrontW, 2.7, 0.24), wallMat);
    lfw.position.set(minX + leftFrontW / 2, 1.46, maxZ);
    lfw.castShadow = true;
    group.add(lfw);
  }
  const rightFrontW = maxX - BANK_SHOP.doorMaxX;
  if (rightFrontW > 0.2) {
    const rfw = new THREE.Mesh(new THREE.BoxGeometry(rightFrontW, 2.7, 0.24), wallMat);
    rfw.position.set(BANK_SHOP.doorMaxX + rightFrontW / 2, 1.46, maxZ);
    rfw.castShadow = true;
    group.add(rfw);
  }
  for (const px of [BANK_SHOP.doorMinX, BANK_SHOP.doorMaxX]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.7, 0.24), trimMat);
    pillar.position.set(px, 1.46, maxZ);
    group.add(pillar);
  }

  const glowBar = new THREE.Mesh(new THREE.BoxGeometry(w - 0.6, 0.1, 0.14), glowStripMat);
  glowBar.position.set(cx, 2.55, minZ + 0.24);
  group.add(glowBar);

  const signTex = makeShopSignTexture(
    'CITY MICRO BANK',
    'LOAN • EASY TERMS • LOW INTEREST WITH GIRWI',
    '#1D4ED8',
    maxAniso
  );
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(w - 0.8, 0.85),
    new THREE.MeshBasicMaterial({ map: signTex, transparent: true })
  );
  sign.position.set(cx, 2.18, maxZ + 0.14);
  group.add(sign);

  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.78, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.2 })
  );
  counter.position.set(BANK_SHOP.counterPos.x, 0.5, BANK_SHOP.counterPos.z);
  counter.castShadow = true;
  counter.receiveShadow = true;
  group.add(counter);

  const roofGroup = new THREE.Group();
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.2, 0.12, d + 0.2),
    new THREE.MeshStandardMaterial({ color: 0x1e40af, roughness: 0.7 })
  );
  roof.position.set(cx, 2.82, cz);
  roof.castShadow = true;
  roofGroup.add(roof);
  group.add(roofGroup);

  const bankerRig = buildHumanRig(BANK_SHOP.bankerShirtHex, '#1C1917', false, true);
  bankerRig.root.position.set(BANK_SHOP.bankerPos.x, 0.135, BANK_SHOP.bankerPos.z);
  bankerRig.root.rotation.y = 0;
  scene.add(bankerRig.root);

  scene.add(group);
  return { bounds: BANK_SHOP.bounds, roofGroup, bankerRig };
}

interface WoodMasterVisuals {
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  roofGroup: THREE.Group;
  masterRig: CharacterRig;
  pickupCrate: THREE.Mesh;
  pickupPadMat: THREE.MeshStandardMaterial;
}

function buildWoodMasterShopGroup(
  scene: THREE.Scene,
  woodTex: THREE.CanvasTexture,
  maxAniso: number
): WoodMasterVisuals {
  const group = new THREE.Group();
  const { minX, maxX, minZ, maxZ } = WOOD_MASTER_SHOP.bounds;
  const w = maxX - minX;
  const d = maxZ - minZ;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    roughness: 0.72,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    color: WOOD_MASTER_SHOP.wallHex,
    roughness: 0.84,
  });
  const awningMat = new THREE.MeshStandardMaterial({
    color: WOOD_MASTER_SHOP.awningHex,
    roughness: 0.62,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    map: woodTex,
    roughness: 0.74,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.45,
    roughness: 0.38,
  });
  const glowStripMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xd97706,
    emissiveIntensity: 0.9,
  });

  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), floorMat);
  floor.position.set(cx, 0.115, cz);
  floor.receiveShadow = true;
  group.add(floor);

  const doorCenter = (WOOD_MASTER_SHOP.doorMinX + WOOD_MASTER_SHOP.doorMaxX) / 2;
  const doorWidth = WOOD_MASTER_SHOP.doorMaxX - WOOD_MASTER_SHOP.doorMinX;
  const welcomeMat = new THREE.Mesh(
    new THREE.BoxGeometry(doorWidth - 0.15, 0.025, 0.65),
    awningMat
  );
  welcomeMat.position.set(doorCenter, 0.138, maxZ + 0.08);
  group.add(welcomeMat);

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(w, 3.0, 0.24), wallMat);
  backWall.position.set(cx, 1.61, minZ);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  group.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.0, d), wallMat);
  leftWall.position.set(minX, 1.61, cz);
  leftWall.castShadow = true;
  group.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.0, d), wallMat);
  rightWall.position.set(maxX, 1.61, cz);
  rightWall.castShadow = true;
  group.add(rightWall);

  const leftFrontW = WOOD_MASTER_SHOP.doorMinX - minX;
  if (leftFrontW > 0.2) {
    const lfw = new THREE.Mesh(
      new THREE.BoxGeometry(leftFrontW, 3.0, 0.24),
      wallMat
    );
    lfw.position.set(minX + leftFrontW / 2, 1.61, maxZ);
    lfw.castShadow = true;
    group.add(lfw);
  }
  const rightFrontW = maxX - WOOD_MASTER_SHOP.doorMaxX;
  if (rightFrontW > 0.2) {
    const rfw = new THREE.Mesh(
      new THREE.BoxGeometry(rightFrontW, 3.0, 0.24),
      wallMat
    );
    rfw.position.set(WOOD_MASTER_SHOP.doorMaxX + rightFrontW / 2, 1.61, maxZ);
    rfw.castShadow = true;
    group.add(rfw);
  }

  for (const px of [WOOD_MASTER_SHOP.doorMinX, WOOD_MASTER_SHOP.doorMaxX]) {
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

  const signTex = makeShopSignTexture(
    'WOOD MASTER · USTAD KARIM',
    'ORDER CHAIRS, TABLES, KITCHENS & READI CARTS',
    '#92400E',
    maxAniso
  );
  const innerSign = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.min(7.2, w - 0.8), 0.96),
    new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.42 })
  );
  innerSign.position.set(cx, 2.34, minZ + 0.16);
  group.add(innerSign);

  // Carpentry Workbench Counter
  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(2.9, 0.86, 0.72),
    woodMat
  );
  counter.position.set(
    WOOD_MASTER_SHOP.counterPos.x,
    0.54,
    WOOD_MASTER_SHOP.counterPos.z
  );
  counter.castShadow = true;
  counter.receiveShadow = true;
  group.add(counter);

  // Stacked Lumber & Sample Chair/Wheel inside Workshop corners
  const plankMat = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    roughness: 0.82,
  });
  for (let i = 0; i < 4; i++) {
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.14, 0.36),
      plankMat
    );
    plank.position.set(minX + 1.15, 0.22 + i * 0.15, minZ + 0.95);
    plank.rotation.y = (i % 2 === 0 ? 1 : -1) * 0.06;
    plank.castShadow = true;
    group.add(plank);
  }
  const sampleChair = buildWoodChairGroup(0.95);
  sampleChair.position.set(maxX - 1.0, 0.14, minZ + 1.1);
  sampleChair.rotation.y = -0.5;
  group.add(sampleChair);

  const sampleWheel = new THREE.Mesh(
    new THREE.TorusGeometry(0.36, 0.06, 10, 20),
    woodMat
  );
  sampleWheel.position.set(maxX - 0.55, 0.5, minZ + 2.1);
  sampleWheel.rotation.y = Math.PI / 2;
  group.add(sampleWheel);

  // Order Pickup Pad outside/at workshop entrance
  const pickupPadMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.65,
  });
  const pickupPad = new THREE.Mesh(
    new THREE.BoxGeometry(1.05, 0.03, 1.05),
    pickupPadMat
  );
  pickupPad.position.set(
    WOOD_MASTER_SHOP.pickupPos.x,
    0.13,
    WOOD_MASTER_SHOP.pickupPos.z
  );
  group.add(pickupPad);

  const pickupCrate = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.54, 0.62),
    woodMat
  );
  pickupCrate.position.set(
    WOOD_MASTER_SHOP.pickupPos.x,
    0.42,
    WOOD_MASTER_SHOP.pickupPos.z
  );
  pickupCrate.castShadow = true;
  pickupCrate.visible = false;
  group.add(pickupCrate);

  // Auto-Hiding Roof + Awning + Roof Signboard
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
    new THREE.PlaneGeometry(Math.min(7.8, w - 0.6), 1.15),
    new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.42 })
  );
  roofSign.position.set(cx, 3.78, maxZ + 0.15);
  roofGroup.add(roofSign);
  group.add(roofGroup);

  const masterRig = buildHumanRig(
    WOOD_MASTER_SHOP.masterShirtHex,
    '#1C1917',
    false,
    true
  );
  masterRig.root.position.set(
    WOOD_MASTER_SHOP.masterPos.x,
    0.135,
    WOOD_MASTER_SHOP.masterPos.z
  );
  masterRig.root.rotation.y = 0;
  scene.add(masterRig.root);

  scene.add(group);
  return {
    bounds: WOOD_MASTER_SHOP.bounds,
    roofGroup,
    masterRig,
    pickupCrate,
    pickupPadMat,
  };
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
    'TEA · SUGAR · COFFEE · BISCUITS · RECIPES',
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

  // 6. Supermarket Pickup Crate Pad at Entrance (fallback for legacy saves)
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
  asphaltTex.repeat.set(28, 1);
  const sidewalkTex = makeSidewalkTexture(maxAniso);
  sidewalkTex.repeat.set(36, 6);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(240, 240),
    new THREE.MeshStandardMaterial({ color: 0x7c9a63, roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  scene.add(ground);

  const road = new THREE.Mesh(
    new THREE.BoxGeometry(170, 0.04, 6.8),
    new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.88 })
  );
  road.position.set(10, 0, 5.1);
  road.receiveShadow = true;
  scene.add(road);

  // Sidewalk, open alleys between shops, and full walkable backside plaza behind all shops!
  const sidewalk = new THREE.Mesh(
    new THREE.BoxGeometry(170, 0.14, 23.0),
    new THREE.MeshStandardMaterial({ map: sidewalkTex, roughness: 0.85 })
  );
  sidewalk.position.set(10, 0.04, -9.65);
  sidewalk.receiveShadow = true;
  scene.add(sidewalk);

  const curb = new THREE.Mesh(
    new THREE.BoxGeometry(170, 0.17, 0.28),
    new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.9 })
  );
  curb.position.set(10, 0.06, 1.85);
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
  for (const lx of [-27.5, -22.6, -12.0, 12.6, 25.4, 34.4, 47.4]) {
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
    [-25.6, 1.0],
    [-13.2, 1.0],
    [13.8, 1.0],
    [26.6, 1.0],
    [35.6, 1.0],
    [49.0, 1.0],
    [-18, 9.6],
    [-7, 9.8],
    [4, 9.6],
    [15, 9.5],
    [26, 9.6],
    [37, 9.6],
    [47, 9.6],
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

function buildHelperMatGroup(
  x: number,
  z: number,
  matHex = 0xb45309
): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0.11, z);

  const mat = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 0.03, 0.78),
    new THREE.MeshStandardMaterial({ color: matHex, roughness: 0.92 })
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
  private camera2: THREE.PerspectiveCamera;
  public readonly isSoftwareGl: boolean;

  private playerRig: CharacterRig;
  private player2Rig: CharacterRig;
  private ownerRig: CharacterRig;
  private helperRigs: Record<
    HelperNpcId,
    { rig: CharacterRig; mat: THREE.Group }
  >;
  private cycleVisuals: CycleVisuals;
  private snacksCartVisuals: SnacksCartVisuals;
  private coldCartVisuals: ColdCartVisuals;
  private supermarketVisuals: SupermarketVisuals;
  private rentableBuildingVisuals: RentableBuildingVisuals[];
  private buyerShopVisuals: BuyerShopVisuals;
  private woodMasterVisuals: WoodMasterVisuals;
  private bankVisuals: BankVisuals;
  private carVisuals: CarVisuals;
  private milkmanVisuals: MilkmanVisuals;
  private targetRing: THREE.Mesh;
  private targetRing2: THREE.Mesh;
  private placementGhostRing: THREE.Mesh;
  private placementGhostRing2: THREE.Mesh;
  private customerRigs = new Map<string, CharacterRig>();
  private beggarKidRigs = new Map<string, CharacterRig>();
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
    this.scene.fog = new THREE.Fog(0xf6d8ae, 46, 98);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.2, 130);
    this.camera.position.set(0.5, 8.1, 10.8);
    this.camera.lookAt(0, 0.8, 0.0);

    this.camera2 = new THREE.PerspectiveCamera(48, Math.max(0.2, (w * 0.5) / h), 0.2, 130);
    this.camera2.position.set(1.5, 8.1, 10.8);
    this.camera2.lookAt(1, 0.8, 0.0);

    const hemi = new THREE.HemisphereLight(0xbae6fd, 0x8b6f4e, 0.9);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff1d0, 2.1);
    sun.position.set(10, 16, 9);
    sun.castShadow = !this.isSoftwareGl;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 68;
    sun.shadow.camera.left = -36;
    sun.shadow.camera.right = 38;
    sun.shadow.camera.top = 22;
    sun.shadow.camera.bottom = -22;
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

    this.coldCartVisuals = buildColdCartGroup(woodTex, maxAniso);
    this.scene.add(this.coldCartVisuals.group);
    this.scene.add(this.coldCartVisuals.plotSignGroup);

    // Open Walk-In Supermarket + All 3x Larger Rentable Shops + Second-Hand Buyer Shop + Water Tap + Trash Bin
    this.supermarketVisuals = buildOpenSupermarket(maxAniso);
    this.scene.add(this.supermarketVisuals.group);
    this.rentableBuildingVisuals = buildRentableBuildings(
      this.scene,
      woodTex,
      maxAniso
    );
    this.buyerShopVisuals = buildBuyerShopGroup(this.scene, maxAniso);
    this.woodMasterVisuals = buildWoodMasterShopGroup(
      this.scene,
      woodTex,
      maxAniso
    );
    this.bankVisuals = buildBankShopGroup(this.scene, maxAniso);
    this.scene.add(buildWaterTapGroup());
    this.scene.add(buildTrashBinGroup());

    this.carVisuals = buildCustomerCarGroup();
    this.scene.add(this.carVisuals.group);

    this.milkmanVisuals = buildMilkmanBikeGroup();
    this.scene.add(this.milkmanVisuals.group);

    this.playerRig = buildHumanRig('#EA580C', '#1C1917', true);
    this.scene.add(this.playerRig.root);

    this.player2Rig = buildHumanRig('#0D9488', '#1C1917', true);
    this.player2Rig.root.visible = false;
    this.scene.add(this.player2Rig.root);

    this.ownerRig = buildHumanRig('#0F766E', '#1C1917', false, true);
    this.scene.add(this.ownerRig.root);

    const helperEntries = {} as Record<
      HelperNpcId,
      { rig: CharacterRig; mat: THREE.Group }
    >;
    for (const id of HELPER_NPC_IDS) {
      const cfg = HELPER_NPCS[id];
      const matHex =
        id === 'munni' ? 0x9d174d : id === 'babloo' ? 0x115e59 : 0xb45309;
      const mat = buildHelperMatGroup(cfg.sitPos.x, cfg.sitPos.z, matHex);
      this.scene.add(mat);
      const rig = buildHumanRig(
        cfg.shirtHex,
        cfg.hairHex,
        false,
        false,
        cfg.gender === 'girl'
      );
      rig.root.scale.setScalar(cfg.scale);
      this.scene.add(rig.root);
      helperEntries[id] = { rig, mat };
    }
    this.helperRigs = helperEntries;

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

    this.targetRing2 = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 0.62, 24),
      new THREE.MeshBasicMaterial({
        color: 0x14b8a6,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
      })
    );
    this.targetRing2.rotation.x = -Math.PI / 2;
    this.targetRing2.position.y = 0.13;
    this.targetRing2.visible = false;
    this.scene.add(this.targetRing2);

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

    this.placementGhostRing2 = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.48, 20),
      new THREE.MeshBasicMaterial({
        color: 0x22c55e,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      })
    );
    this.placementGhostRing2.rotation.x = -Math.PI / 2;
    this.placementGhostRing2.position.y = 0.14;
    this.placementGhostRing2.visible = false;
    this.scene.add(this.placementGhostRing2);

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
    this.camera2.aspect = Math.max(0.2, (w * 0.5) / h);
    this.camera2.updateProjectionMatrix();
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
      holding,
      {
        sodaGroup: rig.heldSodaGroup,
        sodaIceCollar: rig.heldSodaIceCollar,
        coneGroup: rig.heldConeGroup,
        coneScoop: rig.heldConeScoop,
        coneIceRing: rig.heldConeIceRing,
      }
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
    world: WorldSave,
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
          const lookAt = getStallLookTargetForDrink(c.orderDrink, world);
          rig.root.rotation.y = Math.atan2(lookAt.x - c.x, lookAt.z - c.z);
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
            item,
            {
              sodaGroup: rig.heldSodaGroup,
              sodaIceCollar: rig.heldSodaIceCollar,
              coneGroup: rig.heldConeGroup,
              coneScoop: rig.heldConeScoop,
              coneIceRing: rig.heldConeIceRing,
            }
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

  private syncBeggarKidRigs(
    kids: BeggarKidCustomer[],
    world: WorldSave,
    elapsedSec: number,
    dt: number
  ): void {
    const activeIds = new Set(kids.map((k) => k.id));
    for (const [id, rig] of this.beggarKidRigs.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(rig.root);
        this.beggarKidRigs.delete(id);
      }
    }

    for (const kid of kids) {
      let rig = this.beggarKidRigs.get(kid.id);
      if (!rig) {
        rig = buildHumanRig(kid.shirtColor, kid.hairColor, false);
        rig.root.scale.setScalar(0.64);
        this.scene.add(rig.root);
        this.beggarKidRigs.set(kid.id, rig);
      }
      rig.root.position.set(kid.x, 0.11, kid.z);

      const isWalkingMarketing =
        kid.status === 'marketing' &&
        Math.hypot(kid.targetX - kid.x, kid.targetZ - kid.z) > 0.25;
      const isWalking =
        kid.status === 'walking_in' ||
        kid.status === 'walking_out' ||
        isWalkingMarketing;
      const isMarketing = kid.status === 'marketing' && !isWalkingMarketing;
      const isEating = kid.status === 'eating';

      if (isWalking) {
        const destX =
          kid.status === 'walking_in' || kid.status === 'marketing'
            ? kid.targetX
            : kid.seq % 2 === 0
              ? -12.5
              : 13.5;
        const destZ =
          kid.status === 'walking_in' || kid.status === 'marketing'
            ? kid.targetZ
            : 1.08;
        rig.root.rotation.y =
          typeof kid.yaw === 'number'
            ? kid.yaw
            : Math.atan2(destX - kid.x, destZ - kid.z);
        animateRigPose(
          rig,
          kid.walkCycle,
          true,
          false,
          false,
          0,
          elapsedSec + kid.seq,
          dt
        );
        const armSwing = Math.sin(kid.walkCycle) * 0.5;
        rig.leftShoulderPivot.rotation.x = -armSwing;
        rig.rightShoulderPivot.rotation.x = armSwing;
        rig.heldCupGroup.visible = false;
      } else {
        if (isMarketing) {
          rig.root.rotation.y = kid.yaw ?? 0;
        } else {
          const lookAt = getStallLookTargetForDrink(kid.orderDrink, world);
          rig.root.rotation.y = Math.atan2(lookAt.x - kid.x, lookAt.z - kid.z);
        }

        if (isEating) {
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
            drinkToHotItem(kid.orderDrink),
            {
              sodaGroup: rig.heldSodaGroup,
              sodaIceCollar: rig.heldSodaIceCollar,
              coneGroup: rig.heldConeGroup,
              coneScoop: rig.heldConeScoop,
              coneIceRing: rig.heldConeIceRing,
            }
          );
        } else {
          rig.heldCupGroup.visible = false;
          if (!isMarketing) {
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
        }

        animateRigPose(
          rig,
          kid.walkCycle,
          false,
          false,
          isEating,
          elapsedSec * 3.6 + kid.seq * 0.8,
          elapsedSec + kid.seq,
          dt,
          isMarketing
        );
      }
    }
  }

  private syncNamedVisitorRig(
    rig: CharacterRig,
    visitor: ShopVisitorState | undefined,
    phaseOffset: number,
    elapsedSec: number,
    dt: number
  ): void {
    if (!visitor) {
      rig.heldCupGroup.visible = false;
      animateRigPose(rig, 0, false, false, false, 0, elapsedSec + phaseOffset, dt);
      return;
    }

    const groundY = visitor.z < -5.0 ? 0.135 : 0.11;
    const isMoving =
      visitor.phase === 'walking_to_stall' ||
      visitor.phase === 'returning_to_shop';
    const isDrinking = visitor.phase === 'eating_drinking';

    rig.root.position.set(visitor.x, groundY, visitor.z);
    rig.root.rotation.y = visitor.yaw;

    if (isDrinking) {
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
        drinkToHotItem(visitor.orderDrink),
        {
          sodaGroup: rig.heldSodaGroup,
          sodaIceCollar: rig.heldSodaIceCollar,
          coneGroup: rig.heldConeGroup,
          coneScoop: rig.heldConeScoop,
          coneIceRing: rig.heldConeIceRing,
        }
      );
    } else {
      rig.heldCupGroup.visible = false;
      if (isMoving) {
        const armSwing = Math.sin(visitor.walkCycle) * 0.45;
        rig.leftShoulderPivot.rotation.x = -armSwing;
        rig.rightShoulderPivot.rotation.x = armSwing;
      } else {
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
    }

    animateRigPose(
      rig,
      visitor.walkCycle,
      isMoving,
      false,
      isDrinking,
      elapsedSec * 3.5,
      elapsedSec + phaseOffset,
      dt
    );
  }

  public syncAndRender(
    shift: ShiftSnapshot,
    world: WorldSave,
    target: TargetLookup | null,
    dt: number,
    elapsedSec: number
  ): ProjectedLabel[] {
    // 1. Player 1 & Player 2 (Co-Op Partner) transforms, building roof hiding & articulated poses
    const p = shift.player;
    const p2 = shift.player2?.active ? shift.player2 : null;
    const isInsideBox = (
      actor: Player3DState,
      b: { minX: number; maxX: number; minZ: number; maxZ: number }
    ) =>
      actor.x >= b.minX - 0.05 &&
      actor.x <= b.maxX + 0.05 &&
      actor.z >= b.minZ - 0.05 &&
      actor.z <= b.maxZ + 0.22;

    const p1InSupermarket = isInsideBox(p, SUPERMARKET_BOUNDS);
    const p2InSupermarket = p2 ? isInsideBox(p2, SUPERMARKET_BOUNDS) : false;
    const anyInSupermarket = p1InSupermarket || p2InSupermarket;

    let p1InAnyShop = p1InSupermarket;
    let p2InAnyShop = p2InSupermarket;
    let activeInsideShopId: ShopBuildingId | null = null;
    const builtKitchenIds = new Set(world.shopKitchens ?? []);

    const shopVisitors = getShiftShopVisitors(shift);
    const visitorById = new Map(shopVisitors.map((v) => [v.id, v]));

    for (const rb of this.rentableBuildingVisuals) {
      const p1Inside = isInsideBox(p, rb.bounds);
      const p2Inside = p2 ? isInsideBox(p2, rb.bounds) : false;
      rb.roofGroup.visible = !(p1Inside || p2Inside);
      rb.rentedBanner.visible = world.rentedShops.some(
        (r) => r.buildingId === rb.id
      );
      rb.kitchen.group.visible = builtKitchenIds.has(rb.id);
      const visId =
        rb.id === 'west_shop'
          ? 'west_owner'
          : rb.id === 'center_shop'
            ? 'center_owner'
            : 'east_owner';
      const rentRec = world.rentedShops.find((r) => r.buildingId === rb.id);
      const ownerAway = !!rentRec && world.day < rentRec.nextRentDueDay;
      this.syncNamedVisitorRig(
        rb.ownerRig,
        ownerAway ? undefined : visitorById.get(visId),
        rb.bounds.minX,
        elapsedSec,
        dt
      );
      rb.ownerRig.root.visible = !ownerAway;
      if (p1Inside) {
        p1InAnyShop = true;
        if (builtKitchenIds.has(rb.id)) activeInsideShopId = rb.id;
      }
      if (p2Inside) {
        p2InAnyShop = true;
        if (!activeInsideShopId && builtKitchenIds.has(rb.id)) {
          activeInsideShopId = rb.id;
        }
      }
    }

    const p1InsideBuyer = isInsideBox(p, this.buyerShopVisuals.bounds);
    const p2InsideBuyer = p2 ? isInsideBox(p2, this.buyerShopVisuals.bounds) : false;
    this.buyerShopVisuals.roofGroup.visible = !(p1InsideBuyer || p2InsideBuyer);
    this.syncNamedVisitorRig(
      this.buyerShopVisuals.buyerRig,
      visitorById.get('gear_buyer'),
      7.5,
      elapsedSec,
      dt
    );
    if (p1InsideBuyer) p1InAnyShop = true;
    if (p2InsideBuyer) p2InAnyShop = true;

    const p1InsideWood = isInsideBox(p, this.woodMasterVisuals.bounds);
    const p2InsideWood = p2 ? isInsideBox(p2, this.woodMasterVisuals.bounds) : false;
    this.woodMasterVisuals.roofGroup.visible = !(p1InsideWood || p2InsideWood);

    const p1InsideBank = isInsideBox(p, this.bankVisuals.bounds);
    const p2InsideBank = p2 ? isInsideBox(p2, this.bankVisuals.bounds) : false;
    this.bankVisuals.roofGroup.visible = !(p1InsideBank || p2InsideBank);
    if (p1InsideBank) p1InAnyShop = true;
    if (p2InsideBank) p2InAnyShop = true;
    this.syncNamedVisitorRig(
      this.woodMasterVisuals.masterRig,
      visitorById.get('wood_master'),
      11.2,
      elapsedSec,
      dt
    );
    if (p1InsideWood) p1InAnyShop = true;
    if (p2InsideWood) p2InAnyShop = true;

    const getActorGroundY = (actor: Player3DState, inAnyShop: boolean) => {
      if (actor.z > 8.5) return 0.04;
      if (actor.z > 1.85) return 0.02;
      if (inAnyShop) return 0.135;
      return 0.11;
    };

    // Auto-hide Supermarket Roof & Readi Awnings when either partner stands close
    this.supermarketVisuals.roofGroup.visible = !anyInSupermarket;
    this.cycleVisuals.group.visible = world.hasTeaStall !== false;
    const isNearTeaCart = (actor: Player3DState) =>
      actor.x >= CYCLE_ANCHOR.x - 4.4 &&
      actor.x <= CYCLE_ANCHOR.x + 4.4 &&
      actor.z >= CYCLE_ANCHOR.z - 2.7 &&
      actor.z <= CYCLE_ANCHOR.z + 2.5;
    const isWorkingAtStall =
      world.hasTeaStall !== false &&
      (isNearTeaCart(p) || (p2 ? isNearTeaCart(p2) : false));
    this.cycleVisuals.awningGroup.visible = !isWorkingAtStall;

    const isNearSnacksCart = (actor: Player3DState) =>
      actor.x >= SNACKS_CART_ANCHOR.x - 3.2 &&
      actor.x <= SNACKS_CART_ANCHOR.x + 3.2 &&
      actor.z >= SNACKS_CART_ANCHOR.z - 2.7 &&
      actor.z <= SNACKS_CART_ANCHOR.z + 2.5;
    const isWorkingAtSnacks =
      world.hasSnacksCart &&
      (isNearSnacksCart(p) || (p2 ? isNearSnacksCart(p2) : false));
    this.snacksCartVisuals.awningGroup.visible = !isWorkingAtSnacks;

    const isNearColdCart = (actor: Player3DState) =>
      actor.x >= COLD_CART_ANCHOR.x - 3.2 &&
      actor.x <= COLD_CART_ANCHOR.x + 3.2 &&
      actor.z >= COLD_CART_ANCHOR.z - 2.7 &&
      actor.z <= COLD_CART_ANCHOR.z + 2.5;
    const isWorkingAtCold =
      Boolean(world.hasColdCart) &&
      (isNearColdCart(p) || (p2 ? isNearColdCart(p2) : false));
    this.coldCartVisuals.awningGroup.visible = !isWorkingAtCold;

    const syncPlayerRigVisual = (
      rig: CharacterRig,
      actor: Player3DState,
      groundY: number,
      phaseOffset: number
    ) => {
      const isSitting = Boolean(actor.sittingChairId);
      rig.root.position.set(actor.x, groundY, actor.z);
      rig.root.rotation.y = actor.yaw;

      animateRigPose(
        rig,
        actor.walkCycle,
        actor.isMoving && !isSitting,
        isSitting,
        false,
        0,
        elapsedSec + phaseOffset,
        dt
      );
      if (!actor.holding) {
        if (actor.isMoving && !isSitting) {
          const armSwing = Math.sin(actor.walkCycle) * 0.55;
          rig.leftShoulderPivot.rotation.x = -armSwing;
          rig.rightShoulderPivot.rotation.x = armSwing;
        } else {
          rig.leftShoulderPivot.rotation.x = THREE.MathUtils.damp(
            rig.leftShoulderPivot.rotation.x,
            0,
            14,
            dt
          );
          rig.rightShoulderPivot.rotation.x = THREE.MathUtils.damp(
            rig.rightShoulderPivot.rotation.x,
            0,
            14,
            dt
          );
        }
      }
      this.updateHeldVisual(rig, actor.holding);
    };

    syncPlayerRigVisual(
      this.playerRig,
      p,
      getActorGroundY(p, p1InAnyShop),
      0
    );

    if (p2) {
      this.player2Rig.root.visible = true;
      syncPlayerRigVisual(
        this.player2Rig,
        p2,
        getActorGroundY(p2, p2InAnyShop),
        1.9
      );
    } else {
      this.player2Rig.root.visible = false;
    }

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
        drinkToHotItem(owner.orderDrink),
        {
          sodaGroup: this.ownerRig.heldSodaGroup,
          sodaIceCollar: this.ownerRig.heldSodaIceCollar,
          coneGroup: this.ownerRig.heldConeGroup,
          coneScoop: this.ownerRig.heldConeScoop,
          coneIceRing: this.ownerRig.heldConeIceRing,
        }
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

    // 1c. Poor Kids / Helpers ("Chotu", "Munni", "Babloo") Rigs (Including Hungry Begging & Corner Marketing)
    const helpersList = getShiftHelpers(shift);
    helpersList.forEach((h, idx) => {
      const hId: HelperNpcId = h.id ?? 'chotu';
      const cfg = HELPER_NPCS[hId];
      const entry = this.helperRigs[hId];
      if (!entry) return;
      const isUnhired = h.status === 'sitting';
      const begState = h.beggingState ?? 'at_mat';
      const isAtMat = isUnhired && begState === 'at_mat';
      const isMarketingCorner = isUnhired && begState === 'marketing';
      const isEatingFree = isUnhired && begState === 'eating_free';
      const isBeggingWait = isUnhired && begState === 'begging_at_stall';
      const isBeggingWalk =
        isUnhired &&
        (begState === 'walking_to_stall' || begState === 'returning_marketing');

      entry.mat.visible = isUnhired;
      const hGroundY = h.z < -5.2 ? 0.135 : 0.11;
      entry.rig.root.position.set(h.x, hGroundY, h.z);

      if (isAtMat) {
        const d1 = Math.hypot(p.x - h.x, p.z - h.z);
        const d2 = p2 ? Math.hypot(p2.x - h.x, p2.z - h.z) : Infinity;
        const lookActor = d2 < d1 && p2 ? p2 : p;
        const nearestDist = Math.min(d1, d2);
        const lookYaw = Math.atan2(lookActor.x - h.x, lookActor.z - h.z);
        entry.rig.root.rotation.y = nearestDist < 4.5 ? lookYaw : 0;
        entry.rig.heldCupGroup.visible = false;
        animateRigPose(
          entry.rig,
          0,
          false,
          true,
          false,
          0,
          elapsedSec + 4.1 + idx * 1.3,
          dt
        );
      } else if (isMarketingCorner) {
        entry.rig.root.rotation.y = 0;
        entry.rig.heldCupGroup.visible = false;
        animateRigPose(
          entry.rig,
          0,
          false,
          false,
          false,
          0,
          elapsedSec + 4.1 + idx * 1.3,
          dt,
          true
        );
      } else if (isBeggingWait || isEatingFree || isBeggingWalk) {
        if (isBeggingWalk) {
          entry.rig.root.rotation.y = h.yaw;
          entry.rig.heldCupGroup.visible = false;
          const armSwing = Math.sin(h.walkCycle) * 0.5;
          entry.rig.leftShoulderPivot.rotation.x = -armSwing;
          entry.rig.rightShoulderPivot.rotation.x = armSwing;
          animateRigPose(
            entry.rig,
            h.walkCycle,
            true,
            false,
            false,
            0,
            elapsedSec + 4.1 + idx * 1.3,
            dt
          );
        } else {
          const lookAt = getStallLookTargetForDrink(
            h.beggingDrink ?? 'tea',
            world
          );
          entry.rig.root.rotation.y = Math.atan2(lookAt.x - h.x, lookAt.z - h.z);
          if (isEatingFree) {
            applyCupContentsVisual(
              entry.rig.heldCupGroup,
              entry.rig.heldCupMeshes,
              entry.rig.heldTeaFill,
              entry.rig.heldSugarDots,
              entry.rig.heldBiscuitMesh,
              entry.rig.heldCupcakeMesh,
              entry.rig.heldPlateMesh,
              entry.rig.heldSamosaMesh,
              entry.rig.heldPakoraMesh,
              drinkToHotItem(h.beggingDrink ?? 'tea'),
              {
                sodaGroup: entry.rig.heldSodaGroup,
                sodaIceCollar: entry.rig.heldSodaIceCollar,
                coneGroup: entry.rig.heldConeGroup,
                coneScoop: entry.rig.heldConeScoop,
                coneIceRing: entry.rig.heldConeIceRing,
              }
            );
          } else {
            entry.rig.heldCupGroup.visible = false;
            entry.rig.leftShoulderPivot.rotation.x = THREE.MathUtils.damp(
              entry.rig.leftShoulderPivot.rotation.x,
              0,
              12,
              dt
            );
            entry.rig.rightShoulderPivot.rotation.x = THREE.MathUtils.damp(
              entry.rig.rightShoulderPivot.rotation.x,
              0,
              12,
              dt
            );
          }
          animateRigPose(
            entry.rig,
            h.walkCycle,
            false,
            false,
            isEatingFree,
            elapsedSec * 3.6 + idx * 0.9,
            elapsedSec + 4.1 + idx * 1.3,
            dt
          );
        }
      } else {
        const isHMoving =
          h.task !== 'idle' &&
          h.task !== 'waiting_boil' &&
          h.task !== 'waiting_fry' &&
          h.task !== 'waiting_chill' &&
          h.actionTimer <= 0;
        entry.rig.root.rotation.y = h.yaw;
        animateRigPose(
          entry.rig,
          h.walkCycle,
          isHMoving,
          false,
          false,
          0,
          elapsedSec + 4.1 + idx * 1.3,
          dt
        );
        if (!h.holding) {
          if (isHMoving) {
            const armSwing = Math.sin(h.walkCycle) * 0.5;
            entry.rig.leftShoulderPivot.rotation.x = -armSwing;
            entry.rig.rightShoulderPivot.rotation.x = armSwing;
          } else {
            entry.rig.leftShoulderPivot.rotation.x = THREE.MathUtils.damp(
              entry.rig.leftShoulderPivot.rotation.x,
              0,
              12,
              dt
            );
            entry.rig.rightShoulderPivot.rotation.x = THREE.MathUtils.damp(
              entry.rig.rightShoulderPivot.rotation.x,
              0,
              12,
              dt
            );
          }
        }
        this.updateHeldVisual(entry.rig, h.holding);
      }
      void cfg;
    });

    // 2. Smooth Follow Camera(s): Solo vs True Vertical Split-Screen Co-Op
    const updateCameraFollow = (
      cam: THREE.PerspectiveCamera,
      actor: Player3DState,
      targetVec: THREE.Vector3,
      posVec: THREE.Vector3
    ) => {
      const extraY = actor.z < -5.2 ? 0.9 : 0;
      targetVec.set(actor.x * 0.94, 0.85, actor.z * 0.8 - 0.2);
      posVec.set(actor.x * 0.94 + 0.25, 9.75 + extraY, actor.z * 0.8 + 8.9);
      cam.position.x = THREE.MathUtils.damp(cam.position.x, posVec.x, 5.5, dt);
      cam.position.y = THREE.MathUtils.damp(cam.position.y, posVec.y, 5.5, dt);
      cam.position.z = THREE.MathUtils.damp(cam.position.z, posVec.z, 5.5, dt);
      cam.lookAt(targetVec);
    };

    updateCameraFollow(this.camera, p, _camTarget, _camPos);
    if (p2) {
      updateCameraFollow(this.camera2, p2, _camTarget2, _camPos2);
    }

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
        trays[i] ?? null,
        {
          sodaGroup: tv.sodaGroup,
          sodaIceCollar: tv.sodaIceCollar,
          coneGroup: tv.coneGroup,
          coneScoop: tv.coneScoop,
          coneIceRing: tv.coneIceRing,
        }
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

    // 3c. 3rd Readi (Cold Drinks & Ice Cream Cart) vs Reserved Plot Signboard
    const hasColdCart = Boolean(world.hasColdCart);
    this.coldCartVisuals.group.visible = hasColdCart;
    this.coldCartVisuals.plotSignGroup.visible = !hasColdCart;
    const coldTrays = shift.coldTrayItems ?? [null, null];
    const chillerState = shift.chiller ?? {
      status: 'idle' as const,
      progress: 0,
      chillingItem: null,
    };
    if (hasColdCart) {
      const iceCount = Math.min(6, Math.max(0, shift.inventory.iceBlocks));
      for (let i = 0; i < this.coldCartVisuals.iceBlockStockMeshes.length; i++) {
        this.coldCartVisuals.iceBlockStockMeshes[i].visible = i < iceCount;
      }
      const sodaCount = Math.min(6, Math.max(0, shift.inventory.coldDrinkBottles));
      for (let i = 0; i < this.coldCartVisuals.sodaStockMeshes.length; i++) {
        this.coldCartVisuals.sodaStockMeshes[i].visible = i < sodaCount;
      }
      const coneCount = Math.min(6, Math.max(0, shift.inventory.iceCreamCones));
      for (let i = 0; i < this.coldCartVisuals.coneStockMeshes.length; i++) {
        this.coldCartVisuals.coneStockMeshes[i].visible = i < coneCount;
      }
      this.coldCartVisuals.mixFillMesh.visible = shift.inventory.iceCreamMix > 0;

      for (let i = 0; i < this.coldCartVisuals.trayVisuals.length; i++) {
        const tv = this.coldCartVisuals.trayVisuals[i];
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
          coldTrays[i] ?? null,
          {
            sodaGroup: tv.sodaGroup,
            sodaIceCollar: tv.sodaIceCollar,
            coneGroup: tv.coneGroup,
            coneScoop: tv.coneScoop,
            coneIceRing: tv.coneIceRing,
          }
        );
      }

      const isChilling = chillerState.status === 'chilling';
      const isChillReady = chillerState.status === 'ready';
      this.coldCartVisuals.chillerCoil.visible = isChilling || isChillReady;
      this.coldCartVisuals.chillerItemMesh.visible = isChilling || isChillReady;
      const itemMat = this.coldCartVisuals.chillerItemMesh
        .material as THREE.MeshStandardMaterial;
      itemMat.color.setHex(
        chillerState.chillingItem === 'ice_cream' ? 0xf9a8d4 : 0x38bdf8
      );
      if (isChilling) {
        this.coldCartVisuals.chillerItemMesh.rotation.y = elapsedSec * 4.5;
      }
      for (let i = 0; i < this.coldCartVisuals.steamPuffs.length; i++) {
        const puff = this.coldCartVisuals.steamPuffs[i];
        if (isChilling || isChillReady) {
          puff.visible = true;
          const cyc = (elapsedSec * 1.4 + i * 0.33) % 1;
          puff.position.y = 1.52 + cyc * 0.72;
          puff.scale.setScalar(0.6 + cyc * 0.7);
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

    // 4b. Sync Ordered Indoor Kitchen Visuals inside Rentable Shops (only visible when built via Wood Master)
    for (const rb of this.rentableBuildingVisuals) {
      const isKitchenBuilt = builtKitchenIds.has(rb.id);
      if (!isKitchenBuilt) {
        rb.kitchen.group.visible = false;
        continue;
      }
      const isRented = world.rentedShops.some((r) => r.buildingId === rb.id);
      const kv = rb.kitchen;

      for (let i = 0; i < kv.cupMeshes.length; i++) {
        kv.cupMeshes[i].visible = isRented ? i < cupsLeft : i < 10;
      }
      for (let i = 0; i < kv.biscuitStockMeshes.length; i++) {
        kv.biscuitStockMeshes[i].visible = isRented ? i < biscuitCount : false;
      }
      for (let i = 0; i < kv.cupcakeStockMeshes.length; i++) {
        kv.cupcakeStockMeshes[i].visible = isRented ? i < cupcakeCount : false;
      }
      kv.waterFillMesh.visible = isRented ? shift.inventory.water > 0 : true;
      if (isRented) {
        kv.waterFillMesh.scale.y = waterRatio;
        kv.waterFillMesh.position.y = 1.0 + waterRatio * 0.15;
      }

      kv.coffeeJarGroup.visible =
        isRented && world.unlockedRecipes.includes('coffee');
      kv.milkCrateGroup.visible =
        isRented && world.unlockedRecipes.includes('doodh_patti');
      if (kv.milkCrateGroup.visible) {
        const pk = Math.min(4, Math.max(0, shift.inventory.milkPackets));
        for (let i = 0; i < kv.milkPacketMeshes.length; i++) {
          kv.milkPacketMeshes[i].visible = i < pk;
        }
      }

      for (let i = 0; i < kv.trayVisuals.length; i++) {
        const tv = kv.trayVisuals[i];
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
          isRented ? (trays[i] ?? null) : null
        );
      }

      const shopKettleActive = isRented && (isBrewing || isReady);
      kv.burnerFlame.visible = isRented && isBrewing;
      kv.kettleCupMesh.visible = shopKettleActive;
      if (shopKettleActive) {
        const sCupMat = kv.kettleCupMesh
          .material as THREE.MeshStandardMaterial;
        sCupMat.color.copy(kCupMat.color);
      }
      kv.kettleGroup.position.y =
        isRented && isBrewing ? 1.16 + Math.sin(elapsedSec * 28) * 0.012 : 1.16;

      for (let i = 0; i < kv.steamPuffs.length; i++) {
        const puff = kv.steamPuffs[i];
        if (shopKettleActive) {
          puff.visible = true;
          const cycle = (elapsedSec * 1.4 + i * 0.25) % 1;
          puff.position.y = 1.52 + cycle * 0.9;
          puff.scale.setScalar(0.7 + cycle * 0.85);
        } else {
          puff.visible = false;
        }
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

    // 7. Placed Cafe Chairs & Tables + Pickup Pads
    this.syncPlacedFurniture(world.furniture);
    this.supermarketVisuals.pickupCrate.visible =
      world.pendingFurniture.length > 0;
    const woodOrders = world.woodOrders ?? [];
    const readyWoodOrders = woodOrders.filter((o) => o.status === 'ready');
    const buildingWoodOrders = woodOrders.filter((o) => o.status === 'building');
    this.woodMasterVisuals.pickupCrate.visible =
      readyWoodOrders.length > 0 || world.pendingFurniture.length > 0;
    this.woodMasterVisuals.pickupPadMat.color.setHex(
      readyWoodOrders.length > 0 ? 0x22c55e : 0xd97706
    );

    // 8. Walk-up & Seated Customers + Beggar Kids + Footpath Passerby Pedestrians
    this.syncCustomerRigs(shift.customers, world.furniture, world, elapsedSec, dt);
    this.syncBeggarKidRigs(getShiftBeggarKids(shift), world, elapsedSec, dt);
    this.syncPedestrianRigs(shift.pedestrians ?? [], elapsedSec, dt);

    // 9. Highlight Target Rings (P1 + Optional P2) & Furniture Placement Preview Ring
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

    if (p2) {
      if (heldFurnitureKind(p2.holding)) {
        const drop2 = getFurnitureDropSpot(p2);
        const valid2 = canPlaceFurnitureAt(drop2.x, drop2.z, world.furniture, world);
        this.placementGhostRing2.visible = true;
        this.placementGhostRing2.position.set(drop2.x, 0.13, drop2.z);
        (
          this.placementGhostRing2.material as THREE.MeshBasicMaterial
        ).color.setHex(valid2 ? 0x22c55e : 0xef4444);
        this.targetRing2.visible = false;
      } else {
        this.placementGhostRing2.visible = false;
        const target2 = findInteractTargetForPlayer(p2, shift, world);
        if (target2) {
          this.targetRing2.visible = true;
          const ring2Y =
            target2.kind === 'car' || target2.kind === 'milkman' ? 0.04 : 0.14;
          this.targetRing2.position.set(target2.x, ring2Y, target2.z);
          const pulse2 = 1 + Math.cos(elapsedSec * 7) * 0.08;
          this.targetRing2.scale.set(pulse2, pulse2, 1);
        } else {
          this.targetRing2.visible = false;
        }
      }
    } else {
      this.placementGhostRing2.visible = false;
      this.targetRing2.visible = false;
    }

    // 9b. WebGL Render (Solo Full-Screen OR True Split-Screen Co-Op!)
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const halfW = Math.floor(w / 2);
    const rightW = w - halfW;

    const applyActorInteriorVisibility = (actor: Player3DState) => {
      this.supermarketVisuals.roofGroup.visible = !isInsideBox(
        actor,
        SUPERMARKET_BOUNDS
      );
      for (const rb of this.rentableBuildingVisuals) {
        rb.roofGroup.visible = !isInsideBox(actor, rb.bounds);
      }
      this.buyerShopVisuals.roofGroup.visible = !isInsideBox(
        actor,
        this.buyerShopVisuals.bounds
      );
      this.woodMasterVisuals.roofGroup.visible = !isInsideBox(
        actor,
        this.woodMasterVisuals.bounds
      );
      this.bankVisuals.roofGroup.visible = !isInsideBox(
        actor,
        this.bankVisuals.bounds
      );
      this.cycleVisuals.awningGroup.visible =
        world.hasTeaStall !== false ? !isNearTeaCart(actor) : true;
      this.snacksCartVisuals.awningGroup.visible = world.hasSnacksCart
        ? !isNearSnacksCart(actor)
        : true;
      this.coldCartVisuals.awningGroup.visible = hasColdCart
        ? !isNearColdCart(actor)
        : true;
    };

    if (p2) {
      const splitAspectL = Math.max(0.2, halfW / Math.max(1, h));
      const splitAspectR = Math.max(0.2, rightW / Math.max(1, h));
      this.camera.aspect = splitAspectL;
      this.camera.fov = 48;
      this.camera.updateProjectionMatrix();
      this.camera2.aspect = splitAspectR;
      this.camera2.fov = 48;
      this.camera2.updateProjectionMatrix();

      // Left Viewport (Player 1)
      applyActorInteriorVisibility(p);
      this.renderer.setScissorTest(true);
      this.renderer.setViewport(0, 0, halfW, h);
      this.renderer.setScissor(0, 0, halfW, h);
      this.renderer.render(this.scene, this.camera);

      // Right Viewport (Player 2)
      applyActorInteriorVisibility(p2);
      this.renderer.setViewport(halfW, 0, rightW, h);
      this.renderer.setScissor(halfW, 0, rightW, h);
      this.renderer.render(this.scene, this.camera2);

      this.renderer.setScissorTest(false);
      this.renderer.setViewport(0, 0, w, h);
    } else {
      if (Math.abs(this.camera.aspect - w / Math.max(1, h)) > 0.01 || this.camera.fov !== 45) {
        this.camera.aspect = w / Math.max(1, h);
        this.camera.fov = 45;
        this.camera.updateProjectionMatrix();
      }
      this.renderer.setScissorTest(false);
      this.renderer.setViewport(0, 0, w, h);
      this.renderer.render(this.scene, this.camera);
    }

    // 10. Project 3D Screen Labels (Per-Viewport when Co-Op Split-Screen is active)
    const labels: ProjectedLabel[] = [];

    const pushLabel = (
      base: Omit<ProjectedLabel, 'x' | 'y' | 'visible'>,
      wx: number,
      wy: number,
      wz: number
    ) => {
      if (!p2) {
        _projVec.set(wx, wy, wz);
        _projVec.project(this.camera);
        labels.push({
          ...base,
          x: ((_projVec.x + 1) / 2) * w,
          y: (-(_projVec.y - 1) / 2) * h,
          visible:
            _projVec.z > -1 &&
            _projVec.z < 1 &&
            _projVec.x >= -0.96 &&
            _projVec.x <= 0.96,
        });
        return;
      }

      // Left Pane (Player 1)
      _projVec.set(wx, wy, wz);
      _projVec.project(this.camera);
      if (
        _projVec.z > -1 &&
        _projVec.z < 1 &&
        _projVec.x >= -0.9 &&
        _projVec.x <= 0.9 &&
        _projVec.y >= -0.95 &&
        _projVec.y <= 0.95
      ) {
        labels.push({
          ...base,
          id: `${base.id}__p1`,
          x: ((_projVec.x + 1) / 2) * halfW,
          y: (-(_projVec.y - 1) / 2) * h,
          visible: true,
        });
      }

      // Right Pane (Player 2)
      _projVec.set(wx, wy, wz);
      _projVec.project(this.camera2);
      if (
        _projVec.z > -1 &&
        _projVec.z < 1 &&
        _projVec.x >= -0.9 &&
        _projVec.x <= 0.9 &&
        _projVec.y >= -0.95 &&
        _projVec.y <= 0.95
      ) {
        labels.push({
          ...base,
          id: `${base.id}__p2`,
          x: halfW + ((_projVec.x + 1) / 2) * rightW,
          y: (-(_projVec.y - 1) / 2) * h,
          visible: true,
        });
      }
    };

    const firstBuiltKitchenShop = RENTABLE_BUILDINGS.find(
      (b) =>
        builtKitchenIds.has(b.id) &&
        world.rentedShops.some((r) => r.buildingId === b.id)
    );
    const activeRentedBuilding =
      (activeInsideShopId &&
      builtKitchenIds.has(activeInsideShopId) &&
      world.rentedShops.some((r) => r.buildingId === activeInsideShopId)
        ? RENTABLE_BUILDINGS.find((b) => b.id === activeInsideShopId)
        : null) ??
      (world.hasTeaStall === false ? firstBuiltKitchenShop ?? null : null);
    const activeKitchenStations = activeRentedBuilding
      ? getShopKitchenStations(activeRentedBuilding)
      : null;

    if (shift.kettle.status !== 'idle') {
      const kettlePos = activeKitchenStations
        ? activeKitchenStations.kettle
        : STATIONS.kettle;
      if (activeKitchenStations || world.hasTeaStall !== false) {
        const kettleInfo = shift.kettle.brewingDrink
          ? DRINK_CATALOG[shift.kettle.brewingDrink]
          : undefined;
        const dName = kettleInfo ? kettleInfo.name : 'Chai';
        pushLabel(
          {
            id: 'kettle',
            kind: 'kettle',
            text:
              shift.kettle.status === 'ready'
                ? `${dName} Ready! [E]`
                : `Boiling ${dName} ${Math.round(shift.kettle.progress * 100)}%`,
            progress: shift.kettle.progress,
          },
          kettlePos.x,
          2.2,
          kettlePos.z
        );
      }
    }

    if (world.hasSnacksCart && shift.fryer.status !== 'idle') {
      const fInfo = shift.fryer.fryingSnack
        ? DRINK_CATALOG[shift.fryer.fryingSnack]
        : undefined;
      const sName = fInfo ? fInfo.name : 'Samosa';
      pushLabel(
        {
          id: 'fryer',
          kind: 'fryer',
          text:
            shift.fryer.status === 'ready'
              ? `Hot ${sName} Ready! [E]`
              : `Frying ${sName} ${Math.round(shift.fryer.progress * 100)}%`,
          progress: shift.fryer.progress,
        },
        SNACK_STATIONS.kadhai.x,
        2.15,
        SNACK_STATIONS.kadhai.z
      );
    }

    if (hasColdCart && chillerState.status !== 'idle') {
      const cInfo = chillerState.chillingItem
        ? DRINK_CATALOG[chillerState.chillingItem]
        : undefined;
      const cName = cInfo ? cInfo.name : 'Cold Drink';
      pushLabel(
        {
          id: 'chiller',
          kind: 'chiller',
          text:
            chillerState.status === 'ready'
              ? `${cName} Frozen! [E]`
              : `Chilling ${cName} ${Math.round(chillerState.progress * 100)}%`,
          progress: chillerState.progress,
        },
        COLD_STATIONS.chiller.x,
        2.15,
        COLD_STATIONS.chiller.z
      );
      void CHILLING_DURATION;
    }

    const activeTraySpots = activeKitchenStations
      ? activeKitchenStations.trays
      : TRAY_SPOTS;
    if (activeKitchenStations || world.hasTeaStall !== false) {
      for (let idx = 0; idx < activeTraySpots.length; idx++) {
        const item = trays[idx];
        if (item && HELD_ITEM_LABELS[item]) {
          const spot = activeTraySpots[idx];
          pushLabel(
            {
              id: `counter_tray_${idx}`,
              kind: 'counter_tray',
              text: HELD_ITEM_LABELS[item],
            },
            spot.x,
            1.52,
            spot.z
          );
        }
      }
    }

    if (world.hasSnacksCart) {
      for (let idx = 0; idx < SNACK_TRAY_SPOTS.length; idx++) {
        const item = snackTrays[idx];
        if (item && HELD_ITEM_LABELS[item]) {
          const spot = SNACK_TRAY_SPOTS[idx];
          pushLabel(
            {
              id: `snack_tray_${idx}`,
              kind: 'counter_tray',
              text: HELD_ITEM_LABELS[item],
            },
            spot.x,
            1.52,
            spot.z
          );
        }
      }
    } else {
      const hasSnacksRecipe =
        world.unlockedRecipes.includes('samosa') ||
        world.unlockedRecipes.includes('pakora');
      pushLabel(
        {
          id: 'snacks_plot',
          kind: 'snacks_plot',
          text: hasSnacksRecipe
            ? `Order 2nd Readi (${formatMoney(SNACKS_CART_PRICE_CENTS)}) at Wood Master [E]`
            : '2nd Readi Spot (Learn Samosa Recipe First)',
        },
        SNACKS_CART_ANCHOR.x,
        2.05,
        SNACKS_CART_ANCHOR.z
      );
    }

    if (hasColdCart) {
      for (let idx = 0; idx < COLD_TRAY_SPOTS.length; idx++) {
        const item = coldTrays[idx];
        if (item && HELD_ITEM_LABELS[item]) {
          const spot = COLD_TRAY_SPOTS[idx];
          pushLabel(
            {
              id: `cold_tray_${idx}`,
              kind: 'counter_tray',
              text: HELD_ITEM_LABELS[item],
            },
            spot.x,
            1.52,
            spot.z
          );
        }
      }
    } else {
      const hasColdRecipe =
        world.unlockedRecipes.includes('cold_drink') ||
        world.unlockedRecipes.includes('ice_cream');
      pushLabel(
        {
          id: 'cold_plot',
          kind: 'cold_plot',
          text: hasColdRecipe
            ? `Order 3rd Cold Readi (${formatMoney(COLD_CART_PRICE_CENTS)}) at Wood Master [E]`
            : '3rd Cold Readi Spot (Learn Cold Recipe First)',
        },
        COLD_CART_ANCHOR.x,
        2.05,
        COLD_CART_ANCHOR.z
      );
    }

    // Stall / Kitchen "OUT OF STOCK" Labels when ingredients are missing
    const outOfStockDrinks = (['tea', 'doodh_patti', 'coffee'] as const).filter(
      (d) =>
        world.unlockedRecipes.includes(d) &&
        isMenuItemEnabled(world, d) &&
        !getDrinkStockStatus(d, shift).inStock
    );
    if (
      outOfStockDrinks.length > 0 &&
      (activeKitchenStations || world.hasTeaStall !== false)
    ) {
      const wx = activeKitchenStations
        ? (activeKitchenStations.kettle.x +
            activeKitchenStations.cupcake_box.x) /
          2
        : CYCLE_ANCHOR.x;
      const wy = activeKitchenStations ? 2.42 : 2.78;
      const wz = activeKitchenStations
        ? activeKitchenStations.kettle.z
        : CYCLE_ANCHOR.z;
      pushLabel(
        {
          id: 'stall_out_of_stock',
          kind: 'out_of_stock',
          text: 'OUT OF STOCK',
          subText: outOfStockDrinks
            .map(
              (d) =>
                `${DRINK_CATALOG[d].name} (${getDrinkStockStatus(d, shift).missing.join(', ')})`
            )
            .join(' · '),
          urgent: true,
        },
        wx,
        wy,
        wz
      );
    }

    if (world.hasSnacksCart) {
      const outOfStockSnacks = (['samosa', 'pakora'] as const).filter(
        (d) =>
          world.unlockedRecipes.includes(d) &&
          isMenuItemEnabled(world, d) &&
          !getDrinkStockStatus(d, shift).inStock
      );
      if (outOfStockSnacks.length > 0) {
        pushLabel(
          {
            id: 'snacks_out_of_stock',
            kind: 'out_of_stock',
            text: 'OUT OF STOCK',
            subText: outOfStockSnacks
              .map(
                (d) =>
                  `${DRINK_CATALOG[d].name} (${getDrinkStockStatus(d, shift).missing.join(', ')})`
              )
              .join(' · '),
            urgent: true,
          },
          SNACKS_CART_ANCHOR.x,
          2.68,
          SNACKS_CART_ANCHOR.z
        );
      }
    }

    if (hasColdCart) {
      const outOfStockCold = (['cold_drink', 'ice_cream'] as const).filter(
        (d) =>
          world.unlockedRecipes.includes(d) &&
          isMenuItemEnabled(world, d) &&
          !getDrinkStockStatus(d, shift).inStock
      );
      if (outOfStockCold.length > 0) {
        pushLabel(
          {
            id: 'cold_out_of_stock',
            kind: 'out_of_stock',
            text: 'OUT OF STOCK',
            subText: outOfStockCold
              .map(
                (d) =>
                  `${DRINK_CATALOG[d].name} (${getDrinkStockStatus(d, shift).missing.join(', ')})`
              )
              .join(' · '),
            urgent: true,
          },
          COLD_CART_ANCHOR.x,
          2.68,
          COLD_CART_ANCHOR.z
        );
      }
    }

    // All 3 Poor Kid / Helper NPC Labels (Mat, Hungry Begging at Readi, Eating Free, Corner Marketing, Hired)
    for (const h of getShiftHelpers(shift)) {
      const hId: HelperNpcId = h.id ?? 'chotu';
      const cfg = HELPER_NPCS[hId];
      const begState = h.beggingState ?? 'at_mat';
      if (h.status === 'sitting') {
        if (begState === 'begging_at_stall') {
          const bDrink = h.beggingDrink ?? 'tea';
          const info = DRINK_CATALOG[bDrink] ?? DRINK_CATALOG.tea;
          const secs = Math.ceil(h.beggingPatience ?? 0);
          const ratio = Math.max(
            0,
            (h.beggingPatience ?? 0) / Math.max(1, h.beggingMaxPatience ?? 120)
          );
          pushLabel(
            {
              id: `helper_kid_${hId}`,
              kind: 'beggar_kid',
              text: `${cfg.name} (Hungry) · Free ${info.name} ($0)`,
              subText: h.heldByHelperName
                ? `${h.heldByHelperName} Holding (${secs}s) [E]/[F]`
                : `${secs}s [E]/[F]`,
              progress: ratio,
              urgent: secs < 25,
            },
            h.x,
            1.65,
            h.z
          );
        } else if (begState === 'walking_to_stall') {
          pushLabel(
            {
              id: `helper_kid_${hId}`,
              kind: 'beggar_kid',
              text: `${cfg.name} (Hungry · Walking to Readi)`,
              subText: 'Free Meal -> Corner Marketing',
            },
            h.x,
            1.58,
            h.z
          );
        } else if (begState === 'eating_free') {
          pushLabel(
            {
              id: `helper_kid_${hId}`,
              kind: 'beggar_kid',
              text: `${cfg.name} · Enjoying Free Meal!`,
              subText: 'Marketing Next',
            },
            h.x,
            1.65,
            h.z
          );
        } else if (begState === 'returning_marketing') {
          pushLabel(
            {
              id: `helper_kid_${hId}`,
              kind: 'helper',
              text: `${cfg.name} -> Corner Spot`,
              subText: 'Starting Marketing!',
            },
            h.x,
            1.58,
            h.z
          );
        } else if (begState === 'marketing') {
          const secs = Math.ceil(h.marketingTimer ?? 0);
          pushLabel(
            {
              id: `helper_kid_${hId}`,
              kind: 'beggar_kid',
              text: `${cfg.name} · MARKETING! (+Sales)`,
              subText: `${secs}s · Calling Crowd`,
            },
            h.x,
            1.72,
            h.z
          );
        } else {
          const subText =
            cfg.requiresSnacksCart && !world.hasSnacksCart
              ? '$0.25 Help (Samosa Cart Unlocks Hire)'
              : '$0.25 Help / Hire';
          pushLabel(
            {
              id: `helper_kid_${hId}`,
              kind: 'helper',
              text:
                cfg.gender === 'girl'
                  ? `Poor Girl (${cfg.name}) [E]`
                  : `Poor Boy (${cfg.name}) [E]`,
              subText,
            },
            h.x,
            1.48,
            h.z
          );
        }
      } else {
        pushLabel(
          {
            id: `helper_kid_${hId}`,
            kind: 'helper',
            text:
              cfg.role === 'snacks_only'
                ? `${cfg.name} (Samosa Helper)`
                : `${cfg.name} (Helper)`,
            subText: h.statusNote || 'Working',
          },
          h.x,
          1.58,
          h.z
        );
    // Building Owner Labels (for all 3 Rentable Street Shops)
    for (const b of RENTABLE_BUILDINGS) {
      const rec = world.rentedShops.find((r) => r.buildingId === b.id);
      const isDue = Boolean(rec && world.day >= rec.nextRentDueDay);
      const ownerAway = Boolean(rec && world.day < rec.nextRentDueDay);
      pushLabel(
        {
          id: `building_owner_${b.id}`,
          kind: 'building_owner',
          text: !rec
            ? `${b.ownerName} ? ${b.shopName}`
            : ownerAway
              ? `${b.shopName} (Rented)`
              : isDue
                ? `${b.ownerName} ? RENT DUE!`
                : `${b.ownerName} ? ${b.shopName}`,
          subText: !rec
            ? `${formatMoney(b.weeklyRentCents)}/wk [E]`
            : ownerAway
              ? `Owner returns Day ${rec.nextRentDueDay}`
              : isDue
                ? `${formatMoney(b.weeklyRentCents)} due now [E]`
                : `Paid until Day ${rec.nextRentDueDay}`,
          urgent: isDue,
        },
        b.ownerPos.x,
        2.05,
        b.ownerPos.z
      );
    }
        b.ownerPos.z
      );
    }

    // Second-Hand Gear Buyer NPC Label
    pushLabel(
      {
        id: 'gear_buyer',
        kind: 'gear_buyer',
        text: `${BUYER_SHOP.buyerName} · Gear Buyer`,
        subText: 'Sell -50% [E]',
      },
      BUYER_SHOP.buyerPos.x,
      2.05,
      BUYER_SHOP.buyerPos.z
    );

    // Wood Master Workshop NPC Label (Highlights urgently when any order is READY!)
    const nextReady = readyWoodOrders[0];
    const nextBuilding = buildingWoodOrders[0];
    pushLabel(
      {
        id: 'wood_master',
        kind: 'wood_master',
        text: nextReady
          ? `${WOOD_MASTER_SHOP.masterName} · ORDER READY!`
          : `${WOOD_MASTER_SHOP.masterName} · Wood Master`,
        subText: nextReady
          ? `Receive ${nextReady.label} [E]`
          : nextBuilding
            ? `Building ${Math.ceil(nextBuilding.remainingSec)}s`
            : 'Order Craft [E]',
        urgent: Boolean(nextReady),
      },
      WOOD_MASTER_SHOP.masterPos.x,
      2.05,
      WOOD_MASTER_SHOP.masterPos.z
    );

    // City Micro Bank NPC Label
    const activeLoan = world.activeLoan?.status === 'active' ? world.activeLoan : null;
    pushLabel(
      {
        id: 'bank',
        kind: 'bank',
        text: `${BANK_SHOP.bankerName} · Bank`,
        subText: activeLoan
          ? `Loan ${formatMoney(activeLoan.remainingDueCents)} (${activeLoan.daysRemaining}d)`
          : 'Loan Available [E]',
        urgent: Boolean(activeLoan && activeLoan.daysRemaining <= 1),
      },
      BANK_SHOP.bankerPos.x,
      2.0,
      BANK_SHOP.bankerPos.z
    );

    // Co-Op Partner Overhead Markers when 2-Player Co-Op is Active
    if (p2) {
      pushLabel(
        {
          id: 'coop_p1',
          kind: 'coop_partner',
          text: 'P1 (You)',
        },
        p.x,
        p.sittingChairId ? 1.85 : 2.02,
        p.z
      );
      pushLabel(
        {
          id: 'coop_p2',
          kind: 'coop_partner',
          text: 'P2 (Partner)',
        },
        p2.x,
        p2.sittingChairId ? 1.85 : 2.02,
        p2.z
      );
    }

    for (const c of shift.customers) {
      if (c.status === 'waiting') {
        const ratio = Math.max(0, c.patience / c.maxPatience);
        const info = DRINK_CATALOG[c.orderDrink] ?? DRINK_CATALOG.tea;
        const priceCents = applySalesBoostCents(info.priceCents, shift);
        pushLabel(
          {
            id: c.id,
            kind: 'customer',
            text: `${info.name} ${formatMoney(priceCents)}`,
            subText: ratio < 0.28 ? 'HURRY' : undefined,
            progress: ratio,
            urgent: ratio < 0.28,
          },
          c.x,
          c.seatedChairId ? 1.85 : 1.72,
          c.z
        );
      }
    }

    if (owner.phase === 'ordering_chai') {
      const ratio = Math.max(0, owner.patience / owner.maxPatience);
      const info = DRINK_CATALOG[owner.orderDrink] ?? DRINK_CATALOG.tea;
      const priceCents = applySalesBoostCents(info.priceCents, shift);
      pushLabel(
        {
          id: 'owner_customer',
          kind: 'owner',
          text: `Mart Owner: ${info.name} ${formatMoney(priceCents)}`,
          subText: ratio < 0.28 ? 'HURRY' : '[E]/[F]',
          progress: ratio,
          urgent: ratio < 0.28,
        },
        owner.x,
        1.75,
        owner.z
      );
    } else if (
      owner.phase === 'walking_to_stall' ||
      owner.phase === 'stroll_outside'
    ) {
      pushLabel(
        {
          id: 'owner_roam',
          kind: 'owner',
          text:
            owner.phase === 'walking_to_stall'
              ? 'Mart Owner (Coming to Buy)'
              : 'Mart Owner',
        },
        owner.x,
        2.05,
        owner.z
      );
    }

    for (const v of shopVisitors) {
      if (v.phase === 'at_shop') continue;
      if (v.phase === 'ordering') {
        const ratio = Math.max(0, v.patience / Math.max(1, v.maxPatience));
        const info = DRINK_CATALOG[v.orderDrink] ?? DRINK_CATALOG.tea;
        const priceCents = applySalesBoostCents(info.priceCents, shift);
        pushLabel(
          {
            id: `visitor_${v.id}`,
            kind: 'shop_visitor',
            text: `${v.name}: ${info.name} ${formatMoney(priceCents)}`,
            subText: ratio < 0.28 ? 'HURRY' : '[E]/[F]',
            progress: ratio,
            urgent: ratio < 0.28,
          },
          v.x,
          1.78,
          v.z
        );
      } else if (
        v.phase === 'walking_to_stall' ||
        v.phase === 'returning_to_shop'
      ) {
        pushLabel(
          {
            id: `visitor_roam_${v.id}`,
            kind: 'shop_visitor',
            text:
              v.phase === 'walking_to_stall'
                ? `${v.name} (Coming to Buy)`
                : v.name,
          },
          v.x,
          2.0,
          v.z
        );
      }
    }

    for (const bk of getShiftBeggarKids(shift)) {
      if (bk.status === 'waiting') {
        const ratio = Math.max(0, bk.patience / Math.max(1, bk.maxPatience));
        const info = DRINK_CATALOG[bk.orderDrink] ?? DRINK_CATALOG.tea;
        const secs = Math.ceil(bk.patience);
        pushLabel(
          {
            id: `beggar_${bk.id}`,
            kind: 'beggar_kid',
            text: `Poor Kid · Free ${info.name} ($0)`,
            subText: bk.heldByHelperName
              ? `${bk.heldByHelperName} Holding (${secs}s) [E]/[F]`
              : `${secs}s [E]/[F]`,
            progress: ratio,
            urgent: secs < 25,
          },
          bk.x,
          1.48,
          bk.z
        );
      } else if (bk.status === 'walking_in') {
        pushLabel(
          {
            id: `beggar_in_${bk.id}`,
            kind: 'beggar_kid',
            text: 'Poor Kid (Free Meal · +10% Sales)',
          },
          bk.x,
          1.48,
          bk.z
        );
      } else if (bk.status === 'marketing') {
        const secs = Math.ceil(bk.marketingTimer ?? 0);
        pushLabel(
          {
            id: `beggar_mkt_${bk.id}`,
            kind: 'beggar_kid',
            text: 'Poor Kid · MARKETING! (+10% Sales)',
            subText: `${secs}s · Calling Crowd`,
          },
          bk.x,
          1.66,
          bk.z
        );
      }
    }

    if (car.phase === 'waiting') {
      const ratio = Math.max(0, car.patience / car.maxPatience);
      const info = DRINK_CATALOG[car.orderDrink] ?? DRINK_CATALOG.tea;
      const priceCents = applySalesBoostCents(info.priceCents, shift);
      pushLabel(
        {
          id: 'car_customer',
          kind: 'car',
          text: `Car: ${car.qtyServed}/${car.qtyTotal} ${info.name} (${formatMoney(priceCents)})`,
          subText: ratio < 0.28 ? 'HURRY' : '[E]/[F]',
          progress: ratio,
          urgent: ratio < 0.28,
        },
        car.x,
        1.85,
        car.z
      );
    }

    if (mk.phase === 'parked') {
      pushLabel(
        {
          id: 'milkman',
          kind: 'milkman',
          text: 'Milkman [E] Milk Packets',
          subText: `${Math.ceil(mk.timer)}s`,
        },
        mk.x,
        2.15,
        mk.z
      );
    }

    pushLabel(
      {
        id: 'water_tap',
        kind: 'water_tap',
        text: 'Free Water [E]',
      },
      WATER_TAP_POS.x,
      1.65,
      WATER_TAP_POS.z
    );

    pushLabel(
      {
        id: 'trash_bin',
        kind: 'trash',
        text: 'Trash Bin',
      },
      TRASH_BIN_POS.x,
      1.35,
      TRASH_BIN_POS.z
    );

    pushLabel(
      {
        id: 'supermarket',
        kind: 'supermarket',
        text: isOwnerInsideSupermarket(owner)
          ? 'Chai Supermarket [E]'
          : 'Supermarket (Owner Away)',
      },
      SUPERMARKET_COUNTER_POS.x + 1.9,
      2.45,
      SUPERMARKET_COUNTER_POS.z - 0.4
    );

    if (world.pendingFurniture.length > 0) {
      pushLabel(
        {
          id: 'wood_master_pickup',
          kind: 'supermarket_pickup',
          text: `Pickup Furniture (${world.pendingFurniture.length}) [E]`,
        },
        WOOD_MASTER_SHOP.pickupPos.x,
        1.5,
        WOOD_MASTER_SHOP.pickupPos.z
      );
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
