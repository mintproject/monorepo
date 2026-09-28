UPDATE public.modelcatalog_configuration
SET has_component_location =
      'https://portals.tapis.io/v3/apps/modflow-2000-simulation/0.0.febed09',
    has_software_image =
      'docker://ghcr.io/wmobley/modflow-2000:sha-febed09'
WHERE id = 'https://w3id.org/okn/i/mint/90a6c0c2-a43b-4717-adb0-3a5a02737dc9';
