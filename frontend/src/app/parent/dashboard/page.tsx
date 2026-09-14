"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import ParentSidebar from "@/components/parent/ParentSidebar";
import ParentTopbar from "@/components/parent/ParentTopbar";

import "../../student/dashboard/dashboard.css";

interface ParentUser {
  username?: string;
  name?: string;
  organization?: string;
}

export default function ParentDashboardPage() {
  const router = useRouter();

  const [parent, setParent] = useState<ParentUser>({});

  useEffect(() => {
    const token = localStorage.getItem("parent_access_token");
    const savedParent = localStorage.getItem("parent_user");

    if (!token) {
      router.replace("/parent/login");
      return;
    }

    if (savedParent) {
      try {
        setParent(JSON.parse(savedParent));
      } catch {
        // ignore invalid local storage
      }
    }
  }, [router]);

  return (
    <div className="student-dashboard">
      <ParentSidebar />

      <main className="student-dashboard-main">
        <ParentTopbar
          name={parent.name || parent.username || "Parent"}
          organization={parent.organization || ""}
        />

        <div className="student-dashboard-content">
          <div className="container-fluid">

            <div className="mb-4">
              <h2 className="fw-bold mb-1">
                Parent Dashboard
              </h2>

              <p className="text-muted mb-0">
                Monitor your child's academic progress.
              </p>
            </div>

            <div className="row g-4">

              <div className="col-md-6 col-xl-3">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body p-4">
                    <div className="text-muted small mb-2">
                      Linked Children
                    </div>

                    <h3 className="fw-bold mb-0">
                      -
                    </h3>
                  </div>
                </div>
              </div>

              <div className="col-md-6 col-xl-3">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body p-4">
                    <div className="text-muted small mb-2">
                      Attendance
                    </div>

                    <h3 className="fw-bold mb-0">
                      -
                    </h3>
                  </div>
                </div>
              </div>

              <div className="col-md-6 col-xl-3">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body p-4">
                    <div className="text-muted small mb-2">
                      Pending Assignments
                    </div>

                    <h3 className="fw-bold mb-0">
                      -
                    </h3>
                  </div>
                </div>
              </div>

              <div className="col-md-6 col-xl-3">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body p-4">
                    <div className="text-muted small mb-2">
                      Latest Result
                    </div>

                    <h3 className="fw-bold mb-0">
                      -
                    </h3>
                  </div>
                </div>
              </div>

            </div>

            <div className="card border-0 shadow-sm mt-4">
              <div className="card-body p-4">

                <h5 className="fw-bold mb-3">
                  My Children
                </h5>

                <p className="text-muted mb-0">
                  Linked student details will appear here.
                </p>

              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}