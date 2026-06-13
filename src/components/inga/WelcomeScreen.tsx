import ingaPhoto from '@/assets/inga-photo.jpg';
import { useApp } from '@/context/AppContext';
import { AppStep } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-unused-vars

// Sequence of onboarding steps — used to figure out where to resume
const ONBOARDING_SEQUENCE: string[] = [
  'survey-name',
  'survey-data',
  'survey-reasons',
  'survey-emotions',
  'calculations',
  'goal-weight',
  'measurements',
  'pace-choice',
  'tracking-method',
  'food-test-intro',
  'food-test',
  'food-test-result',
  'support-start',
];

export function WelcomeScreen() {
  const { setStep, profile, calculations } = useApp();

  // Determine the resume step based on what data already exists
  const getResumeStep = (): AppStep | null => {
    if (!profile.name) return null;
    if (!profile.gender || !profile.age || !profile.height || !profile.weight) return 'survey-data';
    if (!profile.weightGainReasons?.length) return 'survey-reasons';
    if (!profile.emotionalTrigger) return 'survey-emotions';
    if (!calculations) return 'calculations';
    if (!profile.goalWeight) return 'goal-weight';
    if (profile.waist === undefined || profile.hips === undefined) return 'measurements';
    if (!profile.paceChoice) return 'pace-choice';
    if (!profile.trackingMethod) return 'tracking-method';
    if (!profile.foodTestAnswers?.length) return 'food-test-intro';
    if (!profile.foodProfile) return 'food-test-result';
    return 'daily';
  };

  const resumeStep = getResumeStep();
  const hasProgress = resumeStep !== null;

  const handleStartFresh = () => setStep('survey-name');
  const handleContinue = () => resumeStep && setStep(resumeStep);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 animate-fade-in-up">
      <img
        src={ingaPhoto}
        alt="Инга — твой личный диетолог"
        className="w-40 h-40 rounded-full object-cover shadow-lg mb-8 border-4 border-card"
      />
      {hasProgress ? (
        <>
          <div className="inga-bubble text-center max-w-sm mb-8">
            <p className="text-lg font-semibold mb-2">С возвращением{profile.name ? `, ${profile.name}` : ''} 💛</p>
            <p className="text-muted-foreground">Я сохранила твои ответы. Продолжим с того места, где остановились?</p>
          </div>
          <button onClick={handleContinue} className="inga-btn-primary text-lg px-10 py-4 mb-3">
            Продолжить
          </button>
          <button
            onClick={handleStartFresh}
            className="text-sm text-muted-foreground underline"
          >
            Начать заново
          </button>
        </>
      ) : (
        <>
          <div className="inga-bubble text-center max-w-sm mb-8">
            <p className="text-lg font-semibold mb-2">Я рядом, чтобы путь к желаемому весу стал легче.</p>
            <p className="text-muted-foreground mb-2">Без жёстких ограничений, срывов и откатов.</p>
            <p className="text-muted-foreground">Тебя ждут вкусная еда, понятная система и поддержка на каждом этапе.</p>
          </div>
          <button onClick={handleStartFresh} className="inga-btn-primary text-lg px-10 py-4">
            Начать
          </button>
        </>
      )}
    </div>
  );
}
