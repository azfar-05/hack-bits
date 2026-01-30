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

  // Lightweight API queries with faster polling
  const channelsQuery = api.realtime.getChannels.useQuery(undefined, {
    enabled: isOpen,
    refetchInterval: isOpen ? 2000 : false,
  });

  const availableUsersQuery = api.realtime.getAvailableUsers.useQuery(undefined, {
    enabled: isOpen && showUserList,
  });

  const messagesQuery = api.realtime.getChannelMessages.useQuery(
    { channelId: activeChannel },
    { 
      enabled: isOpen && !!activeChannel,
      refetchInterval: isOpen && !!activeChannel ? 1000 : false, // 1 second polling
    }
  );

  const participantsQuery = api.realtime.getChannelParticipants.useQuery(
    { channelId: activeChannel },
    { 
      enabled: isOpen && !!activeChannel,
      refetchInterval: isOpen && !!activeChannel ? 5000 : false,
    }
  );

  // Optimistic mutations
  const sendMessageMutation = api.realtime.sendMessage.useMutation({
    onMutate: async (newMessage) => {
      await utils.realtime.getChannelMessages.cancel({ channelId: newMessage.channelId });
      const previousMessages = utils.realtime.getChannelMessages.getData({ channelId: newMessage.channelId });

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
      if (context?.previousMessages) {
        utils.realtime.getChannelMessages.setData(
          { channelId: newMessage.channelId },
          context.previousMessages
        );
      }
    },
    onSettled: (data, error, variables) => {
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

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentMessages, activeChannel]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !session || !activeChannel) return;

    sendMessageMutation.mutate({
      channelId: activeChannel,
      content: newMessage.trim(),
      messageType: "TEXT",
      priority: "NORMAL",
    });
  };

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 2147483647 }}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[70vh] flex overflow-hidden" style={{ zIndex: 2147483647 }}>
        
        {/* Simplified Sidebar */}
        <div className="w-64 bg-gray-800 text-white flex flex-col">
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">🚨 Emergency</h2>
              <button
                onClick={onClose}
                className="p-1 text-gray-400 hover:text-white rounded"
              >
                ✕
              </button>
            </div>
            <div className="text-xs text-gray-400">Real-time communication</div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {/* Channels */}
            <div className="mb-4">
              <h3 className="text-xs font-medium text-gray-400 uppercase mb-2">Channels</h3>
              <div className="space-y-1">
                {channels.filter(c => !c.isDM).map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => setActiveChannel(channel.id)}
                    className={`w-full text-left p-2 rounded text-sm transition-colors ${
                      activeChannel === channel.id
                        ? "bg-gray-600 text-white"
                        : "text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{channel.name}</span>
                      {channel.isActive && <div className="h-1.5 w-1.5 bg-green-400 rounded-full"></div>}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Direct Messages */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-medium text-gray-400 uppercase">Direct</h3>
                <button
                  onClick={() => setShowUserList(!showUserList)}
                  className="p-1 text-gray-400 hover:text-white text-xs"
                >
                  +
                </button>
              </div>

              {/* User List */}
              {showUserList && (
                <div className="mb-3 p-2 bg-gray-700 rounded text-xs">
                  <div className="text-gray-400 mb-1">Start chat:</div>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {availableUsers.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleStartConversation(user.id)}
                        className="w-full text-left p-1 rounded hover:bg-gray-600 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`h-4 w-4 rounded-full flex items-center justify-center text-xs ${
                            user.role === "AUTHORITY" ? "bg-red-500" :
                            user.role === "VOLUNTEER" ? "bg-green-500" : "bg-blue-500"
                          }`}>
                            {getRoleIcon(user.role)}
                          </div>
                          <span className="text-xs truncate">{user.name || user.email}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* DM Conversations */}
              <div className="space-y-1">
                {channels.filter(c => c.isDM).map((conversation) => (
                  <button
                    key={conversation.id}
                    onClick={() => setActiveChannel(conversation.id)}
                    className={`w-full text-left p-2 rounded text-sm transition-colors ${
                      activeChannel === conversation.id
                        ? "bg-gray-600 text-white"
                        : "text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`h-4 w-4 rounded-full flex items-center justify-center text-xs ${
                        conversation.otherUser?.role === "AUTHORITY" ? "bg-red-500" :
                        conversation.otherUser?.role === "VOLUNTEER" ? "bg-green-500" : "bg-blue-500"
                      }`}>
                        {getRoleIcon(conversation.otherUser?.role || "USER")}
                      </div>
                      <span className="truncate">{conversation.otherUser?.name || conversation.otherUser?.email}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* User Status */}
          <div className="p-3 border-t border-gray-700">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 bg-blue-500 rounded-full flex items-center justify-center text-xs">
                {getRoleIcon(session?.user?.role || "USER")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{session?.user?.name || "You"}</div>
                <div className="text-xs text-gray-400">{session?.user?.role?.toLowerCase()}</div>
              </div>
              <div className="h-2 w-2 bg-green-400 rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">
                  {activeChannelData?.name || "Select Channel"}
                </h3>
                <p className="text-xs text-gray-600">
                  {isDirectMessage 
                    ? `Private with ${activeChannelData?.otherUser?.name || activeChannelData?.otherUser?.email}`
                    : activeChannelData?.description || ""
                  }
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <div className={`h-1.5 w-1.5 rounded-full ${
                    messagesQuery.isLoading ? "bg-yellow-500" : 
                    messagesQuery.error ? "bg-red-500" : "bg-green-500"
                  }`}></div>
                  <span className="text-gray-600">{participants.online} online</span>
                </div>
                {activeChannelData?.type === "EMERGENCY" && (
                  <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-medium">
                    🚨 EMERGENCY
                  </span>
                )}
                {isDirectMessage && (
                  <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium">
                    🔒 PRIVATE
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messagesQuery.isLoading && (
              <div className="text-center text-gray-500 py-4 text-sm">Loading...</div>
            )}

            {currentMessages.length === 0 && !messagesQuery.isLoading && (
              <div className="text-center text-gray-500 py-8">
                <div className="text-2xl mb-2">💬</div>
                <p className="text-sm font-medium">No messages yet</p>
                <p className="text-xs text-gray-400">Start the conversation!</p>
              </div>
            )}

            {currentMessages.map((message) => (
              <div key={message.id} className="flex gap-3">
                <div className="flex-shrink-0">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm ${
                    message.senderRole === "AUTHORITY" ? "bg-red-100 text-red-600" :
                    message.senderRole === "VOLUNTEER" ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600"
                  }`}>
                    {getRoleIcon(message.senderRole)}
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900 truncate">{message.senderName}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${getRoleColor(message.senderRole)}`}>
                      {message.senderRole}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {message.priority === "HIGH" && (
                      <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded">
                        HIGH
                      </span>
                    )}
                    {message.id.startsWith("temp_") && (
                      <span className="text-xs text-gray-400">Sending...</span>
                    )}
                  </div>
                  
                  <div className={`p-2.5 rounded-lg text-sm ${
                    message.isSystemMessage 
                      ? "bg-red-50 border border-red-200 text-red-900" 
                      : message.id.startsWith("temp_")
                        ? "bg-blue-50 border border-blue-200 opacity-70"
                        : "bg-gray-50"
                  }`}>
                    <p>{message.content}</p>
                    
                    {message.location && (
                      <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                        <div className="flex items-center gap-2 text-xs text-blue-700">
                          <span>📍 Location shared</span>
                          <button className="text-blue-600 hover:text-blue-800 font-medium">
                            View
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={`Message ${isDirectMessage ? activeChannelData?.otherUser?.name || "user" : activeChannelData?.name || "channel"}...`}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                autoComplete="off"
                autoFocus
              />
              
              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || sendMessageMutation.isPending}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {sendMessageMutation.isPending ? "..." : "Send"}
              </button>
            </div>
            
            {activeChannelData?.type === "EMERGENCY" && (
              <div className="mt-2 flex items-center gap-1 text-xs text-gray-600">
                <span className="text-red-500">⚠️</span>
                <span>Emergency channel - monitored by authorities</span>
              </div>
            )}
            
            {isDirectMessage && (
              <div className="mt-2 flex items-center gap-1 text-xs text-gray-600">
                <span className="text-blue-500">�</span>
                <span>Private conversation</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}