import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import "./public-site.css";

const navigation = [
  { label: "Home", href: "/" },
  { label: "Features", href: "/features" },
  { label: "Online Learning", href: "/online-learning" },
  { label: "For Students", href: "/for-students" },
  { label: "For Colleges", href: "/for-colleges" },
  { label: "About", href: "/about" },
];

export const rolePortals = [
  {
    name: "Students",
    label: "Continue learning",
    copy: "Your classes, study materials, online exams and progress in one place.",
    href: "/student/login",
    icon: "✦",
    image: "/student-dashboard.webp",
    imageAlt: "Student LMS student dashboard with academic activity",
  },
  {
    name: "Teachers",
    label: "Manage your classes",
    copy: "Plan class activities, publish learning resources and review student work.",
    href: "/teacher/login",
    icon: "✳",
    image: "/teacher-dashboard.webp",
    imageAlt: "Student LMS teacher dashboard",
  },
  {
    name: "College Admins",
    label: "Run your campus",
    copy: "Coordinate enrollments, academic records, access controls and fees.",
    href: "/college-admin/login",
    icon: "▦",
    image: "/college-admin-dashboard.webp",
    imageAlt: "Student LMS college administrator dashboard",
  },
  {
    name: "Parents",
    label: "Stay connected",
    copy: "Follow linked learners' academic updates and relevant college information.",
    href: "/parent/login",
    icon: "♡",
    image: "/parent-dashboard.webp",
    imageAlt: "Student LMS parent dashboard",
  },
];

export type Feature = {
  icon: string;
  title: string;
  description: string;
};

export function SiteButton({
  href,
  children,
  outline = false,
  light = false,
}: {
  href: string;
  children: ReactNode;
  outline?: boolean;
  light?: boolean;
}) {
  return (
    <Link
      className={"sl-btn" + (outline ? " sl-btn-outline" : "") + (light ? " sl-btn-light" : "")}
      href={href}
    >
      {children} <span aria-hidden="true">↗</span>
    </Link>
  );
}

function Header() {
  return (
    <header className="sl-header">
      <div className="sl-container sl-header-inner">
        <Link href="/" className="sl-brand" aria-label="Student LMS, home">
          <span className="sl-brand-icon" aria-hidden="true">✦</span>
          <span>student<span className="sl-brand-accent">lms.</span><small>LEARN. CONNECT. GROW.</small></span>
        </Link>
        <nav className="sl-desktop-nav" aria-label="Main navigation">
          {navigation.map((item) => (
            <Link href={item.href} key={item.href}>{item.label}</Link>
          ))}
        </nav>
        <div className="sl-header-actions">
          <SiteButton href="/get-started">Get Started</SiteButton>
          <details className="sl-mobile-menu">
            <summary aria-label="Open website navigation">Menu <span aria-hidden="true">☰</span></summary>
            <nav aria-label="Mobile navigation">
              {navigation.map((item) => (
                <Link href={item.href} key={item.href}>{item.label}</Link>
              ))}
              <Link href="/get-started">Get Started →</Link>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="sl-footer">
      <div className="sl-container">
        <div className="sl-footer-top">
          <div className="sl-footer-intro">
            <Link href="/" className="sl-brand sl-brand-footer" aria-label="Student LMS home">
              <span className="sl-brand-icon" aria-hidden="true">✦</span>
              <span>student<span className="sl-brand-accent">lms.</span><small>LEARN. CONNECT. GROW.</small></span>
            </Link>
            <p>Thoughtfully connected tools for teaching, learning and campus administration.</p>
            <span className="sl-footer-tag">A Shabdd Innovations project</span>
          </div>
          <div className="sl-footer-links">
            <div>
              <strong>Explore</strong>
              <Link href="/features">Features</Link>
              <Link href="/online-learning">Online Learning</Link>
              <Link href="/for-students">For Students</Link>
              <Link href="/for-colleges">For Colleges</Link>
            </div>
            <div>
              <strong>Student LMS</strong>
              <Link href="/about">About</Link>
              <Link href="/get-started">Get Started</Link>
              <Link href="/get-started#teach-with-us">Teach With Us</Link>
            </div>
            <div>
              <strong>Portal access</strong>
              <Link href="/student/login">Student Login</Link>
              <Link href="/teacher/login">Teacher Login</Link>
              <Link href="/college-admin/login">College Admin Login</Link>
              <Link href="/parent/login">Parent Login</Link>
            </div>
          </div>
        </div>
        <div className="sl-footer-bottom">
          <span>© {new Date().getFullYear()} Student LMS. All rights reserved.</span>
          <span>Built to make everyday learning feel simpler.</span>
        </div>
      </div>
    </footer>
  );
}

export function PublicSite({ children }: { children: ReactNode }) {
  return (
    <div className="sl-site">
      <a className="sl-skip" href="#site-main">Skip to content</a>
      <Header />
      <main id="site-main">{children}</main>
      <Footer />
    </div>
  );
}

export function SiteHero({
  eyebrow, title, highlight, description, image, imageAlt, primaryHref,
  primaryLabel, secondaryHref, secondaryLabel, note, variant = "default",
}: {
  eyebrow: string;
  title: string;
  highlight: string;
  description: string;
  image: string;
  imageAlt: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
  note?: string;
  variant?: "default" | "compact";
}) {
  return (
    <section className={"sl-hero" + (variant === "compact" ? " sl-hero-compact" : "")}>
      <div className="sl-container sl-hero-grid">
        <div className="sl-hero-copy">
          <span className="sl-kicker"><span className="sl-kicker-dot" />{eyebrow}</span>
          <h1>{title} <em>{highlight}</em></h1>
          <p>{description}</p>
          <div className="sl-actions">
            <SiteButton href={primaryHref}>{primaryLabel}</SiteButton>
            <SiteButton href={secondaryHref} outline>{secondaryLabel}</SiteButton>
          </div>
          <div className="sl-hero-note">
            <span className="sl-check" aria-hidden="true">✓</span>
            {note ?? "Dedicated spaces for students, teachers, parents and colleges"}
          </div>
        </div>
        <div className="sl-hero-art">
          <div className="sl-hero-photo">
            <Image src={image} alt={imageAlt} fill priority sizes="(max-width: 860px) 100vw, 45vw" />
          </div>
          <div className="sl-float sl-float-top"><span aria-hidden="true">✦</span> Built around real learning</div>
          <div className="sl-float sl-float-bottom"><span className="sl-float-icon" aria-hidden="true">✓</span> One connected workspace</div>
        </div>
      </div>
    </section>
  );
}

export function SectionHeading({
  eyebrow, title, description, center = false,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  center?: boolean;
}) {
  return (
    <div className={"sl-section-heading" + (center ? " sl-center" : "")}>
      <span className="sl-label">{eyebrow}</span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}

export function FeatureCards({
  items,
  columns = 3,
}: {
  items: Feature[];
  columns?: 2 | 3 | 4;
}) {
  return (
    <div className={"sl-feature-grid sl-cols-" + columns}>
      {items.map(({ icon, title, description }) => (
        <article className="sl-feature-card" key={title}>
          <span className="sl-feature-icon" aria-hidden="true">{icon}</span>
          <h3>{title}</h3>
          <p>{description}</p>
        </article>
      ))}
    </div>
  );
}

export function PortalCards({ withImages = false }: { withImages?: boolean }) {
  return (
    <div className={"sl-portals" + (withImages ? " sl-portals-images" : "")}>
      {rolePortals.map((portal) => (
        <article key={portal.name} className="sl-portal-card">
          {withImages && (
            <div className="sl-portal-image">
              <Image src={portal.image} alt={portal.imageAlt} fill sizes="(max-width: 680px) 100vw, (max-width: 1100px) 50vw, 25vw" />
            </div>
          )}
          <div className="sl-portal-card-body">
            <span className="sl-portal-icon" aria-hidden="true">{portal.icon}</span>
            <h3>{portal.name}</h3>
            <p>{portal.copy}</p>
            <Link href={portal.href}>{portal.label} <span aria-hidden="true">↗</span></Link>
          </div>
        </article>
      ))}
    </div>
  );
}

export function FAQ({
  items,
}: {
  items: { question: string; answer: string }[];
}) {
  return (
    <div className="sl-faq-list">
      {items.map((item) => (
        <details key={item.question}>
          <summary>{item.question}<span aria-hidden="true">+</span></summary>
          <p>{item.answer}</p>
        </details>
      ))}
    </div>
  );
}

export function CTA({
  eyebrow = "YOUR NEXT STEP", title, description, primaryHref = "/get-started",
  primaryLabel = "Get started", secondaryHref = "/features",
  secondaryLabel = "Explore features",
}: {
  eyebrow?: string;
  title: string;
  description: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <section className="sl-container sl-cta-wrap">
      <div className="sl-cta">
        <div>
          <span className="sl-label">{eyebrow}</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <div className="sl-actions">
          <SiteButton href={primaryHref} light>{primaryLabel}</SiteButton>
          <Link className="sl-cta-secondary" href={secondaryHref}>{secondaryLabel} ↗</Link>
        </div>
      </div>
    </section>
  );
}
