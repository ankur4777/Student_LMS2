import Link from "next/link";
import ContactInquiryForm from "@/components/ContactInquiryForm";
import { publicContact } from "@/lib/publicContact";
import { MarketingHeader, MarketingFooter } from "@/components/MarketingHeader";
import StudentAITutorShowcase from "@/components/StudentAITutorShowcase";
import HomeHeroCarousel from "@/components/HomeHeroCarousel";

import "./home.css";
import "./home-updates.css";
import "./home-hero-carousel.css";
import "./ai-tutor-showcase.css";
import "./marketing-typography.css";

type HomeIcon =
  | "cap"
  | "admin"
  | "teacher"
  | "student"
  | "parent"
  | "calendar"
  | "video"
  | "play"
  | "file"
  | "notice"
  | "chart"
  | "wallet"
  | "shield"
  | "link"
  | "check"
  | "arrow"
  | "lock"
  | "book"
  | "sparkle";

type Portal = {
  name: string;
  description: string;
  href: string;
  icon: HomeIcon;
  accent: string;
  number: string;
  previewImage: string;
  previewAlt: string;
};

const portals: Portal[] = [
  {
    name: "College Admin",
    description: "Bring classes, student records, teacher assignments and fee administration together in one organized workspace.",
    href: "/college-admin/login",
    previewImage: "/college-admin-dashboard.webp",
    previewAlt: "Real College Admin dashboard showing attendance, fee collection, student totals and quick actions",
    icon: "admin",
    accent: "blue",
    number: "01",
  },
  {
    name: "Teacher Portal",
    description: "Plan learning activities, share class materials, create online exams and support student progress.",
    href: "/teacher/login",
    previewImage: "/teacher-dashboard.webp",
    previewAlt: "Real Teacher dashboard showing teaching assignments, today's classes and quick access",
    icon: "teacher",
    accent: "green",
    number: "02",
  },
  {
    name: "Student Portal",
    description: "Join classes, complete assignments, review results and get learning help from your AI Tutor when enabled.",
    href: "/student/login",
    previewImage: "/student-dashboard.webp",
    previewAlt: "Real Student dashboard showing live classes, attendance and recorded learning",
    icon: "student",
    accent: "purple",
    number: "03",
  },
  {
    name: "Parent Portal",
    description: "Follow your child’s academic journey, review fee information and stay informed about college updates.",
    href: "/parent/login",
    previewImage: "/parent-dashboard.webp",
    previewAlt: "Real Parent dashboard showing linked children, attendance, results and quick access",
    icon: "parent",
    accent: "orange",
    number: "04",
  },
];

const features: {
  icon: HomeIcon;
  title: string;
  description: string;
  accent: string;
}[] = [
  {
    icon: "calendar",
    title: "Attendance",
    description: "Record, organize and review attendance so everyday classroom tracking stays clear and consistent.",
    accent: "coral",
  },
  {
    icon: "video",
    title: "Live Classes",
    description: "Bring learning online with scheduled live sessions, convenient class access and timely updates.",
    accent: "blue",
  },
  {
    icon: "play",
    title: "Recorded Learning",
    description: "Make recorded lessons and courses available for flexible, self-paced learning with managed access.",
    accent: "orange",
  },
  {
    icon: "file",
    title: "Assignments & Exams",
    description: "Create academic work and online assessments, from objective questions to teacher-evaluated answers.",
    accent: "purple",
  },
  {
    icon: "sparkle",
    title: "AI Tutor for Students",
    description: "Learn with Subject Tutor, ask about permitted LMS dashboard information, and revisit saved chat history.",
    accent: "pink",
  },
  {
    icon: "wallet",
    title: "Fee Management",
    description: "Keep fee structures, student balances, payment proofs and verification records in one place.",
    accent: "green",
  },
  {
    icon: "notice",
    title: "Notices & Documents",
    description: "Share useful documents and notices so the right people can find important information quickly.",
    accent: "pink",
  },
];

// Bootstrap Icons v1.13.1 — shared, consistent icons across the public homepage.
const bootstrapIconNames: Record<HomeIcon, string> = {
  cap: "mortarboard-fill",
  admin: "buildings-fill",
  teacher: "person-workspace",
  student: "backpack2-fill",
  parent: "people-fill",
  calendar: "calendar2-check",
  video: "camera-video",
  play: "play-circle",
  file: "file-earmark-text",
  notice: "megaphone",
  chart: "graph-up-arrow",
  wallet: "credit-card-2-front",
  shield: "shield-check",
  link: "link-45deg",
  check: "check2",
  arrow: "arrow-right",
  lock: "lock",
  book: "book-half",
  sparkle: "stars",
};

function Icon({
  name,
  size = 24,
}: {
  name: HomeIcon;
  size?: number;
}) {
  return (
    <i
      className={`bi bi-${bootstrapIconNames[name]} lms-landing-bi`}
      style={{ fontSize: `${size}px` }}
      aria-hidden="true"
    />
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
  centered = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  centered?: boolean;
}) {
  return (
    <div className={`lms-landing-section-heading${centered ? " is-centered" : ""}`}>
      <span className="lms-landing-eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

function DashboardPreview({ portal }: { portal: Portal }) {
  return (
    <article className="lms-landing-preview">
      <div className="lms-landing-preview-browser" aria-hidden="true">
        <span />
        <span />
        <span />
        <div className="lms-landing-preview-address" />
      </div>
      <div className="lms-landing-preview-screen">
        <div className="lms-landing-preview-placeholder" aria-hidden="true">
          <div className="lms-landing-preview-sidebar">
            <span className="lms-landing-preview-square" />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="lms-landing-preview-body">
            <div className="lms-landing-preview-line lms-landing-preview-line-wide" />
            <div className="lms-landing-preview-tiles">
              <span />
              <span />
              <span />
            </div>
            <div className="lms-landing-preview-lower">
              <span />
              <span />
            </div>
          </div>
        </div>
        <div
          className="lms-landing-preview-real-image"
          role="img"
          aria-label={portal.previewAlt}
          style={{ backgroundImage: `url("${portal.previewImage}")` }}
        />
      </div>
      <div className="lms-landing-preview-caption">
        <div className={`lms-landing-icon is-${portal.accent}`}>
          <Icon name={portal.icon} size={21} />
        </div>
        <div>
          <h3>{portal.name} Dashboard</h3>
          <p>Explore the tools available to this role.</p>
        </div>
      </div>
      <Link href={portal.href} className="lms-landing-preview-link">
        Open portal <Icon name="arrow" size={16} />
      </Link>
    </article>
  );
}

export default function Home() {
  return (
    <main className="lms-landing" id="top">
      <MarketingHeader home />

      <HomeHeroCarousel />

      <section className="lms-landing-section lms-home-services-section" id="services" aria-labelledby="lms-home-services-title">
        <div className="lms-landing-container">
          <div className="lms-landing-section-heading is-centered">
            <span className="lms-landing-eyebrow">WHAT WE OFFER</span>
            <h2 id="lms-home-services-title">School &amp; college LMS software and online tutoring</h2>
            <p>Explore our two education services: a learning management system for institutions and live online tuition for students in Grades 7–12.</p>
          </div>
          <div className="lms-home-services-grid">
            <article className="lms-home-service-card">
              <span className="lms-home-service-label">FOR SCHOOLS &amp; COLLEGES</span>
              <span className="lms-landing-icon is-blue"><Icon name="admin" size={29} /></span>
              <h3>School and college management software</h3>
              <p>MySLS brings student admissions, enrollments, class schedules, teacher assignments, attendance, online exams, learning resources and fee management into one secure platform.</p>
              <div className="lms-home-service-tags"><span>College Management</span><span>School Management</span><span>Four Dedicated Portals</span></div>
              <Link className="lms-landing-inline-link" href="/services/school-college-lms">Explore School &amp; College LMS <Icon name="arrow" size={17} /></Link>
            </article>
            <article className="lms-home-service-card">
              <span className="lms-home-service-label">FOR STUDENTS &amp; FAMILIES</span>
              <span className="lms-landing-icon is-coral"><Icon name="video" size={29} /></span>
              <h3>One-to-one and group online tutoring</h3>
              <p>Choose individual or group tuition for Grades 7–12. Get help with Mathematics, Physics, Chemistry, Biology, homework and assignments through live online classes.</p>
              <div className="lms-home-service-tags"><span>One-to-One Classes</span><span>Group Classes</span><span>Homework &amp; Assignment Help</span></div>
              <Link className="lms-landing-inline-link" href="/services/online-tutoring">Explore Online Tutoring <Icon name="arrow" size={17} /></Link>
            </article>
          </div>
        </div>
      </section>

      <section className="lms-landing-section lms-landing-portals-section" id="portals">
        <div className="lms-landing-container">
          <SectionTitle
            eyebrow="ACCESS YOUR PORTAL"
            title="Your workspace, built around your role."
            description="Whether you lead a college, teach a class, work toward your goals or support a learner at home, start in the portal designed for you. Every role has a dedicated login and relevant tools."
            centered
          />
          <div className="lms-landing-portals">
            {portals.map((portal) => (
              <article className="lms-landing-portal" key={portal.href}>
                <span className="lms-landing-portal-number">{portal.number}</span>
                <span className={`lms-landing-icon lms-landing-portal-icon is-${portal.accent}`}>
                  <Icon name={portal.icon} size={29} />
                </span>
                <h3>{portal.name}</h3>
                <p>{portal.description}</p>
                <Link href={portal.href} className="lms-landing-portal-action">
                  Login to portal <Icon name="arrow" size={17} />
                </Link>
              </article>
            ))}
          </div>
          <p className="lms-landing-portals-note">
            <Icon name="shield" size={18} />
            New to MySLS? Your school or college manages portal access. Contact your institution for login details.
          </p>
        </div>
      </section>

      <section className="lms-landing-section lms-landing-features-section" id="features">
        <div className="lms-landing-container">
          <SectionTitle
            eyebrow="POWERFUL FEATURES"
            title="Everything your school or college needs to stay organized."
            description="Manage attendance, teaching resources, online classes, assignments, exams, fees and notices through connected academic tools."
          />
          <div className="lms-landing-feature-grid">
            {features.map((feature) => (
              <article className="lms-landing-feature" key={feature.title}>
                <span className={`lms-landing-icon is-${feature.accent}`}>
                  <Icon name={feature.icon} size={26} />
                </span>
                <div>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <StudentAITutorShowcase />

      <section className="lms-landing-section lms-landing-why-section" id="why-choose-us">
        <div className="lms-landing-container lms-landing-why-layout">
          <div className="lms-landing-why-copy">
            <span className="lms-landing-eyebrow">WHY CHOOSE US</span>
            <h2>One team for education technology <span>and personal learning.</span></h2>
            <p>
              We understand that institutions need reliable day-to-day management tools while
              students often need more focused teaching time. Our two services support both needs.
            </p>
            <p>
              From class administration to tailored one-to-one or group sessions, our approach
              focuses on practical tools, clear communication and helpful learning support.
            </p>
            <a className="lms-landing-inline-link" href="#contact">
              Let's talk about your needs <Icon name="arrow" size={17} />
            </a>
          </div>
          <div className="lms-landing-why-items">
            <div>
              <span className="lms-landing-icon is-blue"><Icon name="link" size={23} /></span>
              <div><h3>Built for schools and colleges</h3><p>Bring student records, fees, assessments, teachers and classes into a single platform with dedicated roles and access controls.</p></div>
            </div>
            <div>
              <span className="lms-landing-icon is-purple"><Icon name="lock" size={23} /></span>
              <div><h3>Flexible tutoring formats</h3><p>Choose focused one-to-one support or interactive group online classes based on learning needs.</p></div>
            </div>
            <div>
              <span className="lms-landing-icon is-green"><Icon name="chart" size={23} /></span>
              <div><h3>Support across the learning journey</h3><p>From homework and tuition to assignment support, we help learners find the kind of study help they need.</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="lms-landing-section lms-landing-steps-section" id="how-it-works">
        <div className="lms-landing-container">
          <SectionTitle
            eyebrow="HOW IT WORKS"
            title="The right tools are just a few steps away."
            description="Institutions can set up role-based access, while teachers, students and parents sign in to their dedicated MySLS portals."
            centered
          />
          <div className="lms-landing-steps">
            <div className="lms-landing-step">
              <span className="lms-landing-step-number">01</span>
              <span className="lms-landing-icon is-coral"><Icon name="parent" size={27} /></span>
              <h3>Choose your portal</h3>
              <p>Choose College Admin, Teacher, Student or Parent to open the workspace that matches your role.</p>
            </div>
            <div className="lms-landing-step">
              <span className="lms-landing-step-number">02</span>
              <span className="lms-landing-icon is-blue"><Icon name="lock" size={27} /></span>
              <h3>Sign in securely</h3>
              <p>Enter your institution-provided credentials to access the features available to your account.</p>
            </div>
            <div className="lms-landing-step">
              <span className="lms-landing-step-number">03</span>
              <span className="lms-landing-icon is-green"><Icon name="chart" size={27} /></span>
              <h3>Get things done</h3>
              <p>Manage your responsibilities, take part in learning and keep important academic information within reach.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="lms-landing-section lms-landing-journey-section" id="learning-journey">
        <div className="lms-landing-container">
          <SectionTitle
            eyebrow="FROM PLANNING TO PROGRESS"
            title="A connected experience throughout the academic journey."
            description="Great learning experiences are built on hundreds of smaller moments. Keep planning, teaching, assessment and communication moving in the same direction."
            centered
          />
          <div className="lms-landing-journey-grid">
            <article className="lms-landing-journey-card">
              <span className="lms-landing-journey-count">01 / ORGANIZE</span>
              <span className="lms-landing-icon is-blue"><Icon name="admin" size={26} /></span>
              <h3>Set the foundation</h3>
              <p>Bring classes, sections, subjects and student enrollment details together so academic work starts with the right information.</p>
            </article>
            <article className="lms-landing-journey-card">
              <span className="lms-landing-journey-count">02 / ENGAGE</span>
              <span className="lms-landing-icon is-green"><Icon name="video" size={26} /></span>
              <h3>Keep learning active</h3>
              <p>Help teachers and students stay engaged through live sessions, recorded content, shared resources and coursework.</p>
            </article>
            <article className="lms-landing-journey-card">
              <span className="lms-landing-journey-count">03 / ASSESS</span>
              <span className="lms-landing-icon is-purple"><Icon name="file" size={26} /></span>
              <h3>Understand achievement</h3>
              <p>Use assignments, examinations and results to see how learning is progressing and where additional support may help.</p>
            </article>
            <article className="lms-landing-journey-card">
              <span className="lms-landing-journey-count">04 / CONNECT</span>
              <span className="lms-landing-icon is-orange"><Icon name="parent" size={26} /></span>
              <h3>Keep people informed</h3>
              <p>Make notices, relevant academic updates and fee information easier to access for the people who need them.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="lms-landing-section lms-landing-dashboard-section" id="dashboards">
        <div className="lms-landing-container">
          <SectionTitle
            eyebrow="DASHBOARD PREVIEWS"
            title="Explore MySLS dashboards for every role."
            description="See the administrative, teaching, learning and parent dashboards available through MySLS, with each user seeing information relevant to their role."
          />
          <div className="lms-landing-dashboard-grid">
            {portals.map((portal) => (
              <DashboardPreview portal={portal} key={portal.href} />
            ))}
          </div>
        </div>
      </section>

      <section className="lms-landing-section lms-landing-tutor-section" id="become-a-tutor" aria-labelledby="lms-tutor-heading">
        <div className="lms-landing-container lms-landing-tutor-layout">
          <div className="lms-landing-tutor-intro">
            <span className="lms-landing-eyebrow">TEACH WITH US</span>
            <h2 id="lms-tutor-heading">Great learning starts with <span>great educators.</span></h2>
            <p className="lms-landing-tutor-lead">
              Are you passionate about helping students grow? We would love to hear from educators
              who bring subject knowledge, patience and enthusiasm to their teaching.
            </p>
            <p>
              Interested in becoming an online tutor at ShabddLearningSolution?
              Learn about our teaching opportunities and submit your application on the Tutor Hiring page.
            </p>
            <Link href="/tutor-hiring#apply" className="lms-landing-inline-link">
              Apply to become a tutor <Icon name="arrow" size={17} />
            </Link>
            <div className="lms-landing-tutor-benefits">
              <div>
                <span className="lms-landing-tutor-benefit-icon"><Icon name="book" size={22} /></span>
                <div>
                  <h3>Teach what you know best</h3>
                  <p>Tell us the subjects and student levels where you can make a difference.</p>
                </div>
              </div>
              <div>
                <span className="lms-landing-tutor-benefit-icon"><Icon name="video" size={22} /></span>
                <div>
                  <h3>Highlight your experience</h3>
                  <p>Share your background and teaching approach so we can understand your strengths.</p>
                </div>
              </div>
              <div>
                <span className="lms-landing-tutor-benefit-icon"><Icon name="shield" size={22} /></span>
                <div>
                  <h3>Simple application process</h3>
                  <p>Send your details directly to our recruitment team for consideration.</p>
                </div>
              </div>
            </div>
            <div className="lms-landing-tutor-disclaimer">
              Submitting an application does not guarantee employment. Our team will contact you if your profile matches an available opportunity.
            </div>
          </div>
          <aside className="lms-home-hiring-card" aria-label="Tutor Hiring application information">
            <div className="lms-home-hiring-illustration" aria-hidden="true">
              <span className="lms-home-hiring-icon"><Icon name="cap" size={40} /></span>
              <span className="lms-home-hiring-decoration is-one"><Icon name="book" size={19} /></span>
              <span className="lms-home-hiring-decoration is-two"><Icon name="sparkle" size={22} /></span>
            </div>
            <span className="lms-landing-eyebrow">TUTOR OPPORTUNITIES</span>
            <h3>Ready to help students learn?</h3>
            <p>Share your qualifications, teaching subjects and experience through our online tutor application.</p>
            <div className="lms-home-hiring-highlights">
              <span><Icon name="check" size={18} /> Complete your tutor profile</span>
              <span><Icon name="check" size={18} /> Share subjects and experience</span>
              <span><Icon name="check" size={18} /> Submit for review</span>
            </div>
            <Link href="/tutor-hiring#apply" className="lms-landing-button lms-home-hiring-apply-link">
              Apply as a Tutor <Icon name="arrow" size={18} />
            </Link>
            <span className="lms-home-hiring-note">Our team reviews applications and contacts suitable candidates.</span>
          </aside>
        </div>
      </section>

      <section className="lms-landing-section lms-home-testimonials-section" id="testimonials">
        <div className="lms-landing-container">
          <SectionTitle
            eyebrow="COMMUNITY &amp; FEEDBACK"
            title="Your experience matters to the MySLS community."
            description="Student feedback, family perspectives and educator insights help improve the learning experience. We welcome genuine stories from the people who use our services."
            centered
          />
          <div className="lms-home-testimonial-grid">
            <article className="lms-home-testimonial-card">
              <span className="lms-home-testimonial-icon"><Icon name="parent" size={23} /></span>
              <span className="lms-home-testimonial-label">PARENTS &amp; STUDENTS</span>
              <h3>Tell us about your learning journey</h3>
              <p>Share your experience with individual tuition, group classes or homework support.</p>
              <Link href="#contact" className="lms-home-testimonial-pending">Share your feedback <Icon name="arrow" size={15} /></Link>
            </article>
            <article className="lms-home-testimonial-card">
              <span className="lms-home-testimonial-icon"><Icon name="teacher" size={23} /></span>
              <span className="lms-home-testimonial-label">TUTORS &amp; EDUCATORS</span>
              <h3>Help us improve the teaching experience</h3>
              <p>Let us know how our teaching tools and academic resources support your work.</p>
              <Link href="#contact" className="lms-home-testimonial-pending">Get in touch <Icon name="arrow" size={15} /></Link>
            </article>
            <article className="lms-home-testimonial-card">
              <span className="lms-home-testimonial-icon"><Icon name="admin" size={23} /></span>
              <span className="lms-home-testimonial-label">SCHOOLS &amp; COLLEGES</span>
              <h3>Share your institution&apos;s perspective</h3>
              <p>Tell us which campus management processes are working well and where you need more support.</p>
              <Link href="#contact" className="lms-home-testimonial-pending">Contact our team <Icon name="arrow" size={15} /></Link>
            </article>
          </div>
        </div>
      </section>

      <section className="lms-landing-section lms-landing-faq-section" id="faq">
        <div className="lms-landing-container lms-landing-faq-layout">
          <div className="lms-landing-faq-intro">
            <span className="lms-landing-eyebrow">GOOD TO KNOW</span>
            <h2>Questions? We’ve got the essentials covered.</h2>
            <p>Understand how the platform works, choose the right portal and make the most of the tools available to your institution.</p>
          </div>
          <div className="lms-landing-faq-list">
            <details>
              <summary>What services do you provide?</summary>
              <p>ShabddLearningSolution (MySLS) offers school and college management software, one-to-one online tutoring, group tuition, homework help and assignment guidance.</p>
            </details>
            <details>
              <summary>Can I book one-to-one or group online classes?</summary>
              <p>Yes. Use the contact form below to tell us the learner's grade, subjects and preferred one-to-one or group format so our team can respond with available options.</p>
            </details>
            <details>
              <summary>What is ShabddLearningSolution (MySLS)?</summary>
              <p>MySLS is a learning management platform that helps schools and colleges organize students, teachers, academic schedules, attendance, fees, online assessments and communication through separate role-based portals.</p>
            </details>
            <details>
              <summary>Which login portal should I choose?</summary>
              <p>Choose the portal that matches your role. Your institution provides the username or registered email and password for your account.</p>
            </details>
            <details>
              <summary>Can I access MySLS on a phone or tablet?</summary>
              <p>Yes. The landing page and portals are designed to adapt to desktop, tablet and mobile screens. The tools you see depend on your role and your institution’s settings.</p>
            </details>
            <details>
              <summary>Can teachers conduct online exams?</summary>
              <p>Teachers can create objective, subjective or mixed-question online exams. Objective marks are calculated after submission; the teacher evaluates descriptive answers and controls when final results are published.</p>
            </details>
            <details>
              <summary>Can parents see academic and fee information?</summary>
              <p>The Parent Portal helps linked parents review available information about their child’s learning and fees, subject to the access permitted by their institution.</p>
            </details>
            <details>
              <summary>What if I forget my password?</summary>
              <p>Open your role’s login page and select Forgot password to follow the email password-reset process.</p>
            </details>
          </div>
        </div>
      </section>

      <section className="lms-landing-section lms-home-contact-section" id="contact">
        <div className="lms-landing-container lms-home-contact-layout">
          <div className="lms-home-contact-copy">
            <span className="lms-landing-eyebrow">CONTACT US</span>
            <h2>Let's make learning <span>work better together.</span></h2>
            <p>Looking for an LMS for your school or college? Interested in one-to-one lessons, group classes, homework help or assignment support? Send us a message and tell us what you need.</p>
            <div className="lms-home-contact-points">
              <div><span className="lms-landing-icon is-blue"><Icon name="admin" size={22} /></span><div><h3>For institutions</h3><p>Discuss LMS setup and management for your school or college.</p></div></div>
              <div><span className="lms-landing-icon is-green"><Icon name="video" size={22} /></span><div><h3>For students &amp; families</h3><p>Enquire about subjects, levels and online class formats.</p></div></div>
              <div><span className="lms-landing-icon is-purple"><Icon name="shield" size={22} /></span><div><h3>Private, direct enquiry</h3><p>Your message goes to our team rather than being posted publicly.</p></div></div>
            </div>
            <address className="lms-home-contact-details" aria-label="Our Canada and India contact information">
              <h3>Get in touch directly</h3>
              <h4 className="lms-home-contact-region">Canada</h4>
              <a href={publicContact.phoneHref}>
                <span className="lms-home-contact-detail-icon"><i className="bi bi-telephone" aria-hidden="true" /></span>
                <span><strong>Call us</strong>{publicContact.phoneDisplay}</span>
              </a>
              <a href={publicContact.emailHref}>
                <span className="lms-home-contact-detail-icon"><i className="bi bi-envelope" aria-hidden="true" /></span>
                <span><strong>Email us</strong>{publicContact.email}</span>
              </a>
              <div>
                <span className="lms-home-contact-detail-icon"><i className="bi bi-geo-alt" aria-hidden="true" /></span>
                <span><strong>Our address</strong>{publicContact.address}</span>
              </div>
              <h4 className="lms-home-contact-region">India</h4>
              <a href={publicContact.india.phoneHref}>
                <span className="lms-home-contact-detail-icon"><i className="bi bi-telephone" aria-hidden="true" /></span>
                <span><strong>Call us</strong>{publicContact.india.phoneDisplay}</span>
              </a>
              <a href={publicContact.india.emailHref}>
                <span className="lms-home-contact-detail-icon"><i className="bi bi-envelope" aria-hidden="true" /></span>
                <span><strong>Email us</strong>{publicContact.india.email}</span>
              </a>
              <div>
                <span className="lms-home-contact-detail-icon"><i className="bi bi-geo-alt" aria-hidden="true" /></span>
                <span><strong>Our address</strong>{publicContact.india.address}</span>
              </div>
            </address>
          </div>
          <ContactInquiryForm />
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
