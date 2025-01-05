'use client'
import ChatInterface from "@/components/ChatInterface"
import ProtectedRoute from "@/components/ProtectedRoute"
import { useEffect } from "react"

export default function Home() {
  
  return (
    <ProtectedRoute>
      <ChatInterface></ChatInterface>
    </ProtectedRoute>
  )
}