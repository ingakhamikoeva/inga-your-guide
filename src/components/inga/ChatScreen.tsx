import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { saveFoodLog, saveChatEvent } from '@/lib/db';
import { detectStage } from '@/lib/soft-swap';
import { withName, hasName } from '@/lib/user-name';
import { VoiceInput } from './VoiceInput';

type Msg = { role: 'user' | 'assistant'; content: string };

const QUICK_PROMPTS = [
  'Хочу сладкого',
  'Что съесть?',
  'Мне нужна поддержка',
  'Я переела',
  'Помоги с ужином',
  'Что выбрать в кафе?',
];

interface PendingMeal {
  msgIndex: number;
  description: string;
  saved: boolean;
  dismissed: boolean;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/inga-chat`;

function stripMarkers(text: string): string {
  return text
    .replace(/\[OFFER_SAVE_MEAL:[^\]]*\]/g, '')
    .replace(/\[CHAT_EVENT:[^\]]*\]/g, '')
    .trim();
}

function extractOfferMeal(text: string): string | null {
  const m = text.match(/\[OFFER_SAVE_MEAL:\s*([^\]]+)\]/);
  return m ? m[1].trim() : null;
}

function extractChatEvent(text: string): { type: string; summary: string } | null {
  const m = text.match(/\[CHAT_EVENT:\s*([^|\]]+)\|([^\]]+)\]/);
  return m ? { type: m[1].trim(), summary: m[2].trim() } : null;
}

export function ChatScreen() {
  const { setStep, profile, calculations, dailyReports, weeklyData } = useApp();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<number, PendingMeal>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const today = new Date().toISOString().slice(0, 10);
  const todayReport = dailyReports.find(r => r.date === today);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const yesterdayReport = dailyReports.find(r => r.date === yesterday);
  const stage = detectStage(profile.weight, profile.goalWeight);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: hasName(profile.name)
          ? withName(profile.name, 'я рядом 💛 Расскажи, что сейчас на душе или о чём хочется поговорить — еда, настроение, поддержка.')
          : 'Я рядом 💛 Расскажи, что сейчас на душе или о чём хочется поговорить — еда, настроение, поддержка.',
      }]);
    }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setError(null);

    const userMsg: Msg = { role: 'user', content: trimmed };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    // Keep focus in the input field after sending
    requestAnimationFrame(() => inputRef.current?.focus());

    const userContext = {
      name: profile.name,
      gender: profile.gender,
      stage,
      calorieTarget: calculations?.totalCalories,
      trackingMethod: profile.trackingMethod,
      pattern: profile.foodProfile?.pattern,
      trigger: profile.foodProfile?.trigger ?? profile.emotionalTrigger,
      todayMeals: todayReport?.meals.map(m => m.description) ?? [],
      yesterdayConclusion: yesterdayReport?.hardestPart,
      weight: profile.weight,
      goalWeight: profile.goalWeight,
      sleepHours: todayReport?.sleepHours,
      stepsYesterday: todayReport?.stepsYesterday,
    };

    // Send only role/content to backend
    const apiMessages = nextMessages.map(m => ({ role: m.role, content: m.content }));

    let assistantSoFar = '';
    const assistantIndex = nextMessages.length;
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: apiMessages, userContext }),
      });

      if (!resp.ok || !resp.body) {
        let msg = 'Не получилось получить ответ. Попробуй ещё раз.';
        try { const j = await resp.json(); if (j?.error) msg = j.error; } catch {}
        throw new Error(msg);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let done = false;

      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line || line.startsWith(':')) continue;
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) {
              assistantSoFar += delta;
              const display = stripMarkers(assistantSoFar);
              setMessages(prev => prev.map((m, i) => i === assistantIndex ? { ...m, content: display } : m));
            }
          } catch {
            buf = line + '\n' + buf;
            break;
          }
        }
      }

      // After stream complete: process markers
      const offer = extractOfferMeal(assistantSoFar);
      const event = extractChatEvent(assistantSoFar);
      if (offer) {
        setPending(prev => ({ ...prev, [assistantIndex]: { msgIndex: assistantIndex, description: offer, saved: false, dismissed: false } }));
      }
      if (event) {
        saveChatEvent(event.type, event.summary).catch(() => {});
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка соединения';
      setError(msg);
      setMessages(prev => prev.slice(0, assistantIndex));
    } finally {
      setLoading(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const handleSaveMeal = async (idx: number) => {
    const p = pending[idx];
    if (!p) return;
    await saveFoodLog(p.description, 'unknown');
    setPending(prev => ({ ...prev, [idx]: { ...p, saved: true } }));
  };

  const handleDismissMeal = (idx: number) => {
    setPending(prev => ({ ...prev, [idx]: { ...prev[idx], dismissed: true } }));
  };

  return (
    <div className="flex flex-col h-screen max-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <button onClick={() => setStep('daily')} className="text-sm text-muted-foreground">← Назад</button>
        <h2 className="font-semibold">💬 Чат с Ингой</h2>
        <button onClick={() => setStep('menu')} className="text-sm text-muted-foreground">Меню</button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl whitespace-pre-wrap text-sm ${
              m.role === 'user'
                ? 'bg-primary text-primary-foreground rounded-br-sm'
                : 'bg-secondary text-secondary-foreground rounded-bl-sm'
            }`}>
              {m.content || (loading && i === messages.length - 1 ? '...' : '')}
            </div>
          </div>
        ))}

        {/* Save-meal offer cards */}
        {Object.values(pending).map(p => (
          !p.dismissed && (
            <div key={p.msgIndex} className="inga-card border-primary/40 bg-primary/5 ml-2 max-w-[85%]">
              <p className="text-sm mb-2">Хочешь, сохраню это как приём пищи в дневник?</p>
              <p className="text-xs text-muted-foreground italic mb-3">«{p.description}»</p>
              {p.saved ? (
                <p className="text-sm text-primary font-medium">✓ Сохранено в дневник</p>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => handleSaveMeal(p.msgIndex)} className="inga-btn-primary text-sm py-1.5 px-3 flex-1">
                    Да, сохранить
                  </button>
                  <button onClick={() => handleDismissMeal(p.msgIndex)} className="inga-btn-secondary text-sm py-1.5 px-3 flex-1">
                    Нет, обсуждаем
                  </button>
                </div>
              )}
            </div>
          )
        ))}

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-xl">{error}</div>
        )}
      </div>

      {/* Quick prompts */}
      <div className="px-4 pb-2 pt-2 border-t border-border bg-card">
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          {QUICK_PROMPTS.map(q => (
            <button
              key={q}
              onClick={() => send(q)}
              disabled={loading}
              className="shrink-0 text-xs px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input */}
        <form
          onSubmit={e => { e.preventDefault(); send(input); }}
          className="flex gap-2 items-end"
        >
          <textarea
            ref={inputRef}
            autoFocus
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Напиши сообщение..."
            rows={1}
            className="inga-input flex-1 resize-none max-h-32"
            disabled={loading}
          />
          <VoiceInput
            onConfirm={(text) => send(text)}
            onEdit={(text) => setInput(text)}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inga-btn-primary px-4 py-2 disabled:opacity-50"
          >
            ↑
          </button>
        </form>
      </div>
    </div>
  );
}
