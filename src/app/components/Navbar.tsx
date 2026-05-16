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
                backgroundColor: 'background.paper',
                borderBottom: '1px solid',
                borderColor: 'divider',
            }}
        >
            <Toolbar>
                <Typography
                    variant="h6"
                    component="div"
                    sx={{
                        flexGrow: 1,
                        fontWeight: 600,
                        color: 'text.primary',
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
                            color: 'text.secondary',
                            '&:hover': {
                                backgroundColor: 'action.hover',
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
