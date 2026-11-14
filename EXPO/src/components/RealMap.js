// Real map behind the rider and driver screens (react-native-maps: Apple Maps on iPhone, Google on Android).
// It is display-only: touches go to the screen on top. What it shows depends on the current screen.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { TOP } from '../theme';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import { useApp, placeByName } from '../state';
import { C } from '../theme';
import { fetchRoute } from '../routes';

// The map sits behind the screens (they would swallow touches), so zoom is done with the buttons below.
let mapRef = null;
let refit = null; // set by the map: brings all the points back into view
let region = null;
function zoomBy(factor) {
  if (!mapRef || !region) return;
  mapRef.animateToRegion({
    ...region,
    latitudeDelta: Math.min(Math.max(region.latitudeDelta * factor, 0.0008), 2),
    longitudeDelta: Math.min(Math.max(region.longitudeDelta * factor, 0.0008), 2),
  }, 250);
}

// + / - buttons. Rendered in App.js above the screens.
export function ZoomButtons() {
  const btn = { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(62,50,57,0.92)', borderWidth: 1, borderColor: 'rgba(232,210,196,0.4)', alignItems: 'center', justifyContent: 'center' };
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', right: 16, top: TOP + 76, gap: 10 }}>
      <Pressable accessibilityLabel="Show all points" onPress={() => refit && refit()} style={btn}><Text style={{ color: C.tx, fontSize: 20, lineHeight: 24 }}>◎</Text></Pressable>
    </View>
  );
}

const RIDER = '#F7EFE7'; // rider and pickup point: light
const DRIVER = C.amber; // driver's car
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
      pins.push({ key: 'car', kind: 'car', ...me });
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
    pins.push({ key: 'pickup', kind: 'pickup', ...me });
  }
  return { pins, line, fit: pins.map((p) => ({ latitude: p.lat, longitude: p.lng })) };
}

function Pin({ kind }) {
  if (kind === 'drop') {
    return <View style={{ width: 20, height: 20, borderRadius: 5, backgroundColor: '#fff', borderWidth: 4, borderColor: C.bgs }} />;
  }
  if (kind === 'car') {
    return (
      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: DRIVER, borderWidth: 3, borderColor: '#F7EFE7', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.bgs }} />
      </View>
    );
  }
  // the rider / pickup point
  return <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: RIDER, borderWidth: 4, borderColor: C.bgs }} />;
}

export default function RealMap() {
  const { s } = useApp();
  const ref = useRef(null);
  const [path, setPath] = useState(null); // route along the roads
  const sc = useMemo(() => scene(s), [s.screen, s.role, s.fix, s.ride, s.req, s.dest, s.stage]);
  const first = sc.fit[0] || { latitude: s.fix.lat, longitude: s.fix.lng };

  // Fetch the road route (endpoints rounded, so GPS jitter doesn't refetch every tick).
  const a = sc.line && sc.line[0];
  const b = sc.line && sc.line[1];
  const lineKey = a && b ? [a.lat, a.lng, b.lat, b.lng].map((n) => n.toFixed(3)).join(',') : '';
  useEffect(() => {
    if (!a || !b) { setPath(null); return undefined; }
    let alive = true;
    fetchRoute(a, b).then((p) => { if (alive) setPath(p); });
    return () => { alive = false; };
  }, [lineKey]);

  // Re-frame the map when the points change (rounded, so tiny GPS jitter doesn't keep moving it).
  const key = sc.fit.map((p) => `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`).join('|') + s.screen;
  const frame = () => {
    const m = ref.current;
    if (!m || !sc.fit.length) return;
    if (sc.fit.length === 1) {
      // One point: centre slightly south of it, so the pin sits above the bottom sheet.
      m.animateCamera({ center: { latitude: sc.fit[0].latitude - 0.0022, longitude: sc.fit[0].longitude }, zoom: 15 }, { duration: 500 });
    } else {
      m.fitToCoordinates(path && path.length > 1 ? path : sc.fit, { edgePadding: PAD, animated: true });
    }
  };
  refit = frame; // the ◎ button uses this to bring everything back into view
  useEffect(frame, [key, lineKey, !!path]);

  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
      <MapView
        ref={(m) => { ref.current = m; mapRef = m; }}
        onRegionChangeComplete={(r) => { region = r; }}
        style={{ flex: 1 }}
        initialRegion={{ latitude: first.latitude - 0.0022, longitude: first.longitude, latitudeDelta: 0.015, longitudeDelta: 0.015 }}
        userInterfaceStyle="dark"
        toolbarEnabled={false}
        showsCompass={false}
        showsPointsOfInterest={false}
        scrollEnabled
        zoomEnabled
        rotateEnabled={false}
        pitchEnabled={false}
      >
        {/* Dark CARTO street tiles replace Apple's map; the mauve layer below tints them into the palette */}
        <UrlTile urlTemplate="https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png" maximumZ={19} shouldReplaceMapContent zIndex={-1} />
        {sc.line ? (
          <>
            {/* white casing under the route so it stays readable on the dark map */}
            <Polyline coordinates={path || sc.line.map((p) => ({ latitude: p.lat, longitude: p.lng }))} strokeColor="rgba(247,239,231,0.30)" strokeWidth={14} lineCap="round" lineJoin="round" />
            <Polyline coordinates={path || sc.line.map((p) => ({ latitude: p.lat, longitude: p.lng }))} strokeColor="#F7EFE7" strokeWidth={5} lineCap="round" lineJoin="round" />
          </>
        ) : null}
        {sc.pins.map((p) => (
          <Marker key={p.key} coordinate={{ latitude: p.lat, longitude: p.lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges>
            <Pin kind={p.kind} />
          </Marker>
        ))}
      </MapView>
      {/* Dusty Teal tint: Apple Maps has no custom style, so the map is shaded teal with a see-through layer that lets touches pass */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(107,85,96,0.38)' }} />
    </View>
  );
}
