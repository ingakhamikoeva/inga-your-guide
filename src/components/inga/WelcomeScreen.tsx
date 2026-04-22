import ingaPhoto from '@/assets/inga-photo.jpg';
import { useApp } from '@/context/AppContext';

export function WelcomeScreen() {
  const { setStep } = useApp();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 animate-fade-in-up">
      <img
        src={ingaPhoto}
        alt="Инга — твой личный диетолог"
        className="w-40 h-40 rounded-full object-cover shadow-lg mb-8 border-4 border-card"
      />
      <div className="inga-bubble text-center max-w-sm mb-8">
        <p className="text-lg font-semibold mb-2">Привет! Я — твой личный диетолог.</p>
        <p className="text-muted-foreground mb-2">Я помогу тебе мягко прийти к желаемому весу.</p>
        <p className="text-muted-foreground">Мы идём к стройности вкусно и в твоём ритме.</p>
      </div>
      <button onClick={() => setStep('survey-data')} className="inga-btn-primary text-lg px-10 py-4">
        Поехали 🚀
      </button>
    </div>
  );
}
