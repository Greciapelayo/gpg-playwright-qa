import { test, expect, uniqueWeekday, nextSunday } from '../../fixtures/test';

test.describe('Appointment booking', () => {
  test.beforeEach(async ({ bookingPage }) => {
    await bookingPage.goto();
  });

  test('client can book an available facial', async ({ bookingPage }) => {
    const date = uniqueWeekday();
    await bookingPage.chooseService('GPG Signature Facial - $115');
    await bookingPage.chooseDate(date);
    await bookingPage.chooseTime('11:00');
    await bookingPage.fillContact('Ana Tremblay', 'ana@example.com');
    await bookingPage.submit.click();

    await expect(bookingPage.confirmation).toBeVisible();
    await expect(bookingPage.confirmation).toContainText(`confirmed for ${date} at 11:00`);
  });

  test('booked slot is no longer offered', async ({ bookingPage, page }) => {
    const date = uniqueWeekday();
    await bookingPage.chooseService('Teen Glow Facial - $75');
    await bookingPage.chooseDate(date);
    await bookingPage.chooseTime('14:00');
    await bookingPage.fillContact('Luis Gagnon', 'luis@example.com');
    await bookingPage.submit.click();
    await expect(bookingPage.confirmation).toBeVisible();

    await bookingPage.goto();
    await bookingPage.chooseDate(date);
    await expect(bookingPage.slots).toHaveCount(5);
    await expect(page.getByTestId('slots').getByRole('button', { name: '14:00' })).toHaveCount(0);
  });

  test('no slots are offered on Sundays', async ({ bookingPage }) => {
    await bookingPage.chooseDate(nextSunday());
    await expect(bookingPage.noSlots).toBeVisible();
    await expect(bookingPage.slots).toHaveCount(0);
  });

  test('shows validation errors when required fields are missing', async ({ bookingPage }) => {
    await bookingPage.chooseService('Signature Facial + LED Light Therapy - $140');
    await bookingPage.chooseDate(uniqueWeekday());
    await bookingPage.fillContact('', 'not-an-email');
    await bookingPage.submit.click();

    await expect(bookingPage.error).toContainText('time');
    await expect(bookingPage.error).toContainText('name');
    await expect(bookingPage.error).toContainText('email');
    await expect(bookingPage.confirmation).toBeHidden();
  });
});
