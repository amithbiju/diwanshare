"use client";
import React from "react";
import { motion } from "framer-motion";
import backgroundImage from "../public/images/home.png"; // Adjust the path to your image
import FileSharing from "./FileSharing";
const Hero = () => {
  return (
    <>
      {/* Hero Section */}
      <section
        id="hero"
        className="relative h-screen w-full overflow-hidden px-0 pt-24 pb-10"
      >
        {/* Background Image */}
        <img
          src={backgroundImage.src}
          alt="Background"
          className="absolute inset-0 w-full h-full object-cover -z-10 brightness-[0.4]"
        />

        {/* Overlay Content */}
        <div className="absolute inset-0 flex items-center justify-center z-10 w-full">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
            className="w-full" // Remove max-w-4xl and make it full width
          >
            <FileSharing />
          </motion.div>
        </div>
      </section>
    </>
  );
};

export default Hero;
