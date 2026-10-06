// Shared header + cart badge for every page.
document.body.insertAdjacentHTML('afterbegin', `
  <header>
    <a href="/" data-testid="logo"><strong>GPG Grand Petit Glow</strong></a>
    <nav data-testid="main-nav">
      <a href="/story.html">Our Story</a>
      <a href="/booking.html">Book</a>
      <a href="/shop.html">Shop</a>
      <a href="/blog.html">Blog</a>
      <a href="/contact.html">Contact</a>
      <a href="/cart.html">Cart (<span data-testid="cart-count">0</span>)</a>
    </nav>
  </header>`);

window.gpgCart = {
  read() { try { return JSON.parse(localStorage.getItem('gpg-cart') || '[]'); } catch { return []; } },
  write(items) { localStorage.setItem('gpg-cart', JSON.stringify(items)); this.render(); },
  add(product) {
    const items = this.read();
    const line = items.find((i) => i.id === product.id);
    if (line) line.qty += 1; else items.push({ ...product, qty: 1 });
    this.write(items);
  },
  render() {
    const count = this.read().reduce((n, i) => n + i.qty, 0);
    document.querySelector('[data-testid="cart-count"]').textContent = count;
  },
};
window.gpgCart.render();
