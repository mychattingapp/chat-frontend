type User = {
    role: 'USER' | 'ADMIN';
    id: string;
    name: string;
    email: string;
    profileImageUrl: string | null;
    updatedAt: string;
};

export type { User };
