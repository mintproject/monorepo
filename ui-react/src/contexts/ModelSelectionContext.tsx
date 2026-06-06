import React, { createContext, useContext, useMemo, useReducer } from 'react';

interface ModelSelection {
  softwareId: string | null;
  versionId: string | null;
  configurationId: string | null;
}

type ModelSelectionAction =
  | { type: 'SELECT_SOFTWARE'; id: string }
  | { type: 'SELECT_VERSION'; id: string }
  | { type: 'SELECT_CONFIGURATION'; id: string }
  | { type: 'CLEAR' };

interface ModelSelectionContextValue {
  selection: ModelSelection;
  dispatch: React.Dispatch<ModelSelectionAction>;
}

const initialState: ModelSelection = {
  softwareId: null,
  versionId: null,
  configurationId: null,
};

function modelSelectionReducer(
  state: ModelSelection,
  action: ModelSelectionAction,
): ModelSelection {
  switch (action.type) {
    case 'SELECT_SOFTWARE':
      return { softwareId: action.id, versionId: null, configurationId: null };
    case 'SELECT_VERSION':
      return { ...state, versionId: action.id, configurationId: null };
    case 'SELECT_CONFIGURATION':
      return { ...state, configurationId: action.id };
    case 'CLEAR':
      return initialState;
    default:
      return state;
  }
}

const ModelSelectionContext = createContext<ModelSelectionContextValue | null>(null);

interface ModelSelectionProviderProps {
  children: React.ReactNode;
}

export function ModelSelectionProvider({ children }: ModelSelectionProviderProps) {
  const [selection, dispatch] = useReducer(modelSelectionReducer, initialState);
  const value = useMemo(() => ({ selection, dispatch }), [selection]);
  return <ModelSelectionContext.Provider value={value}>{children}</ModelSelectionContext.Provider>;
}

export function useModelSelection() {
  const context = useContext(ModelSelectionContext);
  if (!context) {
    throw new Error('useModelSelection must be used within a ModelSelectionProvider');
  }
  return context;
}
