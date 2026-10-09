import {
  LayoutDashboard,
  BriefcaseBusiness,
  ScanSearch,
  Users,
  BarChart3,
  Plus,
  Settings,
  CircleHelp,
  LogOut,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useSettings } from "./SettingsContext";

function Sidebar({ onSettingsClick, onHelpCenterClick }) {
  const navigate = useNavigate();
  const { t } = useSettings();

  const menuItems = [
    {
      name: t("dashboard"),
      path: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      name: t("jobs"),
      path: "/jobs",
      icon: BriefcaseBusiness,
    },
    {
      name: t("screening"),
      path: "/screening",
      icon: ScanSearch,
    },
    {
      name: t("candidates"),
      path: "/candidates",
      icon: Users,
    },
    {
      name: t("analytics"),
      path: "/analytics",
      icon: BarChart3,
    },
  ];

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("token_type");
    localStorage.removeItem("role");

    navigate("/");
  };

  return (
    <aside className="sidebar">
      {/* BRAND */}
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <ScanSearch size={20} />
        </div>

        <div>
          <h2>SmartScreen AI</h2>
          <span>Automated Screening</span>
        </div>
      </div>

      {/* NEW SCREENING */}
      <button
        className="new-screening-button"
        onClick={() => navigate("/screening")}
      >
        <Plus size={17} />
        <span>{t("newScreening")}</span>
      </button>

      {/* MAIN NAVIGATION */}
      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "active" : ""}`
              }
            >
              <Icon size={18} />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* BOTTOM NAVIGATION */}
      <div className="sidebar-bottom">
        {/* SETTINGS */}
        <button
          type="button"
          className="sidebar-link sidebar-button"
          onClick={onSettingsClick}
        >
          <Settings size={18} />
          <span>{t("settings")}</span>
        </button>

        {/* HELP CENTER */}
        <button
          type="button"
          className="sidebar-link sidebar-button"
          onClick={onHelpCenterClick}
        >
          <CircleHelp size={18} />
          <span>{t("helpCenter")}</span>
        </button>

        {/* LOGOUT */}
        <button
          type="button"
          className="sidebar-link sidebar-button logout-button"
          onClick={handleLogout}
        >
          <LogOut size={18} />
          <span>{t("logout")}</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;