import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const { authenticator } = require("otplib");

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Database setup
  const db = await open({
    filename: "./database.sqlite",
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      recovery_phrase TEXT,
      two_fa_secret TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS passwords (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      site_name TEXT,
      username_key TEXT,
      encrypted_password TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS authenticators (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      public_key BLOB,
      counter INTEGER,
      device_type TEXT,
      backed_up BOOLEAN,
      transports TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  app.use(express.json());

  // --- API Routes ---

  // Anonymous Registration
  app.post("/api/register", async (req, res) => {
    const { username, recoveryPhrase } = req.body;
    const id = crypto.randomUUID();
    try {
      await db.run(
        "INSERT INTO users (id, username, recovery_phrase) VALUES (?, ?, ?)",
        [id, username, recoveryPhrase]
      );
      res.json({ success: true, userId: id });
    } catch (err) {
      res.status(400).json({ error: "Username already exists or invalid data" });
    }
  });

  // Login (Self-contained for this demo, usually would use JWT)
  app.post("/api/login", async (req, res) => {
    const { username, recoveryPhrase } = req.body;
    const user = await db.get(
      "SELECT id FROM users WHERE username = ? AND recovery_phrase = ?",
      [username, recoveryPhrase]
    );
    if (user) {
      res.json({ success: true, userId: user.id });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  // OTP Management
  app.get("/api/2fa/setup/:userId", async (req, res) => {
    const secret = authenticator.generateSecret();
    const user = await db.get("SELECT username FROM users WHERE id = ?", [req.params.userId]);
    if (!user) return res.status(404).send("User not found");
    
    const otpauth = authenticator.keyuri(user.username, "PhantomGuard", secret);
    await db.run("UPDATE users SET two_fa_secret = ? WHERE id = ?", [secret, req.params.userId]);
    res.json({ secret, otpauth });
  });

  app.post("/api/2fa/verify", async (req, res) => {
    const { userId, token } = req.body;
    const user = await db.get("SELECT two_fa_secret FROM users WHERE id = ?", [userId]);
    if (!user || !user.two_fa_secret) return res.status(400).json({ error: "2FA not setup" });
    
    const isValid = authenticator.check(token, user.two_fa_secret);
    res.json({ isValid });
  });

  // Password Vault
  app.get("/api/passwords/:userId", async (req, res) => {
    const items = await db.all("SELECT * FROM passwords WHERE user_id = ?", [req.params.userId]);
    res.json(items);
  });

  app.post("/api/passwords", async (req, res) => {
    const { userId, siteName, usernameKey, encryptedPassword } = req.body;
    const id = crypto.randomUUID();
    await db.run(
      "INSERT INTO passwords (id, user_id, site_name, username_key, encrypted_password) VALUES (?, ?, ?, ?, ?)",
      [id, userId, siteName, usernameKey, encryptedPassword]
    );
    res.json({ success: true, id });
  });

  app.delete("/api/passwords/:id", async (req, res) => {
    await db.run("DELETE FROM passwords WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
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
