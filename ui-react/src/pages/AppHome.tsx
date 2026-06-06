import { useCallback, useEffect, useRef, useState } from 'react';

import { useQuery } from '@apollo/client';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { useNavigate } from 'react-router-dom';

import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { LIST_TOP_REGIONS } from '@/graphql/queries/regions';
import { useAuth } from '@/lib/auth/useAuth';
import { mapStyles } from '@/styles/map-style';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RegionGeometry {
  // geometry is an opaque GeoJSON object stored in Hasura as JSON
  geometry: object | null;
}

interface Region {
  id: string;
  name: string;
  model_catalog_uri?: string | null;
  geometries: RegionGeometry[];
}

interface ListTopRegionsData {
  region: Region[];
}

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

function getGoogleMapsKey(): string {
  return window.__MINT_CONFIG__?.GOOGLE_MAPS_KEY ?? import.meta.env.VITE_GOOGLE_MAPS_KEY ?? '';
}

function getWelcomeMessage(): string {
  return (
    window.__MINT_CONFIG__?.WELCOME_MESSAGE ??
    import.meta.env.VITE_WELCOME_MESSAGE ??
    'Welcome to MINT Model Catalog'
  );
}

// ---------------------------------------------------------------------------
// Region map styling helpers (mirrors google-map-custom.ts logic)
// ---------------------------------------------------------------------------

const REGION_FILL_DEFAULT = '#1990d5';
const REGION_FILL_SELECTED = '#d51990';
const REGION_STROKE_DEFAULT = '#1990d5';
const REGION_STROKE_SELECTED = '#d51990';

function applyFeatureStyle(feature: google.maps.Data.Feature, selectedId: string | null) {
  const regionId: string = feature.getProperty('region_id') as string;
  const selected = regionId === selectedId;
  return {
    fillColor: selected ? REGION_FILL_SELECTED : REGION_FILL_DEFAULT,
    fillOpacity: selected ? 0.5 : 0.3,
    strokeColor: selected ? REGION_STROKE_SELECTED : REGION_STROKE_DEFAULT,
    strokeWeight: 1,
  };
}

// ---------------------------------------------------------------------------
// RegionMap sub-component
// ---------------------------------------------------------------------------

interface RegionMapProps {
  regions: Region[];
  onRegionClick: (id: string) => void;
}

function RegionMap({ regions, onRegionClick }: RegionMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;

      // Load all region GeoJSON into the map data layer
      regions.forEach((region) => {
        const features = map.data.addGeoJson({
          type: 'FeatureCollection',
          features: region.geometries
            .filter((g) => g.geometry != null)
            .map((g) => ({
              type: 'Feature' as const,
              geometry: g.geometry as object,
              properties: {},
            })),
        });

        features.forEach((feature) => {
          const bounds = new google.maps.LatLngBounds();
          const geom = feature.getGeometry();
          if (geom) {
            geom.forEachLatLng((latlng) => bounds.extend(latlng));
            feature.setProperty('center', bounds.getCenter());
          }
          feature.setProperty('region_id', region.id);
          feature.setProperty('region_name', region.name);
        });
      });

      // Set default style
      map.data.setStyle((feature) => applyFeatureStyle(feature, null));

      // Fit map to all loaded features
      const bounds = new google.maps.LatLngBounds();
      map.data.forEach((feature) => {
        const geom = feature.getGeometry();
        if (geom) geom.forEachLatLng((latlng) => bounds.extend(latlng));
      });
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds);
      }

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

// ---------------------------------------------------------------------------
// Main AppHome page
// ---------------------------------------------------------------------------

export function AppHome() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const apiKey = getGoogleMapsKey();
  const welcomeMessage = getWelcomeMessage();

  const { isLoaded: mapsLoaded } = useJsApiLoader({
    googleMapsApiKey: apiKey,
  });

  const { data, loading: regionsLoading } = useQuery<ListTopRegionsData>(LIST_TOP_REGIONS);

  const regions = data?.region ?? [];

  const handleRegionClick = useCallback(
    (regionId: string) => {
      navigate(`/regions/${encodeURIComponent(regionId)}`);
    },
    [navigate],
  );

  const mapReady = mapsLoaded && !regionsLoading && regions.length > 0;

  return (
    <>
      {/* Content section */}
      <div className="content-page">
        <div className="main-content mx-0 my-[60px]">
          <h1 className="mb-10 text-[1.75rem] font-black leading-tight">{welcomeMessage}</h1>

          <div className="concept-grid grid gap-6 md:grid-cols-[1fr_420px]">
            {/* Description */}
            <div className="space-y-4 text-sm leading-relaxed text-foreground">
              <p>
                <strong>DYNAMO</strong> helps analysts seamlessly use advanced simulation models and
                data to explore the impact of weather and climate on water and food availability in
                selected regions around the world. For instance, an analyst can use DYNAMO to assess
                expected crop yields under different rainfall scenarios, accounting for their
                effects on flooding and drought.
              </p>
              <p>
                <strong>DYNAMO</strong>&apos;s simulation models are quantitative and embed deep
                subject-matter expertise. For example, a hydrology model incorporates physical laws
                that govern how water moves through a river basin. It uses data on terrain elevation
                and soil types to estimate how much water is absorbed into the ground and how it
                flows across land surfaces.
              </p>
              <p>
                Throughout the process, <strong>DYNAMO</strong> offers guidance to reduce the time
                and effort needed to build integrated models—while maintaining both their accuracy
                and practical value.
              </p>
              <p>
                Recognizing that analysts bring different expertise and may work with diverse
                models, <strong>DYNAMO</strong> supports individual user accounts. Each
                analyst&apos;s actions are tracked under their username, while all users share a
                unified interface. This means that when one analyst completes a task, the results
                are immediately accessible to the entire team.
              </p>
              {user?.username && (
                <p className="text-muted-foreground">
                  Signed in as <strong>{user.username}</strong>.
                </p>
              )}
            </div>

            {/* Getting Started card */}
            <div className="concept-card rounded-lg border bg-card p-5 text-card-foreground shadow-sm">
              <h4 className="mb-2 font-black uppercase tracking-wide">Getting Started</h4>
              <hr className="mb-3 border-[#484848]" />
              <p className="text-sm leading-relaxed">
                Start by selecting the main region on the map below. Then, use the top menu to:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
                <li>
                  Explore subregions and areas of interest for modeling, such as river basins,
                  administrative areas, etc.
                </li>
                <li>Browse models customized for the main region or any subregion.</li>
                <li>Run models by setting up initial conditions and input data.</li>
                <li>Prepare reports to summarize your analyses.</li>
              </ul>
              <p className="mt-3 text-sm leading-relaxed">
                The selected main region is always visible in the top right. Clicking on it allows
                you to change it.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Map section */}
      <div className="gray-section bg-muted/40 py-6">
        <div className="content-page">
          <h4 className="mb-4 text-sm font-medium text-muted-foreground">
            Select a region by hovering over it and clicking.
          </h4>

          {!mapReady && (
            <div className="flex items-center justify-center" style={{ height: 500 }}>
              <LoadingSpinner />
            </div>
          )}

          {mapReady && (
            <div className="middle2main overflow-hidden rounded-md" style={{ height: 500 }}>
              <RegionMap regions={regions} onRegionClick={handleRegionClick} />
            </div>
          )}

          {mapsLoaded && !regionsLoading && regions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No regions available. Contact your administrator.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
