"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import StudentSidebar from "@/components/student/studentsidebar";
import StudentTopbar from "@/components/student/studentTopbar";
import StudentFeatureRestricted, {
  isClassFeatureRestricted,
} from "@/components/student/StudentFeatureRestricted";
import { useCurrency } from "@/hooks/useCurrency";

import "../dashboard/dashboard.css";
import "./recorded-courses.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

type Course = {
  id: number;
  title: string;
  description: string;
  price: string;
  access_duration_days: number;
  lesson_count: number;
  has_access: boolean;
  access_expires_at: string | null;
};

type Purchase = {
  id: number;
  course: {
    id: number;
    title: string;
  };
  amount: string;
  status: string;
  created_at: string;
};

async function readJsonSafely(response: Response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    return {};
  }

  try {
    return await response.json();
  } catch {
    return {};
  }
}

export default function StudentRecordedCoursesPage() {
  const router = useRouter();

  const [student, setStudent] = useState<any>({});
  const [courses, setCourses] = useState<Course[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  const { formatCurrency: money } = useCurrency();

  const load = useCallback(async () => {
    const token = localStorage.getItem("student_access_token");

    if (!token) {
      router.replace("/student/login");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const headers = {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      };

      const [coursesResponse, purchasesResponse] = await Promise.all([
        fetch(
          `${API_BASE}/api/recorded-courses/student/catalog/`,
          {
            headers,
            cache: "no-store",
          }
        ),
        fetch(
          `${API_BASE}/api/recorded-courses/student/purchases/`,
          {
            headers,
            cache: "no-store",
          }
        ),
      ]);

      if (
        coursesResponse.status === 401 ||
        purchasesResponse.status === 401
      ) {
        router.replace("/student/login");
        return;
      }

      const coursesResult = await readJsonSafely(coursesResponse);
      const purchasesResult = await readJsonSafely(purchasesResponse);

      if (!coursesResponse.ok) {
        throw new Error(
          (coursesResult as { detail?: string }).detail ||
            "Unable to load recorded courses."
        );
      }

      if (!purchasesResponse.ok) {
        throw new Error(
          (purchasesResult as { detail?: string }).detail ||
            "Unable to load purchases."
        );
      }

      setCourses(
        (coursesResult as { courses?: Course[] }).courses || []
      );
      setPurchases(
        (purchasesResult as { purchases?: Purchase[] }).purchases || []
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load recorded courses."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    try {
      setStudent(
        JSON.parse(localStorage.getItem("student_user") || "{}")
      );
    } catch {
      setStudent({});
    }

    void load();
  }, [load]);

  const pendingPurchase = (courseId: number) =>
    purchases.find(
      (purchase) =>
        purchase.course.id === courseId &&
        purchase.status === "pending"
    );

  async function purchase(courseId: number) {
    const token = localStorage.getItem("student_access_token");

    if (!token) {
      return;
    }

    setBusy(courseId);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/api/recorded-courses/student/purchases/`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            course_id: courseId,
          }),
        }
      );

      const result = await readJsonSafely(response);

      if (!response.ok) {
        throw new Error(
          (result as { detail?: string }).detail ||
            "Unable to create purchase."
        );
      }

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create purchase."
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="student-dashboard">
      <StudentSidebar />

      <main className="student-dashboard-main">
        <StudentTopbar
          name={student.name || student.username || "Student"}
          organization={student.organization || ""}
        />

        <div className="student-dashboard-content">
          <div className="container-fluid">
            {isClassFeatureRestricted(error) ? (
              <StudentFeatureRestricted featureName="Recorded Courses" />
            ) : (
              <div className="recorded-page">
                <header className="recorded-page-header">
                  <div>
                    <div className="recorded-page-kicker">
                      Learning Library
                    </div>
                    <h1>Recorded Courses</h1>
                    <p>
                      Learn at your own pace with recorded courses offered by
                      your college. Purchased courses stay available for their
                      assigned access period.
                    </p>
                  </div>
                </header>

                {error && (
                  <div className="alert alert-danger mb-0">
                    {error}
                  </div>
                )}

                {loading ? (
                  <div className="dashboard-panel">
                    <div className="empty-state">
                      Loading recorded courses...
                    </div>
                  </div>
                ) : courses.length === 0 ? (
                  <div className="recorded-empty-card">
                    <div>
                      <strong>No recorded courses available</strong>
                      <div className="mt-1">
                        New courses offered by your college will appear here.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="recorded-catalog-grid">
                    {courses.map((course) => {
                      const pending = pendingPurchase(course.id);

                      return (
                        <article
                          className="recorded-catalog-card"
                          key={course.id}
                        >
                          <div className="recorded-catalog-cover">
                            <span className="recorded-catalog-label">
                              Recorded Course
                            </span>
                            <span
                              className="recorded-catalog-play"
                              aria-hidden="true"
                            >
                              ▶
                            </span>
                          </div>

                          <div className="recorded-catalog-body">
                            <h2>{course.title}</h2>
                            <p className="recorded-catalog-description">
                              {course.description || "Recorded course"}
                            </p>

                            <div className="recorded-catalog-meta">
                              <div>
                                <span>Lessons</span>
                                <strong>{course.lesson_count}</strong>
                              </div>
                              <div>
                                <span>Access</span>
                                <strong>
                                  {course.access_duration_days} days
                                </strong>
                              </div>
                            </div>

                            <div className="recorded-catalog-price">
                              {money(course.price)}
                            </div>

                            {course.has_access ? (
                              <button
                                type="button"
                                className="recorded-course-action"
                                onClick={() =>
                                  router.push(
                                    `/student/recorded-courses/${course.id}`
                                  )
                                }
                              >
                                Continue Course
                                <span aria-hidden="true">→</span>
                              </button>
                            ) : pending ? (
                              <div className="recorded-status pending">
                                Purchase Pending Verification
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="recorded-course-action"
                                disabled={busy === course.id}
                                onClick={() => purchase(course.id)}
                              >
                                {busy === course.id
                                  ? "Processing..."
                                  : "Purchase Course"}
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}

                {purchases.length > 0 && (
                  <section className="dashboard-panel">
                    <div className="panel-heading">
                      <div>
                        <h5>My Purchases</h5>
                        <div className="text-muted small mt-1">
                          Track your recorded course purchase status.
                        </div>
                      </div>
                    </div>

                    <div className="table-responsive">
                      <table className="table align-middle mb-0">
                        <thead>
                          <tr>
                            <th>Course</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th>Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {purchases.map((purchase) => (
                            <tr key={purchase.id}>
                              <td className="fw-semibold">
                                {purchase.course.title}
                              </td>
                              <td>{money(purchase.amount)}</td>
                              <td>
                                <span
                                  className={
                                    "badge " +
                                    (purchase.status === "paid"
                                      ? "bg-success"
                                      : purchase.status === "pending"
                                        ? "bg-warning text-dark"
                                        : "bg-secondary")
                                  }
                                >
                                  {purchase.status.toUpperCase()}
                                </span>
                              </td>
                              <td>
                                {new Date(
                                  purchase.created_at
                                ).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
