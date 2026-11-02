import type { User } from "./user";

type AuthState = {
    user: User | null;
    loading: boolean;
    refreshUser: () => Promise<void>;
    logout: () => Promise<void>;
    clearSession: () => void;
}

export type { AuthState };
