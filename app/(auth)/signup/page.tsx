"use client";

// Signup page — Section 2 (Auth). Mirrors login; on success routes to dashboard.
// (Handler logic unchanged from pre-restyle — only markup/styles.)
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api/browser";
import { errorMessage } from "@/lib/ui/errors";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/Feedback";
import styles from "../auth.module.css";

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
    <main className={styles.wrap}>
      <div className={styles.panel}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">◎</span>
          <span>Cashback Optimizer</span>
        </div>
        <Card>
          <h1 className={styles.title}>Create your account</h1>
          <p className={styles.subtitle}>Start finding your missed rewards.</p>
          <form onSubmit={onSubmit} className={styles.form}>
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </Field>
            <Field label="Password" hint="At least 8 characters.">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
              />
            </Field>
            {error && <ErrorBanner>{error}</ErrorBanner>}
            <Button type="submit" disabled={busy} block>
              {busy ? "Creating…" : "Sign up"}
            </Button>
          </form>
        </Card>
        <p className={styles.footer}>
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </div>
    </main>
  );
}
