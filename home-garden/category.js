/* Lightweight pilot interactions: category search only. */
(() => {
  const input=document.querySelector('#category-search');
  const button=document.querySelector('#search-button');
  const cards=[...document.querySelectorAll('.calc-card,.story,.collection')];
  const show=()=>{
    const q=(input?.value||'').toLowerCase().trim();
    cards.forEach(el=>el.classList.toggle('hidden-by-search', Boolean(q) && !el.textContent.toLowerCase().includes(q)));
  };
  input?.addEventListener('input',show);
  button?.addEventListener('click',show);
  input?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();show();}});
})();