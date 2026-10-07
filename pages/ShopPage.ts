import { type Locator, type Page } from '@playwright/test';

export class ShopPage {
  readonly products: Locator;
  readonly cartCount: Locator;

  constructor(private readonly page: Page) {
    this.products = page.getByTestId('product');
    this.cartCount = page.getByTestId('cart-count');
  }

  async goto() {
    await this.page.goto('/shop.html');
  }

  async increaseQuantity(productName: string, times = 1) {
    const plus = this.page.getByRole('button', { name: `Increase ${productName}` });
    for (let i = 0; i < times; i++) await plus.click();
  }

  async addToCart(productName: string) {
    await this.products.filter({ hasText: productName }).getByRole('button', { name: 'Add to cart' }).click();
  }
}

export class CartPage {
  readonly lines: Locator;
  readonly total: Locator;
  readonly emptyMessage: Locator;
  readonly error: Locator;
  readonly confirmation: Locator;

  constructor(private readonly page: Page) {
    this.lines = page.getByTestId('cart-line');
    this.total = page.getByTestId('cart-total');
    this.emptyMessage = page.getByTestId('empty-cart');
    this.error = page.getByTestId('checkout-error');
    this.confirmation = page.getByTestId('order-confirmation');
  }

  async goto() {
    await this.page.goto('/cart.html');
  }

  async setQuantity(productName: string, qty: number) {
    const input = this.page.getByLabel(`Quantity ${productName}`);
    await input.fill(String(qty));
    await input.dispatchEvent('change');
  }

  async checkout(name: string, email: string) {
    await this.page.getByLabel('Full name').fill(name);
    await this.page.getByLabel('Email').fill(email);
    await this.page.getByRole('button', { name: 'Place order' }).click();
  }
}
