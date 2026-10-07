"""Generates the Postman collections in this folder (run: python3 postman/build_collection.py).
Keeping the scripts here makes them easy to read and review; the JSON is what Postman/Newman import."""
import json
import pathlib

HERE = pathlib.Path(__file__).parent
NS = "http://gpg.example.com/booking"


def req(name, method, path, tests, body=None, headers=None, prerequest=None, raw_lang="json"):
    item = {
        "name": name,
        "request": {
            "method": method,
            "header": [{"key": k, "value": v} for k, v in (headers or {}).items()],
            "url": {"raw": "{{baseUrl}}" + path, "host": ["{{baseUrl}}"], "path": [p for p in path.split("?")[0].split("/") if p],
                    **({"query": [{"key": q.split("=")[0], "value": (q.split("=") + [None])[1]} for q in path.split("?")[1].split("&")]} if "?" in path else {})},
        },
        "event": [{"listen": "test", "script": {"type": "text/javascript", "exec": tests.strip().splitlines()}}],
    }
    if body is not None:
        item["request"]["body"] = {"mode": "raw", "raw": body, "options": {"raw": {"language": raw_lang}}}
    if prerequest:
        item["event"].insert(0, {"listen": "prerequest", "script": {"type": "text/javascript", "exec": prerequest.strip().splitlines()}})
    return item


def soap(name, operation, fields, tests, soap_action=None):
    inner = "".join(f"\n      <gpg:{k}>{v}</gpg:{k}>" for k, v in fields.items())
    body = f"""<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:gpg="{NS}">
  <soapenv:Header/>
  <soapenv:Body>
    <gpg:{operation}Request>{inner}
    </gpg:{operation}Request>
  </soapenv:Body>
</soapenv:Envelope>"""
    return req(name, "POST", "/soap/booking", tests, body,
               {"Content-Type": "text/xml; charset=utf-8", "SOAPAction": f'"{soap_action or operation}"'}, raw_lang="xml")


# Collection-level pre-request: a unique future weekday per run, so the collection can be re-run safely.
UNIQUE_DATE = """
if (!pm.collectionVariables.get('bookingDate') || pm.info.iteration === 0 && pm.info.requestName === 'Get services') {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 30 + Math.floor(Math.random() * 3000));
  if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
  pm.collectionVariables.set('bookingDate', d.toISOString().slice(0, 10));
  const s = new Date(d); s.setUTCDate(s.getUTCDate() + ((7 - s.getUTCDay()) % 7 || 7));
  pm.collectionVariables.set('sundayDate', s.toISOString().slice(0, 10));
}
"""

# Helper used by every SOAP test: parses the envelope and returns the Body.
SOAP_BODY = """let body;
require('xml2js').parseString(pm.response.text(), { explicitArray: false }, (err, xml) => {
  pm.test('Response is valid XML', () => pm.expect(err).to.be.null);
  body = xml['soap:Envelope']['soap:Body'];
});"""

rest = [
    req("Get services", "GET", "/api/services", """
pm.test('Status is 200', () => pm.response.to.have.status(200));
pm.test('Response time under 500 ms', () => pm.expect(pm.response.responseTime).to.be.below(500));
pm.test('Content-Type is JSON', () => pm.response.to.have.header('Content-Type', 'application/json'));

const schema = {
  type: 'array', minItems: 1,
  items: { type: 'object', required: ['id', 'name', 'durationMin', 'price'],
    properties: { id: { type: 'string' }, name: { type: 'string' }, durationMin: { type: 'integer' }, price: { type: 'number' } } }
};
pm.test('Matches the JSON schema', () => pm.response.to.have.jsonSchema(schema));
pm.test('Signature facial costs 115', () => {
  const signature = pm.response.json().find(s => s.id === 'signature');
  pm.expect(signature.price).to.eql(115);
});
"""),
    req("Get slots for a weekday", "GET", "/api/slots?date={{bookingDate}}", """
pm.test('Status is 200', () => pm.response.to.have.status(200));
pm.test('Six slots are available', () => pm.expect(pm.response.json().slots).to.have.lengthOf(6));
"""),
    req("Create booking", "POST", "/api/bookings", """
pm.test('Status is 201 Created', () => pm.response.to.have.status(201));
const booking = pm.response.json();
pm.test('Booking id has the expected format', () => pm.expect(booking.id).to.match(/^BK-\\d+$/));
pm.test('Echoes the requested slot', () => {
  pm.expect(booking.date).to.eql(pm.collectionVariables.get('bookingDate'));
  pm.expect(booking.time).to.eql('10:00');
});
// Chaining: save the id for later requests
pm.collectionVariables.set('bookingId', booking.id);
""", body=json.dumps({"serviceId": "signature", "date": "{{bookingDate}}", "time": "10:00",
                      "name": "Postman Test", "email": "postman@example.com"}, indent=2),
        headers={"Content-Type": "application/json"}),
    req("Double booking is rejected", "POST", "/api/bookings", """
pm.test('Status is 409 Conflict', () => pm.response.to.have.status(409));
pm.test('Error message', () => pm.expect(pm.response.json().error).to.eql('Slot already booked'));
""", body=json.dumps({"serviceId": "signature", "date": "{{bookingDate}}", "time": "10:00",
                      "name": "Someone else", "email": "other@example.com"}, indent=2),
        headers={"Content-Type": "application/json"}),
    req("Booked slot disappears", "GET", "/api/slots?date={{bookingDate}}", """
pm.test('10:00 is no longer offered', () => pm.expect(pm.response.json().slots).to.not.include('10:00'));
pm.test('Five slots left', () => pm.expect(pm.response.json().slots).to.have.lengthOf(5));
"""),
    req("Invalid booking lists every field", "POST", "/api/bookings", """
pm.test('Status is 400', () => pm.response.to.have.status(400));
pm.test('Every invalid field is reported', () =>
  pm.expect(pm.response.json().errors).to.eql(['serviceId', 'date', 'time', 'name', 'email']));
""", body=json.dumps({"serviceId": "unknown", "date": "x", "time": "09:00", "name": " ", "email": "nope"}, indent=2),
        headers={"Content-Type": "application/json"}),
    req("Sunday booking is rejected", "POST", "/api/bookings", """
pm.test('Status is 422', () => pm.response.to.have.status(422));
""", body=json.dumps({"serviceId": "signature", "date": "{{sundayDate}}", "time": "10:00",
                      "name": "Postman Test", "email": "postman@example.com"}, indent=2),
        headers={"Content-Type": "application/json"}),
]

soap_items = [
    req("Get WSDL", "GET", "/soap/booking?wsdl", """
pm.test('Status is 200', () => pm.response.to.have.status(200));
pm.test('WSDL lists the three operations', () => {
  const text = pm.response.text();
  ['GetServices', 'GetAvailableSlots', 'CreateBooking'].forEach(op => pm.expect(text).to.include(`operation name="${op}"`));
});
"""),
    soap("GetServices", "GetServices", {}, SOAP_BODY + """
pm.test('Status is 200', () => pm.response.to.have.status(200));
const services = [].concat(body['gpg:GetServicesResponse']['gpg:service']);
pm.test('Three services', () => pm.expect(services).to.have.lengthOf(3));
pm.test('Signature facial costs 115', () => {
  const signature = services.find(s => s['gpg:id'] === 'signature');
  pm.expect(Number(signature['gpg:price'])).to.eql(115);
});
"""),
    soap("GetAvailableSlots", "GetAvailableSlots", {"date": "{{bookingDate}}"}, SOAP_BODY + """
pm.test('Status is 200', () => pm.response.to.have.status(200));
const slots = [].concat(body['gpg:GetAvailableSlotsResponse']['gpg:slot'] || []);
pm.test('10:00 already taken by the REST booking', () => pm.expect(slots).to.not.include('10:00'));
"""),
    soap("CreateBooking", "CreateBooking",
         {"serviceId": "teen-glow", "date": "{{bookingDate}}", "time": "14:00", "name": "SOAP Postman", "email": "soap@example.com"},
         SOAP_BODY + """
pm.test('Status is 200', () => pm.response.to.have.status(200));
const response = body['gpg:CreateBookingResponse'];
pm.test('Status is CONFIRMED', () => pm.expect(response['gpg:status']).to.eql('CONFIRMED'));
pm.test('Booking id format', () => pm.expect(response['gpg:bookingId']).to.match(/^BK-\\d+$/));
pm.collectionVariables.set('soapBookingId', response['gpg:bookingId']);
"""),
    soap("CreateBooking - validation fault", "CreateBooking",
         {"serviceId": "unknown", "date": "x", "time": "09:00", "name": " ", "email": "nope"},
         SOAP_BODY + """
pm.test('Status is 500 (SOAP Fault)', () => pm.response.to.have.status(500));
const fault = body['soap:Fault'];
pm.test('faultcode is soap:Client', () => pm.expect(fault.faultcode).to.eql('soap:Client'));
pm.test('faultstring', () => pm.expect(fault.faultstring).to.eql('Validation failed'));
pm.test('Detail lists the invalid fields', () => {
  const fields = [].concat(fault.detail['gpg:errors']['gpg:field']);
  pm.expect(fields).to.eql(['serviceId', 'date', 'time', 'name', 'email']);
});
"""),
    soap("SOAPAction mismatch fault", "GetServices", {}, SOAP_BODY + """
pm.test('Status is 500', () => pm.response.to.have.status(500));
pm.test('Explains the mismatch', () => pm.expect(body['soap:Fault'].faultstring).to.include('does not match'));
""", soap_action="CreateBooking"),
]

collection = {
    "info": {
        "name": "GPG Booking API (REST + SOAP)",
        "description": "REST and SOAP tests for the GPG booking API. Run in order (requests are chained).",
        "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    "event": [{"listen": "prerequest", "script": {"type": "text/javascript", "exec": UNIQUE_DATE.strip().splitlines()}}],
    "variable": [{"key": "bookingDate", "value": ""}, {"key": "sundayDate", "value": ""},
                 {"key": "bookingId", "value": ""}, {"key": "soapBookingId", "value": ""}],
    "item": [{"name": "REST", "item": rest}, {"name": "SOAP", "item": soap_items}],
}

# Data-driven collection: one request, one iteration per row of contact-cases.csv
contact = {
    "info": {
        "name": "GPG Contact form - data-driven",
        "description": "Run with: newman run ... -d postman/contact-cases.csv",
        "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    "item": [req("Contact form case: {{case}}", "POST", "/api/contact", """
const expected = Number(pm.iterationData.get('expectedStatus'));
pm.test(`[${pm.iterationData.get('case')}] status is ${expected}`, () => pm.response.to.have.status(expected));
const field = pm.iterationData.get('invalidField');
if (field) {
  pm.test(`[${pm.iterationData.get('case')}] reports "${field}"`, () => pm.expect(pm.response.json().errors).to.include(field));
}
""", body='{\n  "name": "{{name}}",\n  "email": "{{email}}",\n  "message": "{{message}}"\n}',
        headers={"Content-Type": "application/json"})],
}

environment = {
    "name": "GPG local",
    "values": [{"key": "baseUrl", "value": "http://localhost:3000", "type": "default", "enabled": True}],
}

(HERE / "GPG-API.postman_collection.json").write_text(json.dumps(collection, indent=2, ensure_ascii=False) + "\n")
(HERE / "GPG-contact-data-driven.postman_collection.json").write_text(json.dumps(contact, indent=2, ensure_ascii=False) + "\n")
(HERE / "local.postman_environment.json").write_text(json.dumps(environment, indent=2) + "\n")
(HERE / "contact-cases.csv").write_text(
    "case,name,email,message,expectedStatus,invalidField\n"
    "valid message,Sofia,sofia@example.com,Do you offer gift cards?,200,\n"
    "empty name,,sofia@example.com,Do you offer gift cards?,400,name\n"
    "invalid email,Sofia,sofia.com,Do you offer gift cards?,400,email\n"
    "message too short,Sofia,sofia@example.com,Hi,400,message\n"
)
print("Postman files generated in", HERE)
