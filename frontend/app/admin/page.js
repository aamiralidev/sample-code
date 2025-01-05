'use client'

import { useState, useContext, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UserPlus, Trash2, Key, Users } from 'lucide-react'
import AuthContext from '../../components/AuthContext'


export default function AdminPanel() {

  const {user,login,logout} = useContext(AuthContext);
  const router = useRouter();

  const [users, setUsers] = useState([])
  const [newUsername, setNewUsername] = useState('')
  const [newRole, setNewRole] = useState('user')
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [selectedUserEmail, setSelectedUserEmail] = useState(null)
  const [newPassword, setNewPassword] = useState('')

  const [updatePassword, setUpdatePassword] = useState('')

  const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL;

useEffect(()=>{
    // console.log(user);
    if(!user){
        router.push('/login')
    }
    if(user?.role !== 'admin'){
        router.push('/')
    }

}, [user,router]);

useEffect(()=>{
    fetchUsers();
}, [])

async function fetchUsers() {
    try {
        const response = await fetch(`http://${backendURL}/users`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${user.access_token}`,  // Pass the token in the header
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error("Failed to fetch users: " + response.statusText);
        }
        if(response.status == 401){
            logout();
        }
        const users = await response.json();
        setUsers(users)

    } catch (error) {
        console.error("Error fetching users:", error);
    }
}

async function createUser(username, password, role) {

    try {
        const response = await fetch(`http://${backendURL}/auth`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${user.access_token}`,  // Admin authorization token
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username: username,
                password: password,
                role: role
            })
        });

        
        if (!response.ok) {
            const res = await response.json();
            alert(res.detail)
            throw new Error("Failed to create user: " + response.statusText);
        }

        if(response.status == 401){
            logout();
        }

        const data = await response.json();
        console.log(data.message);  // Expected response: "User created successfully"
        
        fetchUsers();
        setNewUsername('')
        setNewPassword('')
        setNewRole('user')

    } catch (error) {
        console.error("Error creating user:", error);
        // alert('Failed to create user')
    }
}


 

  const addUser = () => {
    if (newUsername && newRole && newPassword) {
        createUser(newUsername, newPassword, newRole);
    }
    else{
        alert("Please provide a password and a username to create a user")
    }
  }

async function deleteUser(userName) {
    try {
        const response = await fetch(`http://${backendURL}/users/${userName}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${user.access_token}`,  // Include the token if required
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            console.log("User deleted successfully");
            fetchUsers();
            alert('User deleted Successfully')
        } else if (response.status === 404) {
            console.log("User not found");
        } else {
            console.log("Failed to delete user:", await response.json());
        }

        if(response.status == 401){
            logout();
        }

    } catch (error) {
        console.error("Error:", error);
    }
  }

  async function changePassword(userName, newPassword) {
    const userRequest = {
        password: newPassword,  // Only change the password
    };

    try {
        const response = await fetch(`http://${backendURL}/users/${userName}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,  // Include token if needed
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userRequest)
        });

        if (response.ok) {
            const updatedUser = await response.json();
            console.log("Password updated successfully", updatedUser);
            setIsPasswordModalOpen(false)
            setUpdatePassword('')

            alert('Password updated successfully')
        } else {
            const errorData = await response.json();
            console.log("Failed to update password:", errorData);
        }

        if(response.status == 401){
            logout();
        }
        

    } catch (error) {
        console.error("Error:", error);
        alert('Failed to change password')
    }
}

  const openPasswordModal = (username) => {
    setSelectedUserEmail(username)
    setIsPasswordModalOpen(true)
  }

  const changeThePassword = () => {

    if (selectedUserEmail && updatePassword) {
      changePassword(selectedUserEmail, updatePassword)
    }
    else{
        alert('Please provide a password')
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 flex flex-col">
      <Card className="flex-grow flex flex-col max-w-4xl mx-auto">
        <CardHeader className="bg-primary text-primary-foreground">
          <CardTitle className="text-2xl flex items-center gap-2">
            <Users size={24} />
            Admin Panel
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 flex-grow flex flex-col">
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <UserPlus size={20} />
              Add New User
            </h2>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Username"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="flex-grow"
              />
              <Input
                type="password"
                placeholder="Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="flex-grow"
              />
              <Select value={newRole} onValueChange={(value) => setNewRole(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={addUser} className="bg-green-600 hover:bg-green-700">Add User</Button>
            </div>
          </div>

          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Users size={20} />
            User List
          </h2>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Username</TableHead>
                  <TableHead className="w-[100px]">Role</TableHead>
                  <TableHead className="w-[300px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                        {user.role}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Button variant="outline" size="sm" className="mr-2" onClick={() => openPasswordModal(user.username)}>
                        <Key size={16} className="mr-1" /> Change Password
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => deleteUser(user.username)}>
                        <Trash2 size={16} className="mr-1" /> Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <Input
            type="password"
            placeholder="New Password"
            value={updatePassword}
            onChange={(e) => setUpdatePassword(e.target.value)}
            className="my-4"
          />
          <Button onClick={changeThePassword} className="w-full">Save New Password</Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}

