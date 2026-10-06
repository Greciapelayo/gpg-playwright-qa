import { type Locator, type Page, expect } from '@playwright/test';

export class BookingPage {
  readonly service: Locator;
  readonly date: Locator;
  readonly slots: Locator;
  readonly noSlots: Locator;
  readonly name: Locator;
  readonly email: Locator;
  readonly submit: Locator;
  readonly error: Locator;
  readonly confirmation: Locator;

  constructor(private readonly page: Page) {
    this.service = page.getByLabel('Service');
    this.date = page.getByLabel('Date');
    this.slots = page.getByTestId('slots').getByRole('button');
    this.noSlots = page.getByTestId('no-slots');
    this.name = page.getByLabel('Name');
    this.email = page.getByLabel('Email');
    this.submit = page.getByRole('button', { name: 'Confirm booking' });
    this.error = page.getByTestId('booking-error');
    this.confirmation = page.getByTestId('booking-confirmation');
  }

  async goto() {
    await this.page.goto('/booking.html');
    await expect(this.service.locator('option')).not.toHaveCount(1); // services loaded from the API
  }

  async chooseService(label: string) {
    await this.service.selectOption({ label });
  }

  async chooseDate(isoDate: string) {
    await this.date.fill(isoDate);
    await this.date.dispatchEvent('change');
  }

  async chooseTime(time: string) {
    await this.page.getByTestId('slots').getByRole('button', { name: time }).click();
  }

  async fillContact(name: string, email: string) {
    await this.name.fill(name);
    await this.email.fill(email);
  }
}
