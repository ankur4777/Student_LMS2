import Link from "next/link";
import TutorApplicationForm from "@/components/TutorApplicationForm";
import ContactInquiryForm from "@/components/ContactInquiryForm";
import { MarketingHeader, MarketingFooter } from "@/components/MarketingHeader";
import StudentAITutorShowcase from "@/components/StudentAITutorShowcase";

import "./home.css";
import "./home-updates.css";
import "./ai-tutor-showcase.css";

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
          <p>A look inside the real dashboard for this role.</p>
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

      <section className="lms-landing-hero">
        <div className="lms-landing-container lms-landing-hero-layout">
          <div className="lms-landing-hero-copy">
            <span className="lms-landing-tag">
              <Icon name="sparkle" size={16} />
              Education technology & online tutoring
            </span>
            <h1>
              One connected campus.
              <span> A brighter way to learn.</span>
            </h1>
            <p className="lms-landing-hero-lead">
              <strong>Give schools and colleges their own LMS platform</strong> to manage students, teachers, classes, attendance, fees and academic records. We also provide <strong>online one-to-one and group tutoring</strong> for learners.
            </p>
            <p className="lms-landing-hero-support">
              Whether you're running an institution or looking for homework help, tuition classes or assignment support,
              our services are built to make learning and administration easier.
            </p>
            <div className="lms-landing-hero-actions">
              <a href="#services" className="lms-landing-button">
                Explore our services <Icon name="arrow" size={18} />
              </a>
              <a href="#contact" className="lms-landing-button lms-landing-button-outline">
                Talk to our team
              </a>
            </div>
            <div className="lms-landing-trust-notes">
              <span><Icon name="check" size={16} /> LMS for schools &amp; colleges</span>
              <span><Icon name="check" size={16} /> 1-to-1 &amp; group sessions</span>
              <span><Icon name="check" size={16} /> Homework, tuition &amp; assignment help</span>
            </div>
          </div>
          <div className="lms-landing-hero-visual">
            <div
              className="lms-landing-hero-image"
              role="img"
              aria-label="Student studying on a laptop at a sunlit campus with education graphics and books"
            />
          </div>
        </div>
      </section>

      <section className="lms-landing-section lms-home-services-section" id="services" aria-labelledby="lms-home-services-title">
        <div className="lms-landing-container">
          <div className="lms-landing-section-heading is-centered">
            <span className="lms-landing-eyebrow">WHAT WE OFFER</span>
            <h2 id="lms-home-services-title">Two ways to make education work better.</h2>
            <p>We help institutions manage their academic operations, and we help individual learners grow with live online tutoring.</p>
          </div>
          <div className="lms-home-services-grid">
            <article className="lms-home-service-card">
              <span className="lms-home-service-label">FOR SCHOOLS &amp; COLLEGES</span>
              <span className="lms-landing-icon is-blue"><Icon name="admin" size={29} /></span>
              <h3>A complete LMS for your institution</h3>
              <p>Use Student LMS as your education-management product. Organize admissions and enrollments, academic classes, teachers, attendance, exams, learning resources and fee administration through secure role-based portals.</p>
              <div className="lms-home-service-tags"><span>College Management</span><span>School Management</span><span>Four Dedicated Portals</span></div>
              <Link className="lms-landing-inline-link" href="/services/school-college-lms">Explore School &amp; College LMS <Icon name="arrow" size={17} /></Link>
            </article>
            <article className="lms-home-service-card">
              <span className="lms-home-service-label">FOR STUDENTS &amp; FAMILIES</span>
              <span className="lms-landing-icon is-coral"><Icon name="video" size={29} /></span>
              <h3>Live online tutoring that fits your needs</h3>
              <p>Choose one-to-one attention or learn in a group. Ask us about homework help, tuition classes and assignment support in relevant grades and subjects, including Physics, Chemistry, Mathematics and Biology.</p>
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
            New to Student LMS? Your institution provides account access and can help you choose the right portal.
          </p>
        </div>
      </section>

      <section className="lms-landing-section lms-landing-features-section" id="features">
        <div className="lms-landing-container">
          <SectionTitle
            eyebrow="POWERFUL FEATURES"
            title="Everyday campus essentials, working together."
            description="The details of college life matter. Organize routine tasks, deliver engaging lessons and make academic information easier to find, follow and manage across your institution."
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
            description="Student LMS is designed to make getting started straightforward, whether you are managing an institution or checking your next class."
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
            title="Explore the real Student LMS dashboards."
            description="See how College Admins, Teachers, Students and Parents stay organized with their own dedicated workspaces. These previews show actual screens from Student LMS."
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
              Share your qualifications, subjects and teaching experience through the application form.
              Our team can review your details and reach out if there is a suitable opportunity.
            </p>
            <Link href="/tutor-hiring" className="lms-landing-inline-link">
              Learn about our Tutor Hiring process <Icon name="arrow" size={17} />
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
          <TutorApplicationForm />
        </div>
      </section>

      <section className="lms-landing-section lms-home-testimonials-section" id="testimonials">
        <div className="lms-landing-container">
          <SectionTitle
            eyebrow="TESTIMONIALS"
            title="Learning is better when we listen."
            description="We are preparing a space for genuine feedback from parents, educators and partner institutions. Verified testimonials will be added only with their permission."
            centered
          />
          <div className="lms-home-testimonial-grid">
            <article className="lms-home-testimonial-card">
              <span className="lms-home-testimonial-icon"><Icon name="parent" size={23} /></span>
              <span className="lms-home-testimonial-label">PARENTS &amp; STUDENTS</span>
              <h3>Parent and student experiences</h3>
              <p>Approved reviews of one-to-one and group tutoring will appear here.</p>
              <span className="lms-home-testimonial-pending">Verified testimonial pending</span>
            </article>
            <article className="lms-home-testimonial-card">
              <span className="lms-home-testimonial-icon"><Icon name="teacher" size={23} /></span>
              <span className="lms-home-testimonial-label">TUTORS &amp; EDUCATORS</span>
              <h3>Teacher perspectives</h3>
              <p>We will share real experiences from educators once those reviews are available.</p>
              <span className="lms-home-testimonial-pending">Verified testimonial pending</span>
            </article>
            <article className="lms-home-testimonial-card">
              <span className="lms-home-testimonial-icon"><Icon name="admin" size={23} /></span>
              <span className="lms-home-testimonial-label">SCHOOLS &amp; COLLEGES</span>
              <h3>Institution feedback</h3>
              <p>Approved feedback on managing education with our LMS will be featured here.</p>
              <span className="lms-home-testimonial-pending">Verified testimonial pending</span>
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
              <p>We provide Student LMS software for schools and colleges to manage academic operations, plus live online one-to-one and group tutoring with homework, tuition and assignment support.</p>
            </details>
            <details>
              <summary>Can I book one-to-one or group online classes?</summary>
              <p>Yes. Use the contact form below to tell us the learner's grade, subjects and preferred one-to-one or group format so our team can respond with available options.</p>
            </details>
            <details>
              <summary>What is Student LMS?</summary>
              <p>Student LMS brings key academic and administrative tools into one platform, with separate workspaces for college administrators, teachers, students and parents.</p>
            </details>
            <details>
              <summary>Which login portal should I choose?</summary>
              <p>Choose the portal that matches your role. Your institution provides the username or registered email and password for your account.</p>
            </details>
            <details>
              <summary>Can I access Student LMS from my phone?</summary>
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
          </div>
          <ContactInquiryForm />
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
