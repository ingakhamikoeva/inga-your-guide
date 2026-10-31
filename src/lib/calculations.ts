import { Calculations, UserProfile } from './types';

// Калорийность округляем до полусотни — «1200» и «1250» запоминаются,
// «1192» и «1248» нет. Используется везде, где цифру видит пользователь.
export function roundTo50(value: number): number {
  return Math.round(value / 50) * 50;
}

// Keep the formula result separate from the product's minimum corridor.
// This same rule is used by onboarding and when restoring a saved plan.
export function calculateCalorieCorridor(totalCalories: number) {
  const deficit25 = roundTo50(totalCalories * 0.75);
  const useMinimum = deficit25 - 100 < 1000;
  return {
    deficit25,
    corridorMin: useMinimum ? 1000 : deficit25 - 100,
    corridorMax: useMinimum ? 1200 : deficit25 + 100,
  };
}

export function usesMinimumCalorieCorridor(calculations: Calculations | null | undefined): boolean {
  return !!calculations && Number.isFinite(calculations.deficit25) && calculations.deficit25 - 100 < 1000;
}

export function calculateAll(profile: Partial<UserProfile>): Calculations {
  const { gender = 'female', age = 30, weight = 70, height = 165, stepsPerDay = 5000 } = profile;

  let bmr = 0;
  if (gender === 'female') {
    bmr = 655.1 + 9.563 * weight + 1.85 * height - 4.676 * age;
  } else {
    bmr = 66.5 + 13.75 * weight + 5.003 * height - 6.775 * age;
  }

  const stepCalories = gender === 'female' ? stepsPerDay * 0.02 : stepsPerDay * 0.04;
  const totalCalories = Math.round(bmr + stepCalories);

  const heightM = height / 100;
  const bmi = Math.round((weight / (heightM * heightM)) * 10) / 10;
  const idealWeight = Math.round(22 * heightM * heightM);
  const maxHealthyWeight = Math.round(25 * heightM * heightM);
  const minHealthyWeight = Math.round(18.5 * heightM * heightM);

  // Дефицит 25% — единый для всех (выбор темпа убран из онбординга).
  // Коридор ±100; если нижняя граница меньше 1000, применяется 1000–1200.
  const corridor = calculateCalorieCorridor(totalCalories);

  return {
    bmi,
    bmr: Math.round(bmr),
    totalCalories: roundTo50(totalCalories),
    idealWeight,
    maxHealthyWeight,
    minHealthyWeight,
    ...corridor,
  };
}

export function checkGoalBmi(goalWeight: number, height: number) {
  const heightM = height / 100;
  const goalBmi = goalWeight / (heightM * heightM);
  const minHealthyWeight = Math.ceil(18.5 * heightM * heightM * 10) / 10;
  const comfortableWeight = Math.round((minHealthyWeight + 2) * 10) / 10;
  const isUnsafe = !Number.isFinite(goalWeight) || !Number.isFinite(height)
    || height <= 0 || goalWeight < minHealthyWeight;

  return {
    goalBmi: Math.round(goalBmi * 10) / 10,
    isUnsafe,
    isBorderlineLow: goalBmi >= 18.5 && goalBmi < 19.5,
    isHealthy: goalBmi >= 19.5 && goalBmi <= 24.99,
    isAboveNormal: goalBmi >= 25,
    isTooLow: isUnsafe,
    minHealthyWeight,
    comfortableWeight,
  };
}

export function goalWeightWarning(height: number): string {
  return `При росте ${height.toLocaleString('ru-RU')} см выбранная цель соответствует ИМТ ниже 18,5. Приложение не рассчитывает снижение веса до такой цели. Укажите другой целевой вес; индивидуальную цель можно обсудить с врачом.`;
}
