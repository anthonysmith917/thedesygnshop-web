import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
http.createServer(async(req,res)=>{
  try {
    const filename=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html')));
    if(!filename.startsWith(root+path.sep))throw Error('Invalid path');
    const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.png':'image/png','.mp4':'video/mp4'};
    res.setHeader('Content-Type',types[path.extname(filename)]||'application/octet-stream');
    res.end(await readFile(filename));
  }catch{res.statusCode=404;res.end('Not found');}
}).listen(4173,'127.0.0.1',()=>console.log('Preview ready on http://127.0.0.1:4173'));
