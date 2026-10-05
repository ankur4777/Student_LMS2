"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import StudentSidebar from "@/components/student/studentsidebar";
import StudentTopbar from "@/components/student/studentTopbar";
import StudentFeatureRestricted, {
  isClassFeatureRestricted,
} from "@/components/student/StudentFeatureRestricted";

import "../../dashboard/dashboard.css";
import "../recorded-courses.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

type Lesson = {
  id: number;
  title: string;
  description: string;
  position: number;
};

type Course = {
  id: number;
  title: string;
  description: string;
  access_expires_at: string | null;
  lessons: Lesson[];
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

export default function PurchasedCoursePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const courseId = params.id;

  const [student, setStudent] = useState<any>({});
  const [course, setCourse] = useState<Course | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [videoLoading, setVideoLoading] = useState(false);
  const [error, setError] = useState("");
  const currentUrl = useRef("");

  useEffect(() => {
    try {
      setStudent(
        JSON.parse(localStorage.getItem("student_user") || "{}")
      );
    } catch {
      setStudent({});
    }

    const token = localStorage.getItem("student_access_token");

    if (!token) {
      router.replace("/student/login");
      return;
    }

    let active = true;

    async function loadCourse() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `${API_BASE}/api/recorded-courses/student/my-courses/${courseId}/`,
          {
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          }
        );

        if (response.status === 401) {
          router.replace("/student/login");
          return;
        }

        const result = await readJsonSafely(response);

        if (!response.ok) {
          throw new Error(
            (result as { detail?: string }).detail ||
              "Unable to open course."
          );
        }

        const nextCourse = (result as { course?: Course }).course;

        if (!nextCourse) {
          throw new Error("Course details are unavailable.");
        }

        if (active) {
          setCourse(nextCourse);
          setSelected(nextCourse.lessons?.[0]?.id ?? null);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to open course."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadCourse();

    return () => {
      active = false;

      if (currentUrl.current) {
        URL.revokeObjectURL(currentUrl.current);
        currentUrl.current = "";
      }
    };
  }, [courseId, router]);

  useEffect(() => {
    if (!selected) {
      setVideoUrl("");
      return;
    }

    const token = localStorage.getItem("student_access_token");

    if (!token) {
      return;
    }

    let active = true;

    async function loadVideo() {
      setVideoLoading(true);
      setError("");

      try {
        const response = await fetch(
          `${API_BASE}/api/recorded-courses/student/lessons/${selected}/play/`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          }
        );

        if (!response.ok) {
          const result = await readJsonSafely(response);
          throw new Error(
            (result as { detail?: string }).detail ||
              "Unable to play this lesson."
          );
        }

        const blob = await response.blob();

        if (!active) {
          return;
        }

        if (currentUrl.current) {
          URL.revokeObjectURL(currentUrl.current);
        }

        const nextUrl = URL.createObjectURL(blob);
        currentUrl.current = nextUrl;
        setVideoUrl(nextUrl);
      } catch (err) {
        if (active) {
          setVideoUrl("");
          setError(
            err instanceof Error
              ? err.message
              : "Unable to play this lesson."
          );
        }
      } finally {
        if (active) {
          setVideoLoading(false);
        }
      }
    }

    void loadVideo();

    return () => {
      active = false;
    };
  }, [selected]);

  const selectedIndex = useMemo(
    () => course?.lessons.findIndex((lesson) => lesson.id === selected) ?? -1,
    [course, selected]
  );

  const lesson =
    selectedIndex >= 0 ? course?.lessons[selectedIndex] : undefined;

  const totalLessons = course?.lessons.length || 0;
  const position = selectedIndex >= 0 ? selectedIndex + 1 : 0;
  const lessonProgress =
    totalLessons > 0 ? Math.round((position / totalLessons) * 100) : 0;

  const accessDate = course?.access_expires_at
    ? new Date(course.access_expires_at).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  const selectPreviousLesson = () => {
    if (!course || selectedIndex <= 0) {
      return;
    }

    setSelected(course.lessons[selectedIndex - 1].id);
  };

  const selectNextLesson = () => {
    if (!course || selectedIndex < 0 || selectedIndex >= totalLessons - 1) {
      return;
    }

    setSelected(course.lessons[selectedIndex + 1].id);
  };

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
            ) : loading ? (
              <div className="dashboard-panel">
                <div className="empty-state">
                  Loading purchased course...
                </div>
              </div>
            ) : error && !course ? (
              <div className="alert alert-danger">{error}</div>
            ) : course ? (
              <div className="recorded-page">
                <div className="recorded-page-header">
                  <div>
                    <div className="recorded-page-kicker">
                      Student Portal · Recorded Course
                    </div>
                    <Link
                      href="/student/recorded-courses"
                      className="recorded-back-button"
                    >
                      ← Back to Recorded Courses
                    </Link>
                  </div>
                </div>

                <section className="recorded-course-hero">
                  <div className="recorded-course-hero-copy">
                    <div className="recorded-page-kicker">
                      Your learning library
                    </div>
                    <h1>{course.title}</h1>
                    <p>
                      {course.description ||
                        "Work through the recorded lessons at your own pace."}
                    </p>
                  </div>

                  <div className="recorded-course-hero-meta">
                    <span className="recorded-course-pill">
                      {totalLessons} {totalLessons === 1 ? "Lesson" : "Lessons"}
                    </span>

                    {position > 0 && (
                      <span className="recorded-course-pill">
                        Lesson {position} of {totalLessons}
                      </span>
                    )}

                    {accessDate && (
                      <span className="recorded-course-pill access">
                        Access until {accessDate}
                      </span>
                    )}
                  </div>
                </section>

                {error && (
                  <div className="alert alert-danger recorded-course-error">
                    {error}
                  </div>
                )}

                <div className="recorded-viewer-layout">
                  <section className="recorded-player-card">
                    <div className="recorded-player-head">
                      <div>
                        <small>Now Playing</small>
                        <h2>{lesson?.title || "Select a lesson"}</h2>
                      </div>

                      {position > 0 && (
                        <span className="recorded-lesson-counter">
                          {position}/{totalLessons}
                        </span>
                      )}
                    </div>

                    <div className="recorded-video-shell">
                      {videoLoading ? (
                        <div className="recorded-video-state">
                          <div>
                            <div className="recorded-video-spinner" />
                            <strong>Loading secure video...</strong>
                          </div>
                        </div>
                      ) : videoUrl ? (
                        <video
                          key={videoUrl}
                          controls
                          controlsList="nodownload"
                          disablePictureInPicture
                          onContextMenu={(event) => event.preventDefault()}
                          src={videoUrl}
                        />
                      ) : (
                        <div className="recorded-video-state">
                          <div>
                            <strong>Video unavailable</strong>
                            <div className="mt-1 text-white-50">
                              Select another lesson or refresh the page.
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="recorded-lesson-info">
                      <p>
                        {lesson?.description ||
                          "Select a lesson from the course content to begin watching."}
                      </p>

                      <div className="recorded-lesson-nav">
                        <button
                          type="button"
                          onClick={selectPreviousLesson}
                          disabled={selectedIndex <= 0}
                        >
                          ← Previous lesson
                        </button>

                        <button
                          type="button"
                          onClick={selectNextLesson}
                          disabled={
                            selectedIndex < 0 ||
                            selectedIndex >= totalLessons - 1
                          }
                        >
                          Next lesson →
                        </button>
                      </div>
                    </div>
                  </section>

                  <aside className="recorded-lessons-card">
                    <div className="recorded-lessons-head">
                      <div className="recorded-lessons-head-row">
                        <h2>Course Content</h2>
                        <span>{totalLessons} lessons</span>
                      </div>

                      <div
                        className="recorded-progress"
                        aria-label="Current lesson position"
                      >
                        <div style={{ width: `${lessonProgress}%` }} />
                      </div>
                    </div>

                    <div className="recorded-lesson-list">
                      {course.lessons.length === 0 ? (
                        <div className="recorded-empty-card">
                          No lessons have been added yet.
                        </div>
                      ) : (
                        course.lessons.map((item, index) => (
                          <button
                            key={item.id}
                            type="button"
                            className={
                              "recorded-lesson-item " +
                              (selected === item.id ? "active" : "")
                            }
                            onClick={() => setSelected(item.id)}
                          >
                            <span className="recorded-lesson-number">
                              {index + 1}
                            </span>

                            <span className="recorded-lesson-copy">
                              <strong>{item.title}</strong>
                              <span>
                                {item.description ||
                                  `Lesson ${index + 1}`}
                              </span>
                            </span>

                            <span className="recorded-lesson-arrow">›</span>
                          </button>
                        ))
                      )}
                    </div>
                  </aside>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
