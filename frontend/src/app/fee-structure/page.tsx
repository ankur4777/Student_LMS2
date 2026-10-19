import type { Metadata } from "next";
import FeeStructureSelector from "./FeeStructureSelector";

import "./fee-structure.css";

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
  return <FeeStructureSelector />;
}
