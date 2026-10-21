/* Shared Results actions: email, print/Save as PDF, copy reproducible calculation URL.
   Call MetricpediaSharing.mount({container, getReport, getLink}) from each calculator.
   No data is sent to Metricpedia servers. */
(() => {
 'use strict';
 const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const short = value => String(value ?? '').slice(0,400);
 function mount({container,getReport,getLink}) {
  if (!container) return;
  container.innerHTML = '<div class="mp-share-title">Save or Share Results</div><div class="mp-share-buttons">'+
  '<button type="button" data-mp-share="email" aria-label="Email result"><span aria-hidden="true">✉</span>Email</button>'+
  '<button type="button" data-mp-share="print" aria-label="Print or save PDF"><span aria-hidden="true">▤</span>Print</button>'+
  '<button type="button" data-mp-share="copy" aria-label="Copy calculation link"><span aria-hidden="true">↗</span>Copy Link</button></div>'+
  '<p class="mp-share-status" role="status" aria-live="polite"></p>';
  const status = container.querySelector('.mp-share-status');
  let reportNode = document.getElementById('mp-print-report');
  if (!reportNode) { reportNode = document.createElement('section'); reportNode.id='mp-print-report';document.body.appendChild(reportNode); }
  const validReport = () => { const report=getReport(); if (!report || !report.valid) { status.textContent='Enter valid values before sharing.'; return null; } return report; };
  const reportText = report => [
   'Metricpedia — '+report.title,
   'Calculation Report — '+new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}),
   report.mode,
   '',
   report.resultLabel+': '+report.result,
   ...report.rows.map(row=>row[0]+': '+row[1]),
   '',
   'Estimates only; actual material requirements may vary.'
  ].join('\n');
  function renderPrintable(r,link) {
   const rows=r.rows.map(([label,value])=>'<tr><th>'+esc(label)+'</th><td>'+esc(value)+'</td></tr>').join('');
   reportNode.innerHTML='<div class="mp-print-head"><div><div class="mp-print-brand">Metricpedia</div><div class="mp-print-ruler"></div><small>Every Problem Has a Solution.</small></div><div class="mp-print-icon" aria-hidden="true">▦</div></div>'+
    '<div class="mp-print-heading"><h1>'+esc(r.title)+'</h1><p>Calculation Report · '+esc(new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}))+'</p><p>'+esc(r.mode)+'</p></div>'+
    '<div class="mp-print-highlight"><div>'+esc(r.resultLabel)+'</div><strong>'+esc(r.result)+'</strong></div>'+
    '<h2>Calculation Details</h2><table><tbody>'+rows+'</tbody></table>'+
    '<p class="mp-print-note">Results are estimates based on the information provided. Coverage varies by surface and product. Confirm specifications with the manufacturer.</p>'+
    '<div class="mp-print-foot"><span>'+esc(link)+'</span><span>metricpedia.com</span></div>';
  }
  container.addEventListener('click', async event => {
   const button=event.target.closest('[data-mp-share]'); if (!button)return;
   const report=validReport();if(!report)return;
   const link=getLink();
   switch(button.dataset.mpShare) {
    case 'email': {
     const subject=report.title+' — Metricpedia Results';
     const body=reportText(report)+'\n\nOpen this calculation: '+link;
     window.location.href='mailto:?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
     status.textContent='Your email application will open with the results.';
     break;
    }
    case 'print':
     renderPrintable(report,link);
     status.textContent='Choose a printer or “Save as PDF” in the print dialog.';
     window.print();break;
    case 'copy':
     try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(link);
      else { const input=document.createElement('textarea');input.value=link;input.setAttribute('readonly','');input.style.position='fixed';input.style.opacity='0';document.body.appendChild(input);input.select();const ok=document.execCommand('copy');input.remove();if(!ok)throw new Error('Copy unavailable');}
      status.textContent='Link copied! It will reopen with the same values.';
     }catch{status.textContent='Unable to copy automatically. Copy the address from your browser.';}
     break;
   }
  });
 }
 window.MetricpediaSharing={mount};
})();
