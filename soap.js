// SOAP 1.1 booking service (practice API). Shares data and rules with the REST API.
//   WSDL:     GET  /soap/booking?wsdl
//   Endpoint: POST /soap/booking   (Content-Type: text/xml, SOAPAction: "<operation>")
// Operations: GetServices, GetAvailableSlots, CreateBooking

const NS = 'http://gpg.example.com/booking';
const SOAP_ENV = 'http://schemas.xmlsoap.org/soap/envelope/';
const OPERATIONS = ['GetServices', 'GetAvailableSlots', 'CreateBooking'];

const escapeXml = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);

const envelope = (body) => `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="${SOAP_ENV}" xmlns:gpg="${NS}">
  <soap:Body>
${body}
  </soap:Body>
</soap:Envelope>`;

const fault = (code, message, detail = '') => envelope(`    <soap:Fault>
      <faultcode>soap:${code}</faultcode>
      <faultstring>${escapeXml(message)}</faultstring>${detail ? `
      <detail><gpg:errors>${detail}</gpg:errors></detail>` : ''}
    </soap:Fault>`);

// Reads <prefix:Name>value</prefix:Name> (any or no prefix). Enough for this practice service.
const field = (xml, name) => {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${name}>([\\s\\S]*?)</(?:\\w+:)?${name}>`));
  return m ? m[1].trim() : undefined;
};

function readRaw(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
  });
}

function wsdl(baseUrl) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<definitions name="BookingService" targetNamespace="${NS}"
  xmlns="http://schemas.xmlsoap.org/wsdl/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
  xmlns:tns="${NS}" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <types>
    <xsd:schema targetNamespace="${NS}" elementFormDefault="qualified">
      <xsd:complexType name="Service">
        <xsd:sequence>
          <xsd:element name="id" type="xsd:string"/>
          <xsd:element name="name" type="xsd:string"/>
          <xsd:element name="durationMin" type="xsd:int"/>
          <xsd:element name="price" type="xsd:decimal"/>
        </xsd:sequence>
      </xsd:complexType>
      <xsd:element name="GetServicesRequest"><xsd:complexType/></xsd:element>
      <xsd:element name="GetServicesResponse"><xsd:complexType><xsd:sequence>
        <xsd:element name="service" type="tns:Service" maxOccurs="unbounded"/>
      </xsd:sequence></xsd:complexType></xsd:element>
      <xsd:element name="GetAvailableSlotsRequest"><xsd:complexType><xsd:sequence>
        <xsd:element name="date" type="xsd:date"/>
      </xsd:sequence></xsd:complexType></xsd:element>
      <xsd:element name="GetAvailableSlotsResponse"><xsd:complexType><xsd:sequence>
        <xsd:element name="date" type="xsd:date"/>
        <xsd:element name="slot" type="xsd:string" minOccurs="0" maxOccurs="unbounded"/>
      </xsd:sequence></xsd:complexType></xsd:element>
      <xsd:element name="CreateBookingRequest"><xsd:complexType><xsd:sequence>
        <xsd:element name="serviceId" type="xsd:string"/>
        <xsd:element name="date" type="xsd:date"/>
        <xsd:element name="time" type="xsd:string"/>
        <xsd:element name="name" type="xsd:string"/>
        <xsd:element name="email" type="xsd:string"/>
      </xsd:sequence></xsd:complexType></xsd:element>
      <xsd:element name="CreateBookingResponse"><xsd:complexType><xsd:sequence>
        <xsd:element name="bookingId" type="xsd:string"/>
        <xsd:element name="status" type="xsd:string"/>
      </xsd:sequence></xsd:complexType></xsd:element>
    </xsd:schema>
  </types>
${OPERATIONS.map((op) => `  <message name="${op}Input"><part name="parameters" element="tns:${op}Request"/></message>
  <message name="${op}Output"><part name="parameters" element="tns:${op}Response"/></message>`).join('\n')}
  <portType name="BookingPortType">
${OPERATIONS.map((op) => `    <operation name="${op}"><input message="tns:${op}Input"/><output message="tns:${op}Output"/></operation>`).join('\n')}
  </portType>
  <binding name="BookingBinding" type="tns:BookingPortType">
    <soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>
${OPERATIONS.map((op) => `    <operation name="${op}"><soap:operation soapAction="${op}"/><input><soap:body use="literal"/></input><output><soap:body use="literal"/></output></operation>`).join('\n')}
  </binding>
  <service name="BookingService">
    <port name="BookingPort" binding="tns:BookingBinding"><soap:address location="${baseUrl}/soap/booking"/></port>
  </service>
</definitions>`;
}

async function handleSoap(req, res, url, ctx) {
  const send = (status, xml) => { res.writeHead(status, { 'Content-Type': 'text/xml; charset=utf-8' }); res.end(xml); };

  if (req.method === 'GET' && url.searchParams.has('wsdl')) return send(200, wsdl(`http://${req.headers.host}`));
  if (req.method !== 'POST') return send(405, fault('Client', 'Use POST for SOAP requests'));
  if (!/xml/.test(req.headers['content-type'] || '')) return send(415, fault('Client', 'Content-Type must be text/xml'));

  const xml = await readRaw(req);
  const body = field(xml, 'Body');
  if (!/<(?:\w+:)?Envelope[\s>]/.test(xml) || body === undefined) return send(500, fault('Client', 'Malformed SOAP envelope'));

  const opMatch = body.match(/<(?:\w+:)?(\w+)Request[\s/>]/);
  const op = opMatch && opMatch[1];
  const action = (req.headers.soapaction || '').replace(/"/g, '');
  if (!OPERATIONS.includes(op)) return send(500, fault('Client', `Unknown operation: ${op || 'none'}`));
  if (action !== op) return send(500, fault('Client', `SOAPAction "${action}" does not match operation "${op}"`));

  if (op === 'GetServices') {
    const items = ctx.services.map((s) => `      <gpg:service>
        <gpg:id>${s.id}</gpg:id>
        <gpg:name>${escapeXml(s.name)}</gpg:name>
        <gpg:durationMin>${s.durationMin}</gpg:durationMin>
        <gpg:price>${s.price}</gpg:price>
      </gpg:service>`).join('\n');
    return send(200, envelope(`    <gpg:GetServicesResponse>\n${items}\n    </gpg:GetServicesResponse>`));
  }

  if (op === 'GetAvailableSlots') {
    const date = field(body, 'date');
    if (!ctx.isValidDate(date)) return send(500, fault('Client', 'Invalid or missing date (YYYY-MM-DD)', '<gpg:field>date</gpg:field>'));
    const slots = ctx.availableSlots(date).map((t) => `      <gpg:slot>${t}</gpg:slot>`).join('\n');
    return send(200, envelope(`    <gpg:GetAvailableSlotsResponse>
      <gpg:date>${date}</gpg:date>${slots ? `\n${slots}` : ''}
    </gpg:GetAvailableSlotsResponse>`));
  }

  // CreateBooking
  const b = Object.fromEntries(['serviceId', 'date', 'time', 'name', 'email'].map((k) => [k, field(body, k)]));
  const errors = ctx.validateBooking(b);
  if (errors.length) {
    return send(500, fault('Client', 'Validation failed', errors.map((e) => `<gpg:field>${e}</gpg:field>`).join('')));
  }
  const result = ctx.createBooking(b);
  if (result.error) return send(500, fault('Client', result.error));
  return send(200, envelope(`    <gpg:CreateBookingResponse>
      <gpg:bookingId>${result.booking.id}</gpg:bookingId>
      <gpg:status>CONFIRMED</gpg:status>
    </gpg:CreateBookingResponse>`));
}

module.exports = { handleSoap };
