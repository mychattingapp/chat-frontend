export const uploadToSignedUrl = async (uploadUrl: string, file: File, contentType: string) => {
    const response = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
            "Content-Type": contentType,
        },
        body: file,
    });

    if (!response.ok) {
        throw new Error("Image upload failed.");
    }
};
