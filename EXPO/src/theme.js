// Hopz design tokens: macOS Big Sur look. Blue-to-violet wallpaper with pink/orange waves, frosted glass panels,
// white text, white-glass buttons and glowing glass selections.
import { Platform, StatusBar } from 'react-native';

export const C = {
  tx: '#FFFFFF', // headings and main text
  tx2: '#D6DEFF', // secondary text and labels
  amber: '#FFFFFF', // main accent (kept the old name): rings, prices, links
  amberText: '#1B3FC4', // blue text on the white-glass buttons
  steel: '#A9C0FF',
  steelText: '#FFFFFF',
  gold: '#FFD2A0',
  bgs: '#2B52DD',
  road: '#FFFFFF',
  blk: '#5C7DEB',
  water: '#1E3DB0',
  park: '#2F55D6',
  rim: 'rgba(255,255,255,0.38)',
  inset: 'rgba(255,255,255,0.16)',
  line: 'rgba(255,255,255,0.28)',
  soft: 'rgba(255,255,255,0.18)',
  err: '#FFC2B8',
  splash: '#2B52DD',
};

export const F = {
  hd: 'Sora_700Bold',
  hd6: 'Sora_600SemiBold',
  r: 'DMSans_400Regular',
  m: 'DMSans_500Medium',
  sb: 'DMSans_600SemiBold',
  b: 'DMSans_700Bold',
};

export const BG = ['#1F6BEA', '#2B52DD', '#4B3FD8', '#6A3CD2'];

export const TOP = Platform.OS === 'ios' ? 58 : (StatusBar.currentHeight || 24) + 18;

// Glass recipes: gradient fill + gloss on the top half + rim colour + blur strength + blur tint
export const VARIANT = {
  // frosted glass panels
  dark: { colors: ['rgba(255,255,255,0.26)', 'rgba(255,255,255,0.10)'], gloss: ['rgba(255,255,255,0.26)', 'rgba(255,255,255,0.02)'], border: 'rgba(255,255,255,0.38)', blur: 30, tint: 'light' },
  mid: { colors: ['rgba(255,255,255,0.24)', 'rgba(255,255,255,0.10)'], gloss: ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.02)'], border: 'rgba(255,255,255,0.36)', blur: 30, tint: 'light' },
  flat: { colors: ['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.09)'], gloss: null, border: 'rgba(255,255,255,0.30)', blur: 25, tint: 'light' },
  steel: { colors: ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.12)'], gloss: ['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.02)'], border: 'rgba(255,255,255,0.42)', blur: 25, tint: 'light' },
  light: { colors: ['rgba(255,255,255,0.34)', 'rgba(255,255,255,0.18)'], gloss: ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.03)'], border: 'rgba(255,255,255,0.5)', blur: 30, tint: 'light' },
  // selected: glowing liquid glass
  sel: { colors: ['rgba(255,255,255,0.5)', 'rgba(255,255,255,0.22)'], gloss: ['rgba(255,255,255,0.6)', 'rgba(255,255,255,0.05)'], border: '#FFFFFF', bw: 1.5, blur: 30, tint: 'light' },
  // main buttons and active tabs: white glass
  amber: { colors: ['#FFFFFF', '#E4ECFF'], gloss: ['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.05)'], border: '#FFFFFF', bw: 1, blur: 20, tint: 'light' },
  // coloured glass tints taken from the wallpaper: they separate the menu blocks
  navy: { colors: ['rgba(34,48,160,0.66)', 'rgba(18,28,115,0.58)'], gloss: ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.02)'], border: 'rgba(170,195,255,0.5)', blur: 30, tint: 'dark' },
  blue: { colors: ['rgba(125,175,255,0.62)', 'rgba(60,110,240,0.46)'], gloss: ['rgba(255,255,255,0.32)', 'rgba(255,255,255,0.03)'], border: 'rgba(200,222,255,0.8)', blur: 25, tint: 'light' },
  pink: { colors: ['rgba(255,125,175,0.62)', 'rgba(232,64,143,0.44)'], gloss: ['rgba(255,255,255,0.32)', 'rgba(255,255,255,0.03)'], border: 'rgba(255,205,225,0.8)', blur: 25, tint: 'light' },
  violet: { colors: ['rgba(175,135,255,0.62)', 'rgba(112,72,222,0.46)'], gloss: ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.03)'], border: 'rgba(220,200,255,0.8)', blur: 25, tint: 'light' },
  peach: { colors: ['rgba(255,190,115,0.64)', 'rgba(255,120,80,0.44)'], gloss: ['rgba(255,255,255,0.34)', 'rgba(255,255,255,0.03)'], border: 'rgba(255,222,180,0.85)', blur: 25, tint: 'light' },
};
