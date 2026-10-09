import { useEffect, useState } from "react";

import { useNavigate } from "react-router-dom";

import {
  BriefcaseBusiness,
  Users,
  ScanSearch,
  TrendingUp,
  Upload,
  UserCheck,
  UserX,
  Trophy,
  ArrowRight,
} from "lucide-react";

import apiClient from "../api/client";

function Dashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);

  const [dashboardData, setDashboardData] = useState({
    jobTitle: "",
    totalJobs: 0,
    totalCandidates: 0,
    screenings: 0,
    averageScore: null,
    shortlisted: 0,
    rejected: 0,
    uploaded: 0,
    screened: 0,
    pending: 0,
    screeningStatus: "",
    topCandidate: null,
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const response = await apiClient.get(
        "/api/dashboard/overview"
      );

      const data = response.data || {};

      setDashboardData({
        jobTitle: data.job_title || "",

        totalJobs:
          typeof data.total_jobs === "number"
            ? data.total_jobs
            : 0,

        totalCandidates:
          typeof data.total_candidates === "number"
            ? data.total_candidates
            : 0,

        screenings:
          typeof data.total_screenings === "number"
            ? data.total_screenings
            : 0,

        averageScore:
          typeof data.average_score === "number"
            ? data.average_score
            : null,

        shortlisted:
          typeof data.shortlisted === "number"
            ? data.shortlisted
            : 0,

        rejected:
          typeof data.rejected === "number"
            ? data.rejected
            : 0,

        uploaded:
          typeof data.latest_screening_uploaded === "number"
            ? data.latest_screening_uploaded
            : 0,

        screened:
          typeof data.latest_screening_screened === "number"
            ? data.latest_screening_screened
            : 0,

        pending:
          typeof data.latest_screening_pending === "number"
            ? data.latest_screening_pending
            : 0,

        screeningStatus:
          data.latest_screening_status || "",

        topCandidate:
          data.top_candidate || null,
      });
    } catch (error) {
      console.error(
        "Failed to load dashboard:",
        error
      );

      setDashboardData({
        jobTitle: "",
        totalJobs: 0,
        totalCandidates: 0,
        screenings: 0,
        averageScore: null,
        shortlisted: 0,
        rejected: 0,
        uploaded: 0,
        screened: 0,
        pending: 0,
        screeningStatus: "",
        topCandidate: null,
      });
    } finally {
      setLoading(false);
    }
  };

  const {
    jobTitle,
    totalJobs,
    totalCandidates,
    screenings,
    averageScore,
    shortlisted,
    rejected,
    uploaded,
    screened,
    pending,
    screeningStatus,
    topCandidate,
  } = dashboardData;

  const shortlistedPercentage =
    screened > 0
      ? Math.min(
          (shortlisted / screened) * 100,
          100
        )
      : 0;

  const rejectedPercentage =
    screened > 0
      ? Math.min(
          (rejected / screened) * 100,
          100
        )
      : 0;

  return (
    <div className="dashboard-page">

      {/* PAGE HEADER */}
      <div className="page-header">
        <div>
          <span className="page-eyebrow">
            OVERVIEW
          </span>

          <h1>Dashboard</h1>

          <p>
            Monitor your resume screening activity and
            candidate results.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={() => navigate("/screening")}
        >
          <ScanSearch size={17} />
          New Screening
        </button>
      </div>


      {/* SUMMARY CARDS */}
      <div className="dashboard-cards">

        <div className="dashboard-card">
          <div className="dashboard-card-icon">
            <BriefcaseBusiness size={21} />
          </div>

          <div>
            <span>Total Jobs</span>
            <strong>{totalJobs}</strong>
          </div>
        </div>


        <div className="dashboard-card">
          <div className="dashboard-card-icon">
            <Users size={21} />
          </div>

          <div>
            <span>Total Candidates</span>
            <strong>{totalCandidates}</strong>
          </div>
        </div>


        <div className="dashboard-card">
          <div className="dashboard-card-icon">
            <ScanSearch size={21} />
          </div>

          <div>
            <span>Screenings</span>
            <strong>{screenings}</strong>
          </div>
        </div>


        <div className="dashboard-card">
          <div className="dashboard-card-icon">
            <TrendingUp size={21} />
          </div>

          <div>
            <span>Average Score</span>

            <strong>
              {averageScore !== null
                ? `${averageScore}%`
                : "—"}
            </strong>
          </div>
        </div>

      </div>


      {/* LATEST SCREENING FUNNEL */}
      <div className="dashboard-section screening-funnel-section">

        <div className="section-heading">
          <h2>
            Latest Screening
          </h2>

          <p>
            {jobTitle
              ? `Overview of the latest resume screening for ${jobTitle}.`
              : "Overview of the latest resume screening process."}
          </p>
        </div>


        <div className="screening-funnel">

          {/* UPLOADED */}
          <div className="funnel-step">

            <div className="funnel-icon">
              <Upload size={20} />
            </div>

            <div className="funnel-content">
              <span>
                Resumes Uploaded
              </span>

              <strong>
                {uploaded}
              </strong>
            </div>

          </div>


          <ArrowRight
            className="funnel-arrow"
            size={20}
          />


          {/* SCREENED */}
          <div className="funnel-step">

            <div className="funnel-icon">
              <ScanSearch size={20} />
            </div>

            <div className="funnel-content">
              <span>
                Resumes Screened
              </span>

              <strong>
                {screened}
              </strong>
            </div>

          </div>


          <ArrowRight
            className="funnel-arrow"
            size={20}
          />


          {/* SHORTLISTED */}
          <div className="funnel-step">

            <div className="funnel-icon">
              <UserCheck size={20} />
            </div>

            <div className="funnel-content">
              <span>
                Shortlisted
              </span>

              <strong>
                {shortlisted}
              </strong>
            </div>

          </div>


          <ArrowRight
            className="funnel-arrow"
            size={20}
          />


          {/* REJECTED */}
          <div className="funnel-step">

            <div className="funnel-icon">
              <UserX size={20} />
            </div>

            <div className="funnel-content">
              <span>
                Rejected
              </span>

              <strong>
                {rejected}
              </strong>
            </div>

          </div>

        </div>


        {/* SCREENING STATUS */}
        {(screeningStatus || pending > 0) && (
          <div className="dashboard-screening-status">

            <span>
              Screening Status
            </span>

            <strong>
              {pending > 0
                ? `${pending} resume${
                    pending === 1 ? "" : "s"
                  } pending`
                : screeningStatus
                    ? screeningStatus.charAt(0).toUpperCase() +
                      screeningStatus.slice(1)
                    : "Completed"}
            </strong>

          </div>
        )}

      </div>


      {/* TOP CANDIDATE */}
      <div className="dashboard-section top-candidate-section">

        <div className="section-heading">

          <h2>
            Top Candidate
          </h2>

          <p>
            Highest-scoring candidate from the latest screening.
          </p>

        </div>


        {topCandidate ? (

          <div className="top-candidate-card">

            <div className="top-candidate-icon">
              <Trophy size={24} />
            </div>


            <div className="top-candidate-info">

              <span className="top-candidate-label">
                TOP MATCH
              </span>

              <h3>
                {topCandidate.name ||
                  "Unnamed Candidate"}
              </h3>

              <p>
                {topCandidate.email ||
                  "No email available"}
              </p>

            </div>


            <div className="top-candidate-score">

              <span>
                Match Score
              </span>

              <strong>
                {typeof topCandidate.final_score ===
                "number"
                  ? `${Math.round(
                      topCandidate.final_score
                    )}%`
                  : "—"}
              </strong>

            </div>

          </div>

        ) : (

          <div className="empty-state">

            <Trophy size={30} />

            <h3>
              No screening results yet
            </h3>

            <p>
              Run a resume screening to see the top
              candidate here.
            </p>

          </div>

        )}

      </div>


      {/* SCREENING OVERVIEW */}
      <div className="dashboard-section">

        <div className="section-heading">

          <h2>
            Screening Overview
          </h2>

          <p>
            Candidate distribution from the latest screening.
          </p>

        </div>


        <div className="screening-overview">

          {/* SHORTLISTED */}
          <div className="overview-item">

            <div className="overview-label">

              <span>
                Shortlisted
              </span>

              <strong>
                {shortlisted}
              </strong>

            </div>


            <div className="overview-bar">

              <div
                className="overview-bar-fill shortlisted"
                style={{
                  width: `${shortlistedPercentage}%`,
                }}
              />

            </div>

          </div>


          {/* REJECTED */}
          <div className="overview-item">

            <div className="overview-label">

              <span>
                Rejected
              </span>

              <strong>
                {rejected}
              </strong>

            </div>


            <div className="overview-bar">

              <div
                className="overview-bar-fill rejected"
                style={{
                  width: `${rejectedPercentage}%`,
                }}
              />

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}

export default Dashboard;