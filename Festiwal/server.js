import express from "express";
import dotenv from "dotenv";
import path from "path";
import fetch from "node-fetch";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const MODEL_ID = "google/gemini-2.0-flash-exp:free";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));

// Healthcheck
app.get("/health", (_, res) => res.json({ ok: true, port: PORT }));

// Chat endpoint
app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ reply: "Brak wiadomości do przetworzenia." });
    }

    // Fallback demo mode (jeśli nie ustawiono klucza)
    if (!OPENROUTER_API_KEY) {
      return res.json({ reply: `Tryb demo: napisałeś "${message}"` });
    }

    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://festiwal.onrender.com",
        "X-Title": "Youth Point Assistant"
      },
      body: JSON.stringify({
        model: MODEL_ID,
        messages: [
          { role: "system", content: "Jesteś wspierającym asystentem Youth Point. Odpowiadaj życzliwie i zwięźle." },
          { role: "user", content: message }
        ]
      })
    });

    if (!response.ok) {
      const txt = await response.text();
      console.error("OpenRouter API error:", txt);
      return res.status(500).json({ reply: "Błąd podczas komunikacji z modelem AI." });
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content?.trim() || "Przepraszam, nie mam teraz odpowiedzi.";
    res.json({ reply });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ reply: "Błąd serwera. Spróbuj ponownie." });
  }
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Youth Point Assistant działa na porcie ${PORT}`);
});
