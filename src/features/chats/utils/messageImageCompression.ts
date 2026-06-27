const MAX_COMPRESSED_IMAGE_DIMENSION = 1600;
const MESSAGE_IMAGE_JPEG_QUALITY = 0.82;

const loadImage = (file: File) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const image = new Image();

        image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(image);
        };

        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("Could not read image."));
        };

        image.src = objectUrl;
    });

const canvasToJpegBlob = (canvas: HTMLCanvasElement) =>
    new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    reject(new Error("Could not compress image."));
                    return;
                }

                resolve(blob);
            },
            "image/jpeg",
            MESSAGE_IMAGE_JPEG_QUALITY
        );
    });

const getCompressedFileName = (fileName: string) => {
    const fileNameWithoutExtension = fileName.replace(/\.[^.]*$/, "");
    return `${fileNameWithoutExtension || "image"}.jpg`;
};

export async function compressMessageImageFile(file: File) {
    const image = await loadImage(file);
    const scale = Math.min(
        1,
        MAX_COMPRESSED_IMAGE_DIMENSION / image.naturalWidth,
        MAX_COMPRESSED_IMAGE_DIMENSION / image.naturalHeight
    );
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
        throw new Error("Could not prepare image compression.");
    }

    canvas.width = width;
    canvas.height = height;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const compressedBlob = await canvasToJpegBlob(canvas);

    if (compressedBlob.size >= file.size && file.type === "image/jpeg") {
        return file;
    }

    return new File(
        [compressedBlob],
        getCompressedFileName(file.name),
        {
            type: "image/jpeg",
            lastModified: Date.now(),
        }
    );
}
