export default function ConnectLoading() {
  return (
    <div
      style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: "32px 24px 64px",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div className="skeleton" style={{ width: 200, height: 28, marginBottom: 8 }} />
        <div className="skeleton" style={{ width: 340, height: 16 }} />
      </div>

      {/* Platform connection cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 8 }} />
              <div>
                <div className="skeleton" style={{ width: 100, height: 17, marginBottom: 5 }} />
                <div className="skeleton" style={{ width: 150, height: 13 }} />
              </div>
            </div>
            <div className="skeleton" style={{ width: 90, height: 34, borderRadius: 7 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
