import type { Metadata } from "next";
import Image from "next/image";
import {
  CTA, FAQ, FeatureCards, PublicSite, SectionHeading,
  SiteButton, SiteHero,
} from "@/components/public-site/PublicSite";

export const metadata: Metadata = {
  title: "Online Learning & Classes | Student LMS",
  description:
    "Join live lessons, access available recorded classes, read study materials and prepare with Subject AI Tutor in Student LMS.",
};

const learningOptions = [
  {
    icon: "◉",
    title: "Live classes",
    description: "Stay on top of scheduled classes, class dates and joining details through your Student LMS dashboard.",
  },
  {
    icon: "▶",
    title: "Recorded lessons",
    description: "Catch up with available class recordings and permitted recorded courses at your own pace.",
  },
  {
    icon: "✦",
    title: "Subject AI Tutor",
    description: "Ask questions about an enrolled subject and reference authorized PDF excerpts shared by your teacher.",
  },
  {
    icon: "▤",
    title: "Learning documents",
    description: "Review notes and study resources your teacher has published for your class and subject.",
  },
  {
    icon: "☑",
    title: "Assignments & exams",
    description: "Practice what you've learned, complete academic tasks and see published exam outcomes.",
  },
  {
    icon: "◎",
    title: "Progress at a glance",
    description: "Stay informed with authorized attendance, results and academic updates in one workspace.",
  },
];

export default function OnlineLearningPage() {
  return (
    <PublicSite>
      <SiteHero
        eyebrow="Learn from wherever you are"
        title="Classroom learning,"
        highlight="made more flexible."
        description="Your class doesn't end when you close your notebook. Stay connected to live lessons, published materials and available recordings, with tools built around your academic day."
        image="/student-lms-hero.webp"
        imageAlt="Student learning with a laptop and educational materials"
        primaryHref="/student/login"
        primaryLabel="Student login"
        secondaryHref="/for-students"
        secondaryLabel="Explore student tools"
        note="Available features and recordings depend on your institution"
        variant="compact"
      />
      <section className="sl-section sl-section-white">
        <div className="sl-container">
          <SectionHeading
            eyebrow="Your digital learning toolkit"
            title="Learn, revisit, practice, repeat."
            description="Whether you're joining a live session or preparing for the next assessment, Student LMS helps keep your learning activities connected."
            center
          />
          <FeatureCards items={learningOptions} />
        </div>
      </section>
      <section className="sl-section sl-section-soft">
        <div className="sl-container sl-split">
          <div className="sl-media-frame">
            <Image src="/student-dashboard.webp" fill alt="Student LMS classroom and learning dashboard" sizes="(max-width:760px) 100vw,50vw" />
          </div>
          <div className="sl-split-copy">
            <span className="sl-label">One convenient routine</span>
            <h2>Your classroom, closer than you think.</h2>
            <p>Find the tools you need in the Student Portal without switching between unrelated services.</p>
            <ul className="sl-inline-list">
              <li><span aria-hidden="true">✓</span> Check your next scheduled lesson.</li>
              <li><span aria-hidden="true">✓</span> Access available past recordings.</li>
              <li><span aria-hidden="true">✓</span> Read teacher-published study resources.</li>
              <li><span aria-hidden="true">✓</span> Continue with assignments and assessments.</li>
            </ul>
            <SiteButton href="/student/login">Open Student Portal</SiteButton>
          </div>
        </div>
      </section>
      <section className="sl-section sl-section-white">
        <div className="sl-container">
          <SectionHeading
            eyebrow="A smooth way to get going"
            title="How online learning works."
            center
          />
          <div className="sl-step-grid">
            <article className="sl-step"><span className="sl-step-num">01</span><h3>Log into your portal</h3><p>Use the Student account provided by your college or institution.</p></article>
            <article className="sl-step"><span className="sl-step-num">02</span><h3>Open your learning tools</h3><p>View available classes, documents, recorded courses or exams for your enrollment.</p></article>
            <article className="sl-step"><span className="sl-step-num">03</span><h3>Pick up where you left off</h3><p>Continue learning at your pace and check for new teacher updates.</p></article>
          </div>
        </div>
      </section>
      <section className="sl-section sl-section-soft">
        <div className="sl-container sl-faq-layout">
          <SectionHeading
            eyebrow="Frequently asked"
            title="Questions about learning online?"
            description="Here's how access and learning materials work in Student LMS."
          />
          <FAQ items={[
            {
              question: "Can I watch a previous class?",
              answer: "You can access recorded classes when a recording is available and your account has the required permission or purchase access. Not every completed live class has a recording.",
            },
            {
              question: "Does the platform include live classes?",
              answer: "Yes. Students can see their permitted scheduled live classes and associated details through the Student Portal.",
            },
            {
              question: "Can I ask the AI Tutor about my study PDF?",
              answer: "When the Documents and AI Tutor features are enabled, and your teacher has published relevant materials for your enrolled subject, Subject Tutor can use selected PDF excerpts. It does not automatically have access to every document.",
            },
            {
              question: "Do I need a separate account for online learning?",
              answer: "No extra Student LMS account is needed for the existing student workspace. Your institution manages your login and available class features.",
            },
          ]} />
        </div>
      </section>
      <CTA
        title="Make the most of your next learning day."
        description="Sign in with your institution account to see the learning resources currently available to you."
        primaryHref="/student/login"
        primaryLabel="Open Student Portal"
        secondaryHref="/features"
        secondaryLabel="Browse all features"
      />
    </PublicSite>
  );
}
