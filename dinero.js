/* dinero.js — campos de dinero con separador de miles.
 *
 * POR QUÉ: sin separadores, 180000000 y 18000000 se ven casi iguales. En
 * campo, con el celular en una mano, un cero de más o de menos no se nota.
 * Con separador el error salta a la vista: 180.000.000 vs 18.000.000.
 *
 * FORMATO COLOMBIANO: punto para los miles, coma para los decimales.
 *
 * OJO, ESTO ES LO IMPORTANTE: los campos de dinero dejan de ser
 * <input type="number"> (ese tipo NO admite puntos: el navegador los borra o
 * deja el campo inválido). Pasan a ser texto formateado, así que
 * `parseFloat(campo.value)` YA NO SIRVE — parseFloat("180.000.000") devuelve
 * 180, no 180 millones. Para leer el valor hay que usar SIEMPRE
 * `numeroDinero(campo.value)`. Si ves un parseFloat sobre un campo de dinero,
 * es un error.
 */

/** Texto -> número. 'y180.000.000' -> 180000000 · '1.234,5' -> 1234.5 */
function numeroDinero(txt) {
  if (txt === null || txt === undefined || txt === '') return 0;
  if (typeof txt === 'number') return isFinite(txt) ? txt : 0;
  let s = String(txt).replace(/[^\d,.-]/g, '');
  if (!s) return 0;
  const negativo = s.trim().startsWith('-');
  s = s.replace(/-/g, '');
  // la coma es el separador decimal; los puntos son de miles
  const partes = s.split(',');
  const entero = partes[0].replace(/\./g, '');
  const dec = partes.length > 1 ? partes.slice(1).join('').replace(/\./g, '') : '';
  const n = parseFloat(entero + (dec ? '.' + dec : '')) || 0;
  return negativo ? -n : n;
}

/** Número o texto -> '180.000.000'. Deja como máximo 2 decimales. */
function formatoDinero(txt) {
  if (txt === null || txt === undefined || txt === '') return '';
  let s = String(txt).replace(/[^\d,.-]/g, '');
  if (typeof txt === 'number') s = String(txt).replace('.', ',');
  if (!s) return '';
  const negativo = s.startsWith('-');
  s = s.replace(/-/g, '');
  const partes = s.split(',');
  let entero = partes[0].replace(/\./g, '').replace(/^0+(?=\d)/, '');
  const dec = partes.length > 1
    ? partes.slice(1).join('').replace(/\./g, '').slice(0, 2) : '';
  const conPuntos = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (negativo ? '-' : '') + conPuntos + (s.includes(',') ? ',' + dec : '');
}

/* --- mantener el cursor en su sitio al reformatear mientras se escribe --- */
function _digitosAntes(txt, pos) {
  return (txt.slice(0, pos).match(/[\d,]/g) || []).length;
}
function _posDeDigito(txt, n) {
  if (n <= 0) return 0;
  let vistos = 0;
  for (let i = 0; i < txt.length; i++) {
    if (/[\d,]/.test(txt[i])) { vistos++; if (vistos === n) return i + 1; }
  }
  return txt.length;
}

/** Convierte un <input> en campo de dinero. Se puede llamar varias veces. */
function activarDinero(inp) {
  if (!inp || inp.dataset.dineroListo === '1') return;
  inp.dataset.dineroListo = '1';
  // type=number no admite el punto de miles: hay que pasarlo a texto
  if (inp.type === 'number') inp.type = 'text';
  inp.setAttribute('inputmode', 'decimal');
  inp.classList.add('dinero');
  if (inp.value) inp.value = formatoDinero(inp.value);
  inp.addEventListener('input', function () {
    const antes = _digitosAntes(inp.value, inp.selectionStart || 0);
    inp.value = formatoDinero(inp.value);
    const pos = _posDeDigito(inp.value, antes);
    try { inp.setSelectionRange(pos, pos); } catch (e) { /* readonly */ }
  });
  inp.addEventListener('blur', function () {
    inp.value = formatoDinero(inp.value);
  });
}

/** Activa todos los <input data-dinero> que haya dentro de `raiz`. */
function activarDineros(raiz) {
  (raiz || document).querySelectorAll('input[data-dinero]').forEach(activarDinero);
}

document.addEventListener('DOMContentLoaded', function () { activarDineros(document); });
