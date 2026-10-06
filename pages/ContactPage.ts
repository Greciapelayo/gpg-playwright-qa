import { type Locator, type Page } from '@playwright/test';

export class ContactPage {
  readonly error: Locator;
  readonly confirmation: Locator;

  constructor(private readonly page: Page) {
    this.error = page.getByTestId('contact-error');
    this.confirmation = page.getByTestId('contact-confirmation');
  }

  async goto() {
    await this.page.goto('/contact.html');
  }

  async send({ name, email, message }: { name: string; email: string; message: string }) {
    await this.page.getByLabel('Name').fill(name);
    await this.page.getByLabel('Email').fill(email);
    await this.page.getByLabel('Message').fill(message);
    await this.page.getByRole('button', { name: 'Send message' }).click();
  }
}
