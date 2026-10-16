import type { Metadata } from "next";
import Image from "next/image";
import {
  CTA, FeatureCards, PublicSite, SectionHeading,
  SiteButton, SiteHero,
} from "@/components/public-site/PublicSite";

export const metadata: Metadata = {
  title: "For Students | Student LMS",
  description:
    "Discover your Student LMS workspace for live classes, AI Tutor, assignments, study materials, online exams and academic updates.",
};

const benefits = [
  { icon: "▣", title: "Know what's next", description: "Keep your class schedule and upcoming academic activities easy to find." },
  { icon: "✦", title: "Ask your AI Tutor", description: "Get explanations within enrolled subjects, or ask My Dashboard about available LMS information." },
  { icon: "▤", title: "Find your notes", description: "Access the study documents and PDF materials your teachers publish for your class." },
  { icon: "☑", title: "Stay on top of work", description: "Review assignments, submit work and complete available online examinations." },
  { icon: "◎", title: "Understand your progress", description: "Look up authorized attendance, published results and relevant student updates." },
  { icon: "▶", title: "Keep learning", description: "Join scheduled lessons and access recordings or courses when available to you." },
];

export default function ForStudentsPage() {
  return (
    <PublicSite>
      <SiteHero
        eyebrow="Made around your learning day"
        title="Study with confidence."
        highlight="Grow at your pace."
        description="Your Student Portal brings together the work that matters: classes to attend, lessons to review, assignments to finish, and help when you need it."
        image="/student-lms-hero.webp"
        imageAlt="Student studying with a laptop"
        primaryHref="/student/login"
        primaryLabel="Go to Student Login"
        secondaryHref="/online-learning"
        secondaryLabel="See online learning"
        note="Your college manages account access and available subjects"
        variant="compact"
      />
      <section className="sl-section sl-section-white">
        <div className="sl-container">
          <SectionHeading
            eyebrow="All in your corner"
            title="Make room for more learning, less searching."
            description="From first class to final submission, your workspace keeps the essentials together."
            center
          />
          <FeatureCards items={benefits} />
        </div>
      </section>
      <section className="sl-section sl-section-soft">
        <div className="sl-container sl-split">
          <div className="sl-split-copy">
            <span className="sl-label">Preview your workspace</span>
            <h2>A dashboard that helps you see the bigger picture.</h2>
            <p>Check your learning activities and navigate to the modules your institution has enabled. The Student Portal is built to give you quick access to what comes next.</p>
            <ul className="sl-inline-list">
              <li><span aria-hidden="true">✓</span> A dedicated space for your enrolled subjects.</li>
              <li><span aria-hidden="true">✓</span> Class and learning-material updates.</li>
              <li><span aria-hidden="true">✓</span> Academic records where permitted.</li>
            </ul>
            <SiteButton href="/student/login">Open your dashboard</SiteButton>
          </div>
          <div className="sl-media-frame">
            <Image src="/student-dashboard.webp" alt="Student LMS Student Portal preview" fill sizes="(max-width:760px) 100vw,50vw" />
          </div>
        </div>
      </section>
      <section className="sl-section sl-section-white">
        <div className="sl-container">
          <SectionHeading eyebrow="Your learning journey" title="Getting started is simple." center />
          <div className="sl-step-grid">
            <div className="sl-step"><span className="sl-step-num">01</span><h3>Get your account</h3><p>Your institution creates or manages your student access and enrolled subjects.</p></div>
            <div className="sl-step"><span className="sl-step-num">02</span><h3>Find your lessons</h3><p>Sign in, open your dashboard and follow your schedule and available resources.</p></div>
            <div className="sl-step"><span className="sl-step-num">03</span><h3>Build your momentum</h3><p>Keep up with assignments, study help, assessments and published progress.</p></div>
          </div>
        </div>
      </section>
      <section className="sl-section sl-section-soft">
        <div className="sl-container">
          <div className="sl-note-box">
            <strong>New to Student LMS?</strong> Ask your college for your account credentials. If you already have an account but cannot sign in, use the Forgot Password option on the student login page.
          </div>
        </div>
      </section>
      <CTA
        title="Your next chapter is waiting."
        description="Sign in to your Student Portal and pick up right where your learning left off."
        primaryHref="/student/login"
        primaryLabel="Student Login"
        secondaryHref="/online-learning"
        secondaryLabel="Explore online learning"
      />
    </PublicSite>
  );
}
