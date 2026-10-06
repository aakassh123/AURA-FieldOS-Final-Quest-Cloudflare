import * as Location from 'expo-location';
import { Platform } from 'react-native';

export async function requestFieldLocationPermission() {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') throw new Error('Location permission is required for field work.');
  return foreground;
}

export async function requestBackgroundLocationPermission() {
  await requestFieldLocationPermission();
  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== 'granted') throw new Error('Background location permission was not granted.');
  return background;
}

export async function currentLocation() {
  await requestFieldLocationPermission();
  return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
}

export const LOCATION_TASK = 'AURA_BACKGROUND_LOCATION';
export const isNative = Platform.OS === 'ios' || Platform.OS === 'android';
