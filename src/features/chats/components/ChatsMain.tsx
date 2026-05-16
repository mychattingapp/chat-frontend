import { Box, Typography } from "@mui/material";
import { PlaceholderPanel } from "../../../shared/components";

export default function ChatsMain() {
    return (
        <Box sx={{ width: '100%', flex: 1 }}>
            {/* <Typography variant="overline" sx={{ color: 'primary.light', fontWeight: 800, letterSpacing: 1.4 }}>
                Chats
            </Typography> */}
            <Typography variant="h3" sx={{ color: 'text.primary', fontWeight: 800, mt: 1 }}>
                Chat messaging coming soon
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', mt: 1.5, mb: 4 }}>
                Friend requests are available now. Real-time conversations will be added next.
            </Typography>
            <Box sx={{ maxWidth: 680 }}>
                <PlaceholderPanel
                    title="No chats yet"
                    description="Once messaging is wired in, selected conversations, message history, and the composer will render here."
                />
            </Box>
        </Box>
    );
}
