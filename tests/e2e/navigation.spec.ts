import { test, expect } from '../../fixtures/test';

const pages = [
  { link: 'About', path: '/story.html', heading: 'Our Story' },
  { link: 'Book now', path: '/booking.html', heading: 'Book a facial' },
  { link: 'Shop', path: '/shop.html', heading: 'Shop' },
  { link: 'Blog', path: '/blog.html', heading: 'Blog' },
  { link: 'Contact', path: '/contact.html', heading: 'Contact us' },
];

test.describe('Navigation and content', () => {
  for (const { link, path, heading } of pages) {
    test(`main menu opens "${link}"`, async ({ page }) => {
      await page.goto('/');
      await page.getByTestId('main-nav').getByRole('link', { name: link, exact: true }).click();
      await expect(page).toHaveURL(path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    });
  }

  test('"Services" menu link shows the in-studio services', async ({ page }) => {
    await page.goto('/blog.html');
    await page.getByTestId('main-nav').getByRole('link', { name: 'Services' }).click();
    await expect(page).toHaveURL('/#services');
    await expect(page.getByRole('heading', { name: 'In-Studio Services' })).toBeInViewport();
  });

  test('home call-to-action leads to booking', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('cta-book').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Book a facial');
  });

  test('every blog post opens and links back to the blog', async ({ page }) => {
    await page.goto('/blog.html');
    const titles = await page.getByTestId('post-card').getByRole('link').allTextContents();
    expect(titles.length).toBeGreaterThan(0);

    for (const title of titles) {
      await page.getByRole('link', { name: title }).click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
      await page.getByRole('link', { name: 'Back to blog' }).click();
    }
  });

  test('no broken internal links', async ({ page, request }) => {
    await page.goto('/');
    const hrefs = await page.locator('a[href^="/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
    await page.goto('/blog.html');
    hrefs.push(...(await page.locator('a[href^="/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')!))));

    for (const href of new Set(hrefs)) {
      const res = await request.get(href);
      expect(res.status(), `${href} should load`).toBe(200);
    }
  });
});
