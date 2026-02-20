"use client";

import { Input } from "antd";
import { useEffect, useMemo, useRef } from "react";

const scriptPromiseCache = new Map();

const loadGoogleMapsApi = (apiKey) => {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("Google Maps can only be loaded in the browser")
    );
  }
  if (window.google?.maps?.places) {
    return Promise.resolve(window.google);
  }
  if (!apiKey) {
    return Promise.reject(new Error("Missing Google Maps API key"));
  }
  if (scriptPromiseCache.has(apiKey)) {
    return scriptPromiseCache.get(apiKey);
  }
  const apiUrl = new URL("https://maps.googleapis.com/maps/api/js");
  apiUrl.searchParams.set("key", apiKey);
  apiUrl.searchParams.set("libraries", "places");
  apiUrl.searchParams.set("language", "en");
  apiUrl.searchParams.set("region", "US");

  const script = document.createElement("script");
  script.src = apiUrl.toString();
  script.async = true;
  script.defer = true;
  script.crossOrigin = "anonymous";

  const promise = new Promise((resolve, reject) => {
    script.onload = () => resolve(window.google);
    script.onerror = () =>
      reject(new Error("Unable to load Google Maps Places script"));
  });

  document.head.appendChild(script);
  scriptPromiseCache.set(apiKey, promise);
  return promise;
};

const buildAddressPayload = (place) => {
  const components = place?.address_components || [];
  const findComponent = (types, nameKey = "long_name") => {
    const target = components.find((component) =>
      types.some((type) => component.types.includes(type))
    );
    return target ? target[nameKey] : "";
  };

  const streetNumber = findComponent(["street_number"]);
  const route = findComponent(["route"]);
  const subpremise = findComponent(["subpremise"]);
  const premise = findComponent(["premise"]);
  const neighborhood =
    findComponent(["neighborhood"]) ||
    findComponent(["sublocality", "sublocality_level_2"]);
  const city =
    findComponent(["locality"]) ||
    findComponent(["sublocality", "sublocality_level_1"]) ||
    findComponent(["administrative_area_level_3"]) ||
    "";
  const state = findComponent(["administrative_area_level_1"], "short_name");
  const postalCode = findComponent(["postal_code"]);
  const countryShort = findComponent(["country"], "short_name");
  const countryLong = findComponent(["country"]);

  return {
    formattedAddress: place?.formatted_address || "",
    street1: [streetNumber, route].filter(Boolean).join(" ").trim(),
    street2: subpremise || premise || "",
    street3: neighborhood || "",
    city,
    state,
    postalCode,
    country: countryShort || countryLong,
    countryName: countryLong,
  };
};

export default function GooglePlacesAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  placeholder = "Search Address",
  disabled,
}) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);

  const apiKey = useMemo(() => process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, []);

  useEffect(() => {
    let isMounted = true;
    if (!apiKey) {
      return () => {
        isMounted = false;
      };
    }

    loadGoogleMapsApi(apiKey)
      .then((google) => {
        const element = inputRef.current?.input ?? inputRef.current;
        if (!isMounted || !element || !google?.maps?.places) return;
        autocompleteRef.current = new google.maps.places.Autocomplete(element, {
          fields: ["address_components", "formatted_address"],
          types: ["address"],
        });
        autocompleteRef.current.addListener("place_changed", () => {
          const place = autocompleteRef.current?.getPlace();
          if (!place) return;
          const payload = buildAddressPayload(place);
          if (payload.formattedAddress) {
            onChange?.(payload.formattedAddress);
          }
          onPlaceSelect?.(payload);
        });
      })
      .catch((error) => {
        if (!isMounted) return;
        console.error(error);
      });

    return () => {
      isMounted = false;
      const autocomplete = autocompleteRef.current;
      if (autocomplete && window.google?.maps?.event?.clearInstanceListeners) {
        window.google.maps.event.clearInstanceListeners(autocomplete);
      }
      autocompleteRef.current = null;
    };
  }, [apiKey, onChange, onPlaceSelect]);

  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={(event) => onChange?.(event?.target?.value ?? "")}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
}
