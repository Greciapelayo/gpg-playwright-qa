import { DOMParser } from '@xmldom/xmldom';
import * as xpath from 'xpath';
import type { APIRequestContext } from '@playwright/test';

export const NS = 'http://gpg.example.com/booking';
const select = xpath.useNamespaces({
  soap: 'http://schemas.xmlsoap.org/soap/envelope/',
  gpg: NS,
  wsdl: 'http://schemas.xmlsoap.org/wsdl/',
});

/** Wraps an operation payload in a SOAP 1.1 envelope. */
export function envelope(operation: string, fields: Record<string, string> = {}): string {
  const body = Object.entries(fields).map(([k, v]) => `<gpg:${k}>${v}</gpg:${k}>`).join('');
  return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:gpg="${NS}">
  <soapenv:Header/>
  <soapenv:Body><gpg:${operation}Request>${body}</gpg:${operation}Request></soapenv:Body>
</soapenv:Envelope>`;
}

/** Sends a SOAP request and returns the status plus XPath helpers over the response. */
export async function callSoap(
  request: APIRequestContext,
  operation: string,
  fields: Record<string, string> = {},
  { soapAction = operation, body = envelope(operation, fields) } = {},
) {
  const res = await request.post('/soap/booking', {
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `"${soapAction}"` },
    data: body,
  });
  const text = await res.text();
  return { res, text, ...xml(text) };
}

/** XPath helpers: values(expr) returns the text of every matching node, value(expr) the first one. */
export function xml(text: string) {
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  const values = (expr: string) => (select(expr, doc as unknown as Node) as Node[]).map((n) => n.textContent ?? '');
  return { values, value: (expr: string) => values(expr)[0] };
}
