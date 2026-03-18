import { AppProvider, useApp } from '@/context/AppContext';
import { WelcomeScreen } from '@/components/inga/WelcomeScreen';
import { SurveyDataScreen } from '@/components/inga/SurveyDataScreen';
import { SurveyReasonsScreen } from '@/components/inga/SurveyReasonsScreen';
import { SurveyEmotionsScreen } from '@/components/inga/SurveyEmotionsScreen';
import { CalculationsScreen } from '@/components/inga/CalculationsScreen';
import { GoalWeightScreen } from '@/components/inga/GoalWeightScreen';
import { MeasurementsScreen } from '@/components/inga/MeasurementsScreen';
import { PaceChoiceScreen } from '@/components/inga/PaceChoiceScreen';
import { TrackingMethodScreen } from '@/components/inga/TrackingMethodScreen';
import { FoodTestIntroScreen, FoodTestScreen } from '@/components/inga/FoodTestScreen';
import { FoodTestResultScreen } from '@/components/inga/FoodTestResultScreen';
import { SupportStartScreen } from '@/components/inga/SupportStartScreen';
import { DailyScreen } from '@/components/inga/DailyScreen';
import { MenuScreen } from '@/components/inga/MenuScreen';

function AppFlow() {
  const { step } = useApp();

  switch (step) {
    case 'welcome': return <WelcomeScreen />;
    case 'survey-data': return <SurveyDataScreen />;
    case 'survey-reasons': return <SurveyReasonsScreen />;
    case 'survey-emotions': return <SurveyEmotionsScreen />;
    case 'calculations': return <CalculationsScreen />;
    case 'goal-weight': return <GoalWeightScreen />;
    case 'measurements': return <MeasurementsScreen />;
    case 'pace-choice': return <PaceChoiceScreen />;
    case 'tracking-method': return <TrackingMethodScreen />;
    case 'food-test-intro': return <FoodTestIntroScreen />;
    case 'food-test': return <FoodTestScreen />;
    case 'food-test-result': return <FoodTestResultScreen />;
    case 'support-start': return <SupportStartScreen />;
    case 'daily': return <DailyScreen />;
    case 'menu': return <MenuScreen />;
    default: return <WelcomeScreen />;
  }
}

const Index = () => (
  <AppProvider>
    <div className="min-h-screen">
      <AppFlow />
    </div>
  </AppProvider>
);

export default Index;
