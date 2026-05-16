import { Box, Typography } from "@mui/material";

export default function ChatsSidebar() {
    return (
        <Box
            sx={{
                p: 2,
                borderRadius: 1,
                backgroundColor: 'background.default',
                border: '1px dashed',
                borderColor: 'divider',
            }}
        >
            <Typography sx={{ color: 'text.primary', fontWeight: 800 }}>
                Chats coming soon
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                Conversations will appear here after chat messaging is wired in.
            </Typography>
        </Box>
    );
}
