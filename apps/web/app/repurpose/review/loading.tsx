export default function ReviewLoading() {
  return (
    <div
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "32px 24px 64px",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div className="skeleton" style={{ width: 140, height: 16, marginBottom: 16 }} />
        <div className="skeleton" style={{ width: 260, height: 26, marginBottom: 8 }} />
        <div className="skeleton" style={{ width: 200, height: 15 }} />
      </div>

      {/* Source content banner */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          padding: "14px 18px",
          background: "#f9fafb",
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div className="skeleton" style={{ width: 60, height: 20, borderRadius: 5 }} />
        <div className="skeleton" style={{ width: 280, height: 16 }} />
      </div>

      {/* Derivative review cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "#fff",
              overflow: "hidden",
            }}
          >
            {/* Card header */}
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid #f3f4f6",
                background: "#f9fafb",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="skeleton" style={{ width: 64, height: 22, borderRadius: 5 }} />
                <div className="skeleton" style={{ width: 120, height: 18 }} />
              </div>
              <div className="skeleton" style={{ width: 70, height: 22, borderRadius: 5 }} />
            </div>
            {/* Card body */}
            <div style={{ padding: "16px 18px" }}>
              <div className="skeleton" style={{ width: "100%", height: 14, marginBottom: 8 }} />
              <div className="skeleton" style={{ width: "95%", height: 14, marginBottom: 8 }} />
              <div className="skeleton" style={{ width: "80%", height: 14, marginBottom: 8 }} />
              <div className="skeleton" style={{ width: "85%", height: 14 }} />
            </div>
            {/* Card actions */}
            <div
              style={{
                padding: "12px 18px",
                borderTop: "1px solid #f3f4f6",
                display: "flex",
                gap: 8,
              }}
            >
              <div className="skeleton" style={{ width: 90, height: 34, borderRadius: 7 }} />
              <div className="skeleton" style={{ width: 110, height: 34, borderRadius: 7 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
