import React from 'react';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';
import { C } from '../theme';

const P = {
  home: <Path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />,
  clock: (
    <G>
      <Circle cx="12" cy="12" r="8.5" />
      <Path d="M12 7.5V12l3 2" />
    </G>
  ),
  user: (
    <G>
      <Circle cx="12" cy="8.5" r="3.6" />
      <Path d="M5 20c.8-3.6 3.6-5.4 7-5.4s6.2 1.8 7 5.4" />
    </G>
  ),
  search: (
    <G>
      <Circle cx="11" cy="11" r="6.5" />
      <Path d="M16 16l4 4" />
    </G>
  ),
  pin: (
    <G>
      <Path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 0 0-13 0c0 5.4 6.5 11 6.5 11z" />
      <Circle cx="12" cy="10" r="2.4" />
    </G>
  ),
  back: <Path d="M15 5l-7 7 7 7" />,
  phone: <Path d="M6.5 4h3l1.5 4-2 1.5a11 11 0 0 0 5.5 5.5L16 13l4 1.5v3a2 2 0 0 1-2 2A14 14 0 0 1 4.5 6a2 2 0 0 1 2-2z" />,
  chat: <Path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V16A2.5 2.5 0 0 1 4 13.5z" />,
  check: <Path d="M5 12.5l4.5 4.5L19 7.5" />,
  power: (
    <G>
      <Path d="M12 3v8" />
      <Path d="M6.5 6.8a8 8 0 1 0 11 0" />
    </G>
  ),
  wallet: (
    <G>
      <Rect x="3.5" y="6" width="17" height="13" rx="3" />
      <Path d="M3.5 10h17" />
      <Circle cx="16.5" cy="14.5" r="1" />
    </G>
  ),
  bell: (
    <G>
      <Path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
      <Path d="M10 20.5a2 2 0 0 0 4 0" />
    </G>
  ),
  shield: <Path d="M12 3l7 3v5.5c0 4.5-3 7.8-7 9.5-4-1.7-7-5-7-9.5V6z" />,
  share: <Path d="M7 17L17 7M9 7h8v8" />,
  chevron: <Path d="M9 5l7 7-7 7" />,
  edit: <Path d="M4 20h4L19 9l-4-4L4 16z" />,
  card: (
    <G>
      <Rect x="3.5" y="6" width="17" height="13" rx="3" />
      <Path d="M3.5 10h17" />
    </G>
  ),
  auto: (
    <G>
      <Path d="M4 16V9l3-3h8l5 5v5" />
      <Path d="M3.5 16h17" />
      <Circle cx="8" cy="17.5" r="1.8" />
      <Circle cx="17" cy="17.5" r="1.8" />
    </G>
  ),
  car: (
    <G>
      <Path d="M5 15V12l1.7-4.6A2 2 0 0 1 8.6 6h6.8a2 2 0 0 1 1.9 1.4L19 12v3" />
      <Path d="M3.5 15h17v2.5h-17z" />
      <Circle cx="7.5" cy="17.8" r="1.5" />
      <Circle cx="16.5" cy="17.8" r="1.5" />
    </G>
  ),
};

export default function Icon({ name, size = 22, color = C.tx, sw = 1.8 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {P[name]}
    </Svg>
  );
}

export function Star({ size = 36, filled, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} strokeWidth={1.5} strokeLinejoin="round" fill={filled ? color : 'none'}>
      <Path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.9z" />
    </Svg>
  );
}
