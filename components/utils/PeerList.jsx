import React from "react";
import { User, Wifi } from "lucide-react";

const PeerList = ({
  users,
  selectedUser,
  setSelectedUser,
  connectToPeer,
  currentUser,
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">
          Available Connections
        </h2>
        <div className="flex items-center text-sm text-green-600">
          <Wifi size={16} className="mr-1" />
          <span>{users.length} online</span>
        </div>
      </div>

      <div className="space-y-3 max-h-[480px] overflow-auto pr-2">
        {users.length > 0 ? (
          users.map((peer) => (
            <div
              key={peer.id}
              onClick={() => onSelectPeer(peer.id)}
              className="flex items-center p-3 rounded-lg cursor-pointer hover:bg-gray-50 transition-all border border-gray-100"
            >
              <div className="relative h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                <User size={18} className="text-indigo-600" />
                <span
                  className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white ${
                    "online" === "online"
                      ? "bg-green-500"
                      : peer.status === "away"
                      ? "bg-amber-500"
                      : "bg-red-500"
                  }`}
                ></span>
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-gray-800">
                  {peer.username} {peer.username === currentUser ? "(You)" : ""}
                </p>
                <p className="text-xs text-gray-500">
                  {"online" === "online"
                    ? "Available"
                    : peer.status === "away"
                    ? "Away"
                    : "Busy"}
                </p>
              </div>
              <button
                className="px-3 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-full hover:bg-indigo-100 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedUser(peer);
                  connectToPeer();
                }}
              >
                Connect
              </button>
            </div>
          ))
        ) : (
          <div className="text-center py-6 text-gray-500">
            <p>No peers available at the moment</p>
          </div>
        )}
      </div>
      <h4>connected to {selectedUser?.username}</h4>
    </div>
  );
};

export default PeerList;
function UsersCard({ users, selectedUser, setSelectedUser, connectToPeer }) {
  return (
    <motion.div
      className="bg-[#f4efe1]/85 backdrop-blur-md rounded-lg border border-[#a08b68] shadow-2xl overflow-hidden w-full lg:w-1/3"
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.8 }}
    >
      <div className="h-3 bg-gradient-to-r from-[#a04e33] via-[#b87652] to-[#a04e33]"></div>
      <div className="p-6">
        <h2 className="text-2xl font-bold text-[#2d4f2d] mb-6 text-center">
          Greenhouse Visitors
        </h2>

        <div className="relative h-64 bg-[#f8f5ed]/70 rounded-lg border border-[#d6ccb5] p-4 overflow-hidden">
          {users.length === 0 ? (
            <p className="text-[#5a6c59] text-center mt-16">
              No other botanists online
            </p>
          ) : (
            <div className="w-full h-full relative">
              {users.map((user, index) => {
                const top = 20 + index * 20;
                const left = 30 + ((index * 15) % 40);

                return (
                  <motion.div
                    key={user.socketId}
                    className={`absolute cursor-pointer transition-all duration-300 ${
                      selectedUser?.socketId === user.socketId
                        ? "bg-[#5a8056] text-white"
                        : "bg-[#e8e0ce] text-[#3c3c3c] hover:bg-[#d6ccb5]"
                    }`}
                    style={{
                      top: `${top}%`,
                      left: `${left}%`,
                      transform: "translate(-50%, -50%)",
                      padding: "8px 16px",
                      borderRadius: "20px",
                      border:
                        selectedUser?.socketId === user.socketId
                          ? "1px solid #476e43"
                          : "1px solid #ccc0a9",
                    }}
                    animate={{
                      y: [0, 5, 0],
                      x: [0, -3, 0],
                    }}
                    transition={{
                      duration: 3 + index,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    onClick={() => setSelectedUser(user)}
                    whileHover={{ scale: 1.1 }}
                  >
                    {user.username}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {selectedUser && (
          <motion.button
            onClick={connectToPeer}
            className="mx-auto mt-6 block bg-gradient-to-r from-[#5a8056] to-[#476e43] text-[#f4efe1] font-medium rounded-full px-6 py-3 hover:from-[#6a9566] hover:to-[#577e53] transition duration-300 shadow-md"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Connect to {selectedUser.username}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
