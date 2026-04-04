import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';

import { AuthProvider, useAuth } from './src/context/AuthContext';

// Screens
import LoginScreen    from './src/screens/LoginScreen';
import WaiterScreen   from './src/screens/WaiterScreen';
import NewOrderScreen from './src/screens/NewOrderScreen';
import KitchenScreen  from './src/screens/KitchenScreen';
import ManagerScreen  from './src/screens/ManagerScreen';
import OwnerScreen    from './src/screens/OwnerScreen';

const Stack = createNativeStackNavigator();

// ─── Unauthenticated navigator ───────────────────────────────────────────────
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}

// ─── Waiter navigator (includes New Order sub-screen) ───────────────────────
function WaiterStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WaiterHome" component={WaiterScreen} />
      <Stack.Screen
        name="NewOrder"
        component={NewOrderScreen}
        options={{
          headerShown: true,
          headerTitle: 'New Order',
          headerStyle:      { backgroundColor: '#16213e' },
          headerTintColor:  '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
    </Stack.Navigator>
  );
}

// ─── Role router — picks the right navigator based on the logged-in role ─────
function RoleRouter() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#1a1a2e' }}>
        <ActivityIndicator color="#e94560" size="large" />
      </View>
    );
  }

  if (!user) return <AuthStack />;

  switch (user.role) {
    case 'waiter':  return <WaiterStack />;
    case 'kitchen': return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Kitchen" component={KitchenScreen} />
      </Stack.Navigator>
    );
    case 'manager': return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Manager" component={ManagerScreen} />
      </Stack.Navigator>
    );
    case 'owner': return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Owner" component={OwnerScreen} />
      </Stack.Navigator>
    );
    default: return <AuthStack />;
  }
}

// ─── Root app ────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <RoleRouter />
      </NavigationContainer>
    </AuthProvider>
  );
}
