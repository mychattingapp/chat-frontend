const DAY_MS = 24 * 60 * 60 * 1000;

const startOfLocalDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getDayDifference = (date: Date) => {
    const today = startOfLocalDay(new Date());
    const targetDay = startOfLocalDay(date);

    return Math.round((today.getTime() - targetDay.getTime()) / DAY_MS);
};

export const isSameCalendarDate = (firstDate: string, secondDate: string) => {
    const first = new Date(firstDate);
    const second = new Date(secondDate);

    return first.getFullYear() === second.getFullYear()
        && first.getMonth() === second.getMonth()
        && first.getDate() === second.getDate();
};

export const formatRelativeChatDate = (createdAt: string, includeTodayTime = false) => {
    const date = new Date(createdAt);
    const dayDifference = getDayDifference(date);

    if (dayDifference === 0) {
        return includeTodayTime
            ? new Intl.DateTimeFormat(undefined, {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
            }).format(date)
            : 'Today';
    }

    if (dayDifference === 1) {
        return 'Yesterday';
    }

    if (dayDifference > 1 && dayDifference < 7) {
        return new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(date);
    }

    return new Intl.DateTimeFormat(undefined, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(date);
};
