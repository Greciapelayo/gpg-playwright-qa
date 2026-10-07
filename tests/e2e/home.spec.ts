import { test, expect } from '../../fixtures/test';

test.describe('Home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('hero shows the headline and leads to the shop', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Glow Starts Here');
    await page.getByRole('link', { name: 'Shop now' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Shop');
  });

  test('featured products are loaded with name and price', async ({ shopPage }) => {
    await expect(shopPage.products).toHaveCount(3);
    await expect(shopPage.products.first().getByTestId('price')).toHaveText(/^\$\d+\.\d{2}$/);
  });

  test('services accordion opens one service at a time on demand', async ({ page }) => {
    const services = page.getByTestId('services');
    const signature = services.locator('details', { hasText: 'GPG Signature Facial' });
    const teen = services.locator('details', { hasText: 'Teen Glow Facial' });

    await expect(signature).toHaveAttribute('open', '');
    await expect(teen.getByText('ages 13 to 17')).toBeHidden();

    await teen.locator('summary').click();
    await expect(teen.getByText('ages 13 to 17')).toBeVisible();
  });

  test('featured product can be added to the cart from the home page', async ({ shopPage }) => {
    await shopPage.addToCart('Exfoliating Soap Bar');
    await expect(shopPage.cartCount).toHaveText('1');
  });
});
