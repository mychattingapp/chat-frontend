import { Box, Card, CardContent, Typography } from '@mui/material';
import bg from '../assets/message-center-svgrepo-com.png';

export default function HomeHeroComponent() {
    return (
        <Box
            sx={{
                height: '100%',
                backgroundImage: `url(${bg})`,
                backgroundSize: '60%',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center bottom',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                p: 4,
                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)',
            }}
        >
            <Card sx={{ backgroundColor: 'transparent', mt: 8 }} elevation={0}>
                <CardContent>
                    <Typography fontWeight={600} variant="h3" gutterBottom sx={{ color: '#333' }}>
                        Real-time messaging for everyone
                    </Typography>
                    <Typography variant="h6" sx={{ color: '#666', fontWeight: 400 }}>
                        Secure, fast, and built for seamless communication
                    </Typography>
                </CardContent>
            </Card>
        </Box>
    )
};