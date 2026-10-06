'use client';
import { useEffect } from 'react';
import { recordLocationPing } from '@/app/actions/field';
export function WorkSessionHeartbeat({sessionId}:{sessionId:string}){
  useEffect(()=>{
    let timer:ReturnType<typeof setInterval>|undefined;
    const send=()=>{ if(!navigator.geolocation)return; navigator.geolocation.getCurrentPosition(async p=>{const fd=new FormData();fd.set('work_session_id',sessionId);fd.set('latitude',String(p.coords.latitude));fd.set('longitude',String(p.coords.longitude));fd.set('accuracy',String(p.coords.accuracy));await recordLocationPing(fd)},()=>{}, {enableHighAccuracy:false,timeout:8000,maximumAge:30000}); };
    send(); timer=setInterval(send,120000); return()=>{if(timer)clearInterval(timer)};
  },[sessionId]);
  return null;
}
