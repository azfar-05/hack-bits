"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "~/trpc/react";
import { useSession } from "next-auth/react";

interface RealTimeCommunicationProps {
  isOpen: boolean;
  onClose: () => void;
}

// Type definitions for channels
type ChannelData = {
  id: string;
  name: string;
  type: string;
  description?: string;
  isActive: boolean;
  priority: number;
  isDM?: boolean;
  otherUser?: {
    id: string;
    name?: string;
    email?: string;
    role: string;
  };
  conversationId?: string;
};

// Type definitions for messages
type MessageData = {
  id: string;
  content: string;
  senderName: string;
  senderRole: string;
  timestamp: Date;
  priority?: string;
  location?: any;
  isSystemMessage?: boolean;
};

export function RealTimeCommunication({ isOpen, onClose }: RealTimeCommunicationProps) {
  const { data: session } = useSession();
  const [activeChannel, setActiveChannel] = useState<string>("");
  const [newMessage, setNewMessage] = useState("");
  const [showUserList, setShowUserList] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const utils = api.useUtils();

  // Real API queries with faster polling
  const channelsQuery = api.realtime.getChannels.useQuery(undefined, {
    enabled: isOpen,
    refetchInterval: isOpen ? 1000 : false, // Poll every 1 second when open
    refetchIntervalInBackground: true,
  });

  const availableUsersQuery = api.realtime.getAvailableUsers.useQuery(undefined, {
    enabled: isOpen && showUserList,
    refetchInterval: isOpen && showUserList ? 2000 : false, // Poll every 2 seconds
  });

  const messagesQuery = api.realtime.getChannelMessages.useQuery(
    { channelId: activeChannel },
    { 
      enabled: isOpen && !!activeChannel,
      refetchInterval: isOpen && !!activeChannel ? 500 : false, // Poll every 500ms for messages
      refetchIntervalInBackground: true,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
    }
  );

  const participantsQuery = api.realtime.getChannelParticipants.useQuery(
    { channelId: activeChannel },
    { 
      enabled: isOpen && !!activeChannel,
      refetchInterval: isOpen && !!activeChannel ? 3000 : false, // Poll every 3 seconds
      refetchIntervalInBackground: true,
    }
  );

  // Mutations with optimistic updates
  const sendMessageMutation = api.realtime.sendMessage.useMutation({
    onMutate: async (newMessage) => {
      // Cancel any outgoing refetches
      await utils.realtime.getChannelMessages.cancel({ channelId: newMessage.channelId });

      // Snapshot the previous value
      const previousMessages = utils.realtime.getChannelMessages.getData({ channelId: newMessage.channelId });

      // Optimistically update to the new value
      if (previousMessages && session) {
        const optimisticMessage = {
          id: `temp_${Date.now()}`,
          content: newMessage.content,
          senderName: session.user?.name || session.user?.email || "You",
          senderRole: session.user?.role || "USER",
          timestamp: new Date(),
          priority: newMessage.priority,
          location: newMessage.location,
          isSystemMessage: false,
          senderId: session.user?.id || "temp",
          channelId: newMessage.channelId,
          messageType: newMessage.messageType,
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: null,
          sender: {
            id: session.user?.id || "temp",
            name: session.user?.name,
            email: session.user?.email,
            role: session.user?.role || "USER",
          }
        };

        utils.realtime.getChannelMessages.setData(
          { channelId: newMessage.channelId },
          {
            ...previousMessages,
            messages: [...previousMessages.messages, optimisticMessage]
          }
        );
      }

      return { previousMessages };
    },
    onError: (err, newMessage, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousMessages) {
        utils.realtime.getChannelMessages.setData(
          { channelId: newMessage.channelId },
          context.previousMessages
        );
      }
    },
    onSettled: (data, error, variables) => {
      // Always refetch after error or success to sync with server
      void utils.realtime.getChannelMessages.invalidate({ channelId: variables.channelId });
    },
    onSuccess: () => {
      setNewMessage("");
    },
  });

  const startConversationMutation = api.realtime.startDirectConversation.useMutation({
    onSuccess: (conversation) => {
      setActiveChannel(`dm_${conversation.id}`);
      setShowUserList(false);
      // Refetch channels to show the new conversation
      void channelsQuery.refetch();
    },
  });

  // Get data from queries and cast to proper types
  const channels = (channelsQuery.data || []) as ChannelData[];
  const availableUsers = availableUsersQuery.data || [];
  const currentMessages = (messagesQuery.data?.messages || []) as MessageData[];
  const participants = participantsQuery.data || { total: 0, online: 0 };

  // Set default active channel when channels load
  useEffect(() => {
    if (channels.length > 0 && !activeChannel) {
      setActiveChannel(channels[0]?.id || "");
    }
  }, [channels, activeChannel]);

  // Auto-scroll to bottom when new messages arrive with smooth animation
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: "smooth",
        block: "end"
      });
    }
  }, [currentMessages, activeChannel]);

  // Show typing indicator and message status
  const [isTyping, setIsTyping] = useState(false);
  const [lastMessageTime, setLastMessageTime] = useState<Date | null>(null);

  // Update last message time when new messages arrive
  useEffect(() => {
    if (currentMessages.length > 0) {
      const latestMessage = currentMessages[currentMessages.length - 1];
      if (latestMessage && (!lastMessageTime || new Date(latestMessage.timestamp) > lastMessageTime)) {
        setLastMessageTime(new Date(latestMessage.timestamp));
      }
    }
  }, [currentMessages, lastMessageTime]);

  // Show notification for new messages
  useEffect(() => {
    if (currentMessages.length > 0 && lastMessageTime) {
      const latestMessage = currentMessages[currentMessages.length - 1];
      if (latestMessage && latestMessage.senderId !== session?.user?.id) {
        // Show browser notification for new messages from others
        if (Notification.permission === "granted" && document.hidden) {
          new Notification(`New message from ${latestMessage.senderName}`, {
            body: latestMessage.content.substring(0, 100),
            icon: "/favicon.ico",
            tag: "emergency-chat"
          });
        }
      }
    }
  }, [currentMessages, session?.user?.id]);

  // Request notification permission when component mounts
  useEffect(() => {
    if (isOpen && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [isOpen]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !session || !activeChannel) return;

    // Show typing indicator briefly
    setIsTyping(true);
    setTimeout(() => setIsTyping(false), 1000);

    sendMessageMutation.mutate({
      channelId: activeChannel,
      content: newMessage.trim(),
      messageType: "TEXT",
      priority: "NORMAL",
    });
  };

  // Handle Enter key press for faster messaging
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleStartConversation = (userId: string) => {
    startConversationMutation.mutate({ otherUserId: userId });
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "AUTHORITY": return "text-red-600 bg-red-50";
      case "VOLUNTEER": return "text-green-600 bg-green-50";
      case "USER": return "text-blue-600 bg-blue-50";
      default: return "text-gray-600 bg-gray-50";
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "AUTHORITY": return "🚔";
      case "VOLUNTEER": return "🤝";
      case "USER": return "👤";
      default: return "💬";
    }
  };

  const isDirectMessage = activeChannel.startsWith("dm_");
  const activeChannelData = channels.find((c) => c.id === activeChannel);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ zIndex: 2147483647 }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[80vh] flex overflow-hidden relative" style={{ zIndex: 2147483647 }}>
        
        {/* Channel Sidebar */}
        <div className="w-80 bg-gray-900 text-white flex flex-col">
          <div className="p-6 border-b border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">🚨 Emergency Comms</h2>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="text-sm text-gray-300">
              Real-time emergency communication
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {/* Channels Section */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Channels</h3>
              </div>
              <div className="space-y-2">
                {channelsQuery.isLoading && (
                  <div className="text-center text-gray-400 py-4">Loading channels...</div>
                )}
                
                {channels.filter(c => !c.isDM).map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => setActiveChannel(channel.id)}
                    className={`w-full text-left p-3 rounded-xl transition-all ${
                      activeChannel === channel.id
                        ? "bg-gray-700 border-2 border-blue-500"
                        : "bg-gray-800 hover:bg-gray-700 border-2 border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">{channel.name}</span>
                      {channel.isActive && (
                        <div className="flex items-center gap-1">
                          <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse"></div>
                          <span className="text-xs text-green-400">LIVE</span>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">{channel.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Direct Messages Section */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Direct Messages</h3>
                <button
                  onClick={() => setShowUserList(!showUserList)}
                  className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                  title="Start new conversation"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
              </div>

              {/* User List for Starting Conversations */}
              {showUserList && (
                <div className="mb-4 p-3 bg-gray-800 rounded-xl">
                  <div className="text-xs text-gray-400 mb-2">Start conversation with:</div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {availableUsersQuery.isLoading && (
                      <div className="text-xs text-gray-400">Loading users...</div>
                    )}
                    {availableUsers.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleStartConversation(user.id)}
                        className="w-full text-left p-2 rounded-lg hover:bg-gray-700 transition-colors"
                        disabled={startConversationMutation.isPending}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${
                            user.role === "AUTHORITY" ? "bg-red-100 text-red-600" :
                            user.role === "VOLUNTEER" ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600"
                          }`}>
                            {getRoleIcon(user.role)}
                          </div>
                          <div>
                            <div className="text-xs font-medium">{user.name || user.email}</div>
                            <div className="text-xs text-gray-400 capitalize">{user.role.toLowerCase()}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Direct Message Conversations */}
              <div className="space-y-2">
                {channels.filter(c => c.isDM).map((conversation) => (
                  <button
                    key={conversation.id}
                    onClick={() => setActiveChannel(conversation.id)}
                    className={`w-full text-left p-3 rounded-xl transition-all ${
                      activeChannel === conversation.id
                        ? "bg-gray-700 border-2 border-blue-500"
                        : "bg-gray-800 hover:bg-gray-700 border-2 border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${
                        conversation.otherUser?.role === "AUTHORITY" ? "bg-red-100 text-red-600" :
                        conversation.otherUser?.role === "VOLUNTEER" ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600"
                      }`}>
                        {getRoleIcon(conversation.otherUser?.role || "USER")}
                      </div>
                      <span className="font-semibold text-sm">{conversation.otherUser?.name || conversation.otherUser?.email}</span>
                    </div>
                    <div className="text-xs text-gray-400 truncate">{conversation.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* User Status */}
          <div className="p-4 border-t border-gray-700">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center">
                {getRoleIcon(session?.user?.role || "USER")}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{session?.user?.name || "Anonymous"}</div>
                <div className="text-xs text-gray-400 capitalize">
                  {session?.user?.role?.toLowerCase() || "user"}
                </div>
              </div>
              <div className="h-3 w-3 bg-green-400 rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {activeChannelData?.name || "Select Channel"}
                </h3>
                <p className="text-sm text-gray-600">
                  {isDirectMessage 
                    ? `Private conversation with ${activeChannelData?.otherUser?.name || activeChannelData?.otherUser?.email}`
                    : activeChannelData?.description || ""
                  }
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className={`h-2 w-2 rounded-full animate-pulse ${
                    messagesQuery.isLoading ? "bg-yellow-500" : 
                    messagesQuery.error ? "bg-red-500" : "bg-green-500"
                  }`}></div>
                  <span>{participants.online} online</span>
                  {messagesQuery.isLoading && (
                    <span className="text-xs text-yellow-600">Syncing...</span>
                  )}
                  {messagesQuery.error && (
                    <span className="text-xs text-red-600">Connection error</span>
                  )}
                </div>
                {activeChannelData?.type === "EMERGENCY" && (
                  <div className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium animate-pulse">
                    � ACTIVE EMERGENCY
                  </div>
                )}
                {isDirectMessage && (
                  <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                    🔒 PRIVATE
                  </div>
                )}
                <div className="text-xs text-gray-500">
                  Last update: {new Date().toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messagesQuery.isLoading && (
              <div className="text-center text-gray-500 py-8">Loading messages...</div>
            )}

            {currentMessages.length === 0 && !messagesQuery.isLoading && (
              <div className="text-center text-gray-500 py-8">
                <div className="text-4xl mb-4">💬</div>
                <p className="font-medium">No messages yet</p>
                <p className="text-sm">
                  {isDirectMessage 
                    ? "Start a private conversation!" 
                    : "Be the first to start the conversation!"
                  }
                </p>
              </div>
            )}

            {currentMessages.map((message) => (
              <div key={message.id} className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center text-lg ${
                    message.senderRole === "AUTHORITY" ? "bg-red-100" :
                    message.senderRole === "VOLUNTEER" ? "bg-green-100" : "bg-blue-100"
                  }`}>
                    {getRoleIcon(message.senderRole)}
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900">{message.senderName}</span>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${getRoleColor(message.senderRole)}`}>
                      {message.senderRole}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                    {message.priority === "HIGH" && (
                      <span className="text-xs bg-red-600 text-white px-2 py-1 rounded-full">
                        HIGH PRIORITY
                      </span>
                    )}
                    {message.id.startsWith("temp_") && (
                      <span className="text-xs text-gray-400 animate-pulse">
                        Sending...
                      </span>
                    )}
                  </div>
                  
                  <div className={`p-3 rounded-xl transition-all ${
                    message.isSystemMessage 
                      ? "bg-red-50 border border-red-200 text-red-900" 
                      : message.id.startsWith("temp_")
                        ? "bg-blue-50 border border-blue-200 opacity-70"
                        : "bg-gray-50"
                  }`}>
                    <p className="text-sm">{message.content}</p>
                    
                    {message.location && (
                      <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-2 text-xs text-blue-700">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          </svg>
                          <span>Location shared</span>
                          <button className="text-blue-600 hover:text-blue-800 font-medium">
                            View on map
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex gap-4 opacity-60">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <div className="flex space-x-1">
                      <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                      <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                    </div>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="p-3 bg-gray-100 rounded-xl">
                    <p className="text-sm text-gray-500 italic">Someone is typing...</p>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="p-6 border-t border-gray-200 bg-white">
            <div className="flex gap-3">
              <button className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              
              <button className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
              </button>

              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={`Message ${isDirectMessage ? activeChannelData?.otherUser?.name || "user" : activeChannelData?.name || "channel"}...`}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                autoComplete="off"
                autoFocus
              />
              
              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || sendMessageMutation.isPending}
                className="bg-blue-500 text-white px-6 py-3 rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {sendMessageMutation.isPending ? "Sending..." : "Send"}
              </button>
            </div>
            
            {activeChannelData?.type === "EMERGENCY" && (
              <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
                <svg className="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Emergency channel - All messages are monitored by authorities</span>
              </div>
            )}
            
            {isDirectMessage && (
              <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
                <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>Private conversation - Only you and {activeChannelData?.otherUser?.name || "the other user"} can see these messages</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}