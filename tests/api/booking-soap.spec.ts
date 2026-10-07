import { test, expect } from '@playwright/test';
import { uniqueWeekday, nextSunday } from '../../fixtures/test';
import { callSoap, xml } from '../../fixtures/soap';

const validBooking = () => ({
  serviceId: 'signature',
  date: uniqueWeekday(),
  time: '13:00',
  name: 'SOAP Test',
  email: 'soap@example.com',
});

test.describe('SOAP API - contract', () => {
  test('WSDL describes the three operations and the endpoint', async ({ request }) => {
    const res = await request.get('/soap/booking?wsdl');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/xml');

    const { values } = xml(await res.text());
    expect(values('//wsdl:portType/wsdl:operation/@name')).toEqual(['GetServices', 'GetAvailableSlots', 'CreateBooking']);
    expect(values('//wsdl:service/wsdl:port/*[local-name()="address"]/@location')[0]).toMatch(/\/soap\/booking$/);
  });
});

test.describe('SOAP API - operations', () => {
  test('GetServices returns every service with id, name, duration and price', async ({ request }) => {
    const { res, values } = await callSoap(request, 'GetServices');
    expect(res.status()).toBe(200);

    const ids = values('//gpg:GetServicesResponse/gpg:service/gpg:id');
    expect(ids).toEqual(['signature', 'signature-led', 'teen-glow']);
    expect(values('//gpg:service[gpg:id="signature"]/gpg:price')).toEqual(['115']);
    for (const duration of values('//gpg:service/gpg:durationMin')) expect(Number(duration)).toBeGreaterThan(0);
  });

  test('GetAvailableSlots returns six slots on a weekday', async ({ request }) => {
    const date = uniqueWeekday();
    const { res, value, values } = await callSoap(request, 'GetAvailableSlots', { date });
    expect(res.status()).toBe(200);
    expect(value('//gpg:GetAvailableSlotsResponse/gpg:date')).toBe(date);
    expect(values('//gpg:slot')).toHaveLength(6);
  });

  test('GetAvailableSlots returns no slots on Sunday', async ({ request }) => {
    const { values } = await callSoap(request, 'GetAvailableSlots', { date: nextSunday() });
    expect(values('//gpg:slot')).toEqual([]);
  });

  test('CreateBooking confirms the booking and removes the slot', async ({ request }) => {
    const booking = validBooking();
    const { res, value } = await callSoap(request, 'CreateBooking', booking);
    expect(res.status()).toBe(200);
    expect(value('//gpg:CreateBookingResponse/gpg:bookingId')).toMatch(/^BK-\d+$/);
    expect(value('//gpg:CreateBookingResponse/gpg:status')).toBe('CONFIRMED');

    const slots = await callSoap(request, 'GetAvailableSlots', { date: booking.date });
    expect(slots.values('//gpg:slot')).not.toContain(booking.time);
  });
});

test.describe('SOAP API - faults', () => {
  test('CreateBooking with invalid fields returns a Client fault listing each field', async ({ request }) => {
    const { res, value, values } = await callSoap(request, 'CreateBooking', {
      serviceId: 'unknown', date: 'x', time: '09:00', name: ' ', email: 'nope',
    });
    expect(res.status()).toBe(500);
    expect(value('//soap:Fault/faultcode')).toBe('soap:Client');
    expect(value('//soap:Fault/faultstring')).toBe('Validation failed');
    expect(values('//soap:Fault/detail//gpg:field')).toEqual(['serviceId', 'date', 'time', 'name', 'email']);
  });

  test('double booking returns a fault', async ({ request }) => {
    const booking = validBooking();
    expect((await callSoap(request, 'CreateBooking', booking)).res.status()).toBe(200);
    const second = await callSoap(request, 'CreateBooking', { ...booking, name: 'Someone else' });
    expect(second.res.status()).toBe(500);
    expect(second.value('//faultstring')).toBe('Slot already booked');
  });

  test('booking on Sunday returns a fault', async ({ request }) => {
    const { value } = await callSoap(request, 'CreateBooking', { ...validBooking(), date: nextSunday() });
    expect(value('//faultstring')).toBe('Closed on Sundays');
  });

  test('SOAPAction header must match the operation', async ({ request }) => {
    const { res, value } = await callSoap(request, 'GetServices', {}, { soapAction: 'CreateBooking' });
    expect(res.status()).toBe(500);
    expect(value('//faultstring')).toContain('does not match');
  });

  test('unknown operation returns a fault', async ({ request }) => {
    const { value } = await callSoap(request, 'CancelBooking');
    expect(value('//faultstring')).toBe('Unknown operation: CancelBooking');
  });

  test('malformed envelope returns a fault', async ({ request }) => {
    const { res, value } = await callSoap(request, 'GetServices', {}, { body: '<notSoap/>' });
    expect(res.status()).toBe(500);
    expect(value('//faultstring')).toBe('Malformed SOAP envelope');
  });

  test('wrong Content-Type is rejected with 415', async ({ request }) => {
    const res = await request.post('/soap/booking', {
      headers: { 'Content-Type': 'application/json', SOAPAction: 'GetServices' },
      data: '{}',
    });
    expect(res.status()).toBe(415);
  });
});
