// Hopz design tokens: the PC desktop theme. Wallpaper waves, translucent black glass, white text,
// white glow for common selections, green glow for chosen / confirm, red glow for cancel.
import { Platform, StatusBar } from 'react-native';

export const C = {
  tx: '#FFFFFF', // headings and main text
  tx2: '#C9C9CF', // secondary text and labels
  amber: '#FFFFFF', // accent (kept the old name): white
  amberText: '#FFFFFF', // text on glass buttons
  steel: '#46E68C', // green accent: online dot, rings, bars
  steelText: '#FFFFFF',
  gold: '#FFFFFF',
  bgs: '#0B141C',
  road: '#FFFFFF',
  blk: '#101418',
  water: '#0A1018',
  park: '#12181E',
  rim: 'rgba(255,255,255,0.28)',
  inset: 'rgba(255,255,255,0.07)',
  line: 'rgba(255,255,255,0.16)',
  soft: 'rgba(255,255,255,0.09)',
  err: '#FF6B6B',
  splash: '#0B141C',
  green: '#46E68C',
  red: '#FF4646',
};

export const F = {
  hd: 'Sora_700Bold',
  hd6: 'Sora_600SemiBold',
  r: 'DMSans_400Regular',
  m: 'DMSans_500Medium',
  sb: 'DMSans_600SemiBold',
  b: 'DMSans_700Bold',
};

export const BG = ['#0B141C', '#101418', '#1A0E0C'];

export const TOP = Platform.OS === 'ios' ? 58 : (StatusBar.currentHeight || 24) + 18;

// Glass recipes: gradient fill + gloss on the top half + rim colour + blur strength + blur tint
// Glass recipes: black translucent body + faint gloss + rim colour + blur. `glow` is the colour of the outer glow.
const BODY = ['rgba(28,28,32,0.56)', 'rgba(8,8,10,0.5)'];
const GLOSS = ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.01)'];

export const VARIANT = {
  dark: { colors: BODY, gloss: GLOSS, border: 'rgba(255,255,255,0.14)', blur: 35, tint: 'dark' },
  mid: { colors: ['rgba(34,34,38,0.52)', 'rgba(12,12,14,0.46)'], gloss: GLOSS, border: 'rgba(255,255,255,0.14)', blur: 35, tint: 'dark' },
  flat: { colors: ['rgba(30,30,34,0.48)', 'rgba(10,10,12,0.44)'], gloss: null, border: 'rgba(255,255,255,0.11)', blur: 30, tint: 'dark' },
  steel: { colors: ['rgba(46,46,50,0.52)', 'rgba(20,20,22,0.48)'], gloss: GLOSS, border: 'rgba(255,255,255,0.18)', blur: 30, tint: 'dark' },
  light: { colors: ['rgba(50,50,54,0.48)', 'rgba(22,22,24,0.44)'], gloss: GLOSS, border: 'rgba(255,255,255,0.2)', blur: 30, tint: 'dark' },
  // chosen option: green glow
  sel: { colors: BODY, gloss: GLOSS, border: '#46E68C', bw: 1.5, blur: 35, tint: 'dark' },
  green: { colors: BODY, gloss: GLOSS, border: '#46E68C', bw: 1.5, blur: 35, tint: 'dark' },
  // cancel / decline: red glow
  red: { colors: BODY, gloss: GLOSS, border: '#FF4646', bw: 1.5, blur: 35, tint: 'dark' },
  // common selection (tabs, toggles, chips, avatar): white glow
  amber: { colors: ['rgba(60,60,64,0.54)', 'rgba(24,24,28,0.5)'], gloss: ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.02)'], border: 'rgba(255,255,255,0.9)', bw: 1.5, blur: 35, tint: 'dark', glow: '#FFFFFF', inner: 'rgba(255,255,255,0.16)' },
};
// big menu windows (bottom sheet, nav bar): dark liquid glass with a shiny sheen and only a faint (about 8%) white glow
VARIANT.panel = { colors: ['rgba(30,30,34,0.52)', 'rgba(8,8,10,0.46)'], gloss: ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.01)'], border: 'rgba(255,255,255,0.3)', blur: 40, tint: 'dark', glow: '#FFFFFF', glowOpacity: 0.08, glowRadius: 22, shine: true };
// bottom menu bar: more see-through than the buttons, same shiny glass
VARIANT.bar = { colors: ['rgba(30,30,34,0.3)', 'rgba(8,8,10,0.24)'], gloss: ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.01)'], border: 'rgba(255,255,255,0.26)', blur: 30, tint: 'dark', glow: '#FFFFFF', glowOpacity: 0.08, glowRadius: 22, shine: true };
// old coloured names point to the plain black glass
VARIANT.navy = VARIANT.dark;
VARIANT.blue = VARIANT.mid;
VARIANT.pink = VARIANT.mid;
VARIANT.violet = VARIANT.mid;
VARIANT.peach = VARIANT.mid;
VARIANT.white = VARIANT.amber;
