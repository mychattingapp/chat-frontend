import InsertEmoticonOutlinedIcon from '@mui/icons-material/InsertEmoticonOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SendIcon from '@mui/icons-material/Send';
import { Avatar, Box, Button, CircularProgress, IconButton, Popover, Stack, TextField, Tooltip, Typography } from "@mui/material";
import type { Chat, ChatMessage } from '../types';
import useAuth from '../../auth/hooks/useAuth';
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { formatRelativeChatDate, isSameCalendarDate } from '../utils/dateFormatters';

type ChatsMainProps = {
    chat: Chat | null;
    messages: ChatMessage[];
    isLoadingMessages: boolean;
    isSendingMessage: boolean;
    newMessagesDividerMessageId: string | null;
    loadError: string | null;
    hasMoreMessages: boolean;
    loadMoreMessages: () => Promise<boolean>;
    sendMessage: (content: string) => Promise<boolean>;
};

const GROUP_WINDOW_MS = 5 * 60 * 1000;
const SCROLL_TO_BOTTOM_THRESHOLD = 160;
const FACE_EMOJIS = [
    '😀',
    '😃',
    '😄',
    '😁',
    '😅',
    '😆',
    '😂',
    '🤣',
    '🙂',
    '😊',
    '☺️',
    '😋',
    '😍',
    '🥰',
    '😘',
    '😗',
    '😙',
    '😚',
    '😎',
    '🤩',
    '🥹',
    '😌',
    '😏',
    '😶‍🌫️',
    '😐',
    '😑',
    '😶',
    '🫠',
    '🙄',
    '😬',
    '😮',
    '😯',
    '😲',
    '😳',
    '🥺',
    '😢',
    '😭',
    '😥',
    '😓',
    '😰',
    '😨',
    '😤',
    '😡',
    '😠',
    '🤬',
    '😈',
    '👿',
    '🤔',
    '🤭',
    '🫢',
    '🫣',
    '🙃',
    '😉',
    '😜',
    '😝',
    '😛',
    '😴',
    '🥱',
    '😇',
    '🥳',
    '🤯',
    '🤫',
    '🫡',
    '🤗',
    '🤒',
    '🤕',
    '🤢',
    '🤮',
    '🤧',
    '🥵',
    '🥶',
    '😵',
    '😵‍💫',
    '🥴',
];

const EMOJI_SHORTCUTS: Record<string, string> = {
    ':smile:': '😄',
    ':grin:': '😀',
    ':joy:': '😂',
    ':laugh:': '😆',
    ':rofl:': '🤣',
    ':wink:': '😉',
    ':blush:': '😊',
    ':heart_eyes:': '😍',
    ':kiss:': '😘',
    ':smirk:': '😏',
    ':relieved:': '😌',
    ':sunglasses:': '😎',
    ':thinking:': '🤔',
    ':neutral:': '😐',
    ':eyeroll:': '🙄',
    ':grimace:': '😬',
    ':cry:': '😢',
    ':sob:': '😭',
    ':pleading:': '🥺',
    ':angry:': '😠',
    ':rage:': '😡',
    ':swear:': '🤬',
    ':evil:': '😈',
    ':devil:': '👿',
    ':cloud:': '😶‍🌫️',
    ':party:': '🥳',
    ':mindblown:': '🤯',
    ':shush:': '🤫',
    ':hug:': '🤗',
    ':sick:': '🤢',
    ':hot:': '🥵',
    ':cold:': '🥶',
    ':sleep:': '😴',
    ':yawn:': '🥱',
};

const EMOJI_SHORTCUT_BY_EMOJI = Object.entries(EMOJI_SHORTCUTS).reduce<Record<string, string>>(
    (shortcutsByEmoji, [shortcut, emoji]) => {
        if (!shortcutsByEmoji[emoji]) {
            shortcutsByEmoji[emoji] = shortcut;
        }

        return shortcutsByEmoji;
    },
    {}
);

const getTokenStartIndex = (text: string, cursorPosition: number) => {
    let tokenStartIndex = cursorPosition;

    while (tokenStartIndex > 0 && !/\s/.test(text[tokenStartIndex - 1])) {
        tokenStartIndex -= 1;
    }

    return tokenStartIndex;
};

const replaceShortcutBeforeCursor = (text: string, cursorPosition: number) => {
    const tokenStartIndex = getTokenStartIndex(text, cursorPosition);
    const token = text.slice(tokenStartIndex, cursorPosition);
    const emoji = EMOJI_SHORTCUTS[token];

    if (!emoji) {
        return null;
    }

    const nextText = `${text.slice(0, tokenStartIndex)}${emoji}${text.slice(cursorPosition)}`;
    const nextCursorPosition = tokenStartIndex + emoji.length;

    return {
        text: nextText,
        cursorPosition: nextCursorPosition,
    };
};

const replaceTrailingEmojiShortcut = (text: string) => {
    const trailingWhitespaceMatch = text.match(/\s*$/);
    const trailingWhitespace = trailingWhitespaceMatch?.[0] ?? '';
    const searchableEndIndex = text.length - trailingWhitespace.length;
    const replacement = replaceShortcutBeforeCursor(text, searchableEndIndex);

    return replacement
        ? `${replacement.text.slice(0, replacement.cursorPosition)}${trailingWhitespace}${replacement.text.slice(replacement.cursorPosition)}`
        : text;
};

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
    isSendingMessage,
    newMessagesDividerMessageId,
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
    const [showScrollToBottom, setShowScrollToBottom] = useState(false);
    const [emojiAnchorEl, setEmojiAnchorEl] = useState<HTMLButtonElement | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const previousChatIdRef = useRef<string | null>(null);
    const previousLastMessageIdRef = useRef<string | null>(null);
    const preserveScrollHeightRef = useRef<number | null>(null);
    const messageInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
    const shouldFocusAfterSendRef = useRef(false);
    const wasNearBottomRef = useRef(true);
    const isEmojiPickerOpen = Boolean(emojiAnchorEl);

    const handleSendMessage = async (contentOverride?: string) => {
        const contentToSend = contentOverride ?? messageContent;
        const trimmedContent = contentToSend.trim();
        if (!trimmedContent || isSendingMessage) return;

        setEmojiAnchorEl(null);
        wasNearBottomRef.current = isNearBottom();
        const didSend = await sendMessage(trimmedContent);

        if (didSend) {
            shouldFocusAfterSendRef.current = true;
            setMessageContent("");
        }
    }

    const replaceCurrentShortcut = (appendText = '') => {
        const input = messageInputRef.current;
        const selectionStart = input?.selectionStart ?? messageContent.length;
        const selectionEnd = input?.selectionEnd ?? messageContent.length;

        if (selectionStart !== selectionEnd) {
            return false;
        }

        const replacement = replaceShortcutBeforeCursor(messageContent, selectionStart);

        if (!replacement) {
            return false;
        }

        const nextText = `${replacement.text.slice(0, replacement.cursorPosition)}${appendText}${replacement.text.slice(replacement.cursorPosition)}`;
        const nextCursorPosition = replacement.cursorPosition + appendText.length;
        setMessageContent(nextText);

        requestAnimationFrame(() => {
            const currentInput = messageInputRef.current;
            currentInput?.focus();
            currentInput?.setSelectionRange(nextCursorPosition, nextCursorPosition);
        });

        return true;
    };

    const handleOpenEmojiPicker = (event: MouseEvent<HTMLButtonElement>) => {
        setEmojiAnchorEl(event.currentTarget);
        requestAnimationFrame(() => {
            messageInputRef.current?.focus();
        });
    };

    const handleCloseEmojiPicker = () => {
        setEmojiAnchorEl(null);
        messageInputRef.current?.focus();
    };

    const handleSelectEmoji = (emoji: string) => {
        const input = messageInputRef.current;
        const selectionStart = input?.selectionStart ?? messageContent.length;
        const selectionEnd = input?.selectionEnd ?? messageContent.length;
        const nextCursorPosition = selectionStart + emoji.length;

        setMessageContent(
            `${messageContent.slice(0, selectionStart)}${emoji}${messageContent.slice(selectionEnd)}`
        );

        requestAnimationFrame(() => {
            const currentInput = messageInputRef.current;
            currentInput?.focus();
            currentInput?.setSelectionRange(nextCursorPosition, nextCursorPosition);
        });
    };

    const isNearBottom = () => {
        const container = scrollContainerRef.current;

        if (!container) {
            return true;
        }

        return container.scrollHeight - container.scrollTop - container.clientHeight < 96;
    };

    const updateScrollState = () => {
        const container = scrollContainerRef.current;

        if (!container) {
            wasNearBottomRef.current = true;
            setShowScrollToBottom(false);
            return;
        }

        const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        wasNearBottomRef.current = distanceFromBottom < 96;
        setShowScrollToBottom(distanceFromBottom > SCROLL_TO_BOTTOM_THRESHOLD);
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
        setShowScrollToBottom(false);
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
            setShowScrollToBottom(false);

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

    useEffect(() => {
        if (isSendingMessage || !shouldFocusAfterSendRef.current) {
            return;
        }

        shouldFocusAfterSendRef.current = false;
        messageInputRef.current?.focus();
    }, [isSendingMessage, messageContent]);

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
                sx={{
                    flex: 1,
                    minHeight: 0,
                    position: 'relative',
                }}
            >
                <Box
                    ref={scrollContainerRef}
                    onScroll={updateScrollState}
                    sx={{
                        height: '100%',
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
                            const showDaySeparator = !previousMessage || !isSameCalendarDate(message.createdAt, previousMessage.createdAt);
                            const showNewMessagesDivider = message.id === newMessagesDividerMessageId;

                            return (
                                <Fragment key={message.id}>
                                    {showDaySeparator && (
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1.5,
                                                py: 1,
                                                color: 'text.secondary',
                                            }}
                                        >
                                            <Box sx={{ height: 1, flex: 1, backgroundColor: 'divider' }} />
                                            <Typography variant="caption" sx={{ flexShrink: 0 }}>
                                                {formatRelativeChatDate(message.createdAt)}
                                            </Typography>
                                            <Box sx={{ height: 1, flex: 1, backgroundColor: 'divider' }} />
                                        </Box>
                                    )}
                                    {showNewMessagesDivider && (
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1.5,
                                                py: 1,
                                                color: 'primary.main',
                                            }}
                                        >
                                            <Box sx={{ height: 1, flex: 1, backgroundColor: 'primary.main', opacity: 0.35 }} />
                                            <Typography variant="caption" sx={{ flexShrink: 0, fontWeight: 800 }}>
                                                New messages
                                            </Typography>
                                            <Box sx={{ height: 1, flex: 1, backgroundColor: 'primary.main', opacity: 0.35 }} />
                                        </Box>
                                    )}
                                    <Box
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
                                </Fragment>
                            );
                        })}
                    </Stack>
                </Box>
                {showScrollToBottom && messages.length > 0 && (
                    <Tooltip title="Scroll to latest">
                        <IconButton
                            aria-label="Scroll to latest message"
                            onClick={() => scrollToBottom('smooth')}
                            sx={{
                                position: 'absolute',
                                right: { xs: 16, md: 28 },
                                bottom: 16,
                                width: 40,
                                height: 40,
                                backgroundColor: 'background.paper',
                                border: '1px solid',
                                borderColor: 'divider',
                                boxShadow: '0 10px 24px rgba(0, 0, 0, 0.28)',
                                '&:hover': {
                                    backgroundColor: 'action.hover',
                                },
                            }}
                        >
                            <KeyboardArrowDownIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                )}
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
                <Tooltip title="Add emoji">
                    <span>
                        <IconButton
                            aria-label="Add emoji"
                            aria-controls={isEmojiPickerOpen ? 'chat-emoji-picker' : undefined}
                            aria-haspopup="dialog"
                            aria-expanded={isEmojiPickerOpen}
                            disabled={isSendingMessage}
                            onClick={handleOpenEmojiPicker}
                            onMouseDown={(event) => event.preventDefault()}
                            sx={{
                                width: 40,
                                height: 40,
                                border: '1px solid',
                                borderColor: 'divider',
                                backgroundColor: 'background.default',
                            }}
                        >
                            <InsertEmoticonOutlinedIcon fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>
                <Popover
                    id="chat-emoji-picker"
                    open={isEmojiPickerOpen}
                    anchorEl={emojiAnchorEl}
                    onClose={handleCloseEmojiPicker}
                    disableAutoFocus
                    disableEnforceFocus
                    disableRestoreFocus
                    anchorOrigin={{
                        vertical: 'top',
                        horizontal: 'left',
                    }}
                    transformOrigin={{
                        vertical: 'bottom',
                        horizontal: 'left',
                    }}
                    slotProps={{
                        paper: {
                            sx: {
                                p: 1,
                                width: 'max-content',
                                maxWidth: 'calc(100vw - 32px)',
                                backgroundColor: 'background.paper',
                            },
                        },
                    }}
                >
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(8, 32px)',
                            gap: 0.5,
                        }}
                    >
                        {FACE_EMOJIS.map((emoji) => {
                            const shortcut = EMOJI_SHORTCUT_BY_EMOJI[emoji];

                            return (
                                <Tooltip key={emoji} title={shortcut ?? ''} disableHoverListener={!shortcut}>
                                    <IconButton
                                        aria-label={shortcut ? `Insert ${emoji} (${shortcut})` : `Insert ${emoji}`}
                                        size="small"
                                        onClick={() => handleSelectEmoji(emoji)}
                                        onMouseDown={(event) => event.preventDefault()}
                                        sx={{
                                            width: 32,
                                            height: 32,
                                            fontSize: 20,
                                            lineHeight: 1,
                                            borderRadius: 1,
                                        }}
                                    >
                                        {emoji}
                                    </IconButton>
                                </Tooltip>
                            );
                        })}
                    </Box>
                </Popover>
                <TextField
                    fullWidth
                    multiline
                    maxRows={4}
                    size="small"
                    placeholder="Message"
                    value={messageContent}
                    disabled={isSendingMessage}
                    inputRef={messageInputRef}
                    onChange={(e) => setMessageContent(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === " ") {
                            if (replaceCurrentShortcut(' ')) {
                                e.preventDefault();
                            }
                            return;
                        }

                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (!isSendingMessage) {
                                void handleSendMessage(replaceTrailingEmojiShortcut(messageContent));
                            }
                        }
                    }}
                />
                <Tooltip title="Send message">
                    <span>
                        <IconButton
                            aria-label="Send message"
                            disabled={!messageContent.trim() || isSendingMessage}
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
                            onClick={() => void handleSendMessage()}
                        >
                            {isSendingMessage ? <CircularProgress size={18} color="inherit" /> : <SendIcon fontSize="small" />}
                        </IconButton>
                    </span>
                </Tooltip>
            </Stack>
        </Box>
    );
}
