"use client";

import { createContext, useState, useEffect } from "react";
import axios from 'axios';
import { useRouter } from "next/navigation";
import {jwtDecode} from 'jwt-decode';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const router = useRouter();

    useEffect(() => {
        // Check if a token exists in localStorage when the component mounts
        const token = localStorage.getItem('token');
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            // Fetch user details if necessary or set user state directly
            const decodedToken = jwtDecode(token);
            setUser({
                username: decodedToken.sub,  // 'sub' is the username in the token
                role: decodedToken.role,      // 'role' is the role in the token
                access_token: token           // Store the access token as well
            });
        }
    }, []);

    const login = async (username, password) => {
        try {
            const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL;

            const formData = new FormData();
            formData.append('username', username);
            formData.append('password', password);
            const response = await axios.post(`${backendURL}/auth/token`, formData, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });
            
            const token = response.data.access_token;
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

            // Decode the token to extract user details
            const decodedToken = jwtDecode(token);
            localStorage.setItem('token', token);

            setUser({
                username: decodedToken.sub,  // 'sub' is the username in the token
                role: decodedToken.role,      // 'role' is the role in the token
                access_token: token           // Store the access token as well
            });

            router.push('/');
        } catch (error) {
            console.log('Login Failed: ', error);
            return error.response?.data?.detail;
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
        router.push('/login');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
