export default function CalendarLoading() {
  return (
    <div
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "32px 24px 64px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 28,
        }}
      >
        <div>
          <div className="skeleton" style={{ width: 180, height: 26, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: 280, height: 15 }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div className="skeleton" style={{ width: 80, height: 32, borderRadius: 6 }} />
          <div className="skeleton" style={{ width: 80, height: 32, borderRadius: 6 }} />
        </div>
      </div>

      {/* Month nav */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 6 }} />
        <div className="skeleton" style={{ width: 160, height: 22 }} />
        <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 6 }} />
      </div>

      {/* Calendar grid */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          overflow: "hidden",
          background: "#fff",
        }}
      >
        {/* Day-of-week header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            borderBottom: "1px solid #e5e7eb",
            background: "#f9fafb",
          }}
        >
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              style={{
                padding: "10px 0",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <div className="skeleton" style={{ width: 28, height: 14 }} />
            </div>
          ))}
        </div>

        {/* Calendar rows (5 weeks) */}
        {Array.from({ length: 5 }).map((_, row) => (
          <div
            key={row}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              borderBottom: row < 4 ? "1px solid #f3f4f6" : undefined,
            }}
          >
            {Array.from({ length: 7 }).map((_, col) => (
              <div
                key={col}
                style={{
                  minHeight: 96,
                  padding: "8px 10px",
                  borderRight: col < 6 ? "1px solid #f3f4f6" : undefined,
                }}
              >
                <div className="skeleton" style={{ width: 22, height: 16, marginBottom: 8 }} />
                {/* Occasional event pills */}
                {(row * 7 + col) % 5 === 0 && (
                  <div
                    className="skeleton"
                    style={{ width: "85%", height: 22, borderRadius: 4, marginBottom: 4 }}
                  />
                )}
                {(row * 7 + col) % 8 === 0 && (
                  <div
                    className="skeleton"
                    style={{ width: "70%", height: 22, borderRadius: 4 }}
                  />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
