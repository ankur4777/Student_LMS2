import Link from "next/link";

export default function StudentSidebar() {
  return (
    <aside className="student-sidebar">
      <div className="sidebar-brand">
        <div className="brand-logo">LMS</div>

        <div>
          <h5>Student LMS</h5>
          <small>Learning Portal</small>
        </div>
      </div>

      <nav className="sidebar-nav">
        <Link href="/student/dashboard" className="active">
          Dashboard
        </Link>

        <Link href="#">
          My Classes
        </Link>

        <Link href="#">
          Recorded Classes
        </Link>

        <Link href="#">
          Attendance
        </Link>

        <Link href="/student/assignments">
          Assignments
        </Link>

        <Link href="/student/results">
          Results
        </Link>

        <Link href="#">
          Documents
        </Link>

        <Link href="#">
          Notifications
        </Link>
      </nav>
    </aside>
  );
}