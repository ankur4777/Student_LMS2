import Link from "next/link";

import "./home.css";

const SHABDD_INNOVATIONS_LOGO = "data:image/png;base64,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";

type Portal = {
  title: string;
  description: string;
  href: string;
  icon: "student" | "teacher" | "parent" | "admin";
};

const portals: Portal[] = [
  {
    title: "Student",
    description:
      "Access classes, assignments, results, attendance and learning resources.",
    href: "/student/login",
    icon: "student",
  },
  {
    title: "Teacher",
    description:
      "Manage classes, assignments, attendance, exams and student learning.",
    href: "/teacher/login",
    icon: "teacher",
  },
  {
    title: "Parent",
    description:
      "Follow your child’s academic progress, notices, results and attendance.",
    href: "/parent/login",
    icon: "parent",
  },
  {
    title: "College Admin",
    description:
      "Manage students, teachers, academics, fees, access and institution setup.",
    href: "/college-admin/login",
    icon: "admin",
  },
];

function PortalIcon({ type }: { type: Portal["icon"] }) {
  if (type === "student") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 9.2 12 5l9 4.2-9 4.2L3 9.2Z" />
        <path d="M7 11.4V16c2.9 2.1 7.1 2.1 10 0v-4.6" />
        <path d="M21 9.2V15" />
      </svg>
    );
  }

  if (type === "teacher") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="8" cy="7" r="3" />
        <path d="M2.5 19c.6-3.6 2.4-5.5 5.5-5.5s4.9 1.9 5.5 5.5" />
        <path d="M14 5h7v9h-6" />
        <path d="m15.5 10 2-2 2 2" />
      </svg>
    );
  }

  if (type === "parent") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="8" cy="7" r="3" />
        <circle cx="17" cy="8" r="2.4" />
        <path d="M2.5 19c.6-3.6 2.4-5.5 5.5-5.5s4.9 1.9 5.5 5.5" />
        <path d="M13.5 18c.4-2.6 1.7-4 3.8-4 2 0 3.3 1.4 3.7 4" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 7h8M8 11h8M8 15h3M14 15h2" />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="lms-home">
      <div className="lms-home-glow lms-home-glow-one" />
      <div className="lms-home-glow lms-home-glow-two" />

      <section className="lms-home-shell">
        <header className="lms-home-header">
          <Link href="/" className="lms-home-brand" aria-label="Shabdd LMS home">
            <img
              className="lms-home-brand-logo"
              src={SHABDD_INNOVATIONS_LOGO}
              alt="Shabdd Innovations"
            />
            <span>
              <strong>Shabdd LMS</strong>
              <small>Student Learning Management System</small>
            </span>
          </Link>

          <span className="lms-home-secure">
            <span className="lms-home-secure-dot" />
            Secure portal access
          </span>
        </header>

        <div className="lms-home-hero">
          <div className="lms-home-copy">
            <span className="lms-home-eyebrow">WELCOME TO SHABDD LMS</span>
            <h1>Your college. Your learning. One connected platform.</h1>
            <p>
              Choose your portal below to securely access your dashboard.
              You can sign in using your username or registered email address.
            </p>

            <div className="lms-home-highlights">
              <span>Academic management</span>
              <span>Assignments & exams</span>
              <span>Notices & notifications</span>
            </div>
          </div>

          <div className="lms-home-panel">
            <div className="lms-home-panel-head">
              <div>
                <span className="lms-home-panel-label">PORTAL ACCESS</span>
                <h2>Login as</h2>
                <p>Select your role to continue.</p>
              </div>
              <div className="lms-home-panel-badge">LMS</div>
            </div>

            <div className="lms-home-portals">
              {portals.map((portal) => (
                <Link
                  className="lms-home-portal-card"
                  href={portal.href}
                  key={portal.href}
                >
                  <span className="lms-home-portal-icon">
                    <PortalIcon type={portal.icon} />
                  </span>

                  <span className="lms-home-portal-content">
                    <strong>{portal.title}</strong>
                    <small>{portal.description}</small>
                  </span>

                  <span className="lms-home-portal-arrow" aria-hidden="true">
                    →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <footer className="lms-home-footer">
          <span>© {new Date().getFullYear()} Shabdd LMS</span>
          <span className="lms-home-credit">
            Designed &amp; Developed by <strong>Shabdd Innovations</strong>
          </span>
        </footer>
      </section>
    </main>
  );
}
