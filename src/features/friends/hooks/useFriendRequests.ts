import { useCallback, useEffect, useMemo, useState } from "react";
import { useSnackbar } from "../../../shared/snackbar";
import {
    acceptFriendRequest,
    getAllFriends,
    getReceivedFriendRequests,
    getSentFriendRequests,
    rejectFriendRequest,
    sendFriendRequest,
} from "../api";
import type { Friend, FriendRequestCounts, ReceivedFriendRequest, SentFriendRequest } from "../types";

const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) {
        return error.message;
    }

    return "Something went wrong.";
};

export function useFriendRequests(enabled: boolean) {
    const { showSnackbar } = useSnackbar();
    const [friends, setFriends] = useState<Friend[]>([]);
    const [receivedRequests, setReceivedRequests] = useState<ReceivedFriendRequest[]>([]);
    const [rejectedReceivedRequests, setRejectedReceivedRequests] = useState<ReceivedFriendRequest[]>([]);
    const [sentRequests, setSentRequests] = useState<SentFriendRequest[]>([]);
    const [rejectedSentRequests, setRejectedSentRequests] = useState<SentFriendRequest[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [actionRequestId, setActionRequestId] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);

    const counts = useMemo<FriendRequestCounts>(() => ({
        all: friends.length,
        received: receivedRequests.length,
        sent: sentRequests.length,
        blocked: 0,
    }), [friends.length, receivedRequests.length, sentRequests.length]);

    const loadFriendRequests = useCallback(async () => {
        setIsLoading(true);
        setLoadError(null);

        try {
            const [allFriends, received, rejectedReceived, sent, rejectedSent] = await Promise.all([
                getAllFriends(),
                getReceivedFriendRequests('PENDING'),
                getReceivedFriendRequests('REJECTED'),
                getSentFriendRequests('PENDING'),
                getSentFriendRequests('REJECTED'),
            ]);

            setFriends(allFriends);
            setReceivedRequests(received);
            setRejectedReceivedRequests(rejectedReceived);
            setSentRequests(sent);
            setRejectedSentRequests(rejectedSent);
            setHasLoaded(true);
        }
        catch (error: unknown) {
            setLoadError(getErrorMessage(error));
        }
        finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (enabled && !hasLoaded && !isLoading) {
            void loadFriendRequests();
        }
    }, [enabled, hasLoaded, isLoading, loadFriendRequests]);

    const handleSendFriendRequest = useCallback(async (recipientEmail: string) => {
        setIsSending(true);

        try {
            const createdRequest = await sendFriendRequest(recipientEmail);
            setSentRequests((current) => [createdRequest, ...current]);
            showSnackbar({ message: "Friend request sent.", severity: "success" });
            return true;
        }
        catch (error: unknown) {
            showSnackbar({ message: getErrorMessage(error), severity: "error" });
            return false;
        }
        finally {
            setIsSending(false);
        }
    }, [showSnackbar]);

    const handleAcceptFriendRequest = useCallback(async (friendRequestId: string) => {
        setActionRequestId(friendRequestId);

        try {
            await acceptFriendRequest(friendRequestId);
            void loadFriendRequests();
            setReceivedRequests((current) => current.filter((request) => request.id !== friendRequestId));
            showSnackbar({ message: "Friend request accepted.", severity: "success" });
        }
        catch (error: unknown) {
            showSnackbar({ message: getErrorMessage(error), severity: "error" });
        }
        finally {
            setActionRequestId(null);
        }
    }, [loadFriendRequests, showSnackbar]);

    const handleRejectFriendRequest = useCallback(async (friendRequestId: string) => {
        setActionRequestId(friendRequestId);

        try {
            await rejectFriendRequest(friendRequestId);
            setReceivedRequests((current) => current.filter((request) => request.id !== friendRequestId));
            showSnackbar({ message: "Friend request rejected.", severity: "success" });
        }
        catch (error: unknown) {
            showSnackbar({ message: getErrorMessage(error), severity: "error" });
        }
        finally {
            setActionRequestId(null);
        }
    }, [showSnackbar]);

    return {
        friends,
        receivedRequests,
        rejectedReceivedRequests,
        sentRequests,
        rejectedSentRequests,
        counts,
        isLoading,
        loadError,
        actionRequestId,
        isSending,
        loadFriendRequests,
        sendFriendRequest: handleSendFriendRequest,
        acceptFriendRequest: handleAcceptFriendRequest,
        rejectFriendRequest: handleRejectFriendRequest,
    };
}
