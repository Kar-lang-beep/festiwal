import express from "express";
import dotenv from "dotenv";
import path from "path";
import fetch from "node-fetch";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

// Kolejność prób: najpierw Gemini (free), potem Mistral (free)
const MODELS = [
  "google/gemini-2.0-flash-exp:free",
  "mistralai/mistral-7b-instruct:free",
];

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// ————————————————————————————
// BEZPIECZEŃSTWO (PL, rozbudowane)
// ————————————————————————————
const crisisPatterns = [
  /samobój/i, /samoboj/i,
  /nie\s*ch[ce]?\s*e?\s*ży[ćc]/i, /nie\s*ch[ce]?\s*e?\s*zyc/i,
  /zabi[ćc]\s*si[ęe]/i, /zabic\s*sie/i, /chc[ęe]\s*si[ęe]\s*zabi[ćc]/i,
  /pope[łl]ni[ćc]\s*samobój/i, /popelnic\s*samoboj/i,
  /zrobi[ćc]\s*sobie\s*krzywd[ęe]/i, /zrobic\s*sobie\s*krzywde/i,
  /okaleczy[ćc]/i, /autoagresj/i,
  /mam\s*do[śs]ć\s*życia/i, /mam\s*dosc\s*zycia/i
];

const SAFETY_RESPONSE = [
  "Widzę, że możesz przeżywać coś bardzo trudnego. Nie jesteś w tym sam/a.",
  "• W nagłym zagrożeniu zadzwoń na **112**.",
  "• Dla dzieci i młodzieży: **116 111** (Telefon Zaufania – 24/7, bezpłatny).",
  "• Dla dorosłych w kryzysie: **800 70 222** (Centrum Wsparcia), **116 123** (wsparcie emocjonalne).",
  "• Jeśli jesteś na Youth Point, podejdź do punktu informacji – pomożemy znaleźć wsparcie.",
  "Pamiętaj: jestem narzędziem psychoedukacyjnym i nie zastępuję specjalisty."
].join("\n");

function isCrisis(text) {
  const t = String(text || "");
  return crisisPatterns.some((re) => re.test(t));
}

// Czy odpowiedź modelu wygląda ryzykownie?
function looksUnsafe(answer) {
  if (!answer) return false;
  const s = answer.toLowerCase();
  // jeżeli pojawiają się instrukcje samozagrożenia / zachęty – od razu nadpisujemy
  return /jak\s+si[ęe]\s*zabi[ćc]|zabij\s*si[ęe]|zr[óo]b\s*sobie\s*krzywd[ęe]/i.test(s);
}

// ————————————————————————————

app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));

app.get("/health", (_, res) => res.json({ ok: true, port: PORT }));

app.post("/chat", async (req, res) => {
  try {
    const { message, history } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ reply: "Brak wiadomości do przetworzenia." });
    }

    // 1) Twarde zatrzymanie dla treści kryzysowych (bez pytania modelu)
    if (isCrisis(message)) {
      return res.json({ reply: SAFETY_RESPONSE, crisis: true });
    }

    // 2) Tryb demo – brak klucza
    if (!OPENROUTER_API_KEY) {
      return res.json({
        reply: `Tryb demo: napisałeś/aś „${message}”. (Dodaj OPENROUTER_API_KEY w Render → Environment, aby włączyć AI)`
      });
    }

    // 3) Budujemy rozmowę i wymuszamy PL
    const systemPrompt = [
      "Jesteś Youth Point Assistant – wspierający, zwięzły, po polsku.",
      "Nie diagnozujesz; unikasz kontrowersji i ryzykownych porad.",
      "W razie treści kryzysowych przekieruj do numerów pomocy w Polsce.",
      "Zawsze odpowiadaj **po polsku**.",
    ].join(" ");

    const messages = [{ role: "system", content: systemPrompt }];

    if (Array.isArray(history)) {
      for (const m of history) {
        if (m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant")) {
          messages.push({ role: m.role, content: m.content });
        }
      }
    }
    messages.push({ role: "user", content: message });

    // 4) Timeout (20s)
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 20_000);

    // 5) Próby po kolei
    let lastErr = "";
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
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.5,
            max_tokens: 500
          }),
          signal: controller.signal
        });

        if (!r.ok) {
          const txt = await r.text();
          lastErr = `model=${model} status=${r.status} body=${txt}`;
          console.error("OpenRouter error:", lastErr);
          continue; // następny model
        }

        const data = await r.json();
        let reply = data?.choices?.[0]?.message?.content?.trim();

        // 6) Soft-guard: jeśli model odda coś ryzykownego, nadpisz bezpieczną odpowiedzią PL
        if (looksUnsafe(reply)) reply = SAFETY_RESPONSE;

        if (reply) {
          clearTimeout(to);
          return res.json({ reply });
        }
      } catch (e) {
        lastErr = `model=${model} exception=${String(e)}`;
        console.error("OpenRouter exception:", lastErr);
        // spróbuj następnego modelu
      }
    }

    clearTimeout(to);
    return res.status(502).json({
      reply: "Chwilowy problem z modelem AI (limit lub przeciążenie). Spróbuj ponownie za chwilę."
    });
  } catch (e) {
    console.error("Server error:", e);
    return res.status(500).json({ reply: "Błąd serwera. Spróbuj ponownie." });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Youth Point Assistant nasłuchuje na PORT=${PORT}`);
});

