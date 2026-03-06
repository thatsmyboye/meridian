export default function RepurposeLoading() {
  return (
    <div
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "32px 24px 64px",
      }}
    >
      <div style={{ marginBottom: 32 }}>
        <div
          className="skeleton"
          style={{ width: 200, height: 28, marginBottom: 8 }}
        />
        <div className="skeleton" style={{ width: 320, height: 16 }} />
      </div>

      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        {/* Table header skeleton */}
        <div
          style={{
            padding: "12px 20px",
            background: "#f9fafb",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <div className="skeleton" style={{ width: "100%", height: 14 }} />
        </div>
        {/* Row skeletons */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid #f3f4f6",
            }}
          >
            <div className="skeleton" style={{ width: "100%", height: 18 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
