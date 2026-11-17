const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(process.argv[2]),port=+process.argv[3];
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.mp4':'video/mp4','.json':'application/json','.woff2':'font/woff2','.ico':'image/x-icon'};
http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(root,p);
if(!f.startsWith(root)){res.writeHead(403);return res.end();}
if(req.method==='PUT'){const ch=[];req.on('data',d=>ch.push(d));req.on('end',()=>{fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,Buffer.concat(ch));res.writeHead(200);res.end('saved '+p);});return;}
fs.stat(f,(e,st)=>{if(e||st.isDirectory()){res.writeHead(404);return res.end('nf');}const t=types[path.extname(f).toLowerCase()]||'application/octet-stream';
const r=req.headers.range;if(r){const m=/bytes=(\d*)-(\d*)/.exec(r);const s=+m[1]||0,en=m[2]?+m[2]:st.size-1;res.writeHead(206,{'Content-Type':t,'Content-Range':`bytes ${s}-${en}/${st.size}`,'Accept-Ranges':'bytes','Content-Length':en-s+1});fs.createReadStream(f,{start:s,end:en}).pipe(res);}
else{res.writeHead(200,{'Content-Type':t,'Content-Length':st.size,'Accept-Ranges':'bytes','Cache-Control':'no-cache'});fs.createReadStream(f).pipe(res);}});}).listen(port,()=>console.log('serving',root,port));
