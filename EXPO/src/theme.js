// Hopz design tokens (Midnight Slate + Amber), ported from the prototype.
import { Platform, StatusBar } from 'react-native';

export const C = {
  tx: '#EAEDEC',
  tx2: '#BAC7CB',
  amber: '#F2A65A',
  amberText: '#14202B',
  steel: '#8FB3CC',
  steelText: '#0F1C26',
  bgs: '#172A3A',
  road: '#2C4356',
  blk: '#1D3243',
  water: '#12283A',
  park: '#27473F',
  rim: 'rgba(220,236,246,0.24)',
  inset: 'rgba(8,18,26,0.45)',
};

export const F = {
  hd: 'Sora_700Bold',
  hd6: 'Sora_600SemiBold',
  r: 'DMSans_400Regular',
  m: 'DMSans_500Medium',
  sb: 'DMSans_600SemiBold',
  b: 'DMSans_700Bold',
};

export const BG = ['#1D3142', '#172A3A', '#12212E'];

export const TOP = Platform.OS === 'ios' ? 58 : (StatusBar.currentHeight || 24) + 18;

// Glass recipes: gradient fill + gloss on the top half + rim colour + blur strength
export const VARIANT = {
  dark: { colors: ['rgba(44,68,88,0.62)', 'rgba(20,36,50,0.74)'], gloss: ['rgba(255,255,255,0.17)', 'rgba(255,255,255,0.03)'], border: 'rgba(220,236,246,0.24)', blur: 40 },
  mid: { colors: ['rgba(84,118,144,0.46)', 'rgba(50,78,100,0.52)'], gloss: ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.03)'], border: 'rgba(220,236,246,0.24)', blur: 30 },
  steel: { colors: ['rgba(150,190,215,0.50)', 'rgba(78,112,138,0.66)'], gloss: ['rgba(255,255,255,0.34)', 'rgba(255,255,255,0.05)'], border: 'rgba(215,235,248,0.42)', blur: 30 },
  amber: { colors: ['rgba(255,190,120,0.62)', 'rgba(228,132,40,0.80)', 'rgba(188,98,18,0.90)'], gloss: ['rgba(255,255,255,0.46)', 'rgba(255,255,255,0.08)'], border: 'rgba(255,228,195,0.6)', blur: 20 },
  light: { colors: ['rgba(215,233,245,0.80)', 'rgba(160,192,214,0.78)'], gloss: ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.12)'], border: 'rgba(255,255,255,0.6)', blur: 30 },
  flat: { colors: ['rgba(24,42,58,0.62)', 'rgba(24,42,58,0.62)'], gloss: null, border: 'rgba(220,236,246,0.12)', blur: 20 },
};
