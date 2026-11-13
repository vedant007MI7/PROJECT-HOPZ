import React, { useEffect, useRef, useMemo } from 'react';
import { View, Animated, Easing, Dimensions } from 'react-native';
import Svg, { Rect, Path, Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../theme';

const W = Dimensions.get('window').width;
export const S = W / 390;               // the map is drawn on a 390 x 600 grid
export const MAP_H = 600 * S;

export const ROUTE_MAIN = [[120, 360], [120, 240], [240, 240], [240, 120]];
export const ROUTE_DRV = [[360, 150], [360, 360], [120, 360]];
const toD = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ');

const BLOCKS =
  'M15 15h90v90h-90zM135 15h90v90h-90zM255 15h90v90h-90zM375 15h90v90h-90zM15 135h90v90h-90zM135 135h90v90h-90zM255 135h90v90h-90zM375 135h90v90h-90zM15 255h90v90h-90zM135 255h90v90h-90zM255 255h90v90h-90zM375 255h90v90h-90zM15 375h90v90h-90zM135 375h90v90h-90zM255 375h90v90h-90zM375 375h90v90h-90zM15 495h90v90h-90zM135 495h90v90h-90zM255 495h90v90h-90z';

// ---------- pulsing ring ----------
export function Ripple({ x, y, r = 14, color = C.amber, delay = 0, to = 2.6, duration = 2000 }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.timing(v, { toValue: 1, duration, delay, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    a.start();
    return () => a.stop();
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: r, borderWidth: 2, borderColor: color,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, to] }) }],
      }}
    />
  );
}

// ---------- move along a polyline (grid units), looping or once ----------
function useAlong(points, duration, loop) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    v.setValue(0);
    const t = Animated.timing(v, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true });
    const run = loop ? Animated.loop(t) : t;
    run.start();
    return () => run.stop();
  }, []);
  return useMemo(() => {
    const lens = [];
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      const l = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
      lens.push(l);
      total += l;
    }
    const tIn = [0], xs = [points[0][0] * S], ys = [points[0][1] * S];
    const rIn = [], rs = [];
    let acc = 0;
    for (let i = 1; i < points.length; i++) {
      acc += lens[i - 1];
      const t = acc / total;
      const ang = (Math.atan2(points[i][1] - points[i - 1][1], points[i][0] - points[i - 1][0]) * 180) / Math.PI;
      rIn.push(i === 1 ? 0 : (acc - lens[i - 1]) / total + 0.0001);
      rs.push(ang + 'deg');
      rIn.push(t);
      rs.push(ang + 'deg');
      tIn.push(t);
      xs.push(points[i][0] * S);
      ys.push(points[i][1] * S);
    }
    return {
      x: v.interpolate({ inputRange: tIn, outputRange: xs }),
      y: v.interpolate({ inputRange: tIn, outputRange: ys }),
      rot: v.interpolate({ inputRange: rIn, outputRange: rs }),
    };
  }, []);
}

// ---------- 3D rounded-rectangle car ----------
const PAL = {
  A: { side: '#8F4E14', top: ['#FFE0BC', '#F5AE66', '#D98A3D'], roof: ['#FFEBD3', '#EDA55C'], rear: 'rgba(74,42,12,0.72)', lamp: '#FFF6E5' },
  B: { side: '#2C475A', top: ['#E6F2FA', '#9DBFD6', '#6A8FA8'], roof: ['#F4FAFE', '#A9C7DB'], rear: 'rgba(27,47,64,0.7)', lamp: '#FFFFFF' },
};

export function Car({ points, duration, loop = false, kind = 'A', scale = 1, pulse }) {
  const a = useAlong(points, duration, loop);
  const p = PAL[kind];
  const amber = kind === 'A';
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, transform: [{ translateX: a.x }, { translateY: a.y }, { scale }] }}>
      {pulse ? <Ripple x={0} y={0} r={12} delay={0} to={2.4} /> : null}
      {/* ground shadow stays upright */}
      <View style={{ position: 'absolute', left: -17, top: 5, width: 34, height: 11, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.38)' }} />
      <Animated.View style={{ position: 'absolute', left: -16, top: -10, width: 32, height: 20, transform: [{ rotate: a.rot }] }}>
        <View style={{ position: 'absolute', left: 0, top: 3, width: 32, height: 17, borderRadius: 7, backgroundColor: p.side }} />
        <LinearGradient
          colors={p.top}
          style={[
            { position: 'absolute', left: 0, top: 0, width: 32, height: 17, borderRadius: 7, borderWidth: 0.8, borderColor: 'rgba(255,255,255,0.65)' },
            amber && { shadowColor: C.amber, shadowOpacity: 0.8, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
          ]}
        />
        <View style={{ position: 'absolute', left: 3.4, top: 3.1, width: 4.2, height: 10.8, borderRadius: 2, backgroundColor: p.rear }} />
        <LinearGradient colors={p.roof} style={{ position: 'absolute', left: 9, top: 2.1, width: 10, height: 12.8, borderRadius: 3.2 }} />
        <LinearGradient colors={['#1B2F40', '#3E617B', '#6E93AD']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', left: 20.4, top: 3.3, width: 6.2, height: 10.4, borderRadius: 2.4 }} />
        <View style={{ position: 'absolute', left: 28.45, top: 2.55, width: 2.3, height: 2.3, borderRadius: 1.2, backgroundColor: p.lamp }} />
        <View style={{ position: 'absolute', left: 28.45, top: 12.15, width: 2.3, height: 2.3, borderRadius: 1.2, backgroundColor: p.lamp }} />
      </Animated.View>
    </Animated.View>
  );
}

// ---------- the map ----------
// flags: routeMain, routeDrv, here, radar, hot, nearby, carDrv, carMain
export default function HopzMap({ flags = {} }) {
  const f = flags;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: W, height: MAP_H, overflow: 'hidden' }}>
      <Svg width={W} height={MAP_H} viewBox="0 0 390 600">
        <Defs>
          <RadialGradient id="heat" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={C.steel} stopOpacity="0.5" />
            <Stop offset="1" stopColor={C.steel} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="390" height="600" fill={C.road} />
        <Path d={BLOCKS} fill={C.blk} stroke={C.blk} strokeWidth="14" strokeLinejoin="round" />
        <Path d="M-20 70 C 60 40, 120 90, 200 60 S 340 10, 420 50 L420 -10 L-20 -10Z" fill={C.water} />
        <Path d="M-10 520 C 90 430, 170 560, 270 470 S 380 400, 420 430" fill="none" stroke={C.water} strokeWidth="26" strokeLinecap="round" opacity="0.9" />
        <Rect x="143" y="143" width="74" height="74" rx="14" fill={C.park} />
        <Rect x="263" y="263" width="74" height="74" rx="14" fill={C.park} />

        {f.hot ? (
          <>
            <Circle cx="240" cy="240" r="70" fill="url(#heat)" />
            <Circle cx="120" cy="120" r="55" fill="url(#heat)" />
            <Circle cx="360" cy="240" r="46" fill="url(#heat)" />
          </>
        ) : null}

        {f.routeMain ? (
          <>
            <Path d={toD(ROUTE_MAIN)} fill="none" stroke={C.amber} strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" opacity="0.22" />
            <Path d={toD(ROUTE_MAIN)} fill="none" stroke={C.amber} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            <Path d={toD(ROUTE_MAIN)} fill="none" stroke={C.bgs} strokeWidth="2" strokeLinecap="round" strokeDasharray="6 18" opacity="0.9" />
            <Circle cx="240" cy="120" r="9" fill={C.steel} stroke={C.bgs} strokeWidth="3" />
          </>
        ) : null}
        {f.routeDrv ? (
          <>
            <Path d={toD(ROUTE_DRV)} fill="none" stroke={C.amber} strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" opacity="0.22" />
            <Path d={toD(ROUTE_DRV)} fill="none" stroke={C.amber} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            <Path d={toD(ROUTE_DRV)} fill="none" stroke={C.bgs} strokeWidth="2" strokeLinecap="round" strokeDasharray="6 18" opacity="0.9" />
          </>
        ) : null}
        {f.here ? <Circle cx="120" cy="360" r="10" fill={C.amber} stroke={C.bgs} strokeWidth="4" /> : null}
      </Svg>

      {f.here ? <Ripple x={120 * S} y={360 * S} r={16 * S} /> : null}
      {f.routeMain ? <Ripple x={240 * S} y={120 * S} r={12 * S} color={C.steel} delay={600} /> : null}
      {f.radar ? (
        <>
          <Ripple x={120 * S} y={360 * S} r={30 * S} to={3} duration={2200} delay={0} />
          <Ripple x={120 * S} y={360 * S} r={30 * S} to={3} duration={2200} delay={700} />
          <Ripple x={120 * S} y={360 * S} r={30 * S} to={3} duration={2200} delay={1400} />
        </>
      ) : null}

      {f.carDrv ? <Car points={ROUTE_DRV} duration={7000} kind="A" pulse /> : null}
      {f.carMain ? <Car points={ROUTE_MAIN} duration={9000} kind="A" pulse /> : null}
      {f.nearby ? (
        <>
          <Car points={[[-30, 120], [420, 120]]} duration={16000} loop kind="B" scale={0.78} />
          <Car points={[[240, -30], [240, 630]]} duration={13000} loop kind="B" scale={0.78} />
          <Car points={[[420, 360], [-30, 360]]} duration={19000} loop kind="B" scale={0.78} />
        </>
      ) : null}

      {/* fade into the screen background */}
      <LinearGradient colors={['rgba(23,42,58,0)', '#172A3A']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: MAP_H * 0.3 }} />
    </View>
  );
}
