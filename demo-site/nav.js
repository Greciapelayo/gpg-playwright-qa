// Shared header, footer and cart for every page.
const links = [
  ['/shop.html', 'Shop'],
  ['/#services', 'Services'],
  ['/story.html', 'About'],
  ['/blog.html', 'Blog'],
  ['/contact.html', 'Contact'],
];
const current = location.pathname;
const navLink = ([href, label]) => `<a href="${href}"${href === current ? ' aria-current="page"' : ''}>${label}</a>`;

document.body.insertAdjacentHTML('afterbegin', `
  <header class="site-header">
    <div class="inner">
      <a href="/" class="brand" data-testid="logo">GPG Grand Petit Glow</a>
      <nav data-testid="main-nav" aria-label="Main">
        ${links.map(navLink).join('')}
        <a href="/cart.html"${current === '/cart.html' ? ' aria-current="page"' : ''}>Cart (<span data-testid="cart-count">0</span>)</a>
        <a href="/booking.html" class="book-now">Book now</a>
      </nav>
    </div>
  </header>`);

document.addEventListener('DOMContentLoaded', () => {
  document.body.insertAdjacentHTML('beforeend', `
    <footer class="site-footer">
      <div class="inner">
        <span class="brand">GPG Grand Petit Glow</span>
        <span>Facialist · Le Plateau-Mont-Royal, Montréal · By appointment only</span>
      </div>
    </footer>`);
});

window.gpgCart = {
  read() { try { return JSON.parse(localStorage.getItem('gpg-cart') || '[]'); } catch { return []; } },
  write(items) { localStorage.setItem('gpg-cart', JSON.stringify(items)); this.render(); },
  add(product, qty = 1) {
    const items = this.read();
    const line = items.find((i) => i.id === product.id);
    if (line) line.qty += qty; else items.push({ ...product, qty });
    this.write(items);
  },
  render() {
    const count = this.read().reduce((n, i) => n + i.qty, 0);
    document.querySelector('[data-testid="cart-count"]').textContent = count;
  },
};
window.gpgCart.render();

// Renders product cards with a quantity stepper (used on Home and Shop).
window.renderProducts = async (container) => {
  const list = await fetch('/api/products').then((r) => r.json());
  container.innerHTML = list.map((p) => `
    <div class="product" data-testid="product" data-id="${p.id}">
      <div class="thumb ${p.thumb}" role="img" aria-label="${p.name}"></div>
      <h3>${p.name}</h3>
      <p class="price" data-testid="price">$${p.price.toFixed(2)}</p>
      <div class="buy">
        <span class="stepper">
          <button type="button" aria-label="Decrease ${p.name}" data-step="-1">−</button>
          <input aria-label="Quantity ${p.name}" value="1" inputmode="numeric" readonly>
          <button type="button" aria-label="Increase ${p.name}" data-step="1">+</button>
        </span>
        <button type="button" class="add">Add to cart</button>
      </div>
    </div>`).join('');
  container.querySelectorAll('[data-testid=product]').forEach((card) => {
    const product = list.find((p) => p.id === card.dataset.id);
    const qty = card.querySelector('input');
    card.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
      qty.value = Math.max(1, Number(qty.value) + Number(b.dataset.step));
    }));
    card.querySelector('.add').addEventListener('click', () => {
      gpgCart.add({ id: product.id, name: product.name, price: product.price }, Number(qty.value));
      qty.value = 1;
    });
  });
  // Products load after the page, which pushes sections down: re-apply the #anchor scroll.
  if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
};
