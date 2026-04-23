import { Calculations, UserProfile } from './types';

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

  const deficit20 = Math.round(totalCalories * 0.8);
  const deficit40 = Math.round(totalCalories * 0.6);

  return {
    bmi,
    bmr: Math.round(bmr),
    totalCalories,
    idealWeight,
    maxHealthyWeight,
    minHealthyWeight,
    deficit20,
    deficit40,
    corridorMin: 0,
    corridorMax: 0,
  };
}

export function getCorridorForPace(totalCalories: number, pace: 'fast' | 'slow') {
  const base = pace === 'fast' ? Math.round(totalCalories * 0.6) : Math.round(totalCalories * 0.8);
  return { corridorMin: base - 100, corridorMax: base + 100 };
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
