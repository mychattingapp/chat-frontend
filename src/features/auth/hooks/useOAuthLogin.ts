import { useState } from "react";
import { OAuthLoginAPI } from "../api/auth";
import useAuth from "./useAuth";

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong";
};

export default function useOAuthLogin() {
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { logout } = useAuth();

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      await OAuthLoginAPI("google");
      // redirect or update auth state
      console.log("Google login successful");
    }
    catch (error: unknown) {
      setError(getErrorMessage(error));
    }
    finally {
      setLoading(false);
    }
  };

  const loginWithGitHub = async () => {
    setLoading(true);
    try {
    //   await oauthLoginAPI("github");
    }
    catch (error: unknown) {
      setError(getErrorMessage(error));
    }
    finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      // Prefer AuthContext.logout() so UI updates immediately.
      await logout();
    }
    catch (error: unknown) {
      setError(getErrorMessage(error));
    }
    finally {
      setLoading(false);
    }
  };

  return { loginWithGoogle, loginWithGitHub, handleLogout, isLoading, error };
}
