"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8fafc",
          color: "#0f172a",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 18, margin: "0 0 8px" }}>
            Aplikasi gagal dimuat
          </h1>
          <p style={{ fontSize: 14, color: "#475569", margin: "0 0 16px" }}>
            Muat ulang halaman. Kalau terus terjadi, hubungi admin dengan kode di
            bawah.
          </p>
          {error.digest ? (
            <p style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace" }}>
              {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 16,
              padding: "10px 18px",
              borderRadius: 8,
              border: 0,
              background: "#0f172a",
              color: "#fff",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Coba lagi
          </button>
        </div>
      </body>
    </html>
  );
}
