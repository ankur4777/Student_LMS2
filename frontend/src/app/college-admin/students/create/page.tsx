"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { buildUsernameSuggestion } from "@/lib/username";

import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";
import AdminIcon from "@/components/college-admin/AdminIcon";

import "../../../teacher/dashboard/dashboard.css";
import "../students.css";

interface CollegeAdminUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface ExistingParent {
  id: number;
  name: string;
  username: string;
  email: string;
  is_active: boolean;
  profile?: {
    parent_profile_id: number;
    phone?: string;
    occupation?: string;
  } | null;
}

type ParentMode = "new" | "existing";

interface ParentDraft {
  key: number;
  mode: ParentMode;
  relationship: "father" | "mother" | "guardian" | "other";
  firstName: string;
  lastName: string;
  username: string;
  usernameManuallyEdited: boolean;
  email: string;
  phone: string;
  occupation: string;
  password: string;
  confirmPassword: string;
  existingParentProfileId: string;
  existingSearch: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

function getSavedAdmin() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem("college_admin_user") || "{}");
  } catch {
    return {};
  }
}

function emptyParent(key: number): ParentDraft {
  return {
    key,
    mode: "new",
    relationship: "guardian",
    firstName: "",
    lastName: "",
    username: "",
    usernameManuallyEdited: false,
    email: "",
    phone: "",
    occupation: "",
    password: "",
    confirmPassword: "",
    existingParentProfileId: "",
    existingSearch: "",
  };
}

export default function CollegeAdminCreateStudentPage() {
  const router = useRouter();

  const [admin] = useState<CollegeAdminUser>(getSavedAdmin);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameManuallyEdited, setUsernameManuallyEdited] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [admissionDate, setAdmissionDate] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [parents, setParents] = useState<ParentDraft[]>([emptyParent(1)]);
  const [existingParents, setExistingParents] = useState<ExistingParent[]>([]);
  const [parentOptionsLoading, setParentOptionsLoading] = useState(true);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const autoUsername = buildUsernameSuggestion(firstName, lastName);
  const displayedUsername = usernameManuallyEdited ? username : autoUsername;

  const clearSession = useCallback(() => {
    localStorage.removeItem("college_admin_access_token");
    localStorage.removeItem("college_admin_refresh_token");
    localStorage.removeItem("college_admin_user");
  }, []);

  const getToken = useCallback(() => {
    const token = localStorage.getItem("college_admin_access_token");
    if (!token) {
      router.replace("/college-admin/login");
      return "";
    }
    return token;
  }, [router]);

  useEffect(() => {
    async function loadExistingParents() {
      const token = getToken();
      if (!token) return;

      try {
        const response = await fetch(
          `${API_BASE}/api/accounts/college-admin/parents/`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          }
        );

        if (response.status === 401) {
          clearSession();
          router.replace("/college-admin/login");
          return;
        }

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result?.detail || "Unable to load parents.");
        }

        setExistingParents(
          (result.parents || []).filter(
            (parent: ExistingParent) =>
              parent.is_active && parent.profile?.parent_profile_id
          )
        );
      } catch {
        setExistingParents([]);
      } finally {
        setParentOptionsLoading(false);
      }
    }

    void loadExistingParents();
  }, [clearSession, getToken, router]);

  const updateParent = (key: number, changes: Partial<ParentDraft>) => {
    setParents((current) =>
      current.map((parent) =>
        parent.key === key ? { ...parent, ...changes } : parent
      )
    );
  };

  const addParent = () => {
    setParents((current) => {
      const nextKey =
        current.reduce((highest, parent) => Math.max(highest, parent.key), 0) + 1;
      return [...current, emptyParent(nextKey)];
    });
  };

  const removeParent = (key: number) => {
    setParents((current) => {
      if (current.length === 1) return current;
      return current.filter((parent) => parent.key !== key);
    });
  };

  const filteredExistingParents = (parent: ParentDraft) => {
    const search = parent.existingSearch.trim().toLowerCase();

    if (!search) {
      return existingParents;
    }

    return existingParents.filter((item) =>
      [item.name, item.username, item.email]
        .join(" ")
        .toLowerCase()
        .includes(search)
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      setError("Student passwords do not match.");
      return;
    }

    if (parents.length === 0) {
      setError("Add at least one parent or guardian.");
      return;
    }

    const selectedExistingIds = new Set<string>();

    for (let index = 0; index < parents.length; index += 1) {
      const parent = parents[index];
      const label = `Parent ${index + 1}`;

      if (parent.mode === "existing") {
        if (!parent.existingParentProfileId) {
          setError(`${label}: select an existing parent.`);
          return;
        }

        if (selectedExistingIds.has(parent.existingParentProfileId)) {
          setError("The same existing parent cannot be selected twice.");
          return;
        }

        selectedExistingIds.add(parent.existingParentProfileId);
        continue;
      }

      if (!parent.firstName.trim()) {
        setError(`${label}: first name is required.`);
        return;
      }

      if (!parent.email.trim()) {
        setError(`${label}: email is required.`);
        return;
      }

      if (!parent.password) {
        setError(`${label}: password is required.`);
        return;
      }

      if (parent.password !== parent.confirmPassword) {
        setError(`${label}: passwords do not match.`);
        return;
      }
    }

    try {
      setLoading(true);
      setError("");

      const token = getToken();
      if (!token) return;

      const parentPayload = parents.map((parent) => {
        if (parent.mode === "existing") {
          return {
            mode: "existing",
            parent_profile_id: Number(parent.existingParentProfileId),
            relationship: parent.relationship,
          };
        }

        const parentUsername = parent.usernameManuallyEdited
          ? parent.username
          : buildUsernameSuggestion(parent.firstName, parent.lastName);

        return {
          mode: "new",
          relationship: parent.relationship,
          first_name: parent.firstName,
          last_name: parent.lastName,
          username: parentUsername,
          username_auto: !parent.usernameManuallyEdited,
          email: parent.email,
          phone: parent.phone,
          occupation: parent.occupation,
          password: parent.password,
        };
      });

      const response = await fetch(
        `${API_BASE}/api/accounts/college-admin/students/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            first_name: firstName,
            last_name: lastName,
            username: displayedUsername,
            username_auto: !usernameManuallyEdited,
            email,
            phone,
            admission_number: admissionNumber,
            date_of_birth: dateOfBirth || null,
            admission_date: admissionDate || null,
            password,
            parents: parentPayload,
          }),
        }
      );

      if (response.status === 401) {
        clearSession();
        router.replace("/college-admin/login");
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        setError(result?.detail || "Unable to create student.");
        return;
      }

      router.replace("/college-admin/students");
    } catch {
      setError("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="teacher-dashboard college-admin-students-ui">
      <CollegeAdminSidebar />

      <main className="teacher-dashboard-main">
        <CollegeAdminTopbar
          name={admin.name || admin.username || "College Admin"}
          organization={admin.organization || ""}
        />

        <div className="teacher-dashboard-content student-management-page">
          <div className="container-fluid">
            <div className="student-page-header">
              <div>
                <button
                  type="button"
                  className="student-back-link mb-3"
                  onClick={() => router.push("/college-admin/students")}
                >
                  <AdminIcon name="back" size={17} />
                  Back to Students
                </button>

                <div className="student-page-kicker">STUDENT MANAGEMENT</div>
                <h1>Add Student</h1>
                <p>
                  Create the student account and connect parent or guardian
                  accounts in one step.
                </p>
              </div>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <form
              onSubmit={handleSubmit}
              className="student-form-shell"
              autoComplete="off"
            >
              <div className="student-form-card">
                <section className="student-form-section">
                  <div className="student-section-heading">
                    <span>
                      <AdminIcon name="students" size={18} />
                    </span>
                    <div>
                      <h2>Personal Information</h2>
                      <p>Basic identity and contact details for the student.</p>
                    </div>
                  </div>

                  <div className="student-form-grid">
                    <div className="student-form-group">
                      <label htmlFor="first-name">First Name</label>
                      <input
                        id="first-name"
                        value={firstName}
                        onChange={(event) => setFirstName(event.target.value)}
                      />
                    </div>

                    <div className="student-form-group">
                      <label htmlFor="last-name">Last Name</label>
                      <input
                        id="last-name"
                        value={lastName}
                        onChange={(event) => setLastName(event.target.value)}
                      />
                    </div>

                    <div className="student-form-group">
                      <label htmlFor="email">Email</label>
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                      />
                    </div>

                    <div className="student-form-group">
                      <label htmlFor="phone">Phone</label>
                      <input
                        id="phone"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                      />
                    </div>

                    <div className="student-form-group">
                      <label htmlFor="dob">Date of Birth</label>
                      <input
                        id="dob"
                        type="date"
                        value={dateOfBirth}
                        onChange={(event) => setDateOfBirth(event.target.value)}
                      />
                    </div>

                    <div className="student-form-group">
                      <label htmlFor="admission-date">Admission Date</label>
                      <input
                        id="admission-date"
                        type="date"
                        value={admissionDate}
                        onChange={(event) => setAdmissionDate(event.target.value)}
                      />
                    </div>
                  </div>
                </section>

                <section className="student-form-section">
                  <div className="student-section-heading">
                    <span>
                      <AdminIcon name="enrollments" size={18} />
                    </span>
                    <div>
                      <h2>Student Account & Admission</h2>
                      <p>Login credentials and college admission information.</p>
                    </div>
                  </div>

                  <div className="student-form-grid">
                    <div className="student-form-group">
                      <label htmlFor="username">Username</label>
                      <input
                        id="username"
                        value={displayedUsername}
                        name="generated-username"
                        autoComplete="off"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        onChange={(event) => {
                          setUsername(event.target.value);
                          setUsernameManuallyEdited(true);
                        }}
                        required
                      />
                      <small>
                        Auto generated from the student&apos;s name. You can
                        edit it before creating the account.
                      </small>
                    </div>

                    <div className="student-form-group">
                      <label htmlFor="admission-number">Admission Number</label>
                      <input
                        id="admission-number"
                        value={admissionNumber}
                        onChange={(event) =>
                          setAdmissionNumber(event.target.value)
                        }
                        required
                      />
                    </div>

                    <div className="student-form-group">
                      <label htmlFor="password">Password</label>
                      <input
                        id="password"
                        name="student-new-password"
                        type="password"
                        autoComplete="new-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                      />
                    </div>

                    <div className="student-form-group">
                      <label htmlFor="confirm-password">Confirm Password</label>
                      <input
                        id="confirm-password"
                        name="student-confirm-new-password"
                        type="password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(event) =>
                          setConfirmPassword(event.target.value)
                        }
                        required
                      />
                    </div>
                  </div>
                </section>

                <section className="student-form-section">
                  <div className="student-section-heading student-parent-heading">
                    <span>
                      <AdminIcon name="parents" size={18} />
                    </span>
                    <div>
                      <h2>Parent / Guardian Details</h2>
                      <p>
                        Create a new parent account or connect an existing
                        parent while creating this student.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="student-parent-add"
                      onClick={addParent}
                    >
                      + Add Another Parent
                    </button>
                  </div>

                  <div className="student-parent-list">
                    {parents.map((parent, index) => {
                      const parentUsername = parent.usernameManuallyEdited
                        ? parent.username
                        : buildUsernameSuggestion(
                            parent.firstName,
                            parent.lastName
                          );
                      const matches = filteredExistingParents(parent);

                      return (
                        <div className="student-parent-card" key={parent.key}>
                          <div className="student-parent-card-head">
                            <div>
                              <strong>Parent / Guardian {index + 1}</strong>
                              <small>
                                Choose whether this is a new or existing account.
                              </small>
                            </div>

                            {parents.length > 1 && (
                              <button
                                type="button"
                                className="student-parent-remove"
                                onClick={() => removeParent(parent.key)}
                              >
                                Remove
                              </button>
                            )}
                          </div>

                          <div className="student-parent-mode">
                            <button
                              type="button"
                              className={parent.mode === "new" ? "active" : ""}
                              onClick={() =>
                                updateParent(parent.key, {
                                  mode: "new",
                                  existingParentProfileId: "",
                                })
                              }
                            >
                              Create New Parent
                            </button>

                            <button
                              type="button"
                              className={
                                parent.mode === "existing" ? "active" : ""
                              }
                              onClick={() =>
                                updateParent(parent.key, {
                                  mode: "existing",
                                })
                              }
                            >
                              Select Existing Parent
                            </button>
                          </div>

                          <div className="student-form-grid student-parent-top-grid">
                            <div className="student-form-group">
                              <label>Relationship</label>
                              <select
                                value={parent.relationship}
                                onChange={(event) =>
                                  updateParent(parent.key, {
                                    relationship: event.target.value as
                                      ParentDraft["relationship"],
                                  })
                                }
                              >
                                <option value="father">Father</option>
                                <option value="mother">Mother</option>
                                <option value="guardian">Guardian</option>
                                <option value="other">Other</option>
                              </select>
                            </div>
                          </div>

                          {parent.mode === "existing" ? (
                            <div className="student-existing-parent-area">
                              <div className="student-form-group">
                                <label>Search Existing Parent</label>
                                <input
                                  value={parent.existingSearch}
                                  placeholder="Search by name, username or email"
                                  onChange={(event) =>
                                    updateParent(parent.key, {
                                      existingSearch: event.target.value,
                                    })
                                  }
                                />
                              </div>

                              <div className="student-form-group">
                                <label>Select Parent</label>
                                <select
                                  value={parent.existingParentProfileId}
                                  onChange={(event) =>
                                    updateParent(parent.key, {
                                      existingParentProfileId:
                                        event.target.value,
                                    })
                                  }
                                  required
                                >
                                  <option value="">
                                    {parentOptionsLoading
                                      ? "Loading parents..."
                                      : "Select an existing parent"}
                                  </option>
                                  {matches.map((existingParent) => (
                                    <option
                                      value={
                                        existingParent.profile
                                          ?.parent_profile_id || ""
                                      }
                                      key={existingParent.id}
                                    >
                                      {existingParent.name} ·{" "}
                                      {existingParent.username}
                                      {existingParent.email
                                        ? ` · ${existingParent.email}`
                                        : ""}
                                    </option>
                                  ))}
                                </select>
                                <small>
                                  Only active parents from this college are
                                  available.
                                </small>
                              </div>
                            </div>
                          ) : (
                            <div className="student-form-grid">
                              <div className="student-form-group">
                                <label>First Name</label>
                                <input
                                  value={parent.firstName}
                                  onChange={(event) =>
                                    updateParent(parent.key, {
                                      firstName: event.target.value,
                                    })
                                  }
                                  required
                                />
                              </div>

                              <div className="student-form-group">
                                <label>Last Name</label>
                                <input
                                  value={parent.lastName}
                                  onChange={(event) =>
                                    updateParent(parent.key, {
                                      lastName: event.target.value,
                                    })
                                  }
                                />
                              </div>

                              <div className="student-form-group">
                                <label>Username</label>
                                <input
                                  name={`parent-generated-username-${parent.key}`}
                                  value={parentUsername}
                                  autoComplete="off"
                                  data-lpignore="true"
                                  data-1p-ignore="true"
                                  onChange={(event) =>
                                    updateParent(parent.key, {
                                      username: event.target.value,
                                      usernameManuallyEdited: true,
                                    })
                                  }
                                  required
                                />
                                <small>
                                  Auto generated from the parent&apos;s name and
                                  editable before saving.
                                </small>
                              </div>

                              <div className="student-form-group">
                                <label>Email</label>
                                <input
                                  type="email"
                                  value={parent.email}
                                  onChange={(event) =>
                                    updateParent(parent.key, {
                                      email: event.target.value,
                                    })
                                  }
                                  required
                                />
                              </div>

                              <div className="student-form-group">
                                <label>Phone</label>
                                <input
                                  value={parent.phone}
                                  onChange={(event) =>
                                    updateParent(parent.key, {
                                      phone: event.target.value,
                                    })
                                  }
                                />
                              </div>

                              <div className="student-form-group">
                                <label>Occupation</label>
                                <input
                                  value={parent.occupation}
                                  onChange={(event) =>
                                    updateParent(parent.key, {
                                      occupation: event.target.value,
                                    })
                                  }
                                />
                              </div>

                              <div className="student-form-group">
                                <label>Password</label>
                                <input
                                  name={`parent-new-password-${parent.key}`}
                                  type="password"
                                  autoComplete="new-password"
                                  value={parent.password}
                                  onChange={(event) =>
                                    updateParent(parent.key, {
                                      password: event.target.value,
                                    })
                                  }
                                  required
                                />
                              </div>

                              <div className="student-form-group">
                                <label>Confirm Password</label>
                                <input
                                  name={`parent-confirm-password-${parent.key}`}
                                  type="password"
                                  autoComplete="new-password"
                                  value={parent.confirmPassword}
                                  onChange={(event) =>
                                    updateParent(parent.key, {
                                      confirmPassword: event.target.value,
                                    })
                                  }
                                  required
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                <div className="student-form-actions">
                  <button
                    type="button"
                    className="student-form-cancel"
                    onClick={() => router.push("/college-admin/students")}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="student-form-submit"
                    disabled={loading}
                  >
                    {loading
                      ? "Creating..."
                      : "Create Student & Link Parent"}
                  </button>
                </div>
              </div>

              <aside className="student-side-card">
                <h3>Student & Parent setup</h3>
                <ul>
                  <li>
                    The student username is generated automatically from the
                    student&apos;s name.
                  </li>
                  <li>
                    For a new parent, the parent username is also generated
                    automatically and remains editable.
                  </li>
                  <li>
                    If the parent already has an LMS account, choose Select
                    Existing Parent instead of creating a duplicate account.
                  </li>
                  <li>
                    Parent-student linking is completed automatically when the
                    student is created.
                  </li>
                  <li>
                    You can add more than one parent or guardian before saving.
                  </li>
                </ul>
              </aside>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
