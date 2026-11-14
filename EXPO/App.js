import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { Sora_600SemiBold, Sora_700Bold } from '@expo-google-fonts/sora';

import { AppProvider, useApp } from './src/state';
import { BG } from './src/theme';
import Wallpaper, { Vignette } from './src/components/Wallpaper';
import { BlurView } from 'expo-blur';
import { API_URL } from './src/config';
import RealMap, { ZoomButtons } from './src/components/RealMap';
import Nav from './src/components/Nav';
import { FadeIn } from './src/components/UI';
import { Splash, Login, Signup, ForgotPassword, ResetPassword } from './src/screens/Entry';
import { RiderHome, Destination, RideOptions, Searching, DriverEnRoute, Trip, TripDone } from './src/screens/Rider';
import { Activity, Earnings, Profile } from './src/screens/Lists';
import Pay from './src/screens/Pay';
import { DriverHome, DriverRequest, DriverTrip, DriverDone } from './src/screens/Driver';

const SCREENS = {
  splash: Splash, login: Login, signup: Signup, forgot: ForgotPassword, reset: ResetPassword,
  rHome: RiderHome, rDest: Destination, rRide: RideOptions, rSearch: Searching, rDriver: DriverEnRoute, rTrip: Trip, rDone: TripDone, rPay: Pay,
  rActivity: Activity, profile: Profile,
  dHome: DriverHome, dRequest: DriverRequest, dTrip: DriverTrip, dDone: DriverDone, dEarn: Earnings,
};
const MAP_SCREENS = ['rHome', 'rRide', 'rSearch', 'rDriver', 'rTrip', 'dHome', 'dRequest', 'dTrip'];
const AUTH_SCREENS = ['login', 'signup', 'forgot', 'reset']; // wallpaper is blurred behind these
const NAV_SCREENS = ['rHome', 'rActivity', 'profile', 'dHome', 'dEarn'];

function mapFlags(s) {
  const sc = s.screen;
  return {
    routeMain: sc === 'rRide' || sc === 'rTrip' || sc === 'rSearch' || (sc === 'dTrip' && s.stage === 2),
    routeDrv: sc === 'rDriver' || (sc === 'dTrip' && s.stage === 0),
    carDrv: sc === 'rDriver' || (sc === 'dTrip' && s.stage === 0),
    carMain: sc === 'rTrip' || (sc === 'dTrip' && s.stage === 2),
    nearby: sc === 'rHome',
    hot: sc === 'dHome' || sc === 'dRequest',
    here: ['rHome', 'rRide', 'dHome', 'rSearch', 'dRequest'].includes(sc),
    radar: sc === 'rSearch',
  };
}

function Root() {
  const { s } = useApp();
  const Screen = SCREENS[s.screen] || Splash;
  return (
    <LinearGradient colors={BG} style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Wallpaper />
      {s.screen !== 'splash' ? <View pointerEvents="none" style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' }} /> : null}
      {AUTH_SCREENS.includes(s.screen) ? <BlurView intensity={30} tint="dark" pointerEvents="none" style={StyleSheet.absoluteFill} /> : null}
      {MAP_SCREENS.includes(s.screen) ? <RealMap /> : null}
      <FadeIn key={s.screen}>
        <Screen />
      </FadeIn>
      {MAP_SCREENS.includes(s.screen) ? <ZoomButtons /> : null}
      {NAV_SCREENS.includes(s.screen) ? <Nav /> : null}
      <Vignette />
    </LinearGradient>
  );
}

export default function App() {
  // Temporary connectivity check; remove once real API calls are wired in.
  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((res) => res.json())
      .then((data) => console.log('Backend says:', data))
      .catch((err) => console.log('Backend connection error:', err.message));
  }, []);

  const [loaded] = useFonts({ DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold, Sora_600SemiBold, Sora_700Bold });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: '#0B141C' }} />;
  return (
    <AppProvider>
      <Root />
    </AppProvider>
  );
}
