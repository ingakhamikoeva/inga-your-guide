import { useId } from 'react';
import type { Medal } from '@/lib/types';
import icon0 from '@/assets/glass-icons/cheatsheet.webp';
import icon1 from '@/assets/glass-icons/favorite.webp';
import icon2 from '@/assets/glass-icons/goal-hero.webp';
import icon3 from '@/assets/glass-icons/goal-queen.webp';
import icon4 from '@/assets/glass-icons/guides.webp';
import icon5 from '@/assets/glass-icons/halfway.webp';
import icon6 from '@/assets/glass-icons/loss-1.webp';
import icon7 from '@/assets/glass-icons/loss-10.webp';
import icon8 from '@/assets/glass-icons/loss-5.webp';
import icon9 from '@/assets/glass-icons/maintenance-1.webp';
import icon10 from '@/assets/glass-icons/maintenance-2.webp';
import icon11 from '@/assets/glass-icons/maintenance-3.webp';
import icon12 from '@/assets/glass-icons/maintenance-6.webp';
import icon13 from '@/assets/glass-icons/plate.webp';
import icon14 from '@/assets/glass-icons/progress-butterfly.webp';
import icon15 from '@/assets/glass-icons/recipe-bliny.webp';
import icon16 from '@/assets/glass-icons/recipe-shaurma.webp';
import icon17 from '@/assets/glass-icons/scale.webp';
import icon18 from '@/assets/glass-icons/sleep.webp';
import icon19 from '@/assets/glass-icons/steps.webp';
import icon20 from '@/assets/glass-icons/stool.webp';
import icon21 from '@/assets/glass-icons/streak-14.webp';
import icon22 from '@/assets/glass-icons/streak-21.webp';
import icon23 from '@/assets/glass-icons/streak-30.webp';
import icon24 from '@/assets/glass-icons/streak-60.webp';
import icon25 from '@/assets/glass-icons/streak-7.webp';
import icon26 from '@/assets/glass-icons/streak-90.webp';
import icon27 from '@/assets/glass-icons/swap-1.webp';
import icon28 from '@/assets/glass-icons/swap-10.webp';
import icon29 from '@/assets/glass-icons/swap-5.webp';
import icon30 from '@/assets/glass-icons/sweetener.webp';

const images = {
  'cheatsheet': icon0,
  'favorite': icon1,
  'goal-hero': icon2,
  'goal-queen': icon3,
  'guides': icon4,
  'halfway': icon5,
  'loss-1': icon6,
  'loss-10': icon7,
  'loss-5': icon8,
  'maintenance-1': icon9,
  'maintenance-2': icon10,
  'maintenance-3': icon11,
  'maintenance-6': icon12,
  'plate': icon13,
  'progress-butterfly': icon14,
  'recipe-bliny': icon15,
  'recipe-shaurma': icon16,
  'scale': icon17,
  'sleep': icon18,
  'steps': icon19,
  'stool': icon20,
  'streak-14': icon21,
  'streak-21': icon22,
  'streak-30': icon23,
  'streak-60': icon24,
  'streak-7': icon25,
  'streak-90': icon26,
  'swap-1': icon27,
  'swap-10': icon28,
  'swap-5': icon29,
  'sweetener': icon30,
} as const;
export type GlassIconName = keyof typeof images;

export function GlassIcon({ name, size = 24, className = '' }: { name: GlassIconName; size?: number; className?: string }) {
  return <img src={images[name]} alt="" aria-hidden="true" draggable={false} width={size} height={size} className={`inline-block object-contain shrink-0 align-middle ${className}`} style={{ width: size, height: size }} />;
}

export function medalIconName(medal: Pick<Medal, 'id' | 'title' | 'icon'>): GlassIconName | undefined {
  if (medal.id === 'goal') return medal.icon === '🏆' || medal.title.includes('герой') ? 'goal-hero' : 'goal-queen';
  if (/^(swap-|recipe-|streak-|loss-|maintenance-)/.test(medal.id) || medal.id === 'favorite' || medal.id === 'halfway') {
    if (Object.prototype.hasOwnProperty.call(images, medal.id)) return medal.id as GlassIconName;
  }
  return undefined;
}

export function MedalIcon({ medal, size = 56 }: { medal: Pick<Medal, 'id' | 'title' | 'icon'>; size?: number }) {
  const name = medalIconName(medal);
  return name ? <GlassIcon name={name} size={size} /> : <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size, fontSize: size / 2 }}>{medal.icon || '🏅'}</span>;
}

// The same golden glass search symbol is used at every search entry point.
export function SearchIcon({ size = 20, className = '' }: { size?: number; className?: string }) {
  const id = useId();
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false" className={`inline-block align-middle shrink-0 ${className}`}>
    <defs>
      <linearGradient id={`${id}-rim`} x1="4" y1="2" x2="24" y2="29" gradientUnits="userSpaceOnUse"><stop stopColor="#FFF1C4"/><stop offset=".28" stopColor="#FFB738"/><stop offset=".65" stopColor="#E87509"/><stop offset="1" stopColor="#FFE2A1"/></linearGradient>
      <linearGradient id={`${id}-glass`} x1="6" y1="5" x2="22" y2="23" gradientUnits="userSpaceOnUse"><stop stopColor="#FFFFFF" stopOpacity=".64"/><stop offset="1" stopColor="#FFD9A5" stopOpacity=".16"/></linearGradient>
    </defs>
    <path d="M21 21l7 7" stroke={`url(#${id}-rim)`} strokeWidth="5.5" strokeLinecap="round"/>
    <path d="M22.3 21.5l5.8 5.8" stroke="#FFF0B8" strokeWidth="1" strokeLinecap="round"/>
    <circle cx="13.5" cy="13.5" r="10.1" fill={`url(#${id}-glass)`} stroke="#B45C13" strokeOpacity=".45" strokeWidth="4.4"/>
    <circle cx="13.5" cy="13.5" r="10.1" stroke={`url(#${id}-rim)`} strokeWidth="3.4"/>
    <path d="M6.7 11a7.3 7.3 0 0 1 6.2-5.2" stroke="#FFF8E3" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>;
}
