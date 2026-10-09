import { useEffect, useState } from "react";
import {
  ArrowRight,
  LockKeyhole,
  Mail,
  ScanSearch,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";

import apiClient from "./api/client";
import { setNavigate } from "./api/navigation";
import Layout from "./components/Layout";

import Dashboard from "./pages/Dashboard";
import Jobs from "./pages/Jobs";
import Screening from "./pages/Screening";
import Candidates from "./pages/Candidates";
import Analytics from "./pages/Analytics";

import "./App.css";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const handleLogin = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);

      const response = await apiClient.post("/api/auth/login", {
        username: email.trim(),
        password,
      });

      const {
        access_token,
        refresh_token,
        token_type,
        role
      } = response.data;
      
      localStorage.setItem("access_token", access_token);
      localStorage.setItem("refresh_token", refresh_token);
      localStorage.setItem("token_type", token_type || "bearer");
      localStorage.setItem("role", role || "HR");

      setSuccess("Login successful.");
      setPassword("");

      // Go to Dashboard after successful login
      setTimeout(() => {
        navigate("/dashboard");
      }, 500);
    } catch (err) {
      const message =
        err?.response?.data?.detail ||
        "Unable to sign in. Please check your credentials and try again.";

      setError(message);
    } finally {
      setLoading(false);
    }
  };
  const handleForgotPassword = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!resetEmail.trim()) {
      setError("Please enter your registered email address.");
      return;
    }

    try {
      setResetLoading(true);

      await apiClient.post("/api/auth/forgot-password", {
        email: resetEmail.trim(),
      });

      setSuccess(
        "If an account exists for that email, a reset link will be sent. Please check your inbox shortly."
      );
    } catch (error) {
      setError(
        error?.response?.data?.detail ||
          "Unable to send reset link. Please try again."
      );
    } finally {
      setResetLoading(false);
    }
  };
  if (showForgotPassword) {
    return (
      <main className="login-page">
        <div className="background-shape background-shape-one" />
        <div className="background-shape background-shape-two" />
        <div className="background-shape background-shape-three" />
  
        <section className="login-card">
          <div className="brand-icon" aria-hidden="true">
            <Mail size={22} strokeWidth={2.2} />
          </div>
  
          <h1>Reset Password</h1>
  
          <p className="subtitle">
            Enter your registered email address to receive a password reset link.
          </p>
  
          <form onSubmit={handleForgotPassword} className="login-form">
            <div className="field-group">
              <label htmlFor="reset-email">Email Address</label>
  
              <div className="input-wrapper">
                <Mail size={15} aria-hidden="true" />
  
                <input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(event) => setResetEmail(event.target.value)}
                  placeholder="Enter your email address"
                  autoComplete="email"
                />
              </div>
            </div>
  
            {error && (
              <div className="message message-error">
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}
  
            {success && (
              <div className="message message-success">
                <CheckCircle2 size={15} />
                <span>{success}</span>
              </div>
            )}
  
            <button
              type="submit"
              className="access-button"
              disabled={resetLoading}
            >
              {resetLoading ? (
                <>
                  <Loader2 className="spinner" size={16} />
                  Sending...
                </>
              ) : (
                <>
                  Send Reset Link
                  <ArrowRight size={16} />
                </>
              )}
            </button>
  
            <button
              type="button"
              className="forgot-button"
              onClick={() => {
                setError("");
                setSuccess("");
                setResetEmail("");
                setShowForgotPassword(false);
              }}
            >
              Back to Login
            </button>
          </form>
  
          <div className="card-divider" />
  
          <p className="security-note">
            A password reset link will be sent to your registered email address.
          </p>
        </section>
      </main>
    );
  }
  return (
    <main className="login-page">
      <div className="background-shape background-shape-one" />
      <div className="background-shape background-shape-two" />
      <div className="background-shape background-shape-three" />

      <section className="login-card">
        <div className="brand-icon" aria-hidden="true">
          <ScanSearch size={22} strokeWidth={2.2} />
        </div>

        <h1>SmartScreen AI</h1>

        <p className="subtitle">Authorized Personnel Portal</p>

        <form onSubmit={handleLogin} className="login-form">
          <div className="field-group">
            <label htmlFor="email">Username</label>

            <div className="input-wrapper">
              <Mail size={15} aria-hidden="true" />

              <input
                id="email"
                type="text"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your Username"
                autoComplete="username"
              />
            </div>
          </div>

          <div className="field-group">
            <div className="password-label-row">
              <label htmlFor="password">Password</label>

              <button
                type="button"
                className="forgot-button"
                onClick={() => {
                  setError("");
                  setSuccess("");
                  setShowForgotPassword(true);
                }}
              >
                Forgot?
              </button>
            </div>

            <div className="input-wrapper">
              <LockKeyhole size={15} aria-hidden="true" />

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>
          </div>

          {error && (
            <div className="message message-error">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="message message-success">
              <CheckCircle2 size={15} />
              <span>{success}</span>
            </div>
          )}

          <button
            type="submit"
            className="access-button"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="spinner" size={16} />
                Signing in...
              </>
            ) : (
              <>
                Access Portal
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="card-divider" />

        <p className="security-note">
          System access is restricted to authorized HR personnel.
        </p>
      </section>
    </main>
  );
}
function ResetPassword() {
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const token = new URLSearchParams(window.location.search).get("token");

  const handleResetPassword = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!token) {
      setError("Invalid or missing password reset link.");
      return;
    }

    if (!newPassword || !confirmPassword) {
      setError("Please enter and confirm your new password.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      await apiClient.post("/api/auth/reset-password", {
        token,
        new_password: newPassword,
      });

      setSuccess(
        "Password reset successfully. Redirecting to login..."
      );

      setNewPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        navigate("/");
      }, 1500);
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          "Unable to reset password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <div className="background-shape background-shape-one" />
      <div className="background-shape background-shape-two" />
      <div className="background-shape background-shape-three" />

      <section className="login-card">
        <div className="brand-icon" aria-hidden="true">
          <LockKeyhole size={22} strokeWidth={2.2} />
        </div>

        <h1>Set New Password</h1>

        <p className="subtitle">
          Enter your new password below.
        </p>

        <form
          onSubmit={handleResetPassword}
          className="login-form"
        >
          <div className="field-group">
            <label htmlFor="new-password">
              New Password
            </label>

            <div className="input-wrapper">
              <LockKeyhole size={15} aria-hidden="true" />

              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) =>
                  setNewPassword(event.target.value)
                }
                placeholder="Enter new password"
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="field-group">
            <label htmlFor="confirm-password">
              Confirm Password
            </label>

            <div className="input-wrapper">
              <LockKeyhole size={15} aria-hidden="true" />

              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                placeholder="Confirm new password"
                autoComplete="new-password"
              />
            </div>
          </div>

          {error && (
            <div className="message message-error">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="message message-success">
              <CheckCircle2 size={15} />
              <span>{success}</span>
            </div>
          )}

          <button
            type="submit"
            className="access-button"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="spinner" size={16} />
                Resetting...
              </>
            ) : (
              <>
                Reset Password
                <ArrowRight size={16} />
              </>
            )}
          </button>

          <button
            type="button"
            className="forgot-button"
            onClick={() => navigate("/")}
          >
            Back to Login
          </button>
        </form>

        <div className="card-divider" />

        <p className="security-note">
          Your password must contain at least 8 characters.
        </p>
      </section>
    </main>
  );
}
function ProtectedRoute({ children }) {
  const token = localStorage.getItem("access_token");

  if (!token) {
    return <Navigate to="/" replace />;
  }

  return children;
}
function NavigationHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    setNavigate(navigate);
  }, [navigate]);

  return null;
}
function App() {
  return (
    <BrowserRouter>
     <NavigationHandler />
      <Routes>
        {/* Login */}
        <Route path="/" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        {/* Main application */}
        <Route
  element={
    <ProtectedRoute>
      <Layout />
    </ProtectedRoute>
  }
>
  <Route path="/dashboard" element={<Dashboard />} />
  <Route path="/jobs" element={<Jobs />} />
  <Route path="/screening" element={<Screening />} />
  <Route path="/candidates" element={<Candidates />} />
  <Route path="/analytics" element={<Analytics />} />
</Route>

        {/* Unknown URL → Login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;