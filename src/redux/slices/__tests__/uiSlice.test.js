import uiReducer, { setDensity, setTheme } from '../uiSlice';
import { DENSITIES } from '../../../styles/theme';

describe('uiSlice', () => {
  const initialState = {
    density: DENSITIES.MEDIUM,
    theme: 'light',
  };

  test('should return the initial state', () => {
    expect(uiReducer(undefined, { type: undefined })).toEqual(initialState);
  });

  test('should handle setDensity', () => {
    const newState = uiReducer(initialState, setDensity(DENSITIES.COMPACT));
    expect(newState.density).toBe(DENSITIES.COMPACT);
  });

  test('should handle setTheme', () => {
    const newState = uiReducer(initialState, setTheme('dark'));
    expect(newState.theme).toBe('dark');
  });
});
