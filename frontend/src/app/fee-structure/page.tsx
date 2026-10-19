import type { Metadata } from "next";
import FeeStructureSelector from "./FeeStructureSelector";

import "./fee-structure.css";

export const metadata: Metadata = {
  title: "Fee Structure | Canada & Australia | Student LMS",
  description:
    "Select Canada or Australia to view country-specific Student LMS fee categories in CAD or AUD. Confirm current tuition and additional fees with your institution.",
};

export default function FeeStructurePage() {
  return <FeeStructureSelector />;
}
