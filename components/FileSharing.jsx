"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import LandingPage from "./utils/LandingPage";
import PeerList from "./utils/PeerList";
import FileUpload from "./utils/FileUpload";
import FileReceive from "./utils/FileReceive";

// Enhanced configuration for WebRTC with better STUN/TURN server options
const peerConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ],
  iceCandidatePoolSize: 10,
};

const CircleCard = ({ children, className }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.6 }}
    className={`rounded-full backdrop-blur-md bg-white/10 border border-white/20 shadow-2xl p-6 flex items-center justify-center ${className}`}
  >
    {children}
  </motion.div>
);

function FileSharing() {
  const [socket, setSocket] = useState(null);
  const [username, setUsername] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [files, setFiles] = useState([]);
  const [transferProgress, setTransferProgress] = useState(0);
  const [transferStatus, setTransferStatus] = useState("");
  const [receivedFiles, setReceivedFiles] = useState([]);
  const [broadcasting, setBroadcasting] = useState(false);
  const [connectionState, setConnectionState] = useState("disconnected");
  const [networkInfo, setNetworkInfo] = useState(null);
  const [isClient, setIsClient] = useState(false);

  // References
  const peerConnectionRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const dataChannelRef = useRef(null);
  const dataChannelsRef = useRef({});
  const fileReaderRef = useRef(null);
  const receivedBuffersRef = useRef([]);
  const receivedSizeRef = useRef(0);
  const fileInfoRef = useRef(null);
  const reconnectionAttemptsRef = useRef(0);
  const maxReconnectionAttempts = 5;

  // Check if we're on the client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Connect to socket when component mounts (client-side only)
  useEffect(() => {
    if (!isClient) return;

    // Dynamic import of socket.io-client to avoid SSR issues
    const initializeSocket = async () => {
      const { io } = await import("socket.io-client");

      const serverUrl =
        process.env.NODE_ENV === "development"
          ? "https://diwanshareserver.onrender.com"
          : typeof window !== "undefined" &&
            window.location.origin.includes("localhost")
          ? "https://diwanshareserver.onrender.com"
          : window.location.origin;

      const newSocket = io(serverUrl, {
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        transports: ["websocket", "polling"],
      });

      newSocket.on("connect", () => {
        console.log("Socket connected:", newSocket.id);
        setConnectionState("connected");
        reconnectionAttemptsRef.current = 0;
      });

      newSocket.on("connect_error", (err) => {
        console.error("Socket connection error:", err);
        setConnectionState("error");
        setTransferStatus(`Connection error: ${err.message}. Retrying...`);
      });

      newSocket.on("disconnect", (reason) => {
        console.log("Socket disconnected:", reason);
        setConnectionState("disconnected");
        setTransferStatus(
          `Disconnected: ${reason}. Attempting to reconnect...`
        );
      });

      setSocket(newSocket);

      // Get network information (client-side only)
      if (typeof navigator !== "undefined") {
        try {
          const connection =
            navigator.connection ||
            navigator.mozConnection ||
            navigator.webkitConnection;

          if (connection) {
            const info = {
              type: connection.type,
              effectiveType: connection.effectiveType,
              downlink: connection.downlink,
              rtt: connection.rtt,
            };
            setNetworkInfo(info);
            console.log("Network information:", info);
          }
        } catch (err) {
          console.log("Could not get network information");
        }
      }
    };

    initializeSocket();

    // Cleanup function
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [isClient]);

  // Set up socket event listeners after socket is initialized
  useEffect(() => {
    if (!socket || !isClient) return;

    socket.on("users_updated", (updatedUsers) => {
      setUsers(updatedUsers.filter((user) => user.socketId !== socket.id));
    });

    socket.on("offer", async (data) => {
      console.log("Received offer:", data);
      await handleReceiveOffer(data);
    });

    socket.on("answer", async (data) => {
      console.log("Received answer from:", data.from);
      await handleReceiveAnswer(data);
    });

    socket.on("ice-candidate", async (data) => {
      console.log("Received ICE candidate from:", data.from);
      await handleReceiveICECandidate(data);
    });

    socket.on("user-disconnected", (userId) => {
      console.log("User disconnected:", userId);
      if (selectedUser && selectedUser.socketId === userId) {
        setTransferStatus("Selected user disconnected");
        if (dataChannelRef.current) {
          dataChannelRef.current.close();
        }
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
        }
      }
    });

    socket.on("peer-connection-status", (data) => {
      console.log("Peer connection status:", data);
      if (data.status === "failed") {
        setTransferStatus(
          `Connection with ${data.username || data.from} failed. Try again.`
        );
      }
    });

    // Heartbeat to keep the connection alive
    const interval = setInterval(() => {
      if (socket.connected) {
        socket.emit("heartbeat");
      }
    }, 30000);

    return () => {
      socket.off("users_updated");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      socket.off("user-disconnected");
      socket.off("peer-connection-status");
      clearInterval(interval);
    };
  }, [socket, selectedUser, isClient]);

  // Handle user registration
  const registerUser = () => {
    if (username.trim() && socket) {
      socket.emit("register", username);
      setIsRegistered(true);
    }
  };

  // Initialize peer connection and data channel with enhanced error handling
  const initializePeerConnection = () => {
    if (!isClient || typeof window === "undefined") return null;

    // Close existing connection if any
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch (err) {
        console.warn("Error closing previous peer connection:", err);
      }
    }

    console.log("Initializing new peer connection");
    const peerConnection = new RTCPeerConnection(peerConfiguration);
    peerConnectionRef.current = peerConnection;

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && selectedUser && socket) {
        console.log("Sending ICE candidate to:", selectedUser.socketId);
        socket.emit("ice-candidate", {
          target: selectedUser.socketId,
          candidate: event.candidate,
        });
      }
    };

    // Log connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log("Connection state changed:", peerConnection.connectionState);

      if (socket && selectedUser) {
        socket.emit("connection-status", {
          status: peerConnection.connectionState,
          target: selectedUser.socketId,
        });
      }

      if (peerConnection.connectionState === "failed") {
        setTransferStatus("Connection failed. Try reconnecting.");
      } else if (peerConnection.connectionState === "connected") {
        setTransferStatus("Peer connection established successfully!");
      } else if (peerConnection.connectionState === "disconnected") {
        setTransferStatus("Connection lost. Try reconnecting.");
      }
    };

    // Log ICE connection state changes
    peerConnection.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", peerConnection.iceConnectionState);

      if (peerConnection.iceConnectionState === "failed") {
        if (reconnectionAttemptsRef.current < maxReconnectionAttempts) {
          reconnectionAttemptsRef.current++;
          setTransferStatus(
            `ICE connection failed. Attempting restart (${reconnectionAttemptsRef.current}/${maxReconnectionAttempts})...`
          );
          peerConnection.restartIce();
        } else {
          setTransferStatus(
            "Connection failed after multiple attempts. Please try again."
          );
        }
      }
    };

    // For receiving data channel
    peerConnection.ondatachannel = (event) => {
      console.log("Data channel received");
      setupDataChannel(event.channel);
    };

    return peerConnection;
  };

  // Set up data channel for sending/receiving files with enhanced reliability
  const setupDataChannel = (dataChannel) => {
    dataChannelRef.current = dataChannel;

    dataChannel.onopen = () => {
      console.log("Data channel opened");
      setTransferStatus("Connected! Ready to transfer files");
      reconnectionAttemptsRef.current = 0;
    };

    dataChannel.onclose = () => {
      console.log("Data channel closed");
      setTransferStatus("Connection closed");
    };

    dataChannel.onerror = (error) => {
      console.error("Data channel error:", error);
      setTransferStatus(`Error: ${error}`);
    };

    dataChannel.onmessage = (event) => {
      const data = event.data;

      try {
        if (typeof data === "string") {
          const message = JSON.parse(data);

          if (message.type === "file-info") {
            fileInfoRef.current = message.info;
            receivedBuffersRef.current = [];
            receivedSizeRef.current = 0;
            setTransferStatus(`Receiving: ${message.info.name}`);
            setTransferProgress(0);
          } else if (message.type === "transfer-complete") {
            processReceivedFile();
          } else if (message.type === "ping") {
            dataChannel.send(
              JSON.stringify({ type: "pong", timestamp: Date.now() })
            );
          } else if (message.type === "pong") {
            console.log("Received pong, connection verified");
          }
        } else {
          receivedBuffersRef.current.push(data);
          receivedSizeRef.current += data.byteLength;

          if (fileInfoRef.current && fileInfoRef.current.size > 0) {
            const progress = Math.floor(
              (receivedSizeRef.current / fileInfoRef.current.size) * 100
            );
            setTransferProgress(progress);
          }
        }
      } catch (error) {
        console.error("Error processing message:", error);
        setTransferStatus(`Error processing data: ${error.message}`);
      }
    };
  };

  // Process the received file once transfer is complete
  const processReceivedFile = () => {
    if (!isClient || typeof window === "undefined") return;

    try {
      const fileInfo = fileInfoRef.current;
      if (!fileInfo || receivedBuffersRef.current.length === 0) {
        setTransferStatus("Error: Invalid file data received");
        return;
      }

      const blob = new Blob(receivedBuffersRef.current, {
        type: fileInfo.type || "application/octet-stream",
      });
      const url = URL.createObjectURL(blob);

      setReceivedFiles((prev) => [
        ...prev,
        {
          name: fileInfo.name,
          type: fileInfo.type || "application/octet-stream",
          size: fileInfo.size,
          url,
          sender: fileInfo.sender || "Unknown user",
          timestamp: new Date().toISOString(),
        },
      ]);

      setTransferStatus("File received successfully!");
      setTransferProgress(100);
    } catch (error) {
      console.error("Error processing received file:", error);
      setTransferStatus(`Error processing file: ${error.message}`);
    }
  };

  // Check if connection is active and working
  const checkConnection = () => {
    if (
      dataChannelRef.current &&
      dataChannelRef.current.readyState === "open"
    ) {
      try {
        dataChannelRef.current.send(
          JSON.stringify({
            type: "ping",
            timestamp: Date.now(),
          })
        );
        return true;
      } catch (error) {
        console.error("Error checking connection:", error);
        return false;
      }
    }
    return false;
  };

  // Initiate connection to selected user with better error handling
  const connectToPeer = async () => {
    if (!selectedUser || !socket || !isClient) {
      setTransferStatus("No user selected or socket not connected");
      return;
    }

    setTransferStatus("Initializing connection...");
    const peerConnection = initializePeerConnection();

    if (!peerConnection) {
      setTransferStatus("Failed to initialize peer connection");
      return;
    }

    try {
      const dataChannel = peerConnection.createDataChannel("fileTransfer", {
        ordered: true,
      });

      setupDataChannel(dataChannel);

      setTransferStatus("Creating connection offer...");
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
        voiceActivityDetection: false,
      });

      await peerConnection.setLocalDescription(offer);

      socket.emit("offer", {
        target: selectedUser.socketId,
        offer,
      });

      setTransferStatus("Connection offer sent. Waiting for answer...");
    } catch (error) {
      console.error("Error creating offer:", error);
      setTransferStatus(`Connection error: ${error.message}`);
    }
  };

  // Handle receiving an offer from another peer with enhanced error handling
  const handleReceiveOffer = async (data) => {
    if (!isClient) return;

    try {
      setTransferStatus("Received connection request...");
      const peerConnection = initializePeerConnection();

      if (!peerConnection) {
        setTransferStatus("Failed to initialize peer connection");
        return;
      }

      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(data.offer)
      );

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      socket.emit("answer", {
        target: data.from,
        answer,
      });

      const user = users.find((user) => user.socketId === data.from);
      if (user) {
        setSelectedUser(user);
      }

      setTransferStatus("Connection answer sent. Establishing connection...");
    } catch (error) {
      console.error("Error handling offer:", error);
      setTransferStatus(`Connection error: ${error.message}`);

      if (socket && data.from) {
        socket.emit("connection-status", {
          status: "failed",
          target: data.from,
          error: error.message,
        });
      }
    }
  };

  // Handle receiving an answer after sending an offer with better error handling
  const handleReceiveAnswer = async (data) => {
    if (!isClient) return;

    try {
      setTransferStatus("Received connection answer...");

      if (peerConnectionsRef.current[data.from]) {
        await peerConnectionsRef.current[data.from].setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );
        console.log(`Answer set for broadcast connection to ${data.from}`);
      } else if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );
        console.log("Answer set for connection");
      } else {
        console.error("No peer connection found to handle answer");
        setTransferStatus("Connection error: No active connection");
        return;
      }

      setTransferStatus(
        "Connection established! Waiting for secure channel..."
      );
    } catch (error) {
      console.error("Error handling answer:", error);
      setTransferStatus(`Connection error: ${error.message}`);

      if (socket && data.from) {
        socket.emit("connection-status", {
          status: "failed",
          target: data.from,
          error: error.message,
        });
      }
    }
  };

  // Handle ICE candidates with improved error handling
  const handleReceiveICECandidate = async (data) => {
    if (!isClient) return;

    try {
      if (peerConnectionsRef.current[data.from]) {
        await peerConnectionsRef.current[data.from].addIceCandidate(
          new RTCIceCandidate(data.candidate)
        );
      } else if (peerConnectionRef.current) {
        await peerConnectionRef.current.addIceCandidate(
          new RTCIceCandidate(data.candidate)
        );
      } else {
        console.error("No peer connection to add ICE candidate to");
      }
    } catch (error) {
      console.error("Error adding ICE candidate:", error);
    }
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    setFiles(Array.from(e.target.files));
  };

  // Create a delay function for broadcast pacing
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Send selected files with improved error handling and chunking
  const sendFiles = async () => {
    if (
      !files.length ||
      !dataChannelRef.current ||
      dataChannelRef.current.readyState !== "open"
    ) {
      setTransferStatus("No connection or no files selected");
      return;
    }

    if (!checkConnection()) {
      setTransferStatus(
        "Connection appears to be unstable. Trying to reconnect..."
      );
      if (selectedUser) {
        await connectToPeer();
      }
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        await sendSingleFile(file);

        if (i < files.length - 1) {
          setTransferStatus(
            `Preparing next file (${i + 1}/${files.length} complete)...`
          );
          await delay(500);
        }
      } catch (error) {
        console.error(`Error sending file ${file.name}:`, error);
        setTransferStatus(`Error sending ${file.name}: ${error.message}`);

        if (
          !dataChannelRef.current ||
          dataChannelRef.current.readyState !== "open"
        ) {
          setTransferStatus("Connection lost. Trying to reconnect...");
          if (selectedUser) {
            await connectToPeer();
          }
          break;
        }
      }
    }

    setTransferStatus(`Transfer complete! (${files.length} files)`);
  };

  // Helper function to send a single file with improved reliability
  const sendSingleFile = (file) => {
    return new Promise((resolve, reject) => {
      if (
        !dataChannelRef.current ||
        dataChannelRef.current.readyState !== "open"
      ) {
        reject(new Error("No open data channel"));
        return;
      }

      const fileInfo = {
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        sender: username,
      };

      try {
        dataChannelRef.current.send(
          JSON.stringify({
            type: "file-info",
            info: fileInfo,
          })
        );
      } catch (error) {
        reject(new Error(`Failed to send file info: ${error.message}`));
        return;
      }

      const chunkSize = 16384;
      const fileReader = new FileReader();
      let offset = 0;

      fileReaderRef.current = fileReader;

      fileReader.onload = (e) => {
        if (
          !dataChannelRef.current ||
          dataChannelRef.current.readyState !== "open"
        ) {
          reject(new Error("Connection lost during file transfer"));
          return;
        }

        try {
          dataChannelRef.current.send(e.target.result);
          offset += e.target.result.byteLength;

          const progress = Math.floor((offset / file.size) * 100);
          setTransferProgress(progress);
          setTransferStatus(`Sending ${file.name}: ${progress}%`);

          if (offset < file.size) {
            if (dataChannelRef.current.bufferedAmount > 1024 * 1024) {
              setTimeout(() => readSlice(offset), 100);
            } else {
              readSlice(offset);
            }
          } else {
            dataChannelRef.current.send(
              JSON.stringify({
                type: "transfer-complete",
              })
            );
            resolve();
          }
        } catch (error) {
          reject(new Error(`Error sending chunk: ${error.message}`));
        }
      };

      fileReader.onerror = (error) => {
        console.error("Error reading file:", error);
        setTransferStatus(`Error reading file: ${error}`);
        reject(error);
      };

      const readSlice = (o) => {
        const slice = file.slice(o, o + chunkSize);
        fileReader.readAsArrayBuffer(slice);
      };

      readSlice(0);
    });
  };

  // Broadcast files to all connected users (simplified version for demo)
  const broadcastFiles = async () => {
    if (!files.length || users.length === 0 || !socket) {
      setTransferStatus(
        "No files selected, no users available, or not connected"
      );
      return;
    }

    setBroadcasting(true);
    setTransferStatus("Broadcasting to all users...");

    // This is a simplified broadcast - in production you'd want to implement
    // the full broadcast logic similar to the regular React version

    setBroadcasting(false);
    setTransferStatus("Broadcast feature available in full version");
  };

  // Download received file
  const downloadFile = (file) => {
    if (!isClient || typeof window === "undefined") return;

    const a = document.createElement("a");
    a.href = file.url;
    a.download = file.name;
    a.click();
  };

  // Don't render anything on server-side
  if (!isClient) {
    return <div>Loading...</div>;
  }
  // Render UI
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden font-serif">
      {/* Background with botanical overlay */}
      <div className="absolute inset-0 bg-transparent opacity-90 z-0"></div>
      {/* Main content */}
      <div className="relative z-10 w-full px-0 py-12">
        {!isRegistered ? (
          <LandingPage
            username={username}
            setUsername={setUsername}
            registerUser={registerUser}
          />
        ) : (
          <MainInterface
            users={users}
            username={username}
            selectedUser={selectedUser}
            setSelectedUser={setSelectedUser}
            connectToPeer={connectToPeer}
            handleFileSelect={handleFileSelect}
            sendFiles={sendFiles}
            broadcastFiles={broadcastFiles}
            transferStatus={transferStatus}
            transferProgress={transferProgress}
            files={files}
            dataChannelRef={dataChannelRef}
            receivedFiles={receivedFiles}
            downloadFile={downloadFile}
            connectionState={connectionState}
          />
        )}
      </div>
    </div>
  );
}

export default FileSharing;

// Main Interface Component
function MainInterface({
  users,
  username,
  selectedUser,
  setSelectedUser,
  connectToPeer,
  handleFileSelect,
  sendFiles,
  broadcastFiles,
  transferStatus,
  transferProgress,
  files,
  dataChannelRef,
  receivedFiles,
  downloadFile,
  connectionState,
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Users Card */}
      <PeerList
        users={users}
        selectedUser={selectedUser}
        setSelectedUser={setSelectedUser}
        connectToPeer={connectToPeer}
        currentUser={username}
        connectionState={connectionState}
      />
      {/* File Transfer Card */}
      <FileUpload
        transferStatus={transferStatus}
        transferProgress={transferProgress}
        handleFileSelect={handleFileSelect}
        files={files}
        sendFiles={sendFiles}
        broadcastFiles={broadcastFiles}
        selectedUser={selectedUser}
        dataChannelRef={dataChannelRef}
        users={users}
      />
      {/* Received Files Card */}
      <FileReceive receivedFiles={receivedFiles} downloadFile={downloadFile} />
    </div>
  );
}
