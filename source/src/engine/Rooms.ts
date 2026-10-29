// ساخت هندسه پنج اتاق از روی نقشه (fig-map): چهار اتاق مربعی در گوشه‌ها، هشت‌ضلعی اصلی در وسط.
// همه پراپ‌ها از primitive ساخته می‌شوند و هر پراپ تعاملی با یک «interact id» ثبت می‌شود.
// جزئیات با هندسه‌های گوشه‌گرد، instancing و سایه نرم کانواسی اضافه شده تا صحنه سبک بماند.
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { gameData, roomById, puzzleById, clueById, type RoomId } from '../data/game-data';
import type { GameState } from '../game/GameState';
import {
  textTexture, canvasTexture, adsCanvas, blackboardCanvas, liarCanvas, chartCanvas, blobShadowTexture,
  junkPosterCanvas, noteCanvas, nnCanvas, p41PosterTexture, assetTexture, peopleFallbackCanvas,
} from './textures';

export interface Interactable {
  id: string;
  room: RoomId;
  object: THREE.Object3D;
  label: string;
  /** ارتفاع نشان ⓘ بالای شیء. */
  badgeY: number;
  /** اگر برگرداند false، شیء فعلا قابل‌کلیک نیست (مثلا دکمه پروتکل قبل از باز شدن دریچه). */
  enabled?: (s: GameState) => boolean;
}

export interface World {
  root: THREE.Group;
  centers: Record<RoomId, THREE.Vector3>;
  floors: THREE.Mesh[];
  walls: Record<RoomId, THREE.Object3D[]>;
  interactables: Interactable[];
  labels: Record<RoomId, CSS2DObject>;
  /** نقطه‌ای در جهان برای فوکوس دوربین (مثلا قفل مرتفع D25). */
  focusPoints: Record<string, THREE.Vector3>;
  sync: (s: GameState) => void;
  update: (dt: number) => void;
}

/**
 * مقیاس جهان: «۶۰ درصد» اندازه قبلی (درخواست کاربر). همه پراپ‌ها در فضای قدیمی
 * نوشته شده‌اند و داخل یک گروه scale-شده می‌نشینند، پس چیدمانشان دست‌نخورده می‌ماند.
 */
export const S = 0.66;
/** نیم‌عرض ربع هر اتاق گوشه (اتاق = یک ربع کامل ۲×ROOM_HALF، منهای گاز هشت‌ضلعی). */
export const ROOM_HALF = 5 * S;
const QUAD = 2 * ROOM_HALF;
const WALL_H = 2.6 * S;
const WALL_T = 0.2 * S;
const DOOR_W = 1.5 * S;
const DOOR_H = 2.15 * S;
/** هشت‌ضلعی مرکزی مستقیم از ربع چهار اتاق بریده می‌شود؛ هیچ راهرویی در کار نیست. */
const OCT_R = 3.6;
const GOLD = '#f2c94c';

export const CENTERS: Record<RoomId, [number, number]> = {
  room1: [-ROOM_HALF, -ROOM_HALF],
  room3: [ROOM_HALF, -ROOM_HALF],
  room2: [ROOM_HALF, ROOM_HALF],
  room4: [-ROOM_HALF, ROOM_HALF],
  room5: [0, 0],
};

const OCT_APOTHEM = OCT_R * Math.cos(Math.PI / 8);
const OCT_HALFSIDE = OCT_R * Math.sin(Math.PI / 8);
/** مرکز ضلع مورب هشت‌ضلعی رو به هر اتاق گوشه — همان‌جا که در آن اتاق می‌نشیند. */
const diag = (sx: number, sz: number): [number, number] => [(sx * OCT_APOTHEM) / Math.SQRT2, (sz * OCT_APOTHEM) / Math.SQRT2];
/** وسط دیوار مشترک دو اتاق گوشه (از لبه هشت‌ضلعی تا لبه بیرونی نقشه). */
const shared = (QUAD + OCT_APOTHEM) / 2;

/**
 * محل **یک** در مشترک برای هر یال، در مختصات جهانی.
 * هیچ یالی دو در رو‌به‌رو ندارد؛ هر در دقیقا روی دیوار مشترک دو اتاق است.
 */
const DOOR_AT: Record<string, [number, number]> = {
  E13: [0, -shared],        // اتاق ۱ | اتاق ۳ — دیوار x=0 در نیمه جنوبی
  E14: [-shared, 0],        // اتاق ۱ | اتاق ۴ — دیوار z=0 در نیمه غربی
  E23: [shared, 0],         // اتاق ۲ | اتاق ۳ — دیوار z=0 در نیمه شرقی
  E24: [0, shared],         // اتاق ۲ | اتاق ۴ — دیوار x=0 در نیمه شمالی
  E25: diag(1, 1),          // اتاق ۲ | هسته
  E35: diag(1, -1),         // اتاق ۳ | هسته
  E45: diag(-1, 1),         // اتاق ۴ | هسته
  E51: diag(-1, -1),        // هسته | اتاق ۱
};
/** داکت کولر: بالای D25 در اتاق ۲ و بالای D51 در اتاق ۱ — یک مجرا، دو توری. */
const VENT_AT: Record<string, [number, number]> = { room2: diag(1, 1), room1: diag(-1, -1) };

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

/** جعبه گوشه‌گرد — لبه‌ها نور می‌گیرند و اشیا کمتر «کارتنی» به نظر می‌رسند. */
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

/** چند جعبه کوچک با یک draw call (کلیدهای کیبورد، کتاب‌ها). */
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

/**
 * اتاق گوشه = یک ربع کامل QUAD×QUAD که گاز هشت‌ضلعی مرکزی از گوشه داخلی‌اش
 * برداشته شده. نتیجه: هر دو اتاق همسایه یک دیوار مشترک واقعی دارند و هر اتاق
 * مستقیم به اتاق اصلی می‌چسبد — بدون هیچ راهرو و بدون در رو‌به‌رو.
 * خروجی در مختصات **محلی** اتاق است (مرکز گروه = مرکز ربع).
 */
function cornerPolygon(room: RoomId): [number, number][] {
  const [cx, cz] = CENTERS[room];
  const sx = Math.sign(cx), sz = Math.sign(cz);
  const A = OCT_APOTHEM, t = OCT_HALFSIDE;
  // در مختصات جهانی، از گوشه بیرونی به سمت مرکز
  const world: [number, number][] = [
    [sx * QUAD, sz * QUAD],
    [0, sz * QUAD],
    [0, sz * A],
    [sx * t, sz * A],
    [sx * A, sz * t],
    [sx * A, 0],
    [sx * QUAD, 0],
  ];
  return world.map(([x, z]) => [x - cx, z - cz] as [number, number]);
}

function octPolygon(): [number, number][] {
  return Array.from({ length: 8 }, (_, k) => {
    const a = Math.PI / 8 + (k * Math.PI) / 4;
    return [OCT_R * Math.cos(a), OCT_R * Math.sin(a)] as [number, number];
  });
}

/**
 * مساحت علامت‌دار؛ علامتش جهت چرخش چندضلعی را می‌دهد.
 * اتاق‌های گوشه مقعرند (L شکل) و میانگین راس‌هایشان **بیرون** از خودشان می‌افتد
 * (وسط هشت‌ضلعی)، پس جهت «بیرون» باید از چرخش حساب شود نه از مرکز.
 */
function signedArea(poly: [number, number][]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

/** نقطه را روی دیوار نزدیک‌ترش می‌نشاند: [اندیس ضلع، t]. */
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
  const walls = {} as Record<RoomId, THREE.Object3D[]>;
  const labels = {} as Record<RoomId, CSS2DObject>;
  const interactables: Interactable[] = [];
  const focusPoints: Record<string, THREE.Vector3> = {};
  /** هر یال دقیقا یک در مشترک دارد؛ اتاق ۱ قفل‌هایش را روی همین پنل سوار می‌کند. */
  const doorGroups: Record<string, { group: THREE.Group; panel: THREE.Mesh; pivot: THREE.Group }> = {};
  const syncers: ((s: GameState) => void)[] = [];
  const anims: Anim[] = [];
  const fxs: Fx[] = [];
  const tickers: ((t: number) => void)[] = [];

  /** حرکت نرم پیوسته به سمت یک مقدار هدف (درها، درپوش‌ها). */
  const anim = (obj: THREE.Object3D, key: Anim['key'], target: number) => {
    const a = anims.find((x) => x.obj === obj && x.key === key);
    if (a) a.target = target;
    else anims.push({ obj, key, target });
  };

  /** انیمیشن یک‌باره با زمان واقعی. */
  const play = (dur: number, step: (k: number) => void, done?: () => void, delay = 0) => {
    fxs.push({ t0: performance.now() + delay * 1000, dur: dur * 1000, step, done });
  };

  /**
   * گذار یک وضعیت بولی. `animate` فقط وقتی true است که مقدار در همین دور از false به true رفته باشد؛
   * سینک اول و ریست بدون انیمیشن اعمال می‌شوند.
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
  // هر اتاق گوشه یک ربع کامل است که گاز هشت‌ضلعی از گوشه داخلی‌اش برداشته شده،
  // پس هر دو اتاق همسایه یک دیوار مشترک واقعی دارند و هر در فقط **یک بار** ساخته می‌شود.
  const roomGroups = {} as Record<RoomId, THREE.Group>;
  /** گروه پراپ‌ها: مقیاس S، ولی مختصاتش همان فضای ۱۰×۱۰ قدیمی است. */
  const propGroups = {} as Record<RoomId, THREE.Group>;
  const polys = {} as Record<RoomId, [number, number][]>;

  for (const r of gameData.rooms) {
    const [cx, cz] = CENTERS[r.id];
    const g = new THREE.Group();
    g.position.set(cx, 0, cz);
    root.add(g);
    roomGroups[r.id] = g;
    centers[r.id] = new THREE.Vector3(cx, 0, cz);

    const props = new THREE.Group();
    props.scale.setScalar(S);
    g.add(props);
    propGroups[r.id] = props;

    const poly = r.id === 'room5' ? octPolygon() : cornerPolygon(r.id);
    polys[r.id] = poly;
    const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
    const floor = new THREE.Mesh(new THREE.ShapeGeometry(shape), std(r.palette.floor, { roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.userData.roomFloor = r.id;
    g.add(floor);
    floors.push(floor);

    // درهای این اتاق، در مختصات محلی
    const doorsHere = gameData.doors
      .filter((e) => e.between.includes(r.id) && DOOR_AT[e.id])
      .map((e) => ({ edge: e, pos: [DOOR_AT[e.id][0] - cx, DOOR_AT[e.id][1] - cz] as [number, number] }));
    const located = doorsHere.map((d) => ({ ...d, ...locateOnWall(poly, d.pos) }));

    walls[r.id] = [];
    const wallMat = () => std(r.palette.wall, { roughness: 0.85 });
    const trimColor = new THREE.Color(r.palette.wall).multiplyScalar(0.62);
    const ccw = signedArea(poly) > 0;
    poly.forEach((a, i) => {
      const b = poly[(i + 1) % poly.length];
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const len = Math.hypot(dx, dz);
      if (len < 0.01) return;
      const ang = Math.atan2(-dz, dx);
      // نرمال رو به بیرون اتاق، از روی جهت چرخش چندضلعی
      const nrm = new THREE.Vector3(ccw ? dz : -dz, 0, ccw ? -dx : dx).normalize();
      // دیوار کمی به داخل اتاق می‌نشیند تا دیوار اتاق همسایه رویش نیفتد
      // نیم‌ضخامت به داخل + یک شکاف مویی، تا رویه دیوار دو اتاق همسایه دقیقا هم‌صفحه نشود
      const inset = new THREE.Vector3().copy(nrm).multiplyScalar(-WALL_T / 2 - 0.0015);

      const gaps = located.filter((d) => d.i === i).map((d) => d.t * len).sort((x, y) => x - y);
      let cursor = 0;
      const segs: [number, number][] = [];
      for (const gpos of gaps) {
        segs.push([cursor, gpos - DOOR_W / 2]);
        cursor = gpos + DOOR_W / 2;
      }
      segs.push([cursor, len]);
      const addWall = (s0: number, s1: number, y0: number, y1: number, baseboard: boolean) => {
        if (s1 - s0 < 0.01) return;
        const m = new THREE.Mesh(new THREE.BoxGeometry(s1 - s0, y1 - y0, WALL_T), wallMat());
        const sm = (s0 + s1) / 2;
        m.position.set(a[0] + (dx / len) * sm, (y0 + y1) / 2, a[1] + (dz / len) * sm).add(inset);
        m.rotation.y = ang;
        m.userData.normal = nrm;
        g.add(m);
        walls[r.id].push(m);
        // قرنیز پایین و نوار بالا: جزئیات ارزان که دیوار را از «کارتن» بیرون می‌آورد
        for (const [yy, hh] of baseboard
          ? ([[0.06 * S, 0.12 * S], [WALL_H - 0.03 * S, 0.06 * S]] as const)
          : ([[WALL_H - 0.03 * S, 0.06 * S]] as const)) {
          const trim = new THREE.Mesh(new THREE.BoxGeometry(s1 - s0, hh, WALL_T * 1.3), std(trimColor));
          trim.position.set(m.position.x, yy, m.position.z).addScaledVector(nrm, -WALL_T * 0.15);
          trim.rotation.y = ang;
          trim.userData.normal = nrm;
          g.add(trim);
          walls[r.id].push(trim);
        }
      };
      segs.forEach(([s0, s1]) => addWall(s0, s1, 0, WALL_H, true));
      gaps.forEach((gp) => addWall(gp - DOOR_W / 2, gp + DOOR_W / 2, DOOR_H, WALL_H, false));
    });

    // نور
    const pl = new THREE.PointLight(r.palette.light, (r.id === 'room2' ? 9 : r.id === 'room5' ? 10 : 22) * S * S, 14 * S, 1.6);
    pl.position.set(0, 2.4 * S, 0);
    g.add(pl);

    // برچسب نقشه
    const el = document.createElement('div');
    el.className = 'room-label';
    el.dataset.room = r.id;
    el.innerHTML = `<b>${r.title}</b><span></span>`;
    const lbl = new CSS2DObject(el);
    lbl.position.set(0, (r.id === 'room5' ? 4.2 : 3.4) * S, 0);
    g.add(lbl);
    labels[r.id] = lbl;
  }

  // ───────── درها: یکی برای هر یال، روی دیوار مشترک ─────────
  for (const edge of gameData.doors) {
    const at = DOOR_AT[edge.id];
    if (!at) continue;                       // داکت کولر جداگانه ساخته می‌شود
    const [ra, rb] = edge.between;
    // نرمال در = جهت اتاق A به اتاق B
    const n = new THREE.Vector3(CENTERS[rb][0] - CENTERS[ra][0], 0, CENTERS[rb][1] - CENTERS[ra][1]).normalize();
    const dg = new THREE.Group();
    dg.position.set(at[0], 0, at[1]);
    dg.rotation.y = Math.atan2(n.x, n.z);    // در این گروه، محور +z همان نرمال در است
    root.add(dg);

    // چارچوب
    for (const sx of [-1, 1]) dg.add(rbox(0.1 * S, DOOR_H + 0.08 * S, 0.28 * S, '#2b2e35', sx * (DOOR_W / 2 + 0.02 * S), (DOOR_H + 0.08 * S) / 2, 0));
    dg.add(rbox(DOOR_W + 0.14 * S, 0.1 * S, 0.28 * S, '#2b2e35', 0, DOOR_H + 0.04 * S, 0));

    // در لولایی: pivot روی لبه شکاف
    const pivot = new THREE.Group();
    pivot.position.set(-DOOR_W / 2 + 0.03 * S, 0, 0);
    dg.add(pivot);
    const pushSide = edge.sides.find((s) => s.push);
    const heavy = edge.id === 'E14';
    const panelColor = pushSide ? '#8a8f98' : heavy ? '#4b3a2a' : '#59606b';
    const pw = DOOR_W - 0.06 * S;
    const panel = rbox(pw, DOOR_H - 0.03 * S, 0.08 * S, panelColor, pw / 2, DOOR_H / 2, 0, { metalness: 0.3, roughness: 0.55 }, 0.02 * S);
    pivot.add(panel);
    for (const face of [-1, 1]) {
      for (const [yy, hh] of [[0.52, 0.7], [1.42, 0.9]] as const) {
        panel.add(rbox(pw - 0.34 * S, hh * S, 0.02 * S, new THREE.Color(panelColor).multiplyScalar(0.85).getStyle(),
          0, yy * S - DOOR_H / 2, face * 0.045 * S, {}, 0.008 * S));
      }
    }

    // هر سمت در، ظاهر خودش را دارد: دستگیره / پانیک‌بار / پد قفل / هیچ‌چیز
    const lamps: { side: typeof edge.sides[number]; mat: THREE.MeshBasicMaterial }[] = [];
    for (const side of edge.sides) {
      // +z رو به اتاق B است، پس سمت A روی −z می‌نشیند
      const f = side.room === rb ? 1 : -1;
      if (side.push) {
        const bar = cyl(0.03 * S, 0.03 * S, 1.0 * S, '#c9ccd2', 0, -0.05 * S, f * 0.12 * S, 16, { metalness: 0.9, roughness: 0.2 });
        bar.rotation.z = Math.PI / 2;
        panel.add(bar);
        for (const bx of [-0.45, 0.45]) panel.add(box(0.05 * S, 0.05 * S, 0.1 * S, '#9aa0a8', bx * S, -0.05 * S, f * 0.07 * S, { metalness: 0.8 }));
      } else if (side.puzzles?.length || edge.openableFrom.includes(side.room)) {
        const lever = new THREE.Group();
        lever.position.set(pw / 2 - 0.16 * S, -0.05 * S, 0);
        lever.add(cyl(0.035 * S, 0.035 * S, 0.06 * S, '#cfd3d8', 0, 0, f * 0.07 * S, 16, { metalness: 0.9, roughness: 0.25 }).rotateX(Math.PI / 2));
        lever.add(rbox(0.16 * S, 0.03 * S, 0.03 * S, '#cfd3d8', -0.07 * S, 0, f * 0.1 * S, { metalness: 0.9, roughness: 0.25 }, 0.012 * S));
        panel.add(lever);
      }
      // قفل‌های اتاق ۱ روی خود D14 نصب می‌شوند (نه جعبه در اتاق) — پایین‌تر ساخته می‌شوند
      if (side.puzzles?.length && !heavy) {
        const pad = rbox(0.2 * S, 0.3 * S, 0.05 * S, '#1d1f24', pw / 2 - 0.16 * S, (side.high ? 0.85 : 0.22) * S, f * 0.065 * S, { metalness: 0.4 });
        pad.add(new THREE.Mesh(new THREE.PlaneGeometry(0.14 * S, 0.06 * S), new THREE.MeshBasicMaterial({ color: '#6dff9a' }))
          .translateY(0.08 * S).translateZ(f * 0.027 * S).rotateY(f > 0 ? 0 : Math.PI));
        panel.add(pad);
      }
      // چراغ وضعیت، یکی برای هر سمت
      const mat = new THREE.MeshBasicMaterial({ color: '#888' });
      const lamp = new THREE.Mesh(cached('lamp', () => new THREE.SphereGeometry(0.09 * S, 20, 14)), mat);
      lamp.position.set(0, DOOR_H + 0.22 * S, f * 0.16 * S);
      dg.add(lamp);
      const lampBase = cyl(0.12 * S, 0.12 * S, 0.04 * S, '#222', 0, 0, 0, 20);
      lampBase.rotation.x = Math.PI / 2;
      lampBase.position.set(0, DOOR_H + 0.22 * S, f * 0.11 * S);
      dg.add(lampBase);
      lamps.push({ side, mat });

      // قفل چرخشی مرتفع D25 (بالای چارچوب، با نردبان)
      if (side.high) {
        const highLock = new THREE.Group();
        highLock.position.set(0, DOOR_H + 0.3 * S, f * 0.17 * S);
        highLock.rotation.y = f > 0 ? 0 : Math.PI;
        highLock.add(cyl(0.24 * S, 0.24 * S, 0.06 * S, '#8a6a24', 0, 0, 0, 40, { metalness: 0.8, roughness: 0.3 }).rotateX(Math.PI / 2));
        const dial = cyl(0.17 * S, 0.19 * S, 0.08 * S, '#d9b45a', 0, 0, 0.05 * S, 40, { metalness: 0.85, roughness: 0.25 }).rotateX(Math.PI / 2);
        highLock.add(dial);
        for (let k = 0; k < 12; k++) {
          const tick = box(0.012 * S, 0.04 * S, 0.01 * S, '#3a2a08', 0, 0, 0.1 * S);
          tick.position.set(Math.sin((k / 12) * Math.PI * 2) * 0.14 * S, Math.cos((k / 12) * Math.PI * 2) * 0.14 * S, 0.095 * S);
          tick.rotation.z = -(k / 12) * Math.PI * 2;
          highLock.add(tick);
        }
        dg.add(highLock);
        focusPoints[`${edge.id}:${side.room}`] = new THREE.Vector3(at[0], DOOR_H + 0.3 * S, at[1]);
        onChange((s) => s.solved.has('P25a'), (_on, animate) => {
          if (animate) play(1.1, (k) => (dial.rotation.y = -easeInOut(k) * Math.PI * 3));
        });
      }
    }

    // یک شیء، ولی از هر دو اتاق قابل‌کلیک (و هر اتاق نشان ⓘ خودش را دارد)
    for (const side of edge.sides) register(side.room, `door:${edge.id}`, dg, side.doorId, DOOR_H + 0.5 * S);
    doorGroups[edge.id] = { group: dg, panel, pivot };

    const openSign = 1; // همیشه به سمت اتاق A باز می‌شود
    syncers.push((s) => {
      const open = s.openEdges.has(edge.id);
      anim(pivot, 'ry', open ? openSign * 1.45 : 0);
      for (const l of lamps) {
        l.mat.color.set(open ? '#3ddc84' : edge.openableFrom.includes(l.side.room) ? '#ffb020' : '#e5484d');
      }
    });
  }

  // ───────── داکت کولر: بالای D25 در اتاق ۲ و بالای D51 در اتاق ۱ ─────────
  // یک مجرای واحد با دو توری؛ باز شدن از هر سمت، سمت دیگر را هم باز می‌کند.
  for (const [room, at] of Object.entries(VENT_AT) as [RoomId, [number, number]][]) {
    const [cx, cz] = CENTERS[room];
    const n = new THREE.Vector3(-at[0], 0, -at[1]).normalize();   // رو به مرکز نقشه
    const ang = Math.atan2(-n.x, -n.z);       // +z رو به داخل همین اتاق
    // بالای D25 قفل چرخشی مرتفع نشسته، پس داکت اتاق ۲ کنار می‌رود تا رویش نیفتد
    const slide = room === 'room2' ? 0.95 : -0.95;
    const along = new THREE.Vector3(Math.cos(ang), 0, -Math.sin(ang));
    const dg = new THREE.Group();
    dg.position.set(at[0], DOOR_H + 0.34 * S, at[1]).addScaledVector(along, slide);
    dg.rotation.y = ang;
    root.add(dg);

    // داکت فلزی که از دیوار بیرون زده
    const duct = new THREE.Group();
    dg.add(duct);
    duct.add(rbox(1.25 * S, 0.9 * S, 0.5 * S, '#48505b', 0, 0, 0.22 * S, { metalness: 0.55, roughness: 0.4 }, 0.03 * S));
    for (const yy of [-0.42, 0.42]) duct.add(rbox(1.33 * S, 0.07 * S, 0.56 * S, '#39404a', 0, yy * S, 0.22 * S, { metalness: 0.6 }, 0.02 * S));
    // بست اتصال به سقف
    duct.add(rbox(0.5 * S, 0.5 * S, 0.3 * S, '#39404a', 0, 0.5 * S, 0.1 * S, { metalness: 0.6 }, 0.02 * S));

    const grate = new THREE.Group();
    grate.position.set(0, 0, 0.47 * S);
    const gi = new THREE.Group();            // pivot روی لبه بالایی: توری به بیرون می‌افتد
    gi.position.y = 0.38 * S;
    grate.add(gi);
    gi.add(rbox(1.1 * S, 0.7 * S, 0.04 * S, '#6b737e', 0, -0.38 * S, 0, { metalness: 0.6, roughness: 0.4 }, 0.02 * S));
    for (let k = -4; k <= 4; k++) gi.add(box(0.035 * S, 0.6 * S, 0.06 * S, '#2a2f36', k * 0.11 * S, -0.38 * S, 0.02 * S));
    for (const sx of [-0.5, 0.5]) for (const sy of [-0.3, 0.3]) {
      gi.add(cyl(0.02 * S, 0.02 * S, 0.03 * S, '#aab', sx * S, -0.38 * S + sy * S, 0.03 * S, 8).rotateX(Math.PI / 2));
    }
    dg.add(grate);
    register(room, 'door:VENT', grate, room === 'room2' ? 'توری لق داکت کولر' : 'داکت کولر بالای در', 0.85 * S);
    onChange((s) => s.openEdges.has('VENT'), (open, animate) => {
      if (animate) {
        play(0.9, (k) => {
          grate.rotation.z = k < 0.4 ? Math.sin(k * 60) * 0.04 * (1 - k / 0.4) : 0;
          gi.rotation.x = easeOut(Math.max(0, (k - 0.4) / 0.6)) * 1.45;
        });
      } else {
        gi.rotation.x = open ? 1.45 : 0;
        grate.rotation.z = 0;
      }
    });
    // دهانه تاریک پشت توری
    const mouth = box(1.08 * S, 0.68 * S, 0.02 * S, '#07090d', 0, 0, 0.45 * S);
    dg.add(mouth);
    void cx; void cz;
  }
  // ───────── پراپ‌های مشترک ─────────
  const R = propGroups;
  /**
   * فاصله نصب اشیای دیواری از مرکز اتاق، در فضای پراپ. دیوارها نیم‌ضخامت به داخل
   * نشسته‌اند (تا دیوار اتاق همسایه رویشان نیفتد)، پس رویه داخلی روی ۴٫۸ است.
   */
  const WALL_FACE = 4.72;

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

  /** پوستر قاب‌دار روی دیوار. */
  const poster = (room: RoomId, map: THREE.Texture, x: number, y: number, z: number, rotY: number, w = 1.1, h = 1.5, frame = '#1b1b1f') => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    g.add(rbox(w + 0.07, h + 0.07, 0.03, frame, 0, 0, -0.005, { roughness: 0.5 }, 0.012));
    const p = plane(w, h, map);
    p.position.z = 0.012;
    g.add(p);
    R[room].add(g);
    // پوستر رو به داخل اتاق است؛ نرمال دیوارش عکس همان جهت است. با همان دیوار محو می‌شود
    // تا وقتی دوربین پشت دیوار است، پشت خالی قاب توی صورت بیننده نباشد.
    g.userData.normal = new THREE.Vector3(-Math.sin(rotY), 0, -Math.cos(rotY));
    walls[room].push(g);
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
    // قفل آویز
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

  /**
   * قفل آویز نصب‌شده روی **خود در** (درخواست کاربر: در اتاق مگی فقط P14d و P14e
   * جعبه‌اند؛ بقیه مستقیم روی D14 سوار می‌شوند). مختصات نسبت به مرکز پنل در است.
   */
  const doorLock = (room: RoomId, edgeId: string, puzzleId: string, u: number, v: number, color: string) => {
    const dgp = doorGroups[edgeId];
    if (!dgp) return;
    const edge = gameData.doors.find((e) => e.id === edgeId)!;
    const f = room === edge.between[1] ? 1 : -1;      // کدام رویه در به این اتاق است
    const pw = DOOR_W - 0.06 * S;
    const g = new THREE.Group();
    g.position.set(u * pw * 0.5, v * (DOOR_H - 0.03 * S) * 0.5, f * 0.05 * S);
    g.rotation.y = f > 0 ? 0 : Math.PI;
    dgp.panel.add(g);
    const sz = 0.3 * S;
    // حلقه پیچ‌شده به در + بدنه قفل
    g.add(cyl(sz * 0.08, sz * 0.08, sz * 0.14, '#6d5a3a', 0, sz * 0.46, 0, 10, { metalness: 0.7, roughness: 0.4 }).rotateX(Math.PI / 2));
    const lock = new THREE.Group();
    lock.position.set(0, 0, sz * 0.12);
    lock.add(rbox(sz * 0.62, sz * 0.52, sz * 0.2, color, 0, 0, 0, { metalness: 0.7, roughness: 0.35 }, sz * 0.05));
    lock.add(cyl(sz * 0.11, sz * 0.11, sz * 0.05, '#2a2a2a', 0, -sz * 0.02, sz * 0.11, 14, { metalness: 0.9 }).rotateX(Math.PI / 2));
    const sh = torus(sz * 0.2, sz * 0.05, '#c0c4ca', Math.PI, { metalness: 0.9, roughness: 0.25 });
    sh.position.y = sz * 0.26;
    lock.add(sh);
    g.add(lock);
    const p = puzzleById(puzzleId)!;
    register(room, `puzzle:${puzzleId}`, g, p.title, sz * 1.1);
    onChange((s) => s.solved.has(puzzleId), (open, animate) => {
      if (animate) {
        // زنجیر بالا می‌آید، قفل باز می‌شود و از در می‌افتد
        play(0.9, (k) => {
          sh.position.y = sz * 0.26 + Math.min(k / 0.25, 1) * sz * 0.18;
          const q = Math.max(0, (k - 0.25) / 0.75);
          lock.position.y = -easeOut(q) * 0.5 * S;
          lock.rotation.z = q * 1.8;
          lock.scale.setScalar(Math.max(0.001, 1 - q * 0.9));
        }, () => (lock.visible = false));
      } else {
        lock.visible = !open;
        lock.position.y = 0;
        lock.rotation.z = 0;
        lock.scale.setScalar(1);
        sh.position.y = sz * 0.26;
      }
    });
  };

  // ── اتاق ۱ (Maggie): شلوغ، گرم ──
  {
    const room: RoomId = 'room1';
    computer(room, -0.8, -1.2, 0, 'MAGGIE ♥');
    // صندلی چوبی پشت میز
    const chair = new THREE.Group();
    chair.position.set(-0.8, 0, -0.35);
    chair.rotation.y = Math.PI + 0.2;
    chair.add(rbox(0.46, 0.05, 0.44, '#a0703f', 0, 0.46, 0));
    chair.add(rbox(0.46, 0.5, 0.05, '#a0703f', 0, 0.74, -0.2));
    for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) chair.add(cyl(0.022, 0.022, 0.46, '#7d5530', lx * 0.19, 0.23, lz * 0.18, 10));
    R[room].add(chair);

    // قفسه شمالی با ۶ جعبه و کتاب‌ها
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
    // فقط دو معما به‌صورت جعبه در اتاق می‌مانند (درخواست کاربر)
    lockBox(room, 'P14d', -0.5 + 1.0, 0.88, -4.5, '#a17cff', 0.55);
    lockBox(room, 'P14e', -0.5 + 2.0, 0.08, -4.5, '#5cd6a1', 0.55);
    // بقیه قفل‌های سری P روی خود در سنگین گوشه (D14) نصب‌اند — دو ستون، پنج ردیف
    const onDoor: [string, string][] = [
      ['P14a', '#ff8fb1'], ['Pf14c', '#ffcf5c'],
      ['P14b', '#d9534f'], ['Pf14a', '#f0ad4e'],
      ['P14c', '#5ca8ff'], ['Pf14b', '#b0b6bf'],
      ['P14g', '#5bc0de'], ['Pf14d', '#9b9b9b'],
      ['P14h', '#ff6f3c'], ['Pf14e', '#c58bff'],
    ];
    onDoor.forEach(([id, c], i) => doorLock(room, 'E14', id, i % 2 ? 0.42 : -0.42, 0.62 - Math.floor(i / 2) * 0.3, c));

    // توده عروسک‌ها: بدن + سر + گوش، چند تا با چشم
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
    // عروسک زیپ‌دار (کلید ۱)
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
    // زیپ: خط دندانه + کشوی طلایی
    const zipLine = box(0.02, 0.32, 0.02, '#b38b2e', 0, 0, 0.215, { metalness: 0.8 });
    doll.add(zipLine);
    const pull = new THREE.Group();
    pull.position.set(0, 0.15, 0.235);
    pull.add(rbox(0.04, 0.03, 0.02, '#d4af37', 0, 0, 0, { metalness: 0.9, roughness: 0.25 }, 0.006));
    pull.add(rbox(0.025, 0.06, 0.008, '#d4af37', 0, -0.045, 0.004, { metalness: 0.9, roughness: 0.25 }, 0.004));
    doll.add(pull);
    R[room].add(doll);
    register(room, 'key:key1', doll, 'عروسک زیپ‌دار', 1.0);
    onChange((s) => s.keysFound.has('key1'), (found, animate) => {
      if (animate) {
        play(0.55, (k) => (pull.position.y = 0.15 - easeInOut(k) * 0.3));
        play(0.9, (k) => (doll.rotation.z = Math.sin(k * Math.PI * 4) * 0.18 * (1 - k)), undefined, 0.45);
        popCollect(R[room], new THREE.Vector3(-3.6, 1.05, -2.6).add(new THREE.Vector3(0, 0, 0.25)), 'key', '', 0.5);
      } else pull.position.y = found ? -0.15 : 0.15;
    });

    // پوسترهای رنگی‌رنگی. دیوارهای رو به مرکز نقشه آن‌هایی‌اند که دوربین اتاق می‌بیند،
    // پس پوسترهای اصلی آن‌جا می‌نشینند؛ چندتایی هم روی دیوارهای بیرونی برای شلوغی اتاق.
    const MAGGIE_POSTERS: [string, string][] = [
      ['ماجراجویی!', '#ff8a5c'], ['دوستی', '#ffcf5c'], ['۱+۱=۳ ؟', '#5ca8ff'],
      ['بخند!', '#8fd1ff'], ['امروز', '#9be29b'], ['با هم', '#ffb38a'],
    ];
    // [دیوار, u, y, w, h] — دیوار E: x=+5 (rotY=-90°)، N: z=+5 (rotY=180°)، نزدیک: z=-5 / x=-5
    const M_SLOTS: ['E' | 'N' | 'n1' | 'n2', number, number, number, number][] = [
      ['E', -4.15, 1.95, 0.8, 1.0], ['E', -4.15, 0.95, 0.72, 0.84],
      ['E', -0.95, 1.95, 0.8, 1.0], ['E', -0.95, 0.9, 0.66, 0.78],
      ['N', -4.15, 1.9, 0.86, 1.08], ['N', -0.95, 1.95, 0.78, 0.98],
    ];
    MAGGIE_POSTERS.forEach(([txt, bg], i) => {
      const [wall, u, y, w, hh] = M_SLOTS[i];
      const t = textTexture([txt], { bg, fg: '#2b1a10', size: 66, w: 384, h: 512, wall: true });
      const p = wall === 'E'
        ? poster(room, t, WALL_FACE, y, u, -Math.PI / 2, w, hh, '#7d5530')
        : poster(room, t, u, y, WALL_FACE, Math.PI, w, hh, '#7d5530');
      p.rotation.z = ((i * 37) % 7 - 3) * 0.012;   // کمی کج، مثل خود مگی
    });
    poster(room, textTexture(['مگی', 'همیشه کنارت'], { bg: '#fff1e0', fg: '#d0533a', size: 64, w: 384, h: 512, wall: true }), -0.95, 0.95, WALL_FACE, Math.PI, 0.74, 0.92, '#7d5530');
    // چندتا هم روی دیوارهای بیرونی (با دیوار محو می‌شوند، ولی موقع چرخاندن دوربین دیده می‌شوند)
    poster(room, textTexture(['خانه'], { bg: '#ffcf5c', fg: '#2b1a10', size: 70, w: 384, h: 512, wall: true }), -WALL_FACE, 1.9, 1.3, Math.PI / 2, 0.76, 0.96, '#7d5530');
    poster(room, textTexture(['قهرمان'], { bg: '#ff8a5c', fg: '#2b1a10', size: 64, w: 384, h: 512, wall: true }), -WALL_FACE, 1.85, 3.0, Math.PI / 2, 0.7, 0.9, '#7d5530');

    // مبل — دو‌نفره، رو به میز
    const sofa = new THREE.Group();
    sofa.position.set(-2.2, 0, 2.9);
    sofa.rotation.y = -0.55;
    const fab = '#c4553f', fabDark = '#a84633';
    sofa.add(rbox(2.0, 0.34, 0.86, fabDark, 0, 0.28, 0, { roughness: 0.95 }, 0.09));
    sofa.add(rbox(1.92, 0.26, 0.78, fab, 0, 0.5, 0.02, { roughness: 0.95 }, 0.1));       // نشیمن
    sofa.add(rbox(2.0, 0.78, 0.26, fab, 0, 0.72, -0.34, { roughness: 0.95 }, 0.1));      // پشتی
    for (const sx of [-1, 1]) sofa.add(rbox(0.26, 0.56, 0.86, fab, sx * 0.93, 0.6, 0, { roughness: 0.95 }, 0.1)); // دسته
    for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) sofa.add(cyl(0.05, 0.05, 0.22, '#7d5530', lx * 0.82, 0.11, lz * 0.3, 10));
    for (const [px, pc] of [[-0.55, '#ffcf5c'], [0.52, '#8fd1ff']] as const) {
      const cush = rbox(0.42, 0.42, 0.14, pc, px, 0.78, -0.16, { roughness: 1 }, 0.07);
      cush.rotation.set(0.22, 0, px < 0 ? 0.18 : -0.14);
      sofa.add(cush);
    }
    R[room].add(sofa, shadowBlob(2.5, 1.3, -2.2, 2.9, 0.7));

    // فرش با حاشیه (از گوشه هشت‌ضلعی دور شد)
    const rug = new THREE.Mesh(new THREE.CircleGeometry(1.25, 48), std('#c0392b', { roughness: 1 }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(-1.0, 0.03, 1.1);
    rug.renderOrder = 2;
    R[room].add(rug);
    for (const [r0, r1, c] of [[1.02, 1.12, '#f1c40f'], [0.44, 0.52, '#f1c40f']] as const) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 48), std(c, { roughness: 1 }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(-1.0, 0.055, 1.1);
      ring.renderOrder = 3;
      R[room].add(ring);
    }
    // پف (بین‌بگ)
    const bean = sphere(0.5, '#ff8a5c', -4.0, 0.3, 1.1, { roughness: 0.95 });
    bean.scale.set(1, 0.6, 1);
    R[room].add(bean, shadowBlob(1.3, 1.3, -4.0, 1.1));

    // چند تیکه لگوی پخش‌شده روی زمین (سرنخ بصری قفل P14h)
    const LEGO = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#3949ab', '#8e24aa'];
    const bricks: { p: [number, number, number]; s: [number, number, number]; c: string; ry?: number }[] = [];
    const studs: { p: [number, number, number]; s: [number, number, number]; c: string }[] = [];
    const spots: [number, number][] = [[-0.3, 2.2], [0.25, 1.85], [-1.9, 1.6], [-2.6, 0.9], [-1.3, 3.5], [-3.4, 2.4], [0.1, 3.1]];
    spots.forEach(([lx, lz], i) => {
      const c = LEGO[i % LEGO.length];
      const ry = (i * 1.37) % Math.PI;
      bricks.push({ p: [lx, 0.055, lz], s: [0.3, 0.11, 0.17], c, ry });
      for (const sgn of [-1, 1]) {
        studs.push({ p: [lx + Math.cos(ry) * sgn * 0.075, 0.125, lz - Math.sin(ry) * sgn * 0.075], s: [0.07, 0.035, 0.07], c });
      }
    });
    R[room].add(instancedBoxes(bricks, { roughness: 0.35, metalness: 0.02 }));
    R[room].add(instancedBoxes(studs, { roughness: 0.35, metalness: 0.02 }));
  }

  // ── اتاق ۲ (Evy): سرد، خالی ──
  {
    const room: RoomId = 'room2';
    const dk = desk(2.2, 1.1, '#8d99a6', '#6c7783', true);
    dk.position.set(1.8, 0, 1.6);
    R[room].add(dk, shadowBlob(2.6, 1.5, 1.8, 1.6));
    // صندلی تنها
    const stool = new THREE.Group();
    stool.position.set(1.8, 0, 2.6);
    stool.add(cyl(0.22, 0.22, 0.05, '#4a5868', 0, 0.5, 0, 28, { metalness: 0.5 }));
    for (let k = 0; k < 3; k++) {
      const leg = cyl(0.018, 0.018, 0.52, '#8d99a6', Math.cos((k * Math.PI * 2) / 3) * 0.15, 0.25, Math.sin((k * Math.PI * 2) / 3) * 0.15, 10, { metalness: 0.8 });
      leg.rotation.set(Math.sin((k * Math.PI * 2) / 3) * 0.15, 0, -Math.cos((k * Math.PI * 2) / 3) * 0.15);
      stool.add(leg);
    }
    R[room].add(stool, shadowBlob(0.7, 0.7, 1.8, 2.6));
    // مانیتور اوی
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
    // تنها قفسه اتاق — قطعات اسکرابل و چراغ‌قوه روی آن می‌نشینند (درخواست کاربر)
    const shelf = new THREE.Group();
    shelf.position.set(4.1, 0, -4.5);
    const SHELF_Y = [0.42, 1.02, 1.62];
    for (const y of SHELF_Y) shelf.add(rbox(1.5, 0.05, 0.52, '#6c7783', 0, y, 0, { metalness: 0.5, roughness: 0.45 }, 0.012));
    for (const x of [-0.72, 0.72]) shelf.add(rbox(0.07, 1.78, 0.52, '#58626e', x, 0.89, 0, { metalness: 0.55 }, 0.012));
    shelf.add(rbox(1.5, 1.78, 0.04, '#3e4753', 0, 0.89, -0.26, { metalness: 0.4 }));
    R[room].add(shelf, shadowBlob(1.8, 0.8, 4.1, -4.4, 0.6));

    // قطعات اسکرابل — خود تصویر تیم (fig-scrabble.jpg) روی طبقه وسط قفسه
    const tiles = new THREE.Group();
    tiles.position.set(3.95, SHELF_Y[1] + 0.035, -4.45);
    const scrabbleAsset = puzzleById('P24b')!.asset!;
    const sheet = plane(0.46, 0.46, assetTexture(scrabbleAsset, () => {
      // تا وقتی فایل تیم نیست: همان چیدمان حرف‌ها روی کاشی‌های کرم‌رنگ
      const c = document.createElement('canvas');
      c.width = c.height = 512;
      const g = c.getContext('2d')!;
      g.fillStyle = '#3b2f2a';
      g.fillRect(0, 0, 512, 512);
      ['INSERT', 'HOME', 'END', 'ENTER'].forEach((w, row) => {
        w.split('').forEach((ch, i) => {
          const x = 24 + i * 72 + (row % 2) * 16, y = 30 + row * 118;
          g.save();
          g.translate(x + 32, y + 36);
          g.rotate((((i * 7 + row * 3) % 9) - 4) * 0.02);
          g.fillStyle = '#f3e2b3';
          g.fillRect(-32, -36, 64, 72);
          g.fillStyle = '#222';
          g.font = '44px Georgia, serif';
          g.textAlign = 'center';
          g.direction = 'ltr';
          g.fillText(ch, 0, 16);
          g.restore();
        });
      });
      return c;
    }, 'contain', '#3b2f2a'));
    sheet.rotation.x = -Math.PI / 2;
    sheet.position.y = 0.004;
    tiles.add(rbox(0.5, 0.02, 0.5, '#2c333c', 0, -0.008, 0, { roughness: 0.6 }, 0.01));
    tiles.add(sheet);
    R[room].add(tiles);
    register(room, 'puzzle:P24b', tiles, 'قطعات اسکرابل', 0.55);
    // کاغذ زیر میز
    const paper = box(0.35, 0.005, 0.25, '#fff7a8', 1.0, 0.75, 1.95, { roughness: 0.9 });
    paper.rotation.y = 0.15;
    R[room].add(paper);
    register(room, 'clue:C2paper', paper, 'کاغذی زیر میز', 0.5);
    // نردبان — کنار دیوار غربی، نزدیک در D25 ولی بیرون محدوده هشت‌ضلعی
    const ladder = new THREE.Group();
    ladder.position.set(-3.9, 0, 1.3);
    ladder.rotation.y = Math.PI / 4;
    ladder.rotation.x = -0.18;
    for (const x of [-0.25, 0.25]) ladder.add(rbox(0.06, 2.6, 0.08, '#a4adb8', x, 1.3, 0, { metalness: 0.7, roughness: 0.3 }, 0.02));
    for (let i = 0; i < 7; i++) ladder.add(cyl(0.022, 0.022, 0.5, '#c3cad3', 0, 0.3 + i * 0.35, 0, 12, { metalness: 0.8, roughness: 0.25 }).rotateZ(Math.PI / 2));
    for (const x of [-0.25, 0.25]) ladder.add(rbox(0.09, 0.05, 0.12, '#222', x, 0.025, 0));
    R[room].add(ladder, shadowBlob(0.9, 0.6, -3.9, 1.3));
    register(room, 'prop:ladder', ladder, 'نردبان', 2.9);
    // چراغ‌قوه + نورش — روی طبقه بالایی همان قفسه
    const fl = new THREE.Group();
    fl.position.set(4.45, SHELF_Y[2] + 0.075, -4.4);
    const flBody = new THREE.Group();
    flBody.add(cyl(0.045, 0.045, 0.32, '#30353c', 0, 0, 0, 20, { metalness: 0.6, roughness: 0.35 }).rotateZ(Math.PI / 2));
    flBody.add(cyl(0.075, 0.05, 0.1, '#30353c', 0.2, 0, 0, 20, { metalness: 0.6, roughness: 0.35 }).rotateZ(Math.PI / 2));
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.065, 24), new THREE.MeshStandardMaterial({ color: '#dfe8f2', emissive: '#fff6d8', emissiveIntensity: 0 }));
    lens.rotation.y = Math.PI / 2;
    lens.position.x = 0.252;
    flBody.add(lens);
    flBody.add(rbox(0.05, 0.02, 0.03, '#b33', -0.05, 0.045, 0, {}, 0.008));
    fl.add(flBody);
    R[room].add(fl);
    const spot = new THREE.SpotLight('#fff6d8', 0, 12, 0.5, 0.5, 1);
    spot.position.set(4.3, 1.9, -4.2);
    spot.target.position.set(1.8, 0.8, 1.6);
    R[room].add(spot, spot.target);
    register(room, 'prop:flashlight', fl, 'چراغ‌قوه', 0.5);
    syncers.push((s) => {
      anim(flBody, 'rz', s.flashlight ? 0.25 : 0);
      spot.intensity = s.flashlight ? 40 : 0;
      (lens.material as THREE.MeshStandardMaterial).emissiveIntensity = s.flashlight ? 2 : 0;
    });
    // پوستر کلمه‌های به‌هم‌ریخته؛ فقط LIAR قرمز است
    const lp = poster(room, canvasTexture(liarCanvas()), -WALL_FACE, 1.45, 4.1, Math.PI / 2, 1.1, 1.52, '#0b0e12');
    register(room, 'clue:C2poster', lp, 'پوستر کلمه‌های به‌هم‌ریخته', 1.05);
  }

  // ── اتاق ۳ (Devan): نئونی، کج ──
  {
    const room: RoomId = 'room3';
    computer(room, 2.2, -2.6, 0.12, 'DEVAN ;)', 0.18);
    // صندلی چرخ‌دار کج
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
    // دیوار پوستر: زیاد، رنگی، ریز و درشت کنار هم — بیشترشان چرت‌وپرت محض.
    // دیوارهای رو به مرکز نقشه (x=-5 و z=+5) آن‌هایی‌اند که دوربین اتاق می‌بیند؛
    // هر کدام دو بازه آزاد کنار در دارند و با چیدمان آجری پر می‌شوند.
    const posters: THREE.Group[] = [];
    let pIdx = 0;
    /** یک بازه دیوار را با پوسترهای ریز و درشت پر می‌کند. */
    const fillWall = (wall: 'W' | 'N', u0: number, u1: number, big: boolean) => {
      const rows: [number, number][] = big ? [[1.92, 0.92], [0.92, 0.84]] : [[2.02, 0.7], [1.22, 0.74], [0.5, 0.56]];
      for (const [y, hh] of rows) {
        let u = u0 + 0.06;
        while (u < u1 - 0.3) {
          const w = Math.min(0.42 + ((pIdx * 13) % 5) * 0.16, u1 - u - 0.06);
          if (w < 0.3) break;
          const cu = u + w / 2;
          const tex2 = canvasTexture(junkPosterCanvas(pIdx));
          const frame = pIdx % 3 === 0 ? '#ffe14d' : pIdx % 3 === 1 ? '#3f6bff' : '#1b1b1f';
          const p = wall === 'W'
            ? poster(room, tex2, -WALL_FACE, y, cu, Math.PI / 2, w, hh * (w / 0.74), frame)
            : poster(room, tex2, cu, y, WALL_FACE, Math.PI, w, hh * (w / 0.74), frame);
          p.rotation.z = ((pIdx * 29) % 9 - 4) * 0.011;
          posters.push(p);
          u += w + 0.07;
          pIdx++;
        }
      }
    };
    fillWall('W', -4.92, -3.32, true);     // دیوار غربی، پایین در D13
    fillWall('W', -1.72, -0.12, true);     // دیوار غربی، بالای در D13
    fillWall('N', 0.12, 1.72, false);      // دیوار شمالی، کنار در D23
    fillWall('N', 3.32, 4.92, false);
    // چند پوستر روی دیوارهای بیرونی هم هست (با دیوار محو می‌شوند، با چرخش دوربین پیدا)
    const adTex = canvasTexture(adsCanvas());
    posters.push(poster(room, adTex, -3.5, 1.62, -WALL_FACE, 0, 1.05, 1.44, '#ff3fd2'));
    for (const [x, y, w, hh] of [[-1.9, 1.8, 0.8, 1.06], [-0.5, 1.2, 0.66, 0.9], [0.9, 1.9, 0.72, 0.5], [2.3, 1.6, 0.9, 1.2], [3.6, 1.0, 0.7, 0.5]] as const) {
      posters.push(poster(room, canvasTexture(junkPosterCanvas(pIdx++)), x, y, -WALL_FACE, 0, w, hh, '#1b1b1f'));
    }
    for (const [z, y, w, hh] of [[-3.9, 1.8, 0.8, 1.08], [-2.6, 0.9, 0.7, 0.5], [-1.4, 1.7, 0.86, 1.16], [0.4, 1.9, 0.6, 0.8], [1.9, 1.3, 0.78, 1.04], [3.4, 1.8, 0.68, 0.92]] as const) {
      posters.push(poster(room, canvasTexture(junkPosterCanvas(pIdx++)), WALL_FACE, y, z, -Math.PI / 2, w, hh, '#1b1b1f'));
    }
    posters.forEach((p) => register(room, 'clue:C3poster', p, 'دیوار پوسترها', 0.8));
    // نوار نئونی بالای دیوارها
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
    // فرش + سکه ۶۴ (از گوشه هشت‌ضلعی دور شد)
    const RUG: [number, number] = [-1.6, -2.6];
    const rug = rbox(3.4, 0.05, 2.4, '#7a2c8f', RUG[0], 0.025, RUG[1], { roughness: 1 }, 0.008);
    R[room].add(rug);
    [[3.1, 2.1, '#a64ac9'], [2.9, 1.9, '#7a2c8f']].forEach(([w, d, c], i) => {
      const layer = box(w as number, 0.01, d as number, c as string, RUG[0], 0.055 + i * 0.016, RUG[1], { roughness: 1 });
      layer.renderOrder = 2 + i;
      R[room].add(layer);
    });
    const corner = new THREE.Group();
    corner.position.set(RUG[0] + 1.7, 0.075, RUG[1] + 1.2);
    const flap = box(0.5, 0.02, 0.5, '#7a2c8f', -0.25, 0, -0.25, { roughness: 1 });
    corner.add(flap);
    corner.rotation.y = Math.PI / 4;
    R[room].add(corner);
    const coin64 = coinMesh('64');
    coin64.position.set(RUG[0] + 1.45, 0.045, RUG[1] + 1.0);
    R[room].add(coin64);
    register(room, 'coin:coin64', corner, 'گوشه تاخورده فرش', 0.6);
    onChange((s) => s.coinsFound.has('coin64'), (found, animate) => {
      anim(corner, 'rz', found ? 1.3 : 0.18);
      coin64.visible = !found;
      if (animate) popCollect(R[room], coin64.position.clone(), 'coin', '64', 0.3);
    });
    // قفسه + سکه ۱۰۱
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
    register(room, 'coin:coin101', edge, 'لبه قفسه', 0.5);
    onChange((s) => s.coinsFound.has('coin101'), (found, animate) => {
      coin101.visible = !found;
      if (animate) popCollect(R[room], coin101.position.clone(), 'coin', '101');
    });
    // کیبورد به‌هم‌ریخته و کاغذهای پخش‌شده روی زمین
    const kb = keyboard(0.8, 0.28, '#1f1f28', '#ff3fd2');
    kb.position.set(-1.5, 0.02, -1.8);
    kb.rotation.set(0, 0.9, 0.05);
    R[room].add(kb);
    for (let i = 0; i < 7; i++) {
      const p = box(0.21, 0.003, 0.3, '#f0eef5', 1.1 + (i * 0.73) % 2.6, 0.015 + i * 0.001, -4.4 + ((i * 1.31) % 2.4), { roughness: 0.95 });
      p.rotation.y = i * 1.7;
      R[room].add(p);
    }
    // کاغذ مچاله معمای متناقض — قابل کلیک، و تنها جایی که اسم «کامران» نوشته شده
    const note = new THREE.Group();
    note.position.set(0.55, 0, -2.15);
    note.rotation.y = -0.5;
    note.add(box(0.46, 0.004, 0.6, '#f2ead8', 0, 0.018, 0, { roughness: 0.95 }));
    // چند چین بلندشده تا «مچاله» دیده شود
    for (const [dx, dz, ry, rz] of [[-0.14, 0.17, 0.5, 0.22], [0.17, -0.1, -0.7, -0.3], [0.05, 0.26, 0.2, 0.16]] as const) {
      const f = box(0.2, 0.003, 0.22, '#e7dcc4', dx, 0.028, dz, { roughness: 0.95 });
      f.rotation.set(0, ry, rz);
      note.add(f);
    }
    const noteFace = plane(0.42, 0.56, canvasTexture(noteCanvas(clueById('C3note')!.text.split('\n'))));
    noteFace.rotation.x = -Math.PI / 2;
    noteFace.position.y = 0.021;
    note.add(noteFace);
    R[room].add(note);
    register(room, 'clue:C3note', note, 'کاغذ مچاله روی زمین', 0.45);
  }

  // ── اتاق ۴ (Echo): آزمایشگاهی ──
  {
    const room: RoomId = 'room4';
    computer(room, 2.6, 2.8, -Math.PI / 2, 'ECHO ∎');
    // میز و صفحه شطرنج با مهره‌های تراش‌خورده
    const ct = new THREE.Group();
    ct.position.set(0, 0, 0.6);
    ct.add(rbox(1.4, 0.06, 1.4, '#ffffff', 0, 0.75, 0, { roughness: 0.35 }, 0.02));
    ct.add(cyl(0.07, 0.07, 0.72, '#aab', 0, 0.37, 0, 16, { metalness: 0.8 }));
    ct.add(cyl(0.35, 0.38, 0.03, '#aab', 0, 0.015, 0, 32, { metalness: 0.8 }));
    ct.add(rbox(1.12, 0.03, 1.12, '#6b4a2b', 0, 0.79, 0, {}, 0.01));
    const squares: { p: [number, number, number]; s: [number, number, number]; c: string }[] = [];
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) squares.push({ p: [-0.455 + i * 0.13, 0.805, -0.455 + j * 0.13], s: [0.13, 0.004, 0.13], c: (i + j) % 2 ? '#3b3b3b' : '#efe6d2' });
    ct.add(instancedBoxes(squares, { roughness: 0.4 }));
    type Kind = 'pawn' | 'king' | 'queen' | 'rook' | 'bishop' | 'knight';
    const PROFILE: Record<Kind, [number, number][]> = {
      pawn:   [[0, 0], [0.05, 0], [0.05, 0.01], [0.035, 0.03], [0.022, 0.07], [0.03, 0.08], [0.018, 0.09], [0.03, 0.11], [0.025, 0.13], [0, 0.14]],
      king:   [[0, 0], [0.055, 0], [0.055, 0.012], [0.04, 0.03], [0.026, 0.12], [0.04, 0.13], [0.03, 0.15], [0.036, 0.17], [0.02, 0.19], [0, 0.19]],
      queen:  [[0, 0], [0.055, 0], [0.055, 0.012], [0.04, 0.03], [0.025, 0.12], [0.042, 0.135], [0.028, 0.155], [0.034, 0.175], [0.016, 0.18], [0, 0.18]],
      rook:   [[0, 0], [0.052, 0], [0.052, 0.012], [0.038, 0.03], [0.034, 0.1], [0.046, 0.115], [0.046, 0.145], [0, 0.145]],
      bishop: [[0, 0], [0.052, 0], [0.052, 0.012], [0.038, 0.03], [0.024, 0.1], [0.038, 0.115], [0.022, 0.14], [0.018, 0.16], [0, 0.168]],
      knight: [[0, 0], [0.055, 0], [0.055, 0.012], [0.04, 0.03], [0.03, 0.09], [0.04, 0.1], [0.02, 0.15], [0, 0.155]],
    };
    const pieceGeo = (kind: Kind) =>
      cached(`piece-${kind}`, () => new THREE.LatheGeometry(PROFILE[kind].map(([x, y]) => new THREE.Vector2(x, y)), 20));

    // چیدمان عینا از fig-chess.jpg — وضعیت بعد از ۲۳.Kg1، نوبت سیاه، و Nh3# مات است.
    const WHITE = '#f4efe4', BLACK = '#151515';
    const POSITION: [string, string, Kind][] = [
      ['b8', BLACK, 'bishop'], ['f8', BLACK, 'rook'], ['g8', BLACK, 'king'],
      ['a7', BLACK, 'pawn'], ['b7', BLACK, 'bishop'], ['f7', BLACK, 'pawn'], ['g7', BLACK, 'pawn'], ['h7', BLACK, 'pawn'],
      ['b6', BLACK, 'pawn'], ['e6', BLACK, 'pawn'],
      ['c5', WHITE, 'bishop'],
      ['b4', WHITE, 'pawn'], ['c4', WHITE, 'pawn'], ['f4', BLACK, 'knight'],
      ['a3', WHITE, 'pawn'], ['d3', WHITE, 'queen'], ['g3', WHITE, 'pawn'],
      ['d2', WHITE, 'rook'], ['f2', WHITE, 'pawn'], ['h2', WHITE, 'pawn'],
      ['f1', WHITE, 'rook'], ['g1', WHITE, 'king'],
    ];
    /** a1 گوشه تاریک نزدیک سفید؛ ردیف ۸ در دورترین z. */
    const sq = (name: string): [number, number] => {
      const i = name.charCodeAt(0) - 97;          // a..h
      const j = 8 - Number(name[1]);              // rank 8 → j=0
      return [-0.455 + i * 0.13, -0.455 + j * 0.13];
    };
    for (const [name, c, kind] of POSITION) {
      const [px, pz] = sq(name);
      const m = new THREE.Mesh(pieceGeo(kind), std(c, { roughness: 0.3 }));
      m.position.set(px, 0.807, pz);
      ct.add(m);
      if (kind === 'king') ct.add(box(0.012, 0.042, 0.012, c, px, 1.012, pz), box(0.034, 0.012, 0.012, c, px, 1.012, pz));
      if (kind === 'queen') for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        ct.add(sphere(0.009, c, px + Math.cos(a) * 0.026, 0.993, pz + Math.sin(a) * 0.026, { roughness: 0.3 }));
      }
      if (kind === 'rook') for (let k = 0; k < 4; k++) {
        const a = Math.PI / 4 + (k / 4) * Math.PI * 2;
        ct.add(box(0.016, 0.022, 0.016, c, px + Math.cos(a) * 0.03, 0.962, pz + Math.sin(a) * 0.03, { roughness: 0.3 }));
      }
      if (kind === 'bishop') ct.add(sphere(0.011, c, px, 0.983, pz, { roughness: 0.3 }));
      // سر اسب رو به حریف می‌ایستد
      if (kind === 'knight') {
        const head = rbox(0.034, 0.05, 0.068, c, px, 0.97, pz + (c === BLACK ? -0.012 : 0.012), { roughness: 0.3 }, 0.01);
        head.rotation.x = c === BLACK ? -0.4 : 0.4;
        ct.add(head);
      }
    }
    R[room].add(ct, shadowBlob(1.8, 1.8, 0, 0.6));
    register(room, 'clue:C4chess', ct, 'صفحه شطرنج', 1.3);

    // گاوصندوق‌ها: بدنه، در، فرمان چرخان با پره، لولا
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
      wheel.position.set(puzzleId === 'P40a' ? s * 0.14 : s * 0.12, puzzleId === 'P40a' ? -s * 0.27 : 0, 0.06);
      wheel.add(torus(s * 0.11, s * 0.014, '#c8a14a', Math.PI * 2, { metalness: 0.9, roughness: 0.25 }));
      for (let k = 0; k < 3; k++) wheel.add(rbox(s * 0.22, s * 0.02, s * 0.02, '#c8a14a', 0, 0, 0, { metalness: 0.9 }, 0.004).rotateZ((k * Math.PI) / 3));
      wheel.add(cyl(s * 0.03, s * 0.03, 0.03, '#c8a14a', 0, 0, 0, 16, { metalness: 0.9 }).rotateX(Math.PI / 2));
      door.add(wheel);
      if (puzzleId === 'P45b') {
        const kp = rbox(s * 0.22, s * 0.3, 0.02, '#111', -s * 0.18, s * 0.05, 0.04, {}, 0.006);
        door.add(kp);
      } else {
        // تصویر شبکه عصبی تیم (fig-nn.jpg) روی در گاوصندوق + ۸ پین قفل الگویی کنارش
        const nn = puzzleById('P40a')!.nn!;
        const img = plane(s * 0.52, s * 0.35, assetTexture('fig-nn.jpg', () => nnCanvas(nn.input, nn.output), 'contain', '#121212'));
        img.position.set(s * 0.14, s * 0.14, 0.035);
        door.add(img);
        door.add(rbox(s * 0.56, s * 0.39, 0.012, '#2b3038', s * 0.14, s * 0.14, 0.028, { metalness: 0.4 }, 0.008));
        for (let pr = 0; pr < 4; pr++) for (let pc = 0; pc < 2; pc++) {
          door.add(cyl(0.024, 0.024, 0.03, '#9aa', -s * 0.3 + pc * 0.08, s * 0.26 - pr * 0.09, 0.04, 12, { metalness: 0.8 }).rotateX(Math.PI / 2));
        }
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
    safe(-4.25, 1.5, 1.0, 'P40a', Math.PI / 2);
    safe(-4.3, 3.9, 0.6, 'P45b', Math.PI / 2);

    // ── یک پوستر واحد با چهار بخش (نه چهار قاب جدا). هیچ فلشی روی آن نیست:
    //    گزینه‌ها روی راس‌های یک لوزی می‌نشینند و موقعیتشان همان جهت است.
    //    روی دیوار شرقی که دوربین اتاق مستقیم به آن نگاه می‌کند.
    const P41W = 1.52, P41H = 1.52;
    const board = poster(room, p41PosterTexture(), WALL_FACE, 1.45, 0.95, -Math.PI / 2, P41W, P41H, '#2f80ed');
    // چهار ناحیه شفاف کلیک‌پذیر روی همان پوستر، یکی برای هر بخش
    (['P41a', 'P41b', 'P41c', 'P41d'] as const).forEach((id, i) => {
      const hit = new THREE.Mesh(
        new THREE.PlaneGeometry(P41W / 2 - 0.03, P41H / 2 - 0.03),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      );
      // کانواس: ۰ بالا-چپ، ۱ بالا-راست، ۲ پایین-چپ، ۳ پایین-راست
      hit.position.set((i % 2 ? 1 : -1) * P41W * 0.25, (i < 2 ? 1 : -1) * P41H * 0.25, 0.02);
      hit.renderOrder = 2;
      board.add(hit);
      register(room, `puzzle:${id}`, hit, puzzleById(id)!.title, 0.46);
    });

    // ── سه قاب عکس آدم‌ها (جایگزین آدمک‌ها): ۲ + ۶ + ۱۴ = ۲۲ ──
    const photoFrame = (clueId: string, file: string, n: number, x: number, y: number, z: number, ry: number, w: number, hh: number) => {
      const g = poster(room, assetTexture(file, () => peopleFallbackCanvas(n, n * 37 + 11, w / hh), 'cover'), x, y, z, ry, w, hh, '#20242b');
      // قاب عکس: پاس‌پارتو + یک چراغ کوچک بالای قاب
      g.add(rbox(w + 0.14, hh + 0.14, 0.02, '#e8eaee', 0, 0, -0.012, { roughness: 0.6 }, 0.01));
      g.add(rbox(0.22, 0.045, 0.1, '#3a4049', 0, hh / 2 + 0.11, 0.05, { metalness: 0.5 }, 0.015));
      register(room, `clue:${clueId}`, g, clueById(clueId)!.title, hh / 2 + 0.28);
      return g;
    };
    // دیوار جنوبی (رو به دوربین): دو قاب کنار در D41
    photoFrame('C4photoA', 'fig-people-1.jpg', 2, -4.1, 1.72, -WALL_FACE, 0, 1.4, 0.79);
    photoFrame('C4photoC', 'fig-people-3.jpg', 14, -0.92, 1.62, -WALL_FACE, 0, 1.45, 0.97);
    // دیوار شرقی (رو به دوربین): قاب سوم زیر تخته‌سیاه
    photoFrame('C4photoB', 'fig-people-2.jpg', 6, WALL_FACE, 0.76, 4.12, -Math.PI / 2, 1.3, 0.87);
    // نمودار (تزئینی) روی دیوار بیرونی
    poster(room, canvasTexture(chartCanvas()), -WALL_FACE, 1.66, -2.4, Math.PI / 2, 0.82, 0.62, '#cbd5e1');
    // تخته‌سیاه با جاگچی، روی دیوار شرقی
    const bb = poster(room, canvasTexture(blackboardCanvas()), WALL_FACE, 1.82, 4.12, -Math.PI / 2, 1.5, 0.78, '#6b4a2b');
    bb.add(rbox(1.5, 0.04, 0.1, '#6b4a2b', 0, -0.43, 0.05), rbox(0.08, 0.02, 0.02, '#f5f5f5', 0.38, -0.4, 0.06, {}, 0.008));
    register(room, 'clue:C4board', bb, 'تخته‌سیاه', 0.8);
  }

  // ── اتاق اصلی: سکو دقیقا وسط اتاق، چهار سوراخ روی چهار طرف سکو، پروتکل روی خود سکو ──
  {
    const room: RoomId = 'room5';
    // سکوی مدور زیرین، هم‌مرکز اتاق
    R[room].add(cyl(2.25, 2.4, 0.18, '#2c3038', 0, 0.09, 0, 8, { metalness: 0.4, roughness: 0.5 }));
    R[room].add(cyl(2.05, 2.15, 0.34, '#343944', 0, 0.35, 0, 8, { metalness: 0.4, roughness: 0.45 }));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.23, 0.025, 6, 8), std('#e5484d', { emissive: new THREE.Color('#e5484d'), emissiveIntensity: 1.6 }));
    rim.rotation.x = Math.PI / 2;
    rim.rotation.z = Math.PI / 8;
    rim.position.y = 0.19;
    R[room].add(rim, shadowBlob(6.0, 6.0, 0, 0, 0.9));
    // خطوط نوری از سکو به چهار در مورب
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      const strip = box(2.6, 0.006, 0.05, '#e5484d', Math.cos(a) * 3.55, 0.01, Math.sin(a) * 3.55, { emissive: new THREE.Color('#e5484d'), emissiveIntensity: 0.9 });
      strip.rotation.y = -a;
      R[room].add(strip);
    }

    // ── سکوی هسته: دقیقا در مرکز اتاق ──
    const ped = new THREE.Group();
    ped.position.set(0, 0, 0);
    ped.add(cyl(0.72, 0.8, 0.12, '#2a2e36', 0, 0.58, 0, 8, { metalness: 0.5 }));
    ped.add(cyl(0.6, 0.72, 0.82, '#3a3f4a', 0, 1.05, 0, 8, { metalness: 0.5, roughness: 0.4 }));
    const TOP_Y = 1.52;
    ped.add(cyl(0.78, 0.62, 0.1, '#2a2e36', 0, TOP_Y - 0.05, 0, 8, { metalness: 0.5 }));   // صفحه بالایی سکو
    const band = cyl(0.62, 0.62, 0.04, '#e5484d', 0, 1.12, 0, 8, { emissive: new THREE.Color('#e5484d'), emissiveIntensity: 1.2 });
    ped.add(band);

    // ── چهار سوراخ کلید، روی چهار طرف سکو (نه ردیف کنار هم) ──
    const HOLE_R = 0.5;
    const holes: THREE.Mesh[] = [];
    const insertedKeys: THREE.Group[] = [];
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;                 // شمال، شرق، جنوب، غرب
      const hx = Math.cos(a) * HOLE_R, hz = Math.sin(a) * HOLE_R;
      // نشیمنگاه فرورفته روی لبه صفحه
      const seat = cyl(0.14, 0.15, 0.03, '#23272e', hx, TOP_Y + 0.005, hz, 20, { metalness: 0.6, roughness: 0.4 });
      ped.add(seat);
      const ringM = torus(0.075, 0.016, '#888', Math.PI * 2, { metalness: 0.9, roughness: 0.3 });
      ringM.rotation.x = Math.PI / 2;
      ringM.position.set(hx, TOP_Y + 0.025, hz);
      ped.add(ringM);
      ped.add(cyl(0.05, 0.05, 0.012, '#050505', hx, TOP_Y + 0.024, hz, 20));
      holes.push(ringM);
      const k = keyMesh();
      k.rotation.z = -Math.PI / 2;                 // تیغه رو به پایین
      k.rotation.y = -a;                           // حلقه کلید رو به بیرون سکو
      k.position.set(hx, TOP_Y + 0.25, hz);
      k.visible = false;
      ped.add(k);
      insertedKeys.push(k);
    }

    // هسته: کره + پوسته سیمی که می‌چرخد، درست بالای مرکز سکو
    const CORE_Y = TOP_Y + 0.52;
    const core = sphere(0.2, '#e5484d', 0, CORE_Y, 0, { emissive: new THREE.Color('#e5484d'), emissiveIntensity: 1.5 });
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), new THREE.MeshBasicMaterial({ color: '#ff8a8d', wireframe: true, transparent: true, opacity: 0.45 }));
    shell.position.copy(core.position);
    ped.add(core, shell);
    // پایه نازک نگه‌دارنده هسته
    ped.add(cyl(0.05, 0.08, 0.3, '#2a2e36', 0, TOP_Y + 0.17, 0, 12, { metalness: 0.7 }));
    const coreLight = new THREE.PointLight('#ff3b3f', 2.5, 4, 2);
    coreLight.position.copy(core.position);
    ped.add(coreLight);
    R[room].add(ped);
    register(room, 'special:FOUR_KEY_LOCK', ped, 'قفل چهارکلیده', CORE_Y + 0.55);
    let coreMode: 'idle' | 'win' | 'alarm' = 'idle';
    gameData.win.needs.forEach((keyId, i) => {
      const a = (i * Math.PI) / 2;
      onChange((s) => s.keysInserted.has(keyId), (on, animate) => {
        const k = insertedKeys[i];
        const ringMat = holes[i].material as THREE.MeshStandardMaterial;
        k.visible = on;
        if (animate) {
          // کلید از بالا پایین می‌آید، در سوراخ می‌نشیند و ۹۰ درجه می‌چرخد
          play(1.0, (t) => {
            const d = easeOut(Math.min(t / 0.55, 1));
            k.position.y = TOP_Y + 0.42 - d * 0.38;
            k.rotation.y = -a + (t > 0.6 ? easeInOut((t - 0.6) / 0.4) * (Math.PI / 2) : 0);
          }, () => ringMat.color.set(GOLD), i * 0.15);
        } else {
          k.position.y = TOP_Y + 0.04;
          k.rotation.y = -a + (on ? Math.PI / 2 : 0);
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

    // ── دریچه مخفی و دکمه پروتکل: روی **پهلوی** ستون سکو، نه روی صفحه بالایی ──
    // (صفحه بالا مال چهار سوراخ کلید است؛ پروتکل نباید آن را قرق کند.)
    const HA = Math.PI / 2;                       // رو به دوربین پیش‌فرض اتاق اصلی
    const SIDE_R = 0.6, SIDE_Y = 1.02;
    // یک «قاب رویه» که محور z محلی‌اش از ستون به بیرون می‌زند؛ همه‌چیز داخل آن ساخته می‌شود.
    const face = new THREE.Group();
    face.position.set(Math.cos(HA) * SIDE_R, SIDE_Y, Math.sin(HA) * SIDE_R);
    face.rotation.y = Math.PI / 2 - HA;
    ped.add(face);

    // محفظه روکار: از ستون بیرون می‌زند، پس هیچ‌وقت داخلش فرو نمی‌رود
    face.add(rbox(0.42, 0.38, 0.14, '#2a2e36', 0, 0, 0.07, { metalness: 0.6, roughness: 0.4 }, 0.02));
    for (const [bx, by] of [[-0.17, 0.15], [0.17, 0.15], [-0.17, -0.15], [0.17, -0.15]] as const) {
      face.add(cyl(0.013, 0.013, 0.02, '#8a9199', bx, by, 0.14, 10, { metalness: 0.85 }).rotateX(Math.PI / 2));
    }
    // حفره تاریک داخل محفظه
    face.add(box(0.32, 0.28, 0.01, '#0a0c10', 0, 0, 0.133));

    // دکمه: صفحه زرد + حلقه مشکی + کلاهک قرمز، همه در امتداد z محلی
    const btn = new THREE.Group();
    btn.position.set(0, 0, 0.135);
    btn.add(cyl(0.105, 0.105, 0.014, '#ffd400', 0, 0, 0.007, 24).rotateX(Math.PI / 2));
    btn.add(cyl(0.062, 0.062, 0.018, '#222', 0, 0, 0.022, 24).rotateX(Math.PI / 2));
    const cap = cyl(0.048, 0.054, 0.042, '#ff1f1f', 0, 0, 0.05, 24, { emissive: new THREE.Color('#ff1f1f'), emissiveIntensity: 0.4, roughness: 0.3 })
      .rotateX(Math.PI / 2);
    btn.add(cap);
    const tag = plane(0.2, 0.036, textTexture(['CORE SAFETY PROTOCOL'], { bg: '#ffd400', fg: '#000', size: 30, w: 512, h: 112, dir: 'ltr' }));
    tag.position.set(0, -0.078, 0.009);
    btn.add(tag);
    face.add(btn);

    // درپوش لولایی روی همان رویه؛ لولا روی لبه چپ
    const hatchPivot = new THREE.Group();
    hatchPivot.position.set(-0.19, 0, 0.145);
    const lid = rbox(0.4, 0.36, 0.022, '#3d4450', 0.2, 0, 0, { metalness: 0.55 }, 0.012);
    hatchPivot.add(lid);
    hatchPivot.add(rbox(0.05, 0.028, 0.016, '#8a9199', 0.36, 0, 0.018, { metalness: 0.8 }, 0.005));
    face.add(hatchPivot);

    register(room, 'special:HATCH', hatchPivot, 'درپوش پهلوی سکو', 0.3, (s) => !s.hatchOpen);
    register(room, 'special:SAFETY_PROTOCOL', btn, 'CORE SAFETY PROTOCOL', 0.24, (s) => s.hatchOpen);
    syncers.push((s) => {
      anim(hatchPivot, 'ry', s.hatchOpen ? -1.55 : 0);
      btn.visible = s.hatchOpen;
    });
    onChange((s) => s.protocolPressed, (pressed, animate) => {
      if (animate) play(0.35, (k) => (cap.scale.y = 1 - Math.sin(k * Math.PI) * 0.6));
      else cap.scale.y = 1;
      (cap.material as THREE.MeshStandardMaterial).emissiveIntensity = pressed ? 2.5 : 0.4;
    });
    // دو اسپات موضعی روی سکو
    for (const x of [-2.2, 2.2]) {
      const sp = new THREE.SpotLight('#ffe2b0', 11, 11, 0.5, 0.65, 1);
      sp.position.set(x, 5.2, 2.2);
      sp.target.position.set(0, 1.2, 0);
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
