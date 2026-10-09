import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const SettingsContext = createContext(null);

const DEFAULT_SETTINGS = {
  profileName: "Gangavaram Anowshka Reddy",
  username: "Gangavaram Anowshka Reddy",
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

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(
        "smartscreen_settings"
      );

      if (saved) {
        const parsed = JSON.parse(saved);

        const validTheme =
          parsed.theme === "midnightGold" ||
          parsed.theme === "green"
            ? parsed.theme
            : "green";

        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          theme: validTheme,
        };
      }
    } catch (error) {
      console.error(
        "Unable to load SmartScreen settings:",
        error
      );
    }

    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        "smartscreen_settings",
        JSON.stringify(settings)
      );
    } catch (error) {
      console.error(
        "Unable to save SmartScreen settings:",
        error
      );
    }
  }, [settings]);

  useEffect(() => {
    const theme =
      settings.theme === "midnightGold"
        ? "midnightGold"
        : "green";

    document.documentElement.setAttribute(
      "data-theme",
      theme
    );
  }, [settings.theme]);

  const updateSetting = (key, value) => {
    setSettings((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const updateSettings = (values) => {
    setSettings((previous) => ({
      ...previous,
      ...values,
    }));
  };

  const t = (key) => {
    return TRANSLATIONS[key] || key;
  };

  const value = useMemo(
    () => ({
      settings,
      updateSetting,
      updateSettings,
      themes: THEMES,
      t,
    }),
    [settings]
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