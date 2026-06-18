import { apiRequest } from "../../../lib/apiClient";
import type { User } from "../../../types/user";

type ProfileResponse = {
    success: boolean;
    data: {
        user: User;
    };
};

type AvatarUploadUrlResponse = {
    success: boolean;
    data: {
        uploadUrl: string;
        contentType: "image/png" | "image/jpeg";
    };
};

export const updateProfile = async (name: string) => {
    const response = await apiRequest<ProfileResponse>('api/users/me', {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
    });

    return response.data.user;
};

export const getAvatarUploadUrl = async (file: File) => {
    const response = await apiRequest<AvatarUploadUrlResponse>('api/images/upload-url', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            purpose: 'avatar',
            fileType: file.type,
            fileSize: file.size,
        }),
    });

    return response.data;
};

export const confirmAvatarUpload = async () => {
    const response = await apiRequest<ProfileResponse>('api/images/avatar', {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
    });

    return response.data.user;
};
