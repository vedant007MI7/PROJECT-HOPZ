// Hopz design tokens: Minimalist x Soft-tech pastels. Flat white cards on a lavender/sky wash, one cobalt accent,
// liquid-glass glow only on selections and main buttons. (The splash keeps the dark mauve look.)
import { Platform, StatusBar } from 'react-native';

export const C = {
  tx: '#0E0B26', // headings and main text (near-black ink)
  tx2: '#4A4670', // secondary text and labels
  amber: '#2456D6', // main accent (kept the old name): buttons, prices, selection glow
  amberText: '#FFFFFF', // text on the cobalt buttons
  steel: '#8FA9F0',
  steelText: '#0E0B26',
  gold: '#2456D6',
  bgs: '#0E0B26',
  road: '#FFFFFF',
  blk: '#EFEDF6',
  water: '#D9E6F7',
  park: '#E6E3F0',
  rim: 'rgba(59,111,232,0.35)',
  inset: '#FFFFFF',
  line: 'rgba(36,40,110,0.14)',
  soft: 'rgba(59,111,232,0.11)',
  err: '#C8342B',
  splash: '#3E3239', // the splash stays dark mauve
};

export const F = {
  hd: 'Sora_700Bold',
  hd6: 'Sora_600SemiBold',
  r: 'DMSans_400Regular',
  m: 'DMSans_500Medium',
  sb: 'DMSans_600SemiBold',
  b: 'DMSans_700Bold',
};

export const BG = ['#EEE8FB', '#F6F4FC', '#E1EBFF'];

export const TOP = Platform.OS === 'ios' ? 58 : (StatusBar.currentHeight || 24) + 18;

// Glass recipes: gradient fill + gloss on the top half + rim colour + blur strength + blur tint
export const VARIANT = {
  // flat white cards
  dark: { colors: ['#FFFFFF', '#FFFFFF'], gloss: null, border: '#D9D5EC', blur: 20, tint: 'light' },
  mid: { colors: ['#FFFFFF', '#FFFFFF'], gloss: null, border: '#D9D5EC', blur: 20, tint: 'light' },
  flat: { colors: ['#FFFFFF', '#FFFFFF'], gloss: null, border: '#E3E0F1', blur: 20, tint: 'light' },
  // quiet secondary buttons
  steel: { colors: ['#EDEAF8', '#E4E1F3'], gloss: null, border: '#D2CEE8', blur: 20, tint: 'light' },
  // soft blue info card
  light: { colors: ['rgba(226,236,255,0.95)', 'rgba(205,224,255,0.9)'], gloss: ['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.05)'], border: 'rgba(36,86,214,0.35)', blur: 20, tint: 'light' },
  // selected: glowing liquid glass
  sel: { colors: ['rgba(255,255,255,0.98)', 'rgba(205,224,255,0.92)', 'rgba(170,200,255,0.88)'], gloss: ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.1)'], border: '#2456D6', bw: 2, blur: 30, tint: 'light' },
  // main buttons and active tabs: glowing cobalt glass
  amber: { colors: ['#6E9BFF', '#3B6FE8', '#2456D6'], gloss: ['rgba(255,255,255,0.6)', 'rgba(255,255,255,0.04)'], border: 'rgba(255,255,255,0.85)', bw: 1.5, blur: 20, tint: 'light' },
};
