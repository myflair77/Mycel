import {readFile,mkdir,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
const root=process.argv[2]||'.',assets={};
async function walk(dir,prefix=''){for(const item of await readdir(dir,{withFileTypes:true})){const name=prefix+'/'+item.name;if(item.isDirectory())await walk(path.join(dir,item.name),name);else assets[name]=(await readFile(path.join(dir,item.name))).toString('base64')}}
await walk(path.join(root,'build'));
const api=await readFile('worker/files.mjs','utf8');
const account=(await readFile('worker/account.mjs','utf8')).replace("import {mac} from './files.mjs';",'');
const tail=`
const ASSETS=${JSON.stringify(assets)};
const TYPES={html:'text/html; charset=utf-8',js:'application/javascript',css:'text/css',json:'application/json',webmanifest:'application/manifest+json',png:'image/png',svg:'image/svg+xml',ico:'image/x-icon'};
export default {async fetch(request,env){const path=new URL(request.url).pathname;if(path==='/share-target'&&request.method==='POST')return Response.redirect(new URL('/?shareError=1',request.url),303);if(path==='/api/account/recover')return accountApi(request,env);if(path.startsWith('/api/'))return fileApi(request,env);if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});const name=ASSETS[path]?path:(path.includes('.')?null:'/index.html');if(!name)return new Response('Not found',{status:404});const bytes=Uint8Array.from(atob(ASSETS[name]),c=>c.charCodeAt(0));return new Response(request.method==='HEAD'?null:bytes,{headers:{'Content-Type':TYPES[name.split('.').pop()]||'application/octet-stream','Cache-Control':name.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-cache','X-Content-Type-Options':'nosniff',...(name==='/sw.js'?{'Service-Worker-Allowed':'/'}:{})}})}};
`;
await mkdir(path.join(root,'dist/server'),{recursive:true});await writeFile(path.join(root,'dist/server/index.js'),api+account+tail);
