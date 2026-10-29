// گیتینگ per-side درها (BUILD_SPEC بخش ۶.۲ و ۷). همه‌چیز از gameData.doors خوانده می‌شود.
import { gameData, doorById, type DoorEdge, type DoorSide, type RoomId } from '../data/game-data';
import type { GameState } from './GameState';

export type DoorAction =
  | { kind: 'move'; to: RoomId }
  | { kind: 'opened'; to: RoomId; push: boolean }
  | { kind: 'puzzle'; puzzleId: string }
  | { kind: 'progress'; solved: number; needed: number; total: number }
  | { kind: 'exhausted'; puzzleId: string }
  | { kind: 'wrong-side'; note: string }
  | { kind: 'one-way'; note: string };

export const sideFor = (edge: DoorEdge, room: RoomId) => edge.sides.find((s) => s.room === room);
export const otherRoom = (edge: DoorEdge, room: RoomId) => (edge.between[0] === room ? edge.between[1] : edge.between[0]);
export const edgesOf = (room: RoomId) => gameData.doors.filter((d) => d.between.includes(room));

export function solvedCount(side: DoorSide, state: GameState) {
  return (side.puzzles ?? []).filter((id) => state.solved.has(id)).length;
}

export function isSideSatisfied(edge: DoorEdge, side: DoorSide, state: GameState): boolean {
  if (!edge.openableFrom.includes(side.room)) return false;
  if (side.push) return state.pushed.has(edge.id);
  const list = side.puzzles ?? [];
  if (!list.length) return false;
  return solvedCount(side, state) >= (side.minSolved ?? list.length);
}

/** هر یالی که یکی از سمت‌های مجازش برآورده شده باشد باز می‌شود. یال‌های تازه‌باز را برمی‌گرداند. */
export function refreshEdges(state: GameState): string[] {
  const opened: string[] = [];
  for (const edge of gameData.doors) {
    if (state.openEdges.has(edge.id)) continue;
    if (edge.sides.some((s) => isSideSatisfied(edge, s, state))) {
      state.openEdges.add(edge.id);
      opened.push(edge.id);
    }
  }
  return opened;
}

export function canTraverse(edge: DoorEdge, from: RoomId) {
  return !edge.oneWay || edge.between[0] === from;
}

/** کلیک روی یک در از اتاق `room`. درهای هل‌دادنی را همان‌جا باز می‌کند. */
export function interactDoor(state: GameState, edgeId: string, room: RoomId): DoorAction {
  const edge = doorById(edgeId);
  if (!edge) throw new Error(`unknown door ${edgeId}`);
  const side = sideFor(edge, room);
  if (!side) throw new Error(`door ${edgeId} has no side in ${room}`);

  if (state.openEdges.has(edge.id)) {
    if (!canTraverse(edge, room)) return { kind: 'one-way', note: side.note };
    return { kind: 'move', to: otherRoom(edge, room) };
  }
  if (!edge.openableFrom.includes(room)) return { kind: 'wrong-side', note: side.note };

  if (side.push) {
    state.pushed.add(edge.id);
    refreshEdges(state);
    state.emit();
    return { kind: 'opened', to: otherRoom(edge, room), push: true };
  }

  const list = side.puzzles ?? [];
  if (list.length > 1) {
    return { kind: 'progress', solved: solvedCount(side, state), needed: side.minSolved ?? list.length, total: list.length };
  }
  const puzzleId = list[0];
  if (state.exhausted.has(puzzleId)) return { kind: 'exhausted', puzzleId };
  return { kind: 'puzzle', puzzleId };
}
