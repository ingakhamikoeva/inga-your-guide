import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { saveFoodLog, saveChatEvent } from '@/lib/db';
import { detectStage } from '@/lib/soft-swap';
import { withName, hasName } from '@/lib/user-name';
import { askInga, classifyRoute } from '@/lib/ai-provider';
import { VoiceInput } from './VoiceInput';

type Msg = { role: 'user' | 'assistant'; content: string };

interface PendingMeal {
  msgIndex: number;
  description: string;
  saved: boolean;
  dismissed: boolean;
}

// Lightweight food/symptom detection used to offer meal-save and to flag safety chat events.
const FOOD_HINT = /(съел|съела|поел|поела|завтрак|обед|ужин|перекус|выпил|выпила|скушал|скушала)/i;
const ANALYSIS_HINT = /(оцени|оцените|разбери|разберите|проанализируй|проанализируйте|дай оценку)/i;
const QUESTION_HINT = /\?/;
const SAFETY_HINT = /(обморок|предобморок|сильная слабость|головокруж|кружится голова|голова кружится|темнеет в глазах|тошнит|тошнота|боль в груди|рвота|вызвать рвоту|хочу голодать)/i;

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
  const stage = detectStage(profile.weight, profile.goalWeight, profile.currentStage);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: hasName(profile.name)
          ? withName(profile.name, 'я рядом 💛 Расскажите, что сейчас на душе или о чём хочется поговорить — еда, настроение, поддержка.')
          : 'Я рядом 💛 Расскажите, что сейчас на душе или о чём хочется поговорить — еда, настроение, поддержка.',
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

    // Build minimised user context — no email, no auth IDs, no payment info.
    const userContext = {
      name: profile.name,
      gender: profile.gender,
      age: profile.age,
      height: profile.height,
      weight: profile.weight,
      goalWeight: profile.goalWeight,
      stage,
      trackingMethod: profile.trackingMethod,
      triggers: [profile.foodProfile?.trigger, profile.emotionalTrigger].filter(Boolean) as string[],
      pattern: profile.foodProfile?.pattern,
      calorieTarget: calculations?.totalCalories,
    };

    const now = new Date();
    const partOfDay = (h => h < 6 ? 'ночь' : h < 12 ? 'утро' : h < 18 ? 'день' : 'вечер')(now.getHours());
    const dayContext = {
      todayMeals: todayReport?.meals.map(m => m.description) ?? [],
      sleepHours: todayReport?.sleepHours,
      stepsYesterday: todayReport?.stepsYesterday,
      yesterdayConclusion: yesterdayReport?.hardestPart,
      now: `${partOfDay}, ${now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`,
    };

    const route = classifyRoute(trimmed, userContext);
    const assistantIndex = nextMessages.length;
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const { answer } = await askInga({
        message: trimmed,
        routeType: route,
        userContext,
        dayContext,
      });

      const display = stripMarkers(answer);
      setMessages(prev => prev.map((m, i) => i === assistantIndex ? { ...m, content: display } : m));

      // Offer to save the user's message as a meal if it sounds like a meal description —
      // but not if they're asking for an analysis/review, or just asking a question.
      if (FOOD_HINT.test(trimmed) && !ANALYSIS_HINT.test(trimmed) && !QUESTION_HINT.test(trimmed)) {
        setPending(prev => ({
          ...prev,
          [assistantIndex]: { msgIndex: assistantIndex, description: trimmed, saved: false, dismissed: false },
        }));
      }

      // Log a safety chat event when symptoms are detected.
      if (route === 'safety' || SAFETY_HINT.test(trimmed)) {
        saveChatEvent('safety', trimmed.slice(0, 200)).catch(() => {});
      }

      // Also honour any markers the model may emit (kept for forward-compat).
      const offer = extractOfferMeal(answer);
      const event = extractChatEvent(answer);
      if (offer && !FOOD_HINT.test(trimmed)) {
        setPending(prev => ({
          ...prev,
          [assistantIndex]: { msgIndex: assistantIndex, description: offer, saved: false, dismissed: false },
        }));
      }
      if (event) saveChatEvent(event.type, event.summary).catch(() => {});
    } catch (e) {
      console.error(e);
      setError('Инга сейчас временно не отвечает. Попробуйте ещё раз чуть позже.');
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
    <div className="flex flex-col min-h-dvh max-h-dvh h-dvh bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card shrink-0">
        <div className="mx-auto w-full max-w-[760px] flex items-center justify-between px-4 py-3">
          <button onClick={() => {
              try {
                const today = new Date().toISOString().slice(0, 10);
                localStorage.setItem('dailyActiveTab', 'meals');
                localStorage.setItem('dailyActiveTabDate', today);
              } catch {}
              setStep('daily');
            }} className="text-base text-muted-foreground">← Назад</button>
          <h2 className="font-semibold text-lg">Поговорим?</h2>
          <button onClick={() => setStep('menu')} className="text-base text-muted-foreground">Меню</button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        <div className="mx-auto w-full max-w-[760px] px-4 py-4 space-y-3 pb-6">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-4 py-3 rounded-[18px] whitespace-pre-wrap break-words text-[17px] leading-[1.5] ${
                m.role === 'user'
                  ? 'rounded-br-[4px]'
                  : 'bg-secondary text-secondary-foreground rounded-bl-[4px]'
              }`}
              style={m.role === 'user' ? { backgroundColor: '#FBE0CC', color: '#2C1A0E' } : undefined}>
                {m.content || (loading && i === messages.length - 1 ? '...' : '')}
              </div>
            </div>
          ))}

          {/* Save-meal offer cards */}
          {Object.values(pending).map(p => (
            !p.dismissed && (
              <div key={p.msgIndex} className="inga-card border-primary/40 bg-primary/5 max-w-[85%]">
                <p className="text-base mb-2">Хотите, сохраню это как приём пищи в дневник?</p>
                <p className="text-sm text-muted-foreground italic mb-3">«{p.description}»</p>
                {p.saved ? (
                  <p className="text-base text-primary font-medium">✓ Сохранено в дневник</p>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => handleSaveMeal(p.msgIndex)} className="inga-btn-primary text-base py-2 px-3 flex-1">
                      Да, сохранить
                    </button>
                    <button onClick={() => handleDismissMeal(p.msgIndex)} className="inga-btn-secondary text-base py-2 px-3 flex-1">
                      Нет, обсуждаем
                    </button>
                  </div>
                )}
              </div>
            )
          ))}

          {error && (
            <div className="text-base text-destructive bg-destructive/10 p-3 rounded-xl">{error}</div>
          )}
        </div>
      </div>

      {/* Input — sticky, respects iOS safe-area */}
      <div
        className="border-t border-border bg-card shrink-0"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto w-full max-w-[760px] px-4 py-3">
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
              placeholder="Напишите сообщение..."
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
              className="inga-btn-primary px-4 disabled:opacity-50 shrink-0"
            >
              ↑
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
