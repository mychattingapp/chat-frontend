import { apiRequest } from "../../../lib/apiClient";
import type { Friend, FriendRequestStatus, ReceivedFriendRequest, SentFriendRequest } from "../types";

type SentFriendRequestsResponse = {
    success: boolean;
    FriendRequests: SentFriendRequest[];
};

type ReceivedFriendRequestsResponse = {
    success: boolean;
    FriendRequests: ReceivedFriendRequest[];
};

type SendFriendRequestResponse = {
    success: boolean;
    friendRequest: SentFriendRequest;
};

type FriendRequestActionResponse = {
    success: boolean;
    friendRequest: ReceivedFriendRequest;
};

type AllFriendsResponse = {
    success: boolean;
    Friends: Friend[];
};

export const getAllFriends = async () => {
    const response = await apiRequest<AllFriendsResponse>('api/friends', {
        method: 'GET',
    });

    return response.Friends;
};

export const getSentFriendRequests = async (status: FriendRequestStatus = 'PENDING') => {
    const response = await apiRequest<SentFriendRequestsResponse>(`api/friends/requests/sent?status=${status}`, {
        method: 'GET',
    });

    return response.FriendRequests;
};

export const getReceivedFriendRequests = async (status: FriendRequestStatus = 'PENDING') => {
    const response = await apiRequest<ReceivedFriendRequestsResponse>(`api/friends/requests/received?status=${status}`, {
        method: 'GET',
    });

    return response.FriendRequests;
};

export const sendFriendRequest = async (recipientEmail: string) => {
    const response = await apiRequest<SendFriendRequestResponse>('api/friends/requests', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recipientEmail }),
    });

    return response.friendRequest;
};

export const acceptFriendRequest = async (friendRequestId: string) => {
    const response = await apiRequest<FriendRequestActionResponse>(`api/friends/requests/${friendRequestId}/accept`, {
        method: 'PATCH',
    });

    return response.friendRequest;
};

export const rejectFriendRequest = async (friendRequestId: string) => {
    const response = await apiRequest<FriendRequestActionResponse>(`api/friends/requests/${friendRequestId}/reject`, {
        method: 'PATCH',
    });

    return response.friendRequest;
};
