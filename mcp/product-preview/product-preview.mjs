// Shared customer/admin MCP product-preview extension. No purchase or publication APIs.
const TTL = 30 * 86400;
const MAX = 10 * 1024 * 1024;
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const fail = (message, status = 400) => { throw Object.assign(new Error(message), {status, previewError:true}); };
const digest = async v => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v))), x => x.toString(16).padStart(2,'0')).join('');
export function safeImage(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : null; } catch { return null; }
}
async function limited(response, limit = MAX) {
  if (Number(response.headers.get('content-length')) > limit) fail('Artwork is too large.',413);
  const reader = response.body?.getReader(); if (!reader) fail('Empty response.');
  const chunks=[]; let size=0;
  try { for (;;) { const {value,done}=await reader.read(); if(done) break; size+=value.length; if(size>limit){await reader.cancel();fail('Artwork is too large.',413);} chunks.push(value); } } finally { reader.releaseLock(); }
  const bytes=new Uint8Array(size); let at=0; for(const c of chunks){bytes.set(c,at);at+=c.length;} return bytes;
}
class Studio {
  constructor(env,cookie=''){this.env=env;this.cookie=cookie;}
  async request(path,body){
    if(!/^\/api\/(?:commerce\/config|tee\/(?:catalog|products\/\d+(?:\/variants\/\d+\/placements)?|upload|uploads\/[a-f0-9-]{36}|designs|mockups(?:\/status\?task_key=[A-Za-z0-9_-]+)?))$/.test(path)) fail('Unsupported studio operation.');
    const headers=new Headers({Accept:'application/json',Origin:this.env.STORE_ORIGIN});
    if(this.cookie)headers.set('Cookie',this.cookie);
    if(body!==undefined && !(body instanceof FormData)) headers.set('Content-Type','application/json');
    const response=await this.env.STORE.fetch(new Request(this.env.STORE_ORIGIN+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body),redirect:'manual',signal:AbortSignal.timeout(60000)}));
    const cookie=response.headers.get('set-cookie')?.match(/(?:^|,\s*)(__Host-shop=[^;\s,]+)/)?.[1];if(cookie)this.cookie=cookie;
    if(path.startsWith('/api/tee/uploads/')){if(!response.ok)fail('The original artwork is unavailable. Prepare a new preview.',409);return limited(response);}
    let data;try{data=JSON.parse(new TextDecoder().decode(await limited(response,2*1024*1024)));}catch{fail('The studio is temporarily unavailable.',502);}
    if(!response.ok) fail(typeof data.error==='string' && !/secret|token|sk_live|env\./i.test(data.error)?data.error:'The studio could not prepare this preview.',response.status);
    return data;
  }
}
function variantView(v){return {variant_id:v.id,name:v.name,color:v.color,size:v.size,image:safeImage(v.image)};}
export async function options(env,input){
  const studio=new Studio(env);
  if(!input.product_id){const data=await studio.request('/api/tee/catalog');const q=(input.query||'').toLowerCase();return {products:(data.products||[]).filter(p=>!q||JSON.stringify([p.title,p.model,p.type_name,p.brand]).toLowerCase().includes(q)).map(p=>({product_id:p.id,name:p.title||p.model,image:safeImage(p.image),type:p.type_name})),note:'Choose a product, then request its verified size and color options.'};}
  const detail=await studio.request('/api/tee/products/'+input.product_id);
  const variants=(detail.variants||[]).filter(v=>v.in_stock!==false && !(v.availability_status?.length && v.availability_status.every(x=>x.status!=='in_stock')));
  return {product_id:input.product_id,name:detail.product?.title||detail.product?.model,variants:variants.map(variantView),note:'These are available blank garments. Pricing requires a production quote; no supplier cost is a customer price.'};
}
async function artwork(input){
  if(!!input.png_base64===!!input.download_url)fail('Provide exactly one original PNG: png_base64 or download_url.');
  let bytes;
  if(input.png_base64){if(input.png_base64.length>Math.ceil(MAX/3)*4||!/^[A-Za-z0-9+/]+={0,2}$/.test(input.png_base64))fail('Invalid PNG base64.');try{bytes=Uint8Array.from(atob(input.png_base64),c=>c.charCodeAt(0));}catch{fail('Invalid PNG base64.');}}
  else {let u;try{u=new URL(input.download_url);}catch{fail('Use an HTTPS image download URL.');}
    const allowed=u.protocol==='https:'&&!u.username&&!u.password&&(u.hostname==='thedesygnshop.com'||u.hostname.endsWith('.thedesygnshop.com')||u.hostname.endsWith('.oaiusercontent.com')||u.hostname==='files.oaiusercontent.com');
    if(!allowed)fail('Use PNG bytes or an image download URL from The Desygn Shop or OpenAI.');
    const response=await fetch(u,{redirect:'error',signal:AbortSignal.timeout(30000)});if(!response.ok)fail('Artwork download failed. Upload the PNG file instead.');bytes=await limited(response);
  }
  if(bytes.length<24||bytes.length>MAX||![137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n))fail('Use an original PNG up to 10 MB.');return bytes;
}
async function readPreview(env,owner,id){
  if(!/^[a-f0-9-]{36}$/.test(id||''))fail('Unknown preview.',404);
  const raw=await env.OAUTH_KV.get('product-preview:'+id);if(!raw)fail('Preview expired. Prepare a new preview.',410);
  const p=JSON.parse(raw);if(p.owner!==owner)fail('Unknown preview.',404);return p;
}
async function writePreview(env,p){await env.OAUTH_KV.put('product-preview:'+p.id,JSON.stringify(p),{expirationTtl:TTL});}
function view(p){return {preview_id:p.id,status:p.status,product_id:p.product_id,variant_id:p.variant_id,name:p.name,color:p.color,size:p.size,placement:p.placement,mockup_urls:p.mockup_urls||[],warnings:p.warnings||[],retry_after_seconds:p.status==='pending'?15:undefined,note:'Supplier product mockup with your artwork. Final print and color may vary slightly. No order, charge, or publication was created.'};}
export async function createPreview(env,owner,input){
  const identity=await digest(owner+'\n'+input.request_key), fingerprint=await digest(JSON.stringify(input)),saved=await env.OAUTH_KV.get('product-preview-request:'+identity);
  if(saved){const old=JSON.parse(saved);if(old.fingerprint!==fingerprint)fail('Use a new request key when artwork or shirt options change.',409);return view(await readPreview(env,owner,old.id));}
  const bytes=await artwork(input),studio=new Studio(env);
  const available=await studio.request(`/api/tee/products/${input.product_id}/variants/${input.variant_id}/placements`);
  const choice=(available.options||[]).find(o=>o.placement===input.placement&&o.supported);if(!choice)fail('Choose a supported print placement.');
  await studio.request('/api/commerce/config');
  const form=new FormData();form.set('file',new File([bytes],'artwork.png',{type:'image/png'}));const up=await studio.request('/api/tee/upload',form);
  const ratio=up.width/up.height,area=choice.printfile;let w=.82,h=w*area.width/(ratio*area.height);if(h>.82){h=.82;w=h*area.height*ratio/area.width;}
  const rect=input.rect||{x:(1-w)/2,y:.04,w,h};
  const design=await studio.request('/api/tee/designs',{product_id:input.product_id,variant_id:input.variant_id,placements:[{placement:input.placement,upload_id:up.upload_id,rect}]});
  const task=await studio.request('/api/tee/mockups',{design_id:design.design_id});
  if(!/^[A-Za-z0-9_-]{1,180}$/.test(task.task_key||''))fail('The supplier did not return a preview task.',502);
  const p={id:crypto.randomUUID(),owner,product_id:input.product_id,variant_id:input.variant_id,name:design.name,color:available.variant.color,size:available.variant.size,placement:input.placement,rect,upload_id:up.upload_id,design_id:design.design_id,cookie:studio.cookie,task_key:task.task_key,status:'pending',warnings:design.warnings||[],created:Date.now(),next_poll:Date.now()+15000};
  await writePreview(env,p);await env.OAUTH_KV.put('product-preview-request:'+identity,JSON.stringify({id:p.id,fingerprint}),{expirationTtl:TTL});return view(p);
}
export async function getPreview(env,owner,id){
  const p=await readPreview(env,owner,id);if(p.status!=='pending'||Date.now()<p.next_poll)return view(p);
  const studio=new Studio(env,p.cookie),data=await studio.request('/api/tee/mockups/status?task_key='+p.task_key);
  p.next_poll=Date.now()+15000;
  if(data.status==='completed'){
    p.mockup_urls=(data.mockups||[]).filter(m=>!Array.isArray(m.variant_ids)||m.variant_ids.includes(p.variant_id)).map(m=>safeImage(m.mockup_url)).filter(Boolean);
    p.status=p.mockup_urls.length?'ready':'failed';
  }else if(data.status==='failed')p.status='failed';
  await writePreview(env,p);return view(p);
}
export async function attachDraftPreviews(env,owner,input,display){
  for(let index=0;index<input.items.length;index++){
    const item=input.items[index];if(item.kind!=='custom_shirt')continue;
    if(!item.preview_id)fail('Prepare and review a product preview before creating a custom-shirt draft. Use create_product_preview, then get_product_preview.');
    const p=await readPreview(env,owner,item.preview_id);if(p.status!=='ready')fail('Wait until the product preview is ready before creating the draft.',409);
    display.items[index]={...display.items[index],preview_id:p.id,preview:{...view(p),rect:p.rect},options:`${p.name}; ${p.placement} print. ${item.specifications}`,requires_staff_quote:true};
  }return display;
}
export async function previewFiles(env,owner,display){
  const files=[];
  for(const [index,item] of display.items.entries())if(item.kind==='custom_shirt'){
    if(!item.preview_id)fail('This older draft has no product preview. Ask your assistant to prepare a new draft with the artwork and selected shirt.',409);
    const p=await readPreview(env,owner,item.preview_id);if(p.status!=='ready')fail('The product preview is not ready.',409);
    const bytes=await new Studio(env,p.cookie).request('/api/tee/uploads/'+p.upload_id);
    files.push({file:new File([bytes],'artwork.png',{type:'image/png'}),label:`Item ${index+1} ${p.name} ${p.placement} original artwork`});
    const proof=JSON.stringify({product_id:p.product_id,variant_id:p.variant_id,design_id:p.design_id,placement:p.placement,rect:p.rect,mockups:p.mockup_urls});
    // Include the exact approved placement in the staff-facing item specification.
    item.production_reference=proof;
  }return files;
}
export function previewOrderInput(input,display){
  return {...input,items:input.items.map((item,index)=>item.kind==='custom_shirt'?{...item,specifications:`${display.items[index].options}\nApproved product and placement: ${display.items[index].production_reference}`} : item)};
}
export async function refreshDraftImages(env,display){
  for(const item of display.items)if(item.kind==='shirt'&&!item.image){
    try{const response=await env.STORE.fetch(new Request(env.STORE_ORIGIN+'/api/tee/school-zone/'+item.product_id));
      if(response.ok){const data=JSON.parse(new TextDecoder().decode(await limited(response,2*1024*1024)));item.image=safeImage(data.variants?.find(v=>v.id===item.variant_id)?.image);}
    }catch{/* Existing textual details remain available when the catalog is temporarily offline. */}
  }
}
export function itemPreview(item){
  const urls=item.preview?.mockup_urls||[item.image].filter(Boolean);
  if(!urls.length)return item.kind==='custom_shirt'?'<div class="preview-empty"><strong>Product preview needed</strong><p>This draft has no attached artwork. Ask your assistant to prepare a new preview with your selected shirt.</p></div>':'';
  return `<figure class="product-preview">${urls.map(u=>safeImage(u)?`<img src="${esc(u)}" alt="${esc(item.name)} \u2014 selected shirt with artwork" loading="lazy" referrerpolicy="no-referrer">`:'').join('')}<figcaption>${item.preview?'Your artwork on the selected product. Mockup for placement and color review.':'Selected product and color.'}</figcaption></figure>${(item.preview?.warnings||[]).map(w=>`<p class="note">${esc(w)}</p>`).join('')}`;
}
export function brandedPage(title,body,headers,formOrigin){
  const h=new Headers(headers);h.set('Content-Type','text/html; charset=utf-8');h.set('Cache-Control','private, no-store');h.set('Referrer-Policy','no-referrer');h.set('X-Content-Type-Options','nosniff');h.set('X-Frame-Options','DENY');
  h.set('Content-Security-Policy',`default-src 'none'; img-src https:; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; form-action 'self'${formOrigin?' '+new URL(formOrigin).origin:''}; base-uri 'none'; frame-ancestors 'none'`);
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} \u00b7 The Desygn Shop</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap"><style>
  *{box-sizing:border-box}body{margin:0;background:#f5f3ed;color:#191917;font:16px/1.65 'DM Sans',sans-serif}.ribbon{background:#191917;color:#fff;text-align:center;padding:8px;font-size:10px;letter-spacing:.2em}.site-header{display:flex;align-items:center;justify-content:space-between;gap:20px;max-width:1200px;margin:auto;padding:22px 28px;border-bottom:1px solid #ddd9d0}.logo{width:158px;height:68px;object-fit:contain}.site-header nav{display:flex;flex-wrap:wrap;gap:22px}.site-header a{color:#191917;text-decoration:none;font-weight:600;font-size:14px}main{max-width:1000px;margin:45px auto 70px;padding:0 24px}.eyebrow{text-transform:uppercase;color:#216a9b;letter-spacing:.18em;font-size:11px;font-weight:700}h1{font-size:clamp(32px,5vw,54px);line-height:1.12;letter-spacing:-.045em;margin:14px 0 24px}h2{font-size:23px;line-height:1.25}article,form{background:#fff;border:1px solid #e1ded6;border-radius:16px;padding:28px;margin:24px 0}button,a.action{display:inline-block;background:#216a9b;color:#fff;border:0;padding:14px 24px;border-radius:7px;font:600 15px 'DM Sans',sans-serif;cursor:pointer}button.secondary{background:#eeece6;color:#191917}label{display:block;margin:14px 0}input:not([type=checkbox]):not([type=hidden]){max-width:100%;padding:10px;border:1px solid #ccc;border-radius:5px}input[type=file]{display:block;margin:8px 0}address{white-space:pre-line;font-style:normal}.note{padding:14px 18px;background:#f3f7fa;border-left:3px solid #216a9b;font-size:14px}a{color:#216a9b}small,figcaption{color:#66665d;font-size:13px}.product-preview{margin:0 0 24px;background:#f5f3ed;border-radius:12px;padding:16px;text-align:center}.product-preview img{max-width:100%;width:380px;max-height:500px;object-fit:contain;border-radius:8px}.product-preview figcaption{margin-top:12px}.preview-empty{background:#f5f3ed;padding:24px;border-radius:10px}.site-footer{background:#191917;color:#e8e6df;padding:35px 24px}.site-footer>div{max-width:1000px;margin:auto}.site-footer a{color:#e8e6df;margin-right:20px;font-size:13px}.site-footer p{color:#aaa99f;font-size:13px}@media(max-width:600px){.site-header{padding:14px 20px;align-items:flex-start}.logo{width:120px;height:52px}.site-header nav{gap:10px;max-width:160px}.site-header a{font-size:12px}main{margin-top:30px;padding:0 16px}article,form{padding:18px}button{width:100%}}
  </style></head><body><div class="ribbon">CUSTOM DESIGNS &nbsp; \u00b7 &nbsp; QUALITY PRINTING &nbsp; \u00b7 &nbsp; MADE FOR YOU</div><header class="site-header"><a href="https://thedesygnshop.com/" aria-label="The Desygn Shop home"><img class="logo" src="https://thedesygnshop.com/assets/mirror/9de887b4e1021e803a36.png" alt="The Desygn Shop"></a><nav aria-label="Store navigation"><a href="https://thedesygnshop.com/catalog.html">Shop</a><a href="https://thedesygnshop.com/apparel-studio.html">Desygn Lab</a><a href="https://thedesygnshop.com/contact.html">Contact</a></nav></header><main><p class="eyebrow">Your idea. Made visible.</p><h1>${esc(title)}</h1>${body}</main><footer class="site-footer"><div><strong>THE DESYGN SHOP</strong><p>Graphic design, custom apparel, personalized products, and professional printing.</p><a href="https://thedesygnshop.com/shipping-returns.html">Shipping & returns</a><a href="https://thedesygnshop.com/privacy.html">Privacy</a><a href="https://thedesygnshop.com/terms.html">Terms</a><a href="https://thedesygnshop.com/contact.html">Contact us</a></div></footer></body></html>`,{headers:h});
}
export function registerPreviewTools(server,env,principal,z){
  const wrap=(scope,fn)=>async input=>{try{if(!principal.scopes.includes(scope))fail('Authorize '+scope+' to use this tool.',403);return {content:[{type:'text',text:JSON.stringify(await fn(input))}]};}catch(e){return {isError:true,content:[{type:'text',text:e.previewError?e.message:'The product preview could not be prepared. Please retry.'}]};}};
  const annotations={readOnlyHint:false,destructiveHint:false,openWorldHint:true};
  server.registerTool('get_custom_shirt_options',{title:'Choose a custom shirt',description:'Get verified blank garments or exact size/color variants before preparing an artwork-on-product preview. Product IDs here are supplier catalog IDs, not published shop product IDs. Never use supplier costs as retail prices.',inputSchema:z.object({query:z.string().max(100).optional(),product_id:z.number().int().positive().optional()}),annotations:{...annotations,readOnlyHint:true}},wrap('catalog:read',i=>options(env,i)));
  server.registerTool('create_product_preview',{title:'Preview artwork on a shirt',description:'Upload original PNG artwork and create a supplier mockup on the exact verified garment variant. Creates no order or charge. Send PNG base64 without printing bytes, or a direct OpenAI/Desygn Shop image URL. Use a stable request_key for retries. Poll get_product_preview after the returned retry interval. Do not create a custom-shirt draft until ready; then pass preview_id. If the host cannot transfer the artwork, explain that and use Desygn Lab.',inputSchema:z.object({product_id:z.number().int().positive(),variant_id:z.number().int().positive(),placement:z.enum(['front','back']).default('front'),png_base64:z.string().max(13981016).optional(),download_url:z.string().url().max(4096).optional(),request_key:z.string().min(8).max(100).regex(/^[A-Za-z0-9_-]+$/),rect:z.object({x:z.number().min(0).max(1),y:z.number().min(0).max(1),w:z.number().positive().max(1),h:z.number().positive().max(1)}).optional()}),annotations:{...annotations,idempotentHint:true}},wrap('orders:write',i=>createPreview(env,principal.userId,i)));
  server.registerTool('get_product_preview',{title:'Check the product preview',description:'Poll an existing supplier mockup after retry_after_seconds. Returns only previews owned by this shopping connection. A ready preview includes actual product mockup URLs; inspect them before preparing a draft.',inputSchema:z.object({preview_id:z.uuid()}),annotations},wrap('orders:read',i=>getPreview(env,principal.userId,i.preview_id)));
}