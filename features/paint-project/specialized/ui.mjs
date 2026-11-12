import {estimate} from './engine.mjs';

const form = document.querySelector('#specialized-form');
const paintCan = document.querySelector('.paint-result-can');
const result = document.querySelector('#specialized-result');
const details = document.querySelector('#specialized-details');
const error = document.querySelector('#specialized-error');
const print = document.querySelector('#specialized-print');
const format = new Intl.NumberFormat('en-US', {maximumFractionDigits:4});
const money = new Intl.NumberFormat('en-US', {style:'currency',currency:'USD'});

function render() {
  try {
    const kind = form.dataset.kind;
    const invalid = form.querySelector("input:invalid");
    if (invalid) throw Error(invalid.labels[0].textContent + ": " + invalid.validationMessage);
    const value = estimate(kind, Object.fromEntries(new FormData(form)));
    let rows;
    if (kind === 'cost') {
      result.textContent = money.format(value.total);
      rows = [['Paint',money.format(value.paint)],['Materials subtotal',money.format(value.materials)],
        ['Materials tax',money.format(value.tax)],['Labor',money.format(value.labor)]];
    } else {
      const ft = n => format.format(n)+' sq ft';
      const gal = n => (n > 0 && n < .0001 ? '< 0.0001' : format.format(n))+' gal';
      result.textContent = gal(value.gallons);
      rows = [['Gross surface',ft(value.gross)],['Openings deducted',ft(value.openings)],
        ...(kind === 'room' ? [['Ceiling area',ft(value.ceiling)]] : []), ['Paintable area',ft(value.area)],['Before allowance',gal(value.base)],
        ['Extra paint',gal(value.extra)],['If buying whole gallons',format.format(value.whole)+' gal']];
    }
    details.replaceChildren(...rows.map(([label, text]) => {
      const row = document.createElement('div');
      const name = document.createElement('span');
      const amount = document.createElement('b');
      name.textContent = label;
      amount.textContent = text;
      row.append(name,amount);
      return row;
    }));
    error.textContent = '';
    paintCan.toggleAttribute('hidden', kind === 'cost');
    print.disabled = false;
  } catch (cause) {
    result.textContent = '—';
    details.replaceChildren();
    error.textContent = cause.message;
    paintCan.setAttribute('hidden', '');
    print.disabled = true;
  }
}
form.addEventListener('input',render);
form.addEventListener('submit',event=>{event.preventDefault();render();});
print.addEventListener('click',()=>window.print());
render();
