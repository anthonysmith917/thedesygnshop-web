const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.site-nav');

// Keep the new Printing section visible in the primary navigation.
if (navigation && !navigation.querySelector('a[href="print-products.html"]')) {
  const printingLink = document.createElement('a');
  printingLink.href = 'print-products.html';
  printingLink.textContent = 'Printing';
  const servicesLink = navigation.querySelector('a[href="services.html"]');
  navigation.insertBefore(printingLink, servicesLink || navigation.firstChild);
}

menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!open));
  navigation.classList.toggle('open', !open);
  document.body.classList.toggle('menu-open', !open);
});

navigation?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    navigation.classList.remove('open');
    menuButton?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
  });
});

// Add a polished homepage entry point for Printing & Marketing.
const webPromo = document.querySelector('.web-promo');
if (webPromo && !document.querySelector('.printing-home-feature')) {
  const feature = document.createElement('section');
  feature.className = 'printing-home-feature section';
  feature.setAttribute('aria-labelledby', 'printing-home-title');
  feature.innerHTML = `
    <div class="printing-home-card reveal">
      <div class="printing-home-copy">
        <p class="eyebrow"><span></span> Printing &amp; marketing</p>
        <h2 id="printing-home-title">Your brand should look as professional as the work behind it.</h2>
        <p>Explore business cards, flyers, brochures, signs, labels, apparel, office products, invitations, and more—designed to help your business become visible.</p>
        <div class="printing-home-actions">
          <a class="button button-primary" href="print-products.html">Explore printing</a>
          <a class="button button-secondary" href="quote.html">Get a quote</a>
        </div>
      </div>
      <div class="printing-home-products" aria-label="Popular printing categories">
        <a href="product.html?product=business-cards"><strong>Business Cards</strong><span>Premium stocks &amp; finishes</span></a>
        <a href="product.html?product=flyers"><strong>Flyers</strong><span>Promote events and offers</span></a>
        <a href="product.html?product=brochures"><strong>Brochures</strong><span>Tell the full brand story</span></a>
        <a href="print-products.html"><strong>Signs &amp; More</strong><span>Browse the complete catalog</span></a>
      </div>
    </div>`;
  webPromo.insertAdjacentElement('afterend', feature);

  const style = document.createElement('style');
  style.textContent = `
    .printing-home-feature{padding-top:0}
    .printing-home-card{display:grid;grid-template-columns:1.05fr .95fr;gap:48px;align-items:center;padding:54px;border:1px solid rgba(25,25,23,.12);border-radius:28px;background:#fff;overflow:hidden}
    .printing-home-copy h2{max-width:700px;margin:12px 0 18px;font-size:clamp(2.2rem,4vw,4.6rem);line-height:.98;letter-spacing:-.045em}
    .printing-home-copy>p:not(.eyebrow){max-width:640px;color:#69665f;font-size:1.05rem;line-height:1.7}
    .printing-home-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:26px}
    .printing-home-products{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .printing-home-products a{min-height:150px;padding:24px;border-radius:20px;background:#f3f1eb;border:1px solid rgba(25,25,23,.1);display:flex;flex-direction:column;justify-content:flex-end;transition:transform .2s ease,border-color .2s ease}
    .printing-home-products a:hover{transform:translateY(-4px);border-color:#216a9b}
    .printing-home-products strong{font-size:1.18rem}
    .printing-home-products span{margin-top:7px;color:#6d6962;font-size:.9rem;line-height:1.4}
    @media(max-width:850px){.printing-home-card{grid-template-columns:1fr;padding:36px}.printing-home-products{grid-template-columns:1fr 1fr}}
    @media(max-width:560px){.printing-home-card{padding:26px}.printing-home-products{grid-template-columns:1fr}.printing-home-products a{min-height:120px}}
  `;
  document.head.appendChild(style);
}

const filters = document.querySelectorAll('.filter');
const products = document.querySelectorAll('.product-card');

filters.forEach((button) => {
  button.addEventListener('click', () => {
    filters.forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    const selected = button.dataset.filter;
    products.forEach((product) => {
      const visible = selected === 'all' || product.dataset.category === selected;
      product.classList.toggle('filtered-out', !visible);
    });
  });
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();