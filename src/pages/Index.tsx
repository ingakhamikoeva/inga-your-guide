import { useEffect, useState } from 'react';
import { auth } from '@/lib/auth';
import { AppProvider, useApp } from '@/context/AppContext';
import { AuthScreen } from '@/components/inga/AuthScreen';
import { WelcomeScreen } from '@/components/inga/WelcomeScreen';
import { SurveyDataScreen } from '@/components/inga/SurveyDataScreen';
import { SurveyNameScreen } from '@/components/inga/SurveyNameScreen';
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
import { ChatScreen } from '@/components/inga/ChatScreen';

function AppFlow() {
  const { step, setStep, profile, hydrateFromDb } = useApp();
  const [authReady, setAuthReady] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const hydratedRef = useState({ done: false })[0];

  useEffect(() => {
    const handleAuth = async (authed: boolean) => {
      setIsAuthed(authed);
      setAuthReady(true);
      if (!authed) {
        hydratedRef.done = false;
        return;
      }
      // Always hydrate from DB on login — localStorage may be empty (e.g. new domain)
      if (!hydratedRef.done) {
        hydratedRef.done = true;
        // Defer to avoid auth-callback deadlocks
        setTimeout(async () => {
          try {
            await hydrateFromDb();
          } catch {
            if (step === 'auth') setStep('welcome');
          }
        }, 0);
      }
    };

    const { data: { subscription } } = auth.onAuthStateChange((_event, session) => {
      handleAuth(!!session?.user);
    });

    auth.getSession().then(({ data: { session } }) => {
      handleAuth(!!session?.user);
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!authReady) return null;

  if (!isAuthed || step === 'auth') {
    return <AuthScreen />;
  }

  switch (step) {
    case 'welcome': return <WelcomeScreen />;
    case 'survey-name': return <SurveyNameScreen />;
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
    case 'chat': return <ChatScreen />;
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
