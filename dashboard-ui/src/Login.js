import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./App.css";

function Login() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [data, setData] = useState({ email: "", password: "" });

  const handleChange = (e) => {
    setData({ ...data, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const res = await fetch("http://localhost:5000/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const result = await res.json();

    if (result.message === "Login Successful ✅") {
      localStorage.setItem("token", result.token);
      localStorage.setItem("user", JSON.stringify(result.user));
      localStorage.setItem("language", result.user.language_preference || 'mr');
      i18n.changeLanguage(result.user.language_preference || 'mr');
      alert(t("loginSuccess"));
      navigate("/dashboard");
    } else {
      alert(result.message);
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

        <h2>{t("loginTitle")}</h2>

        <input name="email" placeholder={t("email")} onChange={handleChange} required />
        <input type="password" name="password" placeholder={t("password")} onChange={handleChange} required />

        <button>{t("loginButton")}</button>

        <p className="link">
          {t("newUser")}
          <span onClick={() => navigate("/register")}> {t("register")}</span>
        </p>
        <p className="link">
          <span onClick={() => navigate("/")}>🏠 {t("home")}</span>
        </p>

      </form>
    </div>
  );
}

export default Login;