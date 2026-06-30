import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    TextField,
    Typography,
} from "@mui/material";
import { useState } from "react";

type AddFriendDialogProps = {
    open: boolean;
    isSending: boolean;
    onClose: () => void;
    onSend: (email: string) => Promise<boolean>;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AddFriendDialog({
    open,
    isSending,
    onClose,
    onSend,
}: AddFriendDialogProps) {
    const [email, setEmail] = useState("");
    const [emailError, setEmailError] = useState<string | null>(null);
    const trimmedEmail = email.trim();
    const isEmailEmpty = trimmedEmail.length === 0;

    const resetAndClose = () => {
        if (isSending) {
            return;
        }

        setEmail("");
        setEmailError(null);
        onClose();
    };

    const handleSubmit = async () => {
        if (isEmailEmpty) {
            return;
        }

        if (!emailPattern.test(trimmedEmail)) {
            setEmailError("Enter a valid email address.");
            return;
        }

        setEmailError(null);
        const didSend = await onSend(trimmedEmail);

        if (didSend) {
            setEmail("");
            onClose();
        }
    };

    return (
        <Dialog
            open={open}
            onClose={resetAndClose}
            fullWidth
            maxWidth="xs"
            slotProps={{
                paper: {
                    sx: {
                        m: { xs: 1.5, sm: 4 },
                        maxHeight: { xs: 'calc(100dvh - 24px)', sm: 'calc(100% - 64px)' },
                    },
                },
            }}
        >
            <DialogTitle sx={{ fontWeight: 800 }}>Add friend</DialogTitle>
            <DialogContent>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                    Enter the email address your friend used to sign up.
                </Typography>
                <Box component="form" onSubmit={(event) => {
                    event.preventDefault();
                    void handleSubmit();
                }}>
                    <TextField
                        autoFocus
                        fullWidth
                        label="Email"
                        type="email"
                        value={email}
                        error={Boolean(emailError)}
                        helperText={emailError}
                        disabled={isSending}
                        onChange={(event) => {
                            const nextEmail = event.target.value;
                            setEmail(nextEmail);
                            if (emailError) {
                                setEmailError(null);
                            }
                        }}
                    />
                </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 3 }}>
                <Button variant="outlined" onClick={resetAndClose} disabled={isSending}>
                    Cancel
                </Button>
                <Button variant="contained" onClick={() => void handleSubmit()} disabled={isSending || isEmailEmpty}>
                    {isSending ? "Sending..." : "Send request"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
