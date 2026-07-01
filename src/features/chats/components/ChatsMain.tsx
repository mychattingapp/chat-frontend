import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import InsertEmoticonOutlinedIcon from '@mui/icons-material/InsertEmoticonOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import SendIcon from '@mui/icons-material/Send';
import { Avatar, Box, Button, CircularProgress, Dialog, IconButton, Popover, Stack, TextField, Tooltip, Typography } from "@mui/material";
import type { Chat, ChatMessage } from '../types';
import useAuth from '../../auth/hooks/useAuth';
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type MouseEvent } from 'react';
import { formatRelativeChatDate, isSameCalendarDate } from '../utils/dateFormatters';
import { getProfileImageSrc } from '../../../shared/utils/profileImage';
import { validateMessageImageFile, validateMessageImageType } from '../utils/messageImageValidation';
import { getMessageImageUrl } from '../api/chatsApi';
import { useSnackbar } from '../../../shared/snackbar';
import { compressMessageImageFile } from '../utils/messageImageCompression';

type ChatsMainProps = {
    chat: Chat | null;
    messages: ChatMessage[];
    isLoadingMessages: boolean;
    isSendingMessage: boolean;
    newMessagesDividerMessageId: string | null;
    typingUserIds: string[];
    onlineUserIds: string[];
    loadError: string | null;
    hasMoreMessages: boolean;
    loadMoreMessages: () => Promise<boolean>;
    sendMessage: (content: string) => Promise<boolean>;
    sendImageMessage: (file: File, caption: string) => Promise<boolean>;
    startTyping: (chatId: string) => void;
    stopTyping: (chatId: string) => void;
    showBackButton?: boolean;
    onBack?: () => void;
    isPaneVisible?: boolean;
};

type ImageViewerState = {
    imageUrl: string;
    message: ChatMessage;
    hasRetried: boolean;
    isRefreshing: boolean;
    hasFailed: boolean;
};

const GROUP_WINDOW_MS = 5 * 60 * 1000;
const SCROLL_TO_BOTTOM_THRESHOLD = 160;
const TYPING_REFRESH_INTERVAL_MS = 1500;
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

function MessageImage({
    chatId,
    message,
    onLoad,
    onOpen,
}: {
    chatId: string;
    message: ChatMessage;
    onLoad?: () => void;
    onOpen: (imageUrl: string, message: ChatMessage) => void;
}) {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const didNotifyLoadRef = useRef(false);
    const maxImageWidth = 320;
    const maxImageHeight = 360;
    const fallbackImageAspectRatio = `${maxImageWidth} / ${maxImageHeight}`;

    useLayoutEffect(() => {
        if (imageSize && !didNotifyLoadRef.current) {
            didNotifyLoadRef.current = true;
            onLoad?.();
        }
    }, [imageSize, onLoad]);

    useEffect(() => {
        let isMounted = true;

        void getMessageImageUrl(chatId, message.id)
            .then((nextImageUrl) => {
                if (isMounted) {
                    setImageUrl(nextImageUrl);
                }
            })
            .catch(() => {
                if (isMounted) {
                    setError("Could not load image.");
                }
            });

        return () => {
            isMounted = false;
        };
    }, [chatId, message.id]);

    if (error) {
        return (
            <Typography variant="body2" sx={{ color: 'error.main' }}>
                {error}
            </Typography>
        );
    }

    if (!imageUrl) {
        return (
            <Box
                sx={{
                    width: `${maxImageWidth}px`,
                    maxWidth: '100%',
                    aspectRatio: fallbackImageAspectRatio,
                    display: 'grid',
                    placeItems: 'center',
                }}
            >
                <CircularProgress size={24} />
            </Box>
        );
    }

    const imageAspectRatio = imageSize
        ? `${imageSize.width} / ${imageSize.height}`
        : fallbackImageAspectRatio;
    const displayWidth = imageSize
        ? Math.min(maxImageWidth, imageSize.width, Math.round(maxImageHeight * (imageSize.width / imageSize.height)))
        : maxImageWidth;

    return (
        <Box
            sx={{
                width: `${displayWidth}px`,
                maxWidth: '100%',
                aspectRatio: imageAspectRatio,
                maxHeight: 360,
                overflow: 'hidden',
                borderRadius: 1,
                backgroundColor: 'background.default',
            }}
        >
            <Box
                component="img"
                src={imageUrl}
                alt=""
                role="button"
                onLoad={(event) => {
                    const image = event.currentTarget;
                    setImageSize({
                        width: image.naturalWidth,
                        height: image.naturalHeight,
                    });
                }}
                onError={() => {
                    setImageUrl(null);
                    setImageSize(null);
                    setError("Could not load image.");
                }}
                onClick={() => onOpen(imageUrl, message)}
                sx={{
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    cursor: 'pointer',
                }}
            />
        </Box>
    );
}

export default function ChatsMain({
    chat,
    hasMoreMessages,
    messages,
    isLoadingMessages,
    isSendingMessage,
    newMessagesDividerMessageId,
    typingUserIds,
    onlineUserIds,
    loadError,
    loadMoreMessages,
    sendMessage,
    sendImageMessage,
    startTyping,
    stopTyping,
    showBackButton = false,
    onBack,
    isPaneVisible = true,
}: ChatsMainProps) {
    const { user } = useAuth();
    const { showSnackbar } = useSnackbar();
    const currentUserId = user?.id;
    const initials = chat?.title
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "CH";
    const [messageContent, setMessageContent] = useState("");
    const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
    const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState<string | null>(null);
    const [imageCaption, setImageCaption] = useState("");
    const [imageError, setImageError] = useState<string | null>(null);
    const [isPreparingImage, setIsPreparingImage] = useState(false);
    const [isSendingImage, setIsSendingImage] = useState(false);
    const [imageViewer, setImageViewer] = useState<ImageViewerState | null>(null);
    const [showScrollToBottom, setShowScrollToBottom] = useState(false);
    const [emojiAnchorEl, setEmojiAnchorEl] = useState<HTMLButtonElement | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const previousChatIdRef = useRef<string | null>(null);
    const previousLastMessageIdRef = useRef<string | null>(null);
    const previousPaneVisibleRef = useRef(isPaneVisible);
    const previousNewMessagesDividerMessageIdRef = useRef<string | null>(null);
    const preserveScrollHeightRef = useRef<number | null>(null);
    const messageInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
    const imageInputRef = useRef<HTMLInputElement | null>(null);
    const shouldFocusAfterSendRef = useRef(false);
    const wasNearBottomRef = useRef(true);
    const typingStopTimeoutRef = useRef<number | null>(null);
    const isTypingRef = useRef(false);
    const activeTypingChatIdRef = useRef<string | null>(null);
    const lastTypingStartSentAtRef = useRef(0);
    const isEmojiPickerOpen = Boolean(emojiAnchorEl);
    const typingParticipants = chat
        ? chat.participants.filter((participant) => typingUserIds.includes(participant.id))
        : [];
    const typingIndicatorText = typingParticipants.length === 0
        ? null
        : chat?.chatType === 'DIRECT'
            ? 'typing...'
            : typingParticipants.length === 1
                ? `${typingParticipants[0].username} is typing...`
                : `${typingParticipants.length} people are typing...`;
    const directChatParticipant = chat?.chatType === 'DIRECT'
        ? chat.participants.find((participant) => participant.id !== currentUserId)
        : null;
    const headerImageUrl = directChatParticipant?.profileImageUrl ?? null;
    const directPresenceText = directChatParticipant
        ? onlineUserIds.includes(directChatParticipant.id) ? 'Online' : 'Offline'
        : null;
    const headerSubtitle = typingIndicatorText ?? directPresenceText;

    const clearTypingStopTimeout = useCallback(() => {
        if (typingStopTimeoutRef.current !== null) {
            window.clearTimeout(typingStopTimeoutRef.current);
            typingStopTimeoutRef.current = null;
        }
    }, []);

    const stopCurrentTyping = useCallback(() => {
        const typingChatId = activeTypingChatIdRef.current;

        clearTypingStopTimeout();

        if (typingChatId && isTypingRef.current) {
            stopTyping(typingChatId);
        }

        isTypingRef.current = false;
        activeTypingChatIdRef.current = null;
        lastTypingStartSentAtRef.current = 0;
    }, [clearTypingStopTimeout, stopTyping]);

    const scheduleTypingStop = useCallback(() => {
        clearTypingStopTimeout();
        typingStopTimeoutRef.current = window.setTimeout(() => {
            stopCurrentTyping();
        }, 1500);
    }, [clearTypingStopTimeout, stopCurrentTyping]);

    const handleMessageContentChange = (nextContent: string) => {
        setMessageContent(nextContent);

        if (!chat || isSendingMessage) {
            return;
        }

        if (!nextContent.trim()) {
            stopCurrentTyping();
            return;
        }

        const now = Date.now();
        const shouldSendTypingStart =
            !isTypingRef.current ||
            activeTypingChatIdRef.current !== chat.id ||
            now - lastTypingStartSentAtRef.current >= TYPING_REFRESH_INTERVAL_MS;

        if (shouldSendTypingStart) {
            if (activeTypingChatIdRef.current && activeTypingChatIdRef.current !== chat.id) {
                stopCurrentTyping();
            }

            startTyping(chat.id);
            isTypingRef.current = true;
            activeTypingChatIdRef.current = chat.id;
            lastTypingStartSentAtRef.current = now;
        }

        scheduleTypingStop();
    };

    const handleSendMessage = async (contentOverride?: string) => {
        const contentToSend = contentOverride ?? messageContent;
        const trimmedContent = contentToSend.trim();
        if (!trimmedContent || isSendingMessage) return;

        setEmojiAnchorEl(null);
        stopCurrentTyping();
        wasNearBottomRef.current = isNearBottom();
        const didSend = await sendMessage(trimmedContent);

        if (didSend) {
            shouldFocusAfterSendRef.current = true;
            setMessageContent("");
        }
    }

    const clearSelectedImage = useCallback(() => {
        setSelectedImageFile(null);
        setImageCaption("");
        setImageError(null);

        if (imageInputRef.current) {
            imageInputRef.current.value = "";
        }
    }, []);

    const handleImageFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] ?? null;
        const input = event.currentTarget;

        if (!file) {
            return;
        }

        const typeError = validateMessageImageType(file);

        if (typeError) {
            showSnackbar({ message: typeError, severity: "error" });
            setSelectedImageFile(null);
            input.value = "";
            return;
        }

        setEmojiAnchorEl(null);
        stopCurrentTyping();
        setImageError(null);
        setIsPreparingImage(true);

        try {
            const compressedFile = await compressMessageImageFile(file);
            const validationError = validateMessageImageFile(compressedFile);

            if (validationError) {
                showSnackbar({ message: validationError, severity: "error" });
                setSelectedImageFile(null);
                input.value = "";
                return;
            }

            setImageCaption("");
            setSelectedImageFile(compressedFile);
        }
        catch (error) {
            showSnackbar({
                message: error instanceof Error ? error.message : "Could not prepare image.",
                severity: "error",
            });
            setSelectedImageFile(null);
            input.value = "";
        }
        finally {
            setIsPreparingImage(false);
        }
    };

    const handleSendSelectedImage = async () => {
        if (!selectedImageFile || isSendingImage || isSendingMessage) {
            return;
        }

        setIsSendingImage(true);
        setImageError(null);
        stopCurrentTyping();
        wasNearBottomRef.current = true;

        try {
            const didSend = await sendImageMessage(selectedImageFile, replaceTrailingEmojiShortcut(imageCaption));

            if (didSend) {
                clearSelectedImage();
                return;
            }

            setImageError("Failed to send image.");
        }
        catch (error) {
            setImageError(error instanceof Error ? error.message : "Failed to send image.");
        }
        finally {
            setIsSendingImage(false);
        }
    };

    const handleViewerImageError = () => {
        if (!chat || !imageViewer || imageViewer.isRefreshing) {
            return;
        }

        if (imageViewer.hasRetried) {
            if (!imageViewer.hasFailed) {
                showSnackbar({ message: "Could not load image.", severity: "error" });
                setImageViewer((currentViewer) => currentViewer?.message.id === imageViewer.message.id
                    ? { ...currentViewer, hasFailed: true }
                    : currentViewer);
            }
            return;
        }

        const messageId = imageViewer.message.id;

        setImageViewer((currentViewer) => currentViewer?.message.id === messageId
            ? { ...currentViewer, isRefreshing: true }
            : currentViewer);

        void getMessageImageUrl(chat.id, messageId)
            .then((nextImageUrl) => {
                setImageViewer((currentViewer) => currentViewer?.message.id === messageId
                    ? {
                        ...currentViewer,
                        imageUrl: nextImageUrl,
                        hasRetried: true,
                        isRefreshing: false,
                    }
                    : currentViewer);
            })
            .catch(() => {
                showSnackbar({ message: "Could not load image.", severity: "error" });
                setImageViewer((currentViewer) => currentViewer?.message.id === messageId
                    ? {
                        ...currentViewer,
                        hasRetried: true,
                        isRefreshing: false,
                        hasFailed: true,
                    }
                    : currentViewer);
            });
    };

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
        handleMessageContentChange(nextText);

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

        handleMessageContentChange(`${messageContent.slice(0, selectionStart)}${emoji}${messageContent.slice(selectionEnd)}`);

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
        wasNearBottomRef.current = true;
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

        if (!container || !chat || !isPaneVisible) {
            return;
        }

        const currentLastMessage = messages[messages.length - 1] ?? null;
        const chatChanged = previousChatIdRef.current !== chat.id;
        const dividerChanged = previousNewMessagesDividerMessageIdRef.current !== newMessagesDividerMessageId;

        if (chatChanged) {
            setShowScrollToBottom(false);

            if (messages.length === 0) {
                return;
            }

            previousChatIdRef.current = chat.id;
            previousLastMessageIdRef.current = currentLastMessage?.id ?? null;
            previousNewMessagesDividerMessageIdRef.current = newMessagesDividerMessageId;
            preserveScrollHeightRef.current = null;
            scrollToBottom();
            return;
        }

        if (dividerChanged && newMessagesDividerMessageId && wasNearBottomRef.current) {
            previousNewMessagesDividerMessageIdRef.current = newMessagesDividerMessageId;
            scrollToBottom();
            return;
        }

        if (preserveScrollHeightRef.current !== null) {
            const previousScrollHeight = preserveScrollHeightRef.current;
            preserveScrollHeightRef.current = null;
            container.scrollTop = container.scrollHeight - previousScrollHeight + container.scrollTop;
            previousLastMessageIdRef.current = currentLastMessage?.id ?? null;
            previousNewMessagesDividerMessageIdRef.current = newMessagesDividerMessageId;
            return;
        }

        if (currentLastMessage?.id && currentLastMessage.id !== previousLastMessageIdRef.current) {
            const isOwnNewMessage = currentLastMessage.senderId === currentUserId;

            if (wasNearBottomRef.current || isOwnNewMessage) {
                scrollToBottom(isOwnNewMessage ? 'smooth' : 'auto');
            }
        }

        previousLastMessageIdRef.current = currentLastMessage?.id ?? null;
        previousNewMessagesDividerMessageIdRef.current = newMessagesDividerMessageId;
    }, [chat, currentUserId, isPaneVisible, messages, newMessagesDividerMessageId]);

    useLayoutEffect(() => {
        const becameVisible = isPaneVisible && !previousPaneVisibleRef.current;
        previousPaneVisibleRef.current = isPaneVisible;

        if (!becameVisible || !chat || messages.length === 0) {
            return;
        }

        requestAnimationFrame(() => {
            scrollToBottom();
        });
    }, [chat, isPaneVisible, messages.length]);

    useEffect(() => {
        if (isSendingMessage || !shouldFocusAfterSendRef.current) {
            return;
        }

        shouldFocusAfterSendRef.current = false;
        messageInputRef.current?.focus();
    }, [isSendingMessage, messageContent]);

    useEffect(() => {
        stopCurrentTyping();
    }, [chat?.id, stopCurrentTyping]);

    useEffect(() => () => {
        stopCurrentTyping();
    }, [stopCurrentTyping]);

    useEffect(() => {
        if (!selectedImageFile) {
            setSelectedImagePreviewUrl(null);
            return;
        }

        const objectUrl = URL.createObjectURL(selectedImageFile);
        setSelectedImagePreviewUrl(objectUrl);

        return () => {
            URL.revokeObjectURL(objectUrl);
        };
    }, [selectedImageFile]);

    useEffect(() => {
        clearSelectedImage();
        setImageViewer(null);
    }, [chat?.id, clearSelectedImage]);

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
                position: 'relative',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: { xs: 0, md: 1 },
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
                    px: { xs: 1.25, md: 2.5 },
                    py: 2,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    flexShrink: 0,
                }}
            >
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
                    {showBackButton && (
                        <Tooltip title="Back to chats">
                            <IconButton
                                aria-label="Back to chats"
                                onClick={onBack}
                                sx={{ display: { xs: 'inline-flex', md: 'none' }, flexShrink: 0 }}
                            >
                                <ArrowBackIcon />
                            </IconButton>
                        </Tooltip>
                    )}
                    <Avatar src={getProfileImageSrc(headerImageUrl, directChatParticipant?.updatedAt)} sx={{ width: 42, height: 42 }}>
                        {!headerImageUrl ? initials : null}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ color: 'text.primary', fontWeight: 800 }} noWrap>
                            {chat.title}
                        </Typography>
                        {headerSubtitle && (
                            <Typography
                                variant="body2"
                                sx={{
                                    color: typingIndicatorText ? 'primary.main' : 'text.secondary',
                                    fontStyle: typingIndicatorText ? 'italic' : 'normal',
                                }}
                                noWrap
                            >
                                {headerSubtitle}
                            </Typography>
                        )}
                    </Box>
                </Stack>
            </Stack>

            <Box
                sx={{
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
            {selectedImageFile && selectedImagePreviewUrl && (
                <Box
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        backgroundColor: 'background.default',
                    }}
                >
                    <Stack
                        direction="row"
                        alignItems="center"
                        spacing={1}
                        sx={{
                            px: 2,
                            py: 1.5,
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            backgroundColor: 'background.paper',
                        }}
                    >
                        <Tooltip title="Back">
                            <span>
                                <IconButton
                                    aria-label="Back to chat"
                                    disabled={isSendingImage}
                                    onClick={() => clearSelectedImage()}
                                >
                                    <ArrowBackIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Typography sx={{ color: 'text.primary', fontWeight: 800 }} noWrap>
                            Send image
                        </Typography>
                    </Stack>

                    <Box
                        sx={{
                            flex: 1,
                            minHeight: 0,
                            display: 'grid',
                            placeItems: 'center',
                            p: { xs: 2, md: 4 },
                            overflow: 'hidden',
                        }}
                    >
                        <Box sx={{ width: '100%', height: '100%', minHeight: 0, position: 'relative' }}>
                            <Box
                                component="img"
                                src={selectedImagePreviewUrl}
                                alt=""
                                sx={{
                                    display: 'block',
                                    position: 'absolute',
                                    inset: 0,
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain',
                                    objectPosition: 'center',
                                    borderRadius: 1,
                                    backgroundColor: 'background.paper',
                                }}
                            />
                        </Box>
                    </Box>

                    <Stack
                        direction="row"
                        spacing={1}
                        alignItems="flex-end"
                        sx={{
                            p: 2,
                            borderTop: '1px solid',
                            borderColor: 'divider',
                            backgroundColor: 'background.paper',
                        }}
                    >
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                            <TextField
                                fullWidth
                                multiline
                                maxRows={4}
                                size="small"
                                placeholder="Add a caption"
                                value={imageCaption}
                                disabled={isSendingImage}
                                error={!!imageError}
                                helperText={imageError}
                                onChange={(event) => setImageCaption(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" && !event.shiftKey) {
                                        event.preventDefault();
                                        void handleSendSelectedImage();
                                    }
                                }}
                            />
                        </Box>
                        <Tooltip title="Send image">
                            <span>
                                <IconButton
                                    aria-label="Send image"
                                    disabled={isSendingImage}
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
                                    onClick={() => void handleSendSelectedImage()}
                                >
                                    {isSendingImage ? <CircularProgress size={18} color="inherit" /> : <SendIcon fontSize="small" />}
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Stack>
                </Box>
            )}
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
                            const isLatestMessage = index === messages.length - 1;

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
                                            sx={{ maxWidth: 'min(520px, 78%)', minWidth: 0, overflow: 'hidden' }}
                                        >
                                            <Tooltip title={formatDetailedTimestamp(message.createdAt)} placement={isOwn ? 'left' : 'right'}>
                                                <Box
                                                    sx={{
                                                        width: message.hasImage ? 'fit-content' : 'auto',
                                                        maxWidth: '100%',
                                                        minWidth: 0,
                                                        overflow: 'hidden',
                                                        px: message.hasImage ? 0.75 : 1.75,
                                                        py: message.hasImage ? 0.75 : 1,
                                                        borderRadius: 1,
                                                        backgroundColor: isOwn ? 'primary.main' : 'background.paper',
                                                        color: isOwn ? 'primary.contrastText' : 'text.primary',
                                                        border: '1px solid',
                                                        borderColor: isOwn ? 'primary.main' : 'divider',
                                                    }}
                                                >
                                                    <Stack
                                                        spacing={message.hasImage && message.text ? 1 : 0}
                                                        alignItems={message.hasImage ? 'flex-start' : 'stretch'}
                                                    >
                                                        {message.hasImage && (
                                                            <MessageImage
                                                                chatId={chat.id}
                                                                message={message}
                                                                onOpen={(imageUrl, viewerMessage) => {
                                                                    setImageViewer({
                                                                        imageUrl,
                                                                        message: viewerMessage,
                                                                        hasRetried: false,
                                                                        isRefreshing: false,
                                                                        hasFailed: false,
                                                                    });
                                                                }}
                                                                onLoad={() => {
                                                                    if (wasNearBottomRef.current || (isLatestMessage && isOwn)) {
                                                                        scrollToBottom();
                                                                    }
                                                                }}
                                                            />
                                                        )}
                                                        {message.text && (
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
                                                        )}
                                                    </Stack>
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
                <Tooltip title="Attach image">
                    <span>
                        <IconButton
                            aria-label="Attach image"
                            disabled={isSendingMessage || isPreparingImage}
                            onClick={() => imageInputRef.current?.click()}
                            sx={{
                                width: 40,
                                height: 40,
                                border: '1px solid',
                                borderColor: 'divider',
                                backgroundColor: 'background.default',
                            }}
                        >
                            {isPreparingImage ? <CircularProgress size={18} color="inherit" /> : <AddPhotoAlternateOutlinedIcon fontSize="small" />}
                        </IconButton>
                        <input
                            ref={imageInputRef}
                            hidden
                            type="file"
                            accept="image/png,image/jpeg"
                            onChange={handleImageFileChange}
                        />
                    </span>
                </Tooltip>
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
                    onChange={(e) => handleMessageContentChange(e.target.value)}
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
            <Dialog
                open={imageViewer !== null}
                onClose={() => setImageViewer(null)}
                maxWidth={false}
                slotProps={{
                    paper: {
                        sx: {
                            width: { xs: 'calc(100vw - 16px)', sm: 'min(960px, calc(100vw - 32px))' },
                            height: { xs: 'calc(100dvh - 16px)', sm: 'min(720px, calc(100dvh - 32px))' },
                            maxWidth: 'none',
                            maxHeight: 'none',
                            m: { xs: 1, sm: 2 },
                            overflow: 'hidden',
                            backgroundColor: 'background.paper',
                        },
                    },
                }}
            >
                {imageViewer && (
                    <Box
                        sx={{
                            width: '100%',
                            height: '100%',
                            p: 1.5,
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: imageViewer.message.text ? 1.25 : 0,
                        }}
                    >
                        <Tooltip title="Close">
                            <IconButton
                                aria-label="Close image"
                                onClick={() => setImageViewer(null)}
                                sx={{
                                    position: 'absolute',
                                    top: 8,
                                    right: 8,
                                    zIndex: 1,
                                    width: 34,
                                    height: 34,
                                    color: 'common.white',
                                    backgroundColor: 'rgba(15, 23, 42, 0.72)',
                                    '&:hover': {
                                        backgroundColor: 'rgba(15, 23, 42, 0.88)',
                                    },
                                }}
                            >
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Box
                            sx={{
                                flex: 1,
                                minHeight: 0,
                                minWidth: 0,
                                display: 'grid',
                                placeItems: 'center',
                                overflow: 'hidden',
                                borderRadius: 1,
                                backgroundColor: 'background.default',
                            }}
                        >
                            <Box
                                component="img"
                                src={imageViewer.imageUrl}
                                alt=""
                                onError={handleViewerImageError}
                                sx={{
                                    display: 'block',
                                    width: '100%',
                                    height: '100%',
                                    minWidth: 0,
                                    minHeight: 0,
                                    objectFit: 'scale-down',
                                }}
                            />
                        </Box>
                        {imageViewer.isRefreshing && (
                            <Box
                                sx={{
                                    position: 'absolute',
                                    inset: 12,
                                    display: 'grid',
                                    placeItems: 'center',
                                    backgroundColor: 'rgba(0, 0, 0, 0.28)',
                                    borderRadius: 1,
                                }}
                            >
                                <CircularProgress size={28} color="inherit" />
                            </Box>
                        )}
                        {imageViewer.message.text && (
                            <Typography
                                variant="body2"
                                sx={{
                                    flexShrink: 0,
                                    maxHeight: '28%',
                                    overflow: 'auto',
                                    color: 'text.primary',
                                    whiteSpace: 'pre-wrap',
                                    overflowWrap: 'anywhere',
                                    wordBreak: 'break-word',
                                }}
                            >
                                {imageViewer.message.text}
                            </Typography>
                        )}
                    </Box>
                )}
            </Dialog>
        </Box>
    );
}
