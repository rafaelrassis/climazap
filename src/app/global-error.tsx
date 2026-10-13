"use client";

// Último recurso: erro no layout raiz. Sem componentes do app (o layout pode ser o que quebrou).
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "flex", minHeight: "100dvh", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 16 }}>
        <div>
          <h1 style={{ fontSize: 20 }}>Algo deu errado</h1>
          <p style={{ color: "#64748b", fontSize: 14 }}>Já fomos avisados. Tente de novo em instantes.</p>
          <button
            onClick={reset}
            style={{ minHeight: 48, width: "100%", maxWidth: 320, fontSize: 16, borderRadius: 8, border: 0, background: "#0f172a", color: "#fff" }}
          >
            Tentar de novo
          </button>
        </div>
      </body>
    </html>
  );
}
