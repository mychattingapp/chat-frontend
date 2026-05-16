import { Box, Button, Typography } from "@mui/material";
import { FcGoogle } from "react-icons/fc";
import { FaMicrosoft, FaApple } from "react-icons/fa";
import { useOAuthLogin } from "../index";

const authButtonSx = {
    mt: 2,
    height: 52,
    py: 0,
    fontWeight: 700,
    backgroundColor: 'background.default',
    border: '1px solid',
    borderColor: 'divider',
    '& .MuiButton-startIcon': {
        width: 24,
        justifyContent: 'center',
    },
};

function IconBox({ children }: { children: React.ReactNode }) {
    return (
        <Box component="span" sx={{ width: 22, height: 22, display: 'grid', placeItems: 'center' }}>
            {children}
        </Box>
    );
}

export default function LoginComponent() {
    const { loginWithGoogle, isLoading } = useOAuthLogin();

    return (
        <Box
            sx={{
                p: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                backgroundColor: 'background.paper',
            }}
        >
            <Box sx={{ width: '100%', maxWidth: 400 }}>
                <Typography
                    variant="h4"
                    component="h1"
                    gutterBottom
                    align="center"
                    sx={{ fontWeight: 800, mb: 1, color: 'text.primary' }}
                >
                    Welcome
                </Typography>
                <Typography
                    variant="body2"
                    align="center"
                    sx={{ mb: 4, color: 'text.secondary' }}
                >
                    Sign in to continue
                </Typography>

                <Button
                    variant="contained"
                    fullWidth
                    startIcon={<IconBox><FcGoogle size={22} /></IconBox>}
                    onClick={loginWithGoogle}
                    disabled={isLoading}
                    sx={{
                        ...authButtonSx,
                        color: 'text.primary',
                        '&:hover': {
                            backgroundColor: 'action.hover',
                            borderColor: 'primary.light',
                        },
                        '&.Mui-focusVisible': {
                            borderColor: 'primary.light',
                        },
                    }}
                >
                    Continue with Google
                </Button>

                <Button
                    variant="contained"
                    fullWidth
                    startIcon={<IconBox><FaMicrosoft size={20} color="#00A4EF" /></IconBox>}
                    disabled={true}
                    sx={{
                        ...authButtonSx,
                        color: 'text.secondary',
                        opacity: 0.7,
                        '&:hover': {
                            backgroundColor: 'action.hover',
                        }
                    }}
                >
                    Continue with Microsoft
                </Button>

                <Button
                    variant="contained"
                    fullWidth
                    startIcon={<IconBox><FaApple size={21} /></IconBox>}
                    disabled={true}
                    sx={{
                        ...authButtonSx,
                        color: 'text.secondary',
                        opacity: 0.7,
                        '&:hover': {
                            backgroundColor: 'action.hover',
                        }
                    }}
                >
                    Continue with Apple
                </Button>
            </Box>
        </Box>
    );
}
