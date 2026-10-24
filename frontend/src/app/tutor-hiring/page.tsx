import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import TutorApplicationForm from "@/components/TutorApplicationForm";
import { MarketingHeader, MarketingFooter } from "@/components/MarketingHeader";

import "../home.css";
import "../home-updates.css";
import "./tutor-hiring.css";
import "../marketing-typography.css";

export const metadata: Metadata = {
  title: "Become an Online Tutor | Tutor Applications",
  description:
    "Apply to teach online with ShabddLearningSolution (MySLS). Share your qualifications, subject expertise and experience for consideration for online tutoring opportunities.",
  keywords: ["online tutor hiring", "apply to become a tutor", "online tutoring opportunities", "teaching application", "MySLS"],
  openGraph: {
    title: "Become an Online Tutor | MySLS",
    description: "Interested in teaching online? Apply to join the ShabddLearningSolution tutor community.",
  },
};

const highlights = [
  {
    icon: "bi-book-half",
    heading: "Share what you know",
    text: "Tell us about the subjects, learning levels and teaching strengths you're passionate about.",
  },
  {
    icon: "bi-people-fill",
    heading: "Put learners first",
    text: "Help students build understanding through clear explanations, patience and encouragement.",
  },
  {
    icon: "bi-stars",
    heading: "Make your experience count",
    text: "Showcase your education, classroom experience and individual teaching approach.",
  },
];

const qualities = [
  {
    icon: "bi-mortarboard",
    title: "Strong subject knowledge",
    description: "A solid understanding of the topics and academic levels you're interested in teaching.",
  },
  {
    icon: "bi-chat-dots",
    title: "Clear communication",
    description: "The ability to explain concepts in an approachable, student-friendly way.",
  },
  {
    icon: "bi-heart",
    title: "A student-first approach",
    description: "Patience, encouragement and willingness to adapt to different learners.",
  },
  {
    icon: "bi-calendar2-check",
    title: "Professional commitment",
    description: "A thoughtful, dependable approach to lesson preparation and communication.",
  },
];

const subjects = [
  "Mathematics",
  "Science",
  "English",
  "Computer Science",
  "Digital Skills",
  "Other subjects",
];

const steps = [
  {
    number: "01",
    title: "Tell us about yourself",
    description:
      "Complete the tutor application with your subject expertise, qualifications and contact details.",
  },
  {
    number: "02",
    title: "We review your interest",
    description:
      "The team can assess your information and compare it with relevant teaching requirements.",
  },
  {
    number: "03",
    title: "We'll reach out if there's a match",
    description:
      "If a suitable opportunity is available, the team may contact you to discuss the next steps.",
  },
];

const questions = [
  {
    question: "How do I apply to become a tutor?",
    answer:
      "Complete the online tutor application with your contact details, subjects, qualifications, experience and a short introduction. Our recruitment team will review your information.",
  },
  {
    question: "Do I need previous teaching experience?",
    answer:
      "You can describe your current experience level, including 0–1 years, in the application. Suitability for any teaching opportunity is assessed according to its requirements; submitting the form does not guarantee acceptance.",
  },
  {
    question: "Which subjects can I apply to teach?",
    answer:
      "You can apply for subjects you are qualified to teach, such as Mathematics, Science, English or Computer Science. Please include the student levels you prefer in your application.",
  },
  {
    question: "Will submitting this form create my Teacher Portal account?",
    answer:
      "No. The tutor interest form is separate from the Teacher Portal. Your institution manages Teacher Portal accounts, assignments and access permissions.",
  },
  {
    question: "When will I hear back?",
    answer:
      "Our team reviews submitted applications and contacts candidates whose skills match current teaching requirements. Response times depend on available opportunities.",
  },
];

function Icon({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <i
      className={"bi " + name}
      aria-hidden="true"
      style={{ fontSize: size, lineHeight: 1 }}
    />
  );
}

export default function TutorHiringPage() {
  return (
    <main className="lms-landing lms-hiring" id="top">
      <MarketingHeader />

      <section className="lms-hiring-hero" aria-labelledby="hiring-title">
        <div className="lms-landing-container lms-hiring-hero-grid">
          <div className="lms-hiring-hero-text">
            <span className="lms-hiring-pill">
              <Icon name="bi-stars" size={16} /> TUTOR OPPORTUNITIES AT MYSLS
            </span>
            <h1 id="hiring-title">
              Become an online tutor.
              <span> Help students succeed.</span>
            </h1>
            <p className="lms-hiring-hero-lead">
              Apply to teach online with ShabddLearningSolution (MySLS).
              Share your qualifications, subject expertise and experience
              to be considered for one-to-one and group tutoring opportunities.
            </p>
            <div className="lms-hiring-hero-actions">
              <a href="#apply" className="lms-landing-button">
                Apply to Become a Tutor <Icon name="bi-arrow-right" size={17} />
              </a>
              <a href="#how-it-works" className="lms-landing-button lms-landing-button-outline">
                How It Works <Icon name="bi-arrow-down" size={16} />
              </a>
            </div>
            <div className="lms-hiring-trust">
              <span><Icon name="bi-check-circle-fill" size={16} /> Share your expertise</span>
              <span><Icon name="bi-check-circle-fill" size={16} /> Simple application</span>
              <span><Icon name="bi-check-circle-fill" size={16} /> Reviewed for suitable opportunities</span>
            </div>
          </div>

          <div className="lms-hiring-hero-art">
            <div className="lms-hiring-hero-image">
              <Image
                src="/student-lms-hero.webp"
                alt="Learning environment with books and a laptop"
                fill
                priority
                sizes="(max-width: 860px) 90vw, 45vw"
              />
            </div>
            <div className="lms-hiring-float lms-hiring-float-top">
              <span className="lms-hiring-float-icon">
                <Icon name="bi-mortarboard-fill" size={19} />
              </span>
              <span>Great teaching starts here</span>
            </div>
            <div className="lms-hiring-float lms-hiring-float-bottom">
              <span className="lms-hiring-float-icon is-green">
                <Icon name="bi-check2" size={22} />
              </span>
              <span>Grow through learning</span>
            </div>
          </div>
        </div>
      </section>

      <section className="lms-hiring-section" id="why-teach" aria-labelledby="hiring-why-heading">
        <div className="lms-landing-container">
          <div className="lms-hiring-heading is-centered">
            <span className="lms-landing-eyebrow">YOUR KNOWLEDGE CAN MAKE A DIFFERENCE</span>
            <h2 id="hiring-why-heading">Why share your teaching passion with us?</h2>
            <p>
              We&apos;re interested in hearing from educators who want to support
              students and bring their strengths to meaningful learning experiences.
            </p>
          </div>
          <div className="lms-hiring-feature-grid">
            {highlights.map((item) => (
              <article key={item.heading} className="lms-hiring-feature">
                <span className="lms-hiring-feature-icon"><Icon name={item.icon} size={27} /></span>
                <h3>{item.heading}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lms-hiring-section is-soft" id="requirements" aria-labelledby="hiring-requirements-heading">
        <div className="lms-landing-container lms-hiring-requirements">
          <div className="lms-hiring-requirements-copy">
            <div className="lms-hiring-heading">
              <span className="lms-landing-eyebrow">THE PEOPLE BEHIND GREAT LESSONS</span>
              <h2 id="hiring-requirements-heading">What makes a thoughtful tutor?</h2>
              <p>
                Different students learn differently. We value educators who
                combine subject confidence with a supportive way of teaching.
              </p>
            </div>
            <div className="lms-hiring-subjects">
              <strong>Example areas of interest</strong>
              <div className="lms-hiring-chip-list">
                {subjects.map((subject) => <span key={subject}>{subject}</span>)}
              </div>
              <small>Teaching opportunities depend on subject demand and available positions.</small>
            </div>
            <a href="#apply" className="lms-hiring-text-link">
              Share your teaching background <Icon name="bi-arrow-right" size={16} />
            </a>
          </div>
          <div className="lms-hiring-quality-grid">
            {qualities.map((item) => (
              <article className="lms-hiring-quality" key={item.title}>
                <span><Icon name={item.icon} size={23} /></span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lms-hiring-section" id="how-it-works" aria-labelledby="hiring-steps-heading">
        <div className="lms-landing-container">
          <div className="lms-hiring-heading is-centered">
            <span className="lms-landing-eyebrow">A STRAIGHTFORWARD APPLICATION</span>
            <h2 id="hiring-steps-heading">How the application process works</h2>
            <p>Send your online tutor application, share your teaching experience and let our team review your profile.</p>
          </div>
          <div className="lms-hiring-steps">
            {steps.map((step) => (
              <article className="lms-hiring-step" key={step.number}>
                <span className="lms-hiring-step-number">{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lms-hiring-section is-soft lms-hiring-apply-section" id="apply" aria-labelledby="hiring-apply-heading">
        <div className="lms-landing-container lms-hiring-apply-grid">
          <div className="lms-hiring-apply-copy">
            <span className="lms-landing-eyebrow">YOUR NEXT STEP</span>
            <h2 id="hiring-apply-heading">Apply to teach online with MySLS</h2>
            <p>
              Tell us about your background and the subjects you enjoy teaching.
              Our team can review your application and contact you if a suitable
              opportunity becomes available.
            </p>
            <div className="lms-hiring-apply-checks">
              <span><Icon name="bi-check-circle-fill" size={18} /> Your teaching subjects and levels</span>
              <span><Icon name="bi-check-circle-fill" size={18} /> Your qualifications and experience</span>
              <span><Icon name="bi-check-circle-fill" size={18} /> A short introduction and optional portfolio</span>
            </div>
            <div className="lms-hiring-note">
              <Icon name="bi-info-circle" size={19} />
              <p>
                <strong>Application information:</strong> This form expresses your interest
                in tutoring; it does not create a Teacher Portal account or
                guarantee employment. Avoid sending government IDs or sensitive
                personal documents.
              </p>
            </div>
            <div className="lms-hiring-teacher-login">
              Already teaching with an institution?
              <Link href="/teacher/login">Teacher Portal Login <Icon name="bi-arrow-up-right" size={14} /></Link>
            </div>
          </div>
          <TutorApplicationForm />
        </div>
      </section>

      <section className="lms-hiring-section" id="faq" aria-labelledby="hiring-faq-heading">
        <div className="lms-landing-container lms-hiring-faq-grid">
          <div className="lms-hiring-heading">
            <span className="lms-landing-eyebrow">FREQUENTLY ASKED QUESTIONS</span>
            <h2 id="hiring-faq-heading">Have questions about applying?</h2>
            <p>Learn what to include in your application and how our tutor recruitment process works.</p>
            <a href="#apply" className="lms-hiring-text-link">
              Go to application form <Icon name="bi-arrow-right" size={16} />
            </a>
          </div>
          <div className="lms-hiring-faq-list">
            {questions.map((item) => (
              <details key={item.question}>
                <summary>
                  {item.question}
                  <span aria-hidden="true"><Icon name="bi-plus-lg" size={15} /></span>
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="lms-hiring-bottom">
        <div className="lms-landing-container lms-hiring-bottom-content">
          <div>
            <span className="lms-hiring-bottom-label">TEACH WITH PURPOSE</span>
            <h2>Your next teaching opportunity could start with a conversation.</h2>
            <p>Share your interest and help us understand the educator you are.</p>
          </div>
          <a href="#apply" className="lms-landing-button">
            Submit Your Interest <Icon name="bi-arrow-right" size={17} />
          </a>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
