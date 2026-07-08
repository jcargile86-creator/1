import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import * as Updates from 'expo-updates';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { InspectionProvider } from './src/store/InspectionStore';
import { AuthProvider, useAuth } from './src/store/AuthStore';
import { colors } from './src/theme';
import SignInScreen from './src/screens/SignInScreen';
import HomeScreen from './src/screens/HomeScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import NewInspectionScreen from './src/screens/NewInspectionScreen';
import InspectionScreen from './src/screens/InspectionScreen';
import SectionScreen from './src/screens/SectionScreen';
import CameraScreen from './src/screens/CameraScreen';
import PhotoReviewScreen from './src/screens/PhotoReviewScreen';
import QuestionsScreen from './src/screens/QuestionsScreen';
import SketchScreen from './src/screens/SketchScreen';
import DocumentsScreen from './src/screens/DocumentsScreen';
import GalleryScreen from './src/screens/GalleryScreen';
import { RootStackParamList } from './src/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.offWhite, primary: colors.navy },
};

/** Signed-in app; the account gate below decides whether this renders. */
function MainStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.navy },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'InspectPro' }} />
      <Stack.Screen name="Calendar" component={CalendarScreen} options={{ title: 'Calendar' }} />
      <Stack.Screen name="NewInspection" component={NewInspectionScreen} options={{ title: 'New Inspection' }} />
      <Stack.Screen name="Inspection" component={InspectionScreen} options={{ title: 'Inspection' }} />
      <Stack.Screen name="Section" component={SectionScreen} options={{ title: 'Section' }} />
      <Stack.Screen name="Camera" component={CameraScreen} options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="PhotoReview" component={PhotoReviewScreen} options={{ title: 'Photos' }} />
      <Stack.Screen name="Questions" component={QuestionsScreen} options={{ title: 'Questions' }} />
      <Stack.Screen name="Sketch" component={SketchScreen} options={{ title: 'Diagram' }} />
      <Stack.Screen name="Documents" component={DocumentsScreen} options={{ title: 'Documents' }} />
      <Stack.Screen name="Gallery" component={GalleryScreen} options={{ title: 'Photo Review' }} />
    </Stack.Navigator>
  );
}

/** Account gate: shows the sign-in screen until an inspector is authenticated,
 *  then the main app scoped to that inspector's claims. */
function Gate() {
  const { loading, currentUser } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navy }}>
        <ActivityIndicator color={colors.white} size="large" />
      </View>
    );
  }
  return (
    <NavigationContainer theme={theme}>
      <StatusBar style="light" />
      {currentUser ? <MainStack /> : <SignInScreen />}
    </NavigationContainer>
  );
}

export default function App() {
  // Self-updating: check on launch, download, and restart into the new
  // version immediately — no force-quit ritual. No-ops in development.
  useEffect(() => {
    void (async () => {
      try {
        if (!Updates.isEnabled) return;
        const check = await Updates.checkForUpdateAsync();
        if (check.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch {
        // offline or update server unreachable — run what we have
      }
    })();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <InspectionProvider>
          <Gate />
        </InspectionProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
