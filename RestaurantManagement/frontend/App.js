import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, Platform, Alert } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { WorkSans_400Regular, WorkSans_600SemiBold } from '@expo-google-fonts/work-sans';

if (Platform.OS === 'web') {
  Alert.alert = (title, message, buttons) => {
    const desc = message ? `\n${message}` : '';
    const hasButtons = buttons && buttons.length > 0;
    if (hasButtons) {
      const result = window.confirm(`${title}${desc}`);
      if (result) {
        const confirmBtn = buttons.find(b => b.style !== 'cancel') || buttons[0];
        if (confirmBtn && confirmBtn.onPress) confirmBtn.onPress();
      } else {
        const cancelBtn = buttons.find(b => b.style === 'cancel');
        if (cancelBtn && cancelBtn.onPress) cancelBtn.onPress();
      }
    } else {
      window.alert(`${title}${desc}`);
    }
  };
}

import { AuthProvider, useAuth } from './src/context/AuthContext';
import AppErrorBoundary from './src/components/AppErrorBoundary';
import { colors } from './src/theme/kinetic';

import LoginScreen from './src/screens/LoginScreen';
import WaiterScreen from './src/screens/WaiterScreen';
import NewOrderScreen from './src/screens/NewOrderScreen';
import KitchenScreen from './src/screens/KitchenScreen';
import ManagerScreen from './src/screens/ManagerScreen';
import OwnerScreen from './src/screens/OwnerScreen';

const Stack = createNativeStackNavigator();

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}

function WaiterStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.primary,
        headerTitleStyle: {
          fontFamily: 'SpaceGrotesk_700Bold',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: -0.3,
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.surface },
      }}
    >
      <Stack.Screen name="WaiterHome" component={WaiterScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="NewOrder"
        component={NewOrderScreen}
        options={{
          headerShown: true,
          title: 'New Order',
          headerBackTitle: 'Back',
        }}
      />
    </Stack.Navigator>
  );
}

function RoleRouter() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.surface }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!user) return <AuthStack />;

  switch (user.role) {
    case 'waiter':
      return <WaiterStack />;
    case 'kitchen':
      return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Kitchen" component={KitchenScreen} />
        </Stack.Navigator>
      );
    case 'manager':
      return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Manager" component={ManagerScreen} />
        </Stack.Navigator>
      );
    case 'owner':
      return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Owner" component={OwnerScreen} />
        </Stack.Navigator>
      );
    default:
      return <AuthStack />;
  }
}

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_700Bold,
    WorkSans_400Regular,
    WorkSans_600SemiBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.surface }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppErrorBoundary>
          <AuthProvider>
            <NavigationContainer>
              <RoleRouter />
              <StatusBar style="dark" />
            </NavigationContainer>
          </AuthProvider>
        </AppErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
