import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";

import App from "./App.tsx";
import { UploadPage } from "./UploadPage";
import AdminPage from "./AdminPage"; // Import new page

import "./index.css";

createRoot(document.getElementById("root")!).render(
    <HashRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/admin" element={<AdminPage />} /> {/* New Admin Route */}
      </Routes>
    </HashRouter>
);
