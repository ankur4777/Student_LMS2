"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import StudentSidebar from "@/components/student/studentsidebar";
import StudentTopbar from "@/components/student/studentTopbar";
import ChangePasswordCard from "@/components/auth/ChangePasswordCard";

import "../dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface StudentUser {
  username?: string;
  name?: string;
  organization?: string;
  profile_picture?: string;
}

interface StudentProfile {
  student_profile_id: number;
  name: string;
  username: string;
  email: string;
  organization: string | null;
  admission_number: string;
  phone: string;
  address: string;
  date_of_birth: string | null;
  admission_date: string | null;
  profile_picture: string;
}

interface ParentDetails {
  name: string;
  relationship: string;
  relationship_label: string;
  email: string;
  phone: string;
  occupation: string;
}

interface Enrollment {
  roll_number: string;
  classroom_name: string;
  section_name: string;
  is_active: boolean;
  enrolled_at: string;
}

function getSavedStudent() {
  if (typeof window === "undefined") {
    return {};
  }

  const savedStudent = localStorage.getItem("student_user");

  if (!savedStudent) {
    return {};
  }

  try {
    return JSON.parse(savedStudent);
  } catch {
    return {};
  }
}

function formatValue(value?: string | number | null) {
  if (value === undefined || value === null || value === "") {
    return "-";
  }

  return value;
}

export default function StudentProfilePage() {
  const router = useRouter();

  const [student] = useState<StudentUser>(getSavedStudent);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [parents, setParents] = useState<ParentDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pictureFile, setPictureFile] = useState<File | null>(null);
  const [picturePreview, setPicturePreview] = useState("");
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [pictureMessage, setPictureMessage] = useState("");

  const clearStudentSession = useCallback(() => {
    localStorage.removeItem("student_access_token");
    localStorage.removeItem("student_refresh_token");
    localStorage.removeItem("student_user");
  }, []);

  const getToken = useCallback(() => {
    const token = localStorage.getItem("student_access_token");

    if (!token) {
      router.replace("/student/login");
      return "";
    }

    return token;
  }, [router]);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      try {
        const token = getToken();

        if (!token) {
          return;
        }

        const response = await fetch(
          `${API_BASE}/api/accounts/student/profile/`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.status === 401) {
          clearStudentSession();
          router.replace("/student/login");
          return;
        }

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result?.detail || "Unable to load profile."
          );
        }

        if (isMounted) {
          const loadedProfile = result.profile || null;
          setProfile(loadedProfile);
          setEnrollment(result.enrollment || null);
          setParents(result.parents || []);

          if (loadedProfile) {
            try {
              const saved = JSON.parse(
                localStorage.getItem("student_user") || "{}"
              );
              localStorage.setItem(
                "student_user",
                JSON.stringify({
                  ...saved,
                  name: loadedProfile.name,
                  organization: loadedProfile.organization,
                  profile_picture:
                    loadedProfile.profile_picture || "",
                })
              );
              window.dispatchEvent(
                new Event("student:profile-updated")
              );
            } catch {
              // Ignore invalid cached user data.
            }
          }
        }
      } catch (err) {
        if (isMounted && err instanceof Error) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [clearStudentSession, getToken, router]);

  const handlePictureChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0] || null;
    setPictureMessage("");
    setError("");

    if (!file) {
      setPictureFile(null);
      setPicturePreview("");
      return;
    }

    if (
      !["image/jpeg", "image/png", "image/webp"].includes(
        file.type
      )
    ) {
      setError("Please choose a JPG, PNG, or WebP image.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Profile picture must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    if (picturePreview.startsWith("blob:")) {
      URL.revokeObjectURL(picturePreview);
    }

    setPictureFile(file);
    setPicturePreview(URL.createObjectURL(file));
  };

  const uploadProfilePicture = async () => {
    if (!pictureFile) {
      setError("Please choose a profile picture first.");
      return;
    }

    const token = getToken();
    if (!token) {
      return;
    }

    try {
      setUploadingPicture(true);
      setError("");
      setPictureMessage("");

      const formData = new FormData();
      formData.append("profile_picture", pictureFile);

      const response = await fetch(
        `${API_BASE}/api/accounts/student/profile/`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (response.status === 401) {
        clearStudentSession();
        router.replace("/student/login");
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.detail || "Unable to update profile picture."
        );
      }

      const nextPicture = result.profile_picture || "";

      setProfile((current) =>
        current
          ? {
              ...current,
              profile_picture: nextPicture,
            }
          : current
      );

      if (picturePreview.startsWith("blob:")) {
        URL.revokeObjectURL(picturePreview);
      }

      setPictureFile(null);
      setPicturePreview("");
      setPictureMessage(
        result.message || "Profile picture updated successfully."
      );

      try {
        const saved = JSON.parse(
          localStorage.getItem("student_user") || "{}"
        );
        localStorage.setItem(
          "student_user",
          JSON.stringify({
            ...saved,
            profile_picture: nextPicture,
          })
        );
        window.dispatchEvent(
          new Event("student:profile-updated")
        );
      } catch {
        // Ignore invalid cached user data.
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      setUploadingPicture(false);
    }
  };

  return (
    <div className="student-dashboard">
      <StudentSidebar />

      <main className="student-dashboard-main">
        <StudentTopbar
          name={
            profile?.name ||
            student.name ||
            student.username ||
            "Student"
          }
          organization={
            profile?.organization ||
            student.organization ||
            ""
          }
        />

        <div className="student-dashboard-content">
          <div className="container-fluid">
            <div className="mb-4">
              <h2 className="fw-bold mb-1">
                Profile
              </h2>

              <p className="text-muted mb-0">
                View your student account and academic details, and update your profile picture.
              </p>
            </div>

            {error && (
              <div className="alert alert-danger">
                {error}
              </div>
            )}

            {loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading profile...
                </div>
              </div>
            ) : (
              <>
                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-body p-4">
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">
                      <div>
                        <h5 className="fw-bold mb-1">
                          Profile Picture
                        </h5>
                        <p className="text-muted small mb-0">
                          Upload a JPG, PNG, or WebP image up to 5 MB.
                        </p>
                      </div>
                    </div>

                    <div className="d-flex align-items-center flex-wrap gap-4">
                      <div
                        className="rounded-circle border bg-light d-flex align-items-center justify-content-center overflow-hidden"
                        style={{ width: 112, height: 112 }}
                      >
                        {picturePreview || profile?.profile_picture ? (
                          <img
                            src={
                              picturePreview ||
                              profile?.profile_picture ||
                              ""
                            }
                            alt="Student profile"
                            className="w-100 h-100"
                            style={{ objectFit: "cover" }}
                          />
                        ) : (
                          <span className="fw-bold fs-3 text-muted">
                            {(profile?.name || "S")
                              .trim()
                              .slice(0, 2)
                              .toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div className="flex-grow-1" style={{ minWidth: 260 }}>
                        <input
                          className="form-control mb-3"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handlePictureChange}
                        />

                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={!pictureFile || uploadingPicture}
                          onClick={uploadProfilePicture}
                        >
                          {uploadingPicture
                            ? "Uploading..."
                            : "Update Profile Picture"}
                        </button>

                        {pictureMessage && (
                          <div className="text-success small mt-2">
                            {pictureMessage}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-body p-4">
                    <h5 className="fw-bold mb-4">
                      Student Information
                    </h5>

                    <div className="row g-4">
                      <div className="col-md-6 col-xl-4">
                        <div className="text-muted small">
                          Name
                        </div>

                        <div className="fw-semibold">
                          {formatValue(profile?.name)}
                        </div>
                      </div>

                      <div className="col-md-6 col-xl-4">
                        <div className="text-muted small">
                          Username
                        </div>

                        <div className="fw-semibold">
                          {formatValue(profile?.username)}
                        </div>
                      </div>

                      <div className="col-md-6 col-xl-4">
                        <div className="text-muted small">
                          Email
                        </div>

                        <div className="fw-semibold">
                          {formatValue(profile?.email)}
                        </div>
                      </div>

                      <div className="col-md-6 col-xl-4">
                        <div className="text-muted small">
                          Admission Number
                        </div>

                        <div className="fw-semibold">
                          {formatValue(profile?.admission_number)}
                        </div>
                      </div>

                      <div className="col-md-6 col-xl-4">
                        <div className="text-muted small">
                          Roll Number
                        </div>

                        <div className="fw-semibold">
                          {formatValue(enrollment?.roll_number)}
                        </div>
                      </div>

                      <div className="col-md-6 col-xl-4">
                        <div className="text-muted small">
                          College / Organization
                        </div>

                        <div className="fw-semibold">
                          {formatValue(profile?.organization)}
                        </div>
                      </div>

                      <div className="col-md-6 col-xl-4">
                        <div className="text-muted small">
                          Phone
                        </div>

                        <div className="fw-semibold">
                          {formatValue(profile?.phone)}
                        </div>
                      </div>

                      <div className="col-md-6 col-xl-4">
                        <div className="text-muted small">
                          Address
                        </div>

                        <div className="fw-semibold">
                          {formatValue(profile?.address)}
                        </div>
                      </div>

                      <div className="col-md-6 col-xl-4">
                        <div className="text-muted small">
                          Date of Birth
                        </div>

                        <div className="fw-semibold">
                          {formatValue(profile?.date_of_birth)}
                        </div>
                      </div>

                      <div className="col-md-6 col-xl-4">
                        <div className="text-muted small">
                          Admission Date
                        </div>

                        <div className="fw-semibold">
                          {formatValue(profile?.admission_date)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-body p-4">
                    <h5 className="fw-bold mb-4">
                      Parent / Guardian Information
                    </h5>

                    {parents.length > 0 ? (
                      <div className="row g-3">
                        {parents.map((parent, index) => (
                          <div
                            key={index}
                            className="col-12 col-xl-6"
                          >
                            <div className="border rounded-3 p-3 h-100">
                              <h6 className="fw-bold mb-3">
                                {formatValue(parent.relationship_label || parent.relationship)}
                              </h6>

                              <div className="row g-3">
                                <div className="col-sm-6">
                                  <div className="text-muted small">Name</div>
                                  <div className="fw-semibold">
                                    {formatValue(parent.name)}
                                  </div>
                                </div>
                                <div className="col-sm-6">
                                  <div className="text-muted small">Phone</div>
                                  <div className="fw-semibold">
                                    {formatValue(parent.phone)}
                                  </div>
                                </div>
                                <div className="col-sm-6">
                                  <div className="text-muted small">Email</div>
                                  <div className="fw-semibold text-break">
                                    {formatValue(parent.email)}
                                  </div>
                                </div>
                                <div className="col-sm-6">
                                  <div className="text-muted small">Occupation</div>
                                  <div className="fw-semibold">
                                    {formatValue(parent.occupation)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted mb-0">
                        No parent or guardian details are linked to your profile.
                      </p>
                    )}
                  </div>
                </div>

                <div className="card border-0 shadow-sm">
                  <div className="card-body p-4">
                    <h5 className="fw-bold mb-4">
                      Academic Information
                    </h5>

                    {enrollment ? (
                      <div className="row g-4">
                        <div className="col-md-6 col-xl-4">
                          <div className="text-muted small">
                            Class
                          </div>

                          <div className="fw-semibold">
                            {formatValue(enrollment.classroom_name)}
                          </div>
                        </div>

                        <div className="col-md-6 col-xl-4">
                          <div className="text-muted small">
                            Section
                          </div>

                          <div className="fw-semibold">
                            {formatValue(enrollment.section_name)}
                          </div>
                        </div>

                        <div className="col-md-6 col-xl-4">
                          <div className="text-muted small">
                            Enrollment Status
                          </div>

                          <div className="fw-semibold">
                            {enrollment.is_active
                              ? "Active"
                              : "Inactive"}
                          </div>
                        </div>

                        <div className="col-md-6 col-xl-4">
                          <div className="text-muted small">
                            Enrolled At
                          </div>

                          <div className="fw-semibold">
                            {formatValue(enrollment.enrolled_at)}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted mb-0">
                        No active enrollment found.
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
      <ChangePasswordCard
        accessTokenKey="student_access_token"
        refreshTokenKey="student_refresh_token"
        userStorageKey="student_user"
        loginPath="/student/login"
      />

          </div>
        </div>
      </main>
    </div>
  );
}
