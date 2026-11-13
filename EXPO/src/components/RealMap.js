// Real map behind the rider and driver screens (react-native-maps: Apple Maps on iPhone, Google on Android).
// It is display-only: touches go to the screen on top. What it shows depends on the current screen.
import React, { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useApp, placeByName } from '../state';
import { C } from '../theme';

const PAD = { top: 150, bottom: 420, left: 60, right: 60 }; // keep pins clear of the sheet at the bottom

const pt = (p) => (p && typeof p.lat === 'number' && typeof p.lng === 'number' ? { lat: p.lat, lng: p.lng } : null);

// What to draw for the current screen: pins, a line, and which points to fit on screen.
function scene(s) {
  const sc = s.screen;
  const ride = s.ride;
  const me = pt(s.fix);
  const pins = [];
  let line = null;

  if (s.role === 'driver') {
    if (sc === 'dRequest' && s.req) {
      const pickup = pt(s.req.pickup);
      if (me) pins.push({ key: 'car', kind: 'car', ...me });
      if (pickup) pins.push({ key: 'pickup', kind: 'pickup', ...pickup });
      if (me && pickup) line = [me, pickup];
    } else if (sc === 'dTrip' && ride) {
      const pickup = pt(ride.pickup);
      const drop = pt(ride.drop);
      if (me) pins.push({ key: 'car', kind: 'car', ...me });
      if (s.stage >= 2) {
        if (drop) pins.push({ key: 'drop', kind: 'drop', ...drop });
        if (me && drop) line = [me, drop];
      } else {
        if (pickup) pins.push({ key: 'pickup', kind: 'pickup', ...pickup });
        if (me && pickup) line = [me, pickup];
      }
    } else if (me) {
      pins.push({ key: 'me', kind: 'me', ...me });
    }
  } else if (sc === 'rRide') {
    const drop = pt(placeByName(s.dest));
    if (me) pins.push({ key: 'pickup', kind: 'pickup', ...me });
    if (drop) pins.push({ key: 'drop', kind: 'drop', ...drop });
    if (me && drop) line = [me, drop];
  } else if (sc === 'rSearch' && ride) {
    const pickup = pt(ride.pickup);
    const drop = pt(ride.drop);
    if (pickup) pins.push({ key: 'pickup', kind: 'pickup', ...pickup });
    if (drop) pins.push({ key: 'drop', kind: 'drop', ...drop });
    if (pickup && drop) line = [pickup, drop];
  } else if ((sc === 'rDriver' || sc === 'rTrip') && ride) {
    const pickup = pt(ride.pickup);
    const drop = pt(ride.drop);
    const car = pt(ride.driver?.location);
    const target = sc === 'rTrip' ? drop : pickup;
    if (target) pins.push({ key: sc === 'rTrip' ? 'drop' : 'pickup', kind: sc === 'rTrip' ? 'drop' : 'pickup', ...target });
    if (car) pins.push({ key: 'car', kind: 'car', ...car });
    if (car && target) line = [car, target];
  } else if (me) {
    pins.push({ key: 'me', kind: 'me', ...me });
  }
  return { pins, line, fit: pins.map((p) => ({ latitude: p.lat, longitude: p.lng })) };
}

function Pin({ kind }) {
  if (kind === 'drop') {
    return <View style={{ width: 18, height: 18, borderRadius: 5, backgroundColor: C.steel, borderWidth: 3, borderColor: C.bgs }} />;
  }
  if (kind === 'car') {
    return (
      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.amber, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.bgs }} />
      </View>
    );
  }
  // 'me' and 'pickup'
  return <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: C.amber, borderWidth: 4, borderColor: C.bgs }} />;
}

export default function RealMap() {
  const { s } = useApp();
  const ref = useRef(null);
  const sc = useMemo(() => scene(s), [s.screen, s.role, s.fix, s.ride, s.req, s.dest, s.stage]);
  const first = sc.fit[0] || { latitude: s.fix.lat, longitude: s.fix.lng };

  // Re-frame the map when the points change (rounded, so tiny GPS jitter doesn't keep moving it).
  const key = sc.fit.map((p) => `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`).join('|') + s.screen;
  useEffect(() => {
    const m = ref.current;
    if (!m || !sc.fit.length) return;
    if (sc.fit.length === 1) {
      // One point: centre slightly south of it, so the pin sits above the bottom sheet.
      m.animateCamera({ center: { latitude: sc.fit[0].latitude - 0.0022, longitude: sc.fit[0].longitude }, zoom: 15 }, { duration: 500 });
    } else {
      m.fitToCoordinates(sc.fit, { edgePadding: PAD, animated: true });
    }
  }, [key]);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
      <MapView
        ref={ref}
        style={{ flex: 1 }}
        initialRegion={{ latitude: first.latitude - 0.0022, longitude: first.longitude, latitudeDelta: 0.015, longitudeDelta: 0.015 }}
        userInterfaceStyle="dark"
        toolbarEnabled={false}
        showsCompass={false}
        showsPointsOfInterest={false}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        {sc.line ? (
          <Polyline coordinates={sc.line.map((p) => ({ latitude: p.lat, longitude: p.lng }))} strokeColor={C.amber} strokeWidth={5} lineDashPattern={[1, 10]} lineCap="round" />
        ) : null}
        {sc.pins.map((p) => (
          <Marker key={p.key} coordinate={{ latitude: p.lat, longitude: p.lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges>
            <Pin kind={p.kind} />
          </Marker>
        ))}
      </MapView>
    </View>
  );
}
