import fs from "node:fs";
import http from "node:http";
import { downloadYouTubeAudio } from "./ytdlp.js";

const PORT = Number(process.env.PORT ?? 8080);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // POST /audio  body: { videoId: string }
  if (req.method === "POST" && url.pathname === "/audio") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      let videoId: string;
      try {
        ({ videoId } = JSON.parse(body) as { videoId: string });
        if (!videoId || typeof videoId !== "string") throw new Error("missing videoId");
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Request body must be JSON { videoId: string }" }));
        return;
      }

      // Sanitize: only allow valid YouTube video IDs (11 alphanumeric chars + - _)
      if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid YouTube video ID" }));
        return;
      }

      let result: Awaited<ReturnType<typeof downloadYouTubeAudio>> | null = null;
      try {
        result = await downloadYouTubeAudio(videoId);
        const stat = fs.statSync(result.audioPath);
        res.writeHead(200, {
          "Content-Type": "audio/mp4",
          "Content-Length": String(stat.size),
          "X-Video-Id": videoId,
        });
        fs.createReadStream(result.audioPath).pipe(res);
        res.on("finish", () => result?.cleanup());
      } catch (err) {
        result?.cleanup();
        console.error(`[server] /audio failed for ${videoId}:`, err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(err) }));
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`[fly-worker] listening on port ${PORT}`);
});
