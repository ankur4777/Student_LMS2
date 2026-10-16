import type { Metadata } from "next";
import Image from "next/image";
import {
  CTA, FeatureCards, PublicSite, SectionHeading,
  SiteButton, SiteHero,
} from "@/components/public-site/PublicSite";

export const metadata: Metadata = {
  title: "Learning Platform Features | Student LMS",
  description:
    "Discover academic features in Student LMS: AI Tutor, live and recorded lessons, study materials, online exams, attendance, fees and role-based college portals.",
};

const studentFeatures = [
  { icon: "✦", title: "Subject AI Tutor", description: "Ask learning questions within enrolled subjects and use available teacher-published PDF materials as part of your study support." },
  { icon: "▣", title: "Live classes", description: "Find scheduled class sessions and the relevant joining details from your student account." },
  { icon: "▶", title: "Recorded learning", description: "Return to recordings and courses when your college has made them available and you have the required access." },
  { icon: "☑", title: "Assignments", description: "See assigned work, follow deadlines and submit learning activities to teachers." },
  { icon: "◉", title: "Online assessments", description: "Take permitted online exams and review results once they have been published." },
  { icon: "▤", title: "Study documents", description: "Access resources published for your enrolled class and subject, with college-controlled visibility." },
];

const collegeFeatures = [
  { icon: "▦", title: "Class & section setup", description: "Organize academic sessions, classes, sections and student enrollments." },
  { icon: "✎", title: "Teacher workflows", description: "Manage subject assignments, shared documents, classes, attendance and assessments." },
  { icon: "◎", title: "Attendance & results", description: "Review academic tracking and published student performance in the appropriate portal." },
  { icon: "◫", title: "Fees & records", description: "Keep fee structures, assigned balances and payment verification in a connected workflow." },
  { icon: "✉", title: "Notices & notifications", description: "Communicate important college information to the appropriate audiences." },
  { icon: "◇", title: "Class-level feature access", description: "Control which available platform features can be used by students in different classes." },
];

export default function FeaturesPage() {
  return (
    <PublicSite>
      <SiteHero
        eyebrow="Explore the platform"
        title="Everything you need to"
        highlight="keep learning moving."
        description="Teaching, studying and administration feel more organized when daily tasks live in one connected platform. Explore the features already built into Student LMS."
        image="/student-dashboard.webp"
        imageAlt="Student LMS learning dashboard with academic activity"
        primaryHref="/get-started"
        primaryLabel="Access your portal"
        secondaryHref="/online-learning"
        secondaryLabel="Online learning"
        variant="compact"
      />
      <section className="sl-section sl-section-white">
        <div className="sl-container">
          <SectionHeading
            eyebrow="For everyday learning"
            title="Tools that help students make progress."
            description="From class schedules to subject-specific study support, keep learning tasks where they're easy to find."
          />
          <FeatureCards items={studentFeatures} />
        </div>
      </section>
      <section className="sl-section sl-section-soft">
        <div className="sl-container">
          <SectionHeading
            eyebrow="For the whole campus"
            title="A more connected way to manage academics."
            description="Student LMS supports the teams behind great learning—not just the lessons themselves."
          />
          <FeatureCards items={collegeFeatures} />
        </div>
      </section>
      <section className="sl-section sl-section-white">
        <div className="sl-container sl-split">
          <div className="sl-split-copy">
            <span className="sl-label">Smarter study support</span>
            <h2>Ask, understand, revisit and keep going.</h2>
            <p>
              The floating AI Tutor in the Student Portal offers subject-specific
              learning help and dashboard assistance. When enabled by your college,
              it can use relevant excerpts from published teacher PDFs without
              exposing other students' or classes' resources.
            </p>
            <p>AI-generated explanations can be imperfect; official college records and teacher instructions remain authoritative.</p>
            <div className="sl-actions">
              <SiteButton href="/for-students">See the student experience</SiteButton>
            </div>
          </div>
          <div className="sl-media-frame">
            <Image src="/student-dashboard.webp" alt="Student LMS student workspace preview" fill sizes="(max-width:760px) 100vw,50vw" />
          </div>
        </div>
      </section>
      <section className="sl-section sl-section-soft">
        <div className="sl-container">
          <div className="sl-note-box">
            <strong>Features follow your institution's settings.</strong> Actual access to AI Tutor, study materials, recorded classes, exams and other modules depends on your role, enrollment, assigned permissions and any applicable course access.
          </div>
        </div>
      </section>
      <CTA
        title="Your workday, your learning day, one platform."
        description="Choose your Student LMS portal or explore what online learning looks like inside your student account."
        primaryLabel="Get started"
        secondaryHref="/online-learning"
        secondaryLabel="See online learning"
      />
    </PublicSite>
  );
}
