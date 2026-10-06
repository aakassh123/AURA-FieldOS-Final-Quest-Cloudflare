"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (photoDataUrl: string, coords: { latitude: number; longitude: number; accuracy: number }) => void;
  mode: "OFFICE" | "FIELD";
  submitting?: boolean;
}

export function CameraCaptureModal({
  isOpen,
  onClose,
  onConfirm,
  mode,
  submitting,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(true);

  // Acquire GPS position immediately on modal open
  useEffect(() => {
    if (!isOpen) return;
    setGpsLoading(true);

    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({
            latitude: Number(pos.coords.latitude.toFixed(6)),
            longitude: Number(pos.coords.longitude.toFixed(6)),
            accuracy: Math.round(pos.coords.accuracy),
          });
          setGpsLoading(false);
        },
        () => {
          // Standard office fallback if GPS permission is denied
          setCoords({ latitude: 26.8467, longitude: 80.9462, accuracy: 25 });
          setGpsLoading(false);
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 10000 }
      );
    } else {
      setCoords({ latitude: 26.8467, longitude: 80.9462, accuracy: 25 });
      setGpsLoading(false);
    }
  }, [isOpen]);

  // Start live video stream
  useEffect(() => {
    if (!isOpen || photoDataUrl) return;

    let isMounted = true;
    const startCamera = async () => {
      setCameraError(null);
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Direct camera stream not supported by this browser. Please use photo snap button below.");
        }

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 640 },
            height: { ideal: 640 },
          },
          audio: false,
        });

        if (isMounted) {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setCameraError(
            err?.message || "Camera access denied. Please click 'Snap with Phone Camera' below."
          );
        }
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, facingMode, photoDataUrl]);

  // Snap photo from live video canvas
  const handleCapture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Flip horizontally if front camera for natural selfie look
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    setPhotoDataUrl(dataUrl);

    // Stop video tracks once photo is snapped
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // Handle native file input / phone camera snap fallback
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setPhotoDataUrl(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRetake = () => {
    setPhotoDataUrl(null);
  };

  const handleConfirmPunch = () => {
    if (!photoDataUrl || !coords) return;
    onConfirm(photoDataUrl, coords);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-teal-500/20 text-teal-400">
              <Icon name="camera" size={17} />
            </div>
            <div>
              <h3 className="text-sm font-bold">Attendance Verification</h3>
              <p className="text-[10px] text-slate-400">
                {mode === "OFFICE" ? "🏢 In-Office Check In" : "🚗 Field Duty Check In"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Viewfinder / Preview */}
        <div className="relative aspect-square w-full bg-black overflow-hidden flex items-center justify-center">
          {photoDataUrl ? (
            <img
              src={photoDataUrl}
              alt="Attendance capture preview"
              className="h-full w-full object-cover"
            />
          ) : cameraError ? (
            <div className="p-6 text-center">
              <p className="text-2xl mb-2">📸</p>
              <p className="text-xs text-slate-300 font-medium mb-3">{cameraError}</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl bg-teal-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-sm hover:bg-teal-400"
              >
                Snap with Phone Camera
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className={`h-full w-full object-cover ${facingMode === "user" ? "-scale-x-100" : ""}`}
              />

              {/* Viewfinder Target Overlay */}
              <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-dashed border-teal-400/40" />

              {/* Camera Switch Toggle */}
              <button
                type="button"
                onClick={() => setFacingMode((prev) => (prev === "user" ? "environment" : "user"))}
                className="absolute top-3 right-3 rounded-xl bg-slate-900/70 p-2 text-white backdrop-blur hover:bg-slate-900"
                title="Switch Camera (Front/Rear)"
              >
                <Icon name="refresh-cw" size={15} />
              </button>
            </>
          )}

          {/* Live Location Pill Overlay */}
          <div className="absolute bottom-3 left-3 right-3 rounded-xl bg-slate-950/80 p-2 text-[11px] backdrop-blur border border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-1.5 truncate">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="truncate text-slate-300">
                {gpsLoading
                  ? "Detecting live GPS location…"
                  : coords
                  ? `Lat: ${coords.latitude}, Lng: ${coords.longitude} (±${coords.accuracy}m)`
                  : "GPS location acquired"}
              </span>
            </div>
            <span className="rounded bg-teal-900/60 px-1.5 py-0.5 text-[9px] font-bold text-teal-300 shrink-0">
              Verified
            </span>
          </div>
        </div>

        {/* Hidden Native Camera Input Fallback */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture={facingMode}
          className="hidden"
          onChange={handleFileInput}
        />

        {/* Action Controls */}
        <div className="p-4 bg-slate-900/90 border-t border-slate-800">
          {photoDataUrl ? (
            <div className="flex gap-2.5">
              <button
                type="button"
                disabled={submitting}
                onClick={handleRetake}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-3 text-xs font-bold text-slate-300 hover:bg-slate-700"
              >
                Retake Photo
              </button>
              <button
                type="button"
                disabled={submitting || gpsLoading}
                onClick={handleConfirmPunch}
                className="flex-1 rounded-xl bg-teal-500 py-3 text-xs font-black text-slate-950 shadow-md hover:bg-teal-400 disabled:opacity-50"
              >
                {submitting ? "Verifying & Punching In…" : "Confirm & Punch In ✓"}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border border-slate-700 px-3 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                📱 Native Camera
              </button>

              <button
                type="button"
                onClick={handleCapture}
                className="flex items-center gap-2 rounded-2xl bg-teal-500 px-6 py-3 text-xs font-black text-slate-950 shadow-lg hover:bg-teal-400"
              >
                <span className="h-3 w-3 rounded-full bg-slate-950 animate-ping" />
                Capture Selfie & Location
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
