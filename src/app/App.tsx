import LoginPage from './login/page';
import HomePage from './home/page';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { theme } from '../theme';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../features/auth/authContext';
import { ProtectedRoute, PublicRoute } from '../features/auth/routes';
import { SnackbarProvider } from '../shared/snackbar';
import type { JSX } from 'react';

function App(): JSX.Element {
  return (
    <AuthProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SnackbarProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<PublicRoute />}>
                <Route path={"/"} element={<LoginPage />} />
                <Route path={"/login"} element={<LoginPage />} />
              </Route>
              <Route element={<ProtectedRoute />}>
                <Route path="*" element={<HomePage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </SnackbarProvider>
      </ThemeProvider >
    </AuthProvider >
  );
}

export default App
