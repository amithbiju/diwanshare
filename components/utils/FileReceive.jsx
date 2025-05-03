import React from "react";
import {
  Download,
  File as FileIcon,
  Image,
  FileText,
  FileArchive,
} from "lucide-react";

const FileReceive = ({ receivedFiles, downloadFile }) => {
  const getFileIcon = (fileType) => {
    if (fileType.startsWith("image/")) {
      return <Image size={20} className="text-teal-500" />;
    } else if (fileType.includes("pdf") || fileType.includes("document")) {
      return <FileText size={20} className="text-indigo-500" />;
    } else if (
      fileType.includes("zip") ||
      fileType.includes("rar") ||
      fileType.includes("tar")
    ) {
      return <FileArchive size={20} className="text-amber-500" />;
    } else {
      return <FileIcon size={20} className="text-gray-500" />;
    }
  };

  return (
    <div className="backdrop-blur-sm rounded-lg shadow-sm p-4 h-full">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        Received Files
      </h2>

      {receivedFiles.length > 0 ? (
        <div className="space-y-2 max-h-[480px] overflow-auto pr-2">
          {receivedFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-all"
            >
              <div className="flex items-center">
                <div className="h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  {getFileIcon(file.type)}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-800">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    From: {file.sender} •{" "}
                    {new Date(file.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </span>
                <button
                  onClick={() => downloadFile(file)}
                  className={`p-2 rounded-full transition-colors ${
                    file.downloaded
                      ? "bg-gray-100 text-gray-400"
                      : "bg-teal-50 text-teal-600 hover:bg-teal-100"
                  }`}
                >
                  <Download size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <p>No files received yet</p>
          <p className="text-sm mt-1">Files sent to you will appear here</p>
        </div>
      )}
    </div>
  );
};

export default FileReceive;

// {/* Received Files */}
// {receivedFiles.length > 0 && (
//     <div className="mt-6">
//       <h3 className="text-xl font-semibold text-[#2d4f2d] mb-3">
//         Received Specimens
//       </h3>
//       <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
//         {receivedFiles.map((file, index) => (
//           <motion.div
//             key={index}
//             className="bg-[#f8f5ed] border border-[#d6ccb5] rounded-lg px-4 py-3 flex justify-between items-center"
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{ duration: 0.3, delay: index * 0.1 }}
//           >
//             <div>
//               <div className="text-[#a04e33] font-medium">
//                 From: {file.sender}
//               </div>
//               <div className="text-[#3c3c3c]">
//                 {file.name} ({Math.round(file.size / 1024)} KB)
//               </div>
//             </div>
//             <motion.button
//               onClick={() => downloadFile(file)}
//               className="bg-gradient-to-r from-[#5a8056] to-[#476e43] text-[#f4efe1] px-4 py-2 rounded-full hover:from-[#6a9566] hover:to-[#577e53] transition duration-300 shadow-md"
//               whileHover={{ scale: 1.05 }}
//               whileTap={{ scale: 0.95 }}
//             >
//               Download
//             </motion.button>
//           </motion.div>
//         ))}
//       </div>
//     </div>
//   )}
