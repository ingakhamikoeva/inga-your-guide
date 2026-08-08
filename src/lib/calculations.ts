import { Calculations, UserProfile } from './types';

// Калорийность округляем до полусотни — «1200» и «1250» запоминаются,
// «1192» и «1248» нет. Используется везде, где цифру видит пользователь.
export function roundTo50(value: number): number {
  return Math.round(value / 50) * 50;
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
  // Коридор: ±100 ккал от этой цифры. Ровно то же значение показывается
  // пользователю на экране «ВАШ РАСЧЁТ» (SurveyDataScreen).
  const deficit25 = roundTo50(totalCalories * 0.75);

  return {
    bmi,
    bmr: Math.round(bmr),
    totalCalories: roundTo50(totalCalories),
    idealWeight,
    maxHealthyWeight,
    minHealthyWeight,
    deficit25,
    corridorMin: deficit25 - 100,
    corridorMax: deficit25 + 100,
  };
}

export function checkGoalBmi(goalWeight: number, height: number) {
  const heightM = height / 100;
  const goalBmi = goalWeight / (heightM * heightM);
  const minHealthyWeight = Math.round(18.5 * heightM * heightM * 10) / 10;
  const comfortableWeight = Math.round((minHealthyWeight + 2) * 10) / 10;

  return {
    goalBmi: Math.round(goalBmi * 10) / 10,
    isUnsafe: goalBmi < 18.5,
    isBorderlineLow: goalBmi >= 18.5 && goalBmi < 19.5,
    isHealthy: goalBmi >= 19.5 && goalBmi <= 24.99,
    isAboveNormal: goalBmi >= 25,
    isTooLow: goalBmi < 18.5,
    minHealthyWeight,
    comfortableWeight,
  };
}
