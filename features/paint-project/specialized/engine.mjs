// US units throughout. Coverage is the manufacturer's rate for one coat.
import {number} from '../math.mjs';

export function estimate(kind, input) {
  const read = (key, min=0, max=1e7, integer=false) =>
    number(input[key], key, {min,max,integer});
  if (kind === 'cost') {
    const gallons = read('gallons', .01);
    const price = read('price');
    const supplies = read('supplies');
    const labor = read('labor');
    const tax = read('tax', 0, 100);
    const paintCents = Math.round(gallons * price * 100);
    const materialsCents = paintCents + Math.round(supplies * 100);
    const taxCents = Math.round(materialsCents * tax / 100);
    const totalCents = materialsCents + taxCents + Math.round(labor * 100);
    if (!Number.isSafeInteger(totalCents) || totalCents > 1e14)
      throw Error('The estimated cost is too large.');
    return {paint:paintCents/100, materials:materialsCents/100, tax:taxCents/100, labor, total:totalCents/100};
  }

  let gross;
  switch (kind) {
    case 'exterior': gross = read('perimeter', .01)*read('height', .01)+read('gable'); break;
    case 'ceiling': gross = read('length', .01)*read('width', .01)*read('rooms', 1, 1000, true); break;
    case 'trim': gross = read('length', .01)*read('face', .01)/12; break;
    default: throw Error('Unknown calculator.');
  }
  const openings = kind === 'exterior' ? read('openings') : 0;
  if (openings >= gross) throw Error('Openings must be smaller than the gross exterior area.');
  const area = gross-openings;
  const coats = read('coats',1,10,true);
  const coverage = read('coverage',.01);
  const waste = read('waste',0,100);
  const base = area*coats/coverage;
  const gallons = base*(1+waste/100);
  if (!Number.isFinite(gallons) || gallons > 1e8) throw Error('The estimated quantity is too large.');
  return {gross, openings, area, base, extra:gallons-base, gallons, whole:Math.ceil(gallons)};
}
