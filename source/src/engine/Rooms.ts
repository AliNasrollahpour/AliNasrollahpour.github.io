// ساختِ هندسهٔ پنج اتاق از روی نقشه (fig-map): چهار اتاقِ مربعی در گوشه‌ها، هشت‌ضلعیِ اصلی در وسط.
// همهٔ پراپ‌ها از primitive ساخته می‌شوند و هر پراپِ تعاملی با یک «interact id» ثبت می‌شود.
// جزئیات با هندسه‌های گوشه‌گرد، instancing و سایهٔ نرمِ کانواسی اضافه شده تا صحنه سبک بماند.
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { gameData, roomById, puzzleById, clueById, type RoomId } from '../data/game-data';
import type { GameState } from '../game/GameState';
import {
  textTexture, humansCanvas, canvasTexture, adsCanvas, blackboardCanvas, liarCanvas, chartCanvas, blobShadowTexture,
} from './textures';

export interface Interactable {
  id: string;
  room: RoomId;
  object: THREE.Object3D;
  label: string;
  /** ارتفاعِ نشانِ ⓘ بالای شیء. */
  badgeY: number;
  /** اگر برگرداند false، شیء فعلاً قابل‌کلیک نیست (مثلاً دکمهٔ پروتکل قبل از باز شدنِ دریچه). */
  enabled?: (s: GameState) => boolean;
}

export interface World {
  root: THREE.Group;
  centers: Record<RoomId, THREE.Vector3>;
  floors: THREE.Mesh[];
  walls: Record<RoomId, THREE.Mesh[]>;
  interactables: Interactable[];
  labels: Record<RoomId, CSS2DObject>;
  /** نقطه‌ای در جهان برای فوکوسِ دوربین (مثلاً قفلِ مرتفعِ D25). */
  focusPoints: Record<string, THREE.Vector3>;
  sync: (s: GameState) => void;
  update: (dt: number) => void;
}

export const ROOM_HALF = 5;
const CHAMFER = 2.5;
const WALL_H = 2.6;
const DOOR_W = 1.5;
const DOOR_H = 2.15;
const OCT_R = 6.5;
const GOLD = '#f2c94c';

export const CENTERS: Record<RoomId, [number, number]> = {
  room1: [-14, -14],
  room3: [14, -14],
  room2: [14, 14],
  room4: [-14, 14],
  room5: [0, 0],
};

const OCT_APOTHEM = OCT_R * Math.cos(Math.PI / 8);
const diag = (sx: number, sz: number): [number, number] => [(sx * OCT_APOTHEM) / Math.SQRT2, (sz * OCT_APOTHEM) / Math.SQRT2];
const cham = 5 - CHAMFER / 2;

/** محلِ هر در روی دیوارِ هر اتاق (مختصاتِ محلیِ اتاق). */
const DOOR_POS: Record<string, Partial<Record<RoomId, [number, number]>>> = {
  E13: { room1: [5, 0], room3: [-5, 0] },
  E14: { room1: [0, 5], room4: [0, -5] },
  E23: { room2: [0, -5], room3: [0, 5] },
  E24: { room2: [-5, 0], room4: [5, 0] },
  E25: { room2: [-cham, -cham], room5: diag(1, 1) },
  E35: { room3: [-cham, cham], room5: diag(1, -1) },
  E45: { room4: [cham, -cham], room5: diag(-1, 1) },
  E51: { room5: diag(-1, -1), room1: [cham, cham] },
  VENT: { room2: [5, 2.5], room1: [-5, -2.5] },
};

type Anim = { obj: THREE.Object3D; key: 'rx' | 'ry' | 'rz' | 'py' | 'px' | 'sy'; target: number };
type Fx = { t0: number; dur: number; step: (k: number) => void; done?: () => void };

const UP = new THREE.Vector3(0, 1, 0);
const easeOut = (k: number) => 1 - (1 - k) ** 3;
const easeInOut = (k: number) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);

// ───────── سازنده‌های هندسه ─────────
const geoCache = new Map<string, THREE.BufferGeometry>();
function cached<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key);
  if (!g) geoCache.set(key, (g = make()));
  return g as T;
}

function std(color: THREE.ColorRepresentation, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...extra });
}

function box(w: number, h: number, d: number, color: string | number, x = 0, y = 0, z = 0, extra?: Partial<THREE.MeshStandardMaterialParameters>) {
  const m = new THREE.Mesh(cached(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), std(color, extra));
  m.position.set(x, y, z);
  return m;
}

/** جعبهٔ گوشه‌گرد — لبه‌ها نور می‌گیرند و اشیا کمتر «کارتنی» به نظر می‌رسند. */
function rbox(w: number, h: number, d: number, color: string | number, x = 0, y = 0, z = 0, extra?: Partial<THREE.MeshStandardMaterialParameters>, radius?: number) {
  const r = radius ?? Math.min(0.05, Math.min(w, h, d) * 0.18);
  const m = new THREE.Mesh(cached(`r${w},${h},${d},${r}`, () => new RoundedBoxGeometry(w, h, d, 2, r)), std(color, extra));
  m.position.set(x, y, z);
  return m;
}

function cyl(rt: number, rb: number, h: number, color: string | number, x = 0, y = 0, z = 0, seg = 28, extra?: Partial<THREE.MeshStandardMaterialParameters>) {
  const m = new THREE.Mesh(cached(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)), std(color, extra));
  m.position.set(x, y, z);
  return m;
}

function sphere(r: number, color: string | number, x = 0, y = 0, z = 0, extra?: Partial<THREE.MeshStandardMaterialParameters>) {
  const m = new THREE.Mesh(cached(`s${r}`, () => new THREE.SphereGeometry(r, 28, 20)), std(color, extra));
  m.position.set(x, y, z);
  return m;
}

function capsule(r: number, len: number, color: string | number, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(cached(`k${r},${len}`, () => new THREE.CapsuleGeometry(r, len, 6, 14)), std(color));
  m.position.set(x, y, z);
  return m;
}

function torus(r: number, tube: number, color: string | number, arc = Math.PI * 2, extra?: Partial<THREE.MeshStandardMaterialParameters>) {
  return new THREE.Mesh(cached(`t${r},${tube},${arc}`, () => new THREE.TorusGeometry(r, tube, 10, 32, arc)), std(color, extra));
}

function plane(w: number, h: number, map: THREE.Texture) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map, roughness: 0.85 }));
}

function shadowBlob(w: number, d: number, x: number, z: number, opacity = 0.8) {
  const m = new THREE.Mesh(
    cached('blob', () => new THREE.PlaneGeometry(1, 1)),
    new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, opacity, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.scale.set(w, d, 1);
  m.position.set(x, 0.012, z);
  m.renderOrder = 1;
  return m;
}

/** چند جعبهٔ کوچک با یک draw call (کلیدهای کیبورد، کتاب‌ها). */
function instancedBoxes(items: { p: [number, number, number]; s: [number, number, number]; c: string; ry?: number }[], extra?: Partial<THREE.MeshStandardMaterialParameters>) {
  const mesh = new THREE.InstancedMesh(cached('unitR', () => new RoundedBoxGeometry(1, 1, 1, 1, 0.12)), std('#ffffff', extra), items.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();
  items.forEach((it, i) => {
    q.setFromAxisAngle(UP, it.ry ?? 0);
    m.compose(new THREE.Vector3(...it.p), q, new THREE.Vector3(...it.s));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, col.set(it.c));
  });
  return mesh;
}

/** چندضلعیِ اتاقِ گوشه (مختصات محلی) با گوشهٔ داخلیِ پخ‌خورده رو به مرکز. */
function cornerPolygon(room: RoomId): [number, number][] {
  const [cx, cz] = CENTERS[room];
  const inner: [number, number] = [-5 * Math.sign(cx), -5 * Math.sign(cz)];
  const sq: [number, number][] = [[-5, -5], [5, -5], [5, 5], [-5, 5]];
  const out: [number, number][] = [];
  sq.forEach((p, i) => {
    if (p[0] !== inner[0] || p[1] !== inner[1]) return void out.push(p);
    const prev = sq[(i + 3) % 4];
    const next = sq[(i + 1) % 4];
    const towards = (q: [number, number]): [number, number] => {
      const dx = q[0] - p[0], dz = q[1] - p[1];
      const l = Math.hypot(dx, dz);
      return [p[0] + (dx / l) * CHAMFER, p[1] + (dz / l) * CHAMFER];
    };
    out.push(towards(prev), towards(next));
  });
  return out;
}

function octPolygon(): [number, number][] {
  return Array.from({ length: 8 }, (_, k) => {
    const a = Math.PI / 8 + (k * Math.PI) / 4;
    return [OCT_R * Math.cos(a), OCT_R * Math.sin(a)] as [number, number];
  });
}

/** نقطه را روی دیوارِ نزدیک‌ترش می‌نشاند: [اندیسِ ضلع، t]. */
function locateOnWall(poly: [number, number][], p: [number, number]) {
  let best = { i: 0, t: 0, d: Infinity };
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2));
    const d = Math.hypot(a[0] + dx * t - p[0], a[1] + dz * t - p[1]);
    if (d < best.d) best = { i, t, d };
  });
  return best;
}

function keyMesh(color = GOLD) {
  const k = new THREE.Group();
  const m = std(color, { metalness: 0.9, roughness: 0.25, emissive: new THREE.Color('#5a4200'), emissiveIntensity: 0.4 });
  const ring = new THREE.Mesh(cached('keyRing', () => new THREE.TorusGeometry(0.09, 0.028, 10, 24)), m);
  ring.rotation.x = Math.PI / 2;
  k.add(ring);
  const shaft = new THREE.Mesh(cached('keyShaft', () => new THREE.CylinderGeometry(0.022, 0.022, 0.32, 10)), m);
  shaft.rotation.z = Math.PI / 2;
  shaft.position.x = 0.25;
  k.add(shaft);
  for (const [x, w] of [[0.34, 0.07], [0.27, 0.05]] as const) {
    const bit = new THREE.Mesh(cached(`keyBit${w}`, () => new THREE.BoxGeometry(0.035, 0.03, w)), m);
    bit.position.set(x, 0, w / 2 + 0.01);
    k.add(bit);
  }
  return k;
}

function coinMesh(value: string) {
  const g = new THREE.Group();
  const c = cyl(0.12, 0.12, 0.02, '#e0c068', 0, 0, 0, 32, { metalness: 0.85, roughness: 0.3 });
  g.add(c);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.1, 28), new THREE.MeshStandardMaterial({
    map: textTexture([value], { bg: '#e0c068', fg: '#6b4f12', size: 120, w: 256, h: 256, dir: 'ltr' }), metalness: 0.6, roughness: 0.35,
  }));
  face.rotation.x = -Math.PI / 2;
  face.position.y = 0.011;
  g.add(face);
  return g;
}

export function buildWorld(): World {
  const root = new THREE.Group();
  const centers = {} as Record<RoomId, THREE.Vector3>;
  const floors: THREE.Mesh[] = [];
  const walls = {} as Record<RoomId, THREE.Mesh[]>;
  const labels = {} as Record<RoomId, CSS2DObject>;
  const interactables: Interactable[] = [];
  const focusPoints: Record<string, THREE.Vector3> = {};
  const syncers: ((s: GameState) => void)[] = [];
  const anims: Anim[] = [];
  const fxs: Fx[] = [];
  const tickers: ((t: number) => void)[] = [];

  /** حرکتِ نرمِ پیوسته به سمتِ یک مقدارِ هدف (درها، درپوش‌ها). */
  const anim = (obj: THREE.Object3D, key: Anim['key'], target: number) => {
    const a = anims.find((x) => x.obj === obj && x.key === key);
    if (a) a.target = target;
    else anims.push({ obj, key, target });
  };

  /** انیمیشنِ یک‌باره با زمانِ واقعی. */
  const play = (dur: number, step: (k: number) => void, done?: () => void, delay = 0) => {
    fxs.push({ t0: performance.now() + delay * 1000, dur: dur * 1000, step, done });
  };

  /**
   * گذارِ یک وضعیتِ بولی. `animate` فقط وقتی true است که مقدار در همین دور از false به true رفته باشد؛
   * سینکِ اول و ریست بدونِ انیمیشن اعمال می‌شوند.
   */
  const onChange = (get: (s: GameState) => boolean, apply: (on: boolean, animate: boolean) => void) => {
    let prev: boolean | undefined;
    syncers.push((s) => {
      const v = get(s);
      if (v === prev) return;
      apply(v, prev === false && v);
      prev = v;
    });
  };

  /** کلید یا سکه بالا می‌پرد، می‌چرخد، می‌درخشد و جمع می‌شود. */
  const popCollect = (parent: THREE.Object3D, at: THREE.Vector3, kind: 'key' | 'coin', value = '', delay = 0) => {
    const item = kind === 'key' ? keyMesh() : coinMesh(value);
    if (kind === 'coin') item.rotation.x = Math.PI / 2;
    item.position.copy(at);
    item.visible = false;
    const ring = new THREE.Mesh(cached('popRing', () => new THREE.RingGeometry(0.06, 0.1, 40)), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(at);
    ring.visible = false;
    const glow = new THREE.PointLight(GOLD, 0, 2.5, 2);
    glow.position.copy(at);
    parent.add(item, ring, glow);
    play(1.4, (k) => {
      item.visible = ring.visible = true;
      const rise = easeOut(Math.min(k / 0.5, 1));
      item.position.y = at.y + rise * 0.75;
      item.rotation.y = k * Math.PI * 5;
      item.scale.setScalar(k < 0.7 ? 1 + 0.3 * Math.sin((k / 0.7) * Math.PI) : Math.max(0.001, 1 - (k - 0.7) / 0.3));
      ring.scale.setScalar(1 + k * 9);
      (ring.material as THREE.MeshBasicMaterial).opacity = 1 - k;
      glow.position.y = item.position.y;
      glow.intensity = Math.sin(k * Math.PI) * 3;
    }, () => parent.remove(item, ring, glow), delay);
  };

  const register = (room: RoomId, id: string, obj: THREE.Object3D, label: string, badgeY = 1.2, enabled?: Interactable['enabled']) => {
    obj.userData.interact = id;
    interactables.push({ id, room, object: obj, label, badgeY, enabled });
    return obj;
  };

  // ───────── کف، دیوار، در، نور ─────────
  const roomGroups = {} as Record<RoomId, THREE.Group>;
  for (const r of gameData.rooms) {
    const [cx, cz] = CENTERS[r.id];
    const g = new THREE.Group();
    g.position.set(cx, 0, cz);
    root.add(g);
    roomGroups[r.id] = g;
    centers[r.id] = new THREE.Vector3(cx, 0, cz);

    const poly = r.id === 'room5' ? octPolygon() : cornerPolygon(r.id);
    const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
    const floor = new THREE.Mesh(new THREE.ShapeGeometry(shape), std(r.palette.floor, { roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.userData.roomFloor = r.id;
    g.add(floor);
    floors.push(floor);

    // درهای این اتاق
    const doorsHere = gameData.doors
      .map((e) => ({ edge: e, pos: DOOR_POS[e.id]?.[r.id] }))
      .filter((d): d is { edge: typeof d.edge; pos: [number, number] } => !!d.pos);
    const located = doorsHere.map((d) => ({ ...d, ...locateOnWall(poly, d.pos) }));

    walls[r.id] = [];
    const wallMat = () => std(r.palette.wall, { transparent: true, opacity: 1, roughness: 0.85 });
    const trimColor = new THREE.Color(r.palette.wall).multiplyScalar(0.62);
    poly.forEach((a, i) => {
      const b = poly[(i + 1) % poly.length];
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const len = Math.hypot(dx, dz);
      const ang = Math.atan2(-dz, dx);
      const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const nrm = new THREE.Vector3(mid[0], 0, mid[1]).normalize(); // مرکزِ چندضلعی ≈ مبدأِ محلی
      // شکاف‌ها (فقط درهای واقعی؛ دریچه روی دیوار نصب می‌شود)
      const gaps = located
        .filter((d) => d.i === i && d.edge.id !== 'VENT')
        .map((d) => d.t * len)
        .sort((x, y) => x - y);
      let cursor = 0;
      const segs: [number, number][] = [];
      for (const gpos of gaps) {
        segs.push([cursor, gpos - DOOR_W / 2]);
        cursor = gpos + DOOR_W / 2;
      }
      segs.push([cursor, len]);
      const addWall = (s0: number, s1: number, y0: number, y1: number, baseboard: boolean) => {
        if (s1 - s0 < 0.01) return;
        const m = new THREE.Mesh(new THREE.BoxGeometry(s1 - s0, y1 - y0, 0.2), wallMat());
        const sm = (s0 + s1) / 2;
        m.position.set(a[0] + (dx / len) * sm, (y0 + y1) / 2, a[1] + (dz / len) * sm);
        m.rotation.y = ang;
        m.userData.normal = nrm;
        g.add(m);
        walls[r.id].push(m);
        // قرنیزِ پایین و نوارِ بالا: جزئیاتِ ارزان که دیوار را از «کارتن» بیرون می‌آورد
        for (const [yy, hh] of baseboard ? ([[0.06, 0.12], [WALL_H - 0.03, 0.06]] as const) : ([[WALL_H - 0.03, 0.06]] as const)) {
          const trim = new THREE.Mesh(new THREE.BoxGeometry(s1 - s0, hh, 0.26), std(trimColor, { transparent: true }));
          trim.position.set(m.position.x, yy, m.position.z);
          trim.rotation.y = ang;
          trim.userData.normal = nrm;
          g.add(trim);
          walls[r.id].push(trim);
        }
      };
      segs.forEach(([s0, s1]) => addWall(s0, s1, 0, WALL_H, true));
      gaps.forEach((gp) => addWall(gp - DOOR_W / 2, gp + DOOR_W / 2, DOOR_H, WALL_H, false));
    });

    for (const d of located) {
      const a = poly[d.i];
      const b = poly[(d.i + 1) % poly.length];
      const ang = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
      const isVent = d.edge.id === 'VENT';
      const side = d.edge.sides.find((s) => s.room === r.id)!;
      const dg = new THREE.Group();
      dg.position.set(d.pos[0], 0, d.pos[1]);
      dg.rotation.y = ang;
      g.add(dg);
      const inwardLocal = new THREE.Vector3(-d.pos[0], 0, -d.pos[1]).normalize().applyAxisAngle(UP, -ang);

      if (isVent) {
        const housing = rbox(1.2, 0.8, 0.08, '#3d434c', 0, 0.45, 0, { metalness: 0.5 });
        housing.position.addScaledVector(inwardLocal, 0.1);
        dg.add(housing);
        const grate = new THREE.Group();
        grate.position.set(0, 0.07, 0).addScaledVector(inwardLocal, 0.15);
        const gi = new THREE.Group(); // pivot در لبهٔ پایین
        gi.position.y = 0.38;
        grate.add(gi);
        gi.add(rbox(1.1, 0.7, 0.04, '#6b737e', 0, 0, 0, { metalness: 0.6, roughness: 0.4 }));
        for (let k = -4; k <= 4; k++) gi.add(box(0.035, 0.6, 0.06, '#2a2f36', k * 0.11, 0, 0.02));
        for (const sx of [-0.5, 0.5]) for (const sy of [-0.3, 0.3]) gi.add(cyl(0.02, 0.02, 0.03, '#aab', sx, sy, 0.03, 8).rotateX(Math.PI / 2));
        dg.add(grate);
        grate.position.y = 0.07;
        const label = r.id === 'room2' ? 'توریِ لقِ پایینِ دیوار' : 'دریچهٔ تهویه';
        register(r.id, `door:${d.edge.id}`, grate, label, 1.1, (s) => r.id === 'room2' || s.mode === 'guide' || s.openEdges.has('VENT'));
        onChange((s) => s.openEdges.has('VENT'), (open, animate) => {
          if (r.id !== 'room2') return;
          if (animate) {
            // اول کمی لق می‌خورد، بعد روی زمین می‌افتد
            play(0.9, (k) => {
              grate.rotation.z = k < 0.4 ? Math.sin(k * 60) * 0.04 * (1 - k / 0.4) : 0;
              const f = easeOut(Math.max(0, (k - 0.4) / 0.6));
              grate.rotation.x = -1.45 * f;
            });
          } else grate.rotation.x = open ? -1.45 : 0;
        });
        syncers.push((s) => (grate.visible = housing.visible = r.id === 'room2' || s.openEdges.has('VENT') || s.mode === 'guide'));
        continue;
      }

      // چارچوب
      for (const sx of [-1, 1]) dg.add(rbox(0.1, DOOR_H + 0.08, 0.28, '#2b2e35', sx * (DOOR_W / 2 + 0.02), (DOOR_H + 0.08) / 2, 0));
      dg.add(rbox(DOOR_W + 0.14, 0.1, 0.28, '#2b2e35', 0, DOOR_H + 0.04, 0));

      // درِ لولایی: pivot روی لبهٔ شکاف
      const pivot = new THREE.Group();
      pivot.position.set(-DOOR_W / 2 + 0.03, 0, 0);
      dg.add(pivot);
      const panelColor = side.push ? '#8a8f98' : d.edge.id === 'E14' && r.id === 'room1' ? '#4b3a2a' : '#59606b';
      const pw = DOOR_W - 0.06;
      const panel = rbox(pw, DOOR_H - 0.03, 0.08, panelColor, pw / 2, DOOR_H / 2, 0, { metalness: 0.3, roughness: 0.55 }, 0.02);
      pivot.add(panel);
      // قاب‌های برجستهٔ روی در (دو طرف)
      for (const side2 of [-1, 1]) {
        for (const [yy, hh] of [[0.52, 0.7], [1.42, 0.9]] as const) {
          const inset = rbox(pw - 0.34, hh, 0.02, new THREE.Color(panelColor).multiplyScalar(0.85).getStyle(), 0, yy - DOOR_H / 2, side2 * 0.045, {}, 0.008);
          panel.add(inset);
        }
      }
      // دستگیره/قفل/پانیک‌بار
      const handleSide = inwardLocal.z >= 0 ? 1 : -1;
      if (side.push) {
        const bar = cyl(0.03, 0.03, 1.0, '#c9ccd2', 0, -0.05, handleSide * 0.12, 16, { metalness: 0.9, roughness: 0.2 });
        bar.rotation.z = Math.PI / 2;
        panel.add(bar);
        for (const bx of [-0.45, 0.45]) panel.add(box(0.05, 0.05, 0.1, '#9aa0a8', bx, -0.05, handleSide * 0.07, { metalness: 0.8 }));
      } else {
        const lever = new THREE.Group();
        lever.position.set(pw / 2 - 0.16, -0.05, 0);
        for (const sd of [-1, 1]) {
          lever.add(cyl(0.035, 0.035, 0.06, '#cfd3d8', 0, 0, sd * 0.07, 16, { metalness: 0.9, roughness: 0.25 }).rotateX(Math.PI / 2));
          lever.add(rbox(0.16, 0.03, 0.03, '#cfd3d8', -0.07, 0, sd * 0.1, { metalness: 0.9, roughness: 0.25 }, 0.012));
        }
        panel.add(lever);
        if (side.puzzles?.length) {
          const pad = rbox(0.2, 0.3, 0.05, '#1d1f24', pw / 2 - 0.16, side.high ? 0.85 : 0.22, handleSide * 0.065, { metalness: 0.4 });
          pad.add(new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.06), new THREE.MeshBasicMaterial({ color: '#6dff9a' })).translateY(0.08).translateZ(handleSide * 0.027).rotateY(handleSide > 0 ? 0 : Math.PI));
          panel.add(pad);
        }
      }
      panel.userData.normal = new THREE.Vector3(d.pos[0], 0, d.pos[1]).normalize();
      walls[r.id].push(panel);
      // چراغِ وضعیت بالای در
      const lamp = new THREE.Mesh(cached('lamp', () => new THREE.SphereGeometry(0.09, 20, 14)), new THREE.MeshBasicMaterial({ color: '#888' }));
      lamp.position.set(0, DOOR_H + 0.22, 0).addScaledVector(inwardLocal, 0.16);
      dg.add(lamp);
      // در مختصاتِ گروهِ در، «رو به داخل» همیشه ±z است
      const lampBase = cyl(0.12, 0.12, 0.04, '#222', 0, 0, 0, 20);
      lampBase.rotation.x = Math.PI / 2;
      lampBase.position.copy(lamp.position).addScaledVector(inwardLocal, -0.05);
      dg.add(lampBase);
      if (side.high) {
        const highLock = new THREE.Group();
        highLock.position.set(0, DOOR_H + 0.3, 0).addScaledVector(inwardLocal, 0.17);
        highLock.rotation.y = inwardLocal.z < 0 ? Math.PI : 0;
        highLock.add(cyl(0.24, 0.24, 0.06, '#8a6a24', 0, 0, 0, 40, { metalness: 0.8, roughness: 0.3 }).rotateX(Math.PI / 2));
        const dial = cyl(0.17, 0.19, 0.08, '#d9b45a', 0, 0, 0.05, 40, { metalness: 0.85, roughness: 0.25 }).rotateX(Math.PI / 2);
        highLock.add(dial);
        for (let k = 0; k < 12; k++) {
          const tick = box(0.012, 0.04, 0.01, '#3a2a08', 0, 0, 0.1);
          tick.position.set(Math.sin((k / 12) * Math.PI * 2) * 0.14, Math.cos((k / 12) * Math.PI * 2) * 0.14, 0.095);
          tick.rotation.z = -(k / 12) * Math.PI * 2;
          highLock.add(tick);
        }
        dg.add(highLock);
        focusPoints[`${d.edge.id}:${r.id}`] = new THREE.Vector3(CENTERS[r.id][0] + d.pos[0], DOOR_H + 0.3, CENTERS[r.id][1] + d.pos[1]);
        onChange((s) => s.solved.has('P25a'), (_on, animate) => {
          if (animate) play(1.1, (k) => (dial.rotation.y = -easeInOut(k) * Math.PI * 3));
        });
      }
      register(r.id, `door:${d.edge.id}`, dg, `${side.doorId}`, DOOR_H + 0.5);
      const openSign = r.id === d.edge.between[0] ? 1 : -1;
      syncers.push((s) => {
        const open = s.openEdges.has(d.edge.id);
        anim(pivot, 'ry', open ? openSign * 1.45 : 0);
        const canHere = d.edge.openableFrom.includes(r.id);
        (lamp.material as THREE.MeshBasicMaterial).color.set(open ? '#3ddc84' : canHere ? '#ffb020' : '#e5484d');
      });
    }

    // نور
    const pl = new THREE.PointLight(r.palette.light, r.id === 'room2' ? 9 : r.id === 'room5' ? 10 : 22, 14, 1.6);
    pl.position.set(0, 2.4, 0);
    g.add(pl);

    // برچسبِ نقشه
    const el = document.createElement('div');
    el.className = 'room-label';
    el.dataset.room = r.id;
    el.innerHTML = `<b>${r.title}</b><span></span>`;
    const lbl = new CSS2DObject(el);
    lbl.position.set(0, r.id === 'room5' ? 4.2 : 3.4, 0);
    g.add(lbl);
    labels[r.id] = lbl;
  }

  // ───────── راهروها ─────────
  for (const e of gameData.doors) {
    if (e.id === 'VENT') continue;
    const [ra, rb] = e.between;
    const pa = DOOR_POS[e.id][ra]!, pb = DOOR_POS[e.id][rb]!;
    const A = new THREE.Vector3(CENTERS[ra][0] + pa[0], 0.01, CENTERS[ra][1] + pa[1]);
    const B = new THREE.Vector3(CENTERS[rb][0] + pb[0], 0.01, CENTERS[rb][1] + pb[1]);
    const len = A.distanceTo(B);
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(1.4, len), new THREE.MeshStandardMaterial({ color: '#30343c', emissive: '#000', roughness: 1 }));
    strip.rotation.x = -Math.PI / 2;
    strip.rotation.z = -Math.atan2(B.x - A.x, -(B.z - A.z));
    strip.position.copy(A).add(B).multiplyScalar(0.5);
    root.add(strip);
    const dir = new THREE.Vector3().subVectors(B, A).normalize();
    const perp = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(0.72);
    const ang = Math.atan2(-dir.z, dir.x);
    for (const sgn of [1, -1]) {
      const m = rbox(len, 0.5, 0.08, '#3a3f48', 0, 0, 0, {}, 0.02);
      m.rotation.y = ang;
      m.position.copy(strip.position).addScaledVector(perp, sgn).setY(0.25);
      root.add(m);
    }
    syncers.push((s) => {
      const open = s.openEdges.has(e.id);
      const mat = strip.material as THREE.MeshStandardMaterial;
      mat.color.set(open ? '#2f6b4a' : '#30343c');
      mat.emissive.set(open ? '#1c8a52' : '#000');
      mat.emissiveIntensity = open ? 0.6 : 0;
    });
  }

  // معبرِ مخفی: منحنیِ خط‌چین از روی سقف (فقط پس از کشف یا در حالت راهنما)
  {
    const a = DOOR_POS.VENT.room2!, b = DOOR_POS.VENT.room1!;
    const A = new THREE.Vector3(CENTERS.room2[0] + a[0], 0.5, CENTERS.room2[1] + a[1]);
    const B = new THREE.Vector3(CENTERS.room1[0] + b[0], 0.5, CENTERS.room1[1] + b[1]);
    const curve = new THREE.CubicBezierCurve3(A, new THREE.Vector3(10, 13, 10), new THREE.Vector3(-10, 13, -10), B);
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(80));
    const line = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: '#7fa7d9', dashSize: 0.8, gapSize: 0.5 }));
    line.computeLineDistances();
    root.add(line);
    const el = document.createElement('div');
    el.className = 'room-label secret';
    el.textContent = 'SECRET PASSAGE';
    const lbl = new CSS2DObject(el);
    lbl.position.copy(curve.getPoint(0.28));
    root.add(lbl);
    syncers.push((s) => {
      const show = !s.view && (s.openEdges.has('VENT') || s.mode === 'guide');
      line.visible = show;
      lbl.visible = show;
      (line.material as THREE.LineDashedMaterial).color.set(s.openEdges.has('VENT') ? '#3ddc84' : '#7fa7d9');
    });
  }

  // ───────── پراپ‌های مشترک ─────────
  const R = roomGroups;

  const keyboard = (w = 0.78, d = 0.26, color = '#2b2f36', capColor = '#3d424b') => {
    const kb = new THREE.Group();
    kb.add(rbox(w, 0.03, d, color, 0, 0, 0, { roughness: 0.5 }, 0.012));
    const caps: { p: [number, number, number]; s: [number, number, number]; c: string }[] = [];
    const cols = 14, rows = 4;
    const cw = (w - 0.06) / cols, ch = (d - 0.05) / rows;
    for (let rr = 0; rr < rows; rr++) for (let cc = 0; cc < cols; cc++) {
      caps.push({ p: [-w / 2 + 0.03 + cw * (cc + 0.5), 0.022, -d / 2 + 0.025 + ch * (rr + 0.5)], s: [cw * 0.82, 0.014, ch * 0.8], c: capColor });
    }
    caps.push({ p: [0, 0.022, d / 2 - 0.02], s: [w * 0.4, 0.014, ch * 0.7], c: capColor }); // اسپیس
    kb.add(instancedBoxes(caps, { roughness: 0.6 }));
    return kb;
  };

  const monitor = (room: RoomId, screenLines: string[], w = 0.9, h = 0.56) => {
    const mon = new THREE.Group();
    mon.add(cyl(0.16, 0.18, 0.02, '#1c1c1f', 0, 0.01, 0, 28, { metalness: 0.6, roughness: 0.4 }));
    mon.add(rbox(0.06, 0.32, 0.04, '#1c1c1f', 0, 0.17, -0.03, { metalness: 0.6 }));
    mon.add(rbox(w, h, 0.05, '#141416', 0, 0.3 + h / 2, 0, { roughness: 0.4 }, 0.02));
    const scr = plane(w - 0.06, h - 0.06, textTexture(screenLines, { bg: '#06131f', fg: roomById(room).palette.accent, size: 40, w: 512, h: 300, dir: 'ltr' }));
    const sm = scr.material as THREE.MeshStandardMaterial;
    sm.emissive = new THREE.Color('#ffffff');
    sm.emissiveMap = sm.map;
    sm.emissiveIntensity = 0.75;
    scr.position.set(0, 0.3 + h / 2, 0.027);
    mon.add(scr);
    return mon;
  };

  const desk = (w: number, d: number, top: string, leg: string, metal = false) => {
    const g = new THREE.Group();
    g.add(rbox(w, 0.05, d, top, 0, 0.78, 0, { metalness: metal ? 0.7 : 0.05, roughness: metal ? 0.35 : 0.6 }, 0.02));
    for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(cyl(0.025, 0.025, 0.76, leg, lx * (w / 2 - 0.07), 0.38, lz * (d / 2 - 0.07), 12, { metalness: 0.7, roughness: 0.35 }));
    return g;
  };

  const computer = (room: RoomId, x: number, z: number, rotY: number, screen: string, tilt = 0) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    g.add(desk(1.6, 0.8, '#7a7f89', '#4a4d55'));
    g.add(rbox(0.4, 0.5, 0.65, '#5d626b', 0.5, 0.5, 0, {}, 0.02)); // کشو
    const kb = keyboard();
    kb.position.set(0, 0.82, 0.15);
    kb.rotation.y = tilt * 2;
    g.add(kb);
    g.add(rbox(0.07, 0.03, 0.11, '#2b2f36', 0.52, 0.82, 0.15, {}, 0.014)); // ماوس
    const mon = monitor(room, ['>_', screen]);
    mon.position.set(0, 0.805, -0.2);
    mon.rotation.z = tilt;
    g.add(mon);
    R[room].add(g, shadowBlob(2.0, 1.2, x, z));
    const agent = gameData.agents.find((a) => a.roomId === room)!;
    register(room, `agent:${room}`, mon, `${agent.displayName} — ترمینال`, 1.15);
    return g;
  };

  /** پوسترِ قاب‌دار روی دیوار. */
  const poster = (room: RoomId, map: THREE.Texture, x: number, y: number, z: number, rotY: number, w = 1.1, h = 1.5, frame = '#1b1b1f') => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    g.add(rbox(w + 0.07, h + 0.07, 0.03, frame, 0, 0, -0.005, { roughness: 0.5 }, 0.012));
    const p = plane(w, h, map);
    p.position.z = 0.012;
    g.add(p);
    R[room].add(g);
    return g;
  };

  const lockBox = (room: RoomId, puzzleId: string, x: number, y: number, z: number, color: string, size = 0.5) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const bh = size * 0.7, bd = size * 0.8;
    g.add(rbox(size, bh, bd, color, 0, bh / 2, 0, { roughness: 0.55 }, size * 0.06));
    // نوارهای فلزی
    for (const bx of [-0.32, 0.32]) g.add(rbox(size * 0.08, bh + 0.01, bd + 0.012, '#6d5a3a', bx * size, bh / 2, 0, { metalness: 0.6, roughness: 0.4 }, 0.006));
    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, bh, -bd / 2);
    lidPivot.add(rbox(size + 0.01, size * 0.13, bd + 0.01, color, 0, size * 0.065, bd / 2, { roughness: 0.55 }, size * 0.04));
    g.add(lidPivot);
    // قفلِ آویز
    const lock = new THREE.Group();
    lock.position.set(0, bh * 0.62, bd / 2 + 0.03);
    lock.add(rbox(size * 0.24, size * 0.2, 0.05, '#d4af37', 0, 0, 0, { metalness: 0.85, roughness: 0.3 }, 0.01));
    const sh = torus(size * 0.075, size * 0.018, '#c0c4ca', Math.PI, { metalness: 0.9, roughness: 0.25 });
    sh.position.y = size * 0.1;
    lock.add(sh);
    g.add(lock);
    R[room].add(g);
    if (y < 0.05) R[room].add(shadowBlob(size * 1.7, size * 1.5, x, z, 0.6));
    const p = puzzleById(puzzleId)!;
    register(room, `puzzle:${puzzleId}`, g, p.title, size + 0.6);
    const lockY = lock.position.y;
    onChange((s) => s.solved.has(puzzleId), (open, animate) => {
      anim(lidPivot, 'rx', open ? -1.7 : 0);
      if (animate) {
        // قفل باز می‌شود و می‌افتد
        play(0.8, (k) => {
          sh.position.y = size * 0.1 + Math.min(k / 0.25, 1) * size * 0.07;
          const f = Math.max(0, (k - 0.25) / 0.75);
          lock.position.y = lockY - easeOut(f) * (lockY - 0.02);
          lock.rotation.z = f * 1.3;
        }, () => (lock.visible = false));
      } else {
        lock.visible = !open;
        lock.position.y = lockY;
        lock.rotation.z = 0;
        sh.position.y = size * 0.1;
      }
    });
    return g;
  };

  // ── اتاق ۱ (Maggie): شلوغ، گرم ──
  {
    const room: RoomId = 'room1';
    computer(room, -0.8, -1.2, 0, 'MAGGIE ♥');
    // صندلیِ چوبی پشتِ میز
    const chair = new THREE.Group();
    chair.position.set(-0.8, 0, -0.35);
    chair.rotation.y = Math.PI + 0.2;
    chair.add(rbox(0.46, 0.05, 0.44, '#a0703f', 0, 0.46, 0));
    chair.add(rbox(0.46, 0.5, 0.05, '#a0703f', 0, 0.74, -0.2));
    for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) chair.add(cyl(0.022, 0.022, 0.46, '#7d5530', lx * 0.19, 0.23, lz * 0.18, 10));
    R[room].add(chair);

    // قفسهٔ شمالی با ۶ جعبه و کتاب‌ها
    const shelf = new THREE.Group();
    shelf.position.set(-0.5, 0, -4.55);
    for (const y of [0.05, 0.85, 1.65]) shelf.add(rbox(6.2, 0.06, 0.7, '#a0703f', 0, y, 0, {}, 0.015));
    for (const x of [-3.05, 3.05]) shelf.add(rbox(0.07, 1.75, 0.7, '#7d5530', x, 0.87, 0, {}, 0.015));
    shelf.add(box(6.2, 1.75, 0.03, '#6e4a2a', 0, 0.87, -0.34));
    const books: { p: [number, number, number]; s: [number, number, number]; c: string; ry?: number }[] = [];
    const bookColors = ['#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad', '#16a085', '#d35400', '#e84393'];
    let bx = -2.9;
    for (let i = 0; bx < 2.9; i++) {
      const bw = 0.06 + ((i * 7) % 5) * 0.012;
      const bh = 0.22 + ((i * 11) % 7) * 0.025;
      books.push({ p: [bx + bw / 2, 1.68 + bh / 2, 0.02], s: [bw, bh, 0.24], c: bookColors[i % bookColors.length], ry: (i % 9 === 0) ? 0.15 : 0 });
      bx += bw + 0.01 + (i % 6 === 5 ? 0.25 : 0);
    }
    shelf.add(instancedBoxes(books, { roughness: 0.8 }));
    R[room].add(shelf, shadowBlob(6.6, 1.1, -0.5, -4.4, 0.6));
    const northLocks: [string, string][] = [['P14a', '#ff8fb1'], ['Pf14c', '#ffcf5c'], ['P14c', '#5ca8ff'], ['Pf14b', '#b0b6bf'], ['P14d', '#a17cff'], ['P14e', '#5cd6a1']];
    northLocks.forEach(([id, c], i) => lockBox(room, id, -0.5 - 2.5 + i * 1, i % 2 ? 0.88 : 0.08, -4.5, c, 0.55));
    // جعبه‌های کفِ اتاق کنارِ دیوارِ غربی
    const floorLocks: [string, string, number, number, number][] = [
      ['P14b', '#d9534f', -4.2, 0, 0.9], ['Pf14a', '#f0ad4e', -4.2, 0, 2.1], ['P14g', '#5bc0de', -4.2, 0, 3.4],
      ['Pf14d', '#9b9b9b', -2.9, 0, 3.9], ['P14h', '#ff6f3c', -2.9, 0, 2.6], ['Pf14e', '#c58bff', -4.2, 0.53, 2.1],
    ];
    // جعبه‌های کف رو به وسطِ اتاق می‌چرخند تا قفلِ آویزشان دیده شود
    floorLocks.forEach(([id, c, x, y, z]) => (lockBox(room, id, x, y, z, c, 0.75).rotation.y = Math.atan2(-x, -z)));

    // تودهٔ عروسک‌ها: بدن + سر + گوش، چند تا با چشم
    const pile = new THREE.Group();
    pile.position.set(-3.6, 0, -2.6);
    const dollColors = ['#ff9ec7', '#ffd36e', '#8fd1ff', '#c3a6ff', '#9be29b', '#ffb38a'];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const rr = 0.38 + (i % 3) * 0.18;
      const d = new THREE.Group();
      d.position.set(Math.cos(a) * rr, 0.22 + (i % 4) * 0.1, Math.sin(a) * rr);
      d.rotation.set((i % 3) * 0.4, a, (i % 2) * 0.5);
      const c = dollColors[i % dollColors.length];
      d.add(sphere(0.22, c));
      d.add(sphere(0.15, c, 0, 0.26, 0.02));
      if (i % 2 === 0) for (const ex of [-0.05, 0.05]) d.add(sphere(0.022, '#1a1a1a', ex, 0.29, 0.15, { roughness: 0.2 }));
      if (i % 3 === 0) for (const ex of [-0.1, 0.1]) d.add(sphere(0.06, c, ex, 0.4, 0));
      pile.add(d);
    }
    R[room].add(pile, shadowBlob(2.2, 2.2, -3.6, -2.6, 0.7));
    // عروسکِ زیپ‌دار (کلید ۱)
    const doll = new THREE.Group();
    doll.position.set(-3.6, 0.95, -2.6);
    doll.rotation.y = 0.5;
    const pink = '#e86f9a', light = '#f7a8c4';
    doll.add(capsule(0.22, 0.16, pink, 0, 0, 0));
    doll.add(sphere(0.2, light, 0, 0.4, 0));
    for (const ex of [-0.13, 0.13]) {
      doll.add(capsule(0.06, 0.12, pink, ex, 0.62, 0));
      doll.add(sphere(0.03, '#1a1a1a', ex * 0.5, 0.44, 0.17, { roughness: 0.15 }));
      doll.add(capsule(0.06, 0.14, pink, ex * 2, 0.02, 0.04).rotateZ(ex > 0 ? -0.7 : 0.7));
      doll.add(capsule(0.065, 0.1, pink, ex * 0.9, -0.28, 0.06).rotateX(-1.1));
    }
    doll.add(sphere(0.035, '#c2185b', 0, 0.38, 0.2));
    // زیپ: خطِ دندانه + کشوی طلایی
    const zipLine = box(0.02, 0.32, 0.02, '#b38b2e', 0, 0, 0.215, { metalness: 0.8 });
    doll.add(zipLine);
    const pull = new THREE.Group();
    pull.position.set(0, 0.15, 0.235);
    pull.add(rbox(0.04, 0.03, 0.02, '#d4af37', 0, 0, 0, { metalness: 0.9, roughness: 0.25 }, 0.006));
    pull.add(rbox(0.025, 0.06, 0.008, '#d4af37', 0, -0.045, 0.004, { metalness: 0.9, roughness: 0.25 }, 0.004));
    doll.add(pull);
    R[room].add(doll);
    register(room, 'key:key1', doll, 'عروسکِ زیپ‌دار', 1.0);
    onChange((s) => s.keysFound.has('key1'), (found, animate) => {
      if (animate) {
        play(0.55, (k) => (pull.position.y = 0.15 - easeInOut(k) * 0.3));
        play(0.9, (k) => (doll.rotation.z = Math.sin(k * Math.PI * 4) * 0.18 * (1 - k)), undefined, 0.45);
        popCollect(R[room], new THREE.Vector3(-3.6, 1.05, -2.6).add(new THREE.Vector3(0, 0, 0.25)), 'key', '', 0.5);
      } else pull.position.y = found ? -0.15 : 0.15;
    });

    // پوسترهای رنگی (فونتِ دیوار)
    const pt = [['ماجراجویی!', '#ff8a5c'], ['دوستی', '#ffcf5c'], ['۱+۱=۳ ؟', '#5ca8ff']] as const;
    pt.forEach(([txt, bg], i) => poster(room, textTexture([txt], { bg, fg: '#2b1a10', size: 66, w: 384, h: 512, wall: true }), 2.2 + i * 0.95 - 0.5, 1.9, -4.86, 0, 0.8, 1.05, '#7d5530'));
    poster(room, textTexture(['مگی', 'همیشه کنارت'], { bg: '#fff1e0', fg: '#d0533a', size: 64, w: 384, h: 512, wall: true }), -4.86, 1.6, -0.6, Math.PI / 2, 0.9, 1.2, '#7d5530');
    // فرش با حاشیه
    const rug = new THREE.Mesh(new THREE.CircleGeometry(1.4, 48), std('#c0392b', { roughness: 1 }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0.8, 0.012, 1.2);
    R[room].add(rug);
    for (const [r0, r1, c] of [[1.15, 1.25, '#f1c40f'], [0.5, 0.58, '#f1c40f']] as const) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 48), std(c, { roughness: 1 }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(0.8, 0.014, 1.2);
      R[room].add(ring);
    }
    // پُف (بین‌بگ)
    const bean = sphere(0.5, '#ff8a5c', 2.0, 0.3, 2.6, { roughness: 0.95 });
    bean.scale.set(1, 0.6, 1);
    R[room].add(bean, shadowBlob(1.3, 1.3, 2.0, 2.6));
  }

  // ── اتاق ۲ (Evy): سرد، خالی ──
  {
    const room: RoomId = 'room2';
    const dk = desk(2.2, 1.1, '#8d99a6', '#6c7783', true);
    dk.position.set(1.8, 0, 1.6);
    R[room].add(dk, shadowBlob(2.6, 1.5, 1.8, 1.6));
    // صندلیِ تنها
    const stool = new THREE.Group();
    stool.position.set(1.8, 0, 2.6);
    stool.add(cyl(0.22, 0.22, 0.05, '#4a5868', 0, 0.5, 0, 28, { metalness: 0.5 }));
    for (let k = 0; k < 3; k++) {
      const leg = cyl(0.018, 0.018, 0.52, '#8d99a6', Math.cos((k * Math.PI * 2) / 3) * 0.15, 0.25, Math.sin((k * Math.PI * 2) / 3) * 0.15, 10, { metalness: 0.8 });
      leg.rotation.set(Math.sin((k * Math.PI * 2) / 3) * 0.15, 0, -Math.cos((k * Math.PI * 2) / 3) * 0.15);
      stool.add(leg);
    }
    R[room].add(stool, shadowBlob(0.7, 0.7, 1.8, 2.6));
    // مانیتورِ اوی
    const mon = monitor(room, ['>_', 'evy…']);
    mon.position.set(1.8, 0.805, 1.25);
    R[room].add(mon);
    register(room, 'agent:room2', mon, 'اوی — ترمینال', 1.15);
    // کیبورد (کلید ۲ زیرش)
    const kb = keyboard(0.8, 0.28);
    const kbHome = new THREE.Vector3(1.8, 0.82, 1.75);
    kb.position.copy(kbHome);
    R[room].add(kb);
    const key2 = keyMesh();
    key2.position.set(1.85, 0.81, 1.75);
    key2.rotation.y = 0.4;
    key2.visible = false;
    R[room].add(key2);
    register(room, 'key:key2', kb, 'صفحه‌کلید', 0.6);
    onChange((s) => s.keysFound.has('key2'), (found, animate) => {
      if (animate) {
        // کیبورد بالا می‌آید، کج می‌شود و کنار می‌رود؛ کلید زیرش دیده و جمع می‌شود
        key2.visible = true;
        play(0.9, (k) => {
          const e = easeInOut(k);
          kb.position.set(kbHome.x + e * 0.45, kbHome.y + Math.sin(k * Math.PI) * 0.22, kbHome.z - e * 0.1);
          kb.rotation.set(-Math.sin(k * Math.PI) * 0.55, e * 0.35, 0);
        });
        play(0.01, () => undefined, () => (key2.visible = false), 0.75);
        popCollect(R[room], key2.position.clone(), 'key', '', 0.75);
      } else {
        key2.visible = false;
        kb.position.set(kbHome.x + (found ? 0.45 : 0), kbHome.y, kbHome.z - (found ? 0.1 : 0));
        kb.rotation.set(0, found ? 0.35 : 0, 0);
      }
    });
    // قطعاتِ اسکرابل
    const tiles = new THREE.Group();
    tiles.position.set(2.5, 0.82, 1.6);
    'INSRTHME'.split('').forEach((ch, i) => {
      const tl = rbox(0.13, 0.03, 0.13, '#f3e2b3', (i % 4) * 0.16 - 0.24, 0.015, Math.floor(i / 4) * 0.16 - 0.08, { roughness: 0.6 }, 0.01);
      tl.rotation.y = ((i * 37) % 10 - 5) * 0.04;
      const face = plane(0.11, 0.11, textTexture([ch], { bg: '#f3e2b3', fg: '#222', size: 160, w: 256, h: 256, dir: 'ltr' }));
      face.rotation.x = -Math.PI / 2;
      face.position.y = 0.0155;
      tl.add(face);
      tiles.add(tl);
    });
    R[room].add(tiles);
    register(room, 'puzzle:P24b', tiles, 'قطعاتِ اسکرابل', 0.6);
    // کاغذِ زیرِ میز
    const paper = box(0.35, 0.005, 0.25, '#fff7a8', 1.0, 0.75, 1.95, { roughness: 0.9 });
    paper.rotation.y = 0.15;
    R[room].add(paper);
    register(room, 'clue:C2paper', paper, 'کاغذی زیرِ میز', 0.5);
    // نردبان
    const ladder = new THREE.Group();
    ladder.position.set(-2.3, 0, -1.7);
    ladder.rotation.y = Math.PI / 4;
    ladder.rotation.x = -0.18;
    for (const x of [-0.25, 0.25]) ladder.add(rbox(0.06, 2.6, 0.08, '#a4adb8', x, 1.3, 0, { metalness: 0.7, roughness: 0.3 }, 0.02));
    for (let i = 0; i < 7; i++) ladder.add(cyl(0.022, 0.022, 0.5, '#c3cad3', 0, 0.3 + i * 0.35, 0, 12, { metalness: 0.8, roughness: 0.25 }).rotateZ(Math.PI / 2));
    for (const x of [-0.25, 0.25]) ladder.add(rbox(0.09, 0.05, 0.12, '#222', x, 0.025, 0));
    R[room].add(ladder, shadowBlob(0.9, 0.6, -2.3, -1.7));
    register(room, 'prop:ladder', ladder, 'نردبان', 2.9);
    // چراغ‌قوه + نورش
    const fl = new THREE.Group();
    fl.position.set(3.5, 0.05, -3);
    const flBody = new THREE.Group();
    flBody.add(cyl(0.045, 0.045, 0.32, '#30353c', 0, 0, 0, 20, { metalness: 0.6, roughness: 0.35 }).rotateZ(Math.PI / 2));
    flBody.add(cyl(0.075, 0.05, 0.1, '#30353c', 0.2, 0, 0, 20, { metalness: 0.6, roughness: 0.35 }).rotateZ(Math.PI / 2));
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.065, 24), new THREE.MeshStandardMaterial({ color: '#dfe8f2', emissive: '#fff6d8', emissiveIntensity: 0 }));
    lens.rotation.y = Math.PI / 2;
    lens.position.x = 0.252;
    flBody.add(lens);
    flBody.add(rbox(0.05, 0.02, 0.03, '#b33', -0.05, 0.045, 0, {}, 0.008));
    fl.add(flBody);
    R[room].add(fl, shadowBlob(0.5, 0.25, 3.5, -3));
    const spot = new THREE.SpotLight('#fff6d8', 0, 12, 0.5, 0.5, 1);
    spot.position.set(3.3, 2.4, -2.6);
    spot.target.position.set(1.8, 0.8, 1.6);
    R[room].add(spot, spot.target);
    register(room, 'prop:flashlight', fl, 'چراغ‌قوه', 0.6);
    syncers.push((s) => {
      anim(fl, 'ry', s.flashlight ? 2.2 : 0);
      anim(flBody, 'rz', s.flashlight ? 0.25 : 0);
      spot.intensity = s.flashlight ? 40 : 0;
      (lens.material as THREE.MeshStandardMaterial).emissiveIntensity = s.flashlight ? 2 : 0;
    });
    // پوسترِ تیره (LIAR)
    const lp = poster(room, canvasTexture(liarCanvas()), 0, 1.5, 4.86, Math.PI, 1, 1.4, '#0b0e12');
    register(room, 'clue:C2poster', lp, 'پوسترِ تیره', 1.0);
  }

  // ── اتاق ۳ (Devan): نئونی، کج ──
  {
    const room: RoomId = 'room3';
    computer(room, 2.2, -2.6, 0.12, 'DEVAN ;)', 0.18);
    // صندلیِ چرخ‌دارِ کج
    const chair = new THREE.Group();
    chair.position.set(1.6, 0, -1.5);
    chair.rotation.set(0.12, 0.6, 0.1);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const arm = rbox(0.3, 0.035, 0.05, '#222', Math.cos(a) * 0.15, 0.07, Math.sin(a) * 0.15, { metalness: 0.5 }, 0.012);
      arm.rotation.y = -a;
      chair.add(arm, sphere(0.035, '#111', Math.cos(a) * 0.3, 0.035, Math.sin(a) * 0.3));
    }
    chair.add(cyl(0.03, 0.03, 0.4, '#888', 0, 0.28, 0, 12, { metalness: 0.9 }));
    chair.add(rbox(0.52, 0.08, 0.5, '#2d2d3a', 0, 0.5, 0, { roughness: 0.8 }, 0.035));
    chair.add(rbox(0.5, 0.62, 0.07, '#2d2d3a', 0, 0.86, 0.24, { roughness: 0.8 }, 0.035).rotateX(-0.12));
    R[room].add(chair, shadowBlob(0.9, 0.9, 1.6, -1.5));
    // پوسترهای براق (فونتِ دیوار)
    const adTex = canvasTexture(adsCanvas());
    const posters = [
      poster(room, adTex, -2.6, 1.6, -4.86, 0.05, 1.0, 1.37, '#ff3fd2'),
      poster(room, textTexture(['هوش مصنوعی', 'دوستت دارد'], { bg: '#3f6bff', fg: '#fff', size: 58, w: 384, h: 512, wall: true }), -0.9, 1.7, -4.86, -0.08, 0.9, 1.2, '#ffe14d'),
      poster(room, textTexture(['۰٪ خطا', '۱۰۰٪ تو'], { bg: '#ff3fd2', fg: '#fff', size: 70, w: 384, h: 512, wall: true }), 4.86, 1.6, -0.5, -Math.PI / 2 + 0.1, 0.9, 1.2, '#3f6bff'),
      poster(room, textTexture(['هرگز', 'دروغ نمی‌گوید'], { bg: '#ffe14d', fg: '#2a1838', size: 56, w: 384, h: 512, wall: true }), 4.86, 1.5, 1.6, -Math.PI / 2 - 0.12, 0.9, 1.2, '#ff3fd2'),
    ];
    posters.forEach((p) => register(room, 'clue:C3poster', p, 'پوسترهای براق', 1.0));
    // نوارِ نئونی بالای دیوارها
    for (const [x, z, ry, l] of [[-0.7, -4.82, 0, 8.4], [4.82, 0.3, Math.PI / 2, 8.4]] as const) {
      const neon = box(l, 0.05, 0.05, '#ff3fd2', x, WALL_H - 0.2, z, { emissive: new THREE.Color('#ff3fd2'), emissiveIntensity: 2.2 });
      neon.rotation.y = ry;
      R[room].add(neon);
    }
    // میز و کلید ۳
    const table = new THREE.Group();
    table.position.set(2.6, 0, 2.2);
    table.add(cyl(0.6, 0.6, 0.05, '#4a2d63', 0, 0.75, 0, 40, { roughness: 0.4 }));
    table.add(cyl(0.06, 0.06, 0.72, '#333', 0, 0.37, 0, 16, { metalness: 0.8 }));
    table.add(cyl(0.3, 0.32, 0.03, '#333', 0, 0.015, 0, 32, { metalness: 0.8 }));
    R[room].add(table, shadowBlob(1.4, 1.4, 2.6, 2.2));
    const key3 = keyMesh();
    key3.position.set(2.6, 0.8, 2.2);
    R[room].add(key3);
    tickers.push((t) => {
      key3.rotation.y = t * 1.2;
      key3.position.y = 0.82 + Math.sin(t * 2) * 0.02;
    });
    register(room, 'key:key3', key3, 'کلیدی روی میز', 0.6);
    onChange((s) => s.keysFound.has('key3'), (found, animate) => {
      key3.visible = !found;
      if (animate) popCollect(R[room], key3.position.clone(), 'key');
    });
    // فرش + سکهٔ ۶۴
    const rug = rbox(3.4, 0.02, 2.4, '#7a2c8f', -0.3, 0.012, 0.6, { roughness: 1 }, 0.008);
    R[room].add(rug);
    for (const [w, d, c] of [[3.1, 2.1, '#a64ac9'], [2.9, 1.9, '#7a2c8f']] as const) R[room].add(box(w, 0.004, d, c, -0.3, 0.024, 0.6, { roughness: 1 }));
    const corner = new THREE.Group();
    corner.position.set(1.4, 0.025, 1.8);
    const flap = box(0.5, 0.02, 0.5, '#7a2c8f', -0.25, 0, -0.25, { roughness: 1 });
    corner.add(flap);
    corner.rotation.y = Math.PI / 4;
    R[room].add(corner);
    const coin64 = coinMesh('64');
    coin64.position.set(1.15, 0.02, 1.6);
    R[room].add(coin64);
    register(room, 'coin:coin64', corner, 'گوشهٔ تاخوردهٔ فرش', 0.6);
    onChange((s) => s.coinsFound.has('coin64'), (found, animate) => {
      anim(corner, 'rz', found ? 1.3 : 0.18);
      coin64.visible = !found;
      if (animate) popCollect(R[room], coin64.position.clone(), 'coin', '64', 0.3);
    });
    // قفسه + سکهٔ ۱۰۱
    const shelf = new THREE.Group();
    shelf.position.set(4.55, 0, 3.4);
    for (const y of [0.4, 1.0, 1.6]) shelf.add(rbox(0.5, 0.05, 1.6, '#5a3a72', 0, y, 0, {}, 0.012));
    shelf.add(rbox(0.5, 1.7, 0.05, '#4a2d63', 0, 0.85, -0.8, {}, 0.012));
    shelf.add(rbox(0.5, 1.7, 0.05, '#4a2d63', 0, 0.85, 0.8, {}, 0.012));
    // خرت‌وپرت روی قفسه
    shelf.add(rbox(0.3, 0.25, 0.3, '#ff3fd2', 0, 0.55, -0.4), sphere(0.12, '#ffe14d', 0, 1.15, 0.3), cyl(0.08, 0.08, 0.3, '#3f6bff', 0, 1.18, -0.4));
    R[room].add(shelf, shadowBlob(0.9, 2, 4.4, 3.4));
    const coin101 = coinMesh('101');
    coin101.position.set(4.3, 1.66, 4.22);
    coin101.rotation.x = Math.PI / 2;
    R[room].add(coin101);
    const edge = box(0.2, 0.25, 0.2, '#5a3a72', 4.3, 1.66, 4.2);
    (edge.material as THREE.MeshStandardMaterial).visible = false; // فقط برای کلیک
    R[room].add(edge);
    register(room, 'coin:coin101', edge, 'لبهٔ قفسه', 0.5);
    onChange((s) => s.coinsFound.has('coin101'), (found, animate) => {
      coin101.visible = !found;
      if (animate) popCollect(R[room], coin101.position.clone(), 'coin', '101');
    });
    // کیبوردِ به‌هم‌ریخته و کاغذهای پخش‌شده روی زمین
    const kb = keyboard(0.8, 0.28, '#1f1f28', '#ff3fd2');
    kb.position.set(-1.5, 0.02, -1.8);
    kb.rotation.set(0, 0.9, 0.05);
    R[room].add(kb);
    for (let i = 0; i < 7; i++) {
      const p = box(0.21, 0.003, 0.3, '#f0eef5', -2.4 + (i * 0.73) % 2.6, 0.015 + i * 0.001, -3.2 + ((i * 1.31) % 2.4), { roughness: 0.95 });
      p.rotation.y = i * 1.7;
      R[room].add(p);
    }
  }

  // ── اتاق ۴ (Echo): آزمایشگاهی ──
  {
    const room: RoomId = 'room4';
    computer(room, 2.6, 2.8, -Math.PI / 2, 'ECHO ∎');
    // میز و صفحهٔ شطرنج با مهره‌های تراش‌خورده
    const ct = new THREE.Group();
    ct.position.set(0, 0, 0.6);
    ct.add(rbox(1.4, 0.06, 1.4, '#ffffff', 0, 0.75, 0, { roughness: 0.35 }, 0.02));
    ct.add(cyl(0.07, 0.07, 0.72, '#aab', 0, 0.37, 0, 16, { metalness: 0.8 }));
    ct.add(cyl(0.35, 0.38, 0.03, '#aab', 0, 0.015, 0, 32, { metalness: 0.8 }));
    ct.add(rbox(1.12, 0.03, 1.12, '#6b4a2b', 0, 0.79, 0, {}, 0.01));
    const squares: { p: [number, number, number]; s: [number, number, number]; c: string }[] = [];
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) squares.push({ p: [-0.455 + i * 0.13, 0.805, -0.455 + j * 0.13], s: [0.13, 0.004, 0.13], c: (i + j) % 2 ? '#3b3b3b' : '#efe6d2' });
    ct.add(instancedBoxes(squares, { roughness: 0.4 }));
    const pieceGeo = (kind: 'pawn' | 'king' | 'knight') => cached(`piece-${kind}`, () => {
      const pts = kind === 'pawn'
        ? [[0, 0], [0.05, 0], [0.05, 0.01], [0.035, 0.03], [0.022, 0.07], [0.03, 0.08], [0.018, 0.09], [0.03, 0.11], [0.025, 0.13], [0, 0.14]]
        : kind === 'king'
          ? [[0, 0], [0.055, 0], [0.055, 0.012], [0.04, 0.03], [0.026, 0.12], [0.04, 0.13], [0.03, 0.15], [0.036, 0.17], [0.02, 0.19], [0, 0.19]]
          : [[0, 0], [0.055, 0], [0.055, 0.012], [0.04, 0.03], [0.03, 0.09], [0.04, 0.1], [0.02, 0.15], [0, 0.155]];
      return new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 20);
    });
    const pieces: [number, number, string, 'pawn' | 'king' | 'knight'][] = [[1, 6, '#f4efe4', 'knight'], [4, 7, '#151515', 'king'], [6, 6, '#151515', 'pawn'], [5, 2, '#f4efe4', 'king'], [3, 3, '#151515', 'pawn'], [5, 6, '#151515', 'pawn'], [7, 1, '#f4efe4', 'pawn']];
    for (const [i, j, c, kind] of pieces) {
      const m = new THREE.Mesh(pieceGeo(kind), std(c, { roughness: 0.3 }));
      m.position.set(-0.455 + i * 0.13, 0.807, -0.455 + j * 0.13);
      ct.add(m);
      if (kind === 'king') ct.add(box(0.012, 0.04, 0.012, c, m.position.x, 1.01, m.position.z), box(0.035, 0.012, 0.012, c, m.position.x, 1.01, m.position.z));
      if (kind === 'knight') ct.add(rbox(0.035, 0.05, 0.07, c, m.position.x, 0.97, m.position.z + 0.012, { roughness: 0.3 }, 0.01).rotateX(0.4));
    }
    R[room].add(ct, shadowBlob(1.8, 1.8, 0, 0.6));
    register(room, 'clue:C4chess', ct, 'صفحهٔ شطرنج', 1.3);

    // گاوصندوق‌ها: بدنه، در، فرمانِ چرخان با پره، لولا
    const safe = (x: number, z: number, s: number, puzzleId: string, rotY: number) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = rotY;
      g.add(rbox(s, s, s, '#4d5560', 0, s / 2 + 0.06, 0, { metalness: 0.65, roughness: 0.35 }, 0.04));
      for (const [fx, fz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(cyl(0.03, 0.03, 0.06, '#222', fx * (s / 2 - 0.06), 0.03, fz * (s / 2 - 0.06), 10));
      const doorPivot = new THREE.Group();
      doorPivot.position.set(-s / 2 + 0.04, s / 2 + 0.06, s / 2 + 0.02);
      const door = rbox(s * 0.86, s * 0.86, 0.06, '#6b7480', s * 0.43, 0, 0, { metalness: 0.75, roughness: 0.3 }, 0.02);
      const wheel = new THREE.Group();
      wheel.position.set(s * 0.12, 0, 0.06);
      wheel.add(torus(s * 0.11, s * 0.014, '#c8a14a', Math.PI * 2, { metalness: 0.9, roughness: 0.25 }));
      for (let k = 0; k < 3; k++) wheel.add(rbox(s * 0.22, s * 0.02, s * 0.02, '#c8a14a', 0, 0, 0, { metalness: 0.9 }, 0.004).rotateZ((k * Math.PI) / 3));
      wheel.add(cyl(s * 0.03, s * 0.03, 0.03, '#c8a14a', 0, 0, 0, 16, { metalness: 0.9 }).rotateX(Math.PI / 2));
      door.add(wheel);
      if (puzzleId === 'P45b') {
        const kp = rbox(s * 0.22, s * 0.3, 0.02, '#111', -s * 0.18, s * 0.05, 0.04, {}, 0.006);
        door.add(kp);
      } else {
        // ۸ پینِ قفلِ الگویی
        for (let pr = 0; pr < 4; pr++) for (let pc = 0; pc < 2; pc++) door.add(cyl(0.022, 0.022, 0.03, '#9aa', -s * 0.25 + pc * 0.09, s * 0.22 - pr * 0.09, 0.04, 12, { metalness: 0.8 }).rotateX(Math.PI / 2));
      }
      doorPivot.add(door);
      for (const hy of [-0.3, 0.3]) g.add(cyl(0.025, 0.025, 0.12, '#333', -s / 2 + 0.03, s / 2 + 0.06 + hy * s, s / 2 + 0.03, 12, { metalness: 0.8 }));
      g.add(doorPivot);
      R[room].add(g, shadowBlob(s * 1.6, s * 1.6, x, z));
      register(room, `puzzle:${puzzleId}`, g, puzzleById(puzzleId)!.title, s + 0.6);
      onChange((st) => st.solved.has(puzzleId), (open, animate) => {
        if (animate) {
          play(0.7, (k) => (wheel.rotation.z = -easeInOut(k) * Math.PI * 2));
          play(0.01, () => undefined, () => anim(doorPivot, 'ry', -1.7), 0.65);
          if (puzzleById(puzzleId)?.reward?.keyId) popCollect(R[room], new THREE.Vector3(x, s / 2 + 0.06, z), 'key', '', 1.0);
        } else anim(doorPivot, 'ry', open ? -1.7 : 0);
      });
      return g;
    };
    safe(-3.9, -3.7, 1.0, 'P40a', Math.PI / 2);
    safe(-4.0, 3.9, 0.6, 'P45b', Math.PI / 2);

    // پنل‌های P41 روی دیوارِ جنوبی (فونتِ دیوار؛ فرمول‌ها لاتین می‌مانند)
    const panels: [string, string[]][] = [['P41a', ['NH₃ ↑', 'KCl →', 'CuSO₂ ↓', 'H₂O ←']], ['P41b', ['Maxwell ↑', 'Faraday →', 'Turing ↓', 'Kirchhoff ←']], ['P41c', ['◎', 'هزارتو']], ['P41d', ['جنوب ↑', 'راست = ؟']]];
    panels.forEach(([id, lines], i) => {
      const p = poster(room, textTexture([`${'۱۲۳۴'[i]}`, ...lines], { bg: '#f8fafc', fg: '#1e3a5f', size: 38, w: 384, h: 512, wall: true }), -2.4 + i * 1.3, 1.6, 4.86, Math.PI, 1.0, 1.3, '#2f80ed');
      register(room, `puzzle:${id}`, p, puzzleById(id)!.title, 1.0);
    });
    // نمایشگرهای دیواری (شمارشِ انسان‌ها)
    const wallScreen = (c: HTMLCanvasElement, z: number) => {
      const g = poster(room, canvasTexture(c), -4.86, 1.7, z, Math.PI / 2, 1.3, 0.82, '#111');
      const scr = g.children[1] as THREE.Mesh;
      const mm = scr.material as THREE.MeshStandardMaterial;
      mm.emissive = new THREE.Color('#fff');
      mm.emissiveMap = mm.map;
      mm.emissiveIntensity = 0.55;
      g.add(rbox(0.3, 0.06, 0.06, '#111', 0, -0.47, -0.02));
      return g;
    };
    register(room, 'clue:C4monA', wallScreen(humansCanvas(5, 11, 'monitor'), -0.9), 'نمایشگرِ چپ', 0.7);
    register(room, 'clue:C4monB', wallScreen(humansCanvas(7, 23, 'monitor'), 0.7), 'نمایشگرِ وسط', 0.7);
    const pA = poster(room, canvasTexture(humansCanvas(4, 37, 'poster')), -3.3, 1.7, -4.86, 0, 1.2, 0.75);
    const pB = poster(room, canvasTexture(humansCanvas(6, 53, 'noise')), -1.7, 1.7, -4.86, 0, 1.0, 0.63);
    register(room, 'clue:C4posterA', pA, clueById('C4posterA')!.title, 0.7);
    register(room, 'clue:C4posterB', pB, clueById('C4posterB')!.title, 0.7);
    // نمودار (تزئینی)
    poster(room, canvasTexture(chartCanvas()), 1.65, 1.7, -4.86, 0, 0.9, 0.68, '#cbd5e1');
    // تخته‌سیاه با جاگچی
    const bb = poster(room, canvasTexture(blackboardCanvas()), 4.86, 1.6, 3.4, -Math.PI / 2, 2.0, 1.04, '#6b4a2b');
    bb.add(rbox(2.0, 0.04, 0.1, '#6b4a2b', 0, -0.56, 0.05), rbox(0.08, 0.02, 0.02, '#f5f5f5', 0.5, -0.53, 0.06, {}, 0.008));
    register(room, 'clue:C4board', bb, 'تخته‌سیاه', 0.8);
  }

  // ── اتاق اصلی: سکو، قفل چهارکلیده، دریچهٔ پروتکل ──
  {
    const room: RoomId = 'room5';
    R[room].add(cyl(2.4, 2.55, 0.18, '#2c3038', 0, 0.09, 0, 8, { metalness: 0.4, roughness: 0.5 }));
    R[room].add(cyl(2.2, 2.3, 0.34, '#343944', 0, 0.35, 0, 8, { metalness: 0.4, roughness: 0.45 }));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.38, 0.025, 6, 8), std('#e5484d', { emissive: new THREE.Color('#e5484d'), emissiveIntensity: 1.6 }));
    rim.rotation.x = Math.PI / 2;
    rim.rotation.z = Math.PI / 8;
    rim.position.y = 0.19;
    R[room].add(rim, shadowBlob(6.5, 6.5, 0, 0, 0.9));
    // خطوطِ نوری از سکو به درها
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      const strip = box(3.2, 0.006, 0.05, '#e5484d', Math.cos(a) * 3.9, 0.01, Math.sin(a) * 3.9, { emissive: new THREE.Color('#e5484d'), emissiveIntensity: 0.9 });
      strip.rotation.y = -a;
      R[room].add(strip);
    }
    const ped = new THREE.Group();
    ped.position.set(0, 0.52, -0.4);
    ped.add(cyl(0.5, 0.58, 0.12, '#2a2e36', 0, 0.06, 0, 8, { metalness: 0.5 }));
    ped.add(cyl(0.42, 0.5, 0.82, '#3a3f4a', 0, 0.53, 0, 8, { metalness: 0.5, roughness: 0.4 }));
    ped.add(cyl(0.5, 0.45, 0.08, '#2a2e36', 0, 0.98, 0, 8, { metalness: 0.5 }));
    const band = cyl(0.435, 0.435, 0.04, '#e5484d', 0, 0.6, 0, 8, { emissive: new THREE.Color('#e5484d'), emissiveIntensity: 1.2 });
    ped.add(band);
    const holes: THREE.Mesh[] = [];
    const insertedKeys: THREE.Group[] = [];
    for (let i = 0; i < 4; i++) {
      const hx = -0.27 + i * 0.18;
      const ringM = torus(0.06, 0.015, '#888', Math.PI * 2, { metalness: 0.9, roughness: 0.3 });
      ringM.rotation.x = Math.PI / 2;
      ringM.position.set(hx, 1.025, 0.15);
      ped.add(ringM);
      const h = cyl(0.045, 0.045, 0.01, '#050505', hx, 1.024, 0.15, 20);
      ped.add(h);
      holes.push(ringM);
      const k = keyMesh();
      k.rotation.z = -Math.PI / 2; // تیغه رو به پایین
      k.position.set(hx, 1.25, 0.15);
      k.visible = false;
      ped.add(k);
      insertedKeys.push(k);
    }
    // هسته: کره + پوستهٔ سیمی که می‌چرخد
    const core = sphere(0.18, '#e5484d', 0, 1.3, -0.15, { emissive: new THREE.Color('#e5484d'), emissiveIntensity: 1.5 });
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.27, 1), new THREE.MeshBasicMaterial({ color: '#ff8a8d', wireframe: true, transparent: true, opacity: 0.45 }));
    shell.position.copy(core.position);
    ped.add(core, shell);
    const coreLight = new THREE.PointLight('#ff3b3f', 2.5, 4, 2);
    coreLight.position.copy(core.position);
    ped.add(coreLight);
    R[room].add(ped);
    register(room, 'special:FOUR_KEY_LOCK', ped, 'قفلِ چهارکلیده', 1.75);
    let coreMode: 'idle' | 'win' | 'alarm' = 'idle';
    gameData.win.needs.forEach((keyId, i) => {
      onChange((s) => s.keysInserted.has(keyId), (on, animate) => {
        const k = insertedKeys[i];
        const ringMat = holes[i].material as THREE.MeshStandardMaterial;
        k.visible = on;
        if (animate) {
          // کلید از بالا پایین می‌آید، در سوراخ می‌نشیند و ۹۰ درجه می‌چرخد
          play(1.0, (t) => {
            const d = easeOut(Math.min(t / 0.55, 1));
            k.position.y = 1.4 - d * 0.36;
            k.rotation.y = t > 0.6 ? easeInOut((t - 0.6) / 0.4) * (Math.PI / 2) : 0;
          }, () => ringMat.color.set(GOLD), i * 0.15);
        } else {
          k.position.y = 1.04;
          k.rotation.y = on ? Math.PI / 2 : 0;
          ringMat.color.set(on ? GOLD : '#888');
        }
      });
    });
    syncers.push((s) => (coreMode = s.outcome === 'win' ? 'win' : s.protocolPressed ? 'alarm' : 'idle'));
    tickers.push((t) => {
      const m = core.material as THREE.MeshStandardMaterial;
      shell.rotation.y = t * (coreMode === 'alarm' ? 3 : 0.6);
      shell.rotation.x = t * 0.3;
      if (coreMode === 'win') {
        // هسته خاموش می‌شود
        m.emissiveIntensity += (0 - m.emissiveIntensity) * 0.05;
        coreLight.intensity += (0 - coreLight.intensity) * 0.05;
        shell.scale.lerp(new THREE.Vector3(0.6, 0.6, 0.6), 0.03);
        m.color.lerp(new THREE.Color('#333'), 0.05);
      } else {
        const pulse = coreMode === 'alarm' ? 2 + Math.abs(Math.sin(t * 8)) * 3 : 1.3 + Math.sin(t * 2) * 0.3;
        m.emissiveIntensity = pulse;
        coreLight.intensity = pulse * 1.6;
        m.color.set(coreMode === 'alarm' ? '#ff0000' : '#e5484d');
        shell.scale.setScalar(1);
      }
      (band.material as THREE.MeshStandardMaterial).emissiveIntensity = coreMode === 'win' ? 0.05 : 1 + Math.sin(t * 2) * 0.3;
    });
    // دریچهٔ مخفی
    const hatchPivot = new THREE.Group();
    hatchPivot.position.set(0.7, 0.53, 0.9);
    hatchPivot.add(rbox(0.7, 0.04, 0.5, '#353a44', 0.35, 0, 0, { metalness: 0.5 }, 0.012));
    hatchPivot.add(rbox(0.12, 0.02, 0.04, '#555', 0.6, 0.03, 0, { metalness: 0.8 }, 0.006));
    R[room].add(hatchPivot);
    register(room, 'special:HATCH', hatchPivot, 'شکافی روی سکو', 0.8, (s) => !s.hatchOpen);
    const btn = new THREE.Group();
    btn.position.set(1.05, 0.38, 0.9);
    btn.add(rbox(0.5, 0.05, 0.36, '#ffd400', 0, 0, 0, {}, 0.012));
    btn.add(cyl(0.13, 0.13, 0.03, '#222', 0, 0.035, 0, 28));
    const cap = cyl(0.1, 0.11, 0.07, '#ff1f1f', 0, 0.075, 0, 28, { emissive: new THREE.Color('#ff1f1f'), emissiveIntensity: 0.4, roughness: 0.3 });
    btn.add(cap);
    const tag = plane(0.48, 0.1, textTexture(['CORE SAFETY PROTOCOL'], { bg: '#ffd400', fg: '#000', size: 30, w: 512, h: 112, dir: 'ltr' }));
    tag.rotation.x = -Math.PI / 2;
    tag.position.set(0, 0.03, 0.135);
    btn.add(tag);
    R[room].add(btn);
    register(room, 'special:SAFETY_PROTOCOL', btn, 'CORE SAFETY PROTOCOL', 0.7, (s) => s.hatchOpen);
    syncers.push((s) => {
      anim(hatchPivot, 'rz', s.hatchOpen ? 1.9 : 0);
      anim(btn, 'py', s.hatchOpen ? 0.53 : 0.38);
      btn.visible = s.hatchOpen;
    });
    onChange((s) => s.protocolPressed, (pressed, animate) => {
      if (animate) play(0.35, (k) => (cap.scale.y = 1 - Math.sin(k * Math.PI) * 0.6));
      else cap.scale.y = 1;
      (cap.material as THREE.MeshStandardMaterial).emissiveIntensity = pressed ? 2.5 : 0.4;
    });
    // دو اسپاتِ موضعی روی سکو
    for (const x of [-2.5, 2.5]) {
      const sp = new THREE.SpotLight('#ffe2b0', 30, 14, 0.42, 0.6, 1);
      sp.position.set(x, 6, 2.5);
      sp.target.position.set(0, 0.5, 0);
      R[room].add(sp, sp.target);
    }
  }

  const sync = (s: GameState) => syncers.forEach((fn) => fn(s));

  const update = (dt: number) => {
    const k = 1 - Math.exp(-dt * 8);
    for (const a of anims) {
      const o = a.obj;
      if (a.key === 'rx') o.rotation.x += (a.target - o.rotation.x) * k;
      else if (a.key === 'ry') o.rotation.y += (a.target - o.rotation.y) * k;
      else if (a.key === 'rz') o.rotation.z += (a.target - o.rotation.z) * k;
      else if (a.key === 'py') o.position.y += (a.target - o.position.y) * k;
      else if (a.key === 'px') o.position.x += (a.target - o.position.x) * k;
      else if (a.key === 'sy') o.scale.y += (a.target - o.scale.y) * k;
    }
    const now = performance.now();
    for (let i = fxs.length - 1; i >= 0; i--) {
      const f = fxs[i];
      if (now < f.t0) continue;
      const p = Math.min(1, (now - f.t0) / f.dur);
      f.step(p);
      if (p >= 1) {
        fxs.splice(i, 1);
        f.done?.();
      }
    }
    const t = now / 1000;
    for (const fn of tickers) fn(t);
  };

  return { root, centers, floors, walls, interactables, labels, focusPoints, sync, update };
}
