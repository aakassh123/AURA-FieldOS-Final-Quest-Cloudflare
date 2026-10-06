'use client';

import { useEffect, useRef } from 'react';
import maplibregl, { type Map as MapLibreInstance } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapCustomer, MapEmployee } from '@/lib/maps/types';

type Props = {
  customers: MapCustomer[];
  employees: MapEmployee[];
  height?: number;
  focusedEmployeeId?: string | null;
  onSelectEmployee?: (emp: MapEmployee) => void;
};

export function MapView({
  customers,
  employees,
  height = 560,
  focusedEmployeeId,
  onSelectEmployee,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreInstance | null>(null);
  const employeeMarkersRef = useRef<globalThis.Map<string, { marker: maplibregl.Marker; popup: maplibregl.Popup }>>(new globalThis.Map());

  // Initialize Map
  useEffect(() => {
    if (!ref.current) return;
    const validEmployees = employees.filter((e) => isValidCoord(e.latitude, e.longitude));
    const validCustomers = customers.filter((c) => isValidCoord(c.latitude, c.longitude));
    const all = [...validEmployees, ...validCustomers];
    const center: [number, number] = all.length
      ? [all[0].longitude, all[0].latitude]
      : [80.9462, 26.8467];

    const map = new maplibregl.Map({
      container: ref.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
      center,
      zoom: all.length ? 12 : 5,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear previous markers
    employeeMarkersRef.current.forEach(({ marker }) => marker.remove());
    employeeMarkersRef.current.clear();

    const validEmployees = employees.filter((e) => isValidCoord(e.latitude, e.longitude));
    const validCustomers = customers.filter((c) => isValidCoord(c.latitude, c.longitude));
    const customerMarkers: maplibregl.Marker[] = [];

    // Render Employees
    validEmployees.forEach((e) => {
      const el = document.createElement('button');
      el.type = 'button';
      
      const isOffice = e.state === 'OFFICE';
      const isOvertime = e.state === 'OVERTIME';
      const isOnVisit = e.state === 'ON_VISIT';

      let stateClass = 'aura-map-employee-field';
      let badgeEmoji = '🚗';
      let stateLabel = 'Working in field';
      let stateBgColor = '#dbeafe';
      let stateTextColor = '#1e40af';

      if (isOffice) {
        stateClass = 'aura-map-employee-office';
        badgeEmoji = '🏢';
        stateLabel = 'In Office (Real-Time)';
        stateBgColor = '#dcfce7';
        stateTextColor = '#166534';
      } else if (isOvertime) {
        stateClass = 'aura-map-employee-overtime';
        badgeEmoji = '🌙';
        stateLabel = 'Overtime Field Run';
        stateBgColor = '#f3e8ff';
        stateTextColor = '#6b21a8';
      } else if (isOnVisit) {
        stateClass = 'aura-map-employee-field';
        badgeEmoji = '📍';
        stateLabel = 'On Customer Visit';
        stateBgColor = '#fef3c7';
        stateTextColor = '#92400e';
      }

      el.className = `aura-map-marker aura-map-employee ${stateClass}`;
      el.title = `${e.full_name} (${e.employee_code ?? 'EMP'}) · ${stateLabel}`;

      if (e.avatar_url) {
        el.innerHTML = `
          <img src="${escapeHtml(e.avatar_url)}" alt="${escapeHtml(e.full_name)}" />
          <div class="aura-map-badge">${badgeEmoji}</div>
        `;
      } else {
        const initials = e.full_name.slice(0, 2).toUpperCase();
        el.innerHTML = `
          <span>${initials}</span>
          <div class="aura-map-badge">${badgeEmoji}</div>
        `;
      }

      el.addEventListener('click', () => {
        onSelectEmployee?.(e);
      });

      const popupHtml = `
        <div style="font-family: inherit; min-width: 200px; padding: 2px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <div style="font-weight: 800; font-size: 13px; color: #0f172a;">${escapeHtml(e.full_name)}</div>
            ${e.employee_code ? `<span style="background: #f1f5f9; color: #475569; font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 999px;">${escapeHtml(e.employee_code)}</span>` : ''}
          </div>
          ${e.designation ? `<div style="font-size: 11px; color: #64748b; margin-bottom: 8px;">${escapeHtml(e.designation)}</div>` : ''}
          
          <div style="display: inline-block; background: ${stateBgColor}; color: ${stateTextColor}; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 999px; margin-bottom: 8px;">
            ${badgeEmoji} ${stateLabel}
          </div>

          <div style="font-size: 10px; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 6px; display: flex; flex-direction: column; gap: 3px;">
            ${e.check_in_time ? `<div>🕒 Checked in: ${new Date(e.check_in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>` : ''}
            <div>📡 GPS accuracy: ±${e.accuracy_m ? Math.round(e.accuracy_m) : '15'}m</div>
            <div>📍 Position updated: ${new Date(e.recorded_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
            ${e.phone ? `<div style="margin-top: 4px;"><a href="tel:${escapeHtml(e.phone)}" style="color: #0d9488; font-weight: 700; text-decoration: none;">📞 Call: ${escapeHtml(e.phone)}</a></div>` : ''}
          </div>
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 22, maxWidth: '280px' }).setHTML(popupHtml);
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([e.longitude, e.latitude])
        .setPopup(popup)
        .addTo(map);

      employeeMarkersRef.current.set(e.id, { marker, popup });
    });

    // Render Customers
    validCustomers.forEach((c) => {
      const el = document.createElement('div');
      el.className = 'aura-map-marker aura-map-customer';
      el.title = c.name;
      const popup = new maplibregl.Popup({ offset: 12 }).setHTML(
        `<strong>${escapeHtml(c.name)}</strong><br/><small>${escapeHtml(c.city ?? 'Customer')} · geofence ${c.geofence_radius_m}m</small>`
      );
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([c.longitude, c.latitude])
        .setPopup(popup)
        .addTo(map);
      customerMarkers.push(marker);
    });

    return () => {
      customerMarkers.forEach((m) => m.remove());
    };
  }, [customers, employees, onSelectEmployee]);

  // Handle Focused Employee Pan
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusedEmployeeId) return;

    const emp = employees.find((e) => e.id === focusedEmployeeId);
    if (!emp || !isValidCoord(emp.latitude, emp.longitude)) return;

    map.flyTo({
      center: [emp.longitude, emp.latitude],
      zoom: 14.5,
      duration: 1200,
      essential: true,
    });

    const entry = employeeMarkersRef.current.get(focusedEmployeeId);
    if (entry && !entry.popup.isOpen()) {
      entry.popup.addTo(map);
    }
  }, [focusedEmployeeId, employees]);

  return (
    <div
      ref={ref}
      style={{ height }}
      className="relative w-full overflow-hidden rounded-2xl"
      aria-label="AURA live field and office map"
    />
  );
}

function isValidCoord(lat: any, lng: any): boolean {
  return typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c] ?? c));
}
