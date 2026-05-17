import dotenv from "dotenv";
dotenv.config();

import app from "./server";

const PORT = 3000;

const startLocalServer = async () => {
  if (process.env.NODE_ENV !== "production") {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
      app.use(vite.middlewares);
    } catch (e) {
      console.error("Vite failed:", e);
    }
  } else {
    const path = await import("path");
    const express = await import("express");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }
  app.listen(PORT, "0.0.0.0", () => console.log(`Local dev server: http://localhost:${PORT}`));
};

startLocalServer().catch(err => console.error("Critical Server Startup Error:", err));
