import React, { useEffect } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { Sora_600SemiBold, Sora_700Bold } from '@expo-google-fonts/sora';

import { AppProvider, useApp } from './src/state';
import { BG } from './src/theme';
import { API_URL } from './src/config';
import HopzMap from './src/components/Map';
import Nav from './src/components/Nav';
import { FadeIn } from './src/components/UI';
import { Splash, Login, Signup } from './src/screens/Entry';
import { RiderHome, Destination, RideOptions, Searching, DriverEnRoute, Trip, TripDone } from './src/screens/Rider';
import { Activity, Earnings, Profile } from './src/screens/Lists';
import { DriverHome, DriverRequest, DriverTrip } from './src/screens/Driver';

const SCREENS = {
  splash: Splash, login: Login, signup: Signup,
  rHome: RiderHome, rDest: Destination, rRide: RideOptions, rSearch: Searching, rDriver: DriverEnRoute, rTrip: Trip, rDone: TripDone,
  rActivity: Activity, profile: Profile,
  dHome: DriverHome, dRequest: DriverRequest, dTrip: DriverTrip, dEarn: Earnings,
};
const MAP_SCREENS = ['rHome', 'rRide', 'rSearch', 'rDriver', 'rTrip', 'dHome', 'dRequest', 'dTrip'];
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
      {MAP_SCREENS.includes(s.screen) ? <HopzMap key={s.screen === 'dTrip' ? `dt${s.stage}` : 'map'} flags={mapFlags(s)} /> : null}
      <FadeIn key={s.screen}>
        <Screen />
      </FadeIn>
      {NAV_SCREENS.includes(s.screen) ? <Nav /> : null}
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
  if (!loaded) return <View style={{ flex: 1, backgroundColor: '#172A3A' }} />;
  return (
    <AppProvider>
      <Root />
    </AppProvider>
  );
}
