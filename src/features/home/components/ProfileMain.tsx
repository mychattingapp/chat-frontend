import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import { Avatar, Box, Button, CircularProgress, IconButton, Stack, TextField, Tooltip, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import useAuth from "../../auth/hooks/useAuth";
import { updateProfile } from "../api/profileApi";
import { useSnackbar } from "../../../shared/snackbar";
import { getProfileImageSrc } from "../../../shared/utils/profileImage";
import AvatarUploadDialog from "./AvatarUploadDialog";

const getInitials = (name: string) => name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) {
        return error.message;
    }

    return "Something went wrong.";
};

export default function ProfileMain() {
    const { user, refreshUser } = useAuth();
    const { showSnackbar } = useSnackbar();
    const [name, setName] = useState(user?.name ?? "");
    const [isSaving, setIsSaving] = useState(false);
    const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false);
    const trimmedName = name.trim();
    const isUnchanged = trimmedName === (user?.name ?? "");
    const avatarSrc = getProfileImageSrc(user?.profileImageUrl, user?.updatedAt);

    useEffect(() => {
        setName(user?.name ?? "");
    }, [user?.name]);

    const handleSave = async () => {
        if (!trimmedName || isSaving || isUnchanged) {
            return;
        }

        setIsSaving(true);

        try {
            await updateProfile(trimmedName);
            await refreshUser();
            showSnackbar({ message: "Profile updated.", severity: "success" });
        }
        catch (error: unknown) {
            showSnackbar({ message: getErrorMessage(error), severity: "error" });
        }
        finally {
            setIsSaving(false);
        }
    };

    return (
        <Box sx={{ width: '100%', flex: 1 }}>
            <Typography variant="h3" sx={{ color: 'text.primary', fontWeight: 800, mt: 1 }}>
                Profile settings
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', mt: 1.5, mb: 4 }}>
                Manage your account details.
            </Typography>
            <Box
                sx={{
                    width: '100%',
                    maxWidth: 620,
                    p: 3,
                    borderRadius: 1,
                    backgroundColor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                }}
            >
                <Stack spacing={3}>
                    <Stack direction="row" alignItems="center" spacing={2}>
                        <Box sx={{ position: 'relative', flexShrink: 0 }}>
                            <Avatar
                                src={avatarSrc}
                                sx={{ width: 72, height: 72, fontSize: 24, fontWeight: 800 }}
                            >
                                {!user?.profileImageUrl ? getInitials(user?.name ?? "User") : null}
                            </Avatar>
                            <Tooltip title="Change photo">
                                <IconButton
                                    aria-label="Change profile photo"
                                    onClick={() => setIsAvatarDialogOpen(true)}
                                    sx={{
                                        position: 'absolute',
                                        right: -6,
                                        bottom: -6,
                                        width: 32,
                                        height: 32,
                                        backgroundColor: 'background.default',
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        '&:hover': {
                                            backgroundColor: 'action.hover',
                                        },
                                    }}
                                >
                                    <PhotoCameraOutlinedIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ color: 'text.primary', fontWeight: 800 }} noWrap>
                                {user?.name ?? "Profile"}
                            </Typography>
                        </Box>
                    </Stack>

                    <TextField
                        label="Display name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        fullWidth
                        inputProps={{ maxLength: 80 }}
                    />

                    <TextField
                        label="Email"
                        value={user?.email ?? ""}
                        fullWidth
                        disabled
                    />

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                            variant="contained"
                            disabled={!trimmedName || isUnchanged || isSaving}
                            onClick={() => void handleSave()}
                            startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : undefined}
                        >
                            Save changes
                        </Button>
                    </Box>
                </Stack>
            </Box>
            <AvatarUploadDialog
                open={isAvatarDialogOpen}
                currentImageSrc={avatarSrc}
                fallbackText={getInitials(user?.name ?? "User")}
                onClose={() => setIsAvatarDialogOpen(false)}
                onUploaded={refreshUser}
            />
        </Box>
    );
}
