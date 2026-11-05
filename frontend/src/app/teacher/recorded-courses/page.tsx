"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TeacherSidebar from "@/components/teacher/TeacherSidebar";
import TeacherTopbar from "@/components/teacher/TeacherTopbar";
import "../../teacher/dashboard/dashboard.css";

type Course = {
  id: number;
  title: string;
  description: string;
  module_count: number;
  lesson_count: number;
};
type TeacherUser = { name?: string; username?: string; organization?: string };
type SortOrder = "assigned" | "title_asc" | "title_desc" | "most_lessons";
const API = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");

export default function TeacherLearningCoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [user, setUser] = useState<TeacherUser>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadIndex, setReloadIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("assigned");

  useEffect(() => {
    try {
      setUser(JSON.parse(localStorage.getItem("teacher_user") || "{}"));
    } catch {
      setUser({});
    }

    const token = localStorage.getItem("teacher_access_token");
    if (!token) {
      router.replace("/teacher/login");
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError("");

    const loadCourses = async () => {
      try {
        const response = await fetch(`${API}/api/recorded-courses/learning/manage/courses/`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.status === 401) {
          router.replace("/teacher/login");
          return;
        }

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result.detail || "Unable to access learning courses.");
        }
        if (!controller.signal.aborted) {
          setCourses(Array.isArray(result.courses) ? result.courses : []);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Unable to load courses.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void loadCourses();
    return () => controller.abort();
  }, [router, reloadIndex]);

  const visibleCourses = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const matched = courses.filter(course =>
      `${course.title} ${course.description || ""}`.toLocaleLowerCase().includes(query)
    );
    if (sortOrder === "title_asc") {
      return [...matched].sort((a, b) => a.title.localeCompare(b.title));
    }
    if (sortOrder === "title_desc") {
      return [...matched].sort((a, b) => b.title.localeCompare(a.title));
    }
    if (sortOrder === "most_lessons") {
      return [...matched].sort((a, b) => b.lesson_count - a.lesson_count);
    }
    return matched;
  }, [courses, search, sortOrder]);

  const clearFilters = () => {
    setSearch("");
    setSortOrder("assigned");
  };

  return (
    <div className="teacher-dashboard">
      <TeacherSidebar />
      <main className="teacher-dashboard-main">
        <TeacherTopbar
          name={user.name || user.username || "Teacher"}
          organization={user.organization || ""}
        />
        <div className="teacher-dashboard-content">
          <div className="container-fluid">
            <div className="mb-4">
              <h1 className="h3 fw-bold">My Recorded Learning Courses</h1>
              <p className="text-muted">
                Manage course modules, video lessons and study notes for your students.
              </p>
            </div>

            {loading && (
              <div className="alert alert-info" role="status">
                Loading assigned courses...
              </div>
            )}

            {!loading && error && (
              <div className="alert alert-danger d-flex flex-wrap align-items-center justify-content-between gap-2" role="alert">
                <span>{error}</span>
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm"
                  onClick={() => setReloadIndex(index => index + 1)}
                >
                  Retry loading courses
                </button>
              </div>
            )}

            {!loading && !error && courses.length === 0 && (
              <div className="card p-4 text-muted">
                No learning courses have been assigned to you yet. Ask your College Admin to assign a course.
              </div>
            )}

            {!loading && !error && courses.length > 0 && (
              <>
                <div className="card mb-4">
                  <div className="card-body">
                    <div className="row g-3 align-items-end">
                      <div className="col-md-6">
                        <label className="form-label" htmlFor="teacher-course-search">
                          Search assigned courses
                        </label>
                        <input
                          id="teacher-course-search"
                          className="form-control"
                          type="search"
                          placeholder="Course name or description"
                          value={search}
                          onChange={event => setSearch(event.target.value)}
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label" htmlFor="teacher-course-sort">
                          Sort assigned courses
                        </label>
                        <select
                          id="teacher-course-sort"
                          className="form-select"
                          value={sortOrder}
                          onChange={event => setSortOrder(event.target.value as SortOrder)}
                        >
                          <option value="assigned">Assigned order</option>
                          <option value="title_asc">Title A–Z</option>
                          <option value="title_desc">Title Z–A</option>
                          <option value="most_lessons">Most lessons</option>
                        </select>
                      </div>
                      <div className="col-md-2">
                        <button
                          type="button"
                          className="btn btn-outline-secondary w-100"
                          onClick={clearFilters}
                          disabled={!search && sortOrder === "assigned"}
                        >
                          Clear filters
                        </button>
                      </div>
                    </div>
                    <p className="small text-muted mb-0 mt-3" role="status">
                      Showing {visibleCourses.length} of {courses.length} assigned courses
                    </p>
                  </div>
                </div>

                {visibleCourses.length === 0 ? (
                  <div className="card p-4">
                    <h2 className="h5">No matching courses</h2>
                    <p className="text-muted mb-3">
                      Try a different course title or description.
                    </p>
                    <div>
                      <button type="button" className="btn btn-outline-primary" onClick={clearFilters}>
                        Clear course filters
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="row g-3">
                    {visibleCourses.map(course => (
                      <div className="col-md-6 col-xl-4" key={course.id}>
                        <div className="card h-100 border-0 shadow-sm">
                          <div className="card-body d-flex flex-column">
                            <h2 className="h5 fw-semibold">{course.title}</h2>
                            <p className="small text-muted">
                              {course.description || "Recorded learning"}
                            </p>
                            <p className="small mt-auto">
                              {course.module_count} modules · {course.lesson_count} lessons
                            </p>
                            <div>
                              <Link
                                className="btn btn-outline-primary"
                                href={`/teacher/recorded-courses/${course.id}`}
                              >
                                Manage course
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
