// Options d'affichage (cases à cocher) : projections, repères, radians, axe des tangentes.

import { $ } from './dom.js';
import { buildLabels } from './circle.js';

export function syncOptions() {
  $('projs').classList.toggle('hidden', !$('showProj').checked);
  $('labels').classList.toggle('hidden', !$('showLabels').checked);
  $('tanGroup').classList.toggle('hidden', !$('showTan').checked);
  buildLabels();
}

export function setOptions(o) {
  for (var id in o) $(id).checked = o[id];
  syncOptions();
}

export function getOptions() {
  return {
    showProj: $('showProj').checked, showLabels: $('showLabels').checked,
    radLabels: $('radLabels').checked, showTan: $('showTan').checked
  };
}
