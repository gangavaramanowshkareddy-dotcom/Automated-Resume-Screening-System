
import { useEffect, useRef, useState } from "react";
import {
  X,
  UserRound,
  Camera,
  LockKeyhole,
  Palette,
  Info,
  Check,
  Save,
  Eye,
  EyeOff,
} from "lucide-react";
import { useSettings } from "./SettingsContext";
import apiClient from "../api/client";

function SettingsPanel({ onClose }) {
  const {
    settings,
    updateSettings,
    themes,
    profileLoading,
  } = useSettings();

  const fileInputRef = useRef(null);

  const [profileName, setProfileName] = useState(
    settings.profileName || ""
  );
  const [username, setUsername] = useState(
    settings.username || ""
  );
  const [profileImage, setProfileImage] = useState(
    settings.profileImage || ""
  );

  const [activeSection, setActiveSection] = useState("profile");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] =
    useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [profileSaved, setProfileSaved] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");

  // Update the form when the backend profile is loaded.
  useEffect(() => {
    setProfileName(settings.profileName || "");
    setUsername(settings.username || "");
    setProfileImage(settings.profileImage || "");
  }, [
    settings.profileName,
    settings.username,
    settings.profileImage,
  ]);

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setProfileError("");
    setProfileSaved(false);

    if (!file.type.startsWith("image/")) {
      setProfileError("Please select a valid image file.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setProfileError("Unable to read the selected image.");
        return;
      }

      // The backend accepts profile images up to 1,500,000 characters.
      if (reader.result.length > 1_500_000) {
        setProfileError(
          "This image is too large. Please choose a smaller image."
        );
        event.target.value = "";
        return;
      }

      setProfileImage(reader.result);
    };

    reader.onerror = () => {
      setProfileError("Unable to read the selected image.");
    };

    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    setProfileError("");
    setProfileSaved(false);

    const trimmedName = profileName.trim();
    const trimmedUsername = username.trim();

    if (!trimmedName || !trimmedUsername) {
      setProfileError("HR Name and Username are required.");
      return;
    }

    if (trimmedName.length > 255 || trimmedUsername.length > 255) {
      setProfileError("HR Name and Username must be 255 characters or fewer.");
      return;
    }

    if (profileImage.length > 1_500_000) {
      setProfileError(
        "The profile image is too large. Please choose a smaller image."
      );
      return;
    }

    try {
      setProfileSaving(true);

      const response = await apiClient.put("/api/auth/profile", {
        profile_name: trimmedName,
        profile_username: trimmedUsername,
        profile_image: profileImage || "",
      });

      const savedProfile = response.data;

      // Update the shared UI only after the server confirms the save.
      updateSettings({
        profileName: savedProfile.profile_name || trimmedName,
        username: savedProfile.profile_username || trimmedUsername,
        profileImage: savedProfile.profile_image || "",
        role: savedProfile.role || settings.role || "HR",
      });

      setProfileName(savedProfile.profile_name || trimmedName);
      setUsername(savedProfile.profile_username || trimmedUsername);
      setProfileImage(savedProfile.profile_image || "");
      setProfileSaved(true);
    } catch (error) {
      console.error("Error saving profile:", error);

      const detail = error.response?.data?.detail;

      setProfileError(
        Array.isArray(detail)
          ? detail.map((item) => item.msg || String(item)).join(", ")
          : detail ||
              "Unable to save your profile. Please try again."
      );
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();

    setPasswordMessage("");
    setPasswordError("");

    if (!currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }

    if (!newPassword) {
      setPasswordError("Please enter a new password.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError(
        "New password must be at least 8 characters long."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(
        "New password and confirm password do not match."
      );
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError(
        "New password must be different from the current password."
      );
      return;
    }

    try {
      setPasswordLoading(true);

      const response = await apiClient.post(
        "/api/auth/change-password",
        {
          current_password: currentPassword,
          new_password: newPassword,
        }
      );

      setPasswordMessage(
        response.data?.message || "Password changed successfully."
      );

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Error changing password:", error);

      const detail = error.response?.data?.detail;

      setPasswordError(
        Array.isArray(detail)
          ? detail.map((item) => item.msg || String(item)).join(", ")
          : detail ||
              "Unable to change password. Please try again."
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleThemeChange = (themeName) => {
    updateSettings({ theme: themeName });
  };

  const sectionItems = [
    { id: "profile", label: "Profile", icon: UserRound },
    { id: "password", label: "Change Password", icon: LockKeyhole },
    { id: "theme", label: "Theme", icon: Palette },
    { id: "about", label: "About SmartScreen AI", icon: Info },
  ];

  return (
    <div className="settings-overlay">
      <div className="settings-panel">
        <div className="settings-header">
          <div>
            <h2>Settings</h2>
            <p>Manage your SmartScreen AI preferences</p>
          </div>

          <button
            type="button"
            className="settings-close-button"
            onClick={onClose}
            aria-label="Close settings"
          >
            <X size={20} />
          </button>
        </div>

        <div className="settings-body">
          <div className="settings-sidebar">
            {sectionItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`settings-nav-item ${
                    isActive ? "settings-nav-item-active" : ""
                  }`}
                  onClick={() => setActiveSection(item.id)}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="settings-content">
            {activeSection === "profile" && (
              <div className="settings-section">
                <div className="settings-section-title">
                  <div>
                    <h3>Profile</h3>
                    <p>Manage your SmartScreen AI profile information.</p>
                  </div>
                </div>

                {profileLoading && (
                  <p>Loading your profile...</p>
                )}

                <div className="profile-image-section">
                  <div className="profile-image-wrapper">
                    {profileImage ? (
                      <img
                        src={profileImage}
                        alt="Profile"
                        className="settings-profile-image"
                      />
                    ) : (
                      <div className="settings-profile-placeholder">
                        <UserRound size={38} />
                      </div>
                    )}
                  </div>

                  <div className="profile-image-info">
                    <h4>Profile Image</h4>
                    <p>
                      Upload an image to personalize your SmartScreen AI
                      profile.
                    </p>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      style={{ display: "none" }}
                    />

                    <button
                      type="button"
                      className="settings-secondary-button"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Camera size={16} />
                      Change Image
                    </button>
                  </div>
                </div>

                <div className="settings-form-grid">
                  <div className="settings-form-group">
                    <label htmlFor="profileName">HR Name</label>
                    <input
                      id="profileName"
                      type="text"
                      maxLength={255}
                      value={profileName}
                      onChange={(event) => {
                        setProfileName(event.target.value);
                        setProfileSaved(false);
                      }}
                      placeholder="Enter HR name"
                    />
                  </div>

                  <div className="settings-form-group">
                    <label htmlFor="username">Username</label>
                    <input
                      id="username"
                      type="text"
                      maxLength={255}
                      value={username}
                      onChange={(event) => {
                        setUsername(event.target.value);
                        setProfileSaved(false);
                      }}
                      placeholder="Enter username"
                    />
                  </div>

                  <div className="settings-form-group">
                    <label htmlFor="role">Role</label>
                    <input
                      id="role"
                      type="text"
                      value={settings.role || "HR"}
                      disabled
                    />
                  </div>
                </div>

                {profileError && (
                  <div
                    className="settings-message settings-message-error"
                    role="alert"
                  >
                    {profileError}
                  </div>
                )}

                {profileSaved && (
                  <div
                    className="settings-message settings-message-success"
                    role="status"
                  >
                    <Check size={17} />
                    Profile saved successfully.
                  </div>
                )}

                <div className="settings-actions">
                  <button
                    type="button"
                    className="settings-primary-button"
                    onClick={handleSaveProfile}
                    disabled={profileSaving || profileLoading}
                  >
                    {profileSaving ? (
                      "Saving Profile..."
                    ) : profileSaved ? (
                      <>
                        <Check size={16} />
                        Saved
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        Save Profile
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {activeSection === "password" && (
              <div className="settings-section">
                <div className="settings-section-title">
                  <div>
                    <h3>Change Password</h3>
                    <p>
                      Update your SmartScreen AI account password securely.
                    </p>
                  </div>
                </div>

                <form
                  className="settings-password-form"
                  onSubmit={handleChangePassword}
                >
                  <div className="settings-form-group">
                    <label htmlFor="currentPassword">Current Password</label>
                    <div className="settings-password-input">
                      <input
                        id="currentPassword"
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(event) =>
                          setCurrentPassword(event.target.value)
                        }
                        placeholder="Enter current password"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowCurrentPassword((previous) => !previous)
                        }
                        aria-label={
                          showCurrentPassword
                            ? "Hide password"
                            : "Show password"
                        }
                      >
                        {showCurrentPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="settings-form-group">
                    <label htmlFor="newPassword">New Password</label>
                    <div className="settings-password-input">
                      <input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(event) =>
                          setNewPassword(event.target.value)
                        }
                        placeholder="Enter new password"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowNewPassword((previous) => !previous)
                        }
                        aria-label={
                          showNewPassword
                            ? "Hide password"
                            : "Show password"
                        }
                      >
                        {showNewPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>
                    <small>
                      Password must be at least 8 characters long.
                    </small>
                  </div>

                  <div className="settings-form-group">
                    <label htmlFor="confirmPassword">
                      Confirm New Password
                    </label>
                    <div className="settings-password-input">
                      <input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(event) =>
                          setConfirmPassword(event.target.value)
                        }
                        placeholder="Confirm new password"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword((previous) => !previous)
                        }
                        aria-label={
                          showConfirmPassword
                            ? "Hide password"
                            : "Show password"
                        }
                      >
                        {showConfirmPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>
                  </div>

                  {passwordError && (
                    <div className="settings-message settings-message-error">
                      {passwordError}
                    </div>
                  )}

                  {passwordMessage && (
                    <div className="settings-message settings-message-success">
                      <Check size={17} />
                      {passwordMessage}
                    </div>
                  )}

                  <div className="settings-actions">
                    <button
                      type="submit"
                      className="settings-primary-button"
                      disabled={passwordLoading}
                    >
                      {passwordLoading ? (
                        "Changing Password..."
                      ) : (
                        <>
                          <LockKeyhole size={16} />
                          Change Password
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeSection === "theme" && (
              <div className="settings-section">
                <div className="settings-section-title">
                  <div>
                    <h3>Theme</h3>
                    <p>
                      Choose the appearance you want for SmartScreen AI.
                    </p>
                  </div>
                </div>

                <div className="theme-options">
                  {Object.entries(themes).map(([themeKey, theme]) => {
                    const isSelected = settings.theme === themeKey;

                    return (
                      <button
                        key={themeKey}
                        type="button"
                        className={`theme-card ${
                          isSelected ? "theme-card-selected" : ""
                        }`}
                        onClick={() => handleThemeChange(themeKey)}
                      >
                        <div
                          className={`theme-preview theme-preview-${themeKey}`}
                        >
                          <div className="theme-preview-sidebar" />
                          <div className="theme-preview-main">
                            <div className="theme-preview-line theme-preview-line-long" />
                            <div className="theme-preview-line" />
                            <div className="theme-preview-card" />
                          </div>
                        </div>

                        <div className="theme-card-content">
                          <div>
                            <h4>{theme.name}</h4>
                            <p>{theme.description}</p>
                          </div>

                          {isSelected && (
                            <div className="theme-selected-icon">
                              <Check size={17} />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeSection === "about" && (
              <div className="settings-section">
                <div className="settings-section-title">
                  <div>
                    <h3>About SmartScreen AI</h3>
                    <p>Information about the application.</p>
                  </div>
                </div>

                <div className="about-card">
                  <div className="about-icon">
                    <ScanSearchIcon />
                  </div>
                  <div className="about-main">
                    <h3>SmartScreen AI</h3>
                    <p className="about-version">Version 1.0.0</p>
                    <p>
                      Automated Resume Screening System designed to help HR
                      teams process resumes, evaluate candidates against job
                      requirements, and manage screening results efficiently.
                    </p>
                  </div>
                </div>

                <div className="about-details">
                  <div className="about-detail-row">
                    <span>Application</span>
                    <strong>SmartScreen AI</strong>
                  </div>
                  <div className="about-detail-row">
                    <span>Version</span>
                    <strong>1.0.0</strong>
                  </div>
                  <div className="about-detail-row">
                    <span>Purpose</span>
                    <strong>Automated Resume Screening</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="settings-footer">
          <button
            type="button"
            className="settings-close-footer-button"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function ScanSearchIcon() {
  return (
    <div className="about-logo-mark">
      <div className="about-logo-inner">AI</div>
    </div>
  );
}

export default SettingsPanel;
