export default function Loading() {
  return (
    <div
      style={{
        maxWidth: 800,
        margin: "0 auto",
        padding: "32px 24px 64px",
      }}
    >
      {/* Header skeleton */}
      <div style={{ marginBottom: 32 }}>
        <div
          className="skeleton"
          style={{ width: 180, height: 28, marginBottom: 8 }}
        />
        <div className="skeleton" style={{ width: 280, height: 16 }} />
      </div>

      {/* Card skeletons */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          marginBottom: 32,
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
            <div
              className="skeleton"
              style={{ width: 80, height: 12, marginBottom: 8 }}
            />
            <div className="skeleton" style={{ width: 120, height: 24 }} />
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 20,
        }}
      >
        <div
          className="skeleton"
          style={{ width: "100%", height: 200 }}
        />
      </div>
    </div>
  );
}
