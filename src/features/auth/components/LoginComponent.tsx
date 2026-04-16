import { Box, Button, Typography } from "@mui/material";
import { FcGoogle } from "react-icons/fc";
import { FaMicrosoft, FaApple } from "react-icons/fa";
import { useOAuthLogin } from "../index";

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
            }}
        >
            <Box sx={{ width: '100%', maxWidth: 400 }}>
                <Typography
                    variant="h4"
                    component="h1"
                    gutterBottom
                    align="center"
                    sx={{ fontWeight: 600, mb: 1 }}
                >
                    Welcome
                </Typography>
                <Typography
                    variant="body2"
                    align="center"
                    color="text.secondary"
                    sx={{ mb: 4 }}
                >
                    Sign in to continue
                </Typography>

                <Button
                    variant="contained"
                    fullWidth
                    startIcon={<FcGoogle size={20} />}
                    onClick={loginWithGoogle}
                    disabled={isLoading}
                    sx={{
                        mt: 2,
                        py: 1.5,
                        fontWeight: 500,
                        backgroundColor: '#fff',
                        color: '#333',
                        border: '1px solid #ddd',
                        '&:hover': {
                            backgroundColor: '#f5f5f5',
                        }
                    }}
                >
                    Continue with Google
                </Button>

                <Button
                    variant="contained"
                    fullWidth
                    startIcon={<FaMicrosoft size={20} color="#00A4EF" />}
                    disabled={true}
                    sx={{
                        mt: 2,
                        py: 1.5,
                        fontWeight: 500,
                        backgroundColor: '#fff',
                        color: '#333',
                        border: '1px solid #ddd',
                        '&:hover': {
                            backgroundColor: '#f5f5f5',
                        }
                    }}
                >
                    Continue with Microsoft
                </Button>

                <Button
                    variant="contained"
                    fullWidth
                    startIcon={<FaApple size={20} />}
                    disabled={true}
                    sx={{
                        mt: 2,
                        py: 1.5,
                        fontWeight: 500,
                        backgroundColor: '#000',
                        color: '#fff',
                        '&:hover': {
                            backgroundColor: '#333',
                        }
                    }}
                >
                    Continue with Apple
                </Button>
            </Box>
        </Box>
    );
}