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

function Icon({
  name,
  size = 24,
}: {
  name: HomeIcon;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "cap":
    case "student":
      return (
        <svg {...common}>
          <path d="m2 9 10-5 10 5-10 5L2 9Z" />
          <path d="M6 11v5c3.6 2.7 8.4 2.7 12 0v-5M22 9v6" />
        </svg>
      );
    case "admin":
      return (
        <svg {...common}>
          <path d="M3 21h18M5 21V9h14v12M3 9l9-6 9 6M9 13v3m6-3v3M10 21v-4h4v4" />
        </svg>
      );
    case "teacher":
      return (
        <svg {...common}>
          <rect x="9" y="3" width="13" height="11" rx="2" />
          <path d="m13 9 3 2 3-4M2 21v-2a5 5 0 0 1 10 0v2M7 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        </svg>
      );
    case "parent":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="3" />
          <circle cx="17.5" cy="9.5" r="2.5" />
          <path d="M2 21v-2a6 6 0 0 1 12 0v2m1-6a5 5 0 0 1 7 4.5V21" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M7 3v4m10-4v4M3 10h18m-13 5 3 3 5-5" />
        </svg>
      );
    case "video":
      return (
        <svg {...common}>
          <rect x="2.5" y="5" width="14" height="14" rx="3" />
          <path d="m16.5 10 5-3v10l-5-3" />
        </svg>
      );
    case "play":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m10 8 6 4-6 4V8Z" />
        </svg>
      );
    case "file":
      return (
        <svg {...common}>
          <path d="M6 3h8l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
          <path d="M14 3v5h5M8 12h8M8 16h7" />
        </svg>
      );
    case "wallet":
      return (
        <svg {...common}>
          <rect x="3" y="6" width="18" height="15" rx="3" />
          <path d="M3 10h18M6 6V4h13m-1 12h-4" />
        </svg>
      );
    case "notice":
      return (
        <svg {...common}>
          <path d="m3 11 12-6v14L3 13v-2Zm12-3h2a4 4 0 0 1 0 8h-2M6 15l2 6h3l-2-5m10-9 2-2M20 12h3" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <path d="M3 21h18M6 18v-6m6 6V7m6 11V3" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 2 4 5v7c0 5 3 8 8 10 5-2 8-5 8-10V5l-8-3Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "link":
      return (
        <svg {...common}>
          <path d="M10 13a5 5 0 0 0 7 .4l3-3a5 5 0 0 0-7-7l-2 2m3 5a5 5 0 0 0-7-.4l-3 3a5 5 0 0 0 7 7l2-2" />
        </svg>
      );
    case "lock":
      return (
        <svg {...common}>
          <rect x="5" y="11" width="14" height="11" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4m-4 5v2" />
        </svg>
      );
    case "book":
      return (
        <svg {...common}>
          <path d="M12 6c-3-2-7-2-10-1v15c3-1 7-1 10 1 3-2 7-2 10-1V5c-3-1-7-1-10 1Zm0 0v15" />
        </svg>
      );
    case "sparkle":
      return (
        <svg {...common}>
          <path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="m5 12 4 4L19 6" />
        </svg>
      );
    case "arrow":
      return (
        <svg {...common}>
          <path d="M4 12h16m-6-6 6 6-6 6" />
        </svg>
      );
  }
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
