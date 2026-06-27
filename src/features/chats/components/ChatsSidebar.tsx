import AddCommentOutlinedIcon from '@mui/icons-material/AddCommentOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import SearchIcon from '@mui/icons-material/Search';
import { Avatar, Badge, Box, Button, CircularProgress, InputAdornment, ListItemButton, Stack, TextField, Typography } from "@mui/material";
import type { Chat } from "../types";
import { formatRelativeChatDate } from '../utils/dateFormatters';
import { getProfileImageSrc } from '../../../shared/utils/profileImage';

type ChatsSidebarProps = {
    chats: Chat[];
    isLoading: boolean;
    loadError: string | null;
    selectedChatId?: string | null;
    onRetry: () => void;
    onSelectChat?: (chatId: string) => void;
    onStartChat?: () => void;
};

export default function ChatsSidebar({
    chats,
    isLoading,
    loadError,
    selectedChatId,
    onRetry,
    onSelectChat,
    onStartChat,
}: ChatsSidebarProps) {
    const getInitials = (name: string) => name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();
    const getDirectChatParticipant = (chat: Chat) => chat.chatType === 'DIRECT'
        ? chat.participants[0] ?? null
        : null;
    const getLastMessagePreview = (chat: Chat) => {
        if (!chat.lastMessage) {
            return { text: 'No messages yet', isImageFallback: false };
        }

        return chat.lastMessage.text
            ? { text: chat.lastMessage.text, isImageFallback: false }
            : { text: chat.lastMessage.hasImage ? 'Image' : 'No messages yet', isImageFallback: chat.lastMessage.hasImage };
    };

    return (
        <Stack spacing={2}>
            <Button
                fullWidth
                variant="contained"
                startIcon={<AddCommentOutlinedIcon />}
                onClick={onStartChat}
            >
                Start chat
            </Button>

            <TextField
                fullWidth
                size="small"
                placeholder="Search chats"
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchIcon fontSize="small" />
                        </InputAdornment>
                    ),
                }}
            />

            <Stack spacing={1}>
                {isLoading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress size={28} />
                    </Box>
                )}

                {!isLoading && loadError && (
                    <Box
                        sx={{
                            p: 2,
                            borderRadius: 1,
                            backgroundColor: 'background.default',
                            border: '1px solid',
                            borderColor: 'divider',
                        }}
                    >
                        <Typography sx={{ color: 'text.primary', fontWeight: 800 }}>
                            Could not load chats.
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75 }}>
                            {loadError}
                        </Typography>
                        <Button variant="outlined" size="small" sx={{ mt: 1.5 }} onClick={onRetry}>
                            Retry
                        </Button>
                    </Box>
                )}

                {!isLoading && !loadError && chats.length === 0 && (
                    <Box
                        sx={{
                            p: 2,
                            borderRadius: 1,
                            backgroundColor: 'background.default',
                            border: '1px dashed',
                            borderColor: 'divider',
                        }}
                    >
                        <Typography sx={{ color: 'text.primary', fontWeight: 800 }}>
                            No chats yet
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75 }}>
                            Start a chat from your friends list.
                        </Typography>
                    </Box>
                )}

                {!isLoading && !loadError && chats.map((chat) => {
                    const directParticipant = getDirectChatParticipant(chat);
                    const chatImageUrl = directParticipant?.profileImageUrl ?? null;
                    const lastMessagePreview = getLastMessagePreview(chat);

                    return (
                        <ListItemButton
                            key={chat.id}
                            selected={chat.id === selectedChatId}
                            onClick={() => onSelectChat?.(chat.id)}
                            sx={{
                                alignItems: 'center',
                                gap: 1.5,
                                py: 1.5,
                            }}
                        >
                            <Avatar src={getProfileImageSrc(chatImageUrl, directParticipant?.updatedAt)} sx={{ width: 42, height: 42, flexShrink: 0 }}>
                                {!chatImageUrl ? getInitials(chat.title) : null}
                            </Avatar>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ minWidth: 0 }}>
                                    <Typography sx={{ color: 'text.primary', fontWeight: 800, minWidth: 0 }} noWrap>
                                        {chat.title}
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        sx={{ color: 'text.secondary', flexShrink: 0, lineHeight: 1.4 }}
                                    >
                                        {formatRelativeChatDate(chat.lastMessage?.createdAt ?? chat.updatedAt, true)}
                                    </Typography>
                                </Stack>
                                <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            color: chat.unreadCount > 0 ? 'text.primary' : 'text.secondary',
                                            fontWeight: chat.unreadCount > 0 ? 700 : 400,
                                            minWidth: 0,
                                            flex: 1,
                                        }}
                                        noWrap
                                    >
                                        {lastMessagePreview.isImageFallback ? (
                                            <Stack component="span" direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
                                                <ImageOutlinedIcon sx={{ fontSize: 16, flexShrink: 0 }} />
                                                <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {lastMessagePreview.text}
                                                </Box>
                                            </Stack>
                                        ) : lastMessagePreview.text}
                                    </Typography>
                                    {chat.unreadCount > 0 && (
                                        <Badge
                                            badgeContent={chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                                            color="primary"
                                            sx={{
                                                flexShrink: 0,
                                                '& .MuiBadge-badge': {
                                                    position: 'static',
                                                    transform: 'none',
                                                    minWidth: 20,
                                                    height: 20,
                                                    px: 0.75,
                                                    fontSize: 11,
                                                    fontWeight: 800,
                                                },
                                            }}
                                        />
                                    )}
                                </Stack>
                            </Box>
                        </ListItemButton>
                    );
                })}
            </Stack>
        </Stack>
    );
}
