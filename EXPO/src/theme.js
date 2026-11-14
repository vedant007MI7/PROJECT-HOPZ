// Hopz design tokens: Mauve palette. Dark shades build the space, the light shades glow on top.
// #3E3239 #6B5560 #9E8189 #C7A9A3 #E8D2C4 #F7EFE7
import { Platform, StatusBar } from 'react-native';

export const C = {
  tx: '#F7EFE7', // headings and main text
  tx2: '#C7A9A3', // secondary text and labels
  amber: '#E8D2C4', // main accent (kept the old name): buttons, prices, selection glow
  amberText: '#3E3239', // dark text on the light buttons
  steel: '#C7A9A3',
  steelText: '#F7EFE7',
  gold: '#E8D2C4', // route and driver car glow
  bgs: '#6B5560',
  road: '#9E8189',
  blk: '#6B5560',
  water: '#2E2229',
  park: '#4A3A44',
  rim: 'rgba(232,210,196,0.34)',
  inset: 'rgba(62,50,57,0.55)',
  line: 'rgba(232,210,196,0.22)',
  soft: 'rgba(232,210,196,0.14)',
  err: '#F2A394',
  splash: '#3E3239',
};

export const F = {
  hd: 'Sora_700Bold',
  hd6: 'Sora_600SemiBold',
  r: 'DMSans_400Regular',
  m: 'DMSans_500Medium',
  sb: 'DMSans_600SemiBold',
  b: 'DMSans_700Bold',
};

export const BG = ['#4A3B42', '#3E3239', '#32282E'];

export const TOP = Platform.OS === 'ios' ? 58 : (StatusBar.currentHeight || 24) + 18;

// Glass recipes: gradient fill + gloss on the top half + rim colour + blur strength + blur tint
export const VARIANT = {
  dark: { colors: ['rgba(107,85,96,0.62)', 'rgba(62,50,57,0.52)'], gloss: ['rgba(247,239,231,0.20)', 'rgba(247,239,231,0.03)'], border: 'rgba(232,210,196,0.34)', blur: 40, tint: 'dark' },
  mid: { colors: ['rgba(107,85,96,0.56)', 'rgba(62,50,57,0.46)'], gloss: ['rgba(247,239,231,0.18)', 'rgba(247,239,231,0.03)'], border: 'rgba(232,210,196,0.30)', blur: 30, tint: 'dark' },
  steel: { colors: ['rgba(158,129,137,0.42)', 'rgba(107,85,96,0.36)'], gloss: ['rgba(247,239,231,0.24)', 'rgba(247,239,231,0.04)'], border: 'rgba(232,210,196,0.36)', blur: 30, tint: 'dark' },
  sel: { colors: ['rgba(199,169,163,0.44)', 'rgba(158,129,137,0.32)'], gloss: ['rgba(255,255,255,0.32)', 'rgba(255,255,255,0.05)'], border: '#E8D2C4', bw: 2.5, blur: 30, tint: 'dark' },
  amber: { colors: ['#F7EFE7', '#E8D2C4', '#C7A9A3'], gloss: ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.05)'], border: 'rgba(255,255,255,0.75)', blur: 20, tint: 'light' },
  light: { colors: ['rgba(232,210,196,0.46)', 'rgba(199,169,163,0.40)'], gloss: ['rgba(255,255,255,0.35)', 'rgba(255,255,255,0.06)'], border: 'rgba(247,239,231,0.55)', blur: 30, tint: 'dark' },
  flat: { colors: ['rgba(107,85,96,0.42)', 'rgba(62,50,57,0.36)'], gloss: null, border: 'rgba(232,210,196,0.24)', blur: 20, tint: 'dark' },
};
