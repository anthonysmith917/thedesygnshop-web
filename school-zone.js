const grid=document.querySelector('#school-products'),search=document.querySelector('#school-search'),status=document.querySelector('#school-status');
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
const sizeOrder=['2XS','XS','S','M','L','XL','2XL','3XL','4XL','5XL'];
const sizeGroup=p=>p.size_group||(/youth/i.test(p.name)?'Youth':'Adult');
let products=[];
const schoolFilter=document.querySelector('#school-filter');
function populateSchools(){for(const school of [...new Set(products.map(p=>p.school).filter(Boolean))].sort())schoolFilter.append(new Option(school,school));}
function render(){
  grid.replaceChildren();
  const query=search.value.trim().toLowerCase();
  const shown=products.filter(p=>(p.name+' '+p.school).toLowerCase().includes(query)&&(!schoolFilter.value||p.school===schoolFilter.value));
  for(const p of shown){
    const card=el('article');card.className='product-card';
    const visual=el('div');visual.className='school-art';
    if(p.image){const img=el('img');img.src=p.image;img.alt=p.name;img.loading='lazy';visual.append(img);}
    else visual.append(el('span','DESOTO CENTRAL'),el('strong',p.name.replace(/^DeSoto Central Jaguars (Youth|Adult) Tee - /,'')),el('span','JAGUARS · '+sizeGroup(p).toUpperCase()+' TEE'));
    const info=el('div');info.className='product-info';
    info.append(el('p',p.school),el('h3',p.name));
    const row=el('div');row.append(el('strong',p.price?money(p.price):'Price available on request'));
    const link=el('a',p.id?'Choose size & color →':'Contact us →');
    link.href=p.id?'https://lab.thedesygnshop.com/school-zone.html?product='+p.id:'contact.html';
    row.append(link);info.append(row);
    if(p.variants?.length){
      const sizes=[...new Set(p.variants.map(v=>v.size).filter(Boolean))].sort((a,b)=>(sizeOrder.includes(a)?sizeOrder.indexOf(a):99)-(sizeOrder.includes(b)?sizeOrder.indexOf(b):99)||a.localeCompare(b));
      info.append(el('p',sizeGroup(p)+' sizes: '+sizes.join(' · ')));
    }
    card.append(visual,info);grid.append(card);
  }
  document.querySelector('#school-count').textContent=`${shown.length} school designs`;
}
search.addEventListener('input',render);schoolFilter.addEventListener('change',render);
(async()=>{
  try{
    const response=await fetch('https://lab.thedesygnshop.com/api/school-zone');const data=await response.json();
    if(!response.ok)throw Error(data.error);
    products=data.products;
    status.textContent='Choose a design to see available colors and sizes. Stripe checkout is currently in test mode; real payments are not enabled.';
  }catch{
    const names=['Circle Cub','Slash Cub','Stars Cub','Shield Jags','Paw Splatter Cub','Cub Banner','Claw Slash Pride','Jags Today, Leaders Tomorrow','DC Cub Letters','Jags Paw Blast'];
    products=names.map(name=>({name:'DeSoto Central Jaguars Youth Tee - '+name,school:'DeSoto Central Jaguars',size_group:'Youth'}));
    status.textContent='School Zone is temporarily unavailable. Please contact us for school apparel.';
  }
  populateSchools();render();
})();
