import { useState } from "react";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { auth } from "../lib/api";

type Screen = "login" | "register" | "forgot" | "reset";

export default function AuthPage({ onAuth }: { onAuth: () => void }) {
  const [screen, setScreen] = useState<Screen>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function switchScreen(s: Screen) {
    setScreen(s);
    setError(null);
    setInfo(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (screen === "login") {
        await auth.login(email.trim(), password);
        onAuth();
      } else if (screen === "register") {
        await auth.register(email.trim(), password, username.trim() || undefined);
        onAuth();
      } else if (screen === "forgot") {
        await auth.forgotPassword(email.trim());
        setInfo("Check your email for a 6-digit code. It expires in 15 minutes.");
        switchScreen("reset");
      } else if (screen === "reset") {
        await auth.resetPassword(email.trim(), otp.trim(), newPassword);
        setInfo("Password updated — please sign in.");
        switchScreen("login");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function googleSignIn() {
    setError(null);
    setLoading(true);
    try {
      await FirebaseAuthentication.signInWithGoogle();
      const { token: idToken } = await FirebaseAuthentication.getIdToken({ forceRefresh: true });
      await auth.loginWithGoogle(idToken);
      onAuth();
    } catch (err) {
      const msg = (err as Error).message || "";
      // Code 12501 = user cancelled the picker
      if (msg.includes("12501") || msg.toLowerCase().includes("cancel")) return;
      setError(msg.includes("already exists") ? msg : "Google Sign-In failed — please try again");
    } finally {
      setLoading(false);
    }
  }

  const isAuthScreen = screen === "login" || screen === "register";

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight sd-display mb-1">Score Day</h1>
        <p className="sd-text-3 text-sm mb-8">
          {screen === "login" && "Sign in to your account"}
          {screen === "register" && "Create a new account"}
          {screen === "forgot" && "Reset your password"}
          {screen === "reset" && "Enter your reset code"}
        </p>

        {info && (
          <p className="text-sm text-green-400 border border-green-900 bg-green-950/40 rounded-md px-3 py-2 mb-4">
            {info}
          </p>
        )}

        <form onSubmit={submit} className="flex flex-col gap-4">
          {screen === "register" && (
            <div>
              <label className="block text-sm sd-text-2 mb-1">
                Name <span className="sd-text-4">(optional)</span>
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={40}
                className="sd-input rounded-md px-3 py-2 text-sm w-full focus:outline-none"
                placeholder="What should we call you?"
              />
            </div>
          )}

          {(screen === "login" || screen === "register" || screen === "forgot" || screen === "reset") && (
            <div>
              <label className="block text-sm sd-text-2 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={screen === "reset"}
                className="sd-input rounded-md px-3 py-2 text-sm w-full focus:outline-none disabled:opacity-50"
                placeholder="you@example.com"
              />
            </div>
          )}

          {(screen === "login" || screen === "register") && (
            <div>
              <label className="block text-sm sd-text-2 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="sd-input rounded-md px-3 py-2 text-sm w-full focus:outline-none"
                placeholder="Min. 6 characters"
              />
            </div>
          )}

          {screen === "reset" && (
            <>
              <div>
                <label className="block text-sm sd-text-2 mb-1">6-digit code</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  inputMode="numeric"
                  className="sd-input rounded-md px-3 py-2 text-sm w-full focus:outline-none tracking-widest text-center text-lg"
                  placeholder="000000"
                />
              </div>
              <div>
                <label className="block text-sm sd-text-2 mb-1">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  className="sd-input rounded-md px-3 py-2 text-sm w-full focus:outline-none"
                  placeholder="Min. 6 characters"
                />
              </div>
            </>
          )}

          {error && (
            <p className="text-sm text-red-400 border border-red-900 bg-red-950/40 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="sd-btn-accent rounded-md py-2 text-sm font-medium transition"
          >
            {loading ? "Please wait…" :
              screen === "login" ? "Sign in" :
              screen === "register" ? "Create account" :
              screen === "forgot" ? "Send reset code" :
              "Set new password"}
          </button>

          {screen === "login" && (
            <button
              type="button"
              disabled={loading}
              onClick={() => switchScreen("forgot")}
              className="text-xs sd-text-4 hover:sd-text-2 text-center transition"
            >
              Forgot password?
            </button>
          )}
        </form>

        {isAuthScreen && (
          <>
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-[var(--surface-3)]" />
              <span className="text-xs sd-text-4">or</span>
              <div className="flex-1 h-px bg-[var(--surface-3)]" />
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={googleSignIn}
              className="w-full flex items-center justify-center gap-2.5 sd-btn-surface rounded-md py-2 text-sm font-medium transition"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          </>
        )}

        {(screen === "login" || screen === "register") && (
          <p className="text-center text-sm sd-text-3 mt-6">
            {screen === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              className="sd-text-1 hover:text-[var(--accent)] underline transition"
              onClick={() => switchScreen(screen === "login" ? "register" : "login")}
            >
              {screen === "login" ? "Register" : "Sign in"}
            </button>
          </p>
        )}

        {(screen === "forgot" || screen === "reset") && (
          <p className="text-center text-sm sd-text-3 mt-6">
            <button
              className="sd-text-1 hover:text-[var(--accent)] underline transition"
              onClick={() => switchScreen("login")}
            >
              Back to sign in
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
