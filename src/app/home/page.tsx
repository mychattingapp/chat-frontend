import { Box, Container, Typography } from "@mui/material";
import useOAuthLogin from "../../features/auth/hooks/useOAuthLogin";
import { Navbar } from "../components";

export default function HomePage() {
    const { handleLogout } = useOAuthLogin();

    return (
        <Box sx={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
            <Navbar onLogout={handleLogout} />
            <Container maxWidth="xl" sx={{ mt: 4 }}>
                <Typography variant="h4" component="h1" sx={{ fontWeight: 600, color: '#333' }}>
                    Welcome
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                    Your chats will appear here
                </Typography>
            </Container>
        </Box>
    );
}
