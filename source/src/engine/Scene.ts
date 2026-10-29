// صحنه، رندرر، لوپ؛ نشان‌های ⓘ حالت راهنما، محو کردنِ دیوارهای جلوی دوربین، و فوکوس روی اشیا.
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildWorld, type Interactable, type World } from './Rooms';
import { CameraRig } from './CameraRig';
import { Picker, type PickHandlers } from './Interactables';
import type { GameState } from '../game/GameState';
import type { RoomId } from '../data/game-data';

const INFO_ICON =
  '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><circle cx="12" cy="6.6" r="1.9" fill="currentColor"/><rect x="10.3" y="10" width="3.4" height="9" rx="1.7" fill="currentColor"/></svg>';

function chainVisible(o: THREE.Object3D | null): boolean {
  for (; o; o = o.parent) if (!o.visible) return false;
  return true;
}

export class Stage {
  renderer: THREE.WebGLRenderer;
  labelRenderer: CSS2DRenderer;
  scene = new THREE.Scene();
  rig: CameraRig;
  world: World;
  picker: Picker;
  private clock = new THREE.Clock();
  private badges: { it: Interactable; obj: CSS2DObject }[] = [];
  private onFrame: ((dt: number) => void)[] = [];
  /** دوربین روی یک شیء فوکوس کرده است (نه نمای کلیِ اتاق). */
  private focused = false;
  private focusToken = 0;

  constructor(private host: HTMLElement, private state: GameState, handlers: PickHandlers & { onBadge: (it: Interactable) => void }) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    // روی گوشی تراکمِ پیکسل کمتر تا جزئیاتِ بیشتر روی پرفورمنس اثر نگذارد
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 760 ? 1.5 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.className = 'label-layer';
    host.appendChild(this.labelRenderer.domElement);

    this.scene.background = new THREE.Color('#0b0d12');
    this.scene.fog = new THREE.Fog('#0b0d12', 26, 60);
    // نقشهٔ محیطیِ یک‌باره: فلزها و لبه‌های گرد بازتابِ نرم می‌گیرند، بدونِ هزینهٔ هر فریم.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.32;
    pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight('#c8d4ff', '#1a1410', 0.45));
    const dir = new THREE.DirectionalLight('#ffffff', 0.45);
    dir.position.set(10, 30, 20);
    this.scene.add(dir);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#0f1218', roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    this.scene.add(ground);

    this.world = buildWorld();
    this.scene.add(this.world.root);

    this.rig = new CameraRig(this.renderer.domElement);
    this.picker = new Picker(this.renderer.domElement, this.rig.camera, this.world, state, handlers);

    // نشان‌های ⓘ (یکی برای هر شیء؛ پوسترهای هم‌نام فقط یک نشان)
    const seen = new Set<string>();
    for (const it of this.world.interactables) {
      const key = `${it.room}|${it.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // transformِ دکمه مالِ CSS2DRenderer است؛ افکتِ hover روی span داخلی اعمال می‌شود.
      const el = document.createElement('button');
      el.className = 'badge';
      el.setAttribute('aria-label', it.label);
      el.title = it.label;
      el.innerHTML = `<span class="badge-dot">${INFO_ICON}</span>`;
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        handlers.onBadge(it);
      });
      const obj = new CSS2DObject(el);
      obj.position.set(0, it.badgeY, 0);
      it.object.add(obj);
      obj.visible = false;
      this.badges.push({ it, obj });
    }

    this.watchPanel();
    state.on(() => this.sync());
    this.sync();
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  addFrameHook(fn: (dt: number) => void) {
    this.onFrame.push(fn);
  }

  sync() {
    this.world.sync(this.state);
    const v = this.state.view;
    for (const b of this.badges) {
      b.obj.visible = this.state.mode === 'guide' && b.it.room === v && chainVisible(b.it.object);
    }
    for (const [room, lbl] of Object.entries(this.world.labels)) {
      lbl.visible = !v;
      const ops = this.state.opsIn(room as RoomId);
      const span = lbl.element.querySelector('span');
      // بدونِ ایموجی (درخواستِ کاربر): فقط شمارهٔ هم‌تیمی‌های داخلِ اتاق
      if (span) span.textContent = ops.map((o) => o.name).join(' ');
      lbl.element.classList.toggle('active', this.state.room === room);
    }
  }

  enterRoom(room: RoomId) {
    this.state.view = room;
    this.focused = false;
    this.picker.clearHover();
    this.rig.goRoom(room, this.world.centers[room]);
    this.state.emit();
  }

  overview() {
    this.state.view = null;
    this.focused = false;
    this.picker.clearHover();
    this.rig.goOverview();
    this.state.emit();
  }

  /**
   * دوربین را روی شیء می‌برد. اگر پنلی باز شود، با بسته‌شدنش به نمای اتاق برمی‌گردد؛
   * اگر نه (برداشتنِ کلید، سکه…) بعد از `holdMs` برمی‌گردد.
   */
  focusOn(it: Interactable, holdMs = 2600) {
    if (!this.state.view) return;
    const box = new THREE.Box3();
    it.object.updateWorldMatrix(true, true);
    it.object.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry) box.expandByObject(m, true);
    });
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    this.rig.frame(c, Math.max(size.x, size.y, size.z), this.world.centers[this.state.view]);
    this.focused = true;
    const token = ++this.focusToken;
    setTimeout(() => {
      if (token === this.focusToken && this.focused && !document.querySelector('#panel-root .panel')) this.refocusRoom();
    }, holdMs);
  }

  focus(key: string) {
    const p = this.world.focusPoints[key];
    if (p && this.state.view) {
      this.rig.focus(p, this.world.centers[this.state.view]);
      this.focused = true;
      this.focusToken++;
    }
  }

  refocusRoom() {
    this.focused = false;
    if (this.state.view) this.rig.goRoom(this.state.view, this.world.centers[this.state.view]);
  }

  /** پنلِ کناری: فضای اشغالش را به دوربین بده؛ با بسته‌شدنش از فوکوس برگرد. */
  private watchPanel() {
    const root = document.getElementById('panel-root')!;
    let observed: HTMLElement | null = null;
    const sizeWatch = new ResizeObserver(() => measure());
    const measure = () => {
      const panel = root.querySelector<HTMLElement>('.panel');
      if (panel !== observed) {
        if (observed) sizeWatch.unobserve(observed);
        if (panel) sizeWatch.observe(panel);
        observed = panel;
      }
      if (!panel) {
        this.rig.setInsets(0, 0, 0);
        if (this.focused) {
          // کمی صبر تا انیمیشنِ بازشدن (درپوش، گاوصندوق، در) دیده شود، بعد برگرد
          const token = ++this.focusToken;
          setTimeout(() => {
            if (token === this.focusToken && !root.querySelector('.panel')) this.refocusRoom();
          }, 1400);
        }
        return;
      }
      this.focusToken++;
      const r = panel.getBoundingClientRect();
      const W = window.innerWidth, H = window.innerHeight;
      if (r.width > W * 0.8) this.rig.setInsets(0, 0, Math.max(0, H - r.top));
      else if (r.left + r.width / 2 < W / 2) this.rig.setInsets(r.right, 0, 0);
      else this.rig.setInsets(0, W - r.left, 0);
    };
    new MutationObserver(measure).observe(root, { childList: true });
    window.addEventListener('resize', measure);
  }

  private resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
    this.rig.resize(w, h);
  }

  private fadeWalls() {
    const v = this.state.view;
    const camDir = new THREE.Vector3();
    for (const [room, list] of Object.entries(this.world.walls)) {
      const center = this.world.centers[room as RoomId];
      camDir.copy(this.rig.camera.position).sub(center).setY(0).normalize();
      for (const w of list) {
        const facing = v === room && (w.userData.normal as THREE.Vector3).dot(camDir) > 0.3;
        const target = facing ? 0.12 : 1;
        // روی خودِ دیوار و همهٔ جزئیاتِ چسبیده به آن (دستگیره، قاب‌ها)
        w.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
          if (!m) return;
          if (Math.abs(m.opacity - target) < 0.005) return;
          m.transparent = true;
          m.opacity += (target - m.opacity) * 0.2;
          m.depthWrite = m.opacity > 0.9;
        });
      }
    }
  }

  private frame() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.rig.update();
    this.world.update(dt);
    this.fadeWalls();
    for (const fn of this.onFrame) fn(dt);
    this.renderer.render(this.scene, this.rig.camera);
    this.labelRenderer.render(this.scene, this.rig.camera);
  }
}
