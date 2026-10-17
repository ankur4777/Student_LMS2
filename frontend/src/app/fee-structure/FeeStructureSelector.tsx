"use client";

import Link from "next/link";
import { useState } from "react";

import { countryFees, formatFee, type FeeCountry } from "./fee-data";

const countryOptions: { value: FeeCountry; label: string }[] = [
  { value: "CA", label: "Canada (CAD)" },
  { value: "AU", label: "Australia (AUD)" },
];

export default function FeeStructureSelector() {
  const [selectedCountry, setSelectedCountry] = useState<FeeCountry>("CA");
  const selected = countryFees[selectedCountry];

  return (
    <div className="lms-fees">
      <header className="lms-fees-header">
        <div className="lms-fees-container lms-fees-header-inner">
          <Link href="/" className="lms-fees-brand" aria-label="Student LMS homepage">
            <span className="lms-fees-brand-icon" aria-hidden="true">🎓</span>
            <span>Student <strong>LMS</strong></span>
          </Link>
          <nav aria-label="Fee page navigation" className="lms-fees-header-links">
            <Link href="/">Home</Link>
            <Link href="/#portals" className="lms-fees-header-action">
              Find your portal <span aria-hidden="true">↗</span>
            </Link>
          </nav>
        </div>
      </header>

      <main id="fees-main">
        <section className="lms-fees-hero">
          <div className="lms-fees-container lms-fees-hero-grid">
            <div className="lms-fees-hero-copy">
              <span className="lms-fees-eyebrow">FEES &amp; PRICING</span>
              <h1>Clearer fees, <span>wherever you learn.</span></h1>
              <p>
                Explore the fee structure for your location. Canada and
                Australia have their own fee schedules, shown in their
                local currency.
              </p>
              <div className="lms-fees-hero-note">
                <span aria-hidden="true">✓</span>
                Choose your country to view the relevant fee categories.
              </div>
            </div>
            <div className="lms-fees-hero-side" aria-hidden="true">
              <div className="lms-fees-hero-circle">
                <div className="lms-fees-hero-illustration">🎓</div>
              </div>
              <div className="lms-fees-floating lms-fees-floating-top">
                <span>🌎</span> Canada · Australia
              </div>
              <div className="lms-fees-floating lms-fees-floating-bottom">
                <span>✓</span> Easy-to-read breakdown
              </div>
            </div>
          </div>
        </section>

        <section className="lms-fees-content lms-fees-container" aria-labelledby="country-heading">
          <div className="lms-fees-region-panel">
            <div className="lms-fees-region-intro">
              <span className="lms-fees-section-eyebrow">YOUR LOCATION</span>
              <h2 id="country-heading">Where will you be studying?</h2>
              <p>Select a country below to view its fee structure and currency.</p>
            </div>
            <div className="lms-fees-select-wrap">
              <label htmlFor="lms-fees-country">Select Country</label>
              <div className="lms-fees-native-select">
                <select
                  id="lms-fees-country"
                  name="country"
                  value={selectedCountry}
                  onChange={(event) => setSelectedCountry(event.target.value as FeeCountry)}
                >
                  {countryOptions.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="lms-fees-summary" aria-live="polite" aria-atomic="true">
            <div className="lms-fees-summary-icon" aria-hidden="true">
              {selectedCountry === "CA" ? "🇨🇦" : "🇦🇺"}
            </div>
            <div>
              <span className="lms-fees-section-eyebrow">COUNTRY-SPECIFIC PRICING</span>
              <h2>{selected.heading}</h2>
              <p>{selected.intro}</p>
            </div>
            <div className="lms-fees-currency-tag">
              Currency <strong>{selected.currency}</strong>
            </div>
          </div>

          <div className="lms-fees-cards" key={selectedCountry}>
            {selected.items.map((fee, index) => (
              <article className="lms-fees-card" key={fee.key}>
                <span className="lms-fees-card-index">0{index + 1}</span>
                <div className="lms-fees-card-icon" aria-hidden="true">
                  {fee.key === "program" ? "▤" : fee.key === "registration" ? "✦" : "◫"}
                </div>
                <h3>{fee.title}</h3>
                <p>{fee.description}</p>
                <div className="lms-fees-card-bottom">
                  <span className="lms-fees-amount">{formatFee(fee.amount, selected)}</span>
                  <span className="lms-fees-billing">
                    {fee.amount === null ? selected.currency + " · Rate pending" : fee.billingLabel}
                  </span>
                </div>
              </article>
            ))}
          </div>

          <div className="lms-fees-info" role="note">
            <span className="lms-fees-info-icon" aria-hidden="true">i</span>
            <div>
              <strong>Official fee amounts have not yet been provided.</strong>
              <p>
                These are informational fee categories, not a confirmed quote
                or an invoice. The Canada and Australia schedules are configured
                separately and can display their different verified amounts
                as soon as those amounts are supplied. {selected.countryNotice}
              </p>
            </div>
          </div>
        </section>

        <section className="lms-fees-bottom">
          <div className="lms-fees-container lms-fees-bottom-grid">
            <div>
              <span className="lms-fees-section-eyebrow">NEED MORE DETAILS?</span>
              <h2>Questions about your fee structure?</h2>
              <p>
                For your exact course fee, due dates, available installments
                and payments, contact your institution or view the fee details
                assigned to your student account.
              </p>
            </div>
            <div className="lms-fees-bottom-actions">
              <Link href="/student/login" className="lms-fees-button">
                Open Student Portal <span aria-hidden="true">↗</span>
              </Link>
              <Link href="/#portals" className="lms-fees-button lms-fees-button-outline">
                View all portals <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="lms-fees-footer">
        <div className="lms-fees-container">
          <span>© {new Date().getFullYear()} Student LMS.</span>
          <span>Official student fees and payment status are available through your institution.</span>
        </div>
      </footer>
    </div>
  );
}
