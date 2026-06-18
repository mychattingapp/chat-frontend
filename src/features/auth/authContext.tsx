import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { User } from "../../types/user";
import { apiRequest } from "../../lib/apiClient";
import { AuthContext } from "./authContextValue";

type AuthMeResponse = {
    success: boolean;
    data: {
        user: User | null;
    };
};

function AuthProvider({ children }: { children: ReactNode }) {

    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const hasCheckedAuthRef = useRef(false);

    const refreshUser = useCallback(async () => {
        if (!hasCheckedAuthRef.current) {
            setLoading(true);
        }

        try {
            const response = await apiRequest<AuthMeResponse>('api/auth/me', { method: 'GET' });
            setUser(response.data.user ?? null);
        }
        catch {
            setUser(null);
        }
        finally {
            hasCheckedAuthRef.current = true;
            setLoading(false);
        }
    }, []);

    const logout = useCallback(async () => {
        setUser(null);
        try {
            await apiRequest('api/auth/logout', { method: 'POST' }, false);
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

export { AuthProvider };
