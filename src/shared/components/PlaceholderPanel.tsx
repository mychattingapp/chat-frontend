import { Box, Typography } from "@mui/material";

export default function PlaceholderPanel({ title, description }: { title: string; description: string }) {
    return (
        <Box
            sx={{
                border: '1px dashed',
                borderColor: 'divider',
                borderRadius: 1,
                p: 3,
                backgroundColor: 'background.paper',
            }}
        >
            <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 700 }}>
                {title}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                {description}
            </Typography>
        </Box>
    );
}
