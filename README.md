# GPG – Playwright Test Automation

![Playwright Tests](https://github.com/Greciapelayo/gpg-playwright-qa/actions/workflows/playwright.yml/badge.svg)

End-to-end UI, **REST** and **SOAP** API test automation with **Playwright + TypeScript** and **Postman/Newman**, built around the main user journeys of the website of **GPG Grand Petit Glow**, my facial-care business in Montréal.

> The production website is currently being rebuilt. To keep this project public and runnable by anyone, the repository includes a lightweight **replica** of the site (`demo-site/` + `server.js`) with the same features. The test suite runs against this replica locally and in CI.

## What is tested

| Area | Coverage |
|---|---|
| **Home page** | Hero call-to-action, featured products, services accordion, add to cart from home |
| **Appointment booking** | Booking a facial end to end, booked slots disappearing, Sunday closure, required-field validation |
| **Product menu & checkout** | Add to cart, quantity stepper, cart badge and totals, quantity changes, placing an order, invalid email |
| **Contact form** | Successful submission and data-driven negative cases |
| **Navigation & content** | Main menu, call-to-action, blog articles, broken internal links |
| **REST API** | Response schema, status codes (200/201/400/409/422), double-booking protection, input validation |
| **SOAP API** | WSDL contract, XPath assertions on responses, SOAP Faults (validation, business rules, SOAPAction mismatch, malformed envelope), Content-Type |

Each UI test runs on **Chromium, Firefox and Mobile Safari (iPhone 13 emulation)**; API tests run in their own project.

## Postman / Newman

The same API is also covered by Postman collections in [`postman/`](postman/), run headless with **Newman** locally and in CI:

- **`GPG-API.postman_collection.json`**: REST and SOAP requests, chained through collection variables (a booking created over REST is checked over SOAP), with JSON-schema validation, response-time checks and XML parsing (`xml2js`) for SOAP.
- **`GPG-contact-data-driven.postman_collection.json`**: data-driven run, one iteration per row of `contact-cases.csv`.
- Reports: CLI, JUnit (for CI) and HTML (`newman-report/`).

Import the collections and `local.postman_environment.json` into the Postman app to explore them, or run everything with `npm run test:newman`. The JSON files are generated from `postman/build_collection.py` so the test scripts are easy to review.

## Approach

- **Page Object Model** (`pages/`) keeps selectors and actions in one place.
- **Custom fixtures** (`fixtures/test.ts`) inject the page objects into each test.
- **User-facing locators** (`getByRole`, `getByLabel`, `getByTestId`) instead of brittle CSS/XPath.
- **Independent, parallel-safe tests**: each booking uses a unique date, so tests never share state.
- **Data-driven tests** for negative scenarios (contact form, invalid dates).
- **Debugging**: traces on retry and screenshots on failure, plus the HTML report.
- **CI/CD**: GitHub Actions type-checks and runs the full suite on every push and pull request, then uploads the report.

## Project structure

```
├── demo-site/            # Replica of the GPG website (static pages)
├── server.js             # Serves the site + REST API (no dependencies)
├── soap.js               # SOAP 1.1 booking service + WSDL
├── pages/                # Page Objects
├── fixtures/             # Custom fixtures, test data helpers, SOAP/XPath helpers
├── tests/
│   ├── e2e/              # UI tests (booking, shop, contact, navigation)
│   └── api/              # REST and SOAP API tests
├── postman/              # Postman collections, environment, data file, Newman runner
├── playwright.config.ts
└── .github/workflows/    # CI pipeline
```

## Run it locally

```bash
npm install
npx playwright install
npm test                 # all projects
npm run test:chromium    # UI tests on Chromium only
npm run test:api         # REST + SOAP API tests only
npm run test:newman      # Postman collections with Newman (starts the server itself)
npm run report           # open the HTML report
```

The demo site starts automatically (Playwright `webServer`). To browse it manually: `npm start`, then open http://localhost:3000. The SOAP WSDL is at http://localhost:3000/soap/booking?wsdl.

## Author

**Grecia Garcia Pelayo** – Senior QA Automation Engineer
[LinkedIn](https://www.linkedin.com/in/greciagarciapelayo/)
