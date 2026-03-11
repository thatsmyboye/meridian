export default function PlatformsLoading() {
  return (
    <main
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: "32px 24px 64px",
      }}
    >
      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <div className="skeleton" style={{ width: 220, height: 28, marginBottom: 8 }} />
        <div className="skeleton" style={{ width: 360, height: 16 }} />
      </div>

      {/* Radar chart area */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 24,
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          <div className="skeleton" style={{ width: 80, height: 30, borderRadius: 6 }} />
          <div className="skeleton" style={{ width: 80, height: 30, borderRadius: 6 }} />
          <div className="skeleton" style={{ width: 80, height: 30, borderRadius: 6 }} />
        </div>
        <div className="skeleton" style={{ width: "100%", height: 300, borderRadius: 8 }} />
      </div>

      {/* Platform metric cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: "16px 18px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 6 }} />
              <div className="skeleton" style={{ width: 100, height: 18 }} />
            </div>
            <div className="skeleton" style={{ width: "100%", height: 12, marginBottom: 8 }} />
            <div className="skeleton" style={{ width: "80%", height: 12, marginBottom: 8 }} />
            <div className="skeleton" style={{ width: "60%", height: 12 }} />
          </div>
        ))}
      </div>
    </main>
  );
}
