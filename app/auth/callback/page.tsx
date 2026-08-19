"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { completeSignIn } from "../../auth";

export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    completeSignIn()
      .then((returnTo) => router.replace(returnTo))
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "Sign-in could not be completed"),
      );
  }, [router]);

  return (
    <main className="auth-screen">
      <div className="auth-card">
        <span className="auth-mark">FD</span>
        <p className="eyebrow">Front Office</p>
        <h1>{error ? "Sign-in failed" : "Finishing sign-in…"}</h1>
        {error && <p className="auth-error">{error}</p>}
        {error && <Link href="/">Return to Front Office</Link>}
      </div>
    </main>
  );
}
