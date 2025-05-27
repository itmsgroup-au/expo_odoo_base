import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Define the data types
interface AppState {
  user: {
    name: string;
    id?: string;
    email?: string;
  };
  isLoading: boolean;
  lastUpdated: Date | null;
}

interface AppContextType {
  state: AppState;
  dispatch: (action: AppAction) => void;
}

// Define action types - similar to Redux actions
type AppAction = 
  | { type: 'SET_USER', payload: { name: string, id?: string, email?: string } }
  | { type: 'CLEAR_USER' }
  | { type: 'SET_LOADING', payload: boolean }
  | { type: 'REFRESH_DATA' };

// Initial state
const initialState: AppState = {
  user: {
    name: 'Guest',
  },
  isLoading: false,
  lastUpdated: null,
};

// Create the context
const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider component
interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [state, setState] = useState<AppState>(initialState);

  // Reducer function to handle state updates
  const dispatch = (action: AppAction) => {
    switch (action.type) {
      case 'SET_USER':
        setState((prevState) => ({
          ...prevState,
          user: action.payload,
        }));
        break;
      case 'CLEAR_USER':
        setState((prevState) => ({
          ...prevState,
          user: { name: 'Guest' },
        }));
        break;
      case 'SET_LOADING':
        setState((prevState) => ({
          ...prevState,
          isLoading: action.payload,
        }));
        break;
      case 'REFRESH_DATA':
        setState((prevState) => ({
          ...prevState,
          lastUpdated: new Date(),
        }));
        break;
      default:
        console.warn('Unknown action type');
    }
  };

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

// Custom hook for using this context
export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

// Helper hooks that mimic Redux hooks
export const useDispatch = () => {
  const { dispatch } = useApp();
  return dispatch;
};

export const useSelector = (selector: (state: AppState) => any) => {
  const { state } = useApp();
  return selector(state);
};
