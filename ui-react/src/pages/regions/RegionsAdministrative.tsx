import { useParams } from 'react-router-dom';
import { RegionsEditor } from './RegionsEditor';

/**
 * Administrative regions page — wraps RegionsEditor with regionType="administrative".
 */
export function RegionsAdministrative() {
  const { regionId } = useParams<{ regionId: string }>();
  const id = regionId ?? 'ethiopia';

  return (
    <div className="content-page">
      <RegionsEditor regionId={id} regionType="administrative" mapHeight="320px" />
    </div>
  );
}
