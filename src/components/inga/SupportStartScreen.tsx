import { useApp } from '@/context/AppContext';
import { saveBehaviorProfile, saveAssessmentAnswers, logUserEvent, startTrial } from '@/lib/db';
import { withName } from '@/lib/user-name';

export function SupportStartScreen() {
  const { profile, setStep, calculations, syncToDb } = useApp();

  const handleStart = async () => {
    // Sync everything to DB when starting support
    await syncToDb().catch(() => {});
    if (profile.foodProfile) {
      await saveBehaviorProfile(profile.foodProfile).catch(() => {});
    }
    if (profile.foodTestAnswers) {
      await saveAssessmentAnswers(profile.foodTestAnswers).catch(() => {});
    }
    await startTrial().catch(() => {});
    await logUserEvent('first_day', { step: 'support-start' }).catch(() => {});
    setStep('daily');
  };

  return (
    <div className="flex flex-col items-center min-h-screen px-6 py-10 animate-fade-in-up">
      <h2 className="text-2xl font-bold mb-6">Начинаем сопровождение</h2>

      <div className="inga-bubble mb-4">
        <p className="mb-3">{withName(profile.name, 'начинаем спокойно. Сегодня просто наблюдаем за питанием и ритмом.')}</p>
        <p className="mb-3 text-sm text-muted-foreground">С учётом ваших ответов мы будем работать так:</p>
        {profile.foodProfile?.vulnerableTime === 'вечер' && (
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>• делать упор на сытые приёмы пищи днём</li>
            <li>• помогать снижать усталость к вечеру</li>
            <li>• возвращаться в режим спокойно</li>
          </ul>
        )}
        {profile.foodProfile?.vulnerableTime !== 'вечер' && (
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>• выстраивать простой режим питания</li>
            <li>• планировать приёмы пищи заранее</li>
            <li>• поддерживать мотивацию и стабильность</li>
          </ul>
        )}
        <p className="mt-3 text-sm italic text-muted-foreground">Моя задача — поддерживать вас, а не контролировать.</p>
      </div>

      {calculations && (
        <div className="inga-card w-full max-w-sm mb-6">
          <div className="font-bold mb-2">Ваш коридор калорийности</div>
          <div className="text-2xl font-bold text-primary">
            {profile.paceChoice === 'fast'
              ? `${Math.round((calculations.totalCalories * 0.6) - 100)} – ${Math.round((calculations.totalCalories * 0.6) + 100)}`
              : `${Math.round((calculations.totalCalories * 0.8) - 100)} – ${Math.round((calculations.totalCalories * 0.8) + 100)}`
            }
            <span className="text-base font-normal text-muted-foreground"> ккал/день</span>
          </div>
        </div>
      )}

      <div className="inga-bubble mb-6">
        <p>Сегодня мы просто начинаем наблюдать.</p>
        <p className="text-muted-foreground">Без идеальности и без давления. Я рядом.</p>
      </div>

      <button onClick={handleStart} className="inga-btn-primary w-full max-w-sm">
        Начать сопровождение ✨
      </button>
    </div>
  );
}
