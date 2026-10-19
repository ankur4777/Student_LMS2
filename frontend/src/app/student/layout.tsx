import type { ReactNode } from "react";
import type { Metadata } from "next";

// Login and private portal routes must not appear in public search results.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

import "./student-ui.css";
import FloatingTutorChatButton from "@/components/student/FloatingTutorChatButton";

export default function StudentLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div className="student-ui-scope">
      {children}
      <FloatingTutorChatButton />
    </div>
  );
}
