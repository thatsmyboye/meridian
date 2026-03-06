export default function ConnectionsLoading() {
  return (
    <div
      style={{
        maxWidth: 600,
        margin: "0 auto",
        padding: "32px 24px 64px",
      }}
    >
      <div style={{ marginBottom: 32 }}>
        <div
          className="skeleton"
          style={{ width: 220, height: 28, marginBottom: 8 }}
        />
        <div className="skeleton" style={{ width: 340, height: 16 }} />
      </div>

      <div
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 8 }} />
              <div>
                <div className="skeleton" style={{ width: 100, height: 18, marginBottom: 4 }} />
                <div className="skeleton" style={{ width: 160, height: 14 }} />
              </div>
            </div>
            <div className="skeleton" style={{ width: 80, height: 32, borderRadius: 6 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
