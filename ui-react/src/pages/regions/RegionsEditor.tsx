import { useCallback, useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON as LeafletGeoJSON, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Plus, Download, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

import {
  useListRegionsByCategoryQuery,
  useInsertRegionsMutation,
} from '@/graphql/generated/graphql';
import { useListRegionCategoriesWithHierarchy } from './useRegionCategories';
import { RegionDatasets } from './RegionDatasets';
import { RegionModels } from './RegionModels';
import {
  type RegionData,
  calculateBoundingBox,
  parseGeometry,
  parseGeoJsonFeatures,
  generateRegionId,
  type NewRegionFromGeoJSON,
} from './regionUtils';

interface RegionsEditorProps {
  regionId?: string;
  regionType?: string;
  /** Optional: override CSS height of the map. Default 320px. */
  mapHeight?: string;
}

/** Map + GeoJSON polygon CRUD + subcategory tabs. */
export function RegionsEditor({
  regionId = 'global',
  regionType = 'administrative',
  mapHeight = '320px',
}: RegionsEditorProps) {
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('');
  const [selectedRegion, setSelectedRegion] = useState<RegionData | null>(null);
  const [addRegionsOpen, setAddRegionsOpen] = useState(false);

  const { categories, subcategoriesFor } = useListRegionCategoriesWithHierarchy();
  const subcategories = subcategoriesFor(regionType);

  const activeCategoryId = selectedSubcategory || regionType;

  const { data, loading, refetch } = useListRegionsByCategoryQuery({
    variables: { categoryId: activeCategoryId },
    skip: !activeCategoryId,
  });

  const regions = data?.region ?? [];

  const handleRegionClick = useCallback((region: RegionData) => {
    setSelectedRegion(region);
  }, []);

  const handleSubcategoryChange = (catId: string) => {
    setSelectedSubcategory(catId === regionType ? '' : catId);
    setSelectedRegion(null);
  };

  const downloadGeoJson = () => {
    if (!selectedRegion) return;
    const geojson = {
      type: 'FeatureCollection',
      features: selectedRegion.geometries
        .map((g) => {
          const geometry = parseGeometry(g.geometry);
          if (!geometry) return null;
          return {
            type: 'Feature',
            properties: { id: selectedRegion.id, name: selectedRegion.name },
            geometry,
          };
        })
        .filter(Boolean),
    };
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedRegion.name.replace(/\s+/g, '_').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const bbox = selectedRegion ? calculateBoundingBox(selectedRegion.geometries) : null;

  const categoryName = categories.find((c) => c.id === regionType)?.name ?? regionType;
  const currentCategoryObj = subcategories.find((sc) => sc.id === activeCategoryId);
  const citation =
    currentCategoryObj?.citation ?? categories.find((c) => c.id === regionType)?.citation;

  return (
    <div className="w-full">
      {/* Subcategory tabs */}
      {subcategories.length > 0 && (
        <div className="mb-2 flex items-center gap-1">
          <Tabs value={activeCategoryId} onValueChange={handleSubcategoryChange}>
            <TabsList>
              <TabsTrigger value={regionType}>{categoryName}</TabsTrigger>
              {subcategories.map((sc) => (
                <TabsTrigger key={sc.id} value={sc.id}>
                  {sc.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <button
            className="ml-2 text-gray-400 hover:text-primary"
            title="Add subcategory (disabled)"
            disabled
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Description + citation */}
      <div className="mb-2 flex items-start justify-between">
        <div className="text-sm text-muted-foreground">
          {regionType === 'administrative'
            ? `The following map shows the administrative regions in this area.`
            : `The following map shows the current areas of interest for ${regionType} modeling in this area.`}
          {citation && <div className="mt-1 text-xs italic">{citation}</div>}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setAddRegionsOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Add regions
        </Button>
      </div>

      {/* Map */}
      {loading ? (
        <div
          className="flex items-center justify-center rounded bg-gray-100"
          style={{ height: mapHeight }}
        >
          <LoadingSpinner />
        </div>
      ) : regions.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded bg-gray-200 text-base font-semibold text-gray-500"
          style={{ height: mapHeight }}
        >
          <AlertCircle className="h-8 w-8" />
          <span>This category does not have any region yet.</span>
          <Button variant="outline" size="sm" onClick={() => setAddRegionsOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Add new regions
          </Button>
        </div>
      ) : (
        <div style={{ height: mapHeight, zIndex: 0 }} className="overflow-hidden rounded border">
          <RegionMap
            regions={regions}
            selectedRegion={selectedRegion}
            onRegionClick={handleRegionClick}
          />
        </div>
      )}

      {/* Selected region info */}
      {selectedRegion && (
        <div className="mt-2 flex items-center justify-between text-sm">
          <span>
            <b>Selected region:</b> {selectedRegion.name}{' '}
            <span className="text-muted-foreground">(id: {selectedRegion.id})</span>
          </span>
          {bbox && (
            <span className="flex items-center gap-2">
              <b>Bounding box:</b>
              {bbox.xmin.toFixed(4)},{bbox.ymin.toFixed(4)} – {bbox.xmax.toFixed(4)},
              {bbox.ymax.toFixed(4)}
              <button
                onClick={downloadGeoJson}
                className="flex items-center gap-1 rounded border px-2 py-0.5 text-xs hover:bg-gray-100"
              >
                <Download className="h-3 w-3" /> Download
              </button>
            </span>
          )}
        </div>
      )}
      {selectedRegion && (
        <p className="mt-1 text-xs text-muted-foreground">
          <b>Note:</b> Models and Datasets are calculated using the bounding box of the highlighted
          region. Results from overlapping regions may be included.
        </p>
      )}

      {/* Sub-panels */}
      {selectedRegion && (
        <>
          <RegionModels
            regionId={selectedRegion.id}
            regionName={selectedRegion.name}
            regionType={regionType}
          />
          <RegionDatasets
            regionId={selectedRegion.id}
            regionName={selectedRegion.name}
            boundingBox={bbox ?? undefined}
          />
        </>
      )}

      {/* Add regions dialog */}
      <AddRegionsDialog
        open={addRegionsOpen}
        onClose={() => setAddRegionsOpen(false)}
        parentRegionId={regionId}
        regionType={regionType}
        subcategories={subcategories}
        activeCategoryId={activeCategoryId}
        onSuccess={() => {
          setAddRegionsOpen(false);
          refetch();
        }}
      />
    </div>
  );
}

// ─── Map component ────────────────────────────────────────────────────────────

interface RegionMapProps {
  regions: RegionData[];
  selectedRegion: RegionData | null;
  onRegionClick: (region: RegionData) => void;
}

function RegionMap({ regions, selectedRegion, onRegionClick }: RegionMapProps) {
  // Build a GeoJSON feature collection from all regions
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
    const isSelected = feature?.properties?.regionId === selectedRegion?.id;
    return {
      color: isSelected ? '#304a91' : '#2563eb',
      weight: isSelected ? 3 : 1.5,
      fillOpacity: isSelected ? 0.35 : 0.15,
      fillColor: isSelected ? '#304a91' : '#2563eb',
    };
  };

  const onEachFeature = (feature: GeoJSON.Feature, layer: L.Layer) => {
    layer.on('click', () => {
      const regionId = feature.properties?.regionId as string;
      const region = regions.find((r) => r.id === regionId);
      if (region) onRegionClick(region);
    });
    if (feature.properties?.regionName) {
      layer.bindTooltip(feature.properties.regionName as string, { sticky: true });
    }
  };

  // Fit bounds to features
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
    }, [regions.length]); // eslint-disable-line react-hooks/exhaustive-deps
    return null;
  };

  return (
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
        key={`${selectedRegion?.id ?? 'none'}-${regions.length}`}
        data={featureCollection}
        style={style}
        onEachFeature={onEachFeature}
      />
      <MapFitter />
    </MapContainer>
  );
}

// ─── Add Regions Dialog ───────────────────────────────────────────────────────

interface SubcatItem {
  id: string;
  name: string;
  citation?: string | null;
}

interface AddRegionsDialogProps {
  open: boolean;
  onClose: () => void;
  parentRegionId: string;
  regionType: string;
  subcategories: SubcatItem[];
  activeCategoryId: string;
  onSuccess: () => void;
}

function AddRegionsDialog({
  open,
  onClose,
  parentRegionId,
  regionType,
  subcategories,
  activeCategoryId,
  onSuccess,
}: AddRegionsDialogProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState(activeCategoryId);
  const [parsedFeatures, setParsedFeatures] = useState<NewRegionFromGeoJSON[]>([]);
  const [nameProperty, setNameProperty] = useState<string>('');
  const [names, setNames] = useState<string[]>([]);
  const [checkedIndices, setCheckedIndices] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);

  const [insertRegions, { loading }] = useInsertRegionsMutation();

  const propertyKeys: string[] =
    parsedFeatures.length > 0 && parsedFeatures[0]
      ? Object.keys(parsedFeatures[0].featureProperties)
      : [];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const geojson = JSON.parse(ev.target?.result as string) as GeoJSON.FeatureCollection;
        if (geojson.type !== 'FeatureCollection') {
          setError('File must be a GeoJSON FeatureCollection');
          return;
        }
        const features = parseGeoJsonFeatures(geojson);
        setParsedFeatures(features);
        setNames(features.map(() => ''));
        setCheckedIndices(new Set(features.map((_, i) => i)));
        setError('');
        setNameProperty('');
      } catch {
        setError('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  const handleNamePropertyChange = (prop: string) => {
    setNameProperty(prop);
    if (prop) {
      setNames(parsedFeatures.map((f) => String(f.featureProperties[prop] ?? '')));
    }
  };

  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      setCheckedIndices(new Set(parsedFeatures.map((_, i) => i)));
    } else {
      setCheckedIndices(new Set());
    }
  };

  const handleToggle = (i: number) => {
    setCheckedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const handleNameChange = (i: number, value: string) => {
    setNames((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
  };

  const handleSubmit = async () => {
    const selected = [...checkedIndices];
    if (selected.length === 0) {
      setError('Please select at least one region to add.');
      return;
    }
    const missing = selected.filter((i) => !names[i]?.trim());
    if (missing.length > 0) {
      setError(
        'Please enter a name for all selected regions, or select a GeoJSON property to auto-fill names.',
      );
      return;
    }

    const objects = selected.map((i) => {
      const feature = parsedFeatures[i]!;
      const name = names[i] ?? '';
      const id = generateRegionId(parentRegionId, name);
      return {
        id,
        name: name.trim(),
        parent_region_id: parentRegionId,
        category_id: selectedCategoryId,
        geometries: {
          data: feature.geometries.map((g) => ({ geometry: g })),
        },
      };
    });

    try {
      await insertRegions({ variables: { objects } });
      setParsedFeatures([]);
      setNames([]);
      setCheckedIndices(new Set());
      setError('');
      if (fileRef.current) fileRef.current.value = '';
      onSuccess();
    } catch (err) {
      setError(`Error adding regions: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleClose = () => {
    setParsedFeatures([]);
    setNames([]);
    setCheckedIndices(new Set());
    setError('');
    if (fileRef.current) fileRef.current.value = '';
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add {regionType} regions</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Category selector */}
          <div>
            <Label htmlFor="category-select">Category</Label>
            <select
              id="category-select"
              className="mt-1 block w-full rounded border border-input bg-background px-3 py-2 text-sm"
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
            >
              <option value={regionType}>Base regions</option>
              {subcategories.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.name}
                </option>
              ))}
            </select>
          </div>

          {/* GeoJSON file upload */}
          <div>
            <Label>GeoJSON File</Label>
            <div className="mt-1">
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.geojson"
                onChange={handleFileChange}
                className="block text-sm"
              />
            </div>
          </div>

          {/* Name property selector */}
          {parsedFeatures.length > 0 && propertyKeys.length > 0 && (
            <div>
              <Label htmlFor="name-prop">Auto-fill names from GeoJSON property</Label>
              <select
                id="name-prop"
                className="mt-1 block w-full rounded border border-input bg-background px-3 py-2 text-sm"
                value={nameProperty}
                onChange={(e) => handleNamePropertyChange(e.target.value)}
              >
                <option value="">— select property —</option>
                {propertyKeys.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Regions table */}
          {parsedFeatures.length > 0 && (
            <div>
              <p className="mb-2 text-sm text-muted-foreground">
                {parsedFeatures.length} regions found. {checkedIndices.size} selected.
              </p>
              <div className="max-h-64 overflow-auto rounded border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr>
                      <th className="p-2 text-left">
                        <input
                          type="checkbox"
                          checked={checkedIndices.size === parsedFeatures.length}
                          onChange={(e) => handleToggleAll(e.target.checked)}
                        />
                      </th>
                      <th className="p-2 text-left">Name</th>
                      <th className="p-2 text-left">Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedFeatures.map((feature, i) => (
                      <tr
                        key={i}
                        className={checkedIndices.has(i) ? 'bg-white' : 'bg-gray-50 opacity-50'}
                      >
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={checkedIndices.has(i)}
                            onChange={() => handleToggle(i)}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={names[i] ?? ''}
                            onChange={(e) => handleNameChange(i, e.target.value)}
                            placeholder="Region name"
                            className="h-7 text-sm"
                          />
                        </td>
                        <td className="max-w-48 truncate p-2 text-xs text-muted-foreground">
                          {Object.entries(feature.featureProperties)
                            .slice(0, 2)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error && (
            <p className="flex items-center gap-1 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" /> {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || parsedFeatures.length === 0 || checkedIndices.size === 0}
          >
            {loading
              ? 'Adding…'
              : `Add ${checkedIndices.size} region${checkedIndices.size !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
