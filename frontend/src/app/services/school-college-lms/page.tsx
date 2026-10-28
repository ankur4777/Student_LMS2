import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MarketingHeader, MarketingFooter } from "@/components/MarketingHeader";
import StudentAITutorShowcase from "@/components/StudentAITutorShowcase";

import "../../home.css";
import "../../home-updates.css";
import "../services.css";
import "../../ai-tutor-showcase.css";
import "../../marketing-typography.css";

export const metadata: Metadata = {
  title: "School & College Management LMS Software",
  description:
    "Discover ShabddLearningSolution (MySLS), learning management software for schools and colleges. Manage students, attendance, teachers, classes, online exams, fees and academic records.",
  keywords: ["school management software", "college management software", "learning management system", "attendance management", "online exams", "MySLS"],
  openGraph: {
    title: "School & College Management LMS Software | MySLS",
    description: "Bring teaching, attendance, student records, assessments, fee administration and parent communication together.",
  },
};

const modules = [
  {
    icon: "people-fill", title: "Students & enrollments",
    detail: "Keep student profiles, class sections and enrolled subjects organized in one system.",
  },
  {
    icon: "person-workspace", title: "Teachers & classes",
    detail: "Manage teaching assignments, class schedules and the learning activities teachers deliver.",
  },
  {
    icon: "calendar2-check", title: "Attendance tracking",
    detail: "Record and review attendance through the authorized teacher, student and administrative workflows.",
  },
  {
    icon: "clipboard-check", title: "Assignments & online exams",
    detail: "Support submissions, online assessments, evaluation and publication of eligible results.",
  },
  {
    icon: "credit-card-2-front", title: "Fee management",
    detail: "Track institution fee structures, student balances, payment proofs and verification records.",
  },
  {
    icon: "folder2-open", title: "Documents & notices",
    detail: "Share study materials and institutional updates with the right audience.",
  },
  {
    icon: "camera-video", title: "Live & recorded classes",
    detail: "Enable scheduled online lessons, recordings and permitted access to learning courses.",
  },
  {
    icon: "stars", title: "AI Tutor for Students",
    detail: "Help students learn through Subject Tutor, ask LMS questions with My Dashboard and resume saved chats when authorized.",
  },
];

const portals = [
  {
    icon: "buildings-fill",
    heading: "College Admin",
    copy: "Set up your academic structure, manage enrollment, teachers, fee workflows, features and relevant records.",
    href: "/college-admin/login",
    label: "College Admin Login",
    tint: "blue",
  },
  {
    icon: "person-workspace",
    heading: "Teacher",
    copy: "Support assigned classes with learning materials, lessons, attendance, assignments and assessments.",
    href: "/teacher/login",
    label: "Teacher Login",
    tint: "green",
  },
  {
    icon: "mortarboard-fill",
    heading: "Student",
    copy: "Join classes, access study materials, see academic progress and use the AI Tutor where your institution enables it.",
    href: "/student/login",
    label: "Student Login",
    tint: "purple",
  },
  {
    icon: "people-fill",
    heading: "Parent",
    copy: "Follow linked students' permitted attendance, fees, results, notifications and college information.",
    href: "/parent/login",
    label: "Parent Login",
    tint: "coral",
  },
];

const faqs = [
  {
    question: "Who can use MySLS?",
    answer:
      "ShabddLearningSolution (MySLS) helps schools and colleges manage academic work in one place. College administrators, teachers, students and parents use separate portals with role-based access.",
  },
  {
    question: "Can a school or college manage its own students and teachers?",
    answer:
      "Yes. Authorized administrators can manage the relevant academic structure, enrollment and staff workflows within their institution.",
  },
  {
    question: "Does the LMS include online teaching tools?",
    answer:
      "The platform supports scheduled live classes, available recordings, teacher-shared study resources, assignments and online examinations. Individual feature availability depends on institution settings and role-based access.",
  },
  {
    question: "How does AI Tutor work?",
    answer:
      "Students can ask subject questions, use available teacher-published study materials and check permitted dashboard information when their institution enables AI Tutor. Teachers and official academic records remain the primary source of truth.",
  },
  {
    question: "How can our institution get started?",
    answer:
      "Use the contact form to describe your school or college, its requirements and any questions about the product. Our team can discuss suitable next steps. This public page does not create a new institution automatically.",
  },
];

export default function SchoolCollegeLMSPage() {
  return (
    <main className="lms-landing lms-service-page" id="top">
      <MarketingHeader />

      <section className="lms-service-hero lms-service-college-hero">
        <div className="lms-landing-container lms-service-hero-grid">
          <div className="lms-service-hero-content">
            <span className="lms-service-kicker">
              <i className="bi bi-buildings" aria-hidden="true" /> LMS FOR SCHOOLS &amp; COLLEGES
            </span>
            <h1>School &amp; college management software <span>built for everyday education.</span></h1>
            <p>MySLS is a learning management system for schools and colleges. Manage student records, teachers, attendance, fees, classes, online exams and learning resources with secure role-based access.</p>
            <div className="lms-service-actions">
              <Link className="lms-landing-button" href="/contact-us">
                Enquire about MySLS <i className="bi bi-arrow-right" aria-hidden="true" />
              </Link>
              <a href="#lms-modules" className="lms-landing-button lms-landing-button-outline">
                Explore LMS features <i className="bi bi-arrow-down" aria-hidden="true" />
              </a>
            </div>
            <div className="lms-service-highlights">
              <span><i className="bi bi-check-circle-fill" aria-hidden="true" /> Institution management</span>
              <span><i className="bi bi-check-circle-fill" aria-hidden="true" /> Role-based portals</span>
              <span><i className="bi bi-check-circle-fill" aria-hidden="true" /> Connected academic activities</span>
            </div>
          </div>
          <div className="lms-service-image-wrap">
            <div className="lms-service-hero-image lms-service-dashboard-image">
              <Image
                src="/college-admin-dashboard.webp"
                alt="MySLS school and college administration dashboard showing academic management tools"
                fill priority sizes="(max-width: 850px) 100vw, 43vw"
              />
            </div>
            <div className="lms-service-float lms-service-float-top">
              <i className="bi bi-diagram-3-fill" aria-hidden="true" /> Connected academic records
            </div>
            <div className="lms-service-float lms-service-float-bottom">
              <i className="bi bi-shield-check" aria-hidden="true" /> Dedicated access by role
            </div>
          </div>
        </div>
      </section>

      <section className="lms-landing-section lms-service-white" id="lms-modules">
        <div className="lms-landing-container">
          <div className="lms-landing-section-heading is-centered">
            <span className="lms-landing-eyebrow">PLATFORM FEATURES</span>
            <h2>Academic management, all in one place.</h2>
            <p>Manage your school's or college's academic operations in one platform, from class scheduling and student attendance to exams, fee tracking and parent updates.</p>
          </div>
          <div className="lms-service-feature-grid">
            {modules.map(item => (
              <article key={item.title} className="lms-service-feature-card">
                <span className="lms-service-feature-icon">
                  <i className={"bi bi-" + item.icon} aria-hidden="true" />
                </span>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <StudentAITutorShowcase />

      <section className="lms-landing-section lms-service-tint" id="role-portals">
        <div className="lms-landing-container">
          <div className="lms-landing-section-heading is-centered">
            <span className="lms-landing-eyebrow">FOUR DEDICATED PORTALS</span>
            <h2>The right workspace for every role.</h2>
            <p>Administrators, educators, learners and families can access information relevant to their responsibilities.</p>
          </div>
          <div className="lms-service-portals">
            {portals.map(portal => (
              <article className="lms-service-portal-card" key={portal.href}>
                <div className={"lms-service-format-icon is-" + portal.tint}>
                  <i className={"bi bi-" + portal.icon} aria-hidden="true" />
                </div>
                <h3>{portal.heading}</h3>
                <p>{portal.copy}</p>
                <Link href={portal.href} className="lms-landing-inline-link">
                  {portal.label} <i className="bi bi-arrow-up-right" aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
          <p className="lms-service-muted-note">
            Accounts and class features are managed by each institution. The portal previews do not represent open self-registration.
          </p>
        </div>
      </section>

      <section className="lms-landing-section lms-service-white" id="connected-campus">
        <div className="lms-landing-container lms-service-split">
          <div className="lms-service-preview-frame">
            <div className="lms-service-preview-bar" aria-hidden="true"><i /><i /><i /> <span>MySLS</span></div>
            <div className="lms-service-preview-image">
              <Image
                src="/student-dashboard.webp"
                alt="MySLS student portal dashboard with learning and attendance features"
                fill sizes="(max-width: 850px) 100vw, 50vw"
              />
            </div>
          </div>
          <div className="lms-service-copy">
            <span className="lms-landing-eyebrow">BUILT FOR CONNECTED EDUCATION</span>
            <h2>Bring the classroom and campus together.</h2>
            <p>Instead of managing academic information across unrelated tools, an institution can use a consistent system for teaching tasks, academic updates, learning resources and administrative workflows.</p>
            <ul className="lms-service-checks">
              <li><i className="bi bi-check-circle" aria-hidden="true" /> Keep classes, sections and teacher assignments connected.</li>
              <li><i className="bi bi-check-circle" aria-hidden="true" /> Support online learning, teacher documents and assessments.</li>
              <li><i className="bi bi-check-circle" aria-hidden="true" /> Manage feature availability for different student classes.</li>
              <li><i className="bi bi-check-circle" aria-hidden="true" /> Help families see relevant updates through the Parent Portal.</li>
            </ul>
            <Link href="/contact-us" className="lms-landing-button">
              Discuss your institution's needs <i className="bi bi-arrow-right" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="lms-landing-section lms-service-tint" id="lms-process">
        <div className="lms-landing-container">
          <div className="lms-landing-section-heading is-centered">
            <span className="lms-landing-eyebrow">GET STARTED WITH OUR LMS</span>
            <h2>A practical path from enquiry to setup.</h2>
            <p>Tell us how your institution works and which parts of the platform you want to explore.</p>
          </div>
          <div className="lms-service-step-grid">
            <article>
              <span className="lms-service-step-num">01</span>
              <h3>Share your requirements</h3>
              <p>Tell us about your school or college and the academic activities you want to manage.</p>
            </article>
            <article>
              <span className="lms-service-step-num">02</span>
              <h3>Explore the platform</h3>
              <p>Discuss available modules, suitable configurations and how each portal supports your teams.</p>
            </article>
            <article>
              <span className="lms-service-step-num">03</span>
              <h3>Plan your onboarding</h3>
              <p>Agree on the next setup steps and the account access your institution needs.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="lms-landing-section lms-service-white" id="lms-faq">
        <div className="lms-landing-container lms-service-faq-layout">
          <div>
            <span className="lms-landing-eyebrow">COMMON QUESTIONS</span>
            <h2>Considering an LMS for your institution?</h2>
            <p>Learn how MySLS supports institutional workflows, teachers, students and families.</p>
            <Link href="/contact-us" className="lms-landing-inline-link">
              Ask our team <i className="bi bi-arrow-right" aria-hidden="true" />
            </Link>
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
          <span className="lms-landing-eyebrow">FOR SCHOOLS &amp; COLLEGES</span>
          <h2>Let's talk about how your campus works.</h2>
          <p>Tell us about your school or college, current challenges and the tools you need. Our team can discuss a suitable MySLS setup.</p>
        </div>
        <Link href="/contact-us" className="lms-landing-button">
          Enquire about the LMS <i className="bi bi-arrow-right" aria-hidden="true" />
        </Link>
      </section>
      <MarketingFooter />
    </main>
  );
}
