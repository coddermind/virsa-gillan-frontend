"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { apiClient, User } from "@/lib/api";
import { useRouter } from "next/navigation";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, passwordConfirm: string, firstName?: string, lastName?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const userData = await apiClient.getProfile();
        // Ensure user_type is present, if not, it might be an old session
        if (!userData.user_type) {
          console.warn("User data missing user_type, refreshing...");
          // Force a fresh fetch by logging out and requiring re-login
          localStorage.removeItem("token");
          apiClient.setToken(null);
          setUser(null);
        } else {
          setUser(userData);
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        localStorage.removeItem("token");
        apiClient.setToken(null);
        setUser(null);
      }
    }
    setLoading(false);
  };

  const login = async (email: string, password: string) => {
    const response = await apiClient.login(email, password);
    setUser(response.user);
    router.push("/dashboard");
  };

  const register = async (
    email: string,
    password: string,
    passwordConfirm: string,
    firstName?: string,
    lastName?: string
  ) => {
    const response = await apiClient.register(email, password, passwordConfirm, firstName, lastName);
    setUser(response.user);
    router.push("/dashboard");
  };

  const logout = () => {
    setUser(null);
    apiClient.setToken(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

