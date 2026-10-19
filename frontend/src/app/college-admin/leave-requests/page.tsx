"use client";

import { useState } from "react";
import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";
import LeaveQueue from "@/components/leave-requests/LeaveQueue";
import "../../teacher/dashboard/dashboard.css";
import "../../leave-requests.css";

type Admin = {name?: string; username?: string; organization?: string};
function getAdmin(): Admin {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem("college_admin_user") || "{}"); }
  catch { return {}; }
}

export default function CollegeAdminLeaveRequestsPage() {
  const [admin] = useState<Admin>(getAdmin);
  return (
    <div className="teacher-dashboard">
      <CollegeAdminSidebar />
      <main className="teacher-dashboard-main">
        <CollegeAdminTopbar name={admin.name || admin.username || "College Admin"} organization={admin.organization || ""} />
        <div className="teacher-dashboard-content lms-leave-page">
          <LeaveQueue role="college-admin" />
        </div>
      </main>
    </div>
  );
}
