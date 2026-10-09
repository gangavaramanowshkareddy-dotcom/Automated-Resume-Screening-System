import { useEffect, useRef, useState } from "react";
import apiClient from "../api/client";

const GOOGLE_SHEETS_URL =
  "https://docs.google.com/spreadsheets/d/1KRWgr4JzxuIYETaX1xKdmLQgO86pD7ZPW87xQ8O3F3w/edit?gid=0#gid=0";

function Screening() {
  const [step, setStep] = useState(1);

  const [jobDetails, setJobDetails] = useState({
    jobId: "",
    jobTitle: "",
    jobDescription: "",
    requiredSkills: "",
    experience: "",
  });

  const [files, setFiles] = useState([]);
  const fileInputRef = useRef(null);
  const pollingCancelled = useRef(false);

  const [validationError, setValidationError] = useState("");
  const [backendScreeningId, setBackendScreeningId] = useState(null);

  const [results, setResults] = useState([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Screening configuration
  const [weights, setWeights] = useState({
    requiredSkills: 40,
    experience: 20,
    education: 15,
    projects: 15,
    preferredSkills: 5,
    alignment: 5,
  });

  const [threshold, setThreshold] = useState(70);

  const handleJobChange = (e) => {
    const { name, value } = e.target;

    setJobDetails((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleJobNext = () => {
    if (
      !jobDetails.jobTitle.trim() ||
      !jobDetails.jobDescription.trim() ||
      !jobDetails.requiredSkills.trim() ||
      !jobDetails.experience.trim()
    ) {
      setValidationError("Please fill in all required job details.");
      return;
    }

    setValidationError("");
    setStep(2);
  };

  const handleFiles = (selectedFiles) => {
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
    ];

    const validFiles = Array.from(selectedFiles).filter((file) =>
      allowedTypes.includes(file.type)
    );

    setFiles((previousFiles) => {
      const existingNames = new Set(
        previousFiles.map((file) => file.name)
      );

      const newFiles = validFiles.filter(
        (file) => !existingNames.has(file.name)
      );

      return [...previousFiles, ...newFiles];
    });
  };

  const handleFileInput = (e) => {
    handleFiles(e.target.files);
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const removeFile = (fileName) => {
    setFiles((previousFiles) =>
      previousFiles.filter((file) => file.name !== fileName)
    );
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024 * 1024) {
      return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (file) => {
    if (file.type === "application/pdf") return "📄";
    if (file.type.includes("word")) return "📝";
    return "🖼️";
  };

  const handleUploadNext = () => {
    if (files.length === 0) {
      setValidationError("Please upload at least one resume.");
      return;
    }

    setValidationError("");
    setStep(3);
  };

  // Update a scoring weight
  const handleWeightChange = (name, value) => {
    setWeights((previous) => ({
      ...previous,
      [name]: Number(value),
    }));
  };

  // Calculate total weight
  const totalWeight = Object.values(weights).reduce(
    (total, value) => total + value,
    0
  );

  const loadResults = async (jobId) => {
    pollingCancelled.current = false;
    setResultsLoading(true);
    setResultsError("");

    const maxAttempts = 360;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (pollingCancelled.current) {
        setResultsLoading(false);
        return;
      }

      try {
        const response = await apiClient.get(
          `/api/jobs/${jobId}/results`
        );

        const data = response.data || {};

        const currentResults = Array.isArray(data.results)
          ? data.results
          : [];

        // Update results whenever new results are available
        setResults(currentResults);

        // Count completed decisions
        const completedResults = currentResults.filter(
          (candidate) => {
            const decision = String(candidate.decision || "")
              .trim()
              .toUpperCase();

            return (
              decision === "SHORTLIST" ||
              decision === "SHORTLISTED" ||
              decision === "REJECT" ||
              decision === "REJECTED"
            );
          }
        );

        // Stop only when every uploaded resume has a completed result
        if (
          files.length > 0 &&
          currentResults.length >= files.length &&
          completedResults.length >= files.length
        ) {
          setResultsLoading(false);
          return;
        }
      } catch (error) {
        console.error("Result fetch failed:", error);

        if (attempt === maxAttempts - 1) {
          setResultsError(
            error.response?.data?.detail ||
              "Unable to load screening results from the backend."
          );

          setResultsLoading(false);
          return;
        }
      }

      // Check again after 5 seconds
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    setResultsLoading(false);

    setResultsError(
      "Screening is taking longer than expected. Please refresh the results later."
    );
  };

  // Start screening
  const handleStartScreening = async () => {
    if (totalWeight !== 100) {
      setValidationError(
        `Total weight must be 100%. Current total is ${totalWeight}%`
      );
      return;
    }

    setValidationError("");

    try {
      setResults([]);
      setResultsError("");
      setStep(4);
      setResultsLoading(true);

      const jobResponse = await apiClient.post(
        "/api/jobs",
        {
          job_title: jobDetails.jobTitle.trim(),
          job_description: jobDetails.jobDescription.trim(),
          required_skills: jobDetails.requiredSkills
            .split(",")
            .map((skill) => skill.trim())
            .filter(Boolean),
          preferred_skills: null,
          required_education: null,
          required_experience: jobDetails.experience.trim(),
          other_requirements: null,
          threshold,
          required_skills_weight: weights.requiredSkills,
          relevant_experience_weight: weights.experience,
          education_weight: weights.education,
          projects_weight: weights.projects,
          preferred_skills_weight: weights.preferredSkills,
          overall_alignment_weight: weights.alignment,
        }
      );

      const createdJobId = jobResponse.data.id;

      localStorage.setItem(
        "last_screening_job_id",
        String(createdJobId)
      );

      const formData = new FormData();

      files.forEach((file) => {
        formData.append("files", file);
      });

      await apiClient.post(
        `/api/jobs/${createdJobId}/resumes`,
        formData
      );

      const screeningResponse = await apiClient.post(
        `/api/jobs/${createdJobId}/screen`,
        {}
      );

      const createdScreeningId =
        screeningResponse.data.screening_id;

      setBackendScreeningId(createdScreeningId);

      await loadResults(createdJobId);
    } catch (error) {
      console.error("Screening start failed:", error);

      setResultsLoading(false);

      setResultsError(
        error.response?.data?.detail ||
          "Unable to start screening. Please check the backend and n8n."
      );
    }
  };

  const goBack = () => {
    setStep((previousStep) =>
      Math.max(1, previousStep - 1)
    );
  };

  return (
    <div className="screening-page">
      {validationError && (
        <div className="validation-error">
          {validationError}
        </div>
      )}

      <div className="screening-header">
        <div>
          <p>
            Create and configure a new candidate screening.
          </p>
        </div>

        <div className="screening-step-text">
          Step {step} of 4
        </div>
      </div>

      {/* Progress */}
      <div className="screening-progress">
        <div
          className={`progress-step ${
            step >= 1 ? "active" : ""
          }`}
        >
          <div className="step-circle">1</div>
          <span>Job Details</span>
        </div>

        <div
          className={`progress-line ${
            step >= 2 ? "active" : ""
          }`}
        />

        <div
          className={`progress-step ${
            step >= 2 ? "active" : ""
          }`}
        >
          <div className="step-circle">2</div>
          <span>Upload Resumes</span>
        </div>

        <div
          className={`progress-line ${
            step >= 3 ? "active" : ""
          }`}
        />

        <div
          className={`progress-step ${
            step >= 3 ? "active" : ""
          }`}
        >
          <div className="step-circle">3</div>
          <span>Configuration</span>
        </div>

        <div
          className={`progress-line ${
            step >= 4 ? "active" : ""
          }`}
        />

        <div
          className={`progress-step ${
            step >= 4 ? "active" : ""
          }`}
        >
          <div className="step-circle">4</div>
          <span>Results</span>
        </div>
      </div>

      {/* STEP 1 — JOB DETAILS */}
      {step === 1 && (
        <div className="screening-card">
          <div className="card-heading">
            <h2>Job Details</h2>

            <p>
              Enter the job information that will be used to
              evaluate candidates.
            </p>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="jobId">
                Job ID
              </label>

              <input
                id="jobId"
                name="jobId"
                type="text"
                placeholder="e.g. JOB-001"
                value={jobDetails.jobId}
                onChange={handleJobChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="jobTitle">
                Job Title <span>*</span>
              </label>

              <input
                id="jobTitle"
                name="jobTitle"
                type="text"
                placeholder="e.g. AI/ML Engineer"
                value={jobDetails.jobTitle}
                onChange={handleJobChange}
              />
            </div>

            <div className="form-group full-width">
              <label htmlFor="jobDescription">
                Job Description <span>*</span>
              </label>

              <textarea
                id="jobDescription"
                name="jobDescription"
                rows="7"
                placeholder="Enter the complete job description..."
                value={jobDetails.jobDescription}
                onChange={handleJobChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="requiredSkills">
                Required Skills <span>*</span>
              </label>

              <input
                id="requiredSkills"
                name="requiredSkills"
                type="text"
                placeholder="e.g. Python, SQL, Machine Learning"
                value={jobDetails.requiredSkills}
                onChange={handleJobChange}
              />

              <small>
                Separate multiple skills with commas.
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="experience">
                Required Experience <span>*</span>
              </label>

              <input
                id="experience"
                name="experience"
                type="text"
                placeholder="e.g. 2+ years"
                value={jobDetails.experience}
                onChange={handleJobChange}
              />
            </div>
          </div>

          <div className="screening-card-footer">
            <button
              type="button"
              className="cancel-button"
              onClick={() => window.history.back()}
            >
              Cancel
            </button>

            <button
              type="button"
              className="next-button"
              onClick={handleJobNext}
            >
              Continue to Resume Upload →
            </button>
          </div>
        </div>
      )}

      {/* STEP 2 — RESUME UPLOAD */}
      {step === 2 && (
        <div className="screening-card upload-screen">
          <div className="card-heading">
            <h2>Upload Resumes</h2>

            <p>
              Upload candidate resumes to begin the screening
              process.
            </p>
          </div>

          <div className="upload-layout">
            <div className="upload-main">
              <div
                className="drop-zone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() =>
                  fileInputRef.current?.click()
                }
              >
                <div className="upload-icon">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h.79a4.5 4.5 0 0 1 1 8.89" />
                    <path d="M12 12v6" />
                    <path d="m9 15 3-3 3 3" />
                  </svg>
                </div>

                <h3>Drag & Drop files here</h3>

                <p>
                  or click to browse from your computer
                </p>

                <button
                  type="button"
                  className="browse-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  Browse Files
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.jpg,.jpeg"
                  onChange={handleFileInput}
                  style={{ display: "none" }}
                />
              </div>

              <div className="uploaded-files">
                <div className="uploaded-files-header">
                  <h3>Uploaded Files</h3>
                  <span>{files.length}</span>
                </div>

                {files.length === 0 ? (
                  <div className="empty-upload-message">
                    No resumes uploaded yet.
                  </div>
                ) : (
                  <div className="file-list">
                    {files.map((file) => (
                      <div
                        className="file-item"
                        key={file.name}
                      >
                        <div className="file-icon">
                          {getFileIcon(file)}
                        </div>

                        <div className="file-info">
                          <div className="file-name">
                            {file.name}
                          </div>

                          <div className="file-size">
                            {formatFileSize(file.size)}
                          </div>

                          <div className="file-progress">
                            <div className="file-progress-bar" />
                          </div>
                        </div>

                        <div className="file-status">✓</div>

                        <button
                          type="button"
                          className="remove-file-button"
                          onClick={() =>
                            removeFile(file.name)
                          }
                          title="Remove file"
                          aria-label={`Remove ${file.name}`}
                        >
                          <svg
                            width="15"
                            height="15"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M3 6h18" />
                            <path d="M8 6V4h8v2" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v5" />
                            <path d="M14 11v5" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="upload-info">
              <div className="info-section">
                <h3>Supported Formats</h3>

                <ul>
                  <li>PDF Document (.pdf)</li>
                  <li>Word Document (.docx)</li>
                  <li>JPEG Image (.jpg, .jpeg)</li>
                </ul>

                <p className="info-note">
                  Scanned resumes can also be processed using OCR.
                </p>
              </div>

              <div className="smart-tip">
                <div className="smart-tip-title">
                  ✦ Smart Review Tip
                </div>

                <p>
                  Our AI automatically extracts relevant candidate
                  information and standardizes formatting for fair
                  comparison.
                </p>
              </div>
            </div>
          </div>

          <div className="screening-card-footer">
            <button
              type="button"
              className="cancel-button"
              onClick={goBack}
            >
              ← Back
            </button>

            <button
              type="button"
              className="next-button"
              onClick={handleUploadNext}
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 — SCREENING CONFIGURATION */}
      {step === 3 && (
        <div className="configuration-layout">
          {/* LEFT — CONFIGURATION */}
          <div className="screening-card configuration-card">
            <div className="card-heading">
              <h2>Screening Configuration</h2>

              <p>
                Adjust the scoring weights used to evaluate
                candidates.
              </p>
            </div>

            <div className="weight-list">
              {/* Required Skills */}
              <div className="weight-row">
                <div className="weight-label">
                  <span>Required Skills</span>
                  <strong>
                    {weights.requiredSkills}%
                  </strong>
                </div>

                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={weights.requiredSkills}
                  onChange={(e) =>
                    handleWeightChange(
                      "requiredSkills",
                      e.target.value
                    )
                  }
                />
              </div>

              {/* Experience */}
              <div className="weight-row">
                <div className="weight-label">
                  <span>Experience</span>
                  <strong>
                    {weights.experience}%
                  </strong>
                </div>

                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={weights.experience}
                  onChange={(e) =>
                    handleWeightChange(
                      "experience",
                      e.target.value
                    )
                  }
                />
              </div>

              {/* Education */}
              <div className="weight-row">
                <div className="weight-label">
                  <span>Education</span>
                  <strong>
                    {weights.education}%
                  </strong>
                </div>

                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={weights.education}
                  onChange={(e) =>
                    handleWeightChange(
                      "education",
                      e.target.value
                    )
                  }
                />
              </div>

              {/* Projects */}
              <div className="weight-row">
                <div className="weight-label">
                  <span>Projects</span>
                  <strong>
                    {weights.projects}%
                  </strong>
                </div>

                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={weights.projects}
                  onChange={(e) =>
                    handleWeightChange(
                      "projects",
                      e.target.value
                    )
                  }
                />
              </div>

              {/* Preferred Skills */}
              <div className="weight-row">
                <div className="weight-label">
                  <span>Preferred Skills</span>
                  <strong>
                    {weights.preferredSkills}%
                  </strong>
                </div>

                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={weights.preferredSkills}
                  onChange={(e) =>
                    handleWeightChange(
                      "preferredSkills",
                      e.target.value
                    )
                  }
                />
              </div>

              {/* Alignment */}
              <div className="weight-row">
                <div className="weight-label">
                  <span>Alignment</span>
                  <strong>
                    {weights.alignment}%
                  </strong>
                </div>

                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={weights.alignment}
                  onChange={(e) =>
                    handleWeightChange(
                      "alignment",
                      e.target.value
                    )
                  }
                />
              </div>
            </div>

            {/* Total Weight */}
            <div className="total-weight">
              <span>TOTAL WEIGHT</span>

              <strong
                className={
                  totalWeight === 100
                    ? "weight-valid"
                    : "weight-invalid"
                }
              >
                {totalWeight}%
              </strong>
            </div>

            {/* Passing Threshold */}
            <div className="threshold-box">
              <div className="threshold-header">
                <div>
                  <strong>Passing Threshold</strong>

                  <small>
                    Minimum score required to shortlist.
                  </small>
                </div>

                <div className="threshold-value">
                  {threshold}%
                </div>
              </div>

              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={threshold}
                onChange={(e) =>
                  setThreshold(Number(e.target.value))
                }
              />
            </div>
          </div>

          {/* RIGHT — REVIEW */}
          <div className="review-card">
            <div className="review-heading">
              <h2>Review Screening</h2>
            </div>

            <div className="review-items">
              <div className="review-item">
                <span className="review-check">✓</span>

                <div>
                  <strong>Job Description Loaded</strong>
                  <p>
                    {jobDetails.jobTitle ||
                      "Job details ready"}
                  </p>
                </div>
              </div>

              <div className="review-item">
                <span className="review-check">✓</span>

                <div>
                  <strong>Resume Processing</strong>
                  <p>
                    {files.length} resume(s) uploaded
                  </p>
                </div>
              </div>

              <div className="review-item">
                <span className="review-check">✓</span>

                <div>
                  <strong>Threshold Set</strong>
                  <p>
                    Minimum score: {threshold}%
                  </p>
                </div>
              </div>

              <div className="review-item">
                <span className="review-check">✓</span>

                <div>
                  <strong>Configuration Valid</strong>

                  <p>
                    Weights equal {totalWeight}%
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="start-screening-button"
              onClick={handleStartScreening}
            >
              Start Screening ▶
            </button>

            <div className="estimated-time">
              Estimated time: ~2 mins
            </div>
          </div>

          {/* FOOTER */}
          <div className="configuration-footer">
            <button
              type="button"
              className="cancel-button"
              onClick={goBack}
            >
              ← Back
            </button>
          </div>
        </div>
      )}

      {/* STEP 4 — SCREENING OUTPUT */}
      {step === 4 && (
        <div className="results-page">
          <div className="results-header">
            <div>
              <h1>Screening Output</h1>

              <p>
                Final review and summary for the recent
                candidate batch.
              </p>
            </div>

            <button
              type="button"
              className="export-sheets-button"
              onClick={() => {
                window.open(
                  GOOGLE_SHEETS_URL,
                  "_blank"
                );
              }}
            >
              ↗ Visit Google Sheets
            </button>
          </div>

          <div className="results-summary-cards">
            <div className="result-summary-card">
              <span className="summary-label">
                JOB TITLE
              </span>

              <strong>
                {jobDetails.jobTitle || "—"}
              </strong>
            </div>

            <div className="result-summary-card">
              <span className="summary-label">
                TOTAL CANDIDATES
              </span>

              <strong>{files.length}</strong>
            </div>

            <div className="result-summary-card shortlisted-card">
              <div className="summary-card-top">
                <span className="summary-label">
                  SHORTLISTED
                </span>

                <span className="summary-status-icon success">
                  ✓
                </span>
              </div>

              <strong>
                {
                  results.filter((candidate) => {
                    const decision = String(
                      candidate.decision || ""
                    ).toUpperCase();

                    return (
                      decision === "SHORTLIST" ||
                      decision === "SHORTLISTED"
                    );
                  }).length
                }
              </strong>
            </div>

            <div className="result-summary-card rejected-card">
              <div className="summary-card-top">
                <span className="summary-label">
                  REJECTED
                </span>

                <span className="summary-status-icon danger">
                  ×
                </span>
              </div>

              <strong>
                {
                  results.filter((candidate) => {
                    const decision = String(
                      candidate.decision || ""
                    ).toUpperCase();

                    return (
                      decision === "REJECT" ||
                      decision === "REJECTED"
                    );
                  }).length
                }
              </strong>
            </div>
          </div>

          <div className="candidate-results-card">
            <div className="candidate-results-header">
              <h2>Candidate Details</h2>

              <div className="candidate-search">
                <span>⌕</span>

                <input
                  type="text"
                  placeholder="Search candidates..."
                  value={searchTerm}
                  onChange={(e) =>
                    setSearchTerm(e.target.value)
                  }
                />
              </div>
            </div>

            <div className="results-table">
              <div className="results-table-header">
                <span>CANDIDATE NAME</span>
                <span>APPLIED DATE</span>
                <span>MATCH SCORE</span>
                <span>STATUS</span>
              </div>

              {resultsLoading && results.length === 0 ? (
                <div className="results-empty">
                  <div>Processing resumes...</div>

                  <button
                    type="button"
                    className="cancel-screening-button"
                    onClick={async () => {
                      pollingCancelled.current = true;

                      try {
                        if (!backendScreeningId) {
                          setResultsError(
                            "Unable to cancel screening because the screening ID is missing."
                          );

                          return;
                        }

                        await apiClient.post(
                          `/api/screenings/${backendScreeningId}/cancel`,
                          {}
                        );

                        setResults([]);
                        setResultsError(
                          "Screening cancelled successfully."
                        );
                      } catch (error) {
                        console.error(
                          "Screening cancellation failed:",
                          error
                        );

                        setResultsError(
                          error.response?.data?.detail ||
                            "Unable to cancel the screening. Please try again."
                        );
                      } finally {
                        setResultsLoading(false);
                      }
                    }}
                  >
                    Cancel Screening
                  </button>
                </div>
              ) : resultsError &&
                results.length === 0 ? (
                <div className="results-empty">
                  {resultsError}
                </div>
              ) : results.length === 0 ? (
                <div className="results-empty">
                  No screening results available yet.
                </div>
              ) : (
                results
                  .filter((candidate) =>
                    String(candidate.name || "")
                      .toLowerCase()
                      .includes(
                        searchTerm.toLowerCase()
                      )
                  )
                  .map((candidate) => {
                    const decision = String(
                      candidate.decision || ""
                    ).toUpperCase();

                    const score =
                      candidate.final_score !== null &&
                      candidate.final_score !== undefined
                        ? Number(candidate.final_score)
                        : null;

                    return (
                      <div
                        className="results-table-row"
                        key={candidate.candidate_id}
                      >
                        <span className="candidate-name-cell">
                          {candidate.name ||
                            "Unknown Candidate"}
                        </span>

                        <span>—</span>

                        <span className="score-cell">
                          {score !== null
                            ? `${score.toFixed(0)}%`
                            : "—"}
                        </span>

                        <span>
                          <span
                            className={
                              decision ===
                                "SHORTLIST" ||
                              decision ===
                                "SHORTLISTED"
                                ? "status-shortlisted"
                                : decision ===
                                      "REJECT" ||
                                  decision ===
                                      "REJECTED"
                                ? "status-rejected"
                                : "status-pending"
                            }
                          >
                            {decision ===
                              "SHORTLIST" ||
                            decision ===
                              "SHORTLISTED"
                              ? "Shortlisted"
                              : decision ===
                                    "REJECT" ||
                                decision ===
                                    "REJECTED"
                              ? "Rejected"
                              : "Processing"}
                          </span>
                        </span>
                      </div>
                    );
                  })
              )}
            </div>

            <div className="results-pagination">
              <span>
                Showing 1 to {results.length} of{" "}
                {results.length} entries
              </span>

              <div className="pagination-buttons">
                <button
                  type="button"
                  disabled
                >
                  Previous
                </button>

                <button
                  type="button"
                  className="pagination-active"
                >
                  1
                </button>

                <button
                  type="button"
                  disabled
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          <div className="results-footer">
            <button
              type="button"
              className="cancel-button"
              onClick={goBack}
            >
              ← Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Screening;