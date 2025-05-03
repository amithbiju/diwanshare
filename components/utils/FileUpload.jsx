import React, { useState, useRef } from "react";
import {
  Upload,
  SendHorizontal,
  Podcast as Broadcast,
  XCircle,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";

const FileUpload = ({
  transferStatus,
  transferProgress,
  handleFileSelect,
  files,
  sendFiles,
  broadcastFiles,
  selectedUser,
  dataChannelRef,
  users,
  receivedFiles,
  downloadFile,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  // Fix: Remove TypeScript generic syntax from useRef
  const fileInputRef = useRef(null);

  // Handle drag events
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Handle drop event
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFiles(Array.from(e.dataTransfer.files));
    }
  };

  // Handle file input change
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e);
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  // Handle button click to open file dialog
  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  // Calculate total size of selected files
  const totalSize = selectedFiles.reduce((acc, file) => acc + file.size, 0);

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 h-full">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Send Files</h2>

      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragActive
            ? "border-indigo-600 bg-indigo-50"
            : "border-gray-300 hover:border-indigo-400"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleButtonClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          id="file-upload"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="mb-3 flex justify-center">
          <Upload
            size={32}
            className={`${dragActive ? "text-indigo-600" : "text-gray-400"}`}
          />
        </div>

        {selectedFiles.length > 0 ? (
          <div>
            <p className="text-sm font-medium text-indigo-700">
              {selectedFiles.length} file{selectedFiles.length > 1 ? "s" : ""}{" "}
              selected
            </p>
            <div className="mt-2 space-y-1">
              {selectedFiles.map((file, index) => (
                <p key={index} className="text-xs text-gray-600">
                  {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Total size: {(totalSize / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-gray-700">
              Drag and drop files here, or click to select
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Supports multiple files up to 100MB each
            </p>
          </div>
        )}
      </div>

      {selectedFiles.length > 0 && (
        <div className="flex space-x-3 mt-4">
          <button
            onClick={sendFiles}
            className="flex-1 flex items-center justify-center py-2.5 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            <SendHorizontal size={16} className="mr-2" />
            Send Files
          </button>
          <button
            onClick={broadcastFiles}
            className="flex-1 flex items-center justify-center py-2.5 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
          >
            <Broadcast size={16} className="mr-2" />
            Broadcast
          </button>
        </div>
      )}

      {/* Transfer Progress Section || recentTransfers.length > 0*/}
      {transferProgress > 0 && (
        <div className="mt-6">
          {transferProgress > 0 && (
            <div className="space-y-4">
              <div className="border border-gray-100 rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      sending files to {selectedUser?.username}
                    </p>
                    {/* <p className="text-xs text-gray-500">
                        To: {transfer.recipient} •{" "}
                        {(transfer.fileSize / 1024 / 1024).toFixed(2)} MB
                      </p> */}
                  </div>
                  <button className="text-gray-400 hover:text-red-500 transition-colors">
                    <XCircle size={18} />
                  </button>
                </div>

                <div className="relative pt-1">
                  <div className="w-full h-2 bg-gray-100 rounded-full mb-1">
                    <div
                      className="h-2 bg-indigo-600 rounded-full transition-all duration-300 ease-in-out"
                      style={{ width: `${transferProgress}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-indigo-600">
                      {transferProgress}%
                    </span>
                    <span className="text-xs text-gray-500">
                      {transferStatus}
                    </span>
                    {/* <span className="text-xs text-gray-500">
                      {"pending" === "pending"
                        ? "Preparing..."
                        : "Transferring..."}
                    </span> */}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* {recentTransfers.length > 0 && (
            <div className={activeTransfers.length > 0 ? "mt-6" : ""}>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Recent Transfers
              </h3>
              <div className="space-y-2">
                {recentTransfers.map((transfer) => (
                  <div
                    key={transfer.id}
                    className="flex justify-between items-center py-2 px-3 rounded-lg border border-gray-100"
                  >
                    <div className="flex items-center">
                      {transfer.status === "completed" ? (
                        <CheckCircle
                          size={16}
                          className="text-green-500 mr-2"
                        />
                      ) : (
                        <AlertTriangle
                          size={16}
                          className="text-amber-500 mr-2"
                        />
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {transfer.fileName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(transfer.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100">
                      {(transfer.fileSize / 1024 / 1024).toFixed(1)} MB
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )} */}
        </div>
      )}
    </div>
  );
};

export default FileUpload;
// function FileTransferCard({
//     transferStatus,
//     transferProgress,
//     handleFileSelect,
//     files,
//     sendFiles,
//     broadcastFiles,
//     selectedUser,
//     dataChannelRef,
//     users,
//     receivedFiles,
//     downloadFile,
//   }) {
//     return (
//       <motion.div
//         className="bg-[#f4efe1]/85 backdrop-blur-md rounded-lg border border-[#a08b68] shadow-2xl overflow-hidden w-full lg:w-2/3"
//         initial={{ opacity: 0, x: 50 }}
//         animate={{ opacity: 1, x: 0 }}
//         transition={{ duration: 0.8, delay: 0.2 }}
//       >
//         <div className="h-3 bg-gradient-to-r from-[#5a8056] via-[#7a9e76] to-[#5a8056]"></div>
//         <div className="p-6">
//           <h2 className="text-2xl font-bold text-[#2d4f2d] mb-4">
//             Botanical Exchange
//           </h2>

//           {/* Transfer Status */}
//           <div className="mb-6 p-4 bg-[#f8f5ed]/70 rounded-lg border border-[#d6ccb5]">
//             <p className="text-[#3c3c3c] font-medium">{transferStatus}</p>
//             {transferProgress > 0 && (
//               <div className="w-full bg-[#e8e0ce] h-2 rounded-full overflow-hidden mt-2">
//                 <motion.div
//                   className="bg-gradient-to-r from-[#5a8056] to-[#7a9e76] h-full"
//                   initial={{ width: "0%" }}
//                   animate={{ width: `${transferProgress}%` }}
//                   transition={{ duration: 0.5 }}
//                 ></motion.div>
//               </div>
//             )}
//           </div>

//           {/* File Selection */}
//           <div className="mb-6">
//             <label className="block text-[#2d4f2d] font-medium mb-2">
//               Select Specimens
//             </label>
//             <div className="relative">
//               <input
//                 type="file"
//                 onChange={handleFileSelect}
//                 multiple
//                 className="block w-full text-[#3c3c3c] border border-[#d6ccb5] rounded-md cursor-pointer bg-[#f8f5ed] file:mr-4 file:py-2 file:px-4
//                 file:rounded-l-md file:border-0 file:text-sm file:font-medium
//                 file:bg-[#5a8056] file:text-white hover:file:bg-[#6a9566]"
//               />
//             </div>
//             {files.length > 0 && (
//               <p className="mt-2 text-sm text-[#5a6c59]">
//                 {files.length} file(s) selected
//               </p>
//             )}
//           </div>

//           {/* File Transfer Buttons */}
//           <div className="flex flex-wrap gap-3 mb-6">
//             <motion.button
//               onClick={sendFiles}
//               disabled={
//                 !files.length ||
//                 !selectedUser ||
//                 !dataChannelRef.current ||
//                 dataChannelRef.current.readyState !== "open"
//               }
//               className={`${
//                 !files.length ||
//                 !selectedUser ||
//                 !dataChannelRef.current ||
//                 dataChannelRef.current.readyState !== "open"
//                   ? "bg-[#d6ccb5] text-[#8a8a8a]"
//                   : "bg-gradient-to-r from-[#5a8056] to-[#476e43] text-[#f4efe1] hover:from-[#6a9566] hover:to-[#577e53]"
//               } font-medium rounded-full px-6 py-3 transition duration-300 shadow-md`}
//               whileHover={{ scale: !files.length || !selectedUser ? 1 : 1.05 }}
//               whileTap={{ scale: !files.length || !selectedUser ? 1 : 0.95 }}
//             >
//               Send to {selectedUser?.username || "Selected Visitor"}
//             </motion.button>

//             <motion.button
//               onClick={broadcastFiles}
//               disabled={!files.length || users.length === 0}
//               className={`${
//                 !files.length || users.length === 0
//                   ? "bg-[#d6ccb5] text-[#8a8a8a]"
//                   : "bg-gradient-to-r from-[#b87652] to-[#a04e33] text-[#f4efe1] hover:from-[#c88662] hover:to-[#b05e43]"
//               } font-medium rounded-full px-6 py-3 transition duration-300 shadow-md`}
//               whileHover={{
//                 scale: !files.length || users.length === 0 ? 1 : 1.05,
//               }}
//               whileTap={{ scale: !files.length || users.length === 0 ? 1 : 0.95 }}
//             >
//               Broadcast to All Visitors ({users.length})
//             </motion.button>
//           </div>
//         </div>
//       </motion.div>
//     );
//   }
