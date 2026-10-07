# GPG – Playwright Test Automation

![Playwright Tests](https://github.com/Greciapelayo/gpg-playwright-qa/actions/workflows/playwright.yml/badge.svg)

End-to-end UI and REST API test automation with **Playwright + TypeScript**, built around the main user journeys of the website of **GPG Grand Petit Glow**, my facial-care business in Montréal.

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

Each UI test runs on **Chromium, Firefox and Mobile Safari (iPhone 13 emulation)**; API tests run in their own project.

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
├── pages/                # Page Objects
├── fixtures/test.ts      # Custom fixtures and test data helpers
├── tests/
│   ├── e2e/              # UI tests (booking, shop, contact, navigation)
│   └── api/              # REST API tests
├── playwright.config.ts
└── .github/workflows/    # CI pipeline
```

## Run it locally

```bash
npm install
npx playwright install
npm test                 # all projects
npm run test:chromium    # UI tests on Chromium only
npm run test:api         # API tests only
npm run report           # open the HTML report
```

The demo site starts automatically (Playwright `webServer`). To browse it manually: `npm start`, then open http://localhost:3000.

## Author

**Grecia Garcia Pelayo** – Senior QA Automation Engineer
[LinkedIn](https://www.linkedin.com/in/greciagarciapelayo/)
