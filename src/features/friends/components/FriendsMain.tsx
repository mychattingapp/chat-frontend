import AddIcon from '@mui/icons-material/Add';
import { Box, Button, Stack, Typography } from "@mui/material";
import FriendList from "./FriendList";
import type { Friend, FriendListItem, FriendView, ReceivedFriendRequest, SentFriendRequest } from "../types";

const titles: Record<FriendView, { title: string; description: string }> = {
    all: {
        title: 'All friends',
        description: 'People you are connected with.',
    },
    received: {
        title: 'Friend requests received',
        description: 'Review incoming friend requests.',
    },
    sent: {
        title: 'Friend requests sent',
        description: 'Track outgoing friend requests.',
    },
    blocked: {
        title: 'Blocked users',
        description: 'Blocked users are not wired yet.',
    },
};

type FriendsMainProps = {
    activeFriendView: FriendView;
    friends: Friend[];
    receivedRequests: ReceivedFriendRequest[];
    rejectedReceivedRequests: ReceivedFriendRequest[];
    sentRequests: SentFriendRequest[];
    rejectedSentRequests: SentFriendRequest[];
    isLoading: boolean;
    loadError: string | null;
    actionRequestId: string | null;
    onRetry: () => void;
    onAddFriend: () => void;
    onAccept: (friendRequestId: string) => Promise<void>;
    onReject: (friendRequestId: string) => Promise<void>;
};

const mapReceivedRequest = (request: ReceivedFriendRequest): FriendListItem => ({
    id: request.id,
    username: request.requester.username,
    email: request.requester.email,
    createdAt: request.createdAt,
});

const mapSentRequest = (request: SentFriendRequest): FriendListItem => ({
    id: request.id,
    username: request.recipient.username,
    email: request.recipient.email,
    createdAt: request.createdAt,
});

const mapFriend = (friend: Friend): FriendListItem => ({
    id: friend.friendshipId,
    username: friend.username,
    email: friend.email,
    createdAt: '',
    profileImageUrl: null,
});

export default function FriendsMain({
    activeFriendView,
    friends,
    receivedRequests,
    rejectedReceivedRequests,
    sentRequests,
    rejectedSentRequests,
    isLoading,
    loadError,
    actionRequestId,
    onRetry,
    onAddFriend,
    onAccept,
    onReject,
}: FriendsMainProps) {
    const content = titles[activeFriendView];
    const items = activeFriendView === 'all'
        ? friends.map(mapFriend)
        : activeFriendView === 'received'
            ? receivedRequests.map(mapReceivedRequest)
            : sentRequests.map(mapSentRequest);
    const rejectedItems = activeFriendView === 'received'
        ? rejectedReceivedRequests.map(mapReceivedRequest)
        : activeFriendView === 'sent'
            ? rejectedSentRequests.map(mapSentRequest)
            : [];

    return (
        <Box sx={{ width: '100%', flex: 1 }}>
            {/* <Typography variant="overline" sx={{ color: 'primary.light', fontWeight: 800, letterSpacing: 1.4 }}>
                Friends
            </Typography> */}
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                justifyContent="space-between"
                spacing={2}
                sx={{ mb: 4 }}
            >
                <Box>
                    <Typography variant="h3" sx={{ color: 'text.primary', fontWeight: 800, mt: 1 }}>
                        {content.title}
                    </Typography>
                    <Typography variant="body1" sx={{ color: 'text.secondary', mt: 1.5 }}>
                        {content.description}
                    </Typography>
                </Box>
                {activeFriendView === 'all' && (
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={onAddFriend}
                        sx={{ flexShrink: 0 }}
                    >
                        Add friend
                    </Button>
                )}
            </Stack>
            {loadError && activeFriendView !== 'blocked' ? (
                <Box
                    sx={{
                        width: '100%',
                        maxWidth: 760,
                        mx: 'auto',
                        p: 3,
                        borderRadius: 1,
                        backgroundColor: 'background.paper',
                        border: '1px solid',
                        borderColor: 'divider',
                    }}
                >
                    <Typography sx={{ color: 'text.primary', fontWeight: 800 }}>
                        Could not load friends.
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                        {loadError}
                    </Typography>
                    <Button variant="outlined" sx={{ mt: 2 }} onClick={onRetry}>
                        Retry
                    </Button>
                </Box>
            ) : activeFriendView === 'blocked' ? (
                <Box
                    sx={{
                        width: '100%',
                        maxWidth: 760,
                        mx: 'auto',
                        p: 3,
                        borderRadius: 1,
                        backgroundColor: 'background.paper',
                        border: '1px dashed',
                        borderColor: 'divider',
                    }}
                >
                    <Typography sx={{ color: 'text.secondary' }}>
                        Blocked users will show here after blocking is added to the backend.
                    </Typography>
                </Box>
            ) : (
                <Stack spacing={4}>
                    <FriendList
                        type={activeFriendView}
                        items={items}
                        isLoading={isLoading}
                        actionRequestId={actionRequestId}
                        onAccept={onAccept}
                        onReject={onReject}
                    />
                    {(activeFriendView === 'received' || activeFriendView === 'sent') && (
                        <Box sx={{ width: '100%', maxWidth: 760, mx: 'auto' }}>
                            <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 800, mb: 1.5 }}>
                                {activeFriendView === 'received' ? 'Requests you rejected' : 'Rejected by others'}
                            </Typography>
                            <FriendList
                                type={activeFriendView}
                                items={rejectedItems}
                                isLoading={false}
                                actionRequestId={actionRequestId}
                                onAccept={onAccept}
                                onReject={onReject}
                                isReadOnly
                                emptyMessage={
                                    activeFriendView === 'received'
                                        ? 'No requests rejected by you.'
                                        : 'No rejected sent requests.'
                                }
                            />
                        </Box>
                    )}
                </Stack>
            )}
        </Box>
    );
}
