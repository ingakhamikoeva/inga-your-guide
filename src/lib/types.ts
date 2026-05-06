export interface UserProfile {
  name: string;
  gender: 'female' | 'male';
  age: number;
  height: number;
  weight: number;
  stepsPerDay: number;
  weightGainReasons: string[];
  emotionalTrigger: string;
  goalWeight: number;
  waist: number;
  hips: number;
  paceChoice: 'fast' | 'slow';
  trackingMethod: 'calories' | 'palm' | 'plate';
  foodTestAnswers: number[];
  foodProfile?: FoodProfile;
  // Weight-stage tracking
  currentStage?: 'loss' | 'fixation' | 'maintenance';
  goalReachedAt?: string;
  fixationStartedAt?: string;
  maintenanceStartedAt?: string;
  equilibriumCalories?: number;
  currentFixationCalories?: number;
  fixationWeekNumber?: number;
  lastCalorieIncreaseAt?: string;
}

export interface FoodProfile {
  pattern: string;
  trigger: string;
  vulnerableTime: string;
  awareness: string;
  supportStyle: string;
}

export interface Calculations {
  bmi: number;
  bmr: number;
  totalCalories: number;
  idealWeight: number;
  maxHealthyWeight: number;
  minHealthyWeight: number;
  deficit20: number;
  deficit40: number;
  corridorMin: number;
  corridorMax: number;
}

export interface DailyReport {
  date: string;
  weight?: number;
  sleepHours?: number;
  stepsYesterday?: number;
  meals: MealReport[];
  eveningEmotion?: string;
  hungerLevel?: number;
  hardestPart?: string;
}

export type MedalType = 'movement' | 'stable' | 'strong' | 'consistency';

export interface Medal {
  id: string;
  type: MedalType;
  title: string;
  description: string;
  date: string;
  weekKey: string;
}

export interface MealReport {
  time: string;
  description: string;
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

export type AppStep =
  | 'auth'
  | 'welcome'
  | 'survey-name'
  | 'survey-data'
  | 'survey-reasons'
  | 'survey-emotions'
  | 'calculations'
  | 'goal-weight'
  | 'measurements'
  | 'pace-choice'
  | 'tracking-method'
  | 'food-test-intro'
  | 'food-test'
  | 'food-test-result'
  | 'support-start'
  | 'daily'
  | 'menu'
  | 'chat';
