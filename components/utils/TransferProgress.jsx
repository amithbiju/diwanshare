import React from "react";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";

const TransferProgress = ({ transfers, onCancel }) => {
  // Get only active transfers (pending or transferring)
  const activeTransfers = transfers.filter(
    (t) => t.status === "pending" || t.status === "transferring"
  );

  const recentTransfers = transfers
    .filter((t) => t.status === "completed" || t.status === "failed")
    .slice(0, 5);

  if (activeTransfers.length === 0 && recentTransfers.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 h-full">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        Transfer Progress
      </h2>

      {activeTransfers.length > 0 && (
        <div className="space-y-4">
          {activeTransfers.map((transfer) => (
            <div
              key={transfer.id}
              className="border border-gray-100 rounded-lg p-3"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {transfer.fileName}
                  </p>
                  <p className="text-xs text-gray-500">
                    To: {transfer.recipient} •{" "}
                    {(transfer.fileSize / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  onClick={() => onCancel(transfer.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <XCircle size={18} />
                </button>
              </div>

              <div className="relative pt-1">
                <div className="w-full h-2 bg-gray-100 rounded-full mb-1">
                  <div
                    className="h-2 bg-indigo-600 rounded-full transition-all duration-300 ease-in-out"
                    style={{ width: `${transfer.progress}%` }}
                  ></div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-indigo-600">
                    {transfer.progress}%
                  </span>
                  <span className="text-xs text-gray-500">
                    {transfer.status === "pending"
                      ? "Preparing..."
                      : "Transferring..."}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {recentTransfers.length > 0 && (
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
                    <CheckCircle size={16} className="text-green-500 mr-2" />
                  ) : (
                    <AlertTriangle size={16} className="text-amber-500 mr-2" />
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
      )}
    </div>
  );
};

export default TransferProgress;
