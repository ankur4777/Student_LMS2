import type { ReactNode } from "react";

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
