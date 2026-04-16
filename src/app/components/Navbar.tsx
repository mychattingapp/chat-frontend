import { AppBar, Toolbar, Typography, Button, Box } from "@mui/material";
import LogoutIcon from '@mui/icons-material/Logout';

interface NavbarProps {
    onLogout: () => void;
}

export default function Navbar({ onLogout }: NavbarProps) {
    return (
        <AppBar
            position="static"
            elevation={0}
            sx={{
                backgroundColor: '#fff',
                borderBottom: '1px solid #e0e0e0',
            }}
        >
            <Toolbar>
                <Typography
                    variant="h6"
                    component="div"
                    sx={{
                        flexGrow: 1,
                        fontWeight: 600,
                        color: '#333',
                    }}
                >
                    ChatApp
                </Typography>
                <Box>
                    <Button
                        color="inherit"
                        onClick={onLogout}
                        startIcon={<LogoutIcon />}
                        sx={{
                            color: '#666',
                            '&:hover': {
                                backgroundColor: 'rgba(0, 0, 0, 0.04)',
                            }
                        }}
                    >
                        Logout
                    </Button>
                </Box>
            </Toolbar>
        </AppBar>
    );
}
