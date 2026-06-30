import { Box, ListItemButton, Stack, Typography } from "@mui/material";
import type { FriendRequestCounts, FriendView } from "../types";

const friendTabs: Array<{ id: FriendView; label: string }> = [
    { id: 'all', label: 'All friends' },
    { id: 'received', label: 'Received' },
    { id: 'sent', label: 'Sent' },
    { id: 'blocked', label: 'Blocked users' },
];

export default function FriendsSidebar({
    activeFriendView,
    onFriendViewChange,
    counts,
}: {
    activeFriendView: FriendView | null;
    onFriendViewChange: (view: FriendView) => void;
    counts: FriendRequestCounts;
}) {
    return (
        <Stack spacing={1.5}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Manage friends
            </Typography>
            {friendTabs.map((tab) => {
                const selected = activeFriendView === tab.id;

                return (
                    <ListItemButton
                        key={tab.id}
                        selected={selected}
                        onClick={() => onFriendViewChange(tab.id)}
                        sx={{ justifyContent: 'space-between', gap: 2 }}
                    >
                        <Typography sx={{ fontWeight: selected ? 800 : 700 }}>
                            {tab.label}
                        </Typography>
                        <Box
                            component="span"
                            sx={{
                                minWidth: 26,
                                height: 24,
                                px: 1,
                                borderRadius: 1,
                                display: 'grid',
                                placeItems: 'center',
                                color: selected ? 'primary.light' : 'text.secondary',
                                backgroundColor: selected
                                    ? 'rgba(139, 92, 246, 0.14)'
                                    : 'rgba(255,255,255,0.04)',
                                border: selected
                                    ? '1px solid rgba(139, 92, 246, 0.18)'
                                    : '1px solid rgba(255,255,255,0.04)', fontWeight: 800,
                                fontSize: 13,
                            }}
                        >
                            {counts[tab.id]}
                        </Box>
                    </ListItemButton>
                );
            })}
        </Stack>
    );
}
