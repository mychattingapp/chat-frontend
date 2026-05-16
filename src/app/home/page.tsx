import { Box, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import LogoutIcon from '@mui/icons-material/Logout';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import { useState } from "react";
import LogoutConfirmDialog from '../../features/auth/components/LogoutConfirmDialog';
import useOAuthLogin from "../../features/auth/hooks/useOAuthLogin";
import { ChatsMain, ChatsSidebar } from "../../features/chats";
import { AddFriendDialog, FriendsMain, FriendsSidebar, useFriendRequests, type FriendView } from "../../features/friends";
import { ProfileMain } from "../../features/home/components";

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

export default function HomePage() {
    const { handleLogout, isLoading: isLoggingOut } = useOAuthLogin();
    const [activeTab, setActiveTab] = useState<HomeTab>('chats');
    const [activeFriendView, setActiveFriendView] = useState<FriendView>('all');
    const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
    const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
    const friends = useFriendRequests(activeTab === 'friends');
    const activeConfig = tabConfig[activeTab];
    const shouldShowSidebar = activeTab !== 'profile';

    return (
        <Box
            sx={{
                height: '100vh',
                width: '100%',
                overflow: 'hidden',
                display: 'flex',
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
                    display: 'flex',
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
                                    onClick={() => setActiveTab(tab)}
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
                            onClick={() => setActiveTab('profile')}
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
                            <PersonOutlineIcon />
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
                        width: 380,
                        flexShrink: 0,
                        p: 3,
                        borderRight: '1px solid',
                        borderColor: 'divider',
                        backgroundColor: 'background.paper',
                        overflow: 'auto',
                    }}
                >
                    <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary' }}>
                        {activeConfig.sidebarTitle}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75, mb: 3 }}>
                        {activeConfig.sidebarDescription}
                    </Typography>

                    {activeTab === 'chats' ? (
                        <ChatsSidebar />
                    ) : (
                        <FriendsSidebar
                            activeFriendView={activeFriendView}
                            onFriendViewChange={setActiveFriendView}
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
                    p: { xs: 3, md: 5 },
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'auto',
                }}
            >
                {activeTab === 'chats' && <ChatsMain />}
                {activeTab === 'friends' && (
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
                    />
                )}
                {activeTab === 'profile' && <ProfileMain />}
            </Box>

            <AddFriendDialog
                open={isAddFriendOpen}
                isSending={friends.isSending}
                onClose={() => setIsAddFriendOpen(false)}
                onSend={friends.sendFriendRequest}
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
