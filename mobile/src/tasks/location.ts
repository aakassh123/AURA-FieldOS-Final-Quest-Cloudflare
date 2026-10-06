import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { enqueueLocation, getLocal } from '../lib/db';

export const BACKGROUND_LOCATION_TASK = 'aura-background-location';

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  const workSessionId = await getLocal('active_work_session_id');
  const employeeId = await getLocal('current_employee_id');
  const companyId = await getLocal('current_company_id');
  if (!workSessionId || !employeeId || !companyId) return;

  for (const location of locations) {
    await enqueueLocation({
      work_session_id: workSessionId,
      employee_id: employeeId,
      company_id: companyId,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy_m: location.coords.accuracy,
      recorded_at: new Date(location.timestamp).toISOString()
    });
  }
});
