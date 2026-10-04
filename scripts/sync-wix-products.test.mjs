import test from "node:test";import assert from "node:assert/strict";import{extractLocations,extractProduct,productSlug,renderCard}from"./sync-wix-products.mjs";
test("finds product",()=>{const x=extractLocations("<loc>https://x/product-page/ww4l</loc>");assert.equal(productSlug(x[0]),"ww4l");});
test("reads JSON-LD",()=>{const h='<script type="application/ld+json">{"@type":"Product","name":"WW4L","image":["https://x/i.png"],"offers":{"price":"25"}}</script>';assert.equal(extractProduct(h,"https://x/product-page/ww4l").price,"$25.00");});
test("renders safe card",()=>assert.match(renderCard({slug:"new",url:"https://x/product-page/new",name:"New & Bold",image:"https://x/i.png",price:"$25.00"}),/New &amp; Bold/));

test('backfills a catalog even when the baseline already knows a product, without expanding the homepage',async()=>{
  const {mkdtemp,writeFile,readFile,rm}=await import('node:fs/promises');
  const {tmpdir}=await import('node:os');const {join}=await import('node:path');
  const {createServer}=await import('node:http');const {sync}=await import('./sync-wix-products.mjs');
  const dir=await mkdtemp(join(tmpdir(),'desygn-catalog-'));
  const server=createServer((req,res)=>res.end(req.url==='/sitemap.xml'?`<urlset><loc>http://127.0.0.1:${server.address().port}/product-page/new</loc></urlset>`:'<script type="application/ld+json">{"@type":"Product","name":"New & Bold","image":"https://x/image.png","offers":{"price":"25"}}</script>'));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const indexPath=join(dir,'catalog.html'),statePath=join(dir,'state.json'),homepage=join(dir,'index.html');
    await writeFile(indexPath,'<!-- AUTO-WIX-PRODUCTS:START --><!-- AUTO-WIX-PRODUCTS:END -->');
    await writeFile(homepage,'six curated cards');await writeFile(statePath,JSON.stringify({initialized:true,slugs:['new']}));
    const options={indexPath,statePath,storeUrl:`http://127.0.0.1:${server.address().port}`};
    await sync(options);await sync(options);
    const catalog=await readFile(indexPath,'utf8');assert.equal((catalog.match(/<article/g)||[]).length,1);assert.match(catalog,/New &amp; Bold/);
    assert.equal(await readFile(homepage,'utf8'),'six curated cards');
  }finally{await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
});
