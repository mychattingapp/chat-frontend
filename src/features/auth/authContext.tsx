import { createContext, useCallback, useEffect, useState, type ReactNode } from "react";
import type { User } from "../../types/user";
import { apiRequest } from "../../lib/apiClient";
import type { AuthState } from "../../types/auth";

const AuthContext = createContext<AuthState | null>(null);
type AuthMeResponse = {
    user: User | null;
};

function AuthProvider({ children }: { children: ReactNode }) {

    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    const refreshUser = useCallback(async () => {
        setLoading(true);
        try {
            const data = await apiRequest<AuthMeResponse>('auth/me', { method: 'GET' });
            setUser(data.user ?? null);
        }
        catch {
            setUser(null);
        }
        finally {
            setLoading(false);
        }
    }, []);

    const logout = useCallback(async () => {
        setUser(null);
        try {
            await apiRequest('auth/logout', { method: 'POST' }, false);
        }
        catch {
            // Ignore logout errors; local state is already cleared.
        }
    }, []);

    useEffect(() => {
        void refreshUser();
    }, [refreshUser]);

    return (
        <AuthContext.Provider value={{ user, loading, refreshUser, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export { AuthContext, AuthProvider };
