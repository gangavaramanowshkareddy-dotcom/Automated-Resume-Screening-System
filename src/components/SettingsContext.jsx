
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import apiClient from "../api/client";

const SettingsContext = createContext(null);

const DEFAULT_SETTINGS = {
  profileName: "",
  username: "",
  role: "HR",
  profileImage: "",
  theme: "green",
};

export const THEMES = {
  green: {
    name: "Smart Green",
    description: "SmartScreen's original professional interface",
  },
  midnightGold: {
    name: "Midnight Gold",
    description: "A premium midnight, gold and bronze interface",
  },
};

const TRANSLATIONS = {
  dashboard: "Dashboard",
  jobs: "Jobs",
  screening: "Screening",
  candidates: "Candidates",
  analytics: "Analytics",
  settings: "Settings",
  helpCenter: "Help Center",
  newScreening: "New Screening",
  logout: "Logout",
};

function getSavedTheme() {
  try {
    const savedTheme = localStorage.getItem("smartscreen_theme");

    return savedTheme === "midnightGold"
      ? "midnightGold"
      : "green";
  } catch (error) {
    console.error("Unable to load SmartScreen theme:", error);
    return "green";
  }
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => ({
    ...DEFAULT_SETTINGS,
    theme: getSavedTheme(),
  }));

  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");

  const reloadProfile = useCallback(async () => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      setSettings((previous) => ({
        ...previous,
        profileName: "",
        username: "",
        profileImage: "",
        role: "HR",
      }));
      setProfileError("");
      return;
    }

    setProfileLoading(true);
    setProfileError("");

    try {
      const response = await apiClient.get("/api/auth/profile");
      const profile = response.data;

      setSettings((previous) => ({
        ...previous,
        profileName: profile.profile_name || "",
        username: profile.profile_username || "",
        profileImage: profile.profile_image || "",
        role: profile.role || "HR",
      }));
    } catch (error) {
      console.error(
        "Unable to load profile:",
        error.response?.data?.detail || error.message
      );

      setProfileError(
        error.response?.data?.detail ||
          "Unable to load your profile from the server."
      );
    } finally {
      setProfileLoading(false);
    }
  }, []);

  // Load the authenticated user's profile when this provider mounts.
  useEffect(() => {
    reloadProfile();
  }, [reloadProfile]);

  // Persist only the theme locally. Profile details belong in the backend.
  useEffect(() => {
    try {
      localStorage.setItem("smartscreen_theme", settings.theme);
    } catch (error) {
      console.error("Unable to save SmartScreen theme:", error);
    }
  }, [settings.theme]);

  useEffect(() => {
    const theme =
      settings.theme === "midnightGold"
        ? "midnightGold"
        : "green";

    document.documentElement.setAttribute("data-theme", theme);
  }, [settings.theme]);

  const updateSetting = useCallback((key, value) => {
    setSettings((previous) => ({
      ...previous,
      [key]: value,
    }));
  }, []);

  const updateSettings = useCallback((values) => {
    setSettings((previous) => ({
      ...previous,
      ...values,
    }));
  }, []);

  const t = useCallback(
    (key) => TRANSLATIONS[key] || key,
    []
  );

  const value = useMemo(
    () => ({
      settings,
      updateSetting,
      updateSettings,
      themes: THEMES,
      t,
      profileLoading,
      profileError,
      reloadProfile,
    }),
    [
      settings,
      updateSetting,
      updateSettings,
      t,
      profileLoading,
      profileError,
      reloadProfile,
    ]
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);

  if (!context) {
    throw new Error(
      "useSettings must be used inside SettingsProvider"
    );
  }

  return context;
}
