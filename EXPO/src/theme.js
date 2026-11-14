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
// Soft colour glow taken from the wallpaper (blue, violet, pink, orange), laid under the white glass
const GLOW = ['rgba(90,150,255,0.34)', 'rgba(165,110,255,0.30)', 'rgba(255,95,155,0.30)', 'rgba(255,165,85,0.30)'];

export const VARIANT = {
  // frosted glass panels
  dark: { colors: ['rgba(255,255,255,0.26)', 'rgba(255,255,255,0.10)'], gloss: ['rgba(255,255,255,0.26)', 'rgba(255,255,255,0.02)'], border: 'rgba(255,255,255,0.38)', blur: 30, tint: 'light', grad: GLOW },
  mid: { colors: ['rgba(255,255,255,0.24)', 'rgba(255,255,255,0.10)'], gloss: ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.02)'], border: 'rgba(255,255,255,0.36)', blur: 30, tint: 'light', grad: GLOW },
  flat: { colors: ['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.09)'], gloss: null, border: 'rgba(255,255,255,0.30)', blur: 25, tint: 'light' },
  steel: { colors: ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.12)'], gloss: ['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.02)'], border: 'rgba(255,255,255,0.42)', blur: 25, tint: 'light', grad: GLOW },
  light: { colors: ['rgba(255,255,255,0.34)', 'rgba(255,255,255,0.18)'], gloss: ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.03)'], border: 'rgba(255,255,255,0.5)', blur: 30, tint: 'light', grad: GLOW },
  // selected: glowing liquid glass
  sel: { colors: ['rgba(255,255,255,0.5)', 'rgba(255,255,255,0.22)'], gloss: ['rgba(255,255,255,0.6)', 'rgba(255,255,255,0.05)'], border: '#FFFFFF', bw: 1.5, blur: 30, tint: 'light' },
  // main buttons and active tabs: white glass
  amber: { colors: ['#FFFFFF', '#E4ECFF'], gloss: ['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.05)'], border: '#FFFFFF', bw: 1, blur: 20, tint: 'light' },
  // aliases kept so older screens still work: all use the white-led glow glass
};
// the old coloured names now point to the same white-led glow glass
VARIANT.navy = VARIANT.dark;
VARIANT.blue = VARIANT.mid;
VARIANT.pink = VARIANT.mid;
VARIANT.violet = VARIANT.mid;
VARIANT.peach = VARIANT.mid;
