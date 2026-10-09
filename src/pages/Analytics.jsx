import React, { useEffect, useState } from "react";
import apiClient from "../api/client";

function Analytics() {
  const [analytics, setAnalytics] = useState({
    totalCandidates: 0,
    shortlisted: 0,
    rejected: 0,
    averageScore: 0,
    topJobs: [],
    scoreDistribution: {
      excellent: 0,
      veryGood: 0,
      good: 0,
      average: 0,
      low: 0,
    },
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

 

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      const lastJobId = localStorage.getItem("last_screening_job_id");

      if (!lastJobId) {
        setAnalytics({
          totalCandidates: 0,
          shortlisted: 0,
          rejected: 0,
          averageScore: 0,
          topJobs: [],
          scoreDistribution: {
            excellent: 0,
            veryGood: 0,
            good: 0,
            average: 0,
            low: 0,
          },
        });

        setLoading(false);
        return;
      }

      const response = await apiClient.get(
        `/api/jobs/${lastJobId}/candidates`,
        
      );

      const data = response.data || {};

      const candidates = Array.isArray(data.candidates)
        ? data.candidates
        : [];

      const totalCandidates = candidates.length;

      const shortlisted = candidates.filter((candidate) => {
        const decision = String(candidate.decision || "")
          .trim()
          .toUpperCase();

        return (
          decision === "SHORTLIST" ||
          decision === "SHORTLISTED"
        );
      }).length;

      const rejected = candidates.filter((candidate) => {
        const decision = String(candidate.decision || "")
          .trim()
          .toUpperCase();

        return (
          decision === "REJECT" ||
          decision === "REJECTED"
        );
      }).length;

      const scores = candidates
      .map((candidate) => candidate.final_score)
      .filter(
        (value) =>
          value !== null &&
          value !== undefined &&
          value !== "" &&
          Number.isFinite(Number(value))
      )
      .map((value) => Number(value));

      const averageScore =
        scores.length > 0
          ? Math.round(
              scores.reduce(
                (total, score) => total + score,
                0
              ) / scores.length
            )
          : 0;

      const scoreDistribution = {
        excellent: scores.filter((score) => score >= 90).length,
        veryGood: scores.filter(
          (score) => score >= 80 && score < 90
        ).length,
        good: scores.filter(
          (score) => score >= 70 && score < 80
        ).length,
        average: scores.filter(
          (score) => score >= 60 && score < 70
        ).length,
        low: scores.filter((score) => score < 60).length,
      };

      setAnalytics({
        totalCandidates,
        shortlisted,
        rejected,
        averageScore,
        topJobs: [
          {
            job: data.job_title || "Current Job",
            candidates: totalCandidates,
          },
        ],
        scoreDistribution,
      });
    } catch (error) {
      console.error("Analytics loading failed:", error);

      setAnalytics({
        totalCandidates: 0,
        shortlisted: 0,
        rejected: 0,
        averageScore: 0,
        topJobs: [],
        scoreDistribution: {
          excellent: 0,
          veryGood: 0,
          good: 0,
          average: 0,
          low: 0,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const shortlistedPercentage =
    analytics.totalCandidates > 0
      ? (analytics.shortlisted / analytics.totalCandidates) * 100
      : 0;

  const rejectedPercentage =
    analytics.totalCandidates > 0
      ? (analytics.rejected / analytics.totalCandidates) * 100
      : 0;

  const maxScoreCount = Math.max(
    analytics.scoreDistribution.excellent,
    analytics.scoreDistribution.veryGood,
    analytics.scoreDistribution.good,
    analytics.scoreDistribution.average,
    analytics.scoreDistribution.low,
    1
  );

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Analytics</h1>
          <p>
            Overview of your resume screening performance.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="analytics-cards">
        <div className="analytics-card">
          <span>Total Candidates</span>
          <strong>
            {loading ? "..." : analytics.totalCandidates}
          </strong>
          <small>Resumes screened</small>
        </div>

        <div className="analytics-card">
          <span>Shortlisted</span>
          <strong>
            {loading ? "..." : analytics.shortlisted}
          </strong>
          <small>
            {loading
              ? "..."
              : `${Math.round(shortlistedPercentage)}% of candidates`}
          </small>
        </div>

        <div className="analytics-card">
          <span>Rejected</span>
          <strong>
            {loading ? "..." : analytics.rejected}
          </strong>
          <small>
            {loading
              ? "..."
              : `${Math.round(rejectedPercentage)}% of candidates`}
          </small>
        </div>

        <div className="analytics-card">
          <span>Average Score</span>
          <strong>
            {loading
              ? "..."
              : `${analytics.averageScore}%`}
          </strong>
          <small>Overall match score</small>
        </div>
      </div>

      {/* Visual Analytics */}
      <div className="analytics-visual">
        {/* Candidate Distribution */}
        <div className="analytics-visual-card">
          <h2>Candidate Distribution</h2>

          <div className="donut-wrapper">
            <div
              className="donut-chart"
              style={{
                "--shortlisted": `${shortlistedPercentage}%`,
              }}
            >
              <div className="donut-center">
                <strong>{analytics.totalCandidates}</strong>
                <span>Candidates</span>
              </div>
            </div>

            <div className="chart-legend">
              <div className="legend-item">
                <span className="legend-dot legend-shortlisted"></span>

                <span>
                  Shortlisted{" "}
                  <strong>{analytics.shortlisted}</strong>
                </span>
              </div>

              <div className="legend-item">
                <span className="legend-dot legend-rejected"></span>

                <span>
                  Rejected{" "}
                  <strong>{analytics.rejected}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Average Score */}
        <div className="analytics-visual-card">
          <h2>Average Match Score</h2>

          <div className="score-circle-wrapper">
            <div
              className="score-circle"
              style={{
                "--score": `${analytics.averageScore}%`,
              }}
            >
              <div className="score-circle-content">
                <strong>
                  {analytics.averageScore}%
                </strong>
                <span>Average Score</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Score Distribution */}
      <div className="analytics-visual-card score-distribution-card">
        <h2>Score Distribution</h2>

        <div className="score-bars">
          <div className="score-bar-row">
            <span>90–100</span>

            <div className="score-bar-track">
              <div
                className="score-bar-fill"
                style={{
                  width: `${
                    (analytics.scoreDistribution.excellent /
                      maxScoreCount) *
                    100
                  }%`,
                }}
              ></div>
            </div>

            <strong>
              {analytics.scoreDistribution.excellent}
            </strong>
          </div>

          <div className="score-bar-row">
            <span>80–89</span>

            <div className="score-bar-track">
              <div
                className="score-bar-fill"
                style={{
                  width: `${
                    (analytics.scoreDistribution.veryGood /
                      maxScoreCount) *
                    100
                  }%`,
                }}
              ></div>
            </div>

            <strong>
              {analytics.scoreDistribution.veryGood}
            </strong>
          </div>

          <div className="score-bar-row">
            <span>70–79</span>

            <div className="score-bar-track">
              <div
                className="score-bar-fill"
                style={{
                  width: `${
                    (analytics.scoreDistribution.good /
                      maxScoreCount) *
                    100
                  }%`,
                }}
              ></div>
            </div>

            <strong>
              {analytics.scoreDistribution.good}
            </strong>
          </div>

          <div className="score-bar-row">
            <span>60–69</span>

            <div className="score-bar-track">
              <div
                className="score-bar-fill"
                style={{
                  width: `${
                    (analytics.scoreDistribution.average /
                      maxScoreCount) *
                    100
                  }%`,
                }}
              ></div>
            </div>

            <strong>
              {analytics.scoreDistribution.average}
            </strong>
          </div>

          <div className="score-bar-row">
            <span>Below 60</span>

            <div className="score-bar-track">
              <div
                className="score-bar-fill"
                style={{
                  width: `${
                    (analytics.scoreDistribution.low /
                      maxScoreCount) *
                    100
                  }%`,
                }}
              ></div>
            </div>

            <strong>
              {analytics.scoreDistribution.low}
            </strong>
          </div>
        </div>
      </div>

      {/* Top Jobs */}
      <div className="analytics-panel">
        <h2>Top Jobs</h2>

        {analytics.topJobs.length === 0 ? (
          <div className="job-row">
            <span>No screening data yet</span>
            <strong>—</strong>
          </div>
        ) : (
          analytics.topJobs.map((job, index) => (
            <div className="job-row" key={index}>
              <span>{job.job}</span>
              <strong>
                {job.candidates} candidates
              </strong>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Analytics;