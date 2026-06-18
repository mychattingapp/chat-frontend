import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import { Avatar, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { confirmAvatarUpload, getAvatarUploadUrl } from "../api/profileApi";
import { validateAvatarFile } from "../utils/avatarValidation";
import { uploadToSignedUrl } from "../../../shared/utils/uploadToSignedUrl";

type AvatarUploadDialogProps = {
    open: boolean;
    currentImageSrc?: string;
    fallbackText: string;
    onClose: () => void;
    onUploaded: () => Promise<void>;
};

const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) {
        return error.message;
    }

    return "Something went wrong.";
};

export default function AvatarUploadDialog({
    open,
    currentImageSrc,
    fallbackText,
    onClose,
    onUploaded,
}: AvatarUploadDialogProps) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (!selectedFile) {
            setPreviewUrl(null);
            return;
        }

        const objectUrl = URL.createObjectURL(selectedFile);
        setPreviewUrl(objectUrl);

        return () => URL.revokeObjectURL(objectUrl);
    }, [selectedFile]);

    const reset = () => {
        setSelectedFile(null);
        setError(null);

        if (inputRef.current) {
            inputRef.current.value = "";
        }
    };

    const handleClose = () => {
        if (isUploading) {
            return;
        }

        reset();
        onClose();
    };

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] ?? null;

        if (!file) {
            setSelectedFile(null);
            setError(null);
            return;
        }

        const validationError = validateAvatarFile(file);

        if (validationError) {
            setSelectedFile(null);
            setError(validationError);
            return;
        }

        setSelectedFile(file);
        setError(null);
    };

    const handleUpload = async () => {
        if (!selectedFile || isUploading) {
            return;
        }

        setIsUploading(true);
        setError(null);

        try {
            const { uploadUrl, contentType } = await getAvatarUploadUrl(selectedFile);
            await uploadToSignedUrl(uploadUrl, selectedFile, contentType);
            await confirmAvatarUpload();
            await onUploaded();
            reset();
            onClose();
        }
        catch (uploadError: unknown) {
            setError(getErrorMessage(uploadError));
        }
        finally {
            setIsUploading(false);
        }
    };

    return (
        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
            <DialogTitle sx={{ fontWeight: 800 }}>
                Update profile photo
            </DialogTitle>
            <DialogContent>
                <Stack spacing={2.5} sx={{ pt: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        <Avatar
                            src={previewUrl ?? currentImageSrc}
                            sx={{ width: 112, height: 112, fontSize: 32, fontWeight: 800 }}
                        >
                            {!previewUrl && !currentImageSrc ? fallbackText : null}
                        </Avatar>
                    </Box>

                    <Button
                        component="label"
                        variant="outlined"
                        startIcon={<CloudUploadOutlinedIcon />}
                        disabled={isUploading}
                    >
                        Choose image
                        <input
                            ref={inputRef}
                            hidden
                            type="file"
                            accept="image/png,image/jpeg"
                            onChange={handleFileChange}
                        />
                    </Button>

                    <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                        PNG or JPEG, up to 5 MB.
                    </Typography>

                    {selectedFile && (
                        <Typography variant="body2" sx={{ color: 'text.primary', textAlign: 'center' }} noWrap>
                            {selectedFile.name}
                        </Typography>
                    )}

                    {error && (
                        <Typography variant="body2" sx={{ color: 'error.main', textAlign: 'center' }}>
                            {error}
                        </Typography>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button variant="outlined" onClick={handleClose} disabled={isUploading}>
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    disabled={!selectedFile || isUploading}
                    onClick={() => void handleUpload()}
                    startIcon={isUploading ? <CircularProgress size={16} color="inherit" /> : undefined}
                >
                    Upload
                </Button>
            </DialogActions>
        </Dialog>
    );
}
