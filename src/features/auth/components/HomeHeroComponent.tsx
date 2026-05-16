import { Box, Typography } from '@mui/material';
import heroChatIcon from '../../../assets/chat-conversation-svgrepo-com.svg';

export default function HomeHeroComponent() {
    return (
        <Box
            sx={{
                height: '100%',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
                paddingTop: 6,
                px: { md: 5, lg: 7 },
                backgroundColor: 'background.default',
                borderRight: '1px solid',
                borderColor: 'divider',
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            <Box sx={{ mt: 4, maxWidth: 600 }}>
                <Typography
                    variant='h6'
                    sx={{
                        color: 'primary.light',
                        fontWeight: 800,
                        letterSpacing: 1.4,
                    }}
                >
                    MyChattingApp
                </Typography>
                <Typography fontWeight={800} variant="h4" gutterBottom sx={{ color: 'text.primary', mt: 1 }}>
                    Real-time messaging for everyone
                </Typography>
                <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 400 }}>
                    Chat with friends in real time.
                </Typography>
            </Box>
            <Box
                component="img"
                src={heroChatIcon}
                alt=""
                sx={{
                    position: 'absolute',
                    right: { md: -48, lg: -40 },
                    bottom: { md: 20, lg: 28 },
                    width: { md: 460, lg: 620 },
                    maxWidth: '72%',
                    height: { md: 220, lg: 290 },
                    opacity: 0.15,
                }}
            />
        </Box>
    )
};
