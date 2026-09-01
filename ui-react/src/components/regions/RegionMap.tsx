import { useCallback, useEffect, useRef, useState } from 'react';

import { useQuery } from '@apollo/client';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { useNavigate } from 'react-router-dom';

import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { LIST_TOP_REGIONS } from '@/graphql/queries/regions';
import { applyFeatureStyle, loadRegionFeatures, type Region } from '@/lib/geo/region-layer';
import { mapStyles } from '@/styles/map-style';

interface ListTopRegionsData {
  region: Region[];
}

function getGoogleMapsKey(): string {
  return window.__MINT_CONFIG__?.GOOGLE_MAPS_KEY ?? import.meta.env.VITE_GOOGLE_MAPS_KEY ?? '';
}

interface RegionMapProps {
  regions: Region[];
  onRegionClick: (id: string) => void;
}

/** The Google Maps data layer holding the top-level region polygons. */
function RegionMapCanvas({ regions, onRegionClick }: RegionMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;

      try {
        loadRegionFeatures(map, regions);

        // Set default style
        map.data.setStyle((feature) => applyFeatureStyle(feature, null));

        // InfoWindow for hover
        const infoWindow = new google.maps.InfoWindow();
        infoWindowRef.current = infoWindow;

        map.data.addListener('mouseout', () => {
          infoWindow.close();
        });

        map.data.addListener('click', (event: google.maps.Data.MouseEvent) => {
          const regionId: string = event.feature.getProperty('region_id') as string;
          const regionName: string = event.feature.getProperty('region_name') as string;

          setSelectedId(regionId);

          // Update visual styles for all features
          map.data.setStyle((feature) => applyFeatureStyle(feature, regionId));

          // Show info window
          const center =
            (event.feature.getProperty('center') as google.maps.LatLng | null) ?? event.latLng;
          infoWindow.setContent(regionName);
          infoWindow.setPosition(center);
          infoWindow.open(map);

          onRegionClick(regionId);
        });

        map.data.addListener('mouseover', (event: google.maps.Data.MouseEvent) => {
          const regionName: string = event.feature.getProperty('region_name') as string;
          const center =
            (event.feature.getProperty('center') as google.maps.LatLng | null) ?? event.latLng;
          infoWindow.setContent(regionName);
          infoWindow.setPosition(center);
          infoWindow.open(map);
        });
      } catch (error) {
        // A broken map must not take the whole page down with it.
        console.error('Could not draw the region map', error);
      }
    },

    [regions, onRegionClick],
  );

  const onUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  // Re-apply styles when selectedId changes (in case re-render triggers this)
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.data.setStyle((feature) => applyFeatureStyle(feature, selectedId));
    }
  }, [selectedId]);

  return (
    <GoogleMap
      mapContainerClassName="middle2main"
      mapContainerStyle={{ width: '100%', height: '100%' }}
      zoom={3}
      center={{ lat: 0, lng: 20 }}
      options={{
        mapTypeId: 'terrain',
        disableDefaultUI: true,
        draggable: true,
        styles: mapStyles,
      }}
      onLoad={onLoad}
      onUnmount={onUnmount}
    />
  );
}

/**
 * A region picker: the top-level regions drawn on a world map, where clicking
 * one opens the models registered for it.
 *
 * This lives on `/regions`, where "which region?" is the question the page is
 * already asking. It used to be the first thing on the landing page, which put
 * the filter before anything to filter -- and it navigated to `/regions/:id`,
 * a route that does not exist.
 */
export function RegionMap() {
  const navigate = useNavigate();
  const apiKey = getGoogleMapsKey();

  const { isLoaded: mapsLoaded } = useJsApiLoader({ googleMapsApiKey: apiKey });
  const { data, loading: regionsLoading } = useQuery<ListTopRegionsData>(LIST_TOP_REGIONS);

  const regions = data?.region ?? [];

  const handleRegionClick = useCallback(
    (regionId: string) => {
      navigate(`/regions/${encodeURIComponent(regionId)}/models`);
    },
    [navigate],
  );

  const mapReady = mapsLoaded && !regionsLoading && regions.length > 0;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground">
        Select a region by hovering over it and clicking.
      </h4>

      {!mapReady && (
        <div className="flex items-center justify-center" style={{ height: 500 }}>
          <LoadingSpinner />
        </div>
      )}

      {mapReady && (
        <div className="middle2main overflow-hidden rounded-md" style={{ height: 500 }}>
          <RegionMapCanvas regions={regions} onRegionClick={handleRegionClick} />
        </div>
      )}

      {mapsLoaded && !regionsLoading && regions.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No regions available. Contact your administrator.
        </p>
      )}
    </div>
  );
}
