// raycast، hover (highlight + tooltip) و click روی پراپ‌های اتاقِ فعال یا کفِ اتاق‌ها در نمای نقشه.
import * as THREE from 'three';
import type { RoomId } from '../data/game-data';
import type { GameState } from '../game/GameState';
import type { Interactable, World } from './Rooms';

export interface PickHandlers {
  onInteract: (it: Interactable) => void;
  onRoomClick: (room: RoomId) => void;
}

export class Picker {
  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private hovered: Interactable | null = null;
  private hoveredRoom: RoomId | null = null;
  private down = { x: 0, y: 0, t: 0 };
  private tooltip: HTMLDivElement;

  constructor(
    private dom: HTMLElement,
    private camera: THREE.Camera,
    private world: World,
    private state: GameState,
    private handlers: PickHandlers,
  ) {
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'tooltip';
    document.body.appendChild(this.tooltip);
    dom.addEventListener('pointermove', (e) => this.move(e));
    dom.addEventListener('pointerdown', (e) => (this.down = { x: e.clientX, y: e.clientY, t: performance.now() }));
    dom.addEventListener('pointerup', (e) => this.up(e));
    dom.addEventListener('pointerleave', () => this.clearHover());
  }

  private candidates(): Interactable[] {
    const room = this.state.view;
    if (!room) return [];
    return this.world.interactables.filter((i) => i.room === room && i.object.visible && (i.enabled?.(this.state) ?? true));
  }

  private cast(e: PointerEvent) {
    const r = this.dom.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
  }

  private pickInteractable(): Interactable | null {
    const list = this.candidates();
    if (!list.length) return null;
    const hits = this.ray.intersectObjects(list.map((i) => i.object), true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.interact) o = o.parent;
      if (!o) continue;
      const it = list.find((i) => i.object === o);
      if (it) return it;
    }
    return null;
  }

  private pickRoom(): RoomId | null {
    const hits = this.ray.intersectObjects(this.world.floors, false);
    return (hits[0]?.object.userData.roomFloor as RoomId) ?? null;
  }

  private move(e: PointerEvent) {
    if (e.pointerType === 'touch') return;
    this.cast(e);
    if (this.state.view) {
      const it = this.pickInteractable();
      this.setHover(it);
      this.showTip(it?.label ?? '', e);
    } else {
      const room = this.pickRoom();
      this.setRoomHover(room);
      this.showTip('', e);
    }
  }

  private up(e: PointerEvent) {
    const moved = Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y);
    if (moved > 6 || performance.now() - this.down.t > 600) return; // درگِ دوربین، نه کلیک
    this.cast(e);
    if (this.state.view) {
      const it = this.pickInteractable();
      if (it) this.handlers.onInteract(it);
    } else {
      const room = this.pickRoom();
      if (room) this.handlers.onRoomClick(room);
    }
  }

  private showTip(text: string, e: PointerEvent) {
    this.tooltip.textContent = text;
    this.tooltip.style.display = text ? 'block' : 'none';
    this.tooltip.style.left = `${e.clientX + 14}px`;
    this.tooltip.style.top = `${e.clientY + 14}px`;
    this.dom.style.cursor = text ? 'pointer' : this.hoveredRoom ? 'pointer' : 'grab';
  }

  private setHover(it: Interactable | null) {
    if (this.hovered === it) return;
    if (this.hovered) highlight(this.hovered.object, false);
    this.hovered = it;
    if (it) highlight(it.object, true);
  }

  private setRoomHover(room: RoomId | null) {
    if (this.hoveredRoom === room) return;
    for (const f of this.world.floors) {
      const m = f.material as THREE.MeshStandardMaterial;
      m.emissive.set(f.userData.roomFloor === room ? '#4a6fa5' : '#000');
      m.emissiveIntensity = 0.5;
    }
    this.hoveredRoom = room;
  }

  clearHover() {
    this.setHover(null);
    this.setRoomHover(null);
    this.tooltip.style.display = 'none';
  }
}

function highlight(obj: THREE.Object3D, on: boolean) {
  obj.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (!m || !('emissive' in m)) return;
    if (on) {
      o.userData.prevEmissive ??= { c: m.emissive.clone(), i: m.emissiveIntensity };
      m.emissive.set('#ffd27a');
      m.emissiveIntensity = 0.45;
    } else if (o.userData.prevEmissive) {
      m.emissive.copy(o.userData.prevEmissive.c);
      m.emissiveIntensity = o.userData.prevEmissive.i;
      delete o.userData.prevEmissive;
    }
  });
}
