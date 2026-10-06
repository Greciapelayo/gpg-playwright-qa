import { test as base } from '@playwright/test';
import { BookingPage } from '../pages/BookingPage';
import { CartPage, ShopPage } from '../pages/ShopPage';
import { ContactPage } from '../pages/ContactPage';

type Pages = {
  bookingPage: BookingPage;
  shopPage: ShopPage;
  cartPage: CartPage;
  contactPage: ContactPage;
};

// Page objects injected as fixtures, so specs stay short and readable.
export const test = base.extend<Pages>({
  bookingPage: async ({ page }, use) => use(new BookingPage(page)),
  shopPage: async ({ page }, use) => use(new ShopPage(page)),
  cartPage: async ({ page }, use) => use(new CartPage(page)),
  contactPage: async ({ page }, use) => use(new ContactPage(page)),
});

export { expect } from '@playwright/test';

/**
 * Returns a unique future weekday (YYYY-MM-DD) so parallel tests never compete for the same slot.
 * The demo API keeps bookings in memory, shared across workers.
 */
export function uniqueWeekday(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 30 + Math.floor(Math.random() * 3000));
  if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function nextSunday(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}
