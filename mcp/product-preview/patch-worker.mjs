// Guarded patch for the verified 2026-10-17 deployed bundles.
// Throws rather than editing an unfamiliar release. Preserve every other module/binding.
export function patchWorker(source,kind){
  const customer=kind==='customer';
  const z=customer?'ee':'j', Store=customer?'Jt':'ur', Drafts=customer?'ki':'Ti', page=customer?'Ft':'cr', error=customer?'ie':'X';
  let next=source;
  function once(from,to){if(next.split(from).length!==2)throw Error('Source changed or ambiguous anchor: '+from.slice(0,100));next=next.replace(from,to);}
  once(`specifications:${z}.string().trim().min(1).max(2e3)}).strict()`, `specifications:${z}.string().trim().min(1).max(2e3),preview_id:${z}.uuid().optional()}).strict()`);
  once(`function ${page}(e,t,n,o){`,`function ${page}(e,t,n,o){return __preview.brandedPage(e,t,n,o);`);
  once(`o=new ${Store}(e),r=new ${Drafts}(e);return n.registerTool`, `o=new ${Store}(e),r=new ${Drafts}(e);__preview.registerPreviewTools(n,e,t,${z});return n.registerTool`);
  once(`await new ${Store}(this.env).validateDraft(o)`,`await __preview.attachDraftPreviews(this.env,t,o,await new ${Store}(this.env).validateDraft(o))`);
  once('display_price_cents:i.price_cents})','display_price_cents:i.price_cents,image:i.image})');
  const escape=customer?'Ee':'Oe',item=customer?'z':'k',counter=customer?'v':'y';
  once(`<article><h2>\u0024{${escape}(${item}.name)}</h2>`,`<article>\u0024{__preview.itemPreview(${item})}<h2>\u0024{${escape}(${item}.name)}</h2>`);
  once(`let p=[];for(let[${counter},S]of i.input.items.entries())`,`let p=await __preview.previewFiles(this.env,r.owner,i.display);for(let[${counter},S]of i.input.items.entries())`);
  once('g.createOrder(i.input,r.id)','g.createOrder(__preview.previewOrderInput(i.input,i.display),r.id)');
  once(`t instanceof ${error}?t.message:`,`(t instanceof ${error}||t.previewError)?t.message:`);
  once('For custom artwork shirts or bulk quantities beyond supported variants, use custom_shirt to request staff review.','For custom artwork shirts, call get_custom_shirt_options, create_product_preview with the original PNG, and get_product_preview after its retry interval. Inspect the ready mockup, then pass preview_id on custom_shirt in create_draft_order. Do not replace artwork with a text description. Staff verifies the production quote.');
  once(`if(t.method===\"GET\"){let ${counter}=`, `if(t.method===\"GET\"){await __preview.refreshDraftImages(this.env,i.display);let ${counter}=`);
  next=next.replaceAll(`version:\"${customer?'1.0.0':'1.1.1'}\"`,`version:\"${customer?'1.1.0':'1.2.0'}\"`);
  return 'import * as __preview from \"./product-preview.mjs\";\n'+next;
}