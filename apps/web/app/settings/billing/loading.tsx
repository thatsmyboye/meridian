export default function BillingLoading() {
  return (
    <main
      style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: "32px 24px 64px",
      }}
    >
      {/* Back link + header */}
      <div style={{ marginBottom: 32 }}>
        <div className="skeleton" style={{ width: 120, height: 16, marginBottom: 20 }} />
        <div className="skeleton" style={{ width: 240, height: 28, marginBottom: 8 }} />
        <div className="skeleton" style={{ width: 320, height: 16 }} />
      </div>

      {/* Current plan card */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: "20px 24px",
          background: "#fff",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div className="skeleton" style={{ width: 80, height: 13, marginBottom: 6 }} />
            <div className="skeleton" style={{ width: 120, height: 22 }} />
          </div>
          <div className="skeleton" style={{ width: 90, height: 32, borderRadius: 6 }} />
        </div>
        {/* Usage bar */}
        <div className="skeleton" style={{ width: 160, height: 13, marginBottom: 8 }} />
        <div
          style={{
            background: "#f3f4f6",
            borderRadius: 4,
            height: 8,
            marginBottom: 6,
            overflow: "hidden",
          }}
        >
          <div className="skeleton" style={{ width: "40%", height: "100%" }} />
        </div>
        <div className="skeleton" style={{ width: 100, height: 12 }} />
      </div>

      {/* Plan tier cards */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: "20px 24px",
            background: "#fff",
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <div className="skeleton" style={{ width: 80, height: 20, marginBottom: 6 }} />
              <div className="skeleton" style={{ width: 100, height: 26 }} />
            </div>
            <div className="skeleton" style={{ width: 100, height: 36, borderRadius: 8 }} />
          </div>
          <div className="skeleton" style={{ width: "90%", height: 13, marginBottom: 6 }} />
          <div className="skeleton" style={{ width: "70%", height: 13, marginBottom: 6 }} />
          <div className="skeleton" style={{ width: "80%", height: 13 }} />
        </div>
      ))}
    </main>
  );
}
