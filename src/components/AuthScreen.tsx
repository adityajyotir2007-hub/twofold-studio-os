"use client";

import React, { useState } from "react";
import { useAgency } from "@/context/AgencyContext";
import {
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  UserPlus,
  Users,
  Sparkles,
  ChevronRight,
} from "lucide-react";

type AuthMode = "login" | "invite" | "forgot" | "reset";

export function GoogleLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export function AuthScreen() {
  const {
    db,
    loginWithEmail,
    loginWithGoogle,
    acceptInvitation,
    requestPasswordReset,
    confirmPasswordReset,
  } = useAgency();

  const [mode, setMode] = useState<AuthMode>("login");
  const [showGoogleChooser, setShowGoogleChooser] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState("");
  const [customGoogleName, setCustomGoogleName] = useState("");
  const [customGoogleTitle, setCustomGoogleTitle] = useState("CEO");
  const [email, setEmail] = useState("jyotiraditya@twofold.studio");
  const [password, setPassword] = useState("Twofold2026!");
  const [inviteToken, setInviteToken] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  const pendingInvitations = (db.invitations || []).filter(
    (i) => i.status === "Pending"
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfoMessage("");
    setLoading(true);
    try {
      const res = await loginWithEmail(email, password);
      if (!res.ok) {
        setError(res.error || "Authentication failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLoginQuick = async (profile: {
    name: string;
    email: string;
    title: string;
  }) => {
    setError("");
    setInfoMessage("");
    setLoading(true);
    try {
      const res = await loginWithGoogle({
        name: profile.name,
        email: profile.email,
        role: "Admin",
        title: profile.title,
      });
      if (!res.ok) {
        setError(res.error || "Google authentication failed");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Google authentication failed"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCustomGoogleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customGoogleEmail.trim()) {
      setError("Please enter your Google email address.");
      return;
    }
    const rawName =
      customGoogleName.trim() || customGoogleEmail.split("@")[0] || "Executive";
    const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    await handleGoogleLoginQuick({
      name,
      email: customGoogleEmail.trim(),
      title: customGoogleTitle || "CEO",
    });
  };

  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfoMessage("");
    setLoading(true);
    try {
      const res = await acceptInvitation({
        token: inviteToken,
        password: newPassword,
        phone: invitePhone,
      });
      if (!res.ok) {
        setError(res.error || "Failed to accept invitation");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept invitation");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfoMessage("");
    setLoading(true);
    try {
      const res = await requestPasswordReset(email);
      if (!res.ok) {
        setError(res.error || "Failed to request reset token");
        return;
      }
      if (res.resetToken) {
        setResetToken(res.resetToken);
      }
      setInfoMessage(
        "Password reset token issued. Set your new password below."
      );
      setMode("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request reset token");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfoMessage("");
    setLoading(true);
    try {
      const res = await confirmPasswordReset(resetToken, newPassword);
      if (!res.ok) {
        setError(res.error || "Failed to reset password");
        return;
      }
      setPassword(newPassword);
      setInfoMessage("Password updated. Sign in with your new password.");
      setMode("login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-neutral-950 flex flex-col justify-center items-center px-4 py-12 text-neutral-900 dark:text-neutral-100">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-7">
          <div className="w-11 h-11 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center font-semibold text-base tracking-tight shadow-sm mb-3">
            TF
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Twofold Studio OS
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Multi-User Agency Operating System · Server-Verified Session Auth
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-2xl p-6 shadow-sm">
          {/* Mode Tabs */}
          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-950 mb-5 text-xs">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className={`py-1.5 rounded-lg font-medium transition ${
                mode === "login"
                  ? "bg-white dark:bg-neutral-800 shadow-2xs text-neutral-900 dark:text-white"
                  : "text-neutral-500"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("invite");
                setError("");
              }}
              className={`py-1.5 rounded-lg font-medium transition ${
                mode === "invite"
                  ? "bg-white dark:bg-neutral-800 shadow-2xs text-neutral-900 dark:text-white"
                  : "text-neutral-500"
              }`}
            >
              Accept Invite
              {pendingInvitations.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[10px]">
                  {pendingInvitations.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("forgot");
                setError("");
              }}
              className={`py-1.5 rounded-lg font-medium transition ${
                mode === "forgot" || mode === "reset"
                  ? "bg-white dark:bg-neutral-800 shadow-2xs text-neutral-900 dark:text-white"
                  : "text-neutral-500"
              }`}
            >
              Reset Password
            </button>
          </div>

          {error && (
            <div className="mb-4 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {infoMessage && (
            <div className="mb-4 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-lg px-3 py-2">
              {infoMessage}
            </div>
          )}

          {mode === "login" && showGoogleChooser && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center gap-2">
                  <GoogleLogo className="w-4 h-4 shrink-0" />
                  <span className="font-semibold text-sm">Sign in with Google</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGoogleChooser(false)}
                  className="text-xs text-neutral-500 hover:underline"
                >
                  ← Use Password
                </button>
              </div>

              <p className="text-xs text-neutral-500">
                Select an executive role or enter your Google / Gmail account to authenticate with instant Admin privileges.
              </p>

              {/* Instant Executive Google Accounts */}
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    handleGoogleLoginQuick({
                      name: "Rajdhar Diwedi",
                      email: "rajdhar@twofold.studio",
                      title: "Chief Executive Officer (CEO)",
                    })
                  }
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-neutral-900 dark:hover:border-white hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition text-left shadow-2xs group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                      RD
                    </div>
                    <div>
                      <div className="text-xs font-semibold group-hover:text-neutral-900 dark:group-hover:text-white">
                        Sign in as Rajdhar Diwedi (CEO)
                      </div>
                      <div className="text-[11px] text-neutral-400">
                        rajdhar@twofold.studio · Full Admin Rights
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:translate-x-0.5 transition" />
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    handleGoogleLoginQuick({
                      name: "Jyotiraditya",
                      email: "jyotiraditya@twofold.studio",
                      title: "Co-Founder & Executive Director",
                    })
                  }
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-neutral-900 dark:hover:border-white hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition text-left shadow-2xs group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                      JD
                    </div>
                    <div>
                      <div className="text-xs font-semibold group-hover:text-neutral-900 dark:group-hover:text-white">
                        Sign in as Jyotiraditya (Co-Founder)
                      </div>
                      <div className="text-[11px] text-neutral-400">
                        jyotiraditya@twofold.studio · Full Admin Rights
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:translate-x-0.5 transition" />
                </button>
              </div>

              {/* Custom Google Account Form */}
              <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800">
                <form onSubmit={handleCustomGoogleSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Or connect your personal Google / Gmail address:
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={customGoogleEmail}
                        onChange={(e) => setCustomGoogleEmail(e.target.value)}
                        placeholder="yourname@gmail.com"
                        className="w-full pl-9 pr-3.5 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-neutral-500 mb-1">
                        Your Full Name
                      </label>
                      <input
                        type="text"
                        value={customGoogleName}
                        onChange={(e) => setCustomGoogleName(e.target.value)}
                        placeholder="Alex Morgan"
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-neutral-500 mb-1">
                        Executive Title
                      </label>
                      <select
                        value={customGoogleTitle}
                        onChange={(e) => setCustomGoogleTitle(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      >
                        <option value="CEO">CEO</option>
                        <option value="Co-Founder">Co-Founder</option>
                        <option value="Managing Partner">Managing Partner</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 font-medium text-xs flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-sm"
                  >
                    <GoogleLogo className="w-3.5 h-3.5 shrink-0" />
                    {loading ? "Authenticating with Google..." : "Continue with this Google Account"}
                  </button>
                </form>
              </div>
            </div>
          )}

          {mode === "login" && !showGoogleChooser && (
            <div className="space-y-4">
              {/* Primary Google Login Button */}
              <button
                type="button"
                onClick={() => setShowGoogleChooser(true)}
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-750 font-medium text-sm flex items-center justify-center gap-3 transition shadow-2xs"
              >
                <GoogleLogo className="w-4 h-4 shrink-0" />
                <span>Continue with Google</span>
              </button>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-neutral-200 dark:border-neutral-800 w-full" />
                <span className="bg-white dark:bg-neutral-900 px-3 text-[10px] uppercase font-semibold text-neutral-400 shrink-0">
                  Or sign in with email
                </span>
                <div className="border-t border-neutral-200 dark:border-neutral-800 w-full" />
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Studio Email
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@twofold.studio"
                      className="w-full pl-9 pr-3.5 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="text-[11px] text-neutral-500 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-lg bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 font-medium text-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  <Lock className="w-3.5 h-3.5" />
                  {loading ? "Verifying Session..." : "Sign In to Workspace"}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                {/* Seeded Workspace Account Credentials Reference */}
                <div className="mt-5 pt-4 border-t border-neutral-100 dark:border-neutral-800 text-xs">
                  <div className="flex items-center justify-between text-neutral-500 mb-2">
                    <span className="font-medium">
                      Workspace Team Accounts (Password:{" "}
                      <code className="font-mono bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                        Twofold2026!
                      </code>
                      )
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {db.teamMembers.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setEmail(m.email);
                          setPassword("Twofold2026!");
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-left transition ${
                          email.toLowerCase() === m.email.toLowerCase()
                            ? "border-neutral-900 dark:border-white bg-neutral-50 dark:bg-neutral-800/60"
                            : "border-neutral-200/70 dark:border-neutral-800 hover:bg-neutral-50"
                        }`}
                      >
                        <div>
                          <span className="font-medium">{m.name}</span>{" "}
                          <span className="text-neutral-400">({m.email})</span>
                        </div>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800">
                          {m.role}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </form>
            </div>
          )}

          {mode === "invite" && (
            <form onSubmit={handleAcceptInvite} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium mb-1">
                  Invitation Token *
                </label>
                <input
                  required
                  value={inviteToken}
                  onChange={(e) => setInviteToken(e.target.value)}
                  placeholder="inv_..."
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 font-mono"
                />
              </div>

              {pendingInvitations.length > 0 && (
                <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-1.5">
                  <div className="text-[11px] text-neutral-500 font-medium">
                    Pending Workspace Invitations (Click to autofill token):
                  </div>
                  {pendingInvitations.map((inv) => (
                    <button
                      key={inv.id}
                      type="button"
                      onClick={() => setInviteToken(inv.token)}
                      className="w-full flex items-center justify-between p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-left"
                    >
                      <span>
                        <strong>{inv.name}</strong> ({inv.email})
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 text-[10px]">
                        {inv.role}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div>
                <label className="block font-medium mb-1">
                  Create Account Password (min 8 chars) *
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">
                  Phone Number (Optional)
                </label>
                <input
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                  placeholder="+1 (415) 555-0190"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium flex items-center justify-center gap-2"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {loading
                  ? "Activating Membership..."
                  : "Complete Registration & Join"}
              </button>
            </form>
          )}

          {mode === "forgot" && (
            <form onSubmit={handleForgotPassword} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium mb-1">
                  Account Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium flex items-center justify-center gap-2"
              >
                <KeyRound className="w-3.5 h-3.5" />
                {loading ? "Generating Reset Token..." : "Issue Password Reset Token"}
              </button>
            </form>
          )}

          {mode === "reset" && (
            <form onSubmit={handleConfirmReset} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium mb-1">Reset Token *</label>
                <input
                  required
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">
                  New Password (min 8 chars) *
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium"
              >
                Confirm New Password
              </button>
            </form>
          )}
        </div>

        <div className="mt-6 flex items-center justify-center gap-4 text-xs text-neutral-400">
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            HTTP-Only Session Cookies &amp; RBAC
          </span>
          <span>•</span>
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            Realtime Sync Active
          </span>
        </div>
      </div>
    </div>
  );
}
