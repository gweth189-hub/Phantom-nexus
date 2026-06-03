import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";

// Initialize Gemini SDK with server-side environment api key and metadata headers
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes (Reserved for future server-side logic like Biometrics/WebAuthn verification)
  app.get("/api/health", (req, res) => {
    res.json({ status: "online", node: "phantom-core-v1" });
  });

  // Client Chat Integration Endpoint
  app.post("/api/gemini/chat", async (req, res) => {
    try {
      const { messages, userText, uid, username, supportEmail, instagramHandle } = req.body;

      const systemInstruction = `You are Nyte Lite, the high-performance security core for ZENITH / GUARD. 
Your mission is to guide users through their secure digital vault, explain security protocols, and provide technical support.
Be professional, elite, and security-focused. 
User ID: ${uid || 'unknown'}. Username: ${username || 'anonymous'}.
Support Email: ${supportEmail || 'gweth189@gmail.com'}. Instagram Handle: @${instagramHandle || 'zerophantomcode'}.
Safety: Never reveal internal encryption logic unless verified. If they ask for help, explain how to use the 'Audit' and 'Vault' features.`;

      const chatHistory = (messages || []).map((m: any) => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.text }]
      }));

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          ...chatHistory,
          { role: 'user', parts: [{ text: userText }] }
        ],
        config: {
          systemInstruction,
        }
      });

      const replyText = response.text || "Signal interrupted. Please retry.";
      res.json({ text: replyText });
    } catch (error) {
      console.error("Gemini API server-side error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Internal Server Error",
        text: "Direct link to Nyte Lite Core established, but response stream failed. Ensure your ZENITH license is active."
      });
    }
  });

  // Vite configuration handled dynamically
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PhantomGuard running at http://localhost:${PORT}`);
  });
}

startServer();
