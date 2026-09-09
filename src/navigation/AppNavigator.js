import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import StudentSearchScreen from '../screens/StudentSearchScreen';
import EntryFormScreen from '../screens/EntryFormScreen';
import MovementSearchScreen from '../screens/MovementSearchScreen';
import MovementFormScreen from '../screens/MovementFormScreen';
import ReportFormScreen from '../screens/ReportFormScreen';
import CbtFormScreen from '../screens/CbtFormScreen';
import SyncDetailsScreen from '../screens/SyncDetailsScreen';
import PhotoDownloadScreen from '../screens/PhotoDownloadScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { user, ready } = useAuth();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerTintColor: '#1a3c6e' }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'LOGISS Field' }} />

            {/* Entry flow */}
            <Stack.Screen
              name="StudentSearch"
              component={StudentSearchScreen}
              options={{ title: 'Find Student' }}
              initialParams={{ helperText: 'Search the student to register a laptop for' }}
            />
            <Stack.Screen name="EntryForm" component={EntryFormScreen} options={{ title: 'Register Laptop' }} />

            {/* Movement flow */}
            <Stack.Screen name="MovementSearch" component={MovementSearchScreen} options={{ title: 'Find Laptop' }} />
            <Stack.Screen name="MovementForm" component={MovementFormScreen} options={{ title: 'Movement' }} />

            {/* Report flow (reuses StudentSearch with a custom onPick) */}
            <Stack.Screen
              name="ReportSearch"
              component={StudentSearchScreen}
              options={{ title: 'Find Student' }}
              initialParams={{ helperText: 'Search the student to file a report for' }}
            />
            <Stack.Screen name="ReportForm" component={ReportFormScreen} options={{ title: 'File Report' }} />

            {/* CBT flow */}
            <Stack.Screen
              name="CbtSearch"
              component={StudentSearchScreen}
              options={{ title: 'Find Student' }}
              initialParams={{ helperText: 'Search the student to generate a CBT code for' }}
            />
            <Stack.Screen name="CbtForm" component={CbtFormScreen} options={{ title: 'CBT Code' }} />

            <Stack.Screen name="SyncDetails" component={SyncDetailsScreen} options={{ title: 'Sync Details' }} />
            <Stack.Screen name="PhotoDownload" component={PhotoDownloadScreen} options={{ title: 'Download Photos' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
