import type { Metadata } from "next";
import Link from "next/link";
import ContactInquiryForm from "@/components/ContactInquiryForm";
import { MarketingHeader, MarketingFooter } from "@/components/MarketingHeader";
import { publicContact } from "@/lib/publicContact";

import "../home.css";
import "../home-updates.css";
import "./contact-us.css";
import "../marketing-typography.css";

export const metadata: Metadata = {
  title: "Contact Us | MySLS School LMS & Online Tutoring",
  description:
    "Contact ShabddLearningSolution (MySLS) about school and college LMS software, online tutoring, demo enquiries and tutor applications. Find our Canada and India contact details.",
  keywords: ["MySLS contact", "ShabddLearningSolution contact", "school LMS enquiry", "online tutoring enquiry", "contact MySLS Canada", "contact MySLS India"],
  openGraph: {
    title: "Contact ShabddLearningSolution (MySLS)",
    description: "Talk to our team about online tutoring or an LMS for your school or college. Find contact details for Canada and India.",
  },
};

const enquiryTopics = [
  {
    icon: "bi-building-check",
    title: "School & College LMS",
    description: "Talk through institution setup, academic workflows, access for staff and families, and platform features.",
    href: "/services/school-college-lms",
    action: "Explore LMS services",
  },
  {
    icon: "bi-camera-video",
    title: "Online Tutoring",
    description: "Ask about Grades 7–12, one-to-one or group classes, subject support and homework guidance.",
    href: "/services/online-tutoring",
    action: "Explore online tutoring",
  },
  {
    icon: "bi-person-workspace",
    title: "Become a Tutor",
    description: "Interested in teaching online? Review the opportunity and use our dedicated tutor application form.",
    href: "/tutor-hiring",
    action: "Apply as a tutor",
  },
];

const questions = [
  {
    question: "How do I request a tutoring demo?",
    answer: "Open Online Tutoring and complete the demo request form with the learner's grade, subject and preferred class format. Our team will contact you about available times.",
    href: "/services/online-tutoring#book-demo",
    link: "Request a tutoring demo",
  },
  {
    question: "Where can I see tutoring fees?",
    answer: "Our Fee Structure page provides grade-specific tutoring information for Canada and an enquiry option for Australia. Please confirm current rates and availability before booking.",
    href: "/fee-structure",
    link: "View fee structure",
  },
  {
    question: "I need help accessing my portal. What should I do?",
    answer: "Use the login portal for your role. If you have an account, use Forgot password where available. Your institution manages access and can assist with role or account questions.",
    href: "/#portals",
    link: "Find your portal",
  },
];

export default function ContactUsPage() {
  return (
    <main className="lms-landing lms-contact-page" id="top">
      <MarketingHeader active="contact" />

      <section className="lms-contact-hero" aria-labelledby="contact-title">
        <div className="lms-landing-container lms-contact-hero-grid">
          <div className="lms-contact-hero-copy">
            <span className="lms-contact-eyebrow"><i className="bi bi-chat-dots" aria-hidden="true" /> WE'RE HERE TO HELP</span>
            <h1 id="contact-title">Let's connect and make <span>learning work better.</span></h1>
            <p>Whether you're planning a better way to manage your school or college, looking for tutoring support, or exploring a teaching opportunity, we'd love to hear what you need.</p>
            <div className="lms-contact-hero-actions">
              <a className="lms-landing-button" href="#send-enquiry">Send an enquiry <i className="bi bi-arrow-right" aria-hidden="true" /></a>
              <a className="lms-landing-button lms-landing-button-outline" href="#contact-details">Our contact details <i className="bi bi-arrow-down" aria-hidden="true" /></a>
            </div>
            <div className="lms-contact-hero-notes">
              <span><i className="bi bi-check-circle-fill" aria-hidden="true" /> Schools & colleges</span>
              <span><i className="bi bi-check-circle-fill" aria-hidden="true" /> Students & families</span>
              <span><i className="bi bi-check-circle-fill" aria-hidden="true" /> Tutor applicants</span>
            </div>
          </div>
          <aside className="lms-contact-hero-panel" aria-label="How we can help">
            <span className="lms-contact-panel-overline">START WITH YOUR QUESTION</span>
            <h2>One conversation. The right next step.</h2>
            <div className="lms-contact-panel-item">
              <span className="lms-contact-panel-icon"><i className="bi bi-buildings" aria-hidden="true" /></span>
              <span><strong>For institutions</strong><small>LMS setup &amp; platform enquiries</small></span>
            </div>
            <div className="lms-contact-panel-item">
              <span className="lms-contact-panel-icon"><i className="bi bi-mortarboard" aria-hidden="true" /></span>
              <span><strong>For families</strong><small>Tutoring, grade &amp; subject guidance</small></span>
            </div>
            <div className="lms-contact-panel-item">
              <span className="lms-contact-panel-icon"><i className="bi bi-person-check" aria-hidden="true" /></span>
              <span><strong>For educators</strong><small>Online teaching opportunities</small></span>
            </div>
            <a href="#send-enquiry" className="lms-contact-panel-link">Tell us about your needs <i className="bi bi-arrow-up-right" aria-hidden="true" /></a>
          </aside>
        </div>
      </section>

      <section className="lms-contact-section lms-contact-detail-section" id="contact-details" aria-labelledby="reach-us-title">
        <div className="lms-landing-container">
          <div className="lms-contact-section-intro">
            <span className="lms-landing-eyebrow">DIRECT CONTACT</span>
            <h2 id="reach-us-title">Reach us in Canada or India</h2>
            <p>Prefer to connect directly? Choose the contact details that work best for you. You can also use the enquiry form below.</p>
          </div>
          <div className="lms-contact-offices">
            <address className="lms-contact-office">
              <div className="lms-contact-office-heading">
                <span className="lms-contact-office-icon"><i className="bi bi-geo-alt" aria-hidden="true" /></span>
                <div><span>CANADA CONTACT</span><h3>Surrey, British Columbia</h3></div>
              </div>
              <div className="lms-contact-office-row">
                <i className="bi bi-telephone" aria-hidden="true" />
                <div><span>Phone</span><a href={publicContact.phoneHref}>{publicContact.phoneDisplay}</a></div>
              </div>
              <div className="lms-contact-office-row">
                <i className="bi bi-envelope" aria-hidden="true" />
                <div><span>Email</span><a href={publicContact.emailHref}>{publicContact.email}</a></div>
              </div>
              <div className="lms-contact-office-row">
                <i className="bi bi-pin-map" aria-hidden="true" />
                <div><span>Address</span><p>{publicContact.address}</p></div>
              </div>
            </address>
            <address className="lms-contact-office">
              <div className="lms-contact-office-heading">
                <span className="lms-contact-office-icon is-india"><i className="bi bi-geo-alt" aria-hidden="true" /></span>
                <div><span>INDIA CONTACT</span><h3>Loni, Ghaziabad</h3></div>
              </div>
              <div className="lms-contact-office-row">
                <i className="bi bi-telephone" aria-hidden="true" />
                <div><span>Phone</span><a href={publicContact.india.phoneHref}>{publicContact.india.phoneDisplay}</a></div>
              </div>
              <div className="lms-contact-office-row">
                <i className="bi bi-envelope" aria-hidden="true" />
                <div><span>Email</span><a href={publicContact.india.emailHref}>{publicContact.india.email}</a></div>
              </div>
              <div className="lms-contact-office-row">
                <i className="bi bi-pin-map" aria-hidden="true" />
                <div><span>Address</span><p>{publicContact.india.address}</p></div>
              </div>
            </address>
          </div>
        </div>
      </section>

      <section className="lms-contact-section lms-contact-services" aria-labelledby="contact-topics-title">
        <div className="lms-landing-container">
          <div className="lms-contact-section-intro">
            <span className="lms-landing-eyebrow">WHAT CAN WE HELP WITH?</span>
            <h2 id="contact-topics-title">Explore the right service</h2>
            <p>Find the information you need before reaching out, or send us an enquiry and we'll guide you to the right next step.</p>
          </div>
          <div className="lms-contact-topic-grid">
            {enquiryTopics.map(topic => (
              <article className="lms-contact-topic" key={topic.title}>
                <span className="lms-contact-topic-icon"><i className={"bi " + topic.icon} aria-hidden="true" /></span>
                <h3>{topic.title}</h3>
                <p>{topic.description}</p>
                <Link href={topic.href}>{topic.action} <i className="bi bi-arrow-up-right" aria-hidden="true" /></Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lms-contact-section lms-contact-enquiry-section" id="send-enquiry" aria-labelledby="enquiry-title">
        <div className="lms-landing-container lms-contact-enquiry-grid">
          <div className="lms-contact-enquiry-copy">
            <span className="lms-landing-eyebrow">GET IN TOUCH</span>
            <h2 id="enquiry-title">Tell us what you're looking for.</h2>
            <p>Use this form for questions about MySLS institution software or online tutoring. Share a little about your requirements so our team can respond.</p>
            <div className="lms-contact-steps">
              <div><span>01</span><div><strong>Tell us about your enquiry</strong><p>Select your region and the service you're interested in.</p></div></div>
              <div><span>02</span><div><strong>Share the key details</strong><p>For tutoring, include the learner's grade and subjects. For institutions, tell us what you need to manage.</p></div></div>
              <div><span>03</span><div><strong>We'll follow up</strong><p>Our team will review your message and respond using the contact information you provide.</p></div></div>
            </div>
            <p className="lms-contact-privacy"><i className="bi bi-shield-check" aria-hidden="true" /> Please don't include passwords, account IDs, medical details or private student records in your message.</p>
          </div>
          <ContactInquiryForm />
        </div>
      </section>

      <section className="lms-contact-section lms-contact-faq-section" aria-labelledby="contact-faq-title">
        <div className="lms-landing-container lms-contact-faq-grid">
          <div className="lms-contact-section-intro">
            <span className="lms-landing-eyebrow">HELPFUL INFORMATION</span>
            <h2 id="contact-faq-title">Frequently asked questions</h2>
            <p>Quick answers and useful links to help you get started.</p>
            <Link href="/services/online-tutoring#book-demo" className="lms-contact-text-link">Book a tutoring demo <i className="bi bi-arrow-right" aria-hidden="true" /></Link>
          </div>
          <div className="lms-contact-faq-list">
            {questions.map(item => (
              <details key={item.question}>
                <summary>{item.question}<i className="bi bi-plus-lg" aria-hidden="true" /></summary>
                <p>{item.answer}</p>
                <Link href={item.href}>{item.link} <i className="bi bi-arrow-up-right" aria-hidden="true" /></Link>
              </details>
            ))}
            <details>
              <summary>Can I apply to teach with MySLS?<i className="bi bi-plus-lg" aria-hidden="true" /></summary>
              <p>Yes. You can learn about the tutor application process and send your qualifications, subject experience and teaching interests through the dedicated Tutor Hiring page.</p>
              <Link href="/tutor-hiring">Visit Tutor Hiring <i className="bi bi-arrow-up-right" aria-hidden="true" /></Link>
            </details>
          </div>
        </div>
      </section>
      <MarketingFooter />
    </main>
  );
}
