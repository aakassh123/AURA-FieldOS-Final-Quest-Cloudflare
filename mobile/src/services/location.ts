import * as Location from 'expo-location';
import { BACKGROUND_LOCATION_TASK } from '../tasks/location';

export async function requestFieldLocationPermissions() {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') return { foreground: false, background: false };

  const background = await Location.requestBackgroundPermissionsAsync();
  return { foreground: true, background: background.status === 'granted' };
}

export async function getCurrentLocation() {
  const permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('Location permission is required.');
  return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
}

export async function startBackgroundTracking() {
  const permissions = await requestFieldLocationPermissions();
  if (!permissions.background) throw new Error('Background location permission was not granted.');

  const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (!started) {
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 50,
      timeInterval: 30000,
      pausesUpdatesAutomatically: true,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'AURA Field Work active',
        notificationBody: 'AURA is recording authorized field-work location.',
        notificationColor: '#14B8A6'
      }
    });
  }
}

export async function stopBackgroundTracking() {
  const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (started) await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
}
