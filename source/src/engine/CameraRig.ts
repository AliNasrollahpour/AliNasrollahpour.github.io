// دوربینِ orbit با سه حالت: نمای نقشهٔ کلی، نمای اتاق، و فوکوس روی یک شیء.
// وقتی پنلِ کناری باز است، با setViewOffset مرکزِ تصویر به فضای خالیِ کنارِ پنل منتقل می‌شود.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { RoomId } from '../data/game-data';

// نقشه حالا فشرده است (بدونِ راهرو، اتاق‌ها ۶۰٪): دوربین باید خیلی نزدیک‌تر بنشیند.
const OVERVIEW_POS = new THREE.Vector3(0, 17.5, 15);
const OVERVIEW_TARGET = new THREE.Vector3(0, 0, 0.6);

export class CameraRig {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  private from = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  private to = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  private t = 1;
  private duration = 0.9;
  private start = 0;
  private size = { w: 1, h: 1 };
  /** جابه‌جاییِ مرکزِ تصویر (پیکسل) برای پنلِ باز؛ مقدارِ فعلی نرم به هدف می‌رسد. */
  private shift = { x: 0, y: 0 };
  private shiftTarget = { x: 0, y: 0 };

  constructor(dom: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
    this.camera.position.copy(OVERVIEW_POS);
    this.controls = new OrbitControls(this.camera, dom);
    this.controls.target.copy(OVERVIEW_TARGET);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.setLimits('overview');
  }

  private setLimits(kind: 'overview' | 'room' | 'focus') {
    const c = this.controls;
    if (kind === 'overview') {
      c.minDistance = 11;
      c.maxDistance = 34;
      c.minPolarAngle = 0.25;
      c.maxPolarAngle = 1.05;
    } else if (kind === 'room') {
      c.minDistance = 2.2;
      c.maxDistance = 9;
      c.minPolarAngle = 0.2;
      c.maxPolarAngle = 1.2;
    } else {
      c.minDistance = 0.35;
      c.maxDistance = 4;
      c.minPolarAngle = 0.15;
      c.maxPolarAngle = 1.75;
    }
  }

  private tweenTo(pos: THREE.Vector3, target: THREE.Vector3, duration = 0.9) {
    this.from.pos.copy(this.camera.position);
    this.from.target.copy(this.controls.target);
    this.to.pos.copy(pos);
    this.to.target.copy(target);
    this.duration = duration;
    this.start = performance.now();
    this.t = 0;
  }

  goOverview() {
    this.setLimits('overview');
    this.tweenTo(OVERVIEW_POS, OVERVIEW_TARGET);
  }

  goRoom(room: RoomId, center: THREE.Vector3) {
    this.setLimits('room');
    // از سمتِ بیرونِ نقشه به داخلِ اتاق نگاه کن تا درهای رو به مرکز دیده شوند.
    const out = room === 'room5' ? new THREE.Vector3(0, 0, 1) : center.clone().setY(0).normalize();
    // در صفحهٔ عمودی (موبایل) دورتر تا عرضِ اتاق جا شود
    const k = this.camera.aspect < 0.8 ? 1.45 : 1;
    const pos = center.clone().addScaledVector(out, 6.0 * k).setY((room === 'room5' ? 7.2 : 6.4) * k);
    this.tweenTo(pos, center.clone().setY(0.45));
  }

  /** نزدیک شدن به یک نقطه (مثلاً قفلِ مرتفع با نردبان). */
  focus(point: THREE.Vector3, roomCenter: THREE.Vector3) {
    this.setLimits('focus');
    const dir = roomCenter.clone().sub(point).setY(0).normalize();
    this.tweenTo(point.clone().addScaledVector(dir, 1.3).setY(point.y + 0.2), point, 1.1);
  }

  /** قاب‌بندیِ یک شیء: از سمتِ داخلِ اتاق، با فاصله‌ای متناسب با اندازه‌اش. */
  frame(center: THREE.Vector3, size: number, roomCenter: THREE.Vector3) {
    this.setLimits('focus');
    const dist = THREE.MathUtils.clamp(size * 1.8 + 0.9, 0.85, 3.4);
    let dir = roomCenter.clone().sub(center).setY(0);
    if (dir.length() < 0.8) dir = this.camera.position.clone().sub(center).setY(0);
    dir.normalize();
    // اشیای دیواری (پوستر، تخته، نمایشگر) تقریباً هم‌ارتفاعِ چشم؛ اشیای روی زمین از بالا
    const wallMounted = center.y > 0.75;
    const pos = center.clone().addScaledVector(dir, dist * (wallMounted ? 0.95 : 0.8)).setY(center.y + dist * (wallMounted ? 0.15 : 0.62));
    this.tweenTo(pos, center, 0.85);
  }

  /** فضای اشغال‌شده توسطِ پنل (پیکسل). left/right برای پنلِ کناری، bottom برای bottom-sheetِ موبایل. */
  setInsets(left: number, right: number, bottom: number) {
    this.shiftTarget.x = (right - left) / 2;
    this.shiftTarget.y = bottom / 2;
  }

  get busy() {
    return this.t < 1;
  }

  resize(w: number, h: number) {
    this.size = { w, h };
    this.camera.aspect = w / h;
    // در صفحه‌های باریک (موبایل) کمی دورتر تا کلِ اتاق جا شود
    this.camera.fov = w / h < 0.8 ? 62 : 45;
    this.applyShift();
  }

  private applyShift() {
    const { w, h } = this.size;
    if (Math.abs(this.shift.x) < 0.5 && Math.abs(this.shift.y) < 0.5) this.camera.clearViewOffset();
    // پنجرهٔ رندر برعکسِ جهتِ پنل جابه‌جا می‌شود تا محتوا در فضای آزاد بنشیند
    else this.camera.setViewOffset(w, h, this.shift.x, this.shift.y, w, h);
    this.camera.updateProjectionMatrix();
  }

  update() {
    if (this.t < 1) {
      // زمانِ واقعی، نه dt: اگر فریم‌ها کند شوند (تبِ پس‌زمینه) حرکت باز هم به‌موقع تمام می‌شود.
      this.t = Math.min(1, (performance.now() - this.start) / 1000 / this.duration);
      const e = this.t < 0.5 ? 4 * this.t ** 3 : 1 - (-2 * this.t + 2) ** 3 / 2;
      this.camera.position.lerpVectors(this.from.pos, this.to.pos, e);
      this.controls.target.lerpVectors(this.from.target, this.to.target, e);
    }
    const dx = this.shiftTarget.x - this.shift.x, dy = this.shiftTarget.y - this.shift.y;
    if (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3) {
      this.shift.x += dx * 0.15;
      this.shift.y += dy * 0.15;
      this.applyShift();
    } else if (dx !== 0 || dy !== 0) {
      this.shift = { ...this.shiftTarget };
      this.applyShift();
    }
    this.controls.update();
  }
}
