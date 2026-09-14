"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import StudentSidebar from "@/components/student/studentsidebar";
import StudentTopbar from "@/components/student/studentTopbar";
import SecureVideoPlayer from "@/components/student/SecureVideoPlayer";

import "./dashboard.css";


interface StudentInfo {
  username: string;
  name: string;
  admission_number: string;
  organization: string | null;
  classroom: string;
  section: string;
  roll_number: string;
}


interface AttendanceSummary {
  total_classes: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attended_classes: number;
  attendance_percentage: number;
}


interface LiveClass {
  id: number;
  title: string;
  description: string;
  class_date: string;
  start_time: string;
  end_time: string;
  meeting_link: string;
  status: string;
  teacher_name: string;
  subject_name: string;
  section_name: string;
  recording_public_id: string | null;
  recording_playback_url: string | null;
}


interface DashboardData {
  student: StudentInfo;
  attendance: AttendanceSummary;
  today_classes: LiveClass[];
  upcoming_classes: LiveClass[];
  recorded_classes: LiveClass[];
}


export default function StudentDashboard() {
  const router = useRouter();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shareMessage, setShareMessage] = useState("");

  const [selectedRecording, setSelectedRecording] =
    useState<LiveClass | null>(null);

    const handleShareRecording = async (publicId: string) => {
  const shareUrl =
    `${window.location.origin}/student/recordings/${publicId}`;

  try {
    await navigator.clipboard.writeText(shareUrl);

    setShareMessage("Recording link copied!");

    setTimeout(() => {
      setShareMessage("");
    }, 2500);

  } catch (error) {
    console.error(
      "Failed to copy recording link:",
      error
    );

    setShareMessage("Unable to copy recording link.");

    setTimeout(() => {
      setShareMessage("");
    }, 2500);
  }
};


  useEffect(() => {
    async function loadDashboard() {
      const token = localStorage.getItem(
        "student_access_token"
      );

      if (!token) {
        router.replace("/student/login");
        return;
      }

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/accounts/student/dashboard/`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.status === 401) {
          localStorage.removeItem(
            "student_access_token"
          );

          localStorage.removeItem(
            "student_refresh_token"
          );

          localStorage.removeItem(
            "student_user"
          );

          router.replace("/student/login");
          return;
        }

        const result = await response.json();

        if (!response.ok) {
          setError(
            result.detail ||
              "Unable to load dashboard."
          );
          return;
        }

        setData(result);

      } catch {
        setError(
          "Unable to connect to the server."
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();

  }, [router]);


  if (loading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">

        <div
          className="spinner-border text-primary"
          role="status"
        />

      </div>
    );
  }


  if (error) {
    return (
      <div className="container py-5">

        <div className="alert alert-danger">
          {error}
        </div>

      </div>
    );
  }


  if (!data) {
    return null;
  }


  return (
    <div className="student-dashboard">

      {shareMessage && (
  <div className="share-toast">
    {shareMessage}
  </div>
)}

      <StudentSidebar />


      <main className="dashboard-main">

        <StudentTopbar
          name={data.student.name}
        />


        <div className="dashboard-content">

          <div className="container-fluid">


            {/* =========================
                SUMMARY CARDS
            ========================= */}

            <div className="row g-4">


              <div className="col-xl-3 col-md-6">

                <div className="summary-card">

                  <span>
                    Total Classes
                  </span>

                  <h2>
                    {data.attendance.total_classes}
                  </h2>

                  <small>
                    Attendance records
                  </small>

                </div>

              </div>



              <div className="col-xl-3 col-md-6">

                <div className="summary-card">

                  <span>
                    Attendance
                  </span>

                  <h2>
                    {
                      data.attendance
                        .attendance_percentage
                    }%
                  </h2>

                  <small>
                    Overall attendance
                  </small>

                </div>

              </div>



              <div className="col-xl-3 col-md-6">

                <div className="summary-card">

                  <span>
                    Upcoming Classes
                  </span>

                  <h2>
                    {
                      data.upcoming_classes
                        .length
                    }
                  </h2>

                  <small>
                    Scheduled classes
                  </small>

                </div>

              </div>



              <div className="col-xl-3 col-md-6">

                <div className="summary-card">

                  <span>
                    Recorded Classes
                  </span>

                  <h2>
                    {
                      data.recorded_classes
                        .length
                    }
                  </h2>

                  <small>
                    Available recordings
                  </small>

                </div>

              </div>


            </div>



            {/* =========================
                TODAY CLASSES +
                ATTENDANCE
            ========================= */}

            <div className="row g-4 mt-1">


              {/* TODAY CLASSES */}

              <div className="col-lg-8">

                <div className="dashboard-panel">


                  <div className="panel-heading">

                    <h5>
                      Today&apos;s Classes
                    </h5>

                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                    >
                      View All
                    </button>

                  </div>



                  {
                    data.today_classes.length === 0
                      ? (

                        <div className="empty-state">

                          No classes scheduled
                          for today.

                        </div>

                      )
                      : (

                        data.today_classes.map(
                          (liveClass) => (

                            <div
                              key={liveClass.id}
                              className="border rounded p-3 mb-3"
                            >

                              <h6 className="fw-bold mb-1">

                                {
                                  liveClass.title
                                }

                              </h6>


                              <p className="text-muted small mb-1">

                                {
                                  liveClass.subject_name
                                }

                              </p>


                              <p className="small mb-2">

                                {
                                  liveClass.start_time
                                }

                                {" - "}

                                {
                                  liveClass.end_time
                                }

                              </p>


                              {
                                liveClass.teacher_name && (

                                  <p className="small text-muted mb-2">

                                    Teacher:{" "}
                                    {
                                      liveClass.teacher_name
                                    }

                                  </p>

                                )
                              }


                              {
                                liveClass.meeting_link && (

                                  <a
                                    href={
                                      liveClass.meeting_link
                                    }
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn btn-primary btn-sm"
                                  >

                                    Join Class

                                  </a>

                                )
                              }

                            </div>

                          )
                        )

                      )
                  }

                </div>

              </div>



              {/* ATTENDANCE */}

              <div className="col-lg-4">

                <div className="dashboard-panel">


                  <div className="panel-heading">

                    <h5>
                      Attendance Summary
                    </h5>

                  </div>



                  <div className="attendance-percentage">

                    <strong>

                      {
                        data.attendance
                          .attendance_percentage
                      }%

                    </strong>

                    <span>
                      Overall Attendance
                    </span>

                  </div>



                  <div className="attendance-stats">


                    <div>

                      <strong>
                        {
                          data.attendance
                            .present
                        }
                      </strong>

                      <span>
                        Present
                      </span>

                    </div>



                    <div>

                      <strong>
                        {
                          data.attendance
                            .absent
                        }
                      </strong>

                      <span>
                        Absent
                      </span>

                    </div>



                    <div>

                      <strong>
                        {
                          data.attendance
                            .late
                        }
                      </strong>

                      <span>
                        Late
                      </span>

                    </div>



                    <div>

                      <strong>
                        {
                          data.attendance
                            .excused
                        }
                      </strong>

                      <span>
                        Excused
                      </span>

                    </div>


                  </div>

                </div>

              </div>


            </div>



            {/* =========================
                RECORDED CLASSES
            ========================= */}

            <div className="dashboard-panel mt-4">


              <div className="panel-heading">

                <h5>
                  Recorded Classes
                </h5>

                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                >
                  View All
                </button>

              </div>



              {
                data.recorded_classes.length === 0
                  ? (

                    <div className="empty-state">

                      No recorded classes
                      available.

                    </div>

                  )
                  : (

                    <div className="row g-3">


                      {
                        data.recorded_classes.map(
                          (recording) => (

                            <div
                              key={recording.id}
                              className="col-lg-4 col-md-6"
                            >

                              <div className="border rounded p-3 h-100">


                                <h6 className="fw-bold">

                                  {
                                    recording.title
                                  }

                                </h6>


                                <p className="text-muted small mb-2">

                                  {
                                    recording.subject_name
                                  }

                                </p>


                                <p className="small mb-1">

                                  Section:{" "}
                                  {
                                    recording.section_name
                                  }

                                </p>


                                <p className="small mb-0">

                                  Class Date:{" "}
                                  {
                                    recording.class_date
                                  }

                                </p>



                                {/* WATCH RECORDING BUTTON */}

                                {recording.recording_playback_url && (
  <div className="d-flex gap-2 mt-3">
    <button
      type="button"
      className="btn btn-primary btn-sm"
      onClick={() => setSelectedRecording(recording)}
    >
      Watch Recording
    </button>

    {recording.recording_public_id && (
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        onClick={() =>
          handleShareRecording(recording.recording_public_id!)
        }
      >
        Share Recording
      </button>
    )}
  </div>
)}


                              </div>

                            </div>

                          )
                        )
                      }


                    </div>

                  )
              }


            </div>


          </div>

        </div>

      </main>



      {/* =========================
          SECURE VIDEO PLAYER
      ========================= */}

      {
        selectedRecording &&
        selectedRecording.recording_playback_url && (

          <SecureVideoPlayer
            playbackUrl={
              selectedRecording
                .recording_playback_url
            }
            title={
              selectedRecording.title
            }
            onClose={() =>
              setSelectedRecording(null)
            }
          />

        )
      }


    </div>
  );
}