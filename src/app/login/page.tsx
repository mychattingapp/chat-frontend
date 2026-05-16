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
                height: '100vh',
                width: '100%',
                overflow: 'hidden',
                backgroundColor: 'background.default',
                p: { xs: 2, md: 4 },
            }}
        >
            <Grid
                container
                sx={{
                    minHeight: '80vh',
                    width: { xs: '100%', md: '88vw' },
                    maxWidth: 1360,
                    backgroundColor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    overflow: 'hidden',
                }}
                component={Card}
                elevation={0}
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
