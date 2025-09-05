const chat = document.getElementById("chat");
const form = document.getElementById("form");
const input = document.getElementById("input");

function addMessage(text, who="user") {
  const div = document.createElement("div");
  div.className = `msg ${who}`;
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function addThinking() {
  const div = document.createElement("div");
  div.className = "msg bot";
  div.dataset.thinking = "1";
  div.textContent = "Asystent myśli…";
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function replaceThinking(text) {
  const last = Array.from(document.querySelectorAll(".msg.bot")).reverse()
    .find(el => el.dataset.thinking === "1");
  if (last) {
    last.textContent = text;
    delete last.dataset.thinking;
  } else {
    addMessage(text, "bot");
  }
}

addMessage("Cześć! Jestem asystentem Youth Point. Jak mogę pomóc?", "bot");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  addMessage(text, "user");
  input.value = "";
  addThinking();

  try {
    const resp = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });
    const data = await resp.json();
    replaceThinking(data.answer || "Przepraszam, spróbuj ponownie.");
  } catch (e) {
    replaceThinking("Ups, wygląda na problem z serwerem. Spróbuj ponownie.");
  }
});
