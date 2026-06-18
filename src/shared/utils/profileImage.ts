export const getProfileImageSrc = (profileImageUrl?: string | null, updatedAt?: string | null) => {
    if (!profileImageUrl) {
        return undefined;
    }

    if (!updatedAt) {
        return profileImageUrl;
    }

    const separator = profileImageUrl.includes("?") ? "&" : "?";
    return `${profileImageUrl}${separator}v=${encodeURIComponent(updatedAt)}`;
};
