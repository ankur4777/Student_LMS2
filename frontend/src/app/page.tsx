import Image from "next/image";
import Link from "next/link";

import "./home.css";

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
};

const portals: Portal[] = [
  {
    name: "College Admin",
    description: "Manage your institution, academics, teachers, students and fees.",
    href: "/college-admin/login",
    icon: "admin",
    accent: "blue",
    number: "01",
  },
  {
    name: "Teacher Portal",
    description: "Organize classes, share learning material and track progress.",
    href: "/teacher/login",
    icon: "teacher",
    accent: "green",
    number: "02",
  },
  {
    name: "Student Portal",
    description: "Join classes, complete assignments and explore recorded learning.",
    href: "/student/login",
    icon: "student",
    accent: "purple",
    number: "03",
  },
  {
    name: "Parent Portal",
    description: "Stay connected with your child’s studies, fees and updates.",
    href: "/parent/login",
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
    description: "Keep classroom attendance organized and easy to review.",
    accent: "coral",
  },
  {
    icon: "video",
    title: "Live Classes",
    description: "Schedule live sessions and help students join on time.",
    accent: "blue",
  },
  {
    icon: "play",
    title: "Recorded Learning",
    description: "Explore lessons and class recordings with controlled access.",
    accent: "orange",
  },
  {
    icon: "file",
    title: "Assignments & Exams",
    description: "Connect teachers and students through academic work.",
    accent: "purple",
  },
  {
    icon: "wallet",
    title: "Fee Management",
    description: "Manage fee structures, balances and payment verification.",
    accent: "green",
  },
  {
    icon: "notice",
    title: "Notices & Documents",
    description: "Share learning resources and important college updates.",
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
      <div className="lms-landing-preview-screen" aria-hidden="true">
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
          <div className="lms-landing-preview-screen-note">
            Dashboard screenshot coming soon
          </div>
        </div>
      </div>
      <div className="lms-landing-preview-caption">
        <div className={`lms-landing-icon is-${portal.accent}`}>
          <Icon name={portal.icon} size={21} />
        </div>
        <div>
          <h3>{portal.name} Dashboard</h3>
          <p>Preview will be updated with your actual portal screenshot.</p>
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
      <header className="lms-landing-header">
        <div className="lms-landing-container lms-landing-nav">
          <Link href="/" className="lms-landing-brand" aria-label="Student LMS homepage">
            <span className="lms-landing-brand-symbol">
              <Icon name="cap" size={27} />
            </span>
            <span>Student <strong>LMS</strong></span>
          </Link>
          <nav className="lms-landing-nav-links" aria-label="Main navigation">
            <a href="#top">Home</a>
            <a href="#features">Features</a>
            <a href="#portals">Portals</a>
            <a href="#dashboards">Dashboards</a>
            <a href="#contact">Contact</a>
          </nav>
          <a className="lms-landing-button lms-landing-button-small" href="#portals">
            Login <Icon name="arrow" size={16} />
          </a>
        </div>
      </header>

      <section className="lms-landing-hero">
        <div className="lms-landing-container lms-landing-hero-layout">
          <div className="lms-landing-hero-copy">
            <span className="lms-landing-tag">
              <Icon name="sparkle" size={16} />
              Learning, connected
            </span>
            <h1>
              One platform.
              <span> Four dedicated portals.</span>
            </h1>
            <p>
              Bring students, teachers, parents and college administrators together
              in a simpler, more connected learning experience.
            </p>
            <div className="lms-landing-hero-actions">
              <a href="#portals" className="lms-landing-button">
                Explore portals <Icon name="arrow" size={18} />
              </a>
              <a href="#features" className="lms-landing-button lms-landing-button-outline">
                Discover features
              </a>
            </div>
            <div className="lms-landing-trust-notes">
              <span><Icon name="check" size={16} /> Role-based portals</span>
              <span><Icon name="check" size={16} /> One connected campus</span>
              <span><Icon name="check" size={16} /> Easy access</span>
            </div>
          </div>
          <div className="lms-landing-hero-visual">
            <Image
              src="/student-lms-hero.svg"
              width={780}
              height={640}
              alt="Illustration of a student learning with a laptop, books and academic dashboard cards"
              className="lms-landing-hero-image"
              priority
            />
            <div className="lms-landing-floating-card lms-landing-floating-top">
              <span className="lms-landing-floating-icon"><Icon name="book" size={20} /></span>
              <span><strong>Learning together</strong><small>One workspace for every role</small></span>
            </div>
            <div className="lms-landing-floating-card lms-landing-floating-bottom">
              <span className="lms-landing-floating-icon is-green"><Icon name="shield" size={20} /></span>
              <span><strong>Dedicated access</strong><small>Separate, secure login portals</small></span>
            </div>
          </div>
        </div>
      </section>

      <section className="lms-landing-section lms-landing-portals-section" id="portals">
        <div className="lms-landing-container">
          <SectionTitle
            eyebrow="ACCESS YOUR PORTAL"
            title="Four portals. One connected campus."
            description="Choose the workspace designed for your role. Every button takes you to the existing secure login page."
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
        </div>
      </section>

      <section className="lms-landing-section lms-landing-features-section" id="features">
        <div className="lms-landing-container">
          <SectionTitle
            eyebrow="POWERFUL FEATURES"
            title="Everything you need for modern education."
            description="Keep academic activities in one place, with dedicated tools for everyday college life."
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

      <section className="lms-landing-section lms-landing-why-section">
        <div className="lms-landing-container lms-landing-why-layout">
          <div className="lms-landing-why-copy">
            <span className="lms-landing-eyebrow">BUILT FOR EVERY CAMPUS</span>
            <h2>Less switching between tools. More time for learning.</h2>
            <p>
              Student LMS connects the people and academic information that
              make daily college operations work.
            </p>
            <a className="lms-landing-inline-link" href="#how-it-works">
              See how it works <Icon name="arrow" size={17} />
            </a>
          </div>
          <div className="lms-landing-why-items">
            <div>
              <span className="lms-landing-icon is-blue"><Icon name="link" size={23} /></span>
              <div><h3>Connected academic records</h3><p>Move between students, classes, teachers and related information more easily.</p></div>
            </div>
            <div>
              <span className="lms-landing-icon is-purple"><Icon name="lock" size={23} /></span>
              <div><h3>Access for every role</h3><p>Dedicated portals and class-level access controls keep workspaces relevant.</p></div>
            </div>
            <div>
              <span className="lms-landing-icon is-green"><Icon name="chart" size={23} /></span>
              <div><h3>Clearer oversight</h3><p>Review learning activity, attendance, fees and academic progress from one system.</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="lms-landing-section lms-landing-steps-section" id="how-it-works">
        <div className="lms-landing-container">
          <SectionTitle
            eyebrow="HOW IT WORKS"
            title="Get started in three simple steps."
            description="From the homepage to your workspace in just a few clicks."
            centered
          />
          <div className="lms-landing-steps">
            <div className="lms-landing-step">
              <span className="lms-landing-step-number">01</span>
              <span className="lms-landing-icon is-coral"><Icon name="parent" size={27} /></span>
              <h3>Choose your portal</h3>
              <p>Select College Admin, Teacher, Student or Parent.</p>
            </div>
            <div className="lms-landing-step">
              <span className="lms-landing-step-number">02</span>
              <span className="lms-landing-icon is-blue"><Icon name="lock" size={27} /></span>
              <h3>Sign in securely</h3>
              <p>Use the login credentials provided by your institution.</p>
            </div>
            <div className="lms-landing-step">
              <span className="lms-landing-step-number">03</span>
              <span className="lms-landing-icon is-green"><Icon name="chart" size={27} /></span>
              <h3>Get things done</h3>
              <p>Access the tools and information available to your role.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="lms-landing-section lms-landing-dashboard-section" id="dashboards">
        <div className="lms-landing-container">
          <SectionTitle
            eyebrow="DASHBOARD PREVIEWS"
            title="A workspace for every member."
            description="A dedicated dashboard for each role. The preview areas below are reserved for the real dashboard screenshots you'll add next."
          />
          <div className="lms-landing-dashboard-grid">
            {portals.map((portal) => (
              <DashboardPreview portal={portal} key={portal.href} />
            ))}
          </div>
        </div>
      </section>

      <section className="lms-landing-section lms-landing-faq-section" id="faq">
        <div className="lms-landing-container lms-landing-faq-layout">
          <div className="lms-landing-faq-intro">
            <span className="lms-landing-eyebrow">GOOD TO KNOW</span>
            <h2>Frequently asked questions.</h2>
            <p>Quick answers to help you get started with your portal.</p>
          </div>
          <div className="lms-landing-faq-list">
            <details>
              <summary>What is Student LMS?</summary>
              <p>It is a learning management platform that connects college administration, teachers, students and parents through dedicated portals.</p>
            </details>
            <details>
              <summary>Which login portal should I choose?</summary>
              <p>Choose the portal that matches your role. Your institution provides the username or registered email and password for your account.</p>
            </details>
            <details>
              <summary>Can I access Student LMS from my phone?</summary>
              <p>Yes. The interface is designed for desktop, tablet and mobile screens. Available features depend on your account and role.</p>
            </details>
            <details>
              <summary>What if I forget my password?</summary>
              <p>Open your role’s login page and select Forgot password to follow the email password-reset process.</p>
            </details>
          </div>
        </div>
      </section>

      <section className="lms-landing-container lms-landing-cta" id="contact">
        <div className="lms-landing-cta-icon"><Icon name="cap" size={38} /></div>
        <div>
          <span className="lms-landing-eyebrow">LET’S GET STARTED</span>
          <h2>Ready to enter your learning workspace?</h2>
          <p>Choose your portal to begin. Need an account? Contact your college administration.</p>
        </div>
        <a href="#portals" className="lms-landing-button">
          Choose your portal <Icon name="arrow" size={18} />
        </a>
      </section>

      <footer className="lms-landing-footer">
        <div className="lms-landing-container lms-landing-footer-inner">
          <div>
            <Link href="/" className="lms-landing-brand">
              <span className="lms-landing-brand-symbol"><Icon name="cap" size={23} /></span>
              <span>Student <strong>LMS</strong></span>
            </Link>
            <p>Connected learning, clearer management.</p>
          </div>
          <nav aria-label="Footer navigation">
            <a href="#top">Home</a>
            <a href="#features">Features</a>
            <a href="#portals">Portals</a>
            <a href="#faq">FAQs</a>
          </nav>
        </div>
        <div className="lms-landing-container lms-landing-footer-bottom">
          <span>© {new Date().getFullYear()} Student LMS. All rights reserved.</span>
          <span>Designed &amp; Developed by <strong>Shabdd Innovations</strong></span>
        </div>
      </footer>
    </main>
  );
}
