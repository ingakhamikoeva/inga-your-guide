import { useEffect, useRef, useState } from 'react';

interface VoiceInputProps {
  onConfirm: (text: string) => void;
  /** Called when user picks "Изменить" — text goes back into main input */
  onEdit?: (text: string) => void;
  /** ru-RU by default */
  lang?: string;
  /** Disable button (e.g. during loading) */
  disabled?: boolean;
}

type SR = any;

function getSpeechRecognition(): SR | null {
  if (typeof window === 'undefined') return null;
  // @ts-ignore — non-standard
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function VoiceInput({ onConfirm, onEdit, lang = 'ru-RU', disabled }: VoiceInputProps) {
  const [supported, setSupported] = useState(true);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const recRef = useRef<any>(null);

  useEffect(() => {
    const SR = getSpeechRecognition();
    setSupported(!!SR);
  }, []);

  const start = async () => {
    setError(null);
    setTranscript('');
    const SR = getSpeechRecognition();
    if (!SR) {
      setError('Голосовой ввод не поддерживается этим браузером. Используй текст 💛');
      setShowDialog(true);
      return;
    }
    try {
      // Trigger mic permission prompt explicitly
      await navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        // Stop tracks immediately — SpeechRecognition manages its own stream
        stream.getTracks().forEach(t => t.stop());
      });
    } catch {
      setError('Нужно разрешение на микрофон. Проверь настройки браузера 💛');
      setShowDialog(true);
      return;
    }

    const rec = new SR();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    let finalText = '';
    rec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      setTranscript((finalText + interim).trim());
    };
    rec.onerror = (e: any) => {
      const code = e?.error;
      let msg = 'Не получилось распознать голос. Можешь попробовать ещё раз или написать текстом.';
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        msg = 'Нужно разрешение на микрофон. Проверь настройки браузера 💛';
      } else if (code === 'no-speech') {
        msg = 'Я ничего не услышала. Попробуй ещё раз или напиши текстом.';
      }
      setError(msg);
      setRecording(false);
      setShowDialog(true);
    };
    rec.onend = () => {
      setRecording(false);
      setShowDialog(true);
    };

    try {
      rec.start();
      recRef.current = rec;
      setRecording(true);
      setShowDialog(false);
    } catch {
      setError('Не получилось запустить запись. Попробуй ещё раз.');
      setShowDialog(true);
    }
  };

  const stop = () => {
    try { recRef.current?.stop(); } catch {}
    setRecording(false);
  };

  const reset = () => {
    setTranscript('');
    setError(null);
    setEditing(false);
    setShowDialog(false);
  };

  const confirm = () => {
    const t = transcript.trim();
    if (!t) return;
    onConfirm(t);
    reset();
  };

  if (!supported) {
    // Hide entirely — text input remains available
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={recording ? stop : start}
        disabled={disabled}
        title={recording ? 'Остановить запись' : 'Голосовой ввод'}
        className={`px-3 py-2 rounded-xl transition-all ${
          recording
            ? 'bg-destructive text-destructive-foreground animate-pulse'
            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
        } disabled:opacity-50`}
      >
        {recording ? '⏺' : '🎤'}
      </button>

      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={reset}>
          <div className="bg-card rounded-2xl p-5 w-full max-w-md shadow-xl animate-fade-in-up" onClick={e => e.stopPropagation()}>
            {error ? (
              <>
                <p className="text-sm mb-4">{error}</p>
                <div className="flex gap-2">
                  <button onClick={start} className="inga-btn-primary flex-1 text-sm py-2">
                    Попробовать снова
                  </button>
                  <button onClick={reset} className="inga-btn-secondary flex-1 text-sm py-2">
                    Закрыть
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-medium mb-2">Я распознала так:</p>
                {editing ? (
                  <textarea
                    value={transcript}
                    onChange={e => setTranscript(e.target.value)}
                    rows={3}
                    autoFocus
                    className="inga-input w-full mb-3 resize-none"
                  />
                ) : (
                  <p className="text-sm bg-muted/50 rounded-xl p-3 mb-3 italic min-h-[3rem]">
                    {transcript || '(пусто)'}
                  </p>
                )}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={confirm}
                    disabled={!transcript.trim()}
                    className="inga-btn-primary text-sm py-2 disabled:opacity-50"
                  >
                    Да, сохранить
                  </button>
                  <button
                    onClick={() => setEditing(v => !v)}
                    className="inga-btn-secondary text-sm py-2"
                  >
                    {editing ? 'Готово' : 'Изменить текст'}
                  </button>
                  <button
                    onClick={reset}
                    className="text-sm py-2 text-muted-foreground hover:text-foreground"
                  >
                    Отменить
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
