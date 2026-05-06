import { getText, UserSex } from '@/lib/gender-text';

interface Props {
  sex: UserSex;
  onContinue: () => void;
}

export function FixationCompleteModal({ sex, onContinue }: Props) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-sm px-6 animate-fade-in">
      <div className="inga-card w-full max-w-sm space-y-4 text-center animate-fade-in-up">
        <div className="text-5xl">💛</div>
        <h2 className="text-2xl font-bold">Фиксация пройдена</h2>
        <p className="text-sm text-muted-foreground">
          {getText(
            'Ты дошла до равновесной калорийности и сохранила результат. Теперь переходим на этап сохранения веса.',
            'Ты дошёл до равновесной калорийности и сохранил результат. Теперь переходим на этап сохранения веса.',
            sex,
          )}
        </p>
        <button onClick={onContinue} className="inga-btn-primary w-full">
          Перейти к сохранению веса →
        </button>
      </div>
    </div>
  );
}
