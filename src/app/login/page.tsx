import { Grid, Card, Box } from '@mui/material';
import HomeHeroComponent from '../../features/auth/components/HomeHeroComponent';
import LoginComponent from '../../features/auth/components/LoginComponent';

export default function LoginPage() {
    return (
        <Box
            sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '100vh',
                width: '100vw',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }}
        >
            <Grid
                container
                sx={{
                    minHeight: '80vh',
                    minWidth: { xs: '95vw', md: '80vw' },
                    backgroundColor: '#fff',
                    borderRadius: 2,
                    overflow: 'hidden',
                }}
                component={Card}
                elevation={8}
            >
                <Grid size={{ xs: 0, md: 8 }}>
                    <HomeHeroComponent />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <LoginComponent />
                </Grid>
            </Grid>
        </Box>
    );
}
