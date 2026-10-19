"use client";

import Link from "next/link";
import { useState } from "react";

import { countryFees, formatFee, type FeeCountry } from "./fee-data";
import { publicContact } from "@/lib/publicContact";

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
                Explore hourly online tuition rates for one-to-one and group classes.
                Choose Canada or Australia to see country-specific information.
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
              <p>Choose a country to see the hourly tuition rates for online tutoring.</p>
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
                  {fee.title.includes("One-to-one") ? "✦" : "◫"}
                </div>
                <h3>{fee.title}</h3>
                <p>{fee.description}</p>
                <div className="lms-fees-card-bottom">
                  {fee.discountedAmount !== null && (
                    <div className="lms-fees-rate-row">
                      <span className="lms-fees-rate-label">Discounted rate</span>
                      <strong className="lms-fees-amount lms-fees-discount">{formatFee(fee.discountedAmount, selected)} <small>/hour</small></strong>
                      {fee.discountLabel && <span className="lms-fees-offer-note">{fee.discountLabel}</span>}
                    </div>
                  )}
                  <div className="lms-fees-rate-row">
                    <span className="lms-fees-rate-label">{fee.discountedAmount !== null ? "Listed regular rate" : "Hourly rate"}</span>
                    <strong className="lms-fees-regular">{formatFee(fee.amount, selected)}{fee.amount !== null && " /hour"}</strong>
                  </div>
                  {fee.afterPromotionAmount !== null && (
                    <div className="lms-fees-rate-row">
                      <span className="lms-fees-rate-label">After first 100 students (as provided)</span>
                      <strong className="lms-fees-regular">{formatFee(fee.afterPromotionAmount, selected)} /hour</strong>
                    </div>
                  )}
                  <span className="lms-fees-billing">{fee.billingLabel}</span>
                </div>
              </article>
            ))}
          </div>

          <div className="lms-fees-info" role="note">
            <span className="lms-fees-info-icon" aria-hidden="true">i</span>
            <div>
              <strong>{selectedCountry === "CA" ? "Rate notes & important clarification" : "Australian prices are not yet available"}</strong>
              <p>{selected.countryNotice}</p>
            </div>
          </div>
        </section>

        <section className="lms-fees-bottom">
          <div className="lms-fees-container lms-fees-bottom-grid">
            <div>
              <span className="lms-fees-section-eyebrow">NEED MORE DETAILS?</span>
              <h2>Questions about tutoring fees or class availability?</h2>
              <p>
                Contact our team about online one-to-one or group classes, subjects,
                homework help, tuition classes and assignment help. Confirm
                discounts and availability before booking.
              </p>
            </div>
            <div className="lms-fees-bottom-actions">
              <Link href="/#contact" className="lms-fees-button">
                Enquire about classes <span aria-hidden="true">↗</span>
              </Link>
              <Link href="/#portals" className="lms-fees-button lms-fees-button-outline">
                View all portals <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="lms-fees-footer">
        <div className="lms-fees-container lms-fees-footer-content">
          <span>© {new Date().getFullYear()} Student LMS.</span>
          <div className="lms-fees-footer-contacts" aria-label="Contact information">
            <a href={publicContact.phoneHref}>{publicContact.phoneDisplay}</a>
            <a href={publicContact.emailHref}>{publicContact.email}</a>
            <span>{publicContact.address}</span>
          </div>
          <span className="lms-fees-footer-disclaimer">Online tutoring rates are separate from each institution&apos;s LMS billing records.</span>
        </div>
      </footer>
    </div>
  );
}
