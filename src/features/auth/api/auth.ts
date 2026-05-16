const BASE_URL = import.meta.env.VITE_BASE_SERVER_URL;
import { apiRequest } from "../../../lib/apiClient";

const OAuthLoginAPI = async (provider: string) => {
    window.location.href = `${BASE_URL}/api/auth/${provider}`;
}

const Logout = async () => {
    return apiRequest(`api/auth/logout`, {
        method: 'POST',
    });
}

export {
    OAuthLoginAPI,
    Logout
};
