import type { ReactNode } from "react";
import type { Metadata } from "next";

// Login and private portal routes must not appear in public search results.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

import "./parent-ui.css";

export default function ParentLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return <div className="parent-ui-scope">{children}</div>;
}
