import { Avatar, Box, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import LogoutIcon from '@mui/icons-material/Logout';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import { useEffect, useState } from "react";
import LogoutConfirmDialog from '../../features/auth/components/LogoutConfirmDialog';
import useOAuthLogin from "../../features/auth/hooks/useOAuthLogin";
import { ChatsMain, ChatsSidebar, StartChatDialog } from "../../features/chats";
import { AddFriendDialog, FriendsMain, FriendsSidebar, useFriendRequests, type FriendView } from "../../features/friends";
import { ProfileMain } from "../../features/home/components";
import { useChats } from "../../features/chats/hooks/useChats";
import useAuth from "../../features/auth/hooks/useAuth";
import { getProfileImageSrc } from "../../shared/utils/profileImage";

type HomeTab = 'chats' | 'friends' | 'profile';

type HomeTabConfig = {
    label: string;
    icon: typeof ChatBubbleOutlineIcon;
    sidebarTitle: string;
    sidebarDescription: string;
};

const tabConfig: Record<HomeTab, HomeTabConfig> = {
    chats: {
        label: 'Chats',
        icon: ChatBubbleOutlineIcon,
        sidebarTitle: 'Chats',
        sidebarDescription: 'Recent conversations',
    },
    friends: {
        label: 'Friends',
        icon: PeopleOutlineIcon,
        sidebarTitle: 'Friends',
        sidebarDescription: 'Requests and contacts',
    },
    profile: {
        label: 'Profile',
        icon: PersonOutlineIcon,
        sidebarTitle: 'Profile',
        sidebarDescription: 'Account and preferences',
    },
};

const getInitials = (name: string) => name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

export default function HomePage() {
    const theme = useTheme();
    const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
    const { user } = useAuth();
    const { handleLogout, isLoading: isLoggingOut } = useOAuthLogin();
    const [activeTab, setActiveTab] = useState<HomeTab>('chats');
    const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
    const [isMobileFriendViewOpen, setIsMobileFriendViewOpen] = useState(false);
    const [activeFriendView, setActiveFriendView] = useState<FriendView>('all');
    const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
    const [isStartChatOpen, setIsStartChatOpen] = useState(false);
    const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
    const friends = useFriendRequests(activeTab === 'friends');
    const activeConfig = tabConfig[activeTab];
    const shouldShowSidebar = activeTab !== 'profile';
    const isChatDetailVisible = activeTab === 'chats' && (isDesktop || isMobileChatOpen);
    const shouldShowMobileNav = !(activeTab === 'chats' && isMobileChatOpen);
    const chats = useChats(isChatDetailVisible);
    const selectedSidebarChatId = isChatDetailVisible ? chats.selectedChat?.id ?? null : null;
    const loadChats = chats.loadChats;
    const profileImageSrc = getProfileImageSrc(user?.profileImageUrl, user?.updatedAt);
    const handleTabChange = (tab: HomeTab) => {
        setActiveTab(tab);
        setIsMobileChatOpen(false);
        setIsMobileFriendViewOpen(false);
    };
    const handleFriendViewChange = (view: FriendView) => {
        setActiveFriendView(view);
        setIsMobileFriendViewOpen(true);
    };
    const handleMessageFriend = (friendId: string) => {
        setActiveTab('chats');
        setIsMobileFriendViewOpen(false);
        void chats.startDirectChat(friendId).then((didStartChat) => {
            if (didStartChat) {
                setIsMobileChatOpen(true);
            }
        });
    };
    const handleOpenStartChat = () => {
        setIsStartChatOpen(true);

        if (friends.friends.length === 0 && !friends.isLoading) {
            void friends.loadFriendRequests();
        }
    };
    const handleStartChat = async (friendId: string) => {
        setActiveTab('chats');
        setIsMobileFriendViewOpen(false);
        const didStartChat = await chats.startDirectChat(friendId);

        if (didStartChat) {
            setIsMobileChatOpen(true);
        }

        return didStartChat;
    };
    const handleSelectChat = (chatId: string) => {
        setIsMobileChatOpen(true);
        void chats.selectChat(chatId);
    };

    useEffect(() => {
        if (activeTab === 'chats') {
            void loadChats();
        }
    }, [activeTab, loadChats]);

    return (
        <Box
            sx={{
                height: '100dvh',
                width: '100%',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                backgroundColor: 'background.default',
                color: 'text.primary',
            }}
        >
            <Box
                component="nav"
                sx={{
                    width: 72,
                    flexShrink: 0,
                    height: '100%',
                    backgroundColor: 'background.paper',
                    color: 'text.secondary',
                    display: { xs: 'none', md: 'flex' },
                    flexDirection: 'column',
                    alignItems: 'center',
                    py: 2,
                    borderRight: '1px solid',
                    borderColor: 'divider',
                }}
            >
                <Typography
                    sx={{
                        width: 42,
                        height: 42,
                        borderRadius: 1,
                        display: 'grid',
                        placeItems: 'center',
                        backgroundColor: 'primary.main',
                        color: 'primary.contrastText',
                        fontWeight: 800,
                        mb: 3,
                    }}
                >
                    MCA
                </Typography>

                <Stack spacing={1.5} sx={{ alignItems: 'center' }}>
                    {(['chats', 'friends'] as HomeTab[]).map((tab) => {
                        const Icon = tabConfig[tab].icon;
                        const selected = activeTab === tab;

                        return (
                            <Tooltip title={tabConfig[tab].label} placement="right" key={tab}>
                                <IconButton
                                    aria-label={tabConfig[tab].label}
                                    onClick={() => handleTabChange(tab)}
                                    sx={{
                                        width: 46,
                                        height: 46,
                                        color: selected ? 'primary.contrastText' : 'text.secondary',
                                        backgroundColor: selected ? 'primary.main' : 'transparent',
                                        borderRadius: 1,
                                        '&:hover': {
                                            backgroundColor: selected ? 'primary.main' : 'action.hover',
                                        },
                                    }}
                                >
                                    <Icon />
                                </IconButton>
                            </Tooltip>
                        );
                    })}
                </Stack>

                <Stack spacing={1.5} sx={{ alignItems: 'center', mt: 'auto' }}>
                    <Tooltip title="Profile" placement="right">
                        <IconButton
                            aria-label="Profile"
                            onClick={() => handleTabChange('profile')}
                            sx={{
                                width: 46,
                                height: 46,
                                color: activeTab === 'profile' ? 'primary.contrastText' : 'text.secondary',
                                backgroundColor: activeTab === 'profile' ? 'primary.main' : 'transparent',
                                borderRadius: 1,
                                '&:hover': {
                                    backgroundColor: activeTab === 'profile' ? 'primary.main' : 'action.hover',
                                },
                            }}
                        >
                            <Avatar
                                src={profileImageSrc}
                                sx={{
                                    width: 32,
                                    height: 32,
                                    fontSize: 12,
                                    fontWeight: 800,
                                    backgroundColor: activeTab === 'profile' ? 'primary.contrastText' : 'action.selected',
                                    color: activeTab === 'profile' ? 'primary.main' : 'text.primary',
                                }}
                            >
                                {!profileImageSrc ? getInitials(user?.name ?? "User") : null}
                            </Avatar>
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Logout" placement="right">
                        <IconButton
                            aria-label="Logout"
                            onClick={() => setIsLogoutDialogOpen(true)}
                            sx={{
                                width: 46,
                                height: 46,
                                color: 'text.secondary',
                                borderRadius: 1,
                                '&:hover': {
                                    backgroundColor: 'action.hover',
                                },
                            }}
                        >
                            <LogoutIcon />
                        </IconButton>
                    </Tooltip>
                </Stack>
            </Box>

            {shouldShowSidebar && (
                <Box
                    component="aside"
                    sx={{
                        width: { xs: '100%', md: 380 },
                        flex: { xs: 1, md: '0 0 auto' },
                        minHeight: 0,
                        flexShrink: 0,
                        p: { xs: 2, md: 3 },
                        borderRight: '1px solid',
                        borderBottom: { xs: '1px solid', md: 0 },
                        borderColor: 'divider',
                        backgroundColor: 'background.paper',
                        overflow: 'auto',
                        display: {
                            xs: (activeTab === 'chats' && !isMobileChatOpen) || (activeTab === 'friends' && !isMobileFriendViewOpen) ? 'block' : 'none',
                            md: 'block',
                        },
                    }}
                >
                    <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary' }}>
                        {activeConfig.sidebarTitle}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75, mb: 3 }}>
                        {activeConfig.sidebarDescription}
                    </Typography>

                    {activeTab === 'chats' ? (
                        <ChatsSidebar
                            chats={chats.chats}
                            isLoading={chats.isLoadingChats}
                            loadError={chats.loadError}
                            onRetry={chats.loadChats}
                            selectedChatId={selectedSidebarChatId}
                            onSelectChat={handleSelectChat}
                            onStartChat={handleOpenStartChat}
                        />
                    ) : (
                        <FriendsSidebar
                            activeFriendView={isDesktop || isMobileFriendViewOpen ? activeFriendView : null}
                            onFriendViewChange={handleFriendViewChange}
                            counts={friends.counts}
                        />
                    )}
                </Box>
            )}

            <Box
                component="main"
                sx={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 0,
                    p: activeTab === 'chats' ? 0 : { xs: 2, md: 5 },
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: activeTab === 'chats' ? 'hidden' : 'auto',
                    ...(activeTab === 'chats' && {
                        display: {
                            xs: isMobileChatOpen ? 'flex' : 'none',
                            md: 'flex',
                        },
                    }),
                    ...(activeTab === 'friends' && {
                        display: {
                            xs: isMobileFriendViewOpen ? 'flex' : 'none',
                            md: 'flex',
                        },
                    }),
                }}
            >
                {activeTab === 'chats' &&
                    <ChatsMain
                        chat={chats.selectedChat}
                        messages={chats.messages}
                        isLoadingMessages={chats.isLoadingMessages}
                        isSendingMessage={chats.isSendingMessage}
                        newMessagesDividerMessageId={chats.newMessagesDividerMessageId}
                        typingUserIds={chats.typingUserIds}
                        onlineUserIds={chats.onlineUserIds}
                        loadError={chats.loadError}
                        hasMoreMessages={chats.hasMoreMessages}
                        loadMoreMessages={chats.loadMoreMessages}
                        sendMessage={chats.sendMessage}
                        sendImageMessage={chats.sendImageMessage}
                        startTyping={chats.startTyping}
                        stopTyping={chats.stopTyping}
                        showBackButton={isMobileChatOpen}
                        onBack={() => setIsMobileChatOpen(false)}
                        isPaneVisible={isChatDetailVisible}
                    />}
                {activeTab === 'friends' &&
                    <FriendsMain
                        activeFriendView={activeFriendView}
                        friends={friends.friends}
                        receivedRequests={friends.receivedRequests}
                        rejectedReceivedRequests={friends.rejectedReceivedRequests}
                        sentRequests={friends.sentRequests}
                        rejectedSentRequests={friends.rejectedSentRequests}
                        isLoading={friends.isLoading}
                        loadError={friends.loadError}
                        actionRequestId={friends.actionRequestId}
                        onRetry={friends.loadFriendRequests}
                        onAddFriend={() => setIsAddFriendOpen(true)}
                        onAccept={friends.acceptFriendRequest}
                        onReject={friends.rejectFriendRequest}
                        onMessageFriend={handleMessageFriend}
                        showBackButton={isMobileFriendViewOpen}
                        onBack={() => setIsMobileFriendViewOpen(false)}
                    />
                }
                {activeTab === 'profile' && <ProfileMain />}
            </Box>

            <Box
                component="nav"
                sx={{
                    display: { xs: shouldShowMobileNav ? 'flex' : 'none', md: 'none' },
                    flexShrink: 0,
                    height: 'calc(64px + env(safe-area-inset-bottom))',
                    pb: 'env(safe-area-inset-bottom)',
                    px: 1,
                    alignItems: 'center',
                    justifyContent: 'space-around',
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    backgroundColor: 'background.paper',
                }}
            >
                {(['chats', 'friends'] as HomeTab[]).map((tab) => {
                    const Icon = tabConfig[tab].icon;
                    const selected = activeTab === tab;

                    return (
                        <IconButton
                            key={tab}
                            aria-label={tabConfig[tab].label}
                            onClick={() => handleTabChange(tab)}
                            sx={{
                                width: 48,
                                height: 48,
                                color: selected ? 'primary.contrastText' : 'text.secondary',
                                backgroundColor: selected ? 'primary.main' : 'transparent',
                                borderRadius: 1,
                            }}
                        >
                            <Icon />
                        </IconButton>
                    );
                })}
                <IconButton
                    aria-label="Profile"
                    onClick={() => handleTabChange('profile')}
                    sx={{
                        width: 48,
                        height: 48,
                        color: activeTab === 'profile' ? 'primary.contrastText' : 'text.secondary',
                        backgroundColor: activeTab === 'profile' ? 'primary.main' : 'transparent',
                        borderRadius: 1,
                    }}
                >
                    <Avatar
                        src={profileImageSrc}
                        sx={{
                            width: 32,
                            height: 32,
                            fontSize: 12,
                            fontWeight: 800,
                            backgroundColor: activeTab === 'profile' ? 'primary.contrastText' : 'action.selected',
                            color: activeTab === 'profile' ? 'primary.main' : 'text.primary',
                        }}
                    >
                        {!profileImageSrc ? getInitials(user?.name ?? "User") : null}
                    </Avatar>
                </IconButton>
                <IconButton
                    aria-label="Logout"
                    onClick={() => setIsLogoutDialogOpen(true)}
                    sx={{ width: 48, height: 48, borderRadius: 1 }}
                >
                    <LogoutIcon />
                </IconButton>
            </Box>

            <AddFriendDialog
                open={isAddFriendOpen}
                isSending={friends.isSending}
                onClose={() => setIsAddFriendOpen(false)}
                onSend={friends.sendFriendRequest}
            />
            <StartChatDialog
                open={isStartChatOpen}
                friends={friends.friends}
                isLoadingFriends={friends.isLoading}
                isStartingChat={chats.isLoadingMessages}
                onClose={() => setIsStartChatOpen(false)}
                onStartChat={handleStartChat}
            />
            <LogoutConfirmDialog
                open={isLogoutDialogOpen}
                isLoggingOut={isLoggingOut}
                onClose={() => setIsLogoutDialogOpen(false)}
                onConfirm={() => void handleLogout()}
            />
        </Box>
    );
}
