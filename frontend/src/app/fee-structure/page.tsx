import type { Metadata } from "next";
import FeeStructureSelector from "./FeeStructureSelector";
import { MarketingHeader } from "@/components/MarketingHeader";

import "../home.css";
import "../home-updates.css";
import "./fee-structure.css";
import "../marketing-typography.css";

export const metadata: Metadata = {
  title: "Online Tutoring Fees in Canada & Australia",
  description:
    "Explore MySLS hourly tuition rates for Grades 7–12, including one-to-one tutoring, group classes, homework help and assignment support in Canada and Australia.",
  keywords: ["online tutoring fees Canada", "group tuition prices", "one-to-one tutoring rates", "Grades 7–12", "MySLS"],
  openGraph: {
    title: "Online Tutoring Fees in Canada & Australia | MySLS",
    description: "Compare Canadian hourly rates for individual and group tutoring, or request Australian tuition pricing from MySLS.",
  },
};

export default function FeeStructurePage() {
  return (
    <>
      <div className="lms-landing lms-fees-marketing-header">
        <MarketingHeader />
      </div>
      <FeeStructureSelector />
    </>
  );
}
