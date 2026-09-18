import { useEffect, useRef, useState } from 'react';
import { MapContainer, Rectangle, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { Button } from '@/components/ui/button';
import type { BoundingBox } from '@/lib/geo/bbox';

interface DatasetSpatialMapProps {
  value: BoundingBox | null;
  onChange: (value: BoundingBox | null) => void;
}

type LatLngTuple = [number, number];
type LeafletBounds = [LatLngTuple, LatLngTuple];

function toLeafletBounds(box: BoundingBox): LeafletBounds {
  return [
    [box.ymin, box.xmin],
    [box.ymax, box.xmax],
  ];
}

function toBoundingBox(bounds: L.LatLngBounds): BoundingBox {
  return {
    xmin: bounds.getWest(),
    xmax: bounds.getEast(),
    ymin: bounds.getSouth(),
    ymax: bounds.getNorth(),
  };
}

function BoxDrawer({
  active,
  value,
  onChange,
}: {
  active: boolean;
  value: BoundingBox | null;
  onChange: (value: BoundingBox | null) => void;
}) {
  const [draft, setDraft] = useState<BoundingBox | null>(value);
  const start = useRef<L.LatLng | null>(null);

  const map = useMapEvents({
    mousedown(event) {
      if (!active || event.originalEvent.button !== 0) return;
      L.DomEvent.stopPropagation(event.originalEvent);
      start.current = event.latlng;
      setDraft(null);
      map.dragging.disable();
    },
    mousemove(event) {
      if (!active || !start.current) return;
      setDraft(toBoundingBox(L.latLngBounds(start.current, event.latlng)));
    },
    mouseup(event) {
      if (!active || !start.current) return;
      const box = toBoundingBox(L.latLngBounds(start.current, event.latlng));
      start.current = null;
      map.dragging.enable();
      if (box.xmax - box.xmin > 0.01 && box.ymax - box.ymin > 0.01) {
        setDraft(box);
        onChange(box);
      } else {
        setDraft(value);
      }
    },
  });

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (!active) {
      start.current = null;
      map.dragging.enable();
    }
  }, [active, map]);

  useEffect(
    () => () => {
      map.dragging.enable();
    },
    [map],
  );

  return draft ? (
    <Rectangle
      bounds={toLeafletBounds(draft)}
      pathOptions={{ color: '#304a91', fillColor: '#304a91', fillOpacity: 0.16, weight: 2 }}
    />
  ) : null;
}

export function DatasetSpatialMap({ value, onChange }: DatasetSpatialMapProps) {
  const [drawing, setDrawing] = useState(false);

  return (
    <div className="flex h-full min-h-[390px] flex-col rounded-lg border bg-card">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">Spatial coverage</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Draw a box to find datasets that overlap an area.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="outline" onClick={() => setDrawing(true)}>
            {value ? 'Redraw box' : 'Draw box'}
          </Button>
          {value && (
            <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
              Clear
            </Button>
          )}
        </div>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-b-lg">
        <MapContainer
          center={[25, -95]}
          zoom={3}
          style={{ width: '100%', height: '100%', minHeight: '330px' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <BoxDrawer
            active={drawing}
            value={value}
            onChange={(box) => {
              onChange(box);
              setDrawing(false);
            }}
          />
        </MapContainer>
        {drawing && (
          <div className="pointer-events-none absolute left-3 top-3 z-[1000] rounded-md bg-background/95 px-3 py-2 text-xs shadow">
            Drag across the map to select a bounding box.
          </div>
        )}
        {!drawing && !value && (
          <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] rounded-md bg-background/95 px-3 py-2 text-xs text-muted-foreground shadow">
            Use Draw box to filter by location.
          </div>
        )}
      </div>
    </div>
  );
}
