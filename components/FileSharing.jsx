import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

import { motion } from "framer-motion";
import LandingPage from "./utils/LandingPage";
import PeerList from "./utils/PeerList";
import FileUpload from "./utils/FileUpload";
import FileReceive from "./utils/FileReceive";
// Configuration for WebRTC
const peerConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
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

  // References
  const peerConnectionRef = useRef(null);
  const peerConnectionsRef = useRef({}); // For multiple connections during broadcast
  const dataChannelRef = useRef(null);
  const dataChannelsRef = useRef({}); // For multiple data channels during broadcast
  const fileReaderRef = useRef(null);
  const receivedBuffersRef = useRef([]);
  const receivedSizeRef = useRef(0);
  const fileInfoRef = useRef(null);

  // Connect to socket when component mounts
  useEffect(() => {
    const newSocket = io("https://diwanshareserver.onrender.com");
    setSocket(newSocket);

    // Clean up socket connection when component unmounts
    return () => {
      if (newSocket) newSocket.disconnect();
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
      clearInterval(interval);
    };
  }, [socket]);

  // Handle user registration
  const registerUser = () => {
    if (username.trim() && socket) {
      socket.emit("register", username);
      setIsRegistered(true);
    }
  };

  // Initialize peer connection and data channel
  const initializePeerConnection = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    const peerConnection = new RTCPeerConnection(peerConfiguration);
    peerConnectionRef.current = peerConnection;

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && selectedUser) {
        socket.emit("ice-candidate", {
          target: selectedUser.socketId,
          candidate: event.candidate,
        });
      }
    };

    // For receiving data channel
    peerConnection.ondatachannel = (event) => {
      console.log("Data channel received");
      setupDataChannel(event.channel);
    };

    return peerConnection;
  };

  // Set up data channel for sending/receiving files
  const setupDataChannel = (dataChannel) => {
    dataChannelRef.current = dataChannel;

    dataChannel.onopen = () => {
      console.log("Data channel opened");
      setTransferStatus("Connected! Ready to transfer files");
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
        }
      } else {
        // Handle file chunk
        receivedBuffersRef.current.push(data);
        receivedSizeRef.current += data.byteLength;

        // Update progress
        const progress = Math.floor(
          (receivedSizeRef.current / fileInfoRef.current.size) * 100
        );
        setTransferProgress(progress);
      }
    };
  };

  // Process the received file once transfer is complete
  const processReceivedFile = () => {
    const fileInfo = fileInfoRef.current;
    const blob = new Blob(receivedBuffersRef.current, { type: fileInfo.type });
    const url = URL.createObjectURL(blob);

    setReceivedFiles((prev) => [
      ...prev,
      {
        name: fileInfo.name,
        type: fileInfo.type,
        size: fileInfo.size,
        url,
        sender: fileInfo.sender || "Unknown user", // Store sender name
      },
    ]);

    setTransferStatus("File received successfully!");
    setTransferProgress(100);
  };

  // Initiate connection to selected user
  const connectToPeer = async () => {
    if (!selectedUser) return;

    const peerConnection = initializePeerConnection();

    // Create data channel
    const dataChannel = peerConnection.createDataChannel("fileTransfer");
    setupDataChannel(dataChannel);

    // Create and send offer
    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      socket.emit("offer", {
        target: selectedUser.socketId,
        offer,
      });

      setTransferStatus("Connecting...");
    } catch (error) {
      console.error("Error creating offer:", error);
      setTransferStatus(`Error: ${error.message}`);
    }
  };

  // Handle receiving an offer from another peer
  const handleReceiveOffer = async (data) => {
    const peerConnection = initializePeerConnection();

    try {
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

      setTransferStatus("Incoming connection...");
    } catch (error) {
      console.error("Error handling offer:", error);
      setTransferStatus(`Error: ${error.message}`);
    }
  };

  // Handle receiving an answer after sending an offer
  const handleReceiveAnswer = async (data) => {
    try {
      // If broadcasting, use the specific peer connection for this user
      if (peerConnectionsRef.current[data.from]) {
        await peerConnectionsRef.current[data.from].setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );
      }
      // Otherwise use the single peer connection
      else if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );
      }
    } catch (error) {
      console.error("Error handling answer:", error);
    }
  };

  // Handle ICE candidates
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
      }
    } catch (error) {
      console.error("Error adding ICE candidate:", error);
    }
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    setFiles(Array.from(e.target.files));
  };

  // Broadcast files to all connected users
  const broadcastFiles = async () => {
    if (!files.length || users.length === 0) {
      setTransferStatus("No files selected or no users available");
      return;
    }

    setBroadcasting(true);
    setTransferStatus("Preparing to broadcast files to all users...");

    // Initialize connections to all users
    let connectedUsers = 0;
    const totalUsers = users.length;

    // Create a promise-based delay function
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // Track answers received from users
    const answersReceived = {};

    // Create a handler for answers specific to broadcasting
    const handleBroadcastAnswer = (data, userId) => {
      if (peerConnectionsRef.current[userId]) {
        peerConnectionsRef.current[userId].setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );
        answersReceived[userId] = true;
      }
    };

    // Add a one-time broadcast answer handler to the socket
    const broadcastAnswerHandler = (data) => {
      handleBroadcastAnswer(data, data.from);
    };

    socket.on("answer", broadcastAnswerHandler);

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
            if (event.candidate) {
              socket.emit("ice-candidate", {
                target: user.socketId,
                candidate: event.candidate,
              });
            }
          };

          // Create data channel with reliable settings
          const dataChannel = peerConnection.createDataChannel("fileTransfer", {
            ordered: true,
            reliable: true,
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
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);

          socket.emit("offer", {
            target: user.socketId,
            offer,
          });

          // Wait for answer with timeout
          await new Promise((resolve, reject) => {
            const checkAnswer = async () => {
              // Check if we received an answer
              if (answersReceived[user.socketId]) {
                resolve();
                return;
              }

              // Try a few times with delay
              for (let attempt = 0; attempt < 10; attempt++) {
                await delay(500);
                if (answersReceived[user.socketId]) {
                  resolve();
                  return;
                }
              }

              // Give up after 5 seconds
              reject(new Error("Connection timeout waiting for answer"));
            };

            checkAnswer();
          });

          // Wait for data channel to open with timeout
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(
              () => reject(new Error("Data channel didn't open")),
              5000
            );

            const checkChannel = async () => {
              // Check if channel is already open
              if (
                dataChannelsRef.current[user.socketId]?.readyState === "open"
              ) {
                clearTimeout(timeout);
                resolve();
                return;
              }

              // Try a few times with delay
              for (let attempt = 0; attempt < 10; attempt++) {
                await delay(500);
                if (
                  dataChannelsRef.current[user.socketId]?.readyState === "open"
                ) {
                  clearTimeout(timeout);
                  resolve();
                  return;
                }
              }
            };

            checkChannel();
          });

          // Send files to this user
          for (const file of files) {
            setTransferStatus(`Sending ${file.name} to ${user.username}...`);

            // Create a file info object with sender name
            const fileInfo = {
              name: file.name,
              type: file.type,
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
            await delay(100);

            // Send file in chunks with backpressure handling
            const chunkSize = 16384;
            let offset = 0;

            while (offset < file.size) {
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
                      dataChannelsRef.current[user.socketId].bufferedAmount <
                      512 * 1024
                    ) {
                      resolve();
                    } else {
                      setTimeout(checkBuffer, 100);
                    }
                  };
                  setTimeout(checkBuffer, 100);
                });
              }

              dataChannelsRef.current[user.socketId].send(arrayBuffer);
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
            await delay(200);
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
        }
      }
    } finally {
      // Clean up the temporary socket handler
      socket.off("answer", broadcastAnswerHandler);

      // Clean up peer connections
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
      setTransferStatus(
        `Broadcast complete! Sent to ${connectedUsers}/${totalUsers} users`
      );
      setBroadcasting(false);
      peerConnectionsRef.current = {};
      dataChannelsRef.current = {};
    }
  };

  // Send selected files
  const sendFiles = async () => {
    if (
      !files.length ||
      !dataChannelRef.current ||
      dataChannelRef.current.readyState !== "open"
    ) {
      setTransferStatus("No connection or no files selected");
      return;
    }

    // Process each file sequentially
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      await sendSingleFile(file);

      // Update status if we have more files to send
      if (i < files.length - 1) {
        setTransferStatus(
          `Preparing next file (${i + 1}/${files.length} complete)...`
        );
        // Short delay to update the UI
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    setTransferStatus(`All files sent successfully! (${files.length} files)`);
  };

  // Helper function to send a single file
  const sendSingleFile = (file) => {
    return new Promise((resolve, reject) => {
      // Send file metadata first
      const fileInfo = {
        name: file.name,
        type: file.type,
        size: file.size,
        sender: username, // Include sender name
      };

      dataChannelRef.current.send(
        JSON.stringify({
          type: "file-info",
          info: fileInfo,
        })
      );

      // Read and send the file in chunks
      const chunkSize = 16384; // 16KB chunks
      const fileReader = new FileReader();
      let offset = 0;

      fileReaderRef.current = fileReader;

      fileReader.onload = (e) => {
        if (dataChannelRef.current.readyState === "open") {
          dataChannelRef.current.send(e.target.result);
          offset += e.target.result.byteLength;

          // Update progress
          const progress = Math.floor((offset / file.size) * 100);
          setTransferProgress(progress);
          setTransferStatus(`Sending ${file.name}: ${progress}%`);

          // Continue reading if there's more data
          if (offset < file.size) {
            readSlice(offset);
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
        receivedFiles={receivedFiles}
        downloadFile={downloadFile}
      />
      <FileReceive receivedFiles={receivedFiles} downloadFile={downloadFile} />
    </div>
  );
}

// File Transfer Component
