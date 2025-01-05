'use client'

import { Device } from "@twilio/voice-sdk";
import { useState, useEffect, useContext, useRef } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {Switch} from '@/components/ui/switch'
import { Menu, D, MoreVertical, Phone, Search, Send, Video, User, Archive, ArchiveRestore, MessageCircle, Settings, LogOut } from 'lucide-react'
import Chat from "@/components/Chat"
import userIcon from '../app/icons/user-round.svg'
import { cn } from "@/lib/utils"
import AuthContext from "@/components/AuthContext"
import { useRouter } from "next/navigation"
import { jwtDecode } from "jwt-decode";
import TopNotificationBar from "./TopNotificationBar";

export default function ChatInterface() {

  const {user, login, logout} = useContext(AuthContext);
  const router = useRouter();

  const deviceRef = useRef(null); // Persistent Device instance
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const [isGPTEnabled, setIsGPTEnabled] = useState(false)
  const [contacts, setContacts] = useState([])
  const [selectedChat, setSelectedChat] = useState(null)
  const [searchQuery, setSearchQuery] = useState(""); // State for search query
  const [loadFailed, setloadFailed] = useState(false)
  const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL;

  const [callState, setCallState] = useState("idle"); // idle, ringing, active
  const [isIncoming, setIsIncoming] = useState(true); // Incoming
  const [callDuration, setCallDuration] = useState(0); // Call duration in seconds
  const callTimerRef = useRef(null); // Ref to manage call timer

  // const [incomingCall, setIncomingCall] = useState({parameters: {From: '1234567890'}});  //for testing of notification bar
  const [incomingCall, setIncomingCall] = useState(null); // Incoming call object
  const [outgoingCall, setOutgoingCall] = useState(null); // Outgoing call
  const [micVolume, setMicVolume] = useState(0);
  const [speakerVolume, setSpeakerVolume] = useState(0);

  // const token = localStorage.getItem('token')
  // const filteredContacts = (contacts || []).filter(contact =>
  //   contact.phone_number?.toLowerCase().includes(searchQuery.toLowerCase())
  // );

  // Filtered contacts based on search and archive status
  const filteredContacts = contacts.filter(contact => {
    // If searchTerm is active, ignore the archive status
    if (searchQuery) {
        return contact.phone_number?.toLowerCase().includes(searchQuery.toLowerCase())
    } else {
        return showArchived ? contact.is_archived : !contact.is_archived;
    }
  });

  useEffect(() => {
    if (Notification.permission === "default") {
        Notification.requestPermission()
            .then((permission) => {
                if (permission === "granted") {
                    console.log("Notifications enabled!");
                } else {
                    console.log("Notifications denied!");
                }
            })
            .catch((err) => console.error("Error requesting notification permission:", err));
    }
}, []);

const showNotification = (call) => {
  if (Notification.permission === "granted") {
      const notification = new Notification(`Incoming Call From ${call.parameters.From}`, {
        icon: "/call.png",
        tag: call.parameters.CallSid,
        renotify: false,
        // requireInteraction: true,
        priority: 1
    });

      // Handle button clicks
      notification.addEventListener("click", (event) => {

              console.log("Notification clicked (no action).");
          
      });
      notification.addEventListener("close", ()=>{
        console.log("Notification closed.");
      })
  } else {
      console.log("Notifications not allowed by the user.");
  }
};

  // Inside the Home component
  const handleChatSelect = (contact) => {

    // console.log(contact)
    toggleSidebar();
    setSelectedChat(contact); // Set the selected chat to the clicked contact
    
    // setSelectedChat({phone_number: '0123456', is_archived: false, message: "", unread_count: 0, timestamp: '2024-11-06T20:49:55.694712+00:00'})

    setTimeout(()=>{
      fetchContacts();
    }, 1000)
    
  }

  const [availableDevices, setAvailableDevices] = useState({
    speakers: [],
    ringers: [],
  });
  const [selectedDevices, setSelectedDevices] = useState({
    speakers: [],
    ringers: [],
  });
  
  const updateAudioDevices = () => {
    deviceRef.current.audio.speakerDevices.set(selectedDevices.speakers);
    deviceRef.current.audio.ringtoneDevices.set(selectedDevices.ringers);
  };

  const bindVolumeIndicators = (call) => {
    call.on("volume", (inputVolume, outputVolume) => {
      setMicVolume(Math.floor(inputVolume * 100)); // Convert to percentage
      setSpeakerVolume(Math.floor(outputVolume * 100));
    });
  };

  const initializeTwilioDevice = async () => {
    try {
      const username = user.username || "defaultUser";
      const response = await fetch(`${backendURL}/token?identity=${username}`);
      const data = await response.json();

      if (!data.token) {
        throw new Error("Failed to retrieve Twilio token");
      }
      const token = data.token;
      const decodedToken = jwtDecode(token);
      const identity = decodedToken.sub || decodedToken.identity;
      console.log('decodedToken: ', decodedToken);
      console.log('Device Identity:', identity);

      deviceRef.current = new Device(data.token, { allowIncomingWhileBusy: true, closeProtection: true, logLevel: 1, codecPreferences: ["opus", "pcmu"],});
      deviceRef.current.on("registered", () => console.log("Twilio Device registered successfully"));
      deviceRef.current.on("incoming", handleIncomingCall);
      const device = deviceRef.current;

      deviceRef.current.on("deviceChange", () => {
        console.log("Device change detected");
        updateAudioDevices();
      });
      deviceRef.current.on("error", (error) => console.error("Device error:", error.message));
      // deviceRef.current.on("disconnect", () => console.log("Device disconnected"));
      deviceRef.current.register();
    } catch (error) {
      console.error("Error initializing Twilio Device:", error);
    }
  };

  const startCallTimer = () => {
    setCallDuration(0); // Reset duration
    callTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  };

  const stopCallTimer = () => {
    clearInterval(callTimerRef.current);
    callTimerRef.current = null;
  };

  const formatCallDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleIncomingCall = (call) => {
    if(callState != "idle") {
      console.log("Ignoring incoming call as device is not free");
      call.reject();
      return;
    }
    bindVolumeIndicators(call);
    setIsIncoming(true);
    setIncomingCall(call);
    setCallState("ringing");
    // showNotification(call);

    const handleDisconnectedIncomingCall = () => {
      console.log("Incoming call disconnected.");
      // setIncomingCall(null);
      setCallState("idle");
    }

    call.on("disconnect", handleDisconnectedIncomingCall);
    // call.on("cancel", handleDisconnectedIncomingCall);
    call.on("reject", handleDisconnectedIncomingCall);

    call.on("error", (error) => {
      console.error("Incoming call error:", error.message);
      // setIncomingCall(null);
      setCallState("idle");
    });
  };

  const acceptIncomingCall = () => {
    if (incomingCall) {
      if (incomingCall.status() === "closed"){
        setCallState("idle");
        // setIncomingCall(null);
      }else{
        setCallState("active");
        incomingCall.accept();
        startCallTimer();
      }
    }
  };

  const rejectIncomingCall = () => {
    if (incomingCall) {
      incomingCall.reject();
      setCallState("idle");
      // setIncomingCall(null);
    }
  };

  const makeOutgoingCall = async () => {
    const device = deviceRef.current;
    const contact = selectedChat
    if (!device || !contact?.phone_number) {
      console.error("Twilio Device is not initialized or contact number is missing.");
      return;
    }

    if (callState !== "idle") {
      console.error("A call is already active.");
      return; // Prevent initiating a new call
    }
    
    const params = { To: contact.phone_number };
      deviceRef.current.connect({params}).then((call) => {
        setOutgoingCall(call);
        setIsIncoming(false);
        setCallState("ringing");

        bindVolumeIndicators(deviceRef.current);
        console.log("Outgoing call initiated.", call);
        
        const handleDisconnectedOutgoingCall = () => {
          console.log("Outgoing call disconnected.");
          // setIncomingCall(null);
          setCallState("idle");
        }
        call.on("disconnect", handleDisconnectedOutgoingCall);
        // call.on("cancel", handleDisconnectedOutgoingCall);
        call.on("reject", handleDisconnectedOutgoingCall);
        call.on("accept", () => {
          console.log("Outgoing call accepted")
          setCallState("active");
          startCallTimer();
        });
        call.on("connect", () => { console.log("Outgoing call connected")})
      }).catch((e) => console.error("Error making a call: ", e)) // Initiate outgoing call

  };

  const rejectOutgoingCall = () => {
    if (callState === "active" || callState === "ringing") {
      deviceRef.current.disconnectAll();
      setCallState("idle");
      stopCallTimer();
    }
  };

  const hangUpCall = () => {
    if (callState === "active" && incomingCall) {
      incomingCall.disconnect();
      setCallState("idle");
      stopCallTimer();
    }
  }
  

  useEffect(() => {
    console.log('using effect to initialize twilio device')
    fetchContacts();
    fetchGPTStatus();
    initializeTwilioDevice();
    // console.log(backendURL)

    // Websocket logic.
    // WebSocket setup
    const socket = new WebSocket(`${backendURL.replace('http://', 'ws://').replace('https://', 'ws://')}/ws`);
    
    socket.onopen = function () {
        console.log("ChatInterface: WebSocket connection established");
    };

    socket.onerror = function (error) {
        console.error("ChatInterface: WebSocket error observed:", error);
    };

    socket.onmessage = function (event) {
        const data = JSON.parse(event.data);
        // console.log(data)
        const phoneNumber = data.phone_number;
        const newMessage = data.messages;

        fetchContacts();
        fetchGPTStatus();

        // if (phoneNumber === contact.phone_number) {
        //     // setMessages((prevMessages) => [...prevMessages, newMessage]);
        // }
        // scrollToBottom();
    };

    socket.onclose = function () {
        console.log("ChatInterface: WebSocket connection closed");
    };

    // Cleanup the WebSocket connection when the component unmounts
    return () => {
        socket.close();
    };
    
  }, [])


  useEffect(() => {
    return () => stopCallTimer(); // Cleanup timer on component unmount
  }, []);

  function fetchGPTStatus() {
    fetch(`${backendURL}/is-allowed`, {method: "GET", headers: {'Authorization': `Bearer ${user.access_token}`}})
      .then((res) => {
        if (!res.ok) {
          throw new Error('Network response was not ok');
        }
        if(res.status == 401){
            logout();
        }
        return res.json();
      })
      .then((data) => {
        setIsGPTEnabled(data.allow_gpt)
      })
      .catch((error) => {
        console.error('Error fetching GPT status:', error);
      });
  }
  

  function fetchContacts(){
    fetch(`${backendURL}/contacts-list`, {method: "GET", headers: {'Authorization': `Bearer ${user.access_token}`}})
        .then((res) => {
            if(res.status == 401){
                logout();
            }
            return res.json();
        })
        .then((data) => {
            if(data.error){
            setContacts([])
            setloadFailed(true)
            } else {
            setContacts(data.contacts_list)
            // console.log(data.contacts_list)
            }        
        })
  }

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen)
  
  const toggleGPT = (event) => {
    // event is either true or false
    // console.log(event)
    // setIsGPTEnabled(!isGPTEnabled)
    updateGPTStatus(event)

    setTimeout(()=>{
      fetchGPTStatus();
    }, 100)
  }

  function updateGPTStatus(allowGPT) {
    fetch(`${backendURL}/let-gpt-answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.access_token}`,
      },
      body: JSON.stringify({ allow_gpt: allowGPT }),
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error('Network response was not ok');
        }
        if(res.status == 401){
            logout();
        }
        return res.json();
      })
      .then((data) => {
        console.log('GPT Update Response:', data);
      })
      .catch((error) => {
        console.error('Error updating GPT status:', error);
      });
  }

  function toggleArchiveChat(contact) {
    fetch(`${backendURL}/archive-chat`, {
        method: "POST",
        headers: {
            'Authorization': `Bearer ${user.access_token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            phone_number: contact.phone_number,
            archive: !contact.is_archived
        })
    })
    .then((res) => {
        if (res.status === 401) {
            logout();
            return null;
        }
        return res.json();
    })
    .then((data) => {
        if (data && data.message) {
            console.log(data.message);
        } else if (data && data.error) {
            alert("Failed to archive/unarchive chat.");
        }
    })
    .catch((error) => {
        console.error("Error archiving/unarchiving chat:", error);
        alert("Failed to update archive status. Please try again.");
    });
  }

  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const today = new Date();
  
    // Helper function to check if the date is today
    const isToday = (date, today) =>
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  
    // Helper function to get the start of the week (assuming the week starts on Sunday)
    const getStartOfWeek = (date) => {
      const startOfWeek = new Date(date);
      const day = startOfWeek.getDay(); // Get the day of the week (0 = Sunday, 6 = Saturday)
      const diff = startOfWeek.getDate() - day;
      startOfWeek.setDate(diff);
      startOfWeek.setHours(0, 0, 0, 0); // Reset time to midnight
      return startOfWeek;
    };
    
    // Helper function to check if the date is within the same week as today
    const isSameWeek = (date, today) => {
      const startOfCurrentWeek = getStartOfWeek(today);
      const startOfGivenWeek = getStartOfWeek(date);
      return startOfCurrentWeek.getTime() === startOfGivenWeek.getTime();
    };
  
    // Format time as hh:mm AM/PM
    const formatTime = (date) => {
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = hours % 12 || 12;
      const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
      return `${formattedHours}:${formattedMinutes} ${ampm}`;
    };
  
    // Format date as dd/mm/yy
    const formatDate = (date) => {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
      const year = String(date.getFullYear()).slice(-2); // Get last two digits of the year
      return `${day}/${month}/${year}`;
    };
  
    // Get the weekday name (Mon, Tue, etc.)
    const formatWeekday = (date) => {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    };
  
    // Logic to determine which format to use
    if (isToday(date, today)) {
      return formatTime(date);
    } else if (isSameWeek(date, today)) {
      return formatWeekday(date);
    } else {
      return formatDate(date);
    }
  }
  
  
  return (
      <div className="flex h-screen bg-gray-100 overflow-hidden">
        
        {/* Sidebar */}
        <div
          className={`bg-white w-full max-w-sm border-r border-gray-200 shadow-lg transition-all duration-300 ease-in-out flex flex-col ${
            isSidebarOpen ? "flex" : "hidden"
          } md:flex`}
        >
          
          <div className="p-4 border-b border-gray-200">
          <div className="flex items-center pb-2 justify-between">

              <div className="flex items-center space-x-3">
                <User className="h-8 w-8 text-gray-600" />
                <span className="text-md font-semibold">{user.username}</span>
              </div>

              <div className="flex space-x-2">
                
                {user?.role === 'admin' && (
                  <Button variant="ghost" size="icon" onClick={()=>{router.push('/admin')}}>
                    <Settings className="h-5 w-5" />
                    <span className="sr-only">Admin Dashboard</span>
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={()=>{logout()}}>
                  <LogOut className="h-5 w-5" />
                  <span className="sr-only">Log Out</span>
                </Button>
              </div>
            </div>

            <div className="mt-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Search or start new chat" 
                    className="pl-10 bg-gray-100 border-none rounded-full focus:ring-2 focus:ring-green-100 focus:ring-offset-2" 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)}/>
            </div>
          </div>
          {!searchQuery && (
                <Button
                  variant={showArchived ? "default" : "ghost"}
                  className="w-full py-6 text-left border justify-center"
                  onClick={() => setShowArchived(!showArchived)}
                >
                <Archive className="h-6 w-6 mr-2" />
                {showArchived ? "Show Active Chats" : "Show Archived Chats"}
              </Button>
            )}       

          {loadFailed === true ? (
            <div className="flex justify-center items-center h-[calc(100vh-86px)]">
              <p className="text-lg font-semibold text-gray-500">Failed to load contacts</p>
            </div>
          ) : (
            <ScrollArea className="flex-grow">
            {filteredContacts.length > 0 ? (
              filteredContacts.map((contact, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center max-w-[380px] space-x-4 p-4 hover:bg-gray-100 transition-colors duration-200 border-b cursor-pointer",
                    {
                      "bg-green-100 hover:bg-green-200":
                        contact.phone_number === selectedChat?.phone_number,
                    }
                  )}
                  onClick={() => handleChatSelect(contact)}
                >
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={userIcon.src} alt={`Contact ${i + 1}`} />
                    <AvatarFallback>{contact.phone_number}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {contact.phone_number}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      <span className={contact.message.role === "assistant" ? "font-bold" : ""}>
                        {contact.message.role === "assistant" ? "You: " : ""}
                      </span>
                      {contact.message.content}
                    </p>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-gray-400">
                      {formatTimestamp(contact.timestamp)}
                    </span>
                    {contact.unread_count !== 0 && (
                      <span className="bg-green-500 text-white text-xs font-medium rounded-full px-2 py-0.5 mt-1">
                        {contact.unread_count}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevents the click from bubbling up to the parent
                      toggleArchiveChat(contact);
                    }}
                    className="ml-2 hover:bg-gray-300"
                  >
                    {contact.is_archived ? (
                      <ArchiveRestore className="h-4 w-4" />
                    ) : (
                      <Archive className="h-4 w-4" />
                    )}
                    <span className="sr-only">
                      {contact.is_archived ? "Unarchive" : "Archive"} chat
                    </span>
                  </Button>
                </div>
              ))
            ) : (
              searchQuery && ( // Check if searchQuery exists
                <div
                  className="p-4"
                  onClick={() =>
                    handleChatSelect({
                      phone_number: searchQuery,
                      is_archived: false,
                      message: "",
                      unread_count: 0,
                    })
                  }
                >
                  <div className="flex items-center space-x-4 p-6 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors duration-300 border-b cursor-pointer">
                    <MessageCircle />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{searchQuery || "New Contact"}</p>
                      <p className="text-sm text-gray-300">Start a new conversation</p>
                    </div>
                  </div>
                </div>
              )
            )}
          </ScrollArea>
          )}
          <div className="px-4 py-6 border-t border-gray-200 bg-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Let GPT Answer</span>
              <Switch
                checked={isGPTEnabled}
                onCheckedChange={(event) => toggleGPT(event)}
                aria-label="Toggle GPT Answer"
              />
            </div>
          </div>
        </div>
        <div className="flex flex-col w-full h-full overflow-hidden">
       {(callState == "active" || callState == "ringing") && (
        <TopNotificationBar
          userIcon={userIcon}
          isIncoming={isIncoming}
          incomingCall={incomingCall}
          outgoingCall={outgoingCall}
          callState={callState}
          callDuration={callDuration}
          acceptIncomingCall={acceptIncomingCall}
          rejectOutgoingCall={rejectOutgoingCall}
          rejectIncomingCall={rejectIncomingCall}
          hangUpCall={hangUpCall}
          />
       )}
        { selectedChat ? <>
          <Chat key={selectedChat.phone_number} contact={selectedChat} toggleSidebar={toggleSidebar} fetchContacts={fetchContacts} makeOutgoingCall={makeOutgoingCall} />
        </> : <>
                
          <div className="flex-1 flex flex-col">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={toggleSidebar}>
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle sidebar</span>
            </Button>
            <div className="flex-1 flex items-center justify-center">
              Please select a chat to view the messages
            </div>
          </div>
              
        </>}
        </div>
      </div>
  )
}