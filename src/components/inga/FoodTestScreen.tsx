import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { AppStep } from '@/lib/types';
import { foodTestQuestions, interpretFoodTest } from '@/lib/food-test';
import { getText } from '@/lib/gender-text';

export function FoodTestIntroScreen() {
  const { setStep } = useApp();

  return (
    <div className="flex flex-col items-center min-h-screen px-6 py-10 animate-fade-in-up">
      <h2 className="text-2xl font-bold mb-4">Пищевое тестирование</h2>
      <div className="inga-bubble mb-8 text-center">
        <p className="mb-2">Прежде чем мы начнём сопровождение, я хочу лучше понять ваши привычки и отношение к еде.</p>
        <p className="text-muted-foreground mb-2">Это короткое тестирование — 3–4 минуты.</p>
        <p className="text-muted-foreground mb-1">Оно поможет мне:</p>
        <ul className="text-muted-foreground text-sm text-left ml-4">
          <li>• точнее подбирать питание</li>
          <li>• правильно реагировать в сложные моменты</li>
          <li>• поддерживать вас</li>
        </ul>
        <p className="text-muted-foreground mt-3 text-sm italic">Здесь нет правильных ответов — важно выбрать то, как бывает у вас чаще всего.</p>
      </div>
      <button onClick={() => setStep('food-test' as AppStep)} className="inga-btn-primary">
        Пройти тестирование
      </button>
    </div>
  );
}

export function FoodTestScreen() {
  const { updateProfile, setStep, profile } = useApp();
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);

  const question = foodTestQuestions[currentQ];
  const total = foodTestQuestions.length;
  const questionText = typeof question.text === 'string'
    ? question.text
    : getText(question.text.female, question.text.male, profile.gender);

  const handleAnswer = (optionIndex: number) => {
    const newAnswers = [...answers, optionIndex];
    setAnswers(newAnswers);

    if (currentQ < total - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      const result = interpretFoodTest(newAnswers);
      updateProfile({
        foodTestAnswers: newAnswers,
        foodProfile: {
          pattern: result.pattern,
          trigger: result.trigger,
          vulnerableTime: result.vulnerableTime,
          awareness: result.awareness,
          supportStyle: result.supportStyle,
        },
      });
      setStep('food-test-result' as AppStep);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen px-6 py-10 animate-fade-in-up">
      <div className="w-full max-w-sm mb-4">
        <div className="text-sm text-muted-foreground mb-2">Вопрос {currentQ + 1} из {total}</div>
        <div className="inga-progress">
          <div className="inga-progress-bar" style={{ width: `${((currentQ + 1) / total) * 100}%` }} />
        </div>
      </div>

      <h3 className="text-xl font-bold mb-6 text-center">{questionText}</h3>

      <div className="w-full max-w-sm space-y-3">
        {question.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => handleAnswer(i)}
            className="inga-card w-full text-left hover:border-primary transition-colors cursor-pointer"
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
