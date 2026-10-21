/* Shared Metricpedia header. One component for Home and inner pages. */
(() => {
 const mount=document.querySelector('#shared-header');
 if(!mount)return;
 const inner=mount.dataset.variant==='inner';
 const root=inner?'../':'';
 const navigation=[
  ['Categories',root+'#categories'],
  ['Popular',root+'#popular'],
  ['Guides',root+'#guides'],
 ];
 const logo=inner?'<a class="compact-brand" href="../" aria-label="Metricpedia home"><strong>Metricpedia</strong></a>':'';
 const links=navigation.map(([name,url])=>'<a href="'+url+'">'+name+'</a>').join('');
 mount.outerHTML='<header class="header metricpedia-shared-header"><div class="header-inner">'+logo+
  '<nav aria-label="Main navigation">'+links+'<span>About</span></nav>'+
  '<div class="header-actions"><button type="button" class="theme-toggle" aria-label="Switch to dark theme" title="Switch to dark theme" aria-pressed="false">☾</button>'+
  '<a class="header-search" href="'+root+'" aria-label="Metricpedia homepage">⌕</a>'+
  '<a class="primary" href="'+root+'#categories">Explore Tools →</a></div></div></header>';
})();
