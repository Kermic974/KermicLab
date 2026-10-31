// Instance unique de l'état central pour l'Interface.
// mode : explore | learn | play ; locked : le point ne peut pas être déplacé (quiz).

import { createStore } from '../api.js';

export const store = createStore({ angle: 45, snap: true, mode: 'explore', locked: false });

export function setAngle(raw, keep360, announce) {
  return store.setAngle(raw, { keep360: !!keep360, announce: !!announce });
}
