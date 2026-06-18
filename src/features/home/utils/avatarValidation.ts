const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg"];

export const validateAvatarFile = (file: File) => {
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
        return "Only PNG and JPEG images are supported.";
    }

    if (file.size > MAX_AVATAR_SIZE) {
        return "Image cannot exceed 5 MB.";
    }

    return null;
};
