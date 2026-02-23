"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    __googleMapsLoaded__?: boolean;
    __googleMapsLoading__?: Promise<void>;
  }
}

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

async function loadGoogleMapsScript(): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.__googleMapsLoaded__) return;
  if (window.__googleMapsLoading__) {
    return window.__googleMapsLoading__;
  }

  window.__googleMapsLoading__ = new Promise<void>((resolve, reject) => {
    if (!GOOGLE_MAPS_API_KEY) {
      console.error(
        "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY が設定されていません。住所検索マップは動作しません。"
      );
      resolve();
      return;
    }

    const existing = document.getElementById("google-maps-js");
    if (existing) {
      existing.addEventListener("load", () => {
        window.__googleMapsLoaded__ = true;
        resolve();
      });
      existing.addEventListener("error", () => {
        console.error("Google Maps JS API の読み込みに失敗しました。");
        reject(new Error("Failed to load Google Maps JS API"));
      });
      return;
    }

    const script = document.createElement("script");
    script.id = "google-maps-js";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&language=ja&region=JP`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      window.__googleMapsLoaded__ = true;
      resolve();
    };
    script.onerror = () => {
      console.error("Google Maps JS API の読み込みに失敗しました。");
      reject(new Error("Failed to load Google Maps JS API"));
    };
    document.head.appendChild(script);
  });

  return window.__googleMapsLoading__;
}

type AddressMapModalProps = {
  open: boolean;
  initialQuery?: string;
  onSelect: (address: string) => void;
  onClose: () => void;
};

export function AddressMapModal({
  open,
  initialQuery,
  onSelect,
  onClose,
}: AddressMapModalProps): JSX.Element | null {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    loadGoogleMapsScript()
      .then(() => {
        if (!cancelled) {
          setIsReady(true);
        }
      })
      .catch((error) => {
        console.error(error);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !isReady) return;
    if (!mapContainerRef.current || !inputRef.current) return;
    if (typeof (window as any).google === "undefined") return;

    const google = (window as any).google as typeof globalThis & { maps: any };

    const center = new google.maps.LatLng(35.681236, 139.767125); // 東京駅あたり
    const map = new google.maps.Map(mapContainerRef.current, {
      center,
      zoom: 14,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    const marker = new google.maps.Marker({
      map,
      position: center,
    });

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      fields: ["formatted_address", "geometry"],
      types: ["geocode"],
      componentRestrictions: { country: "jp" },
    });

    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place || !place.geometry || !place.geometry.location) return;

      map.panTo(place.geometry.location);
      marker.setPosition(place.geometry.location);

      const address =
        place.formatted_address || (inputRef.current ? inputRef.current.value : "");
      if (address) {
        onSelect(address);
      }
    });

    if (initialQuery && inputRef.current) {
      inputRef.current.value = initialQuery;
    }

    return () => {
      if (listener && google.maps.event && google.maps.event.removeListener) {
        google.maps.event.removeListener(listener);
      }
    };
  }, [open, isReady, initialQuery, onSelect]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8 bg-black/50">
      <div className="w-full max-w-5xl max-h-[95vh] bg-theme-card border border-theme-border rounded-xl shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-theme-border">
          <h2 className="text-sm font-semibold text-theme-text">地図から住所を検索</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -mr-2 rounded-md text-theme-text-muted hover:bg-theme-bg-elevated hover:text-theme-text"
            aria-label="閉じる"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 space-y-3 text-xs text-theme-text flex-1 min-h-0">
          {!GOOGLE_MAPS_API_KEY && (
            <p className="text-red-400 text-[11px]">
              NEXT_PUBLIC_GOOGLE_MAPS_API_KEY が設定されていないため、地図検索は利用できません。
            </p>
          )}
          <div>
            <label className="block mb-1 text-[11px] text-theme-text-muted-strong">
              住所・ランドマークで検索
            </label>
            <input
              ref={inputRef}
              type="text"
              className="w-full rounded-md bg-theme-bg-input border border-theme-border text-theme-text px-3 py-2 text-sm"
              placeholder="例: 東京駅、日本武道館、○○市△△町 など"
            />
            <p className="mt-1 text-[11px] text-theme-text-muted">
              検索候補から場所を選ぶと、その住所が現場住所に反映されます。
            </p>
          </div>
          <div
            ref={mapContainerRef}
            className="mt-2 w-full h-80 md:h-[420px] rounded-md border border-theme-border bg-theme-bg-input"
          />
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-theme-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-theme-border text-[11px] text-theme-text hover:bg-theme-bg-elevated"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

