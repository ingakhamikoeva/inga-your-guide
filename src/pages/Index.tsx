import { useEffect, useState } from 'react';
import { auth } from '@/lib/auth';
import { AppProvider, useApp } from '@/context/AppContext';
import { AppStep } from '@/lib/types';
import { AuthScreen } from '@/components/inga/AuthScreen';
import { SurveyNameScreen } from '@/components/inga/SurveyNameScreen';
import { SurveyDataScreen } from '@/components/inga/SurveyDataScreen';
import { TrackingMethodScreen } from '@/components/inga/TrackingMethodScreen';
import { DailyScreen } from '@/components/inga/DailyScreen';
import { MenuScreen } from '@/components/inga/MenuScreen';
import { ChatScreen } from '@/components/inga/ChatScreen';
import { GoalScreen } from '@/components/inga/GoalScreen';
import { WhyScreen } from '@/components/inga/WhyScreen';
import { HowItWorksScreen } from '@/components/inga/HowItWorksScreen';
import { RouteReadyScreen } from '@/components/inga/RouteReadyScreen';

function AppFlow() {
  const { step, setStep, hydrateFromDb } = useApp();
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
      if (!hydratedRef.done) {
        hydratedRef.done = true;
        setTimeout(async () => {
          try {
            await hydrateFromDb();
          } catch {
            if (step === 'auth') setStep('survey-name' as AppStep);
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
    case 'survey-name': return <SurveyNameScreen />;
    case 'goal': return <GoalScreen />;
    case 'why': return <WhyScreen />;
    case 'survey-data': return <SurveyDataScreen />;
    case 'tracking-method': return <TrackingMethodScreen />;
    case 'how-it-works': return <HowItWorksScreen />;
    case 'route-ready': return <RouteReadyScreen />;
    case 'daily': return <DailyScreen />;
    case 'menu': return <MenuScreen />;
    case 'chat': return <ChatScreen />;
    default: return <SurveyNameScreen />;
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
