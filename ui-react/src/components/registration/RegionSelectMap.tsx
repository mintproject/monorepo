/**
 * RegionSelectMap — Leaflet map for multi-selecting regions by clicking their
 * polygons. Selected regions are highlighted; clicking a polygon toggles it.
 *
 * Mirrors the rendering approach of pages/regions/RegionsEditor's map, adapted
 * for multi-select (a Set of selected ids + a toggle callback).
 */
import { useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON as LeafletGeoJSON, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { parseGeometry } from '@/pages/regions/regionUtils';
import type { PickerRegion } from '@/graphql/region-picker';

interface RegionSelectMapProps {
  regions: PickerRegion[];
  selectedIds: Set<string>;
  onToggle: (region: PickerRegion) => void;
  height?: string;
}

export function RegionSelectMap({
  regions,
  selectedIds,
  onToggle,
  height = '320px',
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

  // Identity of the visible regions — refit/remount when the actual set changes,
  // not merely when its length changes (two same-size categories differ).
  const regionsKey = regions.map((r) => r.id).join(',');
  // Remount the layer only when the visible regions or their selection change
  // (react-leaflet does not re-run `style` on prop change), scoped to this map's
  // regions so selecting in another category doesn't churn this layer.
  const selectionKey = regions
    .filter((r) => selectedIds.has(r.id))
    .map((r) => r.id)
    .join(',');

  const MapFitter = () => {
    const map = useMapEvents({});
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
    }, [map]);
    return null;
  };

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
        <MapFitter key={regionsKey} />
      </MapContainer>
    </div>
  );
}
