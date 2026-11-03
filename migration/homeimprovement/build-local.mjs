// Run in the prepared cms directory; local compilation only.
import {execFileSync} from 'node:child_process';
import {cpSync} from 'node:fs';
execFileSync('npm',['run','check'],{stdio:'inherit'});
execFileSync('npm',['run','build'],{stdio:'inherit'});
cpSync('../site','dist',{recursive:true});
execFileSync('./node_modules/.bin/esbuild',['worker/homeimprovement-validation.ts','--bundle','--format=esm','--platform=browser','--target=es2022','--outfile=dist/_worker.js'],{stdio:'inherit'});
console.log('Local validation build only. No deployment executed.');
