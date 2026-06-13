/**
 * RegionSelectMap — Leaflet map for multi-selecting regions by clicking their
 * polygons. Selected regions are highlighted; clicking a polygon toggles it.
 *
 * Also drives two map↔list links:
 *  - reports the current viewport (moveend/zoomend) so the list can filter to
 *    what is on screen, and
 *  - flies to a requested region (focusRegionId/focusNonce) so a list row can
 *    locate itself on the map.
 *
 * The map always renders the full `regions` set it is given — the viewport
 * filter applies only to the list, so panning never changes the rendered
 * polygons and cannot fight the auto-fit.
 */
import { useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  GeoJSON as LeafletGeoJSON,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import {
  calculateBoundingBox,
  parseGeometry,
  type ViewportBounds,
} from '@/pages/regions/regionUtils';
import type { PickerRegion } from '@/graphql/region-picker';

interface RegionSelectMapProps {
  regions: PickerRegion[];
  selectedIds: Set<string>;
  onToggle: (region: PickerRegion) => void;
  height?: string;
  /** Emits the visible map area whenever the user pans/zooms (and on mount). */
  onViewportChange?: (bounds: ViewportBounds) => void;
  /** Fly to this region's bounds when `focusNonce` changes. */
  focusRegionId?: string;
  focusNonce?: number;
  /** Re-fit the map to all current regions when this changes. */
  fitNonce?: number;
}

export function RegionSelectMap({
  regions,
  selectedIds,
  onToggle,
  height = '320px',
  onViewportChange,
  focusRegionId,
  focusNonce,
  fitNonce = 0,
}: RegionSelectMapProps) {
  const featureCollection: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: regions.flatMap((r) =>
      r.geometries
        .map((g) => {
          const geom = parseGeometry(g.geometry);
          if (!geom) return null;
          return {
            type: 'Feature',
            properties: { regionId: r.id, regionName: r.name },
            geometry: geom,
          } as GeoJSON.Feature;
        })
        .filter((f): f is GeoJSON.Feature => f !== null),
    ),
  };

  const style = (feature?: GeoJSON.Feature): L.PathOptions => {
    const selected = selectedIds.has(feature?.properties?.regionId as string);
    return {
      color: selected ? '#304a91' : '#2563eb',
      weight: selected ? 3 : 1.5,
      fillOpacity: selected ? 0.4 : 0.12,
      fillColor: selected ? '#304a91' : '#2563eb',
    };
  };

  const onEachFeature = (feature: GeoJSON.Feature, layer: L.Layer) => {
    layer.on('click', () => {
      const regionId = feature.properties?.regionId as string;
      const region = regions.find((r) => r.id === regionId);
      if (region) onToggle(region);
    });
    if (feature.properties?.regionName) {
      layer.bindTooltip(feature.properties.regionName as string, { sticky: true });
    }
  };

  const regionsKey = regions.map((r) => r.id).join(',');
  const selectionKey = regions
    .filter((r) => selectedIds.has(r.id))
    .map((r) => r.id)
    .join(',');

  return (
    <div className="overflow-hidden rounded-md border" style={{ height, zIndex: 0 }}>
      <MapContainer
        center={[0, 0]}
        zoom={2}
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LeafletGeoJSON
          key={`${regionsKey}|${selectionKey}`}
          data={featureCollection}
          style={style}
          onEachFeature={onEachFeature}
        />
        <MapFitter key={`${regionsKey}-${fitNonce}`} featureCollection={featureCollection} />
        <ViewportWatcher onViewportChange={onViewportChange} />
        <MapFocus regions={regions} focusRegionId={focusRegionId} focusNonce={focusNonce} />
      </MapContainer>
    </div>
  );
}

/** Fits the map to all currently-rendered features on mount (remounted via key). */
function MapFitter({ featureCollection }: { featureCollection: GeoJSON.FeatureCollection }) {
  const map = useMap();
  useEffect(() => {
    if (featureCollection.features.length > 0) {
      try {
        const layer = L.geoJSON(featureCollection);
        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [20, 20] });
        }
      } catch {
        // ignore invalid geometry
      }
    }
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Reports the visible map area on mount and on every pan/zoom. */
function ViewportWatcher({ onViewportChange }: { onViewportChange?: (b: ViewportBounds) => void }) {
  const report = (map: L.Map) => {
    const b = map.getBounds();
    onViewportChange?.({
      west: b.getWest(),
      south: b.getSouth(),
      east: b.getEast(),
      north: b.getNorth(),
    });
  };
  const map = useMapEvents({
    moveend: () => report(map),
    zoomend: () => report(map),
  });
  useEffect(() => {
    report(map);
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Flies to the requested region's bounds when `focusNonce` changes. */
function MapFocus({
  regions,
  focusRegionId,
  focusNonce,
}: {
  regions: PickerRegion[];
  focusRegionId?: string;
  focusNonce?: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (!focusRegionId) return;
    const region = regions.find((r) => r.id === focusRegionId);
    if (!region) return;
    const bb = calculateBoundingBox(region.geometries);
    if (!bb) return;
    map.flyToBounds(
      [
        [bb.ymin, bb.xmin],
        [bb.ymax, bb.xmax],
      ],
      { padding: [20, 20], maxZoom: 8 },
    );
  }, [focusNonce]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
