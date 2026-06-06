import { useParams } from 'react-router-dom';
import { RegionsEditor } from './RegionsEditor';

/**
 * Hydrology regions page — wraps RegionsEditor with regionType="hydrology".
 */
export function RegionsHydrology() {
  const { regionId } = useParams<{ regionId: string }>();
  const id = regionId ?? 'ethiopia';

  return (
    <div className="content-page">
      <RegionsEditor regionId={id} regionType="hydrology" mapHeight="320px" />
    </div>
  );
}
