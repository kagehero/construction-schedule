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
  const showAddressOnMapRef = useRef<((address: string) => void) | null>(null);
  const [isReady, setIsReady] = useState(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

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

    const applyAddress = (address: string) => {
      if (address && onSelectRef.current) {
        onSelectRef.current(address);
      }
    };

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
      applyAddress(address);
    });

    map.addListener("click", (e: { latLng: { lat: () => number; lng: () => number } }) => {
      const latLng = e.latLng;
      marker.setPosition(latLng);
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: latLng }, (results: { formatted_address: string }[] | null, status: string) => {
        if (status === "OK" && results && results[0]) {
          applyAddress(results[0].formatted_address);
          if (inputRef.current) {
            inputRef.current.value = results[0].formatted_address;
          }
        }
      });
    });

    const geocoder = new google.maps.Geocoder();
    const showAddressOnMap = (address: string) => {
      const q = (address || "").trim();
      if (!q) return;
      geocoder.geocode(
        { address: q, region: "jp" },
        (
          results: { formatted_address?: string; geometry: { location: { lat: () => number; lng: () => number } } }[] | null,
          status: string
        ) => {
          if (status === "OK" && results && results[0] && results[0].geometry) {
            const first = results[0];
            const loc = first.geometry.location;
            map.panTo(loc);
            marker.setPosition(loc);
            map.setZoom(16);
            const formattedAddress = first.formatted_address || q;
            applyAddress(formattedAddress);
            if (inputRef.current) {
              inputRef.current.value = formattedAddress;
            }
          }
        }
      );
    };

    showAddressOnMapRef.current = showAddressOnMap;

    if (initialQuery && inputRef.current) {
      inputRef.current.value = initialQuery;
      showAddressOnMap(initialQuery);
    }

    const inputEl = inputRef.current;
    const onInputKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        const value = inputRef.current ? inputRef.current.value.trim() : "";
        if (value) showAddressOnMap(value);
      }
    };
    inputEl.addEventListener("keydown", onInputKeyDown);

    return () => {
      showAddressOnMapRef.current = null;
      inputEl.removeEventListener("keydown", onInputKeyDown);
      if (listener && google.maps.event && google.maps.event.removeListener) {
        google.maps.event.removeListener(listener);
      }
    };
  }, [open, isReady, initialQuery]);

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
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                className="flex-1 rounded-md bg-theme-bg-input border border-theme-border text-theme-text px-3 py-2 text-sm"
                placeholder="例: 東京駅、日本武道館、○○市△△町 など"
              />
              <button
                type="button"
                onClick={() => {
                  const value = inputRef.current ? inputRef.current.value.trim() : "";
                  if (value && showAddressOnMapRef.current) showAddressOnMapRef.current(value);
                }}
                className="shrink-0 px-3 py-2 rounded-md bg-accent/15 border border-accent/40 text-accent text-xs font-medium hover:bg-accent/25"
              >
                地図で表示
              </button>
            </div>
            <p className="mt-1 text-[11px] text-theme-text-muted">
              住所を入力して Enter または「地図で表示」を押すと地図が該当地域に移動し、<strong>現場住所にも自動で反映</strong>されます。検索候補から選んでも同様に反映されます。
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

