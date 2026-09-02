import { Link } from 'react-router-dom';
import { Wheat, Droplets, Building2 } from 'lucide-react';

/** Regions overview page — the category navigation. */
export function RegionsHome() {
  return (
    <div className="content-page">
      <h1 className="mb-4 text-2xl font-semibold">Regions</h1>

      <div className="mb-8">
        <h2 className="mb-3 text-base font-semibold">About regions</h2>
        <div className="max-w-3xl space-y-3 text-sm text-muted-foreground">
          <p>
            In this section, users can browse, manage, and organize a variety of geographical areas
            that serve as the foundation for registering datasets and configuring models within the
            system. Each dataset and model is directly linked to a specific area, which makes it
            possible to establish meaningful connections between available data and the
            corresponding geographical regions.
          </p>
          <p>
            The platform is designed to accommodate multiple levels of regional detail across each
            category. For example, administrative regions may include different levels such as
            states, provinces, districts, or municipalities, while other categories may feature
            regions defined by natural or land use boundaries. This flexible structure supports use
            cases that require both broad overviews and fine-grained local distinctions.
          </p>
          <p>
            Users have the ability to add new regions or entire subcategories at any time, using
            GeoJSON files to define boundaries and attributes as needed. This ensures that the
            system can be tailored to evolving data requirements and organizational needs,
            supporting effective management and exploration of geographical information.
          </p>
        </div>
      </div>

      <div className="-mx-6 bg-gray-50 px-6 py-8">
        <h2 className="mb-4 text-base font-semibold">Start from a category</h2>
        <div className="grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
          <CategoryCard
            title="Agricultural Regions"
            description="Geographic areas characterized by distinct patterns of agricultural activity due to climate, soil type, topography, economic factors, or cultural practices. These regions help us understand where and why certain types of crops and livestock are produced."
            href="/regions/agriculture"
            label="Explore Agricultural Regions"
            icon={<Wheat className="h-12 w-12 text-green-600" />}
          />

          <CategoryCard
            title="Hydrological Regions"
            description="Geographic areas defined based on drainage patterns, river basins, and water resources (such as rivers, lakes, and watersheds). These regions share characteristics related to how water flows, accumulates, and is distributed within them."
            href="/regions/hydrology"
            label="Explore Hydrological Regions"
            icon={<Droplets className="h-12 w-12 text-blue-600" />}
          />

          <CategoryCard
            title="Administrative Regions"
            description="Geographic areas defined and governed by political or administrative boundaries set by a government or authority. These regions are created for the purposes of managing, organizing, and delivering governmental services, administration, and governance."
            href="/regions/administrative"
            label="Explore Administrative Regions"
            icon={<Building2 className="h-12 w-12 text-gray-600" />}
          />
        </div>
      </div>
    </div>
  );
}

interface CategoryCardProps {
  title: string;
  description: string;
  href: string;
  label: string;
  icon: React.ReactNode;
}

function CategoryCard({ title, description, href, label, icon }: CategoryCardProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border bg-white p-6">
      <div className="flex-1">
        <h4 className="mb-2 text-base font-semibold">{title}</h4>
        <p className="mb-4 text-sm text-muted-foreground">{description}</p>
        <Link
          to={href}
          className="inline-flex items-center rounded border border-primary px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          {label}
        </Link>
      </div>
      <div className="flex-shrink-0">{icon}</div>
    </div>
  );
}
