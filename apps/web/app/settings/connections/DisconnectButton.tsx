"use client";

import { useState, useTransition } from "react";
import { disconnectPlatform } from "./actions";

interface DisconnectButtonProps {
  platform: string;
  platformLabel: string;
}

export default function DisconnectButton({ platform, platformLabel }: DisconnectButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      await disconnectPlatform(platform);
      setShowConfirm(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        style={{
          background: "transparent",
          color: "#ef4444",
          padding: "7px 16px",
          borderRadius: 6,
          border: "1px solid #fca5a5",
          fontWeight: 600,
          fontSize: 13,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Disconnect
      </button>

      {showConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="disconnect-dialog-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          {/* Backdrop */}
          <div
            aria-hidden="true"
            onClick={() => !isPending && setShowConfirm(false)}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.4)",
            }}
          />

          {/* Dialog */}
          <div
            style={{
              position: "relative",
              background: "#fff",
              borderRadius: 12,
              padding: 28,
              maxWidth: 400,
              width: "100%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
            }}
          >
            <h2
              id="disconnect-dialog-title"
              style={{ fontSize: 18, fontWeight: 700, margin: "0 0 10px" }}
            >
              Disconnect {platformLabel}?
            </h2>
            <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 24px", lineHeight: 1.5 }}>
              This will remove your saved credentials permanently. You will need
              to reconnect and re-authorise {platformLabel} to import content again.
            </p>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={isPending}
                style={{
                  background: "#f3f4f6",
                  color: "#374151",
                  padding: "8px 18px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: isPending ? "not-allowed" : "pointer",
                  opacity: isPending ? 0.6 : 1,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                style={{
                  background: isPending ? "#fca5a5" : "#ef4444",
                  color: "#fff",
                  padding: "8px 18px",
                  borderRadius: 6,
                  border: "none",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: isPending ? "not-allowed" : "pointer",
                }}
              >
                {isPending ? "Disconnecting…" : "Yes, disconnect"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
