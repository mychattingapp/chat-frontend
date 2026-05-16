import { Alert, Snackbar } from "@mui/material";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type SnackbarSeverity = "success" | "error" | "info" | "warning";

type SnackbarOptions = {
    message: string;
    severity?: SnackbarSeverity;
};

type SnackbarState = Required<SnackbarOptions> & {
    open: boolean;
};

type SnackbarContextValue = {
    showSnackbar: (options: SnackbarOptions) => void;
};

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

export function SnackbarProvider({ children }: { children: ReactNode }) {
    const [snackbar, setSnackbar] = useState<SnackbarState>({
        open: false,
        message: "",
        severity: "info",
    });

    const showSnackbar = useCallback(({ message, severity = "info" }: SnackbarOptions) => {
        setSnackbar({
            open: true,
            message,
            severity,
        });
    }, []);

    const handleClose = (_event?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === "clickaway") {
            return;
        }

        setSnackbar((current) => ({
            ...current,
            open: false,
        }));
    };

    return (
        <SnackbarContext.Provider value={{ showSnackbar }}>
            {children}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={3500}
                onClose={handleClose}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                sx={{ maxWidth: { xs: 'calc(100% - 32px)', sm: 420 } }}
            >
                <Alert
                    variant="filled"
                    severity={snackbar.severity}
                    onClose={handleClose}
                    sx={{
                        width: "100%",
                        alignItems: 'center',
                        '& .MuiAlert-message': {
                            overflowWrap: 'anywhere',
                        },
                    }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </SnackbarContext.Provider>
    );
}

export function useSnackbar() {
    const context = useContext(SnackbarContext);

    if (!context) {
        throw new Error("useSnackbar must be used inside SnackbarProvider");
    }

    return context;
}
