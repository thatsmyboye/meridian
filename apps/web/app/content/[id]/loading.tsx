export default function ContentDetailLoading() {
  return (
    <main
      style={{
        maxWidth: 800,
        margin: "0 auto",
        padding: "32px 24px 64px",
      }}
    >
      {/* Back link + lineage button */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div className="skeleton" style={{ width: 140, height: 16 }} />
        <div className="skeleton" style={{ width: 130, height: 30, borderRadius: 7 }} />
      </div>

      {/* Header: platform badge + date + title */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div className="skeleton" style={{ width: 72, height: 22, borderRadius: 5 }} />
          <div className="skeleton" style={{ width: 160, height: 16 }} />
        </div>
        <div className="skeleton" style={{ width: "70%", height: 26, marginBottom: 6 }} />
        <div className="skeleton" style={{ width: "45%", height: 26 }} />
      </div>

      {/* Stat cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
          marginBottom: 32,
        }}
      >
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: "14px 16px",
              background: "#fff",
            }}
          >
            <div className="skeleton" style={{ width: 90, height: 12, marginBottom: 8 }} />
            <div className="skeleton" style={{ width: 80, height: 24, marginBottom: 4 }} />
            <div className="skeleton" style={{ width: 60, height: 11 }} />
          </div>
        ))}
      </div>

      {/* Performance timeline chart */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          padding: "20px 20px 16px",
          background: "#fff",
          marginBottom: 32,
        }}
      >
        <div className="skeleton" style={{ width: 160, height: 18, marginBottom: 16 }} />
        <div className="skeleton" style={{ width: "100%", height: 220 }} />
      </div>

      {/* Derivative children list */}
      <div>
        <div className="skeleton" style={{ width: 180, height: 18, marginBottom: 12 }} />
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 16px",
                borderTop: i > 0 ? "1px solid #f3f4f6" : undefined,
                background: "#fff",
              }}
            >
              <div style={{ flex: 1, marginRight: 16 }}>
                <div className="skeleton" style={{ width: "60%", height: 14, marginBottom: 6 }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <div className="skeleton" style={{ width: 60, height: 18, borderRadius: 4 }} />
                  <div className="skeleton" style={{ width: 80, height: 18 }} />
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="skeleton" style={{ width: 70, height: 14, marginBottom: 4 }} />
                <div className="skeleton" style={{ width: 90, height: 12 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
