"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";
import OrganizationLearningAnalytics from "@/components/learning/OrganizationLearningAnalytics";
import "../../teacher/dashboard/dashboard.css";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const COURSE_ENDPOINT = `${API_BASE}/api/recorded-courses/college-admin/courses/`;

type Course = {
  id: number;
  title: string;
  description: string;
  price: string;
  access_duration_days: number;
  is_active: boolean;
  lesson_count: number;
};
type AdminUser = { name?: string; username?: string; organization?: string };
type StatusFilter = "all" | "active" | "inactive";
type SortOrder = "original" | "title_asc" | "title_desc" | "price_asc" | "price_desc" | "most_lessons";
type CourseForm = {
  title: string;
  description: string;
  price: string;
  access_duration_days: string;
  is_active: boolean;
};

const initialForm: CourseForm = {
  title: "",
  description: "",
  price: "",
  access_duration_days: "180",
  is_active: true,
};
const priceFormatter = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

function apiErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const fields = payload as Record<string, unknown>;
  if (typeof fields.detail === "string" && fields.detail.trim()) return fields.detail;
  const messages = Object.values(fields).flatMap(value => Array.isArray(value) ? value : [value])
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  return messages.join("; ") || fallback;
}

export default function RecordedCoursesPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminUser>({});
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [refreshIndex, setRefreshIndex] = useState(0);

  const [form, setForm] = useState<CourseForm>(initialForm);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("original");

  // Restore local-only profile details after hydration, not in the initial render.
  useEffect(() => {
    try {
      setAdmin(JSON.parse(localStorage.getItem("college_admin_user") || "{}"));
    } catch {
      setAdmin({});
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("college_admin_access_token");
    if (!token) {
      router.replace("/college-admin/login");
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setListError("");
    const loadCourses = async () => {
      try {
        const response = await fetch(COURSE_ENDPOINT, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: controller.signal,
        });

        if (response.status === 401) {
          router.replace("/college-admin/login");
          return;
        }

        const payload: unknown = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(apiErrorMessage(payload, "Unable to load recorded courses."));
        const result = payload as { courses?: Course[] };
        if (!controller.signal.aborted) {
          setCourses(Array.isArray(result.courses) ? result.courses : []);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setListError(cause instanceof Error ? cause.message : "Unable to load recorded courses.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void loadCourses();
    return () => controller.abort();
  }, [router, refreshIndex]);

  const activeCount = courses.filter(course => course.is_active).length;
  const inactiveCount = courses.length - activeCount;
  const visibleCourses = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    const filtered = courses.filter(course => {
      if (statusFilter === "active" && !course.is_active) return false;
      if (statusFilter === "inactive" && course.is_active) return false;
      return `${course.title} ${course.description || ""}`.toLocaleLowerCase().includes(term);
    });

    if (sortOrder === "original") return filtered;
    return [...filtered].sort((a, b) => {
      switch (sortOrder) {
        case "title_asc": return a.title.localeCompare(b.title);
        case "title_desc": return b.title.localeCompare(a.title);
        case "price_asc": return Number(a.price) - Number(b.price);
        case "price_desc": return Number(b.price) - Number(a.price);
        case "most_lessons": return b.lesson_count - a.lesson_count;
        default: return 0;
      }
    });
  }, [courses, search, statusFilter, sortOrder]);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setSortOrder("original");
  };

  async function createCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating) return;
    const token = localStorage.getItem("college_admin_access_token");
    if (!token) {
      router.replace("/college-admin/login");
      return;
    }

    setCreating(true);
    setFormError("");
    setFormSuccess("");
    try {
      const response = await fetch(COURSE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          access_duration_days: Number(form.access_duration_days),
        }),
      });
      if (response.status === 401) {
        router.replace("/college-admin/login");
        return;
      }
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiErrorMessage(payload, "Unable to create the course."));

      setForm(initialForm);
      setFormSuccess("Course created successfully.");
      setRefreshIndex(index => index + 1);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Unable to create the course.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="teacher-dashboard">
      <CollegeAdminSidebar />
      <main className="teacher-dashboard-main">
        <CollegeAdminTopbar
          name={admin.name || admin.username || "College Admin"}
          organization={admin.organization || ""}
        />
        <div className="teacher-dashboard-content">
          <div className="container-fluid">
            <div className="mb-4">
              <h2 className="fw-bold mb-1">Recorded Courses</h2>
              <p className="text-muted mb-0">Create paid recorded courses and manage their lessons.</p>
            </div>

            <OrganizationLearningAnalytics />

            <section className="card border-0 shadow-sm mb-4" aria-label="Create recorded course">
              <div className="card-body">
                <h3 className="h5 fw-bold mb-3">Create Recorded Course</h3>
                {formError && <div className="alert alert-danger" role="alert">{formError}</div>}
                {formSuccess && <div className="alert alert-success" role="status">{formSuccess}</div>}
                <form onSubmit={event => void createCourse(event)}>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label" htmlFor="new-course-title">Course Title</label>
                      <input id="new-course-title" required className="form-control"
                        value={form.title} onChange={event => setForm(previous => ({...previous, title: event.target.value}))} />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label" htmlFor="new-course-price">Price (₹)</label>
                      <input id="new-course-price" required min="0" step="0.01" type="number" className="form-control"
                        value={form.price} onChange={event => setForm(previous => ({...previous, price: event.target.value}))} />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label" htmlFor="new-course-duration">Access Duration (Days)</label>
                      <input id="new-course-duration" required min="1" step="1" type="number" className="form-control"
                        value={form.access_duration_days}
                        onChange={event => setForm(previous => ({...previous, access_duration_days: event.target.value}))} />
                    </div>
                    <div className="col-12">
                      <label className="form-label" htmlFor="new-course-description">Description</label>
                      <textarea id="new-course-description" className="form-control" rows={3}
                        value={form.description}
                        onChange={event => setForm(previous => ({...previous, description: event.target.value}))} />
                    </div>
                    <div className="col-12 d-flex justify-content-between align-items-center">
                      <div className="form-check">
                        <input id="new-course-active" className="form-check-input" type="checkbox"
                          checked={form.is_active}
                          onChange={event => setForm(previous => ({...previous, is_active: event.target.checked}))} />
                        <label className="form-check-label" htmlFor="new-course-active">Active</label>
                      </div>
                      <button className="btn btn-primary" type="submit" disabled={creating}>
                        {creating ? "Creating..." : "Create Course"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </section>

            <section className="card border-0 shadow-sm" aria-label="Recorded course management">
              <div className="card-body border-bottom">
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <h3 className="h5 fw-bold mb-0">Courses</h3>
                  {!loading && !listError && (
                    <div className="d-flex gap-2 flex-wrap" aria-label="Course status counts">
                      <span className="badge bg-light text-dark border">Total: {courses.length}</span>
                      <span className="badge bg-success">Active: {activeCount}</span>
                      <span className="badge bg-secondary">Inactive: {inactiveCount}</span>
                    </div>
                  )}
                </div>
              </div>

              {loading ? (
                <div className="p-4 text-muted" role="status">Loading recorded courses...</div>
              ) : listError ? (
                <div className="p-4">
                  <div className="alert alert-danger d-flex align-items-center justify-content-between flex-wrap gap-2 mb-0" role="alert">
                    <span>{listError}</span>
                    <button type="button" className="btn btn-outline-danger btn-sm"
                      onClick={() => setRefreshIndex(index => index + 1)}>Retry loading courses</button>
                  </div>
                </div>
              ) : courses.length === 0 ? (
                <div className="p-4 text-muted">No recorded courses created yet.</div>
              ) : (
                <>
                  <div className="card-body border-bottom">
                    <div className="row g-3 align-items-end">
                      <div className="col-md-5">
                        <label className="form-label" htmlFor="admin-course-search">Search recorded courses</label>
                        <input id="admin-course-search" type="search" className="form-control"
                          placeholder="Course title or description" value={search}
                          onChange={event => setSearch(event.target.value)} />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label" htmlFor="admin-course-status">Filter courses by status</label>
                        <select id="admin-course-status" className="form-select" value={statusFilter}
                          onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
                          <option value="all">All statuses</option>
                          <option value="active">Active only</option>
                          <option value="inactive">Inactive only</option>
                        </select>
                      </div>
                      <div className="col-md-3">
                        <label className="form-label" htmlFor="admin-course-sort">Sort courses</label>
                        <select id="admin-course-sort" className="form-select" value={sortOrder}
                          onChange={event => setSortOrder(event.target.value as SortOrder)}>
                          <option value="original">Default order</option>
                          <option value="title_asc">Title A–Z</option>
                          <option value="title_desc">Title Z–A</option>
                          <option value="price_asc">Price: low to high</option>
                          <option value="price_desc">Price: high to low</option>
                          <option value="most_lessons">Most lessons</option>
                        </select>
                      </div>
                      <div className="col-md-1">
                        <button type="button" className="btn btn-outline-secondary w-100"
                          onClick={clearFilters}
                          disabled={!search && statusFilter === "all" && sortOrder === "original"}>
                          Clear
                        </button>
                      </div>
                    </div>
                    <p className="small text-muted mb-0 mt-3" role="status">
                      Showing {visibleCourses.length} of {courses.length} recorded courses
                    </p>
                  </div>
                  {visibleCourses.length === 0 ? (
                    <div className="p-4">
                      <h4 className="h6 fw-bold">No matching recorded courses</h4>
                      <p className="text-muted">Try another search or status filter.</p>
                      <button type="button" className="btn btn-outline-primary" onClick={clearFilters}>
                        Clear course filters
                      </button>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table align-middle mb-0" aria-label="Recorded courses">
                        <thead>
                          <tr>
                            <th scope="col">Course</th>
                            <th scope="col">Price</th>
                            <th scope="col">Access</th>
                            <th scope="col">Lessons</th>
                            <th scope="col">Status</th>
                            <th scope="col"><span className="visually-hidden">Actions</span></th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleCourses.map(course => (
                            <tr key={course.id}>
                              <td>
                                <div className="fw-semibold">{course.title}</div>
                                <small className="text-muted">{course.description || "No description"}</small>
                              </td>
                              <td>{priceFormatter.format(Number(course.price))}</td>
                              <td>{course.access_duration_days} days</td>
                              <td>{course.lesson_count}</td>
                              <td>
                                <span className={`badge ${course.is_active ? "bg-success" : "bg-secondary"}`}>
                                  {course.is_active ? "Active" : "Inactive"}
                                </span>
                              </td>
                              <td>
                                <Link className="btn btn-outline-primary btn-sm"
                                  href={`/college-admin/recorded-courses/${course.id}`}>
                                  Manage
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
