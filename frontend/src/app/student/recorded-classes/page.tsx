"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import StudentSidebar from "@/components/student/studentsidebar";
import StudentTopbar from "@/components/student/studentTopbar";
import StudentFeatureRestricted, {
  isClassFeatureRestricted,
} from "@/components/student/StudentFeatureRestricted";
import { useCurrency } from "@/hooks/useCurrency";
import { formatTime12Hour } from "@/utils/time";

import "../dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

type StudentUser = {
  username?: string;
  name?: string;
  organization?: string;
};

type RecordedClass = {
  id: number;
  title: string;
  class_date: string;
  start_time: string;
  end_time: string;
  teacher_name: string;
  subject_name: string;
  section_name: string;
  recording_public_id: string | null;
  recording_price: string | null;
  recording_access_duration_days: number | null;
  recording_price_configured: boolean;
  recording_has_access: boolean;
  recording_access_expires_at: string | null;
  recording_purchase_status: string | null;
  recording_playback_url: string | null;
};

type PurchasedCourse = {
  id: number;
  title: string;
  description: string;
  access_expires_at: string | null;
  lessons: {
    id: number;
    title: string;
    description: string;
    position: number;
    is_active: boolean;
  }[];
};

function RecordedCourseThumbnail({
  lessonId,
}: {
  lessonId?: number;
}) {
  const [videoUrl, setVideoUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!lessonId) {
      setFailed(true);
      return;
    }

    let active = true;
    let objectUrl = "";

    async function loadThumbnailVideo() {
      const token = localStorage.getItem("student_access_token");

      if (!token) {
        setFailed(true);
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE}/api/recorded-courses/student/lessons/${lessonId}/play/`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error("Unable to load course preview.");
        }

        const blob = await response.blob();

        if (!active) {
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        setVideoUrl(objectUrl);
      } catch {
        if (active) {
          setFailed(true);
        }
      }
    }

    void loadThumbnailVideo();

    return () => {
      active = false;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [lessonId]);

  if (!lessonId || failed) {
  return (
      <div
        className="recorded-course-thumbnail recorded-course-thumbnail-fallback"
        aria-hidden="true"
      />
    );
  }

  if (!videoUrl) {
    return (
      <div
        className="recorded-course-thumbnail recorded-course-thumbnail-loading"
        aria-hidden="true"
      >
        <span>Loading preview...</span>
      </div>
    );
  }

  return (
    <video
      className="recorded-course-thumbnail"
      src={videoUrl}
      muted
      playsInline
      preload="metadata"
      tabIndex={-1}
      aria-hidden="true"
      onLoadedMetadata={(event) => {
        const video = event.currentTarget;

        if (Number.isFinite(video.duration) && video.duration > 0.2) {
          video.currentTime = Math.min(0.5, video.duration / 10);
        }
      }}
      onError={() => setFailed(true)}
    />
  );
}

function getSavedStudent(): StudentUser {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    return JSON.parse(localStorage.getItem("student_user") || "{}");
  } catch {
    return {};
  }
}

export default function StudentRecordedClassesPage() {
  const router = useRouter();
  const [student] = useState<StudentUser>(getSavedStudent);
  const [classes, setClasses] = useState<RecordedClass[]>([]);
  const [courses, setCourses] = useState<PurchasedCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyRecording, setBusyRecording] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const { formatCurrency: money } = useCurrency();

  useEffect(() => {
    const token = localStorage.getItem("student_access_token");

    if (!token) {
      router.replace("/student/login");
      return;
    }

    const clearSession = () => {
      localStorage.removeItem("student_access_token");
      localStorage.removeItem("student_refresh_token");
      localStorage.removeItem("student_user");
    };

    async function load() {
      try {
        setLoading(true);
        setError("");

        const headers = {
          Authorization: `Bearer ${token}`,
        };

        const [recordingsResponse, coursesResponse] = await Promise.all([
          fetch(`${API_BASE}/api/live-classes/student/recorded/`, {
            headers,
          }),
          fetch(`${API_BASE}/api/recorded-courses/student/my-courses/`, {
            headers,
          }),
        ]);

        if (
          recordingsResponse.status === 401 ||
          coursesResponse.status === 401
        ) {
          clearSession();
          router.replace("/student/login");
          return;
        }

        const recordingsResult = await recordingsResponse.json();

        if (!recordingsResponse.ok) {
          throw new Error(
            recordingsResult.detail || "Unable to load recorded classes."
          );
        }

        setClasses(recordingsResult || []);

        const coursesResult = await coursesResponse.json();

        if (coursesResponse.ok) {
          setCourses(coursesResult.courses || []);
        } else if (isClassFeatureRestricted(coursesResult?.detail || "")) {
          // Recorded Courses can be restricted independently from
          // regular class recordings.
          setCourses([]);
        } else {
          throw new Error(
            coursesResult.detail || "Unable to load purchased courses."
          );
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load recordings."
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [refreshIndex, router]);

  async function purchaseRecording(publicId: string) {
    const token = localStorage.getItem("student_access_token");

    if (!token) {
      router.replace("/student/login");
      return;
    }

    setBusyRecording(publicId);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/api/recorded-courses/student/recorded-class-purchases/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recording_public_id: publicId,
          }),
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result?.detail || "Unable to purchase this recorded class."
        );
      }

      setRefreshIndex((value) => value + 1);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to purchase this recorded class."
      );
    } finally {
      setBusyRecording(null);
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
              <StudentFeatureRestricted featureName="Recorded Classes" />
            ) : (
              <>
                <section className="dashboard-panel recorded-library-panel mb-4">
                  <div className="recorded-library-heading">
                    <div className="recorded-library-title-wrap">
                      <div className="recorded-library-icon" aria-hidden="true">
                        ▶
                      </div>
                      <div className="recorded-library-text">
                        <span className="recorded-library-kicker">
                          MY LEARNING LIBRARY
                        </span>
                        <h5>Purchased Recorded Courses</h5>
                        <p>
                          Continue learning from courses unlocked after payment verification.
                        </p>
                      </div>
                    </div>

                    <div className="recorded-library-count">
                      <strong>{courses.length}</strong>
                      <span>{courses.length === 1 ? "Course" : "Courses"}</span>
                    </div>
                  </div>

                  {loading && (
                    <div className="recorded-library-empty">
                      Loading your recorded courses...
                    </div>
                  )}

                  {error && <div className="alert alert-danger">{error}</div>}

                  {!loading && !error && courses.length === 0 && (
                    <div className="recorded-library-empty">
                      <div className="recorded-empty-icon" aria-hidden="true">
                        ▶
                      </div>
                      <strong>No purchased courses yet</strong>
                      <span>
                        Purchased recorded courses with active access will appear here.
                      </span>
                    </div>
                  )}

                  {!loading && !error && courses.length > 0 && (
                    <div
                      className={`recorded-course-grid${courses.length === 1 ? " recorded-course-grid-single" : ""}`}
                    >
                      {courses.map((course) => (
                        <article className="recorded-course-card" key={course.id}>
                          <div className="recorded-course-cover">
                            <RecordedCourseThumbnail
                              lessonId={course.lessons[0]?.id}
                            />
                            <div
                              className="recorded-course-cover-shade"
                              aria-hidden="true"
                            />
                            <div className="recorded-course-play" aria-hidden="true">
                              ▶
                            </div>
                            <span className="recorded-course-type">
                              Recorded Course
                            </span>
                          </div>

                          <div className="recorded-course-body">
                            <div className="recorded-course-copy">
                              <h3>{course.title}</h3>
                              <p>
                                {course.description ||
                                  "Watch your lessons anytime during the active access period."}
                              </p>
                            </div>

                            <div className="recorded-course-meta">
                              <div>
                                <span>Lessons</span>
                                <strong>{course.lessons.length}</strong>
                              </div>
                              <div>
                                <span>Access</span>
                                <strong>
                                  {course.access_expires_at
                                    ? new Date(
                                        course.access_expires_at
                                      ).toLocaleDateString()
                                    : "Active"}
                                </strong>
                              </div>
                            </div>

                            <Link
                              href={`/student/recorded-courses/${course.id}`}
                              className="recorded-course-open"
                            >
                              <span>Open Course</span>
                              <span aria-hidden="true">→</span>
                            </Link>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>

                <div className="dashboard-panel">
                  <div className="panel-heading">
                    <div>
                      <h5 className="mb-1">Class Recordings</h5>
                      <small className="text-muted">
                        Recordings from your regular live classes.
                      </small>
                    </div>
                    <span className="badge bg-primary">{classes.length}</span>
                  </div>

                  {!loading && !error && classes.length === 0 && (
                    <div className="text-muted mt-3 mb-2">
                      No class recordings found.
                    </div>
                  )}

                  {!loading && !error && classes.length > 0 && (
                    <div className="row g-3">
                      {classes.map((recording) => (
                        <div
                          key={recording.id}
                          className="col-lg-4 col-md-6"
                        >
                          <div className="border rounded p-3 h-100 recorded-class-card">
                            <h6 className="fw-bold mb-2">{recording.title}</h6>
                            <p className="text-muted small mb-2">
                              {recording.subject_name} •{" "}
                              {recording.section_name}
                            </p>
                            <div className="recorded-class-details">
                              <p className="small mb-1">
                                <span className="text-muted">Teacher:</span>{" "}
                                {recording.teacher_name || "-"}
                              </p>
                              <p className="small mb-1">
                                <span className="text-muted">Date:</span>{" "}
                                {recording.class_date}
                              </p>
                              <p className="small mb-0">
                                <span className="text-muted">Time:</span>{" "}
                                {formatTime12Hour(recording.start_time)} -{" "}
                                {formatTime12Hour(recording.end_time)}
                              </p>
                            </div>

                            {recording.recording_has_access &&
                            recording.recording_public_id ? (
                              <>
                                {recording.recording_access_expires_at && (
                                  <div className="small text-success mb-2">
                                    Access until{" "}
                                    {new Date(
                                      recording.recording_access_expires_at
                                    ).toLocaleDateString()}
                                  </div>
                                )}
                                <Link
                                  href={`/student/recordings/${recording.recording_public_id}`}
                                  className="btn btn-primary btn-sm"
                                >
                                  Watch Recording
                                </Link>
                              </>
                            ) : recording.recording_purchase_status ===
                              "pending" ? (
                              <div className="alert alert-warning py-2 mb-0">
                                Purchase Pending Verification
                              </div>
                            ) : recording.recording_price_configured &&
                              recording.recording_public_id ? (
                              <div className="mt-auto">
                                <div className="d-flex justify-content-between align-items-center gap-3 mb-2">
                                  <div>
                                    <div className="text-muted small">Price</div>
                                    <div className="fw-bold">
                                      {money(recording.recording_price || 0)}
                                    </div>
                                  </div>
                                  <div className="text-end">
                                    <div className="text-muted small">Access</div>
                                    <div className="fw-semibold">
                                      {recording.recording_access_duration_days ||
                                        180}{" "}
                                      days
                                    </div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm w-100"
                                  disabled={
                                    busyRecording ===
                                    recording.recording_public_id
                                  }
                                  onClick={() =>
                                    void purchaseRecording(
                                      recording.recording_public_id as string
                                    )
                                  }
                                >
                                  {busyRecording ===
                                  recording.recording_public_id
                                    ? "Processing..."
                                    : Number(recording.recording_price || 0) === 0
                                      ? "Get Access"
                                      : "Purchase Recording"}
                                </button>
                              </div>
                            ) : (
                              <div className="small text-muted mt-auto">
                                Purchase price has not been configured yet.
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
