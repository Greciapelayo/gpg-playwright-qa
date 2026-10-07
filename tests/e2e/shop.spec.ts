import { test, expect } from '../../fixtures/test';

test.describe('Product menu, cart and checkout', () => {
  test('adding products updates the cart badge and total', async ({ shopPage, cartPage }) => {
    await shopPage.goto();
    await expect(shopPage.products).toHaveCount(3);

    await shopPage.addToCart('Raw Honey Face Mask');
    await shopPage.addToCart('Raw Honey Face Mask');
    await shopPage.addToCart('Exfoliating Soap Bar');
    await expect(shopPage.cartCount).toHaveText('3');

    await cartPage.goto();
    await expect(cartPage.lines).toHaveCount(2);
    await expect(cartPage.total).toHaveText('54'); // 2 x 22 + 10
  });

  test('quantity stepper adds several units at once', async ({ shopPage, cartPage }) => {
    await shopPage.goto();
    await shopPage.increaseQuantity('Raw Honey Face Mask', 2);
    await shopPage.addToCart('Raw Honey Face Mask');
    await expect(shopPage.cartCount).toHaveText('3');

    await cartPage.goto();
    await expect(cartPage.total).toHaveText('66'); // 3 x 22
  });

  test('changing quantity to zero removes the product', async ({ shopPage, cartPage }) => {
    await shopPage.goto();
    await shopPage.addToCart('Dry Brushing Set');
    await cartPage.goto();

    await cartPage.setQuantity('Dry Brushing Set', 0);
    await expect(cartPage.lines).toHaveCount(0);
    await expect(cartPage.emptyMessage).toBeVisible();
  });

  test('client can place an order', async ({ shopPage, cartPage }) => {
    await shopPage.goto();
    await shopPage.addToCart('Dry Brushing Set');
    await cartPage.goto();

    await cartPage.checkout('Marie Roy', 'marie@example.com');
    await expect(cartPage.confirmation).toHaveText('Thank you! Your order of $18 has been placed.');
    await expect(shopPage.cartCount).toHaveText('0');
  });

  test('checkout is blocked with an invalid email', async ({ shopPage, cartPage }) => {
    await shopPage.goto();
    await shopPage.addToCart('Exfoliating Soap Bar');
    await cartPage.goto();

    await cartPage.checkout('Marie Roy', 'marie@');
    await expect(cartPage.error).toBeVisible();
    await expect(cartPage.confirmation).toBeHidden();
  });
});
