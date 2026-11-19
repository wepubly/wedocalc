import assert from 'node:assert/strict';
import {build} from 'esbuild';
const compiled=await build({entryPoints:['worker/production-render.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {articleHtml,articleMarkdown}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const legacy={title:'Historical painting article',slug:'historical-painting',body:'## Project\n\nThe original article body.',excerpt:'Original excerpt.',seoTitle:'Painting',description:'Original description.',author:'Metricpedia Editorial',authorType:'Organization',language:'en-US',category:'Home & Garden',tags:[],coverId:'',coverAlt:''};
const before=JSON.stringify(legacy),published='2026-10-23T12:00:00.000Z',updated=published;
for(const preview of [false,true]){
 const html=articleHtml(legacy,'https://metricpedia.com',published,updated,preview);
 assert.match(html,/By <a[^>]+>Alexandro M\. Braga<\/a>/);
 assert.match(html,/id="about-author"/);assert.match(html,/mailto:alex@avantybrands.com/);
 assert.match(html,/The original article body\./);
 const bio=html.match(/<section id="about-author"[\s\S]*?<\/section>/)[0];
 assert.ok(!bio.includes('**')&&!/[\u2013\u2014]/.test(bio));
 if(!preview){const ld=JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);const author=ld['@graph'][0].author;assert.equal(author['@type'],'Person');assert.equal(author.name,'Alexandro M. Braga');assert.equal(author.email,'alex@avantybrands.com');assert.equal(ld['@graph'][0].datePublished,published);}
 assert.equal(JSON.stringify(legacy),before,'Rendering must not mutate approved historical snapshots');
}
const md=articleMarkdown(legacy,'https://metricpedia.com',published,updated);
assert.match(md,/Author: Alexandro M\. Braga/);assert.match(md,/About the author/);assert.match(md,/alex@avantybrands.com/);assert.equal(JSON.stringify(legacy),before);
console.log('PASS fixed author HTML, preview, Person schema, plain biography, Markdown and immutable legacy snapshot.');
