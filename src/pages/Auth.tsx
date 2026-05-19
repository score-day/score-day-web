import { useState } from "react";
import { auth } from "../lib/api";

export default function AuthPage({ onAuth }: { onAuth: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await auth.login(email.trim(), password);
      } else {
        await auth.register(email.trim(), password, username.trim() || undefined);
      }
      onAuth();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight sd-display mb-1">Score Day</h1>
        <p className="sd-text-3 text-sm mb-8">
          {mode === "login" ? "Sign in to your account" : "Create a new account"}
        </p>

        <form onSubmit={submit} className="flex flex-col gap-4">
          {mode === "register" && (
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
          <div>
            <label className="block text-sm sd-text-2 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="sd-input rounded-md px-3 py-2 text-sm w-full focus:outline-none"
              placeholder="you@example.com"
            />
          </div>
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
            {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm sd-text-3 mt-6">
          {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            className="sd-text-1 hover:text-[var(--accent)] underline transition"
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}
          >
            {mode === "login" ? "Register" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
