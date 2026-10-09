import { useState } from "react";
import Sidebar from "./Sidebar";
import SettingsPanel from "./SettingsPanel";
import HelpCenterPanel from "./HelpCenterPanel";
import { SettingsProvider } from "./SettingsContext";
import { Outlet } from "react-router-dom";

function LayoutContent() {
  const [activePanel, setActivePanel] = useState(null);

  return (
    <div className="app-layout">
      <Sidebar
        onSettingsClick={() => setActivePanel("settings")}
        onHelpCenterClick={() => setActivePanel("help")}
      />

      <main className="main-content">
        <Outlet />
      </main>

      {activePanel === "settings" && (
        <SettingsPanel
          onClose={() => setActivePanel(null)}
        />
      )}

      {activePanel === "help" && (
        <HelpCenterPanel
          onClose={() => setActivePanel(null)}
        />
      )}
    </div>
  );
}

function Layout() {
  return (
    <SettingsProvider>
      <LayoutContent />
    </SettingsProvider>
  );
}

export default Layout;