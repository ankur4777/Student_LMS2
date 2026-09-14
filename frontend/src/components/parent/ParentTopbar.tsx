interface ParentTopbarProps {
  name: string;
  organization?: string;
}

export default function ParentTopbar({
  name,
  organization,
}: ParentTopbarProps) {
  return (
    <header className="student-topbar">
      <div>
        <h4 className="mb-1 fw-bold">
          Parent Dashboard
        </h4>

        <p className="text-muted mb-0">
          Welcome back, {name}
        </p>
      </div>

      {organization && (
        <div className="text-muted">
          {organization}
        </div>
      )}
    </header>
  );
}