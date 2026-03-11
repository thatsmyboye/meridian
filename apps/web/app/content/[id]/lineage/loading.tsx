export default function ContentLineageLoading() {
  return (
    <main
      style={{
        maxWidth: 800,
        margin: "0 auto",
        padding: "32px 24px 64px",
      }}
    >
      {/* Back link */}
      <div className="skeleton" style={{ width: 160, height: 16, marginBottom: 24 }} />

      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <div className="skeleton" style={{ width: 180, height: 26, marginBottom: 8 }} />
        <div className="skeleton" style={{ width: 320, height: 16 }} />
      </div>

      {/* Summary stat cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 12,
          marginBottom: 32,
        }}
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: "14px 16px",
              background: "#fff",
            }}
          >
            <div className="skeleton" style={{ width: 110, height: 12, marginBottom: 8 }} />
            <div className="skeleton" style={{ width: 70, height: 24, marginBottom: 4 }} />
            <div className="skeleton" style={{ width: 120, height: 11 }} />
          </div>
        ))}
      </div>

      {/* Lineage tree section */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          background: "#fff",
          overflow: "hidden",
        }}
      >
        {/* Tree header */}
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid #f3f4f6",
            background: "#f9fafb",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div className="skeleton" style={{ width: 100, height: 16 }} />
          <div className="skeleton" style={{ width: 140, height: 14 }} />
        </div>

        {/* Tree node skeletons */}
        <div style={{ padding: "16px 20px" }}>
          {/* Root node */}
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: "10px 12px",
              background: "#f9fafb",
              marginBottom: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <div className="skeleton" style={{ width: 54, height: 16, borderRadius: 4 }} />
                <div className="skeleton" style={{ width: 64, height: 16, borderRadius: 4 }} />
                <div className="skeleton" style={{ width: 80, height: 14 }} />
              </div>
              <div className="skeleton" style={{ width: "55%", height: 14 }} />
            </div>
            <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
              <div className="skeleton" style={{ width: 70, height: 14, marginBottom: 4 }} />
              <div className="skeleton" style={{ width: 80, height: 12 }} />
            </div>
          </div>

          {/* Child node 1 */}
          <div style={{ display: "flex", alignItems: "stretch", marginBottom: 6 }}>
            <div style={{ width: 32, flexShrink: 0 }} />
            <div
              style={{
                flex: 1,
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: "10px 12px",
                background: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <div className="skeleton" style={{ width: 64, height: 16, borderRadius: 4 }} />
                  <div className="skeleton" style={{ width: 80, height: 14 }} />
                </div>
                <div className="skeleton" style={{ width: "50%", height: 14 }} />
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                <div className="skeleton" style={{ width: 60, height: 14, marginBottom: 4 }} />
                <div className="skeleton" style={{ width: 75, height: 12 }} />
              </div>
            </div>
          </div>

          {/* Child node 2 */}
          <div style={{ display: "flex", alignItems: "stretch", marginBottom: 6 }}>
            <div style={{ width: 32, flexShrink: 0 }} />
            <div
              style={{
                flex: 1,
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: "10px 12px",
                background: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <div className="skeleton" style={{ width: 72, height: 16, borderRadius: 4 }} />
                  <div className="skeleton" style={{ width: 80, height: 14 }} />
                </div>
                <div className="skeleton" style={{ width: "45%", height: 14 }} />
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                <div className="skeleton" style={{ width: 60, height: 14, marginBottom: 4 }} />
                <div className="skeleton" style={{ width: 75, height: 12 }} />
              </div>
            </div>
          </div>

          {/* Grandchild node */}
          <div style={{ display: "flex", alignItems: "stretch" }}>
            <div style={{ width: 64, flexShrink: 0 }} />
            <div
              style={{
                flex: 1,
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: "10px 12px",
                background: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <div className="skeleton" style={{ width: 56, height: 16, borderRadius: 4 }} />
                  <div className="skeleton" style={{ width: 80, height: 14 }} />
                </div>
                <div className="skeleton" style={{ width: "40%", height: 14 }} />
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                <div className="skeleton" style={{ width: 60, height: 14, marginBottom: 4 }} />
                <div className="skeleton" style={{ width: 75, height: 12 }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
