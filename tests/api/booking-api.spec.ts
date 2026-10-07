import { test, expect } from '@playwright/test';
import { uniqueWeekday, nextSunday } from '../../fixtures/test';

const validBooking = () => ({
  serviceId: 'signature',
  date: uniqueWeekday(),
  time: '10:00',
  name: 'API Test',
  email: 'api@example.com',
});

test.describe('REST API - services and slots', () => {
  test('GET /api/services returns the catalogue with the expected schema', async ({ request }) => {
    const res = await request.get('/api/services');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/json');

    const services = await res.json();
    expect(services.length).toBeGreaterThan(0);
    for (const s of services) {
      expect(s).toEqual({
        id: expect.any(String),
        name: expect.any(String),
        durationMin: expect.any(Number),
        price: expect.any(Number),
      });
    }
  });

  test('GET /api/slots returns six slots on a weekday', async ({ request }) => {
    const res = await request.get('/api/slots', { params: { date: uniqueWeekday() } });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).slots).toHaveLength(6);
  });

  test('GET /api/slots returns no slots on Sunday', async ({ request }) => {
    const res = await request.get('/api/slots', { params: { date: nextSunday() } });
    expect((await res.json()).slots).toEqual([]);
  });

  for (const date of ['', '2026-13-45', 'tomorrow']) {
    test(`GET /api/slots rejects invalid date "${date}"`, async ({ request }) => {
      const res = await request.get('/api/slots', { params: { date } });
      expect(res.status()).toBe(400);
    });
  }
});

test.describe('REST API - bookings', () => {
  test('POST /api/bookings creates a booking (201) and removes the slot', async ({ request }) => {
    const body = validBooking();
    const res = await request.post('/api/bookings', { data: body });
    expect(res.status()).toBe(201);

    const booking = await res.json();
    expect(booking).toMatchObject(body);
    expect(booking.id).toMatch(/^BK-\d+$/);

    const slots = await request.get('/api/slots', { params: { date: body.date } });
    expect((await slots.json()).slots).not.toContain(body.time);
  });

  test('POST /api/bookings rejects a double booking (409)', async ({ request }) => {
    const body = validBooking();
    expect((await request.post('/api/bookings', { data: body })).status()).toBe(201);
    const second = await request.post('/api/bookings', { data: { ...body, name: 'Someone else' } });
    expect(second.status()).toBe(409);
  });

  test('POST /api/bookings rejects Sundays (422)', async ({ request }) => {
    const res = await request.post('/api/bookings', { data: { ...validBooking(), date: nextSunday() } });
    expect(res.status()).toBe(422);
  });

  test('POST /api/bookings lists every invalid field (400)', async ({ request }) => {
    const res = await request.post('/api/bookings', {
      data: { serviceId: 'unknown', date: 'x', time: '09:00', name: ' ', email: 'nope' },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).errors).toEqual(['serviceId', 'date', 'time', 'name', 'email']);
  });
});
