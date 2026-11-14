// Hopz design tokens: Almond Milk (60%) + Dusty Teal (30%) + small gold, brown and dark grey touches.
import { Platform, StatusBar } from 'react-native';

export const C = {
  tx: '#363F3F', // dark grey text
  tx2: '#7A6350', // soft brown, secondary text
  amber: '#5F8C89', // main accent (kept the old name): Dusty Teal
  amberText: '#FFFFFF',
  steel: '#8DBDB8',
  steelText: '#363F3F',
  gold: '#D8A93A', // small yellow touches: route line, driver car
  bgs: '#3E4848',
  road: '#FBF6EE',
  blk: '#E4D9CB',
  water: '#CFE0DE',
  park: '#C8D9CF',
  rim: 'rgba(255,255,255,0.75)',
  inset: 'rgba(95,140,137,0.16)',
  line: 'rgba(95,140,137,0.30)',
  splash: '#2F4D4B', // darker Dusty Teal behind the logo animation
};

export const F = {
  hd: 'Sora_700Bold',
  hd6: 'Sora_600SemiBold',
  r: 'DMSans_400Regular',
  m: 'DMSans_500Medium',
  sb: 'DMSans_600SemiBold',
  b: 'DMSans_700Bold',
};

export const BG = ['#F3ECE1', '#EDE4D8', '#E4D9CB'];

export const TOP = Platform.OS === 'ios' ? 58 : (StatusBar.currentHeight || 24) + 18;

// Glass recipes: gradient fill + gloss on the top half + rim colour + blur strength + blur tint
export const VARIANT = {
  dark: { colors: ['rgba(255,250,242,0.66)', 'rgba(237,228,216,0.50)'], gloss: ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.05)'], border: 'rgba(255,255,255,0.8)', blur: 40, tint: 'light' },
  mid: { colors: ['rgba(143,189,184,0.42)', 'rgba(95,140,137,0.24)'], gloss: ['rgba(255,255,255,0.45)', 'rgba(255,255,255,0.04)'], border: 'rgba(255,255,255,0.6)', blur: 30, tint: 'light' },
  steel: { colors: ['rgba(150,196,191,0.50)', 'rgba(95,140,137,0.30)'], gloss: ['rgba(255,255,255,0.5)', 'rgba(255,255,255,0.05)'], border: 'rgba(255,255,255,0.65)', blur: 30, tint: 'light' },
  sel: { colors: ['rgba(150,196,191,0.62)', 'rgba(95,140,137,0.36)'], gloss: ['rgba(255,255,255,0.5)', 'rgba(255,255,255,0.05)'], border: '#5F8C89', bw: 2.5, blur: 30, tint: 'light' },
  amber: { colors: ['rgba(125,176,172,0.96)', 'rgba(95,140,137,0.98)', 'rgba(78,121,118,1)'], gloss: ['rgba(255,255,255,0.38)', 'rgba(255,255,255,0.05)'], border: 'rgba(255,255,255,0.6)', blur: 20, tint: 'light' },
  light: { colors: ['rgba(150,196,191,0.62)', 'rgba(95,140,137,0.38)'], gloss: ['rgba(255,255,255,0.5)', 'rgba(255,255,255,0.08)'], border: 'rgba(255,255,255,0.7)', blur: 30, tint: 'light' },
  flat: { colors: ['rgba(143,189,184,0.30)', 'rgba(95,140,137,0.18)'], gloss: null, border: 'rgba(255,255,255,0.5)', blur: 20, tint: 'light' },
};
