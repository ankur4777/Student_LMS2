import type { Metadata } from "next";
import Image from "next/image";
import {
  CTA, FeatureCards, PublicSite, SectionHeading,
  SiteButton, SiteHero,
} from "@/components/public-site/PublicSite";

export const metadata: Metadata = {
  title: "For Colleges & Institutions | Student LMS",
  description:
    "Bring enrollments, classes, staff workflows, attendance, fees and student learning together with Student LMS college administration tools.",
};

const advantages = [
  { icon: "▦", title: "Classes & enrollment", description: "Organize academic sessions, class sections and student enrollments in a structured college workspace." },
  { icon: "✎", title: "Teachers & assignments", description: "Connect educators to the classes and subjects they teach and the activities they manage." },
  { icon: "◎", title: "Attendance & results", description: "Review attendance records and published academic results through authorized portals." },
  { icon: "◫", title: "Fees & payments", description: "Track fee structures, student balances and relevant payment verification workflows." },
  { icon: "✉", title: "Communication", description: "Share college notices and notifications with the appropriate student, staff and parent audiences." },
  { icon: "◇", title: "Role-based access", description: "Control available class features and support appropriate access across student and staff portals." },
];

export default function ForCollegesPage() {
  return (
    <PublicSite>
      <SiteHero
        eyebrow="Built for connected campuses"
        title="Less admin work."
        highlight="More room for education."
        description="Give your teams a shared foundation for class management, teaching workflows and academic records. Student LMS helps keep the everyday details of college life organized."
        image="/college-admin-dashboard.webp"
        imageAlt="College Admin Portal preview showing real Student LMS dashboard"
        primaryHref="/college-admin/login"
        primaryLabel="College Admin Login"
        secondaryHref="/get-started"
        secondaryLabel="Explore portal access"
        note="Role-based access for campus teams, students and families"
        variant="compact"
      />
      <section className="sl-section sl-section-white">
        <div className="sl-container">
          <SectionHeading
            eyebrow="Campus essentials, connected"
            title="Stay organized across the academic journey."
            description="Student LMS gives college teams structured tools for student information, teaching activities and relevant administrative records."
            center
          />
          <FeatureCards items={advantages} />
        </div>
      </section>
      <section className="sl-section sl-section-soft">
        <div className="sl-container sl-split">
          <div className="sl-media-frame">
            <Image src="/college-admin-dashboard.webp" fill alt="Student LMS College Admin dashboard preview" sizes="(max-width:760px) 100vw,50vw" />
          </div>
          <div className="sl-split-copy">
            <span className="sl-label">A connected way to work</span>
            <h2>One academic picture, with the right access for every role.</h2>
            <p>College Admins can manage enrollment and feature availability, while Teachers, Students and Parents use their own dedicated portals.</p>
            <p>Keeping access aligned with each person's role helps the right people find the information they need without exposing unrelated college or student records.</p>
            <SiteButton href="/get-started">See all four portals</SiteButton>
          </div>
        </div>
      </section>
      <section className="sl-section sl-section-white">
        <div className="sl-container">
          <SectionHeading eyebrow="How Student LMS fits your campus" title="From setup to everyday progress." center />
          <div className="sl-step-grid">
            <article className="sl-step"><span className="sl-step-num">01</span><h3>Organize</h3><p>Set up academic structure, enrollment, teachers, classes and class-specific access.</p></article>
            <article className="sl-step"><span className="sl-step-num">02</span><h3>Teach & connect</h3><p>Enable relevant learning activities, documents, notifications and campus workflows.</p></article>
            <article className="sl-step"><span className="sl-step-num">03</span><h3>Review progress</h3><p>Use attendance, assessment, result and fee records to support better oversight.</p></article>
          </div>
        </div>
      </section>
      <section className="sl-section sl-section-soft">
        <div className="sl-container">
          <div className="sl-note-box">
            <strong>For college administrators:</strong> Access requires an account authorized for your institution. This public website does not create new colleges or provide an open self-registration flow.
          </div>
        </div>
      </section>
      <CTA
        title="Bring your campus onto the same page."
        description="Open your existing College Admin workspace or choose a different portal for your role."
        primaryHref="/college-admin/login"
        primaryLabel="College Admin Login"
        secondaryHref="/get-started"
        secondaryLabel="All portal logins"
      />
    </PublicSite>
  );
}
