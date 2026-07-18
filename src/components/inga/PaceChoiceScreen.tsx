import { useApp } from '@/context/AppContext';

export function PaceChoiceScreen() {
  const { updateProfile, setStep, profile, runCalculations } = useApp();

  const handleChoice = (pace: 'fast' | 'slow') => {
    updateProfile({ paceChoice: pace });
    const calc = runCalculations();
    setStep('tracking-method');
  };

  return (
    <div className="flex flex-col items-center min-h-screen px-6 py-10 animate-fade-in-up">
      <h2 className="text-2xl font-bold mb-2">Выберите темп</h2>
      <div className="inga-bubble mb-6 text-center">
        <p>Безопасный темп снижения веса — до 6 кг в месяц.</p>
        <p className="text-muted-foreground mt-2">Мы ни в коем случае не будем голодать.</p>
        <p className="text-muted-foreground">И вы в любой момент сможете изменить свой выбор.</p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        <button onClick={() => handleChoice('fast')} className="inga-card w-full text-left hover:border-primary transition-colors cursor-pointer">
          <div className="font-bold text-lg">🚀 Быстро</div>
          <div className="text-muted-foreground text-sm mt-1">4–6 кг/мес • дефицит 40%</div>
        </button>

        <button onClick={() => handleChoice('slow')} className="inga-card w-full text-left hover:border-primary transition-colors cursor-pointer">
          <div className="font-bold text-lg">🐢 Медленно</div>
          <div className="text-muted-foreground text-sm mt-1">2–3 кг/мес • дефицит 20%</div>
        </button>
      </div>
    </div>
  );
}
