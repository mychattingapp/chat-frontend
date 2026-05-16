export type FriendView = 'all' | 'received' | 'sent' | 'blocked';

export type FriendRequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export type FriendRequestUser = {
    id: string;
    username: string;
    email: string;
};

export type SentFriendRequest = {
    id: string;
    status: FriendRequestStatus;
    createdAt: string;
    recipient: FriendRequestUser;
};

export type ReceivedFriendRequest = {
    id: string;
    status: FriendRequestStatus;
    createdAt: string;
    requester: FriendRequestUser;
};

export type FriendListItem = {
    id: string;
    username: string;
    email: string;
    createdAt: string;
    profileImageUrl?: string | null;
};

export type FriendRequestCounts = Record<FriendView, number>;

export type Friend = {
    friendshipId: string;
    id: string;
    username: string;
    email: string;
};
