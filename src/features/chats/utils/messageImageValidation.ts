export const MAX_MESSAGE_IMAGE_SIZE = 5 * 1024 * 1024;
export const ALLOWED_MESSAGE_IMAGE_TYPES = ["image/png", "image/jpeg"];

export const validateMessageImageType = (file: File) => {
    if (!ALLOWED_MESSAGE_IMAGE_TYPES.includes(file.type)) {
        return "Only PNG and JPEG images are supported.";
    }

    return null;
};

export const validateMessageImageFile = (file: File) => {
    const typeError = validateMessageImageType(file);

    if (typeError) {
        return typeError;
    }

    if (file.size > MAX_MESSAGE_IMAGE_SIZE) {
        return "Image cannot exceed 5 MB.";
    }

    return null;
};
