import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { InspectionProvider } from './src/store/InspectionStore';
import { colors } from './src/theme';
import HomeScreen from './src/screens/HomeScreen';
import NewInspectionScreen from './src/screens/NewInspectionScreen';
import InspectionScreen from './src/screens/InspectionScreen';
import SectionScreen from './src/screens/SectionScreen';
import CameraScreen from './src/screens/CameraScreen';
import PhotoReviewScreen from './src/screens/PhotoReviewScreen';
import QuestionsScreen from './src/screens/QuestionsScreen';
import SketchScreen from './src/screens/SketchScreen';
import { RootStackParamList } from './src/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.offWhite, primary: colors.navy },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <InspectionProvider>
        <NavigationContainer theme={theme}>
          <StatusBar style="light" />
          <Stack.Navigator
            screenOptions={{
              headerStyle: { backgroundColor: colors.navy },
              headerTintColor: colors.white,
              headerTitleStyle: { fontWeight: '700' },
            }}
          >
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'InspectPro' }} />
            <Stack.Screen name="NewInspection" component={NewInspectionScreen} options={{ title: 'New Inspection' }} />
            <Stack.Screen name="Inspection" component={InspectionScreen} options={{ title: 'Inspection' }} />
            <Stack.Screen name="Section" component={SectionScreen} options={{ title: 'Section' }} />
            <Stack.Screen name="Camera" component={CameraScreen} options={{ headerShown: false, animation: 'fade' }} />
            <Stack.Screen name="PhotoReview" component={PhotoReviewScreen} options={{ title: 'Photos' }} />
            <Stack.Screen name="Questions" component={QuestionsScreen} options={{ title: 'Questions' }} />
            <Stack.Screen name="Sketch" component={SketchScreen} options={{ title: 'Diagram' }} />
          </Stack.Navigator>
        </NavigationContainer>
      </InspectionProvider>
    </SafeAreaProvider>
  );
}
