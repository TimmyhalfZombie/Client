import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';

import CurvedTabBar from '../components/CurvedTabBar';
import HomeScreen from '../screens/HomeScreen';

const Tab = createBottomTabNavigator();
const HomeStack = createStackNavigator();

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeMain" component={HomeScreen} />
      {/* later add your second “dial + Start” screen here so the tab bar stays */}
      {/* <HomeStack.Screen name="Session" component={SessionScreen} /> */}
    </HomeStack.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator tabBar={(props) => <CurvedTabBar {...props} />} screenOptions={{ headerShown: false }}>
        <Tab.Screen name="Home" component={HomeStackNavigator} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
