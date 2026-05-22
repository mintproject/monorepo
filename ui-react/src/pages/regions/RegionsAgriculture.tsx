import { useParams } from 'react-router-dom';
import { RegionsEditor } from './RegionsEditor';

/**
 * Agriculture regions page — wraps RegionsEditor with regionType="agriculture".
 */
export function RegionsAgriculture() {
  const { regionId } = useParams<{ regionId: string }>();
  const id = regionId ?? 'ethiopia';

  return (
    <div className="content-page">
      <RegionsEditor regionId={id} regionType="agriculture" mapHeight="320px" />
    </div>
  );
}
