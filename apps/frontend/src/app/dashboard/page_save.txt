// apps/frontend/src/app/dashboard/page.tsx
export default function DashboardPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "black",
        color: "white",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div>
        <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>DoFlow Dashboard</h1>
        <p>Se vedi questa schermata in produzione, il routing login → dashboard funziona.</p>
      </div>
    </main>
  );
}
