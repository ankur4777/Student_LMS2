import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MarketingHeader, MarketingFooter } from "@/components/MarketingHeader";

import "../../home.css";
import "../../home-updates.css";
import "../services.css";

export const metadata: Metadata = {
  title: "Online Tutoring for Grades 7–12",
  description:
    "Explore one-to-one online tutoring and group tuition for Grades 7–12 with ShabddLearningSolution (MySLS). Homework help, assignment guidance and science and maths support.",
  keywords: ["online tutoring for students", "one-to-one tutoring", "group online tuition", "homework help", "assignment help", "Grades 7–12", "MySLS"],
  openGraph: {
    title: "One-to-One & Group Online Tutoring | MySLS",
    description: "Online classes, homework guidance and assignment support for school students in Grades 7–12.",
  },
};

const tutoringFormats = [
  {
    icon: "person-video3",
    kind: "ONE-TO-ONE",
    heading: "One-to-one online tutoring",
    description:
      "Dedicated teaching time for a learner who wants focused explanations, help with tricky concepts or support with everyday schoolwork.",
    points: [
      "Individual attention and space to ask questions",
      "Topic-focused explanations and practice",
      "Homework, tuition and assignment support",
    ],
    accent: "coral",
  },
  {
    icon: "people-fill",
    kind: "GROUP CLASSES",
    heading: "Learn together in a group",
    description:
      "Online learning with other students in a group format, where learners can explore concepts, discuss questions and build understanding.",
    points: [
      "Interactive learning alongside other students",
      "Subject explanations and guided practice",
      "A group option for school tuition and study help",
    ],
    accent: "blue",
  },
];

const helpAreas = [
  {
    icon: "book-half",
    title: "Tuition classes",
    detail: "Build confidence with guided support for the topics learners cover at school.",
  },
  {
    icon: "journal-check",
    title: "Homework help",
    detail: "Work through homework questions with explanations that focus on understanding.",
  },
  {
    icon: "pencil-square",
    title: "Assignment help",
    detail: "Get guidance on concepts, planning and problem-solving while completing your own work.",
  },
  {
    icon: "calculator",
    title: "Subject support",
    detail: "Ask about Mathematics, Science and the relevant topics for your grade.",
  },
];

const faqs = [
  {
    question: "Do you offer both one-to-one and group classes?",
    answer:
      "Yes. Tell us your preferred format in the enquiry form. Our team can discuss suitable options and availability for the learner's grade and subject.",
  },
  {
    question: "Which grades are covered?",
    answer:
      "The tutoring options described here include Grades 7–10 and Grades 11–12. For Grades 11–12, the listed one-to-one subjects are Physics, Chemistry, Mathematics and Biology. Ask about other grades or subjects before booking.",
  },
  {
    question: "Can I get help with homework or assignments?",
    answer:
      "Yes. We offer homework help, tuition classes and assignment guidance. Tutors help learners understand methods and concepts; students are expected to complete their own academic work.",
  },
  {
    question: "Is tutoring available for Canada and Australia?",
    answer:
      "You can enquire about tutoring from Canada or Australia. Class scheduling and availability are confirmed by the team before starting.",
  },
  {
    question: "How can I find the current hourly fee?",
    answer:
      "Hourly tuition depends on the grade, class format and applicable offers. Please contact the team for a confirmed rate and eligibility before booking.",
  },
];

export default function OnlineTutoringPage() {
  return (
    <main className="lms-landing lms-service-page" id="top">
      <MarketingHeader />

      <section className="lms-service-hero lms-service-tutor-hero">
        <div className="lms-landing-container lms-service-hero-grid">
          <div className="lms-service-hero-content">
            <span className="lms-service-kicker"><i className="bi bi-camera-video" aria-hidden="true"/> ONLINE TUTORING</span>
            <h1>One-to-one online tutoring <span>and interactive group classes.</span></h1>
            <p>ShabddLearningSolution (MySLS) provides online tuition for students in Grades 7–12, with individual lessons, group classes, homework help and assignment guidance in Mathematics and Science subjects.</p>
            <div className="lms-service-actions">
              <Link className="lms-landing-button" href="/#contact">
                Enquire about online classes <i className="bi bi-arrow-right" aria-hidden="true" />
              </Link>
              <a href="#class-formats" className="lms-landing-button lms-landing-button-outline">
                Explore class formats <i className="bi bi-arrow-down" aria-hidden="true" />
              </a>
            </div>
            <div className="lms-service-highlights">
              <span><i className="bi bi-check-circle-fill" aria-hidden="true" /> One-to-one &amp; group learning</span>
              <span><i className="bi bi-check-circle-fill" aria-hidden="true" /> Homework &amp; tuition support</span>
              <span><i className="bi bi-check-circle-fill" aria-hidden="true" /> Grade-based subject guidance</span>
            </div>
          </div>
          <div className="lms-service-image-wrap">
            <div className="lms-service-hero-image">
              <Image
                src="/student-lms-hero.webp"
                alt="Student using a laptop and learning resources"
                fill priority sizes="(max-width: 850px) 100vw, 43vw"
              />
            </div>
            <div className="lms-service-float lms-service-float-top">
              <i className="bi bi-mortarboard-fill" aria-hidden="true" />
              Learning support for your goals
            </div>
            <div className="lms-service-float lms-service-float-bottom">
              <i className="bi bi-check-circle-fill" aria-hidden="true" />
              Choose how you learn
            </div>
          </div>
        </div>
      </section>

      <section className="lms-landing-section lms-service-white" id="class-formats">
        <div className="lms-landing-container">
          <div className="lms-landing-section-heading is-centered">
            <span className="lms-landing-eyebrow">CHOOSE YOUR CLASS FORMAT</span>
            <h2>Choose one-to-one tutoring or group tuition</h2>
            <p>Build subject confidence through individual attention or learn alongside other students in a structured online group class.</p>
          </div>
          <div className="lms-service-two-col">
            {tutoringFormats.map((item) => (
              <article className="lms-service-format-card" key={item.kind}>
                <div className={"lms-service-format-icon is-" + item.accent}>
                  <i className={"bi bi-" + item.icon} aria-hidden="true" />
                </div>
                <span className="lms-service-card-eyebrow">{item.kind}</span>
                <h3>{item.heading}</h3>
                <p>{item.description}</p>
                <ul className="lms-service-checks">
                  {item.points.map(point => (
                    <li key={point}><i className="bi bi-check-circle" aria-hidden="true" />{point}</li>
                  ))}
                </ul>
                <Link href="/#contact" className="lms-landing-inline-link">
                  Enquire about {item.kind === "ONE-TO-ONE" ? "one-to-one" : "group"} classes
                  <i className="bi bi-arrow-right" aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lms-landing-section lms-service-tint" id="study-support">
        <div className="lms-landing-container">
          <div className="lms-landing-section-heading is-centered">
            <span className="lms-landing-eyebrow">WHAT WE HELP WITH</span>
            <h2>Online tuition, homework help and assignment guidance</h2>
            <p>Get additional explanations, guided practice and subject support for schoolwork and exam preparation.</p>
          </div>
          <div className="lms-service-feature-grid">
            {helpAreas.map((area) => (
              <article key={area.title} className="lms-service-feature-card">
                <span className="lms-service-feature-icon"><i className={"bi bi-" + area.icon} aria-hidden="true" /></span>
                <h3>{area.title}</h3>
                <p>{area.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lms-landing-section lms-service-white" id="grades-and-subjects">
        <div className="lms-landing-container lms-service-split">
          <div className="lms-service-copy">
            <span className="lms-landing-eyebrow">GRADES &amp; SUBJECTS</span>
            <h2>Academic support for the topics that matter.</h2>
            <p>Let us know the learner's grade, subject and areas where they need help. We'll discuss which class format is suitable.</p>
            <div className="lms-service-grade-list">
              <article>
                <span>01</span>
                <div><h3>Grades 7–10</h3><p>One-to-one and group tuition, homework help and assignment guidance for school learning.</p></div>
              </article>
              <article>
                <span>02</span>
                <div>
                  <h3>Grades 11–12</h3>
                  <p>One-to-one tutoring in Physics, Chemistry, Mathematics and Biology. Ask us about group class availability.</p>
                </div>
              </article>
            </div>
            <div className="lms-service-actions">
              <Link className="lms-landing-button" href="/#contact">
                Ask about your subject <i className="bi bi-arrow-right" aria-hidden="true" />
              </Link>
              <Link className="lms-landing-button lms-landing-button-outline" href="/fee-structure">
                View Fee Structure <i className="bi bi-arrow-right" aria-hidden="true" />
              </Link>
            </div>
          </div>
          <div className="lms-service-subject-panel">
            <span className="lms-service-card-eyebrow">GRADES 11–12 · SUBJECT EXAMPLES</span>
            <div className="lms-service-subject-list">
              <span><i className="bi bi-lightning-charge-fill" aria-hidden="true" /> Physics</span>
              <span><i className="bi bi-droplet-half" aria-hidden="true" /> Chemistry</span>
              <span><i className="bi bi-calculator" aria-hidden="true" /> Mathematics</span>
              <span><i className="bi bi-heart-pulse-fill" aria-hidden="true" /> Biology</span>
            </div>
            <div className="lms-service-small-note">
              <i className="bi bi-info-circle" aria-hidden="true" />
              Ask our team about available tutors, class times and subjects for your grade.
            </div>
          </div>
        </div>
      </section>

      <section className="lms-landing-section lms-service-tint" id="how-tutoring-works">
        <div className="lms-landing-container">
          <div className="lms-landing-section-heading is-centered">
            <span className="lms-landing-eyebrow">HOW TO GET STARTED</span>
            <h2>From your question to your next lesson.</h2>
            <p>Start with a short enquiry so we can understand the learner's needs.</p>
          </div>
          <div className="lms-service-step-grid">
            <article><span className="lms-service-step-num">01</span><h3>Tell us your needs</h3><p>Share your grade, subjects and what you want to work on.</p></article>
            <article><span className="lms-service-step-num">02</span><h3>Choose a format</h3><p>Discuss one-to-one or group tutoring, timing and applicable terms.</p></article>
            <article><span className="lms-service-step-num">03</span><h3>Begin learning</h3><p>Once availability is confirmed, follow the agreed session schedule.</p></article>
          </div>
        </div>
      </section>

      <section className="lms-landing-section lms-service-white" id="tutoring-faq">
        <div className="lms-landing-container lms-service-faq-layout">
          <div>
            <span className="lms-landing-eyebrow">QUESTIONS &amp; ANSWERS</span>
            <h2>Have a question about online tutoring?</h2>
            <p>Here are the basics. Our team can discuss class options and confirmed rates directly with you.</p>
            <Link className="lms-landing-inline-link" href="/#contact">Send an enquiry <i className="bi bi-arrow-right" aria-hidden="true" /></Link>
          </div>
          <div className="lms-landing-faq-list">
            {faqs.map(item => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="lms-landing-container lms-service-cta">
        <div>
          <span className="lms-landing-eyebrow">LET'S TALK ABOUT LEARNING</span>
          <h2>Ready to explore online tuition with MySLS?</h2>
          <p>Contact our Surrey-based team about one-to-one sessions, group classes, subjects and tutoring options for Canada or Australia.</p>
        </div>
        <Link className="lms-landing-button" href="/#contact">
          Contact our team <i className="bi bi-arrow-right" aria-hidden="true" />
        </Link>
      </section>
      <MarketingFooter />
    </main>
  );
}
