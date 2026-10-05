import Link from "next/link";

import "./home.css";

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
            <span className="lms-home-brand-mark">S</span>
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
