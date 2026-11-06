import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { saveChatEvent } from '@/lib/db';
import { detectStage } from '@/lib/soft-swap';
import { withName, hasName } from '@/lib/user-name';
import { askInga, classifyRoute } from '@/lib/ai-provider';
import { VoiceInput } from './VoiceInput';
import { sessionSnapshot, isSessionCurrent, subscribe } from '@/lib/auth-storage';
import { deviceTimezone } from '@/lib/achievement-client';
import { readConversation, saveConversation, conversationHistory, type ChatMessage } from '@/lib/chat-conversation';

type Msg = ChatMessage;

// Symptom detection used to flag safety chat events.
const SAFETY_HINT = /(обморок|предобморок|сильная слабость|головокруж|кружится голова|голова кружится|темнеет в глазах|тошнит|тошнота|боль в груди|рвота|вызвать рвоту|хочу голодать)/i;

function stripMarkers(text: string): string {
  return text
    .replace(/\[OFFER_SAVE_MEAL:[^\]]*\]/g, '')
    .replace(/\[CHAT_EVENT:[^\]]*\]/g, '')
    .trim();
}

function extractChatEvent(text: string): { type: string; summary: string } | null {
  const m = text.match(/\[CHAT_EVENT:\s*([^|\]]+)\|([^\]]+)\]/);
  return m ? { type: m[1].trim(), summary: m[2].trim() } : null;
}

export function ChatScreen() {
  const { setStep, profile, calculations } = useApp();
  const owner = useRef(sessionSnapshot());
  const [messages, setMessages] = useState<Msg[]>(() => readConversation(owner.current));
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const requestVersion = useRef(0);
  const busy = useRef(false);
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
    const unsubscribe = subscribe(() => {
      if (!isSessionCurrent(owner.current)) {
        requestVersion.current++;
        busy.current = false;
        setMessages([]); setInput(''); setError(null); setLoading(false);
      }
    });
    return () => { requestVersion.current++; unsubscribe(); };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy.current || !owner.current.owner || !isSessionCurrent(owner.current)) return;
    busy.current = true;
    const version = ++requestVersion.current;
    const current = () => version === requestVersion.current && isSessionCurrent(owner.current);
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
      // totalCalories — это калорийность УДЕРЖАНИЯ (основной обмен + шаги).
      // Пока человек не достиг цели, ориентир — коридор дефицита, иначе ИИ
      // советует цифру, на которой вес стоит на месте.
      maintenanceCalories: calculations?.totalCalories,
      deficitCorridor:
        stage === 'loss' && calculations?.corridorMin && calculations?.corridorMax
          ? { min: calculations.corridorMin, max: calculations.corridorMax }
          : undefined,
    };

    const route = classifyRoute(trimmed, userContext);
    const assistantIndex = nextMessages.length;
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const { answer, ok } = await askInga({
        message: trimmed,
        routeType: route,
        userContext,
        timezone: deviceTimezone(),
        history: conversationHistory(messages),
      });
      if (!current()) return;

      const display = stripMarkers(answer);
      const completed: Msg[] = [...messages, { ...userMsg, history: ok }, { role: 'assistant' as const, content: display, history: ok }].slice(-40);
      saveConversation(owner.current, completed);
      setMessages(completed);

      // Log a safety chat event when symptoms are detected.
      if (ok && (route === 'safety' || SAFETY_HINT.test(trimmed))) {
        saveChatEvent('safety', trimmed.slice(0, 200)).catch(() => {});
      }

      const event = extractChatEvent(answer);
      if (ok && event) saveChatEvent(event.type, event.summary).catch(() => {});
    } catch (e) {
      if (!current()) return;
      console.error('chat request failed');
      setError('Инга сейчас временно не отвечает. Попробуйте ещё раз чуть позже.');
      setMessages(prev => prev.slice(0, assistantIndex));
    } finally {
      if (current()) {
        busy.current = false;
        setLoading(false);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    }
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
          <p className="mt-2 text-xs text-muted-foreground">Отвечает ИИ-помощник. Он может ошибаться и не заменяет консультацию специалиста.</p>
        </div>
      </div>
    </div>
  );
}
