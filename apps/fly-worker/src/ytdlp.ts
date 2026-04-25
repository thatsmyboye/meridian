import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { writeCookiesFile } from "./cookies.js";

export interface YtDlpResult {
  audioPath: string;
  cleanup: () => void;
}

/**
 * Downloads the audio track of a YouTube video using yt-dlp.
 *
 * Cookie file is written from YT_DLP_COOKIES_B64 if present (required for
 * age-restricted videos or channels that block anonymous downloads).
 *
 * Resolves with the path to the downloaded audio file.
 * Rejects with an error containing the yt-dlp stderr tail on failure.
 */
export async function downloadYouTubeAudio(videoId: string): Promise<YtDlpResult> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "yt-audio-"));
  const outputTemplate = path.join(tmpDir, "audio.%(ext)s");

  const args = [
    `https://www.youtube.com/watch?v=${videoId}`,
    "--format", "bestaudio[ext=m4a]/bestaudio/best",
    "--extract-audio",
    "--audio-format", "mp4",
    "--output", outputTemplate,
    "--no-playlist",
    "--quiet",
    "--no-warnings",
  ];

  // Write cookies file from env var; pass it to yt-dlp when present
  let cookiesPath: string | null = null;
  try {
    cookiesPath = writeCookiesFile();
  } catch (err) {
    console.warn(`[ytdlp] Cookie setup failed, continuing without cookies: ${err}`);
  }
  if (cookiesPath) {
    args.push("--cookies", cookiesPath);
  }

  const stderrLines: string[] = [];

  await new Promise<void>((resolve, reject) => {
    const proc = spawn("yt-dlp", args, { stdio: ["ignore", "pipe", "pipe"] });

    proc.stderr.on("data", (chunk: Buffer) => {
      const lines = chunk.toString().split("\n").filter(Boolean);
      stderrLines.push(...lines);
    });

    proc.on("close", (rc) => {
      if (rc === 0) {
        resolve();
      } else {
        const tail = stderrLines.slice(-10).join("\n");
        const err = new Error(
          `yt-dlp failed rc=${rc} youtube_video_id=${videoId} stderr_tail="${tail}"`
        );
        console.error(err.message);
        reject(err);
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`yt-dlp spawn error: ${err.message}`));
    });
  });

  const files = fs.readdirSync(tmpDir);
  const audioFile = files.find((f) => f.startsWith("audio."));
  if (!audioFile) {
    throw new Error(`yt-dlp completed but no audio file found in ${tmpDir}`);
  }

  return {
    audioPath: path.join(tmpDir, audioFile),
    cleanup: () => fs.rmSync(tmpDir, { recursive: true, force: true }),
  };
}
