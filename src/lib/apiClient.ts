const BASE_URL = import.meta.env.VITE_BASE_SERVER_URL;
type ApiError = Error & { status?: number };

let refreshPromise: Promise<unknown> | null = null;

const createApiError = (message: string, status?: number): ApiError => {
    const error = new Error(message) as ApiError;
    error.status = status;
    return error;
};

const isApiError = (error: unknown): error is ApiError => {
    return error instanceof Error;
};

const handleResponse = async <T>(response: Response): Promise<T> => {
    if (!response.ok) {
        const errorData = await response.json().catch(() => null) as { message?: string } | null;
        throw createApiError(errorData?.message || "Request failed", response.status);
    }
    return response.json().catch(() => ({} as T));
}

const apiRequest = async <T>(endpoint: string, options: RequestInit = {}, retry = true): Promise<T> => {
    const response = await fetch(`${BASE_URL}/${endpoint}`, {
        ...options,
        credentials: 'include',
    });

    try {
        return await handleResponse<T>(response);
    }
    catch (error: unknown) {
        if (isApiError(error) && error.status === 401 && retry) {
            try {
                await refreshToken();
                return apiRequest<T>(endpoint, options, false);
            }
            catch {
                throw new Error("Session expired. Please log in again.");
            }
        }
        throw error;
    }
}

const refreshToken = async () => {
  if (!refreshPromise) {
    refreshPromise = fetch(`${BASE_URL}/auth/refresh`, {
      method: 'GET',
      credentials: 'include',
    })
      .then((response) => handleResponse(response))
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

export {
    apiRequest
};
