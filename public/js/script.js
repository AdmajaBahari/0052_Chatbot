const chat = document.getElementById("chat");
const form = document.getElementById("form");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");
const chips = document.getElementById("chips");
const clearBtn = document.getElementById("clear");

const GREETING = "Halo! Ada yang bisa saya bantu?";
let history = [];
let busy = false;

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Markdown sederhana: blok kode, kode inline, tebal, baris baru
function render(text) {
  return escapeHtml(text)
    .replace(/```(?:\w+)?\n?([\s\S]*?)(```|$)/g, "<pre><code>$1</code></pre>")
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");
}

function addMessage(role, text = "") {
  const el = document.createElement("div");
  el.className = "msg " + role;
  if (role === "user") el.textContent = text;
  else el.innerHTML = render(text);
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
  return el;
}

function setBusy(state) {
  busy = state;
  sendBtn.disabled = state;
  sendBtn.textContent = state ? "Menunggu..." : "Kirim";
}

function errorText(raw) {
  try {
    const parsed = JSON.parse(raw);
    return parsed.error?.message || parsed.error || raw;
  } catch {
    return raw;
  }
}

async function send(text) {
  if (busy || !text.trim()) return;
  chips.classList.add("hidden");
  addMessage("user", text);
  history.push({ role: "user", content: text });
  input.value = "";
  input.style.height = "auto";
  setBusy(true);

  const botEl = addMessage("bot");
  botEl.innerHTML = '<span class="dots"><span></span><span></span><span></span></span>';
  let reply = "";

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(errorText(data.error || "Server tidak merespons (" + res.status + ")"));
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const data = t.slice(5).trim();
        if (data === "[DONE]") continue;

        const json = JSON.parse(data);
        if (typeof json === "string") throw new Error(json);
        if (json.content) {
          reply += json.content;
          botEl.innerHTML = render(reply);
          chat.scrollTop = chat.scrollHeight;
        }
      }
    }

    if (!reply) throw new Error("Model tidak mengirim jawaban. Coba kirim ulang pesanmu.");
    history.push({ role: "assistant", content: reply });
  } catch (err) {
    history.pop(); // pesan gagal tidak ikut dikirim lagi
    botEl.classList.add("error");
    botEl.textContent = "Gagal: " + err.message;
  } finally {
    setBusy(false);
    input.focus();
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  send(input.value);
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 120) + "px";
});

chips.addEventListener("click", (e) => {
  if (e.target.classList.contains("chip")) send(e.target.textContent);
});

clearBtn.addEventListener("click", () => {
  history = [];
  chat.innerHTML = "";
  addMessage("bot", GREETING);
  chips.classList.remove("hidden");
});

addMessage("bot", GREETING);