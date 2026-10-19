import type { Metadata } from "next";
import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "MySLS",
  title: {
    default: "ShabddLearningSolution (MySLS) | School LMS & Online Tutoring",
    template: "%s | MySLS",
  },
  description:
    "ShabddLearningSolution (MySLS) offers school and college management software, one-to-one online tutoring, group tuition, homework help and assignment support.",
  keywords: [
    "ShabddLearningSolution",
    "MySLS",
    "school management software",
    "college management system",
    "learning management system",
    "online tutoring Canada",
    "one-to-one tutoring",
    "group online classes",
    "homework help",
  ],
  openGraph: {
    type: "website",
    siteName: "ShabddLearningSolution (MySLS)",
    title: "ShabddLearningSolution (MySLS) | LMS & Online Tutoring",
    description:
      "LMS software for schools and colleges, plus one-to-one and group online tutoring for students.",
  },
  twitter: {
    card: "summary",
    title: "ShabddLearningSolution (MySLS)",
    description: "School and college LMS software and online tutoring.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
