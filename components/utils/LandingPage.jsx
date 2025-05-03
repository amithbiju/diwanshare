import React, { useState } from "react";
import { ArrowRight } from "lucide-react";

const LandingPage = ({ username, setUsername, registerUser }) => {
  const [tempName, setTempname] = useState("");
  const [error, setError] = useState("");

  const temporaryNames = [
    "CoolPenguin",
    "QuickFox",
    "BusyBee",
    "SilentOwl",
    "JollyDolphin",
    "CleverFox",
  ];

  const selectTemporaryName = (name) => {
    setUsername(name);
    setError("");
  };

  const BrandingSection = () => (
    <div className="text-white">
      <h1 className="text-4xl lg:text-6xl font-bold mb-4 lg:mb-6 leading-tight">
        ShareWave
      </h1>
      <p className="text-xl lg:text-2xl text-indigo-100 mb-8 lg:mb-12">
        Fast, secure peer-to-peer file sharing
      </p>
      <div className="space-y-4 lg:space-y-6">
        <div className="flex items-center space-x-3 lg:space-x-4">
          <div className="w-8 h-8 lg:w-12 lg:h-12 rounded-lg lg:rounded-xl bg-white/10 flex items-center justify-center">
            <div className="w-4 h-4 lg:w-6 lg:h-6 rounded-full bg-indigo-400"></div>
          </div>
          <p className="text-base lg:text-lg text-indigo-100">
            No cloud storage needed
          </p>
        </div>
        <div className="flex items-center space-x-3 lg:space-x-4">
          <div className="w-8 h-8 lg:w-12 lg:h-12 rounded-lg lg:rounded-xl bg-white/10 flex items-center justify-center">
            <div className="w-4 h-4 lg:w-6 lg:h-6 rounded-full bg-purple-400"></div>
          </div>
          <p className="text-base lg:text-lg text-indigo-100">
            Direct device-to-device transfer
          </p>
        </div>
        <div className="flex items-center space-x-3 lg:space-x-4">
          <div className="w-8 h-8 lg:w-12 lg:h-12 rounded-lg lg:rounded-xl bg-white/10 flex items-center justify-center">
            <div className="w-4 h-4 lg:w-6 lg:h-6 rounded-full bg-pink-400"></div>
          </div>
          <p className="text-base lg:text-lg text-indigo-100">
            End-to-end encryption
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-transparent flex flex-col lg:flex-row">
      <div className="lg:hidden w-full bg-gradient-to-br from-indigo-600 to-purple-600 p-6">
        <BrandingSection />
      </div>

      <div className="flex-1 flex items-center justify-center p-6 lg:p-16">
        <div className="w-full max-w-md">
          <form
            className="space-y-8"
            onSubmit={(e) => {
              e.preventDefault(); // Prevents page reload
              registerUser();
            }}
          >
            <div>
              <label
                htmlFor="username"
                className="block text-2xl font-medium text-white mb-2"
              >
                How should we call you?
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError("");
                }}
                placeholder="Enter your name"
                className="w-full px-6 py-4 text-lg text-white rounded-xl border-2 border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none bg-white/50 backdrop-blur-sm"
              />
              {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            </div>

            <div>
              <p className="text-sm text-gray-100 mb-3">
                Or choose a temporary name:
              </p>
              <div className="flex flex-wrap gap-2">
                {temporaryNames.map((tempName) => (
                  <button
                    key={tempName}
                    type="button"
                    onClick={() => selectTemporaryName(tempName)}
                    className="px-4 py-2 bg-white/30 backdrop-blur-sm text-indigo-100 rounded-lg text-sm hover:bg-indigo-900 transition-colors"
                  >
                    {tempName}
                  </button>
                ))}
              </div>
            </div>

            <button className="w-full flex items-center justify-center space-x-2 backdrop-blur-sm text-white py-4 px-6 rounded-xl text-lg font-medium hover:bg-black transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              <span>Connect</span>
              <ArrowRight size={20} />
            </button>
          </form>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 items-center justify-center p-16  backdrop-blur-sm">
        {/* bg-gradient-to-br from-indigo-600 to-purple-600 */}
        <div className="max-w-xl">
          <BrandingSection />
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
// // Login Component
// function LoginCard({ username, setUsername, registerUser }) {
//   return (
//     <motion.div
//       className="mx-auto max-w-md"
//       initial={{ opacity: 0, y: 20 }}
//       animate={{ opacity: 1, y: 0 }}
//       transition={{ duration: 0.8 }}
//     >
//       <div className=" backdrop-blur-md rounded-lg  shadow-2xl overflow-hidden">
//         <div className="h-3 "></div>
//         <div className="p-8">
//           <h2 className="text-3xl font-bold text-[#2d4f2d] mb-6 text-center">
//             Botanical Share
//           </h2>
//           <form onSubmit={registerUser} className="flex flex-col gap-5">
//             <div className="relative">
//               <label
//                 htmlFor="username"
//                 className="block text-[#2d4f2d] text-sm mb-2"
//               >
//                 Your Name
//               </label>
//               <input
//                 id="username"
//                 type="text"
//                 value={username}
//                 onChange={(e) => setUsername(e.target.value)}
//                 placeholder="Enter your name"
//                 className="w-full px-4 py-3 bg-[#f8f5ed] border border-[#ccc0a9] rounded-md text-[#3c3c3c] focus:outline-none focus:ring-2 focus:ring-[#7a9e76]"
//                 required
//               />
//             </div>
//             <motion.button
//               type="submit"
//               className="bg-gradient-to-r from-[#5a8056] to-[#476e43] text-[#f4efe1] font-medium rounded-md px-6 py-3 hover:from-[#6a9566] hover:to-[#577e53] transition duration-300 shadow-md"
//               whileHover={{ scale: 1.03 }}
//               whileTap={{ scale: 0.98 }}
//             >
//               Enter the Greenhouse
//             </motion.button>
//           </form>
//         </div>
//       </div>
//     </motion.div>
//   );
// }
