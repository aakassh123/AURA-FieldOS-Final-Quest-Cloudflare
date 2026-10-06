'use client';
import { useEffect, useRef } from 'react';
import { recordTripPoint } from '@/app/actions/field';
export function TripTracker({ tripId }: { tripId: string }) {
  const last = useRef(0);
  useEffect(() => {
    if (!navigator.geolocation) return;
    const send = (position: GeolocationPosition) => {
      const now = Date.now(); if (now-last.current < 25000) return; last.current = now;
      const fd = new FormData(); fd.set('trip_id',tripId); fd.set('latitude',String(position.coords.latitude)); fd.set('longitude',String(position.coords.longitude)); fd.set('accuracy',String(position.coords.accuracy));
      void recordTripPoint(fd);
    };
    const id = navigator.geolocation.watchPosition(send, () => {}, { enableHighAccuracy:true, maximumAge:15000, timeout:12000 });
    return () => navigator.geolocation.clearWatch(id);
  }, [tripId]);
  return <span className="text-[10px] font-medium text-teal-700">Location tracking active</span>;
}
