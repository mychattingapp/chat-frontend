import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { Avatar, Box, Button, CircularProgress, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import type { FriendListItem, FriendView } from "../types";

type FriendListProps = {
    type: FriendView;
    items: FriendListItem[];
    isLoading: boolean;
    actionRequestId: string | null;
    onAccept: (friendRequestId: string) => Promise<void>;
    onReject: (friendRequestId: string) => Promise<void>;
    onMessage?: (friendId: string) => void;
    isReadOnly?: boolean;
    emptyMessage?: string;
};

export default function FriendList({
    type,
    items,
    isLoading,
    actionRequestId,
    onAccept,
    onReject,
    onMessage,
    isReadOnly = false,
    emptyMessage,
}: FriendListProps) {
    const getInitials = (name: string) => name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (items.length === 0) {
        return (
            <Box
                sx={{
                    p: 3,
                    borderRadius: 1,
                    backgroundColor: 'background.paper',
                    border: '1px dashed',
                    borderColor: 'divider',
                }}
            >
                <Typography sx={{ color: 'text.secondary' }}>
                    {emptyMessage ?? `No ${type === 'all' ? 'friends' : `${type} requests`} to show.`}
                </Typography>
            </Box>
        );
    }

    return (
        <Stack spacing={2} sx={{ width: '100%', maxWidth: 760, mx: 'auto' }}>
            {items.map((item) => (
                <Box
                    key={item.id}
                    sx={{
                        p: 2.25,
                        borderRadius: 1,
                        backgroundColor: 'background.paper',
                        border: '1px solid',
                        borderColor: 'divider',
                        opacity: isReadOnly ? 0.7 : 1,
                    }}
                >
                    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
                            {type === 'all' && (
                                <Avatar
                                    src={item.profileImageUrl ?? undefined}
                                    sx={{
                                        width: 42,
                                        height: 42,
                                        flexShrink: 0,
                                    }}
                                >
                                    {!item.profileImageUrl ? getInitials(item.username) : null}
                                </Avatar>
                            )}
                            <Box sx={{ minWidth: 0 }}>
                                <Typography sx={{ color: 'text.primary', fontWeight: 800 }} noWrap>
                                    {item.username}
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
                                    {item.email}
                                </Typography>
                            </Box>
                        </Stack>
                        {type === 'all' && !isReadOnly && (
                            <Tooltip title="Message">
                                <IconButton
                                    aria-label={`Message ${item.username}`}
                                    onClick={() => onMessage?.(item.id)}
                                    sx={{
                                        width: 38,
                                        height: 38,
                                        flexShrink: 0,
                                    }}
                                >
                                    <ChatBubbleOutlineIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        )}
                        {type === 'received' && !isReadOnly && (
                            <Stack direction="row" spacing={1}>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    disabled={actionRequestId === item.id}
                                    onClick={() => void onReject(item.id)}
                                >
                                    Reject
                                </Button>
                                <Button
                                    size="small"
                                    variant="contained"
                                    disabled={actionRequestId === item.id}
                                    onClick={() => void onAccept(item.id)}
                                    sx={{ fontWeight: 600 }}
                                >
                                    Accept
                                </Button>
                            </Stack>
                        )}
                    </Stack>
                </Box>
            ))}
        </Stack>
    );
}
