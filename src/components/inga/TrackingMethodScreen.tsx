import { useApp } from '@/context/AppContext';

export function TrackingMethodScreen() {
  const { updateProfile, setStep } = useApp();

  const handleChoice = (method: 'calories' | 'palm' | 'plate') => {
    updateProfile({ trackingMethod: method });
    setStep('food-test-intro');
  };

  return (
    <div className="flex flex-col items-center min-h-screen px-6 py-10 animate-fade-in-up">
      <h2 className="text-2xl font-bold mb-2">Как будем учитывать калорийность?</h2>
      <p className="text-muted-foreground mb-6 text-center">Выбери способ, который тебе ближе</p>

      <div className="w-full max-w-sm space-y-4">
        <button onClick={() => handleChoice('calories')} className="inga-card w-full text-left hover:border-primary transition-colors cursor-pointer">
          <div className="font-bold text-lg">🔵 Считать калории</div>
          <div className="text-muted-foreground text-sm mt-1">Точный подсчёт калорий в приложении</div>
        </button>

        <button onClick={() => handleChoice('palm')} className="inga-card w-full text-left hover:border-primary transition-colors cursor-pointer">
          <div className="font-bold text-lg">🟡 Метод ладони</div>
          <div className="text-muted-foreground text-sm mt-1">Порции определяются по размеру ладони</div>
        </button>

        <button onClick={() => handleChoice('plate')} className="inga-card w-full text-left hover:border-primary transition-colors cursor-pointer">
          <div className="font-bold text-lg">🟢 Метаболическая тарелка</div>
          <div className="text-muted-foreground text-sm mt-1">Половина тарелки — овощи, четверть — белок, четверть — углеводы</div>
        </button>
      </div>
    </div>
  );
}
