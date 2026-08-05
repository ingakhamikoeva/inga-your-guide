// Thin DeepSeek client. Reads keys from .env.
const {
  DEEPSEEK_API_KEY,
  DEEPSEEK_BASE_URL = "https://api.deepseek.com",
  DEEPSEEK_MODEL = "deepseek-v4-flash",
} = process.env;

export async function deepseekChat(messages, opts = {}) {
  if (!DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY is not configured");
  const url = `${DEEPSEEK_BASE_URL.replace(/\/+$/, "")}/chat/completions`;
  const model = opts.model || DEEPSEEK_MODEL;

  const body = {
    model,
    messages,
    temperature: opts.temperature ?? 0.4,
    max_tokens: opts.maxTokens ?? 700,
    stream: false,
    // deepseek-v4-flash/pro думают перед ответом по умолчанию. Для короткого
    // чат-ответа по готовым правилам это не нужно и опасно: на сложных
    // запросах (разбор целого дня питания) модель может потратить весь
    // max_tokens на размышления и вернуть пустой content. Отключаем явно.
    thinking: { type: "disabled" },
  };
  if (opts.jsonMode) body.response_format = { type: "json_object" };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    console.error("deepseek error", resp.status, text);
    throw new Error("provider_error");
  }
  const j = await resp.json();
  const content = j?.choices?.[0]?.message?.content ?? "";
  if (!content) {
    console.error("deepseek returned empty content, finish_reason:", j?.choices?.[0]?.finish_reason);
  }
  return content;
}
