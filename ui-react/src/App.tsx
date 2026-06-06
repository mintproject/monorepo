import { Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from './components/layout/AppShell';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { LoginRequiredPage } from './components/common/ProtectedRoute';
import { Toaster } from './components/ui/toaster';
import { ModelSelectionProvider } from './contexts/ModelSelectionContext';

// Pages — model catalog
import { AppHome } from './pages/AppHome';
import { ModelsPage } from './pages/ModelsPage';
import { ConfigurePage } from './pages/ConfigurePage';
import { RegisterPage } from './pages/RegisterPage';
import { OAuth2CallbackPage } from './pages/OAuth2CallbackPage';

// Pages — modeling
import { ModelingHome } from './pages/modeling/ModelingHome';
import { ProblemStatementsList } from './pages/modeling/ProblemStatementsList';
import { MintProblemStatement } from './pages/modeling/MintProblemStatement';
import { MintThread } from './pages/modeling/MintThread';

// Pages — datasets
import { DatasetsHome } from './pages/datasets/DatasetsHome';
import { DatasetsBrowse } from './pages/datasets/DatasetsBrowse';
import { DatasetsSearch } from './pages/datasets/DatasetsSearch';
import { DatasetDetail } from './pages/datasets/DatasetDetail';
import { DatasetsRegister } from './pages/datasets/DatasetsRegister';
import { DatasetsTransformations } from './pages/datasets/DatasetsTransformations';

// Pages — regions
import { RegionsHome } from './pages/regions/RegionsHome';
import { RegionsEditor } from './pages/regions/RegionsEditor';
import { RegionDatasets } from './pages/regions/RegionDatasets';
import { RegionModels } from './pages/regions/RegionModels';

// Pages — variables
import { VariablesHome } from './pages/variables/VariablesHome';

// Auth pages
import { OAuth2CallbackPage } from './pages/OAuth2CallbackPage';

// 404
import { NotFoundPage } from './pages/NotFoundPage';

// Inline stub for login-required — full page lives in feat/auth-integration
function LoginRequiredPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-2xl font-semibold">Login Required</h1>
      <p className="text-gray-600">You must be logged in to view this page.</p>
    </div>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <ModelSelectionProvider>
        <AppShell>
          <Routes>
            {/* Home */}
            <Route path="/" element={<AppHome />} />

            {/* Models */}
            <Route path="/models" element={<ModelsPage />} />
            <Route path="/models/configure/:id" element={<ConfigurePage />} />
            <Route path="/models/register" element={<RegisterPage />} />

            {/* Legacy configure route — redirect to models */}
            <Route path="/configure" element={<Navigate to="/models" replace />} />

            {/* Modeling */}
            <Route path="/modeling" element={<ModelingHome />} />
            <Route path="/modeling/problem-statements" element={<ProblemStatementsList />} />
            <Route path="/modeling/problem-statement/:id" element={<MintProblemStatement />} />
            <Route path="/modeling/thread/:id" element={<MintThread />} />

            {/* Auth callback */}
            <Route path="/oauth2/callback" element={<OAuth2CallbackPage />} />
            <Route path="/login-required" element={<LoginRequiredPage />} />

            {/* Datasets */}
            <Route path="/datasets" element={<DatasetsHome />} />
            <Route path="/datasets/browse" element={<DatasetsBrowse />} />
            <Route path="/datasets/search" element={<DatasetsSearch />} />
            <Route path="/datasets/detail/:id" element={<DatasetDetail />} />
            <Route path="/datasets/register" element={<DatasetsRegister />} />
            <Route path="/datasets/transformations" element={<DatasetsTransformations />} />

            {/* Regions */}
            <Route path="/regions" element={<RegionsHome />} />
            <Route path="/regions/editor" element={<RegionsEditor />} />
            <Route path="/regions/:id/datasets" element={<RegionDatasets />} />
            <Route path="/regions/:id/models" element={<RegionModels />} />

            {/* Variables */}
            <Route path="/variables" element={<VariablesHome />} />

            {/* 404 */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AppShell>
        <Toaster />
      </ModelSelectionProvider>
    </ErrorBoundary>
  );
}
