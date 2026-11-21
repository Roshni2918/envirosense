import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./Landing";
import Register from "./Register";
import Login from "./Login";
import LoginChoice from "./LoginChoice";
import Dashboard from "./Dashboard";
import AdminLogin from "./AdminLogin";
import AdminDashboard from "./AdminDashboard";
import WhatsAppButton from "./WhatsAppButton";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/login-choice" element={<LoginChoice />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/adminLogin" element={<AdminLogin />} />
        <Route path="/adminDashboard" element={<AdminDashboard />} />
      </Routes>
      {/* Floating WhatsApp chat button — visible on every page */}
      <WhatsAppButton />
    </BrowserRouter>
  );
}

export default App;
