'use client'

import { useContext, useState,useEffect } from "react";
import AuthContext from "../../components/AuthContext";

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { useRouter } from "next/navigation";

const Login = () => {
    const {user, login} = useContext(AuthContext);
    const [username, setUsername] = useState('')
    const [password, setPassword]= useState('')
    const [error, setError] = useState('')
    const router = useRouter();

    // Redirect to home if the user is logged in
    useEffect(() => {
        if (user) {
            router.push('/');  // Redirect after mount
        }
    }, [user, router]); // Only run this when `user` changes

    const handleSubmit = (e) => {
        setError('')
        e.preventDefault();
        setError(login(username,password))
    }

    return(
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Card className="w-full max-w-md">
            <CardHeader>
            <CardTitle className="text-2xl font-bold">Login</CardTitle>
            <CardDescription>Please enter your credentials to log in.</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                <Label htmlFor="userId">User Name</Label>
                <Input
                    id="username"
                    type="text"
                    placeholder="Enter your user name"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />
                </div>
                <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                </div>
                {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
                )}
            </CardContent>
            <CardFooter>
                <Button type="submit" className="w-full">Log In</Button>
            </CardFooter>
            </form>
        </Card>
        </div>
    )
}

export default Login;