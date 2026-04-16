import { Navigate, Outlet } from "react-router-dom";
import useAuth from "./hooks/useAuth";

export const ProtectedRoute = () => {
    const { user, loading } = useAuth();

    if (loading) return null;

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;

}

export const PublicRoute = () => {
    const { user, loading } = useAuth();

    if (loading) return null;

    if (user) {
        return <Navigate to="/home" replace />;
    }

    return <Outlet />;
}