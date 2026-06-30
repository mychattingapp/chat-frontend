import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Typography,
} from "@mui/material";

type LogoutConfirmDialogProps = {
    open: boolean;
    isLoggingOut: boolean;
    onClose: () => void;
    onConfirm: () => void;
};

export default function LogoutConfirmDialog({
    open,
    isLoggingOut,
    onClose,
    onConfirm,
}: LogoutConfirmDialogProps) {
    return (
        <Dialog
            open={open}
            onClose={isLoggingOut ? undefined : onClose}
            fullWidth
            maxWidth="xs"
            slotProps={{
                paper: {
                    sx: {
                        m: { xs: 1.5, sm: 4 },
                    },
                },
            }}
        >
            <DialogTitle sx={{ fontWeight: 800 }}>
                Log out of MyChattingApp?
            </DialogTitle>
            <DialogContent>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    You'll need to sign in again to continue.
                </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 3 }}>
                <Button variant="outlined" onClick={onClose} disabled={isLoggingOut}>
                    Cancel
                </Button>
                <Button variant="contained" onClick={onConfirm} disabled={isLoggingOut}>
                    {isLoggingOut ? "Logging out..." : "Log out"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
