import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    user: null,
    token: localStorage.getItem('token'),
    loading: false,
    error: null
};

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        loginStart: (state) => {
            state.loading = true;
            state.error = null;
        },
        loginSuccess: (state, action) => {
            state.user = action.payload.user;
            state.token = action.payload.token;
            state.loading = false;
            localStorage.setItem('token', action.payload.token);
        },
        loginFailure: (state, action) => {
            state.error = action.payload;
            state.loading = false;
        },
        logout: (state) => {
            state.user = null;
            state.token = null;
            localStorage.removeItem('token');
        },
        setUser: (state, action) => {
            state.user = action.payload;
        }
    }
});

export const { loginStart, loginSuccess, loginFailure, logout, setUser } = authSlice.actions;
export default authSlice.reducer;
