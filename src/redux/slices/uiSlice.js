import { createSlice } from '@reduxjs/toolkit';
import { DENSITIES } from '../../styles/theme';

const initialState = {
  density: DENSITIES.MEDIUM,
  theme: 'light',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setDensity: (state, action) => {
      state.density = action.payload;
    },
    setTheme: (state, action) => {
      state.theme = action.payload;
    },
  },
});

export const { setDensity, setTheme } = uiSlice.actions;
export default uiSlice.reducer;
