"use client";

// Signup page — Section 2 (Auth). Mirrors login; on success routes to dashboard.
// Client-side we surface the server's validation errors (password length, email
// format, duplicate email conflict) via the normalized ApiErrorBody.
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api/browser";
import { errorMessage } from "@/lib/ui/errors";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await api.signup(email, password);
    setBusy(false);
    if (res.ok) {
      router.push("/dashboard");
    } else {
      setError(errorMessage(res.error));
    }
  }

  return (
    <main style={styles.wrap}>
      <h1>Create account</h1>
      <form onSubmit={onSubmit} style={styles.form}>
        <label style={styles.label}>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={styles.input}
          />
        </label>
        <label style={styles.label}>
          Password (min 8 characters)
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            style={styles.input}
          />
        </label>
        {error && <p role="alert" style={styles.error}>{error}</p>}
        <button type="submit" disabled={busy} style={styles.button}>
          {busy ? "Creating…" : "Sign up"}
        </button>
      </form>
      <p>
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { fontFamily: "system-ui", maxWidth: 420, margin: "48px auto", padding: 24 },
  form: { display: "flex", flexDirection: "column", gap: 12 },
  label: { display: "flex", flexDirection: "column", gap: 4, fontSize: 14 },
  input: { padding: 8, fontSize: 16, border: "1px solid #ccc", borderRadius: 6 },
  button: { padding: 10, fontSize: 16, borderRadius: 6, cursor: "pointer" },
  error: { color: "#b00020", fontSize: 14, margin: 0 },
};
