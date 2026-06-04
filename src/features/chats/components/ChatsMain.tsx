import MoreVertIcon from '@mui/icons-material/MoreVert';
import SendIcon from '@mui/icons-material/Send';
import { Avatar, Box, Button, CircularProgress, IconButton, Stack, TextField, Tooltip, Typography } from "@mui/material";
import type { Chat, ChatMessage } from '../types';
import useAuth from '../../auth/hooks/useAuth';
import { useLayoutEffect, useRef, useState } from 'react';

type ChatsMainProps = {
    chat: Chat | null;
    messages: ChatMessage[];
    isLoadingMessages: boolean;
    loadError: string | null;
    hasMoreMessages: boolean;
    loadMoreMessages: () => Promise<boolean>;
    sendMessage: (content: string) => Promise<boolean>;
};

const GROUP_WINDOW_MS = 5 * 60 * 1000;

const formatMessageTime = (createdAt: string) => new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
}).format(new Date(createdAt));

const formatDetailedTimestamp = (createdAt: string) => new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
}).format(new Date(createdAt));

const isWithinGroupWindow = (message: ChatMessage, adjacentMessage: ChatMessage | undefined) => {
    if (!adjacentMessage || message.senderId !== adjacentMessage.senderId) {
        return false;
    }

    return Math.abs(new Date(message.createdAt).getTime() - new Date(adjacentMessage.createdAt).getTime()) <= GROUP_WINDOW_MS;
};

export default function ChatsMain({
    chat,
    hasMoreMessages,
    messages,
    isLoadingMessages,
    loadError,
    loadMoreMessages,
    sendMessage,
}: ChatsMainProps) {
    const { user } = useAuth();
    const currentUserId = user?.id;
    const initials = chat?.title
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "CH";
    const [messageContent, setMessageContent] = useState("");
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const previousChatIdRef = useRef<string | null>(null);
    const previousLastMessageIdRef = useRef<string | null>(null);
    const preserveScrollHeightRef = useRef<number | null>(null);
    const wasNearBottomRef = useRef(true);

    const handleSendMessage = async () => {
        const trimmedContent = messageContent.trim();
        if (!trimmedContent) return;

        wasNearBottomRef.current = isNearBottom();
        const didSend = await sendMessage(trimmedContent);

        if (didSend) {
            setMessageContent("");
        }
    }

    const isNearBottom = () => {
        const container = scrollContainerRef.current;

        if (!container) {
            return true;
        }

        return container.scrollHeight - container.scrollTop - container.clientHeight < 96;
    };

    const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
        const container = scrollContainerRef.current;

        if (!container) {
            return;
        }

        container.scrollTo({
            top: container.scrollHeight,
            behavior,
        });
    };

    const handleLoadMoreMessages = async () => {
        const container = scrollContainerRef.current;

        if (container) {
            preserveScrollHeightRef.current = container.scrollHeight;
        }

        const didLoadMore = await loadMoreMessages();

        if (!didLoadMore) {
            preserveScrollHeightRef.current = null;
        }
    };

    useLayoutEffect(() => {
        const container = scrollContainerRef.current;

        if (!container || !chat) {
            return;
        }

        const currentLastMessage = messages[messages.length - 1] ?? null;
        const chatChanged = previousChatIdRef.current !== chat.id;

        if (chatChanged) {
            if (messages.length === 0) {
                return;
            }

            previousChatIdRef.current = chat.id;
            previousLastMessageIdRef.current = currentLastMessage?.id ?? null;
            preserveScrollHeightRef.current = null;
            scrollToBottom();
            return;
        }

        if (preserveScrollHeightRef.current !== null) {
            const previousScrollHeight = preserveScrollHeightRef.current;
            preserveScrollHeightRef.current = null;
            container.scrollTop = container.scrollHeight - previousScrollHeight + container.scrollTop;
            previousLastMessageIdRef.current = currentLastMessage?.id ?? null;
            return;
        }

        if (currentLastMessage?.id && currentLastMessage.id !== previousLastMessageIdRef.current) {
            const isOwnNewMessage = currentLastMessage.senderId === currentUserId;

            if (wasNearBottomRef.current || isOwnNewMessage) {
                scrollToBottom(isOwnNewMessage ? 'smooth' : 'auto');
            }
        }

        previousLastMessageIdRef.current = currentLastMessage?.id ?? null;
    }, [chat, currentUserId, messages]);

    if (!chat) {
        return (
            <Box
                sx={{
                    width: '100%',
                    flex: 1,
                    minHeight: 0,
                    display: 'grid',
                    placeItems: 'center',
                    backgroundColor: 'background.default',
                }}
            >
                <Box sx={{ maxWidth: 420, px: 3, textAlign: 'center' }}>
                    <Typography variant="h5" sx={{ color: 'text.primary', fontWeight: 800 }}>
                        No chat selected
                    </Typography>
                    <Typography sx={{ color: 'text.secondary', mt: 1 }}>
                        Pick a conversation from the sidebar or start one from your friends list.
                    </Typography>
                </Box>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                width: '100%',
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                backgroundColor: 'background.paper',
                overflow: 'hidden',
            }}
        >
            <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                spacing={2}
                sx={{
                    px: 2.5,
                    py: 2,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    flexShrink: 0,
                }}
            >
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
                    <Avatar sx={{ width: 42, height: 42 }}>{initials}</Avatar>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ color: 'text.primary', fontWeight: 800 }} noWrap>
                            {chat.title}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
                            Direct messages
                        </Typography>
                    </Box>
                </Stack>
                <Tooltip title="Conversation actions">
                    <span>
                        <IconButton aria-label="Conversation actions" disabled>
                            <MoreVertIcon />
                        </IconButton>
                    </span>
                </Tooltip>
            </Stack>

            <Box
                ref={scrollContainerRef}
                onScroll={() => {
                    wasNearBottomRef.current = isNearBottom();
                }}
                sx={{
                    flex: 1,
                    minHeight: 0,
                    overflow: 'auto',
                    px: { xs: 2, md: 4 },
                    py: 3,
                    backgroundColor: 'background.default',
                }}
            >
                <Stack spacing={1.5} sx={{ minHeight: '100%', justifyContent: 'flex-end', }}>
                    {isLoadingMessages && messages.length === 0 && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <CircularProgress size={28} />
                        </Box>
                    )}

                    {loadError && messages.length === 0 && (
                        <Box
                            sx={{
                                p: 2,
                                borderRadius: 1,
                                backgroundColor: 'background.paper',
                                border: '1px solid',
                                borderColor: 'divider',
                            }}
                        >
                            <Typography sx={{ color: 'text.primary', fontWeight: 800 }}>
                                Could not load messages.
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75 }}>
                                {loadError}
                            </Typography>
                        </Box>
                    )}

                    {hasMoreMessages && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', pb: 1 }}>
                            <Button
                                size="small"
                                variant="outlined"
                                disabled={isLoadingMessages}
                                onClick={() => void handleLoadMoreMessages()}
                            >
                                Load older messages
                            </Button>
                        </Box>
                    )}

                    {messages.length === 0 && !isLoadingMessages && !loadError && (
                        <Typography sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
                            No messages yet.
                        </Typography>
                    )}

                    {messages.map((message, index) => {
                        const isOwn = message.senderId === currentUserId;
                        const previousMessage = messages[index - 1];
                        const nextMessage = messages[index + 1];
                        const continuesPreviousGroup = isWithinGroupWindow(message, previousMessage);
                        const continuesNextGroup = isWithinGroupWindow(message, nextMessage);
                        const showGroupTime = !continuesNextGroup;

                        return (
                            <Box
                                key={message.id}
                                sx={{
                                    display: 'flex',
                                    justifyContent: isOwn ? 'flex-end' : 'flex-start',
                                    mt: continuesPreviousGroup ? 0.25 : 1.25,
                                }}
                            >
                                <Stack
                                    spacing={0.35}
                                    alignItems={isOwn ? 'flex-end' : 'flex-start'}
                                    sx={{ maxWidth: 'min(520px, 78%)', minWidth: 0 }}
                                >
                                    <Tooltip title={formatDetailedTimestamp(message.createdAt)} placement={isOwn ? 'left' : 'right'}>
                                        <Box
                                            sx={{
                                                maxWidth: '100%',
                                                minWidth: 0,
                                                px: 1.75,
                                                py: 1,
                                                borderRadius: 1,
                                                backgroundColor: isOwn ? 'primary.main' : 'background.paper',
                                                color: isOwn ? 'primary.contrastText' : 'text.primary',
                                                border: '1px solid',
                                                borderColor: isOwn ? 'primary.main' : 'divider',
                                            }}
                                        >
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    whiteSpace: 'pre-wrap',
                                                    overflowWrap: 'anywhere',
                                                    wordBreak: 'break-word',
                                                }}
                                            >
                                                {message.text}
                                            </Typography>
                                        </Box>
                                    </Tooltip>
                                    {showGroupTime && (
                                        <Typography variant="caption" sx={{ color: 'text.secondary', px: 0.5 }}>
                                            {formatMessageTime(message.createdAt)}
                                        </Typography>
                                    )}
                                </Stack>
                            </Box>
                        );
                    })}
                </Stack>
            </Box>

            <Stack
                direction="row"
                spacing={1}
                alignItems="flex-end"
                sx={{
                    p: 2,
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    flexShrink: 0,
                }}
            >
                <TextField
                    fullWidth
                    multiline
                    maxRows={4}
                    size="small"
                    placeholder="Message"
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                        }
                    }}
                />
                <Tooltip title="Send message">
                    <span>
                        <IconButton
                            aria-label="Send message"
                            disabled={!messageContent.trim()}
                            sx={{
                                width: 40,
                                height: 40,
                                color: 'primary.contrastText',
                                backgroundColor: 'primary.main',
                                '&.Mui-disabled': {
                                    backgroundColor: 'rgba(148, 163, 184, 0.14)',
                                    color: 'rgba(226, 232, 240, 0.32)',
                                },
                            }}
                            onClick={() => handleSendMessage()}
                        >
                            <SendIcon fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>
            </Stack>
        </Box>
    );
}
