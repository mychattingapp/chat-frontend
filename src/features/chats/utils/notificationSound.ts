const MESSAGE_NOTIFICATION_SOUND_PATH = '/sounds/message-notification.mp3';

let messageNotificationAudio: HTMLAudioElement | null = null;

const getMessageNotificationAudio = () => {
    if (!messageNotificationAudio) {
        messageNotificationAudio = new Audio(MESSAGE_NOTIFICATION_SOUND_PATH);
        messageNotificationAudio.preload = 'auto';
    }

    return messageNotificationAudio;
};

export const playMessageNotificationSound = () => {
    const audio = getMessageNotificationAudio();
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
};
