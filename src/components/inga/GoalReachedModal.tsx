import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { UserSex } from '@/lib/gender-text';
interface Props { sex: UserSex; onContinue: () => void; busy?: boolean }
const SOUND_KEY = 'legche-celebration-sound';

export function GoalReachedModal({ sex, onContinue, busy = false }: Props) {
  const [show, setShow] = useState(true);
  const [sound, setSound] = useState(() => {
    try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; }
  });
  const audio = useRef<AudioContext | null>(null);
  const stop = () => {
    const context = audio.current;
    audio.current = null;
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  };
  const play = async () => {
    stop();
    if (typeof AudioContext === 'undefined') return;
    try {
      const context = new AudioContext();
      audio.current = context;
      await context.resume(); // Browsers may require the explicit sound button.
      if (audio.current !== context || context.state !== 'running') return;
      const notes = [[523.25, 0, .16], [659.25, .18, .16], [783.99, .36, .22],
        [1046.5, .62, .75], [783.99, .62, .75], [659.25, .62, .75]];
      for (const [frequency, delay, duration] of notes) {
        const oscillator = context.createOscillator(), gain = context.createGain();
        const at = context.currentTime + delay;
        oscillator.type = 'triangle';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(.07, at + .025);
        gain.gain.exponentialRampToValueAtTime(.001, at + duration);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.start(at); oscillator.stop(at + duration + .02);
      }
    } catch { stop(); }
  };
  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) setShow(false);
    if (sound) void play();
    const timer = setTimeout(() => { setShow(false); stop(); }, 5000);
    return () => { clearTimeout(timer); stop(); };
  }, []);
  const toggleSound = () => {
    // If autoplay was blocked, first tap explicitly starts the fanfare.
    const blocked = audio.current?.state === 'suspended';
    const next = blocked || !sound;
    setSound(next);
    try { localStorage.setItem(SOUND_KEY, next ? 'on' : 'off'); } catch {}
    if (next) void play(); else stop();
  };
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="goal-celebration-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-sm px-6 animate-fade-in">
      {show && <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden z-50">
        {Array.from({ length: 64 }, (_, i) => <span key={i} style={{
          position: 'absolute', left: `${(i * 37) % 100}%`, top: '-12px',
          width: 7 + i % 5, height: 5 + i % 3, borderRadius: 2,
          background: ['#FF6200', '#FFD166', '#06D6A0', '#EF476F', '#B58AE8'][i % 5],
          animation: `goal-confetti ${2.5 + i % 3 * .4}s ${i % 7 * .1}s linear both`,
        }} />)}
        {[20, 50, 80].map((x, k) => <div key={x} style={{ position: 'absolute', left: `${x}%`, top: `${20 + k % 2 * 25}%` }}>
          {Array.from({ length: 12 }, (_, i) => <span key={i} style={{
            position: 'absolute', width: 5, height: 5, borderRadius: '50%', background: '#FFB800',
            '--dx': `${Math.cos(i * Math.PI / 6) * 110}px`, '--dy': `${Math.sin(i * Math.PI / 6) * 110}px`,
            animation: `goal-spark 1.5s ${k * .5}s ease-out 2 both`,
          } as React.CSSProperties} />)}
        </div>)}
      </div>}
      <style>{`
        @keyframes goal-confetti { from { transform: translateY(0) rotate(0); opacity: 1; } to { transform: translateY(110vh) rotate(720deg); opacity: 0; } }
        @keyframes goal-spark { from { transform: translate(0,0) scale(.2); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(0); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { [style*="goal-confetti"], [style*="goal-spark"] { display: none; } }
      `}</style>
      <div className="inga-card w-full max-w-sm space-y-4 text-center relative z-50 animate-fade-in-up">
        <div className="text-6xl" aria-hidden="true">{sex === 'male' ? '🏆' : '👑'}</div>
        <h2 id="goal-celebration-title" className="text-2xl font-bold">
          {sex === 'male' ? 'Цель достигнута. Вы — мой герой!' : 'Цель достигнута. Вы — королева!'}
        </h2>
        <p className="text-sm text-muted-foreground">
          Вы достигли своей цели. Это большой результат. Теперь важно не просто похудеть, а закрепить результат.
        </p>
        <button type="button" onClick={toggleSound} aria-label={sound ? 'Выключить звук' : 'Включить звук'}
          className="inline-flex items-center justify-center rounded-full p-3 border border-border">
          {sound ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
        <button onClick={onContinue} disabled={busy} aria-busy={busy} className="inga-btn-primary w-full disabled:opacity-60">Перейти к фиксации веса →</button>
      </div>
    </div>
  );
}
