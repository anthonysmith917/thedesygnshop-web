import test from 'node:test';
import assert from 'node:assert/strict';
import {createPreview,getPreview,attachDraftPreviews,previewFiles,previewOrderInput,itemPreview,brandedPage,safeImage,options} from './product-preview.mjs';
function fixture(){
  const kv=new Map(),calls=[];const env={STORE_ORIGIN:'https://thedesygnshop.com',OAUTH_KV:{get:async k=>kv.get(k)||null,put:async(k,v)=>kv.set(k,v)},STORE:{fetch:async request=>{
    const p=new URL(request.url).pathname;calls.push({p,method:request.method,cookie:request.headers.get('Cookie')});
    if(p.endsWith('/placements'))return Response.json({variant:{color:'White',size:'M'},options:[{placement:'front',supported:true,printfile:{width:3000,height:4000}}]});
    if(p.endsWith('/commerce/config'))return Response.json({},{headers:{'Set-Cookie':'__Host-shop=private-session; Path=/; Secure'}});
    if(p.endsWith('/upload')){assert.equal(request.headers.get('Cookie'),'__Host-shop=private-session');const f=await request.formData();assert.equal(f.get('file').type,'image/png');return Response.json({upload_id:'12345678-1234-1234-1234-123456789012',width:1200,height:1600});}
    if(p.endsWith('/designs')){const d=await request.json();assert.equal(d.product_id,307);assert.equal(d.placements[0].placement,'front');assert.equal(d.placements[0].rect.w,.82);return Response.json({design_id:'12345678-1234-1234-1234-123456789013',name:'Youth Tee \u00b7 White M',warnings:['123 DPI']});}
    if(p.endsWith('/mockups'))return Response.json({task_key:'task-123'});
    if(p.endsWith('/status'))return Response.json({status:'completed',mockups:[{variant_ids:[777],mockup_url:'https://images.printful.com/white-m.jpg'},{variant_ids:[888],mockup_url:'https://images.printful.com/other.jpg'}]});
    if(p.includes('/uploads/'))return new Response(new Uint8Array([137,80,78,71,13,10,26,10,...Array(20).fill(0)]));
    throw Error('Unexpected call '+p);
  }}};return {env,kv,calls};
}
const input={product_id:307,variant_id:777,placement:'front',request_key:'test-preview-001',png_base64:Buffer.from([137,80,78,71,13,10,26,10,...Array(20).fill(0)]).toString('base64')};
test('preview flow binds original artwork and garment, preserves private session and isolates owners',async()=>{
 const {env,kv,calls}=fixture();const first=await createPreview(env,'owner-a',input);assert.equal(first.status,'pending');assert.equal(first.color,'White');assert.equal(JSON.stringify(first).includes('private-session'),false);
 const before=calls.length;assert.equal((await createPreview(env,'owner-a',input)).preview_id,first.preview_id);assert.equal(calls.length,before);
 await assert.rejects(()=>createPreview(env,'owner-a',{...input,variant_id:888}),/new request key/);
 await assert.rejects(()=>getPreview(env,'owner-b',first.preview_id),/Unknown preview/);
 assert.equal((await getPreview(env,'owner-a',first.preview_id)).status,'pending');assert.equal(calls.length,before);
 const key='product-preview:'+first.preview_id,p=JSON.parse(kv.get(key));p.next_poll=0;kv.set(key,JSON.stringify(p));
 const ready=await getPreview(env,'owner-a',first.preview_id);assert.equal(ready.status,'ready');assert.deepEqual(ready.mockup_urls,['https://images.printful.com/white-m.jpg']);
 const order={items:[{kind:'custom_shirt',name:'Birthday Crew',quantity:1,specifications:'Front print',preview_id:first.preview_id}]};
 const display=await attachDraftPreviews(env,'owner-a',order,{items:[{...order.items[0]}]});assert.match(display.items[0].options,/White M/);
 const files=await previewFiles(env,'owner-a',display);assert.equal(files.length,1);assert.equal(files[0].file.type,'image/png');
 assert.match(previewOrderInput(order,display).items[0].specifications,/"variant_id":777/);
 assert.match(itemPreview(display.items[0]),/white-m.jpg/);assert.equal(calls.some(x=>x.p==='/api/commerce/orders'),false);
});
test('missing preview, unavailable artwork, and foreign preview fail before draft/order creation',async()=>{
 const {env}=fixture();await assert.rejects(()=>attachDraftPreviews(env,'a',{items:[{kind:'custom_shirt'}]},{items:[{kind:'custom_shirt'}]}),/preview/);
 await assert.rejects(()=>previewFiles(env,'a',{items:[{kind:'custom_shirt'}]}),/older draft/);
 await assert.rejects(()=>createPreview(env,'a',{...input,png_base64:undefined,download_url:'http://127.0.0.1/secret'}),/PNG bytes/);
 await assert.rejects(()=>createPreview(env,'a',{...input,png_base64:'PHN2Zz4='}),/original PNG/);
});
test('review renders safe images and escapes markup; cookie and CSP protection survive branding',async()=>{
 assert.equal(safeImage('javascript:alert(1)'),null);assert.equal(safeImage('https://u:p@example.com/a'),null);
 const img=itemPreview({name:'<script>bad</script>',image:'https://example.com/a?x="onerror="bad'});assert.equal(img.includes('<script>'),false);assert.match(img,/&#60;script&#62;/);
 const response=brandedPage('Review <x>','<p>Safe body</p>',{'Set-Cookie':'__Host-form=abc; Secure; HttpOnly'},'https://chatgpt.com');
 assert.equal(response.headers.get('Set-Cookie'),'__Host-form=abc; Secure; HttpOnly');assert.match(response.headers.get('Content-Security-Policy'),/form-action 'self' https:\/\/chatgpt.com/);assert.match(response.headers.get('Content-Security-Policy'),/default-src 'none'/);assert.equal(response.headers.get('Referrer-Policy'),'no-referrer');assert.match(await response.text(),/Review &#60;x&#62;/);
});