import express from "express";
import dotenv from "dotenv";
import path from "path";
import fetch from "node-fetch";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

// MODELE – kolejność prób (najpierw Gemini, potem Mistral – oba free)
const MODELS = [
  "google/gemini-2.0-flash-exp:free",
  "mistralai/mistral-7b-instruct:free",
];

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// ——— Prosty filtr bezpieczeństwa ———
const CRISIS_TRIGGERS = [
  "samobój", "nie chcę żyć", "nie chce żyć", "zabiję się", "zabije sie",
  "zrobić sobie krzywd", "zrobic sobie krzywd", "autoagresja", "okaleczyć", "okaleczyc",
  "mam dość życia", "mam dosc zycia"
];

const SAFETY_RESPONSE = `Widzę, że możesz przeżywać coś bardzo trudnego. Nie jesteś w tym sam/a.
• Zadzwoń: 116 111 (Telefon Zaufania dla Dzieci i Młodzieży), w nagłym zagrożeniu 112.
• Skontaktuj się z zaufaną osobą dorosłą lub psychologiem.
• Jeśli jesteś na Youth Point: podejdź do punktu informacji – pomożemy znaleźć wsparcie.
(Pamiętaj: jestem narzędziem psychoedukacyjnym, nie zastępuję specjalisty.)`;

function isCrisis(t) {
  const s = String(t || "").toLowerCase();
  return CRISIS_TRIGGERS.some(k => s.includes(k));
}

app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));

app.get("/health", (_, res) => res.json({ ok: true, port: PORT }));

// ——— Główny endpoint czatu ———
app.post("/chat", async (req, res) => {
  try {
    const { message, history } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ reply: "Brak wiadomości do przetworzenia." });
    }

    // Bezpieczeństwo
    if (isCrisis(message)) {
      return res.json({ reply: SAFETY_RESPONSE, crisis: true });
    }

    // Tryb demo – brak klucza
    if (!OPENROUTER_API_KEY) {
      return res.json({ reply: `Tryb demo: napisałeś/aś „${message}”. (Dodaj OPENROUTER_API_KEY w Render → Environment, aby włączyć AI)` });
    }

    // Zbuduj historię wiadomości (opcjonalnie z frontu)
    const messages = [
      { role: "system", content: "Jesteś życzliwym, zwięzłym Youth Point Assistant. Odpowiadaj prosto i empatycznie. Nie diagnozuj. W razie kryzysu kieruj do pomocy." }
    ];

    if (Array.isArray(history)) {
      for (const m of history) {
        if (m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant")) {
          messages.push({ role: m.role, content: m.content });
        }
      }
    }
    messages.push({ role: "user", content: message });

    // Spróbuj po kolei modeli
    let lastErrorText = "";
    for (const model of MODELS) {
      try {
        const r = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://festiwal.onrender.com",
            "X-Title": "Youth Point Assistant"
          },
          body: JSON.stringify({ model, messages, temperature: 0.5, max_tokens: 500 })
        });

        if (!r.ok) {
          const txt = await r.text();
          lastErrorText = `Model=${model} status=${r.status} body=${txt}`;
          console.error("OpenRouter error:", lastErrorText);
          continue; // spróbuj następnego modelu
        }

        const data = await r.json();
        const reply = data?.choices?.[0]?.message?.content?.trim();
        if (reply) return res.json({ reply });
      } catch (e) {
        lastErrorText = `Model=${model} exception=${String(e)}`;
        console.error("OpenRouter exception:", lastErrorText);
        // spróbuj następnego modelu
      }
    }

    // Jeśli żaden model nie zadziałał:
    return res.status(502).json({
      reply: "Chwilowy problem z modelem AI (limit lub przeciążenie). Spróbuj ponownie za chwilę.",
      hint: "Jeśli problem się powtarza, zmień model na inny free lub sprawdź klucz w Environment.",
    });
  } catch (err) {
    console.error("Server fatal error:", err);
    return res.status(500).json({ reply: "Błąd serwera. Spróbuj ponownie." });
  }
});

// Start
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Youth Point Assistant nasłuchuje na PORT=${PORT}`);
});

});
