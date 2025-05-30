import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Toaster } from 'react-hot-toast';
import Dashboard from './components/Dashboard';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#5865f2',
    },
    secondary: {
      main: '#eb459e',
    },
    background: {
      default: '#0f0f23',
      paper: '#1a1a2e',
    },
    text: {
      primary: '#ffffff',
      secondary: '#b9bbbe',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 700,
    },
    h6: {
      fontWeight: 600,
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          // backgroundImage: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <div className="app">
          <Dashboard />
          <Toaster 
            position="top-right"
            toastOptions={{
              style: {
                background: '#1a1a2e',
                color: '#fff',
                border: '1px solid #5865f2',
              },
            }}
          />
        </div>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
