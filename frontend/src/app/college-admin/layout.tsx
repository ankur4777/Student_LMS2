import "./college-admin-ui.css";

export default function CollegeAdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="college-admin-ui-scope">{children}</div>;
}
