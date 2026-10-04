const search = document.getElementById('catalog-search');
const cards = [...document.querySelectorAll('.product-card')];
const count = document.getElementById('catalog-count');
const empty = document.getElementById('catalog-empty');
function filterCatalog() {
  const query = search.value.trim().toLowerCase();
  let shown = 0;
  for (const card of cards) {
    card.hidden = !card.textContent.toLowerCase().includes(query);
    if (!card.hidden) shown++;
  }
  count.textContent = `${shown} of ${cards.length} designs`;
  empty.hidden = shown !== 0;
}
search.addEventListener('input', filterCatalog);
filterCatalog();
