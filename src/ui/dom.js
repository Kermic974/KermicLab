// Petits utilitaires DOM partagés par l'Interface.

export const NS = 'http://www.w3.org/2000/svg';

export function $(id) { return document.getElementById(id); }
export function attrs(el, map) { for (var k in map) el.setAttribute(k, map[k]); }
export function each(selector, fn) { Array.prototype.forEach.call(document.querySelectorAll(selector), fn); }
