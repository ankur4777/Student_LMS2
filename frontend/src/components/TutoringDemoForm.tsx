"use client";

import { FormEvent, useState } from "react";

type Feedback = { kind: "success" | "error"; message: string } | null;

const grades = ["7", "8", "9", "10", "11", "12"];

export default function TutoringDemoForm() {
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const form = event.currentTarget;
    const values = new FormData(form);
    const format = String(values.get("format") || "");
    const timing = String(values.get("timing") || "");
    const note = String(values.get("note") || "").trim();

    const payload = {
      full_name: String(values.get("full_name") || "").trim(),
      email: String(values.get("email") || "").trim(),
      phone: String(values.get("phone") || "").trim(),
      region: String(values.get("region") || ""),
      service: format === "group" ? "group" : format === "one_to_one" ? "one_to_one" : "general",
      message: [
        "Online tutoring demo request",
        "Grade: " + String(values.get("grade") || ""),
        "Subject: " + String(values.get("subject") || ""),
        "Class format: " + (format === "one_to_one" ? "One-to-one" : format === "group" ? "Group" : "Please advise"),
        "Preferred availability: " + (timing || "Flexible"),
        ...(note ? ["Additional details: " + note] : []),
      ].join("\n"),
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
        "detail" in result && typeof result.detail === "string" ? result.detail : "";
      if (!response.ok) {
        const fallback = response.status === 429
          ? "Too many requests. Please try again later."
          : response.status >= 500
            ? "The demo enquiry service is temporarily unavailable. Please try again later."
            : "Please review the information and try again.";
        throw new Error(detail || fallback);
      }

      form.reset();
      setFeedback({
        kind: "success",
        message: "Your demo request has been sent. Our team will contact you to discuss suitable times and availability.",
      });
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to send your request. Please try again later.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="lms-home-contact-form lms-service-demo-form" onSubmit={handleSubmit}>
      <div className="lms-home-contact-heading">
        <span className="lms-landing-eyebrow">REQUEST A TUTORING DEMO</span>
        <h3>Tell us about your learner</h3>
        <p>Share a few details so we can discuss a suitable demo session. The time is confirmed by our team.</p>
      </div>

      <div className="lms-home-contact-fields">
        <label>
          Your name <span aria-hidden="true">*</span>
          <input name="full_name" type="text" autoComplete="name" placeholder="Parent or guardian name" required minLength={2} maxLength={120} />
        </label>
        <label>
          Email address <span aria-hidden="true">*</span>
          <input name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={254} />
        </label>
        <label>
          Phone number <span aria-hidden="true">*</span>
          <input name="phone" type="tel" autoComplete="tel" placeholder="+1 604 555 0110" required minLength={8} maxLength={24} pattern="\\+?[0-9][0-9 ()\\-]{7,19}" title="Enter a valid phone number with 8–20 digits or permitted separators." />
        </label>
        <label>
          Country / region <span aria-hidden="true">*</span>
          <select name="region" defaultValue="" required>
            <option value="" disabled>Choose your region</option>
            <option value="canada">Canada</option>
            <option value="australia">Australia</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          Student grade <span aria-hidden="true">*</span>
          <select name="grade" defaultValue="" required>
            <option value="" disabled>Select grade</option>
            {grades.map(grade => <option key={grade} value={grade}>Grade {grade}</option>)}
          </select>
        </label>
        <label>
          Subject <span aria-hidden="true">*</span>
          <select name="subject" defaultValue="" required>
            <option value="" disabled>Select subject</option>
            <option value="Mathematics">Mathematics</option>
            <option value="General Science">General Science</option>
            <option value="Physics">Physics</option>
            <option value="Chemistry">Chemistry</option>
            <option value="Biology">Biology</option>
            <option value="Other / need guidance">Other / need guidance</option>
          </select>
        </label>
        <label>
          Preferred class type <span aria-hidden="true">*</span>
          <select name="format" defaultValue="" required>
            <option value="" disabled>Select a format</option>
            <option value="one_to_one">One-to-one tutoring</option>
            <option value="group">Group classes</option>
            <option value="unsure">Help me choose</option>
          </select>
        </label>
        <label>
          Preferred availability <span className="lms-home-contact-optional">(optional)</span>
          <select name="timing" defaultValue="">
            <option value="">Flexible / discuss with team</option>
            <option value="Weekday mornings">Weekday mornings</option>
            <option value="Weekday afternoons">Weekday afternoons</option>
            <option value="Weekday evenings">Weekday evenings</option>
            <option value="Weekends">Weekends</option>
          </select>
        </label>
        <label className="lms-home-contact-wide">
          Anything else we should know? <span className="lms-home-contact-optional">(optional)</span>
          <textarea name="note" rows={3} maxLength={600} placeholder="Topics you need help with or questions about the demo" />
        </label>
      </div>

      <div className="lms-home-contact-honeypot" aria-hidden="true">
        <label>Website <input name="website" type="text" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <label className="lms-home-contact-consent">
        <input name="consent" type="checkbox" required />
        <span>I agree that ShabddLearningSolution (MySLS) may contact me about this tutoring demo request.</span>
      </label>

      {feedback && (
        <p className={"lms-home-contact-feedback is-" + feedback.kind} role="status" aria-live="polite">
          {feedback.message}
        </p>
      )}

      <button className="lms-landing-button lms-home-contact-submit" type="submit" disabled={submitting}>
        {submitting ? "Sending request..." : "Request my demo"}
        {!submitting && <i className="bi bi-arrow-right" aria-hidden="true" />}
      </button>
      <p className="lms-home-contact-small">Submitting a request does not confirm a demo time. Our team will contact you about availability. Please do not include sensitive student records.</p>
    </form>
  );
}
