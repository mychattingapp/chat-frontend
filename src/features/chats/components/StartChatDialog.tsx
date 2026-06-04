import SearchIcon from '@mui/icons-material/Search';
import { Avatar, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, ListItemButton, Stack, TextField, Typography } from "@mui/material";
import { useMemo, useState } from "react";
import type { Friend } from "../../friends/types";

type StartChatDialogProps = {
    open: boolean;
    friends: Friend[];
    isLoadingFriends: boolean;
    isStartingChat: boolean;
    onClose: () => void;
    onStartChat: (friendId: string) => Promise<boolean>;
};

const getInitials = (name: string) => name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

export default function StartChatDialog({
    open,
    friends,
    isLoadingFriends,
    isStartingChat,
    onClose,
    onStartChat,
}: StartChatDialogProps) {
    const [query, setQuery] = useState("");
    const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);

    const filteredFriends = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();

        if (!normalizedQuery) {
            return friends;
        }

        return friends.filter((friend) =>
            friend.username.toLowerCase().includes(normalizedQuery)
            || friend.email.toLowerCase().includes(normalizedQuery)
        );
    }, [friends, query]);

    const handleClose = () => {
        setQuery("");
        setSelectedFriendId(null);
        onClose();
    };

    const handleStartChat = async () => {
        if (!selectedFriendId) return;

        const didStartChat = await onStartChat(selectedFriendId);

        if (didStartChat) {
            handleClose();
        }
    };

    return (
        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
            <DialogTitle sx={{ fontWeight: 800 }}>
                Start chat
            </DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ pt: 0.5 }}>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Search friends"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small" />
                                </InputAdornment>
                            ),
                        }}
                    />

                    <Stack spacing={1} sx={{ maxHeight: 360, overflow: 'auto' }}>
                        {isLoadingFriends && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                <CircularProgress size={28} />
                            </Box>
                        )}

                        {!isLoadingFriends && filteredFriends.length === 0 && (
                            <Box
                                sx={{
                                    p: 2,
                                    borderRadius: 1,
                                    border: '1px dashed',
                                    borderColor: 'divider',
                                }}
                            >
                                <Typography sx={{ color: 'text.secondary' }}>
                                    No friends to show.
                                </Typography>
                            </Box>
                        )}

                        {!isLoadingFriends && filteredFriends.map((friend) => (
                            <ListItemButton
                                key={friend.id}
                                selected={selectedFriendId === friend.id}
                                onClick={() => setSelectedFriendId(friend.id)}
                                sx={{ gap: 1.5 }}
                            >
                                <Avatar sx={{ width: 38, height: 38, flexShrink: 0 }}>
                                    {getInitials(friend.username)}
                                </Avatar>
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography sx={{ fontWeight: 800 }} noWrap>
                                        {friend.username}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
                                        {friend.email}
                                    </Typography>
                                </Box>
                            </ListItemButton>
                        ))}
                    </Stack>
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button variant="outlined" onClick={handleClose}>
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    disabled={!selectedFriendId || isStartingChat}
                    onClick={() => void handleStartChat()}
                >
                    Start
                </Button>
            </DialogActions>
        </Dialog>
    );
}
