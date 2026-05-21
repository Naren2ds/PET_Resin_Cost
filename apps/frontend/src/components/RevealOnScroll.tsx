import React from "react";
import { motion } from "framer-motion";

type RevealOnScrollProps = {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
};

const RevealOnScroll: React.FC<RevealOnScrollProps> = ({
  children,
  delay = 0,
  y = 20,
  className,
}) => {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
};

export default RevealOnScroll;
