import test from "node:test";import assert from "node:assert/strict";import{extractLocations,extractProduct,productSlug,renderCard}from"./sync-wix-products.mjs";
test("finds product",()=>{const x=extractLocations("<loc>https://x/product-page/ww4l</loc>");assert.equal(productSlug(x[0]),"ww4l");});
test("reads JSON-LD",()=>{const h='<script type="application/ld+json">{"@type":"Product","name":"WW4L","image":["https://x/i.png"],"offers":{"price":"25"}}</script>';assert.equal(extractProduct(h,"https://x/product-page/ww4l").price,"$25.00");});
test("renders safe card",()=>assert.match(renderCard({slug:"new",url:"https://x/product-page/new",name:"New & Bold",image:"https://x/i.png",price:"$25.00"}),/New &amp; Bold/));
