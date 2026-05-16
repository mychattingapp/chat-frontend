import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',

    primary: {
      main: '#9B6DFF',
      light: '#B197FC',
      dark: '#7C3AED',
      contrastText: '#FFFFFF',
    },

    background: {
      default: '#050816',
      paper: '#0F172A',
    },

    text: {
      primary: '#E0E7FF',
      secondary: '#94A3B8',
    },

    divider: 'rgba(139, 92, 246, 0.16)',

    success: {
      main: '#22C55E',
    },

    error: {
      main: '#EF4444',
    },

    warning: {
      main: '#F59E0B',
    },
  },

  shape: {
    borderRadius: 8,
  },

  typography: {
    fontFamily: 'Ubuntu, Arial, sans-serif',
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#050816',
          backgroundImage: 'none',
        },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid rgba(139, 92, 246, 0.16)',
        },
      },
    },

    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#0F172A',
          borderRight: '1px solid rgba(139, 92, 246, 0.16)',
        },
      },
    },

    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#0F172A',
          backgroundImage: 'none',
          borderBottom: '1px solid rgba(139, 92, 246, 0.16)',
        },
      },
    },

    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          border: '1px solid transparent',
          color: '#B7C0D8',

          '&:hover': {
            backgroundColor: 'rgba(139, 92, 246, 0.09)',
            borderColor: 'rgba(139, 92, 246, 0.16)',
          },

          '&.Mui-selected': {
            backgroundColor: 'rgba(139, 92, 246, 0.16)',
            borderColor: 'rgba(139, 92, 246, 0.28)',
            color: '#F5F3FF',
          },

          '&.Mui-selected:hover': {
            backgroundColor: 'rgba(139, 92, 246, 0.20)',
            borderColor: 'rgba(139, 92, 246, 0.34)',
          },
        },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: {
          color: '#94A3B8',

          '&:hover': {
            backgroundColor: 'rgba(139, 92, 246, 0.08)',
          },
        },
      },
    },

    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 700,
          textTransform: 'none',
          boxShadow: 'none',

          '&:hover': {
            boxShadow: 'none',
          },
        },

        containedPrimary: {
          backgroundColor: '#9B6DFF',
          color: '#FFFFFF',

          '&:hover': {
            backgroundColor: '#8B5CF6',
          },
        },

        outlinedPrimary: {
          borderColor: 'rgba(155, 109, 255, 0.38)',
          color: '#C4B5FD',

          '&:hover': {
            borderColor: 'rgba(155, 109, 255, 0.60)',
            backgroundColor: 'rgba(139, 92, 246, 0.06)',
          },
        },

        contained: {
          '&.Mui-disabled': {
            backgroundColor: 'rgba(148, 163, 184, 0.14)',
            color: 'rgba(226, 232, 240, 0.38)',
          },
        },

        outlined: {
          '&.Mui-disabled': {
            borderColor: 'rgba(148, 163, 184, 0.14)',
            color: 'rgba(226, 232, 240, 0.32)',
          },
        },
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: '#111827',

          '& fieldset': {
            borderColor: 'rgba(139, 92, 246, 0.18)',
          },

          '&:hover fieldset': {
            borderColor: 'rgba(155, 109, 255, 0.36)',
          },

          '&.Mui-focused fieldset': {
            borderColor: '#9B6DFF',
          },
        },
      },
    },

    MuiAvatar: {
      styleOverrides: {
        root: {
          backgroundColor: '#6D28D9',
          color: '#F5F3FF',
          fontWeight: 700,
        },
      },
    },


  },
});