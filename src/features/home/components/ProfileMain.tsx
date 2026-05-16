import { Box, Typography } from "@mui/material";
import { PlaceholderPanel } from "../../../shared/components";

export default function ProfileMain() {
    return (
        <Box sx={{ width: '100%', flex: 1 }}>
            {/* <Typography variant="overline" sx={{ color: 'primary.light', fontWeight: 800, letterSpacing: 1.4 }}>
                Profile
            </Typography> */}
            <Typography variant="h3" sx={{ color: 'text.primary', fontWeight: 800, mt: 1 }}>
                Profile settings
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', mt: 1.5, mb: 4 }}>
                Account details and profile controls will render here.
            </Typography>
            <PlaceholderPanel
                title="Profile main panel"
                description="This empty state is intentionally static for now. API data and real interaction can be added tab by tab."
            />
        </Box>
    );
}
