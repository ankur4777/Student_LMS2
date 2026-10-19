"use client";

import { FormEvent, useState } from "react";

type Feedback = {kind:"success"|"error";message:string} | null;

const options = [
  { value: "lms", label: "LMS for my school or college" },
  { value: "one_to_one", label: "One-to-one online classes" },
  { value: "group", label: "Group online classes" },
  { value: "general", label: "Other enquiry" },
];

export default function ContactInquiryForm() {
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const form = event.currentTarget;
    const values = new FormData(form);

    const payload = {
      full_name: String(values.get("full_name") || "").trim(),
      email: String(values.get("email") || "").trim(),
      phone: String(values.get("phone") || "").trim(),
      region: String(values.get("region") || ""),
      service: String(values.get("service") || ""),
      message: String(values.get("message") || "").trim(),
      consent: values.get("consent") === "on",
      website: String(values.get("website") || ""),
    };
    setSubmitting(true);
    setFeedback(null);
    try {
      const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
      const response = await fetch(apiBase + "/api/accounts/contact-inquiries/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result: unknown = await response.json().catch(() => null);
      const detail = result && typeof result === "object" &&
        "detail" in result && typeof result.detail === "string"
          ? result.detail : "";
      if (!response.ok) {
        const fallback = response.status === 429
          ? "Too many submissions. Please try again later."
          : response.status >= 500
            ? "Contact service is temporarily unavailable. Please try again later."
            : "Please check your details and try again.";
        throw new Error(detail || fallback);
      }
      form.reset();
      setFeedback({kind:"success",message:detail || "Thank you! Your enquiry has been sent."});
    } catch (error) {
      setFeedback({
        kind:"error",
        message: error instanceof Error ? error.message : "Unable to reach the contact service. Please try again later.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="lms-home-contact-form" onSubmit={handleSubmit}>
      <div className="lms-home-contact-heading">
        <span className="lms-landing-eyebrow">SEND AN ENQUIRY</span>
        <h3>Tell us what you need.</h3>
        <p>Ask about our LMS for your institution or about online tuition for a learner.</p>
      </div>
      <div className="lms-home-contact-fields">
        <label>
          Full name <span aria-hidden="true">*</span>
          <input name="full_name" autoComplete="name" placeholder="Your name" required minLength={2} maxLength={120} />
        </label>
        <label>
          Email address <span aria-hidden="true">*</span>
          <input name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={254} />
        </label>
        <label>
          Phone number <span className="lms-home-contact-optional">(optional)</span>
          <input name="phone" type="tel" autoComplete="tel" placeholder="+1 604 555 0110" maxLength={24} />
        </label>
        <label>
          Your region <span aria-hidden="true">*</span>
          <select name="region" defaultValue="" required>
            <option value="" disabled>Choose your region</option>
            <option value="canada">Canada</option>
            <option value="australia">Australia</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="lms-home-contact-wide">
          I'm interested in <span aria-hidden="true">*</span>
          <select name="service" defaultValue="" required>
            <option value="" disabled>Select a service</option>
            {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="lms-home-contact-wide">
          How can we help? <span aria-hidden="true">*</span>
          <textarea name="message" placeholder="Tell us about your school or college, or the learner's grade, subject and preferred class type." rows={4} minLength={15} maxLength={2000} required />
        </label>
      </div>
      <div className="lms-home-contact-honeypot" aria-hidden="true">
        <label>Website <input name="website" type="text" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <label className="lms-home-contact-consent">
        <input name="consent" type="checkbox" required />
        <span>I agree that Student LMS may use my information to respond to this enquiry.</span>
      </label>
      {feedback && (
        <p role="status" aria-live="polite" className={"lms-home-contact-feedback is-"+feedback.kind}>
          {feedback.message}
        </p>
      )}
      <button type="submit" className="lms-landing-button lms-home-contact-submit" disabled={submitting}>
        {submitting ? "Sending enquiry..." : "Send your enquiry"} <span aria-hidden="true">→</span>
      </button>
      <p className="lms-home-contact-small">Fields marked * are required. Please do not share passwords, IDs or sensitive student records.</p>
    </form>
  );
}
