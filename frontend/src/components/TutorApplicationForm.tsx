"use client";

import { FormEvent, useState } from "react";

type Feedback = { kind: "success" | "error"; message: string } | null;

export default function TutorApplicationForm() {
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const form = event.currentTarget;
    const values = new FormData(form);
    const application = {
      full_name: String(values.get("full_name") || "").trim(),
      email: String(values.get("email") || "").trim(),
      phone: String(values.get("phone") || "").trim(),
      city: String(values.get("city") || "").trim(),
      subjects: String(values.get("subjects") || "").trim(),
      qualification: String(values.get("qualification") || "").trim(),
      teaching_level: String(values.get("teaching_level") || ""),
      experience_years: String(values.get("experience_years") || ""),
      teaching_mode: String(values.get("teaching_mode") || ""),
      portfolio_url: String(values.get("portfolio_url") || "").trim(),
      introduction: String(values.get("introduction") || "").trim(),
      consent: values.get("consent") === "on",
      website: String(values.get("website") || ""),
    };

    setSubmitting(true);
    setFeedback(null);

    try {
      const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
      const response = await fetch(`${apiBaseUrl}/api/accounts/tutor-applications/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(application),
      });

      const result: unknown = await response.json().catch(() => null);
      let message = response.ok
        ? "Thank you! Your application has been sent successfully."
        : "We could not send your application. Please review the details and try again.";

      if (result && typeof result === "object" && "detail" in result && typeof result.detail === "string") {
        message = result.detail;
      }

      if (response.ok) {
        form.reset();
        setFeedback({ kind: "success", message });
      } else {
        setFeedback({ kind: "error", message });
      }
    } catch {
      setFeedback({
        kind: "error",
        message: "Unable to reach the application service. Please try again later.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="lms-landing-tutor-form" onSubmit={handleSubmit}>
      <div className="lms-landing-tutor-form-heading">
        <span className="lms-landing-tutor-form-kicker">TUTOR APPLICATION</span>
        <h3>Tell us about yourself</h3>
        <p>Complete the details below so our team can review your interest in teaching with us.</p>
      </div>

      <div className="lms-landing-tutor-fields">
        <label>
          Full name <span aria-hidden="true">*</span>
          <input name="full_name" type="text" autoComplete="name" placeholder="Your full name" minLength={2} maxLength={120} required />
        </label>
        <label>
          Email address <span aria-hidden="true">*</span>
          <input name="email" type="email" autoComplete="email" placeholder="you@example.com" maxLength={254} required />
        </label>
        <label>
          Phone number <span aria-hidden="true">*</span>
          <input name="phone" type="tel" autoComplete="tel" placeholder="+91 98765 43210" maxLength={24} required />
        </label>
        <label>
          City / location <span aria-hidden="true">*</span>
          <input name="city" type="text" autoComplete="address-level2" placeholder="Your city" minLength={2} maxLength={100} required />
        </label>
        <label className="lms-landing-tutor-wide">
          Subjects you can teach <span aria-hidden="true">*</span>
          <input name="subjects" type="text" placeholder="e.g. Mathematics, English, Science" minLength={2} maxLength={200} required />
        </label>
        <label className="lms-landing-tutor-wide">
          Highest qualification <span aria-hidden="true">*</span>
          <input name="qualification" type="text" placeholder="e.g. B.Ed., M.Sc. Mathematics" minLength={2} maxLength={200} required />
        </label>
        <label>
          Preferred teaching level <span aria-hidden="true">*</span>
          <select name="teaching_level" defaultValue="" required>
            <option value="" disabled>Select a level</option>
            <option value="primary">Primary school</option>
            <option value="secondary">Secondary school</option>
            <option value="senior_secondary">Senior secondary</option>
            <option value="college">College / university</option>
            <option value="competitive">Competitive exams</option>
          </select>
        </label>
        <label>
          Teaching experience <span aria-hidden="true">*</span>
          <select name="experience_years" defaultValue="" required>
            <option value="" disabled>Years of experience</option>
            <option value="0-1">0–1 years</option>
            <option value="2-3">2–3 years</option>
            <option value="4-6">4–6 years</option>
            <option value="7-plus">7+ years</option>
          </select>
        </label>
        <label className="lms-landing-tutor-wide">
          Teaching preference <span aria-hidden="true">*</span>
          <select name="teaching_mode" defaultValue="" required>
            <option value="" disabled>Select a preference</option>
            <option value="online">Online</option>
            <option value="in_person">In person</option>
            <option value="both">Online and in person</option>
          </select>
        </label>
        <label className="lms-landing-tutor-wide">
          Resume or portfolio link <span className="lms-landing-tutor-optional">(optional)</span>
          <input name="portfolio_url" type="url" placeholder="https://your-portfolio-or-resume-link.com" maxLength={300} />
        </label>
        <label className="lms-landing-tutor-wide">
          Short introduction <span aria-hidden="true">*</span>
          <textarea name="introduction" rows={4} minLength={20} maxLength={1200} placeholder="Tell us about your teaching approach, experience and why you'd like to join." required />
        </label>
      </div>

      <div className="lms-landing-tutor-honeypot" aria-hidden="true">
        <label>Website <input name="website" type="text" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <label className="lms-landing-tutor-consent">
        <input type="checkbox" name="consent" required />
        <span>I agree to have these details used to review my tutor application and to be contacted about teaching opportunities.</span>
      </label>

      {feedback && (
        <p className={`lms-landing-tutor-feedback is-${feedback.kind}`} role="status" aria-live="polite">
          {feedback.message}
        </p>
      )}

      <button type="submit" className="lms-landing-button lms-landing-tutor-submit" disabled={submitting}>
        {submitting ? "Sending application..." : "Submit tutor application"}
        {!submitting && <span aria-hidden="true">→</span>}
      </button>
      <p className="lms-landing-tutor-fineprint">Required fields are marked *. Please do not include government ID numbers or sensitive personal documents.</p>
    </form>
  );
}
