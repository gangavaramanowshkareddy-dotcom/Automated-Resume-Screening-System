import React, { useEffect, useMemo, useState } from "react";
import apiClient from "../api/client";

function Candidates() {
  const [jobs, setJobs] = useState([]);
  const [candidates, setCandidates] = useState([]);

  const [selectedJobId, setSelectedJobId] = useState("ALL");
  const [selectedJob, setSelectedJob] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");

  const [loading, setLoading] = useState(true);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  const [error, setError] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  // ---------------------------------------------------------
  // Load all jobs when Candidates page opens
  // ---------------------------------------------------------
  useEffect(() => {
    loadJobs();
  }, []);

  // ---------------------------------------------------------
  // Load jobs from backend
  // ---------------------------------------------------------
  const loadJobs = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await apiClient.get("/api/jobs");

      const backendJobs = Array.isArray(response.data)
        ? response.data
        : [];

      setJobs(backendJobs);

      // Keep the currently screened job selected if available.
      const lastScreeningJobId = localStorage.getItem(
        "last_screening_job_id"
      );

      if (
        lastScreeningJobId &&
        backendJobs.some(
          (job) => String(job.id) === String(lastScreeningJobId)
        )
      ) {
        setSelectedJobId(String(lastScreeningJobId));
      } else {
        setSelectedJobId("ALL");
      }
    } catch (err) {
      console.error("Failed to load jobs:", err);

      setError(
        err.response?.data?.detail ||
          "Unable to load jobs."
      );
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------
  // Load candidates for all jobs
  // ---------------------------------------------------------
  const loadAllCandidates = async () => {
    try {
      setLoadingCandidates(true);
      setError("");

      if (!jobs.length) {
        setCandidates([]);
        return;
      }

      const responses = await Promise.all(
        jobs.map(async (job) => {
          try {
            const response = await apiClient.get(
              `/api/jobs/${job.id}/candidates`
            );

            const data = response.data || {};

            return {
              job,
              candidates: Array.isArray(data.candidates)
                ? data.candidates
                : [],
            };
          } catch (err) {
            console.error(
              `Failed to load candidates for job ${job.id}:`,
              err
            );

            return {
              job,
              candidates: [],
            };
          }
        })
      );

      const allCandidates = [];

      responses.forEach(({ job, candidates: jobCandidates }) => {
        jobCandidates.forEach((candidate) => {
          allCandidates.push({
            ...candidate,
            job_id: job.id,
            job: job.job_title || "—",
            job_description: job.job_description || "",
            required_skills: job.required_skills || "",
            required_experience:
              job.required_experience || "",
          });
        });
      });

      setCandidates(allCandidates);
    } catch (err) {
      console.error(
        "Failed to load candidates from all jobs:",
        err
      );

      setError(
        err.response?.data?.detail ||
          "Unable to load candidates."
      );
    } finally {
      setLoadingCandidates(false);
    }
  };

  // ---------------------------------------------------------
  // Load candidates for one selected job
  // ---------------------------------------------------------
  const loadCandidatesForJob = async (jobId) => {
    try {
      setLoadingCandidates(true);
      setError("");

      const job = jobs.find(
        (item) => String(item.id) === String(jobId)
      );

      if (!job) {
        setCandidates([]);
        return;
      }

      const response = await apiClient.get(
        `/api/jobs/${job.id}/candidates`
      );

      const data = response.data || {};

      const candidateList = (
        Array.isArray(data.candidates)
          ? data.candidates
          : []
      ).map((candidate) => ({
        ...candidate,
        job_id: job.id,
        job: job.job_title || data.job_title || "—",
        job_description: job.job_description || "",
        required_skills: job.required_skills || "",
        required_experience:
          job.required_experience || "",
      }));

      setCandidates(candidateList);
    } catch (err) {
      console.error(
        "Failed to load candidates for selected job:",
        err
      );

      setCandidates([]);

      setError(
        err.response?.data?.detail ||
          "Unable to load candidates for this job."
      );
    } finally {
      setLoadingCandidates(false);
    }
  };

  // ---------------------------------------------------------
  // React whenever selected job changes
  // ---------------------------------------------------------
  useEffect(() => {
    if (!jobs.length) {
      setSelectedJob(null);
      setCandidates([]);
      return;
    }

    if (selectedJobId === "ALL") {
      setSelectedJob(null);
      loadAllCandidates();
      return;
    }

    const job = jobs.find(
      (item) => String(item.id) === String(selectedJobId)
    );

    setSelectedJob(job || null);

    if (job) {
      loadCandidatesForJob(job.id);
    } else {
      setCandidates([]);
    }
  }, [selectedJobId, jobs]);

  // ---------------------------------------------------------
  // Job selection
  // ---------------------------------------------------------
  const handleJobChange = (event) => {
    setSelectedJobId(event.target.value);

    // Clear candidate popup when changing jobs.
    setSelectedCandidate(null);

    // Reset search/status when changing jobs.
    setSearch("");
    setStatusFilter("All Status");
  };
  // ---------------------------------------------------------
// Candidate decision helpers
// ---------------------------------------------------------
const normalizeDecision = (value) => {
  return String(value || "")
    .trim()
    .toUpperCase();
};

const isShortlistedDecision = (value) => {
  const decision = normalizeDecision(value);

  return (
    decision === "SHORTLIST" ||
    decision === "SHORTLISTED"
  );
};

const isRejectedDecision = (value) => {
  const decision = normalizeDecision(value);

  return (
    decision === "REJECT" ||
    decision === "REJECTED"
  );
};

// ---------------------------------------------------------
// Filter candidates
// ---------------------------------------------------------
const filteredCandidates = useMemo(() => {
  return candidates.filter((candidate) => {
    const name = String(candidate.name || "");
    const email = String(candidate.email || "");
    const job = String(candidate.job || "");

    const searchValue = search.toLowerCase();

    const matchesSearch =
      name.toLowerCase().includes(searchValue) ||
      email.toLowerCase().includes(searchValue) ||
      job.toLowerCase().includes(searchValue);

    const matchesStatus =
      statusFilter === "All Status" ||
      (statusFilter === "Shortlisted" &&
        isShortlistedDecision(candidate.decision)) ||
      (statusFilter === "Rejected" &&
        isRejectedDecision(candidate.decision));

    return matchesSearch && matchesStatus;
  });
}, [candidates, search, statusFilter]);

// ---------------------------------------------------------
// Statistics
// ---------------------------------------------------------
const totalCandidates = candidates.length;

const shortlistedCount = candidates.filter(
  (candidate) =>
    isShortlistedDecision(candidate.decision)
).length;

const rejectedCount = candidates.filter(
  (candidate) =>
    isRejectedDecision(candidate.decision)
).length;

const processingCount =
  totalCandidates -
  shortlistedCount -
  rejectedCount;
  
  // ---------------------------------------------------------
  // Helper for displaying values
  // ---------------------------------------------------------
  const displayValue = (value) => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "—";
    }

    return value;
  };

  const displayList = (value) => {
    if (Array.isArray(value)) {
      return value.length ? value.join(", ") : "—";
    }

    return displayValue(value);
  };

  // ---------------------------------------------------------
  // Loading jobs
  // ---------------------------------------------------------
  if (loading) {
    return (
      <div className="page-container">
        <div
          style={{
            padding: "50px",
            textAlign: "center",
            color: "#6b7280",
          }}
        >
          Loading jobs...
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------
  // Main page
  // ---------------------------------------------------------
  return (
    <div className="page-container">
      {/* =====================================================
          PAGE HEADER
      ====================================================== */}
      <div className="page-header">
        <div>
          <h1>Candidates</h1>

          <p>
            View jobs, screened candidates, scores and
            screening decisions.
          </p>
        </div>
      </div>

      {/* =====================================================
          TOP FILTER BAR
      ====================================================== */}
      <div className="candidate-topbar">
        <input
          type="text"
          placeholder="Search candidates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          value={selectedJobId}
          onChange={handleJobChange}
        >
          <option value="ALL">All Jobs</option>

          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.job_title || `Job ${job.id}`}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value)
          }
        >
          <option>All Status</option>
          <option>Shortlisted</option>
          <option>Rejected</option>
        </select>
      </div>

      {/* =====================================================
          ERROR
      ====================================================== */}
      {error && (
        <div
          style={{
            marginBottom: "20px",
            padding: "14px 18px",
            background: "#fef2f2",
            color: "#dc2626",
            borderRadius: "8px",
            border: "1px solid #fecaca",
          }}
        >
          {error}
        </div>
      )}

      {/* =====================================================
          ALL JOBS VIEW
      ====================================================== */}
      {selectedJobId === "ALL" && (
        <div
          style={{
            marginBottom: "24px",
          }}
        >
          <div className="candidates-card">
            <div className="candidates-card-header">
              <div>
                <h2>All Jobs</h2>

                <p
                  style={{
                    margin: "6px 0 0",
                    color: "#6b7280",
                  }}
                >
                  {jobs.length} job
                  {jobs.length !== 1 ? "s" : ""} in the
                  system
                </p>
              </div>
            </div>

            {jobs.length === 0 ? (
              <div
                style={{
                  padding: "30px",
                  textAlign: "center",
                  color: "#6b7280",
                }}
              >
                No jobs found.
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: "18px",
                  padding: "20px",
                }}
              >
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: "12px",
                      padding: "20px",
                      background: "#ffffff",
                    }}
                  >
                    <h3
                      style={{
                        marginTop: 0,
                        marginBottom: "10px",
                      }}
                    >
                      {job.job_title || "Untitled Job"}
                    </h3>

                    <p
                      style={{
                        color: "#6b7280",
                        lineHeight: 1.5,
                        marginBottom: "14px",
                      }}
                    >
                      {job.job_description ||
                        "No job description available."}
                    </p>

                    <div
                      style={{
                        marginBottom: "8px",
                      }}
                    >
                      <strong>Required Skills:</strong>
                      <div
                        style={{
                          marginTop: "4px",
                          color: "#4b5563",
                        }}
                      >
                        {displayValue(
                          job.required_skills
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        marginBottom: "16px",
                      }}
                    >
                      <strong>Experience:</strong>

                      <div
                        style={{
                          marginTop: "4px",
                          color: "#4b5563",
                        }}
                      >
                        {displayValue(
                          job.required_experience
                        )}
                      </div>
                    </div>

                    <button
                      className="view-button"
                      onClick={() => {
                        setSelectedJobId(
                          String(job.id)
                        );
                        setSelectedCandidate(null);
                        setSearch("");
                        setStatusFilter("All Status");
                      }}
                    >
                      View Job & Candidates
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================
          SELECTED JOB INFORMATION
      ====================================================== */}
      {selectedJob && (
        <div
          className="candidates-card"
          style={{
            marginBottom: "24px",
          }}
        >
          <div className="candidates-card-header">
            <div>
              <h2>
                {selectedJob.job_title ||
                  "Selected Job"}
              </h2>

              <span>
                Job ID: {selectedJob.id}
              </span>
            </div>
          </div>

          <div
            style={{
              padding: "22px",
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "20px",
            }}
          >
            {/* Job Description */}
            <div
              style={{
                gridColumn: "1 / -1",
              }}
            >
              <strong>Job Description</strong>

              <p
                style={{
                  marginTop: "8px",
                  lineHeight: 1.6,
                  color: "#4b5563",
                  whiteSpace: "pre-wrap",
                }}
              >
                {displayValue(
                  selectedJob.job_description
                )}
              </p>
            </div>

            {/* Required Skills */}
            <div>
              <strong>Required Skills</strong>

              <p
                style={{
                  marginTop: "8px",
                  color: "#4b5563",
                  whiteSpace: "pre-wrap",
                }}
              >
                {displayValue(
                  selectedJob.required_skills
                )}
              </p>
            </div>

            {/* Preferred Skills */}
            <div>
              <strong>Preferred Skills</strong>

              <p
                style={{
                  marginTop: "8px",
                  color: "#4b5563",
                  whiteSpace: "pre-wrap",
                }}
              >
                {displayValue(
                  selectedJob.preferred_skills
                )}
              </p>
            </div>

            {/* Education */}
            <div>
              <strong>Required Education</strong>

              <p
                style={{
                  marginTop: "8px",
                  color: "#4b5563",
                  whiteSpace: "pre-wrap",
                }}
              >
                {displayValue(
                  selectedJob.required_education
                )}
              </p>
            </div>

            {/* Experience */}
            <div>
              <strong>Required Experience</strong>

              <p
                style={{
                  marginTop: "8px",
                  color: "#4b5563",
                  whiteSpace: "pre-wrap",
                }}
              >
                {displayValue(
                  selectedJob.required_experience
                )}
              </p>
            </div>

            {/* Other Requirements */}
            <div>
              <strong>Other Requirements</strong>

              <p
                style={{
                  marginTop: "8px",
                  color: "#4b5563",
                  whiteSpace: "pre-wrap",
                }}
              >
                {displayValue(
                  selectedJob.other_requirements
                )}
              </p>
            </div>

            {/* Threshold */}
            <div>
              <strong>Screening Threshold</strong>

              <p
                style={{
                  marginTop: "8px",
                  color: "#4b5563",
                }}
              >
                {selectedJob.threshold !== null &&
                selectedJob.threshold !== undefined
                  ? `${selectedJob.threshold}%`
                  : "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          CANDIDATE STATISTICS
      ====================================================== */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div
          className="candidates-card"
          style={{
            padding: "20px",
          }}
        >
          <div
            style={{
              color: "#6b7280",
              fontSize: "14px",
            }}
          >
            Candidates
          </div>

          <div
            style={{
              fontSize: "28px",
              fontWeight: 700,
              marginTop: "6px",
            }}
          >
            {totalCandidates}
          </div>
        </div>

        <div
          className="candidates-card"
          style={{
            padding: "20px",
          }}
        >
          <div
            style={{
              color: "#6b7280",
              fontSize: "14px",
            }}
          >
            Shortlisted
          </div>

          <div
            style={{
              fontSize: "28px",
              fontWeight: 700,
              marginTop: "6px",
            }}
          >
            {shortlistedCount}
          </div>
        </div>

        <div
          className="candidates-card"
          style={{
            padding: "20px",
          }}
        >
          <div
            style={{
              color: "#6b7280",
              fontSize: "14px",
            }}
          >
            Rejected
          </div>

          <div
            style={{
              fontSize: "28px",
              fontWeight: 700,
              marginTop: "6px",
            }}
          >
            {rejectedCount}
          </div>
        </div>

        <div
          className="candidates-card"
          style={{
            padding: "20px",
          }}
        >
          <div
            style={{
              color: "#6b7280",
              fontSize: "14px",
            }}
          >
            Processing
          </div>

          <div
            style={{
              fontSize: "28px",
              fontWeight: 700,
              marginTop: "6px",
            }}
          >
            {processingCount}
          </div>
        </div>
      </div>

      {/* =====================================================
          CANDIDATES TABLE
      ====================================================== */}
      <div className="candidates-card">
        <div className="candidates-card-header">
          <div>
            <h2>
              {selectedJob
                ? `Candidates — ${
                    selectedJob.job_title
                  }`
                : "All Candidates"}
            </h2>

            <span>
              {filteredCandidates.length} candidate
              {filteredCandidates.length !== 1
                ? "s"
                : ""}
            </span>
          </div>
        </div>

        {loadingCandidates ? (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              color: "#6b7280",
            }}
          >
            Loading candidates...
          </div>
        ) : filteredCandidates.length === 0 ? (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              color: "#6b7280",
            }}
          >
            {selectedJob
              ? "No candidates found for this job."
              : "No candidates found."}
          </div>
        ) : (
          <table className="candidates-table">
            <thead>
              <tr>
                <th>Candidate</th>

                <th>Applied Position</th>

                <th>Match Score</th>

                <th>Status</th>

                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredCandidates.map((candidate) => {
                const shortlisted = isShortlistedDecision(
                  candidate.decision
                );
                
                const rejected = isRejectedDecision(
                  candidate.decision
                );
                return (
                  <tr
                    key={`${candidate.job_id}-${candidate.candidate_id}`}
                  >
                    {/* Candidate */}
                    <td>
                      <div className="candidate-info">
                        <div className="candidate-avatar">
                          {(candidate.name || "?")
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div>
                          <strong>
                            {candidate.name ||
                              "Unknown"}
                          </strong>

                          <small>
                            {candidate.email || "—"}
                          </small>
                        </div>
                      </div>
                    </td>

                    {/* Job */}
                    <td>
                      {candidate.job || "—"}
                    </td>

                    {/* Score */}
                    <td>
                      <strong>
                        {candidate.final_score !==
                          null &&
                        candidate.final_score !==
                          undefined
                          ? `${Math.round(
                              candidate.final_score
                            )}%`
                          : "—"}
                      </strong>
                    </td>

                   {/* Status */}
<td>
  <span
    className={
      shortlisted
        ? "status shortlisted"
        : rejected
        ? "status rejected"
        : "status"
    }
  >
    {shortlisted
      ? "Shortlisted"
      : rejected
      ? "Rejected"
      : "Processing"}
  </span>
</td>

                    {/* Action */}
                    <td>
                      <button
                        className="view-button"
                        onClick={() =>
                          setSelectedCandidate(
                            candidate
                          )
                        }
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* =====================================================
          CANDIDATE DETAILS MODAL
      ====================================================== */}
      {selectedCandidate && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor:
              "rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
          onClick={() =>
            setSelectedCandidate(null)
          }
        >
          <div
            style={{
              background: "#ffffff",
              width: "100%",
              maxWidth: "760px",
              maxHeight: "85vh",
              overflowY: "auto",
              borderRadius: "12px",
              padding: "28px",
              boxShadow:
                "0 20px 50px rgba(0,0,0,0.2)",
            }}
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
                marginBottom: "24px",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                  }}
                >
                  {selectedCandidate.name ||
                    "Unknown Candidate"}
                </h2>

                <p
                  style={{
                    margin:
                      "6px 0 0",
                    color: "#6b7280",
                  }}
                >
                  {selectedCandidate.job ||
                    "—"}
                </p>
              </div>

              <button
                onClick={() =>
                  setSelectedCandidate(null)
                }
                style={{
                  border: "none",
                  background:
                    "#f3f4f6",
                  borderRadius: "8px",
                  width: "36px",
                  height: "36px",
                  cursor: "pointer",
                  fontSize: "20px",
                }}
              >
                ×
              </button>
            </div>

            {/* Candidate Basic Information */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "1fr 1fr",
                gap: "18px",
              }}
            >
              <div>
                <strong>Email</strong>
                <p>
                  {displayValue(
                    selectedCandidate.email
                  )}
                </p>
              </div>

              <div>
                <strong>Phone</strong>
                <p>
                  {displayValue(
                    selectedCandidate.phone
                  )}
                </p>
              </div>

              <div>
                <strong>Location</strong>
                <p>
                  {displayValue(
                    selectedCandidate.location
                  )}
                </p>
              </div>

              <div>
                <strong>Education</strong>
                <p>
                  {displayValue(
                    selectedCandidate.education
                  )}
                </p>
              </div>

              <div>
                <strong>Applied Position</strong>
                <p>
                  {displayValue(
                    selectedCandidate.job
                  )}
                </p>
              </div>

              <div>
                <strong>Match Score</strong>
                <p>
                  {selectedCandidate.final_score !==
                    null &&
                  selectedCandidate.final_score !==
                    undefined
                    ? `${Math.round(
                        selectedCandidate.final_score
                      )}%`
                    : "—"}
                </p>
              </div>
              <div>
  <strong>Status</strong>
  <p>
    {isShortlistedDecision(
      selectedCandidate.decision
    )
      ? "Shortlisted"
      : isRejectedDecision(
          selectedCandidate.decision
        )
      ? "Rejected"
      : "Processing"}
  </p>
</div>
            </div>

            {/* Skills */}
            <div
              style={{
                marginTop: "20px",
              }}
            >
              <strong>Skills</strong>

              <p>
                {displayList(
                  selectedCandidate.skills
                )}
              </p>
            </div>

            {/* Experience */}
            <div
              style={{
                marginTop: "20px",
              }}
            >
              <strong>Experience</strong>

              <p>
                {displayValue(
                  selectedCandidate.experience
                )}
              </p>
            </div>

            {/* Projects */}
            <div
              style={{
                marginTop: "20px",
              }}
            >
              <strong>Projects</strong>

              <p>
                {displayValue(
                  selectedCandidate.projects
                )}
              </p>
            </div>

            {/* Certifications */}
            <div
              style={{
                marginTop: "20px",
              }}
            >
              <strong>Certifications</strong>

              <p>
                {displayValue(
                  selectedCandidate.certifications
                )}
              </p>
            </div>

            {/* Strengths */}
            <div
              style={{
                marginTop: "20px",
              }}
            >
              <strong>Strengths</strong>

              <p>
                {displayValue(
                  selectedCandidate.strengths
                )}
              </p>
            </div>

            {/* Gaps */}
            <div
              style={{
                marginTop: "20px",
              }}
            >
              <strong>Gaps</strong>

              <p>
                {displayValue(
                  selectedCandidate.gaps
                )}
              </p>
            </div>

            {/* JD Alignment */}
            <div
              style={{
                marginTop: "20px",
              }}
            >
              <strong>
                JD Alignment Notes
              </strong>

              <p
                style={{
                  whiteSpace: "pre-wrap",
                }}
              >
                {displayValue(
                  selectedCandidate.jd_alignment_notes
                )}
              </p>
            </div>

            {/* Close */}
            <div
              style={{
                marginTop: "24px",
                display: "flex",
                justifyContent:
                  "flex-end",
              }}
            >
              <button
                className="view-button"
                onClick={() =>
                  setSelectedCandidate(null)
                }
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Candidates;