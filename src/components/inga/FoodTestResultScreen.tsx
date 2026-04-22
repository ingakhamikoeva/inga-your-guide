import { useApp } from '@/context/AppContext';
import { interpretFoodTest } from '@/lib/food-test';

export function FoodTestResultScreen() {
  const { profile, setStep } = useApp();
  const result = profile.foodTestAnswers ? interpretFoodTest(profile.foodTestAnswers) : null;

  if (!result) return null;

  return (
    <div className="flex flex-col items-center min-h-screen px-6 py-10 animate-fade-in-up">
      <h2 className="text-2xl font-bold mb-6">Результаты тестирования</h2>

      <div className="inga-bubble mb-4">
        <p className="text-muted-foreground mb-2">Я посмотрела твои ответы и хочу рассказать, как я вижу твою ситуацию.</p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        <div className="inga-card">
          <div className="font-bold mb-2">1️⃣ Что происходит</div>
          <p className="text-muted-foreground text-sm">{result.interpretation.happening}</p>
        </div>

        <div className="inga-card">
          <div className="font-bold mb-2">2️⃣ Что это значит</div>
          <p className="text-muted-foreground text-sm">{result.interpretation.meaning}</p>
        </div>

        <div className="inga-card">
          <div className="font-bold mb-2">3️⃣ Как мы будем работать</div>
          <p className="text-muted-foreground text-sm">{result.interpretation.plan}</p>
        </div>

        <div className="inga-card">
          <div className="font-bold mb-2">Твой профиль</div>
          <div className="text-sm space-y-1">
            <p><span className="text-muted-foreground">Паттерн:</span> {result.pattern}</p>
            <p><span className="text-muted-foreground">Триггер:</span> {result.trigger}</p>
            <p><span className="text-muted-foreground">Уязвимое время:</span> {result.vulnerableTime}</p>
            <p><span className="text-muted-foreground">Осознанность:</span> {result.awareness}</p>
            <p><span className="text-muted-foreground">Стиль поддержки:</span> {result.supportStyle}</p>
          </div>
        </div>
      </div>

      <button onClick={() => setStep('support-start')} className="inga-btn-primary w-full max-w-sm mt-8">
        Далее →
      </button>
    </div>
  );
}
