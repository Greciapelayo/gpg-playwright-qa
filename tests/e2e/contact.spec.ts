import { test, expect } from '../../fixtures/test';

test.describe('Contact form', () => {
  test.beforeEach(async ({ contactPage }) => {
    await contactPage.goto();
  });

  test('valid message is sent', async ({ contactPage }) => {
    await contactPage.send({ name: 'Sofia', email: 'sofia@example.com', message: 'Do you offer gift cards?' });
    await expect(contactPage.confirmation).toBeVisible();
  });

  const invalidCases = [
    { title: 'empty name', data: { name: '', email: 'a@b.co', message: 'Hello, I have a question.' }, field: 'name' },
    { title: 'invalid email', data: { name: 'Sofia', email: 'sofia.com', message: 'Hello, I have a question.' }, field: 'email' },
    { title: 'message too short', data: { name: 'Sofia', email: 'a@b.co', message: 'Hi' }, field: 'message' },
  ];

  for (const { title, data, field } of invalidCases) {
    test(`shows an error for ${title}`, async ({ contactPage }) => {
      await contactPage.send(data);
      await expect(contactPage.error).toContainText(field);
      await expect(contactPage.confirmation).toBeHidden();
    });
  }
});
