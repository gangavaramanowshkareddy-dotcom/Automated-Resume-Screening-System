import { useEffect, useState } from "react";

import { BriefcaseBusiness, Plus, Search, X } from "lucide-react";

import apiClient from "../api/client";

function Jobs() {
  const normalizeJobField = (value) => {
    if (Array.isArray(value)) {
      return value
        .filter((item) => item !== null && item !== undefined)
        .map((item) => String(item).trim())
        .filter(Boolean)
        .join(", ");
    }

    if (value === null || value === undefined) {
      return "";
    }

    return String(value);
  };

  const [jobs, setJobs] = useState([]);

  const [showForm, setShowForm] = useState(false);

  const [editingJobId, setEditingJobId] = useState(null);

  const [selectedJob, setSelectedJob] = useState(null);

  const [jobCandidates, setJobCandidates] = useState([]);

  const [showCandidates, setShowCandidates] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");

  const [jobToDelete, setJobToDelete] = useState(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    skills: "",
    experience: "",
  });

  useEffect(() => {
    const loadJobs = async () => {
      try {
        const response = await apiClient.get("/api/jobs");

        const data = response.data;

        const backendJobs = await Promise.all(
          data.map(async (job) => {
            let candidateCount = 0;

            try {
              const candidatesResponse = await apiClient.get(
                `/api/jobs/${job.id}/candidates`
              );

              const candidatesData = candidatesResponse.data;

              candidateCount =
                candidatesData.candidates?.length || 0;
            } catch (error) {
              console.error(
                `Error loading candidates for job ${job.id}:`,
                error
              );
            }

            return {
              id: job.id,
              title: job.job_title,
              description: job.job_description || "",
              skills: normalizeJobField(job.required_skills),
              experience: normalizeJobField(
                job.required_experience
              ),
              candidates: candidateCount,
              status: "Active",
            };
          })
        );

        setJobs(backendJobs);
      } catch (error) {
        console.error("Error loading jobs:", error);
      }
    };

    loadJobs();
  }, []);

  const handleViewCandidates = async (job) => {
    try {
      const response = await apiClient.get(
        `/api/jobs/${job.id}/candidates`
      );

      const data = response.data;

      setSelectedJob(job);
      setJobCandidates(data.candidates || []);
      setShowCandidates(true);
    } catch (error) {
      console.error("Error loading job candidates:", error);
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleCreateJob = async (event) => {
    event.preventDefault();

    if (
      !formData.title.trim() ||
      !formData.description.trim() ||
      !formData.skills.trim() ||
      !formData.experience.trim()
    ) {
      return;
    }

    try {
      const response = editingJobId
        ? await apiClient.put(`/api/jobs/${editingJobId}`, {
            job_title: formData.title.trim(),
            job_description: formData.description.trim(),
            required_skills: formData.skills.trim(),
            required_experience: formData.experience.trim(),
          })
        : await apiClient.post("/api/jobs", {
            job_title: formData.title.trim(),
            job_description: formData.description.trim(),
            required_skills: formData.skills.trim(),
            required_experience: formData.experience.trim(),
          });

      const savedJob = response.data;

      setJobs((previous) => {
        if (editingJobId) {
          return previous.map((job) =>
            job.id === editingJobId
              ? {
                  ...job,
                  title: savedJob.job_title,
                  description:
                    savedJob.job_description || "",
                  skills: normalizeJobField(
                    savedJob.required_skills
                  ),
                  experience: normalizeJobField(
                    savedJob.required_experience
                  ),
                }
              : job
          );
        }

        return [
          ...previous,
          {
            id: savedJob.id,
            title: savedJob.job_title,
            description:
              savedJob.job_description || "",
            skills: normalizeJobField(
              savedJob.required_skills
            ),
            experience: normalizeJobField(
              savedJob.required_experience
            ),
            candidates: 0,
            status: "Active",
          },
        ];
      });

      setFormData({
        title: "",
        description: "",
        skills: "",
        experience: "",
      });

      setEditingJobId(null);

      setShowForm(false);
    } catch (error) {
      console.error("Error creating job:", error);
    }
  };

  const handleDeleteJob = async () => {
    if (!jobToDelete) {
      return;
    }

    try {
      await apiClient.delete(
        `/api/jobs/${jobToDelete.id}`
      );

      setJobs((previous) =>
        previous.filter(
          (job) => job.id !== jobToDelete.id
        )
      );

      setJobToDelete(null);
    } catch (error) {
      console.error("Error deleting job:", error);
    }
  };

  const handleEditJob = (job) => {
    setEditingJobId(job.id);

    setFormData({
      title: job.title,
      description: job.description || "",
      skills: normalizeJobField(job.skills),
      experience: normalizeJobField(job.experience),
    });

    setShowForm(true);
  };

  const filteredJobs = jobs.filter((job) => {
    const search = searchTerm.toLowerCase();

    return (
      normalizeJobField(job.title)
        .toLowerCase()
        .includes(search) ||
      normalizeJobField(job.skills)
        .toLowerCase()
        .includes(search) ||
      normalizeJobField(job.experience)
        .toLowerCase()
        .includes(search)
    );
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Jobs</h1>

          <p>
            Manage your job descriptions and recruitment
            requirements.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={() => setShowForm(true)}
        >
          <Plus size={17} />
          Create Job
        </button>
      </div>

      <div className="jobs-toolbar">
        <div className="search-box">
          <Search size={17} />

          <input
            type="text"
            placeholder="Search jobs..."
            value={searchTerm}
            onChange={(event) =>
              setSearchTerm(event.target.value)
            }
          />
        </div>
      </div>

      <div className="jobs-card">
        <div className="jobs-card-header">
          <div>
            <h2>Job Descriptions</h2>

            <p>
              Manage positions available for resume
              screening.
            </p>
          </div>
        </div>

        {filteredJobs.length > 0 ? (
          <div className="jobs-table-wrapper">
            <table className="jobs-table">
              <thead>
                <tr>
                  <th>Job Title</th>
                  <th>Required Skills</th>
                  <th>Experience</th>
                  <th>Candidates</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredJobs.map((job, index) => (
                  <tr
                    key={
                      job.id ||
                      `${job.title}-${index}`
                    }
                  >
                    <td>
                      <div className="job-title">
                        <div className="job-icon">
                          <BriefcaseBusiness
                            size={17}
                          />
                        </div>

                        <strong>{job.title}</strong>
                      </div>
                    </td>

                    <td>{job.skills}</td>

                    <td>{job.experience}</td>

                    <td>{job.candidates}</td>

                    <td>
                      <button
                        type="button"
                        className="status-badge"
                        onClick={() =>
                          handleViewCandidates(job)
                        }
                      >
                        {job.status}
                      </button>
                    </td>

                    <td>
                      <div className="job-actions">
                        <button
                          type="button"
                          className="edit-button"
                          onClick={() =>
                            handleEditJob(job)
                          }
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="edit-button"
                          onClick={() =>
                            setJobToDelete(job)
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <BriefcaseBusiness size={35} />

            <h3>No jobs found</h3>

            <p>
              Create a job to start screening
              candidates.
            </p>
          </div>
        )}
      </div>

      {showCandidates && selectedJob && (
        <div className="modal-overlay">
          <div className="job-modal">
            <div className="modal-header">
              <div>
                <h2>
                  {selectedJob.title} — Candidates
                </h2>

                <p>
                  Candidates screened for this job.
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() =>
                  setShowCandidates(false)
                }
              >
                <X size={20} />
              </button>
            </div>

            {jobCandidates.length > 0 ? (
              <div className="jobs-table-wrapper">
                <table className="jobs-table">
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Email</th>
                      <th>Score</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {jobCandidates.map((candidate) => (
                      <tr key={candidate.id}>
                        <td>
                          <strong>
                            {candidate.name ||
                              candidate.candidate_name ||
                              "Unknown"}
                          </strong>
                        </td>

                        <td>
                          {candidate.email || "-"}
                        </td>

                        <td>
                          {candidate.final_score !==
                            null &&
                          candidate.final_score !==
                            undefined
                            ? `${candidate.final_score}%`
                            : "-"}
                        </td>

                        <td>
                          <span className="status-badge">
                            {candidate.decision ||
                              candidate.status ||
                              "Processing"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <h3>No candidates yet</h3>

                <p>
                  No candidates have been screened for
                  this job.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {jobToDelete && (
        <div className="modal-overlay">
          <div
            className="job-modal"
            style={{
              maxWidth: "460px",
              borderRadius: "18px",
              overflow: "hidden",
            }}
          >
            <div className="modal-header">
              <div>
                <h2>Delete Job?</h2>

                <p>
                  Are you sure you want to delete "
                  {jobToDelete.title}"?
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() =>
                  setJobToDelete(null)
                }
              >
                <X size={20} />
              </button>
            </div>

            <div
              style={{
                padding: "0 24px 8px",
                color: "#5f6b66",
                lineHeight: "1.6",
              }}
            >
              <p>
                This job and its associated screening
                data will no longer be available. This
                action cannot be undone.
              </p>
            </div>

            <div
              className="modal-actions"
              style={{
                padding:
                  "18px 24px 24px",
                justifyContent: "flex-end",
                gap: "12px",
              }}
            >
              <button
                type="button"
                className="edit-button"
                onClick={() =>
                  setJobToDelete(null)
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="primary-button"
                onClick={handleDeleteJob}
              >
                Delete Job
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay">
          <div className="job-modal">
            <div className="modal-header">
              <div>
                <h2>Create New Job</h2>

                <p>
                  Add the recruitment requirements for
                  this position.
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() =>
                  setShowForm(false)
                }
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateJob}>
              <div className="form-field">
                <label>Job Title</label>

                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g. AI / ML Engineer"
                />
              </div>

              <div className="form-field">
                <label>Job Description</label>

                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Enter the job description..."
                  rows="4"
                />
              </div>

              <div className="form-field">
                <label>Required Skills</label>

                <input
                  type="text"
                  name="skills"
                  value={formData.skills}
                  onChange={handleChange}
                  placeholder="e.g. Python, Machine Learning, SQL"
                />
              </div>

              <div className="form-field">
                <label>Experience</label>

                <input
                  type="text"
                  name="experience"
                  value={formData.experience}
                  onChange={handleChange}
                  placeholder="e.g. 0–2 years"
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="edit-button"
                  onClick={() =>
                    setShowForm(false)
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                >
                  <Plus size={17} />
                  Save Job
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Jobs;