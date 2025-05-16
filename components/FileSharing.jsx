import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { motion } from "framer-motion";
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
    // You may need to add TURN servers for production environments
    // Example: { urls: 'turn:turn.example.com', username: 'username', credential: 'credential' }
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

  // References
  const peerConnectionRef = useRef(null);
  const peerConnectionsRef = useRef({}); // For multiple connections during broadcast
  const dataChannelRef = useRef(null);
  const dataChannelsRef = useRef({}); // For multiple data channels during broadcast
  const fileReaderRef = useRef(null);
  const receivedBuffersRef = useRef([]);
  const receivedSizeRef = useRef(0);
  const fileInfoRef = useRef(null);
  const reconnectionAttemptsRef = useRef(0);
  const maxReconnectionAttempts = 5;

  // Connect to socket when component mounts
  useEffect(() => {
    // For local development
    const newSocket = io("http://localhost:5000");

    // For production - default to same origin if deployed together...https://diwanshareserver.onrender.com
    // const newSocket = io(
    //   window.location.origin.includes("localhost")
    //     ? "https://diwanshareserver.onrender.com"
    //     : window.location.origin,
    //   {
    //     reconnectionAttempts: 5,
    //     reconnectionDelay: 1000,
    //     reconnectionDelayMax: 5000,
    //     timeout: 20000,
    //     transports: ["websocket", "polling"], // Try WebSocket first, fall back to polling
    //   }
    // );

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
      setTransferStatus(`Disconnected: ${reason}. Attempting to reconnect...`);
    });

    setSocket(newSocket);

    // Get network information
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

    // Clean up socket connection when component unmounts
    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, []);

  // Set up socket event listeners after socket is initialized
  useEffect(() => {
    if (!socket) return;

    socket.on("users_updated", (updatedUsers) => {
      // Filter out our own user
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
  }, [socket, selectedUser]);

  // Handle user registration
  const registerUser = () => {
    if (username.trim() && socket) {
      socket.emit("register", username);
      setIsRegistered(true);
    }
  };

  // Initialize peer connection and data channel with enhanced error handling
  const initializePeerConnection = () => {
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

      // Report connection state to the server
      if (socket && selectedUser) {
        socket.emit("connection-status", {
          status: peerConnection.connectionState,
          target: selectedUser.socketId,
        });
      }

      // Handle connection failures
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
        // Attempt ICE restart if it fails
        if (reconnectionAttemptsRef.current < maxReconnectionAttempts) {
          reconnectionAttemptsRef.current++;
          setTransferStatus(
            `ICE connection failed. Attempting restart (${reconnectionAttemptsRef.current}/${maxReconnectionAttempts})...`
          );

          // Try to restart ICE
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
        // Handle different message types
        if (typeof data === "string") {
          const message = JSON.parse(data);

          if (message.type === "file-info") {
            // Reset and prepare for new file
            fileInfoRef.current = message.info;
            receivedBuffersRef.current = [];
            receivedSizeRef.current = 0;
            setTransferStatus(`Receiving: ${message.info.name}`);
            setTransferProgress(0);
          } else if (message.type === "transfer-complete") {
            // Process the completed file
            processReceivedFile();
          } else if (message.type === "ping") {
            // Respond to ping with pong to check connection
            dataChannel.send(
              JSON.stringify({ type: "pong", timestamp: Date.now() })
            );
          } else if (message.type === "pong") {
            console.log("Received pong, connection verified");
          }
        } else {
          // Handle file chunk
          receivedBuffersRef.current.push(data);
          receivedSizeRef.current += data.byteLength;

          // Update progress
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
        // Send a ping message to verify the connection
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
    if (!selectedUser || !socket) {
      setTransferStatus("No user selected or socket not connected");
      return;
    }

    setTransferStatus("Initializing connection...");
    const peerConnection = initializePeerConnection();

    try {
      // Create data channel with reliable settings
      const dataChannel = peerConnection.createDataChannel("fileTransfer", {
        ordered: true,
      });

      setupDataChannel(dataChannel);

      // Create and send offer
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
    try {
      setTransferStatus("Received connection request...");
      const peerConnection = initializePeerConnection();

      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(data.offer)
      );

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      socket.emit("answer", {
        target: data.from,
        answer,
      });

      // Update UI
      const user = users.find((user) => user.socketId === data.from);
      if (user) {
        setSelectedUser(user);
      }

      setTransferStatus("Connection answer sent. Establishing connection...");
    } catch (error) {
      console.error("Error handling offer:", error);
      setTransferStatus(`Connection error: ${error.message}`);

      // Inform the other peer about the failure
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
    try {
      setTransferStatus("Received connection answer...");

      // If broadcasting, use the specific peer connection for this user
      if (peerConnectionsRef.current[data.from]) {
        await peerConnectionsRef.current[data.from].setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );
        console.log(`Answer set for broadcast connection to ${data.from}`);
      }
      // Otherwise use the single peer connection
      else if (peerConnectionRef.current) {
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

      // Inform the other peer about the failure
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
    try {
      // If broadcasting, use the specific peer connection for this user
      if (peerConnectionsRef.current[data.from]) {
        await peerConnectionsRef.current[data.from].addIceCandidate(
          new RTCIceCandidate(data.candidate)
        );
      }
      // Otherwise use the single peer connection
      else if (peerConnectionRef.current) {
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

  // Broadcast files to all connected users with enhanced reliability
  const broadcastFiles = async () => {
    if (!files.length || users.length === 0 || !socket) {
      setTransferStatus(
        "No files selected, no users available, or not connected"
      );
      return;
    }

    setBroadcasting(true);
    setTransferStatus("Preparing to broadcast files to all users...");

    // Initialize connections to all users
    let connectedUsers = 0;
    let failedUsers = 0;
    const totalUsers = users.length;

    // Track answers received from users
    const answersReceived = {};
    const connectionStates = {};

    try {
      // Connect to each user and send files
      for (const user of users) {
        try {
          setTransferStatus(
            `Connecting to ${user.username} (${
              connectedUsers + 1
            }/${totalUsers})`
          );

          // Create and store a new peer connection for this user
          const peerConnection = new RTCPeerConnection(peerConfiguration);
          peerConnectionsRef.current[user.socketId] = peerConnection;

          // Handle ICE candidates
          peerConnection.onicecandidate = (event) => {
            if (event.candidate && socket) {
              socket.emit("ice-candidate", {
                target: user.socketId,
                candidate: event.candidate,
              });
            }
          };

          // Monitor connection state
          peerConnection.onconnectionstatechange = () => {
            console.log(
              `Connection to ${user.username} state: ${peerConnection.connectionState}`
            );
            connectionStates[user.socketId] = peerConnection.connectionState;

            if (
              peerConnection.connectionState === "failed" ||
              peerConnection.connectionState === "disconnected"
            ) {
              console.log(
                `Connection to ${user.username} failed or disconnected`
              );
            }
          };

          // Create data channel with reliable settings
          const dataChannel = peerConnection.createDataChannel("fileTransfer", {
            ordered: true,
          });

          // Set up data channel handlers
          dataChannel.onopen = () => {
            console.log(`Data channel to ${user.username} opened`);
            dataChannelsRef.current[user.socketId] = dataChannel;
          };

          dataChannel.onerror = (err) => {
            console.error(`Data channel error with ${user.username}:`, err);
          };

          dataChannel.onclose = () => {
            console.log(`Data channel to ${user.username} closed`);
          };

          // Create and send offer
          const offer = await peerConnection.createOffer({
            offerToReceiveAudio: false,
            offerToReceiveVideo: false,
          });
          await peerConnection.setLocalDescription(offer);

          socket.emit("offer", {
            target: user.socketId,
            offer,
          });

          // Register a one-time handler for this specific user's answer
          const answerHandler = (data) => {
            if (data.from === user.socketId) {
              answersReceived[user.socketId] = true;

              // Set the remote description when we get an answer
              peerConnectionsRef.current[user.socketId]
                ?.setRemoteDescription(new RTCSessionDescription(data.answer))
                .catch((err) => {
                  console.error(
                    `Error setting remote description for ${user.username}:`,
                    err
                  );
                });
            }
          };

          socket.on("answer", answerHandler);

          // Wait for answer with timeout
          let answerReceived = false;
          for (let attempt = 0; attempt < 10; attempt++) {
            await delay(500);
            if (answersReceived[user.socketId]) {
              answerReceived = true;
              break;
            }
          }

          // Remove the one-time handler
          socket.off("answer", answerHandler);

          if (!answerReceived) {
            throw new Error("No answer received within timeout");
          }

          // Wait for data channel to open with timeout
          let channelOpened = false;
          for (let attempt = 0; attempt < 20; attempt++) {
            await delay(500);
            if (dataChannelsRef.current[user.socketId]?.readyState === "open") {
              channelOpened = true;
              break;
            }
          }

          if (!channelOpened) {
            throw new Error("Data channel didn't open within timeout");
          }

          // Send files to this user
          for (const file of files) {
            setTransferStatus(`Sending ${file.name} to ${user.username}...`);

            // Create a file info object with sender name
            const fileInfo = {
              name: file.name,
              type: file.type || "application/octet-stream",
              size: file.size,
              sender: username,
            };

            // Send file info
            dataChannelsRef.current[user.socketId].send(
              JSON.stringify({
                type: "file-info",
                info: fileInfo,
              })
            );

            // Short delay after sending file info
            await delay(200);

            // Send file in chunks with backpressure handling
            const chunkSize = 16384; // 16KB chunks
            let offset = 0;

            while (offset < file.size) {
              // Check if connection is still open
              if (
                dataChannelsRef.current[user.socketId]?.readyState !== "open"
              ) {
                throw new Error("Connection lost during file transfer");
              }

              const slice = file.slice(offset, offset + chunkSize);
              const arrayBuffer = await slice.arrayBuffer();

              // Send chunk and handle backpressure
              if (
                dataChannelsRef.current[user.socketId].bufferedAmount >
                1024 * 1024
              ) {
                // Wait until buffer clears a bit if we have >1MB queued
                await new Promise((resolve) => {
                  const checkBuffer = () => {
                    if (
                      dataChannelsRef.current[user.socketId]?.readyState !==
                      "open"
                    ) {
                      resolve(); // Connection closed, stop waiting
                    } else if (
                      dataChannelsRef.current[user.socketId].bufferedAmount <
                      512 * 1024
                    ) {
                      resolve(); // Buffer cleared enough
                    } else {
                      setTimeout(checkBuffer, 100);
                    }
                  };
                  setTimeout(checkBuffer, 100);
                });
              }

              try {
                dataChannelsRef.current[user.socketId].send(arrayBuffer);
              } catch (error) {
                console.error(
                  `Error sending chunk to ${user.username}:`,
                  error
                );
                throw new Error(`Failed to send data: ${error.message}`);
              }

              offset += arrayBuffer.byteLength;

              // Update progress occasionally
              if (offset % (chunkSize * 10) === 0 || offset >= file.size) {
                const progress = Math.floor((offset / file.size) * 100);
                setTransferProgress(progress);
              }
            }

            // Signal completion
            dataChannelsRef.current[user.socketId].send(
              JSON.stringify({
                type: "transfer-complete",
              })
            );

            // Short delay between files
            await delay(300);
          }

          connectedUsers++;
          setTransferStatus(
            `Successfully sent to ${connectedUsers}/${totalUsers} users`
          );
        } catch (error) {
          console.error(`Error broadcasting to ${user.username}:`, error);
          setTransferStatus(
            `Failed to send to ${user.username}: ${error.message}`
          );
          failedUsers++;
        } finally {
          // Clean up this specific connection after sending files
          try {
            if (dataChannelsRef.current[user.socketId]) {
              dataChannelsRef.current[user.socketId].close();
            }
          } catch (e) {
            console.error("Error closing data channel:", e);
          }
        }
      }
    } finally {
      // Final status report
      if (connectedUsers === totalUsers) {
        setTransferStatus(
          `Broadcast complete! Successfully sent to all ${totalUsers} users.`
        );
      } else {
        setTransferStatus(
          `Broadcast complete. Sent to ${connectedUsers}/${totalUsers} users. Failed: ${failedUsers}`
        );
      }

      // Clean up all peer connections
      for (const userId in peerConnectionsRef.current) {
        try {
          if (peerConnectionsRef.current[userId]) {
            peerConnectionsRef.current[userId].close();
          }
        } catch (e) {
          console.error("Error closing peer connection:", e);
        }
      }

      // Reset state
      setBroadcasting(false);
      peerConnectionsRef.current = {};
      dataChannelsRef.current = {};
    }
  };

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

    // Check connection before starting transfer
    if (!checkConnection()) {
      setTransferStatus(
        "Connection appears to be unstable. Trying to reconnect..."
      );
      if (selectedUser) {
        await connectToPeer();
      }
      return;
    }

    // Process each file sequentially
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        await sendSingleFile(file);

        // Update status if we have more files to send
        if (i < files.length - 1) {
          setTransferStatus(
            `Preparing next file (${i + 1}/${files.length} complete)...`
          );
          // Short delay to update the UI
          await delay(500);
        }
      } catch (error) {
        console.error(`Error sending file ${file.name}:`, error);
        setTransferStatus(`Error sending ${file.name}: ${error.message}`);

        // If connection was lost, try to reconnect
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

      // Send file metadata first
      const fileInfo = {
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        sender: username, // Include sender name
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

      // Read and send the file in chunks
      const chunkSize = 16384; // 16KB chunks
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

          // Update progress
          const progress = Math.floor((offset / file.size) * 100);
          setTransferProgress(progress);
          setTransferStatus(`Sending ${file.name}: ${progress}%`);

          // Continue reading if there's more data
          if (offset < file.size) {
            // Handle backpressure
            if (dataChannelRef.current.bufferedAmount > 1024 * 1024) {
              // If buffer is getting full, wait before sending more
              setTimeout(() => readSlice(offset), 100);
            } else {
              readSlice(offset);
            }
          } else {
            // Signal transfer completion
            dataChannelRef.current.send(
              JSON.stringify({
                type: "transfer-complete",
              })
            );

            // Resolve the promise when the file is done
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

      // Start reading the first slice
      readSlice(0);
    });
  };

  // Download received file
  const downloadFile = (file) => {
    const a = document.createElement("a");
    a.href = file.url;
    a.download = file.name;
    a.click();
  };

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
