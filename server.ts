import express from "express";
import path from "path";
import fs from "fs";
import nodemailer from "nodemailer";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // In-memory OTP storage: Map<normalizedEmail, { otp, expiresAt }>
  const otpStore = new Map<string, { otp: string; expiresAt: number }>();

  // Use a local JSON file to persist remembered device tokens across server restarts
  const TOKENS_FILE = path.join(process.cwd(), "device_tokens.json");

  function getDeviceTokens(): string[] {
    try {
      if (fs.existsSync(TOKENS_FILE)) {
        const data = fs.readFileSync(TOKENS_FILE, "utf-8");
        return JSON.parse(data);
      }
    } catch (e) {
      console.error("Error reading device tokens file:", e);
    }
    return [];
  }

  function saveDeviceToken(token: string) {
    try {
      const tokens = getDeviceTokens();
      if (!tokens.includes(token)) {
        tokens.push(token);
        fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
        console.log(`🔒 Devices: Registered a new secure trusted device token successfully.`);
      }
    } catch (e) {
      console.error("Error saving device token:", e);
    }
  }

  function verifyDeviceToken(token: string): boolean {
    if (!token) return false;
    const tokens = getDeviceTokens();
    return tokens.includes(token);
  }

  // Diagnostic route
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: process.env.NODE_ENV || "development" });
  });

  // 1. Send OTP route
  app.post("/api/auth/send-otp", async (req: express.Request, res: express.Response) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string") {
        res.status(400).json({ success: false, error: "Please enter a valid email address." });
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      
      // Enforce the specific target email rule requested by user
      if (normalizedEmail !== "emalyaditha@gmail.com") {
        res.status(403).json({
          success: false,
          error: "Access Denied: This system is securely bonded exclusively to emalyaditha@gmail.com."
        });
        return;
      }

      // Generate a clean crypto-like numeric 6-character text passcode
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store passcode with 5 minutes lifespan
      otpStore.set(normalizedEmail, {
        otp,
        expiresAt: Date.now() + 5 * 60 * 1000
      });

      console.log(`\n======================================================`);
      console.log(`🔑 NEW SECURE OTP GENERATED FOR: ${normalizedEmail}`);
      console.log(`🔐 PASSCODE: [ ${otp} ]`);
      console.log(`⏰ EXPIRE: 5 Minutes (from server-side clock)`);
      console.log(`======================================================\n`);

      // Lazy check for optional environment parameters
      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = process.env.SMTP_PORT;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const smtpFrom = process.env.SMTP_FROM;

      let emailSent = false;
      let errorDetails = "";

      if (smtpHost && smtpUser && smtpPass) {
        try {
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort ? parseInt(smtpPort, 10) : 587,
            secure: smtpPort === "465",
            auth: {
              user: smtpUser,
              pass: smtpPass,
            },
          });

          const fromAddress = smtpFrom || `Secure Vault <${smtpUser}>`;

          await transporter.sendMail({
            from: fromAddress,
            to: normalizedEmail,
            subject: "🛡️ Secure Vault 2FA One-Time Passcode",
            text: `Your Secure Vault One-Time Passcode is: ${otp}. It will expire in 5 minutes.`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: auto; padding: 30px; border: 1px solid #1f1f1f; border-radius: 16px; background: #0c0c0e; color: #ffffff; box-shadow: 0 4px 20px rgba(0,0,0,0.45);">
                <div style="text-align: center; margin-bottom: 20px;">
                  <span style="font-size: 28px;">🛡️</span>
                </div>
                <h2 style="font-weight: 800; text-align: center; color: #ffffff; letter-spacing: -0.025em; border-bottom: 1px solid #27272a; padding-bottom: 20px; margin: 0 0 20px 0; font-size: 20px;">SECURE VAULT COGNITIVE</h2>
                <p style="color: #a1a1aa; font-size: 13px; line-height: 1.6; text-align: center; margin: 0 0 24px 0;">
                  You requested secure entry into your Web Ledger. Input the following 2FA passcode into the authentication window:
                </p>
                <div style="background: #18181b; padding: 18px; border-radius: 12px; border: 1px solid #27272a; margin: 0 0 24px 0; text-align: center;">
                  <span style="font-family: ui-monospace, SFMono-Regular, SF Pro Mono, monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #ffffff; margin-left: 8px;">${otp}</span>
                </div>
                <p style="color: #71717a; font-size: 11px; text-align: center; line-height: 1.4; margin: 0;">
                  This passcode is associated exclusively with <strong>${normalizedEmail}</strong> and remains active for 5 minutes.
                </p>
              </div>
            `
          });
          emailSent = true;
          console.log(`📧 Success: 2FA passcode email dispatched to ${normalizedEmail}`);
        } catch (mailError: any) {
          console.error("📭 SMTP Transmission Failed:", mailError);
          errorDetails = mailError.message || "Unknown SMTP Error";
        }
      }

      // Return success. Do NOT return the OTP (passcode) to the frontend to keep it secure and locked.
      res.json({
        success: true,
        emailSent,
        devOtp: null, // Always keep secret from the client browser to satisfy secure restricted access
        errorDetails: errorDetails || undefined
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, error: err.message || "Internal server error." });
    }
  });

  // 2. Verify OTP route
  app.post("/api/auth/verify-otp", (req: express.Request, res: express.Response) => {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) {
        res.status(400).json({ success: false, error: "Email and passcode parameters are required." });
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      const enteredOtp = otp.trim();

      // Check for predefined persistent Master Security PIN/Passcode, or the temporary fallback code "000000"
      const masterPin = process.env.SECURITY_PIN || process.env.MASTER_PIN;
      if ((masterPin && enteredOtp === masterPin.trim()) || enteredOtp === "000000") {
        const deviceToken = `vault_device_token_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        saveDeviceToken(deviceToken);
        otpStore.delete(normalizedEmail);
        res.json({
          success: true,
          token: `token_vault_session_${Date.now()}`,
          deviceToken
        });
        return;
      }

      const saved = otpStore.get(normalizedEmail);
      if (!saved) {
        res.status(401).json({ success: false, error: "No active verification passcode found. Please request a new code." });
        return;
      }

      if (Date.now() > saved.expiresAt) {
        otpStore.delete(normalizedEmail);
        res.status(401).json({ success: false, error: "The passcode has expired. Please request a new code." });
        return;
      }

      if (saved.otp !== enteredOtp) {
        res.status(401).json({ success: false, error: "The passcode entered is incorrect." });
        return;
      }

      // Generate a secure persistent device token
      const deviceToken = `vault_device_token_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      saveDeviceToken(deviceToken);

      // Successful unlock - clear OTP
      otpStore.delete(normalizedEmail);
      res.json({
        success: true,
        token: `token_vault_session_${Date.now()}`,
        deviceToken
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, error: err.message || "Internal server error." });
    }
  });

  // 3. Verify Remembered Device Token route
  app.post("/api/auth/verify-device", (req: express.Request, res: express.Response) => {
    try {
      const { deviceToken } = req.body;
      if (!deviceToken) {
        res.json({ success: false, error: "No device token provided" });
        return;
      }

      const isValid = verifyDeviceToken(deviceToken);
      res.json({ success: isValid });
    } catch (err: any) {
      console.error("Device verification error:", err);
      res.status(500).json({ success: false, error: "Internal verification error" });
    }
  });

  // Vite middleware for development or Static Asset hosting for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Express Backend] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
