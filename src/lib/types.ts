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
  goal_weight_kg?: number;
  current_weight_kg?: number;
  waist: number;
  hips: number;
  paceChoice: 'fast' | 'slow';
  trackingMethod: 'calories' | 'palm' | 'plate';
  motivation: string[];
  foodTestAnswers: number[];
  kgToLose?: number;
  food_preferences?: string[];
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
  deficit25: number;
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
  sweetPointDone?: boolean | null;
  dayWin?: string;
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
  | 'survey-name'
  | 'goal'
  | 'why'
  | 'survey-data'
  | 'tracking-method'
  | 'how-it-works'
  | 'route-ready'
  | 'daily'
  | 'menu'
  | 'chat';
