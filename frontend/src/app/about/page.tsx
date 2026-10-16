import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  CTA, PublicSite, SectionHeading, SiteButton, SiteHero,
} from "@/components/public-site/PublicSite";

export const metadata: Metadata = {
  title: "About Student LMS | Connected Education",
  description:
    "Learn how Student LMS connects teaching, learning and administration through dedicated student, teacher, college and parent portals.",
};

export default function AboutPage() {
  return (
    <PublicSite>
      <SiteHero
        eyebrow="Get to know us"
        title="A more human way to"
        highlight="connect learning."
        description="Education is made of many moving parts. Student LMS is designed to bring the important ones into a simpler, more organized experience for students, educators, families and academic teams."
        image="/student-lms-hero.webp"
        imageAlt="Student working with learning materials on a laptop"
        primaryHref="/features"
        primaryLabel="Explore the platform"
        secondaryHref="/get-started"
        secondaryLabel="Get started"
        variant="compact"
      />
      <section className="sl-section sl-section-white">
        <div className="sl-container sl-split">
          <div className="sl-split-copy">
            <span className="sl-label">The idea behind Student LMS</span>
            <h2>Help the everyday parts of education work better together.</h2>
            <p>Classes, learning materials, assignments, results and administrative records all matter. But when they live in separate places, following a student's journey becomes harder than it needs to be.</p>
            <p>Student LMS brings relevant academic activities into connected role-specific workspaces so each person can focus on their next step.</p>
            <div className="sl-actions">
              <SiteButton href="/online-learning">Explore online learning</SiteButton>
            </div>
          </div>
          <div className="sl-media-frame sl-media-photo">
            <Image src="/student-lms-hero.webp" alt="Student studying on a laptop" fill sizes="(max-width:760px) 100vw,50vw" />
          </div>
        </div>
      </section>
      <section className="sl-section sl-section-soft">
        <div className="sl-container">
          <SectionHeading
            eyebrow="What guides the experience"
            title="Built around learning, clarity and connection."
            center
          />
          <div className="sl-statements">
            <article className="sl-statement">
              <h3>Learning comes first</h3>
              <p>Keep useful tools near students and teachers, so more time goes to understanding and participating.</p>
            </article>
            <article className="sl-statement">
              <h3>Clarity matters</h3>
              <p>Make learning tasks, academic information and the next actions easier to find.</p>
            </article>
            <article className="sl-statement">
              <h3>Access should be thoughtful</h3>
              <p>Use role and class permissions to show people what they are authorized to work with.</p>
            </article>
          </div>
        </div>
      </section>
      <section className="sl-section sl-section-white">
        <div className="sl-container">
          <SectionHeading
            eyebrow="Who we serve"
            title="Different roles. Shared progress."
            description="Student LMS supports the people who make everyday academic life happen."
          />
          <div className="sl-highlight-grid">
            <article className="sl-highlight-card">
              <small>STUDENTS & TEACHERS</small>
              <h3>Better days for learning and teaching</h3>
              <p>Find relevant classes, learning materials, assignments and assessments from dedicated workspaces.</p>
              <Link className="sl-text-link" href="/for-students">Discover the student experience ↗</Link>
            </article>
            <article className="sl-highlight-card">
              <small>COLLEGES & FAMILIES</small>
              <h3>A clearer connection to academic life</h3>
              <p>Support academic administration and make permitted student updates easier to access.</p>
              <Link className="sl-text-link" href="/for-colleges">Explore college tools ↗</Link>
            </article>
          </div>
        </div>
      </section>
      <section className="sl-section sl-section-soft">
        <div className="sl-container sl-split">
          <div className="sl-media-frame">
            <Image src="/teacher-dashboard.webp" fill alt="Real Student LMS teacher dashboard preview" sizes="(max-width:760px) 100vw,50vw" />
          </div>
          <div className="sl-split-copy">
            <span className="sl-label">Designed with real tasks in mind</span>
            <h2>More than a page of promises.</h2>
            <p>Explore real Student LMS portal previews and the working modules behind them. Available capabilities depend on your institution and account permissions.</p>
            <p>Student LMS is a project by Shabdd Innovations.</p>
            <SiteButton href="/get-started">Find your portal</SiteButton>
          </div>
        </div>
      </section>
      <CTA
        title="Let's make learning feel more connected."
        description="Discover the tools available across Student LMS and choose the portal that matches your role."
        primaryLabel="Get started"
        secondaryHref="/features"
        secondaryLabel="See the features"
      />
    </PublicSite>
  );
}
