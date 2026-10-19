import type { ReactNode } from "react";
import type { Metadata } from "next";

// Login and private portal routes must not appear in public search results.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

import "./teacher-ui.css";

export default function TeacherLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return <div className="teacher-ui-scope">{children}</div>;
}
