import {
  X,
  LayoutDashboard,
  BriefcaseBusiness,
  ScanSearch,
  Users,
  BarChart3,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";

function HelpCenterPanel({ onClose }) {
  const pageGuides = [
    {
      icon: LayoutDashboard,
      title: "Dashboard",
      description:
        "The Dashboard gives you a quick overview of your recruitment activity, including total jobs, candidates, screening progress, and overall results.",
    },
    {
      icon: BriefcaseBusiness,
      title: "Jobs",
      description:
        "Create and manage job positions by adding the job description, required skills, education, experience, and screening threshold.",
    },
    {
      icon: ScanSearch,
      title: "Screening",
      description:
        "Upload resumes for a selected job and start the automated screening process. SmartScreen AI evaluates candidates against the job requirements.",
    },
    {
      icon: Users,
      title: "Candidates",
      description:
        "View candidates across your jobs, check their screening scores and status, and open individual candidate details such as skills, experience, projects, and evaluation results.",
    },
    {
      icon: BarChart3,
      title: "Analytics",
      description:
        "View recruitment and screening insights, including candidate performance, shortlisted and rejected candidates, and overall screening statistics.",
    },
  ];

  return (
    <div
      className="settings-overlay"
      onClick={onClose}
    >
      <div
        className="help-center-panel"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="settings-header">
          <div>
            <h2>Help Center</h2>
            <p>
              A quick guide to using SmartScreen AI
            </p>
          </div>

          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close Help Center"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="settings-body">
          <div className="help-center-intro">
            <h3>How SmartScreen AI works</h3>
            <p>
              SmartScreen AI helps HR teams create jobs, screen resumes,
              evaluate candidates, and review recruitment insights from one
              place.
            </p>
          </div>

          {/* Page Guide */}
          <div className="help-guide-grid">
            {pageGuides.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="help-guide-card"
                >
                  <div className="help-guide-icon">
                    <Icon size={20} />
                  </div>

                  <div>
                    <h4>{item.title}</h4>
                    <p>{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Contact Support */}
          <div className="help-support-card">
            <div className="help-support-header">
              <div className="help-support-icon">
                <UserRound size={22} />
              </div>

              <div>
                <h3>Need Help?</h3>
                <p>
                  Please contact the support person below if you are
                  experiencing any issues with SmartScreen AI.
                </p>
              </div>
            </div>

            <div className="help-contact-details">
              <div className="help-contact-item">
                <UserRound size={18} />
                <div>
                  <span>Name</span>
                  <strong>
                    Gangavaram Anowshka Reddy
                  </strong>
                </div>
              </div>

              <div className="help-contact-item">
                <Phone size={18} />
                <div>
                  <span>Phone</span>
                  <strong>7702543090</strong>
                </div>
              </div>

              <div className="help-contact-item">
                <Mail size={18} />
                <div>
                  <span>Email</span>
                  <strong>
                    gangavaramanowshkareddy@gmail.com
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="settings-footer">
          <button
            type="button"
            className="settings-primary-button"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default HelpCenterPanel;