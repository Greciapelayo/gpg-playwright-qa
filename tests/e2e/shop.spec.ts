import { test, expect } from '../../fixtures/test';

test.describe('Product menu, cart and checkout', () => {
  test('adding products updates the cart badge and total', async ({ shopPage, cartPage }) => {
    await shopPage.goto();
    await expect(shopPage.products).toHaveCount(3);

    await shopPage.addToCart('Vitamin C Serum');
    await shopPage.addToCart('Vitamin C Serum');
    await shopPage.addToCart('Clay Mask');
    await expect(shopPage.cartCount).toHaveText('3');

    await cartPage.goto();
    await expect(cartPage.lines).toHaveCount(2);
    await expect(cartPage.total).toHaveText('109'); // 2 x 42 + 25
  });

  test('changing quantity to zero removes the product', async ({ shopPage, cartPage }) => {
    await shopPage.goto();
    await shopPage.addToCart('Night Cream');
    await cartPage.goto();

    await cartPage.setQuantity('Night Cream', 0);
    await expect(cartPage.lines).toHaveCount(0);
    await expect(cartPage.emptyMessage).toBeVisible();
  });

  test('client can place an order', async ({ shopPage, cartPage }) => {
    await shopPage.goto();
    await shopPage.addToCart('Night Cream');
    await cartPage.goto();

    await cartPage.checkout('Marie Roy', 'marie@example.com');
    await expect(cartPage.confirmation).toHaveText('Thank you! Your order of $38 has been placed.');
    await expect(shopPage.cartCount).toHaveText('0');
  });

  test('checkout is blocked with an invalid email', async ({ shopPage, cartPage }) => {
    await shopPage.goto();
    await shopPage.addToCart('Clay Mask');
    await cartPage.goto();

    await cartPage.checkout('Marie Roy', 'marie@');
    await expect(cartPage.error).toBeVisible();
    await expect(cartPage.confirmation).toBeHidden();
  });
});
