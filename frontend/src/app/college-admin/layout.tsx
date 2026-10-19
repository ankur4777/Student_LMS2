import type { ReactNode } from "react";
import type { Metadata } from "next";

// Login and private portal routes must not appear in public search results.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

import "./college-admin-ui.css";

export default function CollegeAdminLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return <div className="college-admin-ui-scope">{children}</div>;
}
