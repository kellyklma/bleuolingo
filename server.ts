import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // High-fidelity Audio TTS streaming endpoint
  // Works reliably across all browsers and sandboxed iframes without permissions policy blocks
  app.get("/api/tts", async (req, res) => {
    try {
      const text = typeof req.query.text === "string" ? req.query.text.trim() : "";
      const rawLang = typeof req.query.lang === "string" ? req.query.lang.trim() : "fr";

      if (!text) {
        return res.status(400).send("Text parameter is required");
      }

      // Map language code to standard 2-letter ISO code
      let lang = "fr";
      const normalizedLang = rawLang.toLowerCase();
      if (normalizedLang.startsWith("en")) {
        lang = "en";
      } else if (normalizedLang.startsWith("es")) {
        lang = "es";
      } else if (normalizedLang.startsWith("de")) {
        lang = "de";
      } else if (normalizedLang.startsWith("it")) {
        lang = "it";
      } else if (normalizedLang.startsWith("ja")) {
        lang = "ja";
      } else if (normalizedLang.startsWith("zh")) {
        lang = "zh";
      } else if (normalizedLang.startsWith("pt")) {
        lang = "pt";
      } else if (normalizedLang.startsWith("ru")) {
        lang = "ru";
      } else if (normalizedLang.startsWith("nl")) {
        lang = "nl";
      } else if (normalizedLang.startsWith("ar")) {
        lang = "ar";
      } else if (normalizedLang.startsWith("ko")) {
        lang = "ko";
      } else {
        lang = "fr";
      }

      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(
        lang
      )}&q=${encodeURIComponent(text.slice(0, 200))}`;

      const ttsResponse = await fetch(ttsUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "audio/mpeg, audio/*; q=0.9",
        },
      });

      if (!ttsResponse.ok) {
        console.warn(`TTS remote returned status ${ttsResponse.status}`);
        return res.status(ttsResponse.status).send("TTS remote audio failure");
      }

      const arrayBuffer = await ttsResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Length", buffer.length);
      res.setHeader("Cache-Control", "public, max-age=86400, immutable");
      return res.send(buffer);
    } catch (error) {
      console.error("Error generating TTS audio:", error);
      return res.status(500).send("Internal error generating TTS audio");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
