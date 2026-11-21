// Register.js
import { useState } from "react";
import API_URL from "./config";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./App.css";

function Register() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    village_name: "",
    language_preference: "mr"
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const res = await fetch(`${API_URL}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData)
    });

    const data = await res.json();

    if (data.message === "Registered Successfully ✅") {
      alert(t("registerSuccess"));
      navigate("/login");
    } else {
      alert(data.message);
    }
  };

  return (
    <div className="auth-container">
      <form className="form" onSubmit={handleSubmit}>

        <img
          src="https://cdn-icons-png.flaticon.com/512/728/728093.png"
          className="form-logo"
          alt="logo"
        />

        <h2>{t("registerTitle")}</h2>

        <input
          type="text"
          name="name"
          placeholder={t("name")}
          onChange={handleChange}
          required
        />

        <input
          type="email"
          name="email"
          placeholder={t("email")}
          onChange={handleChange}
          required
        />

        <input
          type="text"
          name="phone"
          placeholder={t("phone")}
          onChange={handleChange}
          required
        />

        <input
          type="password"
          name="password"
          placeholder={t("password")}
          onChange={handleChange}
          required
        />

        <input
          type="text"
          name="village_name"
          placeholder={t("village")}
          onChange={handleChange}
          required
        />

        <select name="language_preference" onChange={handleChange} value={formData.language_preference}>
          <option value="mr">{t("marathi")}</option>
          <option value="en">{t("english")}</option>
        </select>

        <button>{t("registerButton")}</button>

        <p className="link">
          {t("haveAccount")}
          <span onClick={() => navigate("/login")}> {t("login")}</span>
        </p>
        <p className="link">
          <span onClick={() => navigate("/")}>🏠 {t("home")}</span>
        </p>

      </form>
    </div>
  );
}

export default Register;