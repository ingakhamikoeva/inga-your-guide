import { useEffect, useState } from 'react';
import { getText, UserSex } from '@/lib/gender-text';

interface Props {
  sex: UserSex;
  onContinue: () => void;
}

// Lightweight CSS confetti — no extra dependencies.
function ConfettiBurst() {
  const pieces = Array.from({ length: 60 });
  const colors = [
    'hsl(var(--primary))',
    'hsl(var(--accent))',
    '#FFD166',
    '#06D6A0',
    '#EF476F',
    '#FF8FAB',
  ];
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-50">
      {pieces.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.6;
        const dur = 2.4 + Math.random() * 1.6;
        const size = 6 + Math.random() * 8;
        const color = colors[i % colors.length];
        const rotate = Math.random() * 360;
        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              top: '-10px',
              left: `${left}%`,
              width: size,
              height: size * 0.4,
              background: color,
              transform: `rotate(${rotate}deg)`,
              animation: `confetti-fall ${dur}s ${delay}s linear forwards`,
              borderRadius: 2,
            }}
          />
        );
      })}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.9; }
        }
      `}</style>
    </div>
  );
}

export function GoalReachedModal({ sex, onContinue }: Props) {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 4500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-sm px-6 animate-fade-in">
      {show && <ConfettiBurst />}
      <div className="inga-card w-full max-w-sm space-y-4 text-center relative z-50 animate-fade-in-up">
        <div className="text-5xl">🎉</div>
        <h2 className="text-2xl font-bold">
          {getText('Ты это сделала 💛', 'Ты это сделал 💛', sex)}
        </h2>
        <p className="text-sm text-muted-foreground">
          {getText(
            'Ты достигла своей цели. Это большой результат. Теперь важно не просто похудеть, а закрепить результат.',
            'Ты достиг своей цели. Это большой результат. Теперь важно не просто похудеть, а закрепить результат.',
            sex,
          )}
        </p>
        <button onClick={onContinue} className="inga-btn-primary w-full">
          Перейти к фиксации →
        </button>
      </div>
    </div>
  );
}
