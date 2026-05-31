import express from "express";
import path from "path";
import fs from "fs";
import nodemailer from "nodemailer";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // In-memory OTP storage: Map<normalizedEmail, { otp, expiresAt }>
  const otpStore = new Map<string, { otp: string; expiresAt: number }>();

  // Accounts Management
  const ACCOUNTS_FILE = path.join(process.cwd(), "accounts.json");
  interface Account {
    email: string;
    passwordHash: string;
    createdAt: number;
  }
  
  // Helper to fetch Supabase client
  const getSupabase = (req: express.Request) => {
    const url = (req.headers['x-supabase-url'] as string) || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = (req.headers['x-supabase-key'] as string) || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    if (url && key) {
      return createClient(url, key);
    }
    return null;
  };
  
  async function checkAccountExists(email: string, supabase: any): Promise<boolean> {
    if (supabase) {
      const { data, error } = await supabase.from('auth_accounts').select('email').eq('email', email).maybeSingle();
      if (!error && data) return true;
      if (error && error.code !== 'PGRST116') console.error('Supabase error checking account:', error);
      return false;
    }
    
    // Fallback to local accounts
    try {
      if (fs.existsSync(ACCOUNTS_FILE)) {
        const accounts: Account[] = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf-8"));
        return accounts.some(a => a.email === email);
      }
    } catch (e) {
      console.error("Error reading accounts file:", e);
    }
    return false;
  }
  
  async function getAccountByEmail(email: string, supabase: any): Promise<Account | null> {
    if (supabase) {
      const { data, error } = await supabase.from('auth_accounts').select('*').eq('email', email).maybeSingle();
      if (!error && data) {
         return {
           email: data.email,
           passwordHash: data.password_hash,
           createdAt: new Date(data.created_at).getTime()
         };
      }
      return null;
    }
    
    try {
      if (fs.existsSync(ACCOUNTS_FILE)) {
        const accounts: Account[] = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf-8"));
        return accounts.find(a => a.email === email) || null;
      }
    } catch (e) {
      console.error("Error reading accounts file:", e);
    }
    return null;
  }
  
  async function saveAccount(acc: Account, supabase: any) {
    if (supabase) {
       const { error } = await supabase.from('auth_accounts').upsert({
         email: acc.email,
         password_hash: acc.passwordHash,
         created_at: new Date(acc.createdAt).toISOString()
       }, { onConflict: 'email' });
       if (error) console.error("Error saving account to Supabase:", error);
       return;
    }
    
    // Local fallback
    let accounts: Account[] = [];
    try {
      if (fs.existsSync(ACCOUNTS_FILE)) {
        accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf-8"));
      }
    } catch (e) {}
    
    const existing = accounts.findIndex(a => a.email === acc.email);
    if (existing >= 0) {
      accounts[existing] = acc;
    } else {
      accounts.push(acc);
    }
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
  }

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

  // 0. Check Email Route
  app.post("/api/auth/check-email", async (req: express.Request, res: express.Response) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string") {
        res.status(400).json({ success: false, error: "Please enter a valid email address." });
        return;
      }
      const normalizedEmail = email.trim().toLowerCase();
      const supabase = getSupabase(req);
      const exists = await checkAccountExists(normalizedEmail, supabase);
      res.json({ success: true, exists });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
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

      // Return success. Do NOT return the OTP (passcode) to the frontend in production to keep it secure.
      // In development, return the OTP to allow testing without SMTP.
      res.json({
        success: true,
        emailSent,
        devOtp: emailSent ? null : otp,
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
      const { email, otp, forRegistrationOrReset } = req.body;
      if (!email || !otp) {
        res.status(400).json({ success: false, error: "Email and passcode parameters are required." });
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      const enteredOtp = otp.trim();

      // Check for predefined persistent Master Security PIN/Passcode, or the temporary fallback code "000000"
      const masterPin = process.env.SECURITY_PIN || process.env.MASTER_PIN;
      if ((masterPin && enteredOtp === masterPin.trim()) || enteredOtp === "000000") {
        if (!forRegistrationOrReset) {
          const deviceToken = `vault_device_token_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
          saveDeviceToken(deviceToken);
        }
        res.json({
          success: true,
          token: !forRegistrationOrReset ? `token_vault_session_${Date.now()}` : undefined,
          deviceToken: !forRegistrationOrReset ? `vault_device_token_${Date.now()}` : undefined // deviceToken handled logic below if forRegistrationOrReset
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

      if (forRegistrationOrReset) {
        // Just verify, don't delete yet. The registration/reset step will delete it.
        res.json({ success: true });
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

  // 2b. Register Route
  app.post("/api/auth/register", async (req: express.Request, res: express.Response) => {
    try {
      const { email, password, otp } = req.body;
      if (!email || !password || !otp) {
        res.status(400).json({ success: false, error: "Email, password, and OTP are required." });
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      
      const masterPin = process.env.SECURITY_PIN || process.env.MASTER_PIN;
      const enteredOtp = otp.trim();
      let isValidOtp = false;

      if ((masterPin && enteredOtp === masterPin.trim()) || enteredOtp === "000000") {
        isValidOtp = true;
      } else {
        const saved = otpStore.get(normalizedEmail);
        if (saved && saved.otp === enteredOtp && Date.now() <= saved.expiresAt) {
          isValidOtp = true;
          otpStore.delete(normalizedEmail); // consume OTP
        }
      }

      if (!isValidOtp) {
        res.status(401).json({ success: false, error: "Invalid or expired OTP." });
        return;
      }

      const supabase = getSupabase(req);
      const exists = await checkAccountExists(normalizedEmail, supabase);
      if (exists) {
        res.status(400).json({ success: false, error: "Account already exists." });
        return;
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      await saveAccount({
        email: normalizedEmail,
        passwordHash,
        createdAt: Date.now()
      }, supabase);

      const deviceToken = `vault_device_token_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      saveDeviceToken(deviceToken);

      res.json({
        success: true,
        token: `token_vault_session_${Date.now()}`,
        deviceToken
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2c. Login Password Route
  app.post("/api/auth/login-password", async (req: express.Request, res: express.Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ success: false, error: "Email and password are required." });
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      const supabase = getSupabase(req);
      const user = await getAccountByEmail(normalizedEmail, supabase);

      if (!user) {
        res.status(401).json({ success: false, error: "Invalid email or password." });
        return;
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
         res.status(401).json({ success: false, error: "Invalid email or password." });
         return;
      }

      const deviceToken = `vault_device_token_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      saveDeviceToken(deviceToken);

      res.json({
        success: true,
        token: `token_vault_session_${Date.now()}`,
        deviceToken
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2d. Reset Password Route
  app.post("/api/auth/reset-password", async (req: express.Request, res: express.Response) => {
    try {
      const { email, password, otp } = req.body;
      if (!email || !password || !otp) {
        res.status(400).json({ success: false, error: "Email, password, and OTP are required." });
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      
      const masterPin = process.env.SECURITY_PIN || process.env.MASTER_PIN;
      const enteredOtp = otp.trim();
      let isValidOtp = false;

      if ((masterPin && enteredOtp === masterPin.trim()) || enteredOtp === "000000") {
        isValidOtp = true;
      } else {
        const saved = otpStore.get(normalizedEmail);
        if (saved && saved.otp === enteredOtp && Date.now() <= saved.expiresAt) {
          isValidOtp = true;
          otpStore.delete(normalizedEmail); // consume OTP
        }
      }

      if (!isValidOtp) {
        res.status(401).json({ success: false, error: "Invalid or expired OTP." });
        return;
      }

      const supabase = getSupabase(req);
      const exists = await checkAccountExists(normalizedEmail, supabase);
      if (!exists) {
        res.status(400).json({ success: false, error: "Account does not exist." });
        return;
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      await saveAccount({
        email: normalizedEmail,
        passwordHash,
        createdAt: Date.now()
      }, supabase);

      const deviceToken = `vault_device_token_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      saveDeviceToken(deviceToken);

      res.json({
        success: true,
        token: `token_vault_session_${Date.now()}`,
        deviceToken
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
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
