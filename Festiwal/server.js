console.log('Youth Point Assistant backend działa');
import express from "express";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import fetch from "node-fetch";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));

// Healthcheck
app.get("/health", (_, res) => res.json({ ok: true, port: PORT }));

// Prosty endpoint testowy
app.post("/chat", async (req, res) => {
  const { message } = req.body || {};
  if (!message) return res.json({ answer: "Brak wiadomości." });

  res.json({ answer: "Odpowiedź demo: " + message });
});

// Nasłuchiwanie
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Youth Point Assistant działa na porcie ${PORT}`);
});
