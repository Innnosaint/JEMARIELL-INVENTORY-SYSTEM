import './App.css'; 
import React, { useState, useEffect } from 'react';
import { X, ArrowLeft, Eye, EyeOff, Shield, CheckCircle } from 'lucide-react'; 
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// ─────────────────────────────────────────────────────────────
// LOGIN COMPONENT — Auth framework + Proper Forgot-Password flow
// Forgot password uses backend: /api/verify-email → /api/send-otp → /api/reset-password
// ─────────────────────────────────────────────────────────────

const Login = ({ setUser }) => {
  const navigate = useNavigate();

  // ── Login state ──
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // ── Forgot password state ──
  const [showForgot, setShowForgot]     = useState(false);
  const [forgotStep, setForgotStep]     = useState(1);   // 1=email, 2=OTP, 3=new password
  const [resetEmail, setResetEmail]     = useState('');
  const [enteredOtp, setEnteredOtp]     = useState('');
  const [newPass, setNewPass]           = useState('');
  const [confirmPass, setConfirmPass]   = useState('');
  const [showNewPass, setShowNewPass]   = useState(false);
  const [forgotError, setForgotError]   = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [otpToken, setOtpToken]         = useState(''); // server-side OTP session token
  const [resetToken, setResetToken]     = useState(''); // token granted after OTP verified

  // ── Slideshow ──
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = [
    { id: 1, image: 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?q=80&w=2070&auto=format&fit=crop', title: 'Building Your Projects,', subtitle: 'Brick by Brick.' },
    { id: 2, image: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?q=80&w=2070&auto=format&fit=crop', title: 'Quality Tools For',       subtitle: 'Quality Results.' },
    { id: 3, image: 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?q=80&w=2070&auto=format&fit=crop', title: 'Safety First,',            subtitle: 'Always.' }
  ];

  useEffect(() => {
    const t = setInterval(() => setCurrentSlide(p => (p + 1) % slides.length), 4000);
    return () => clearInterval(t);
  }, [slides.length]);

  // ── Helpers ──
  const apiError = (err, fallback) => {
    if (err.response) {
      return err.response.data?.message || fallback;
    }
    if (err.code === 'ECONNABORTED') return 'Connection timed out. Please try again.';
    return 'Cannot connect to server. Make sure the application is running.';
  };

  // ─────────────────────────────────────────────────────────────
  // LOGIN HANDLER — stores JWT token when backend provides one
  // ─────────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    try {
      const res = await axios.post('http://127.0.0.1:5000/api/login', { email, password });

      if (res.data.success) {
        const user  = res.data.user;
        const token = res.data.token; // JWT token if backend sends one

        if (!user?.admin_user || !user?.email) {
          setLoginError('Your account information is incomplete. Please contact your administrator.');
          return;
        }
        if (user.status && user.status !== 'Active') {
          setLoginError('Your account has been deactivated. Please contact your administrator.');
          return;
        }

        const sessionData = {
          admin_id:   user.admin_id,
          admin_user: user.admin_user,
          email:      user.email,
          role:       user.role,
          status:     user.status || 'Active',
          ...(token ? { token } : {})
        };

        // Store in both so app survives page refresh
        localStorage.setItem('currentUser', JSON.stringify(sessionData));
        sessionStorage.setItem('user', JSON.stringify(sessionData));

        // If backend sends JWT, store separately for Authorization header use
        if (token) {
          localStorage.setItem('authToken', token);
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }

        if (setUser) setUser(sessionData);
        navigate('/', { replace: true });
      }
    } catch (err) {
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        setLoginError(err.response.data?.message || 'Invalid email or password.');
      } else if (status === 404) {
        setLoginError('Account not found. Please check your email.');
      } else if (status === 500) {
        setLoginError('Server error. Please try again or contact support.');
      } else {
        setLoginError(apiError(err, 'Login failed. Please try again.'));
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // FORGOT PASSWORD — Step 1: Verify email & send OTP via backend
  // Backend: POST /api/send-otp { email }
  // Returns: { success, otp_token, message }
  // ─────────────────────────────────────────────────────────────
  // Track whether we're in dev mode (email not configured)
  const [devMode, setDevMode] = useState(false);

  const handleStep1Submit = async (e) => {
    e.preventDefault();
    setForgotError('');
    if (!resetEmail) return setForgotError('Please enter your email address.');
    setForgotLoading(true);

    try {
      const res = await axios.post('http://127.0.0.1:5000/api/send-otp', { email: resetEmail });

      if (res.data.success) {
        setOtpToken(res.data.otp_token || '');
        // Detect dev mode: email not configured, OTP printed to Flask terminal
        const isDevMode = res.data.message && res.data.message.toLowerCase().includes('terminal');
        setDevMode(isDevMode);
        setForgotStep(2);
      } else {
        setForgotError(res.data.message || 'Failed to send OTP. Please try again.');
      }
    } catch (err) {
      const status = err.response?.status;
      if (status === 404) {
        setForgotError('No account found with that email address.');
      } else {
        setForgotError(apiError(err, 'Server error. Please try again.'));
      }
    } finally {
      setForgotLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // FORGOT PASSWORD — Step 2: Verify OTP
  // Backend: POST /api/verify-otp { otp_token, otp_code }
  // Returns: { success, reset_token }
  // ─────────────────────────────────────────────────────────────
  const handleStep2Submit = async (e) => {
    e.preventDefault();
    setForgotError('');
    if (!enteredOtp || enteredOtp.length !== 6) return setForgotError('Please enter the 6-digit code.');
    setForgotLoading(true);

    try {
      const res = await axios.post('http://127.0.0.1:5000/api/verify-otp', {
        otp_token: otpToken,
        otp_code:  enteredOtp
      });
      if (res.data.success) {
        setResetToken(res.data.reset_token || '');
        setForgotStep(3);
      } else {
        setForgotError(res.data.message || 'Invalid or expired code. Please try again.');
      }
    } catch (err) {
      setForgotError(apiError(err, 'Verification failed. Please try again.'));
    } finally {
      setForgotLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // FORGOT PASSWORD — Step 3: Set new password
  // Backend endpoint: POST /api/reset-password  { email, password, reset_token }
  // ─────────────────────────────────────────────────────────────
  const handleStep3Submit = async (e) => {
    e.preventDefault();
    setForgotError('');
    if (!newPass)              return setForgotError('Please enter a new password.');
    if (newPass.length < 6)    return setForgotError('Password must be at least 6 characters.');
    if (newPass !== confirmPass) return setForgotError('Passwords do not match.');
    setForgotLoading(true);

    try {
      const res = await axios.post('http://127.0.0.1:5000/api/reset-password', {
        email:       resetEmail,
        password:    newPass,
        reset_token: resetToken  // server validates this token before allowing reset
      });
      if (res.data.success) {
        setForgotStep(4); // success screen
      } else {
        setForgotError(res.data.message || 'Failed to reset password.');
      }
    } catch (err) {
      setForgotError(apiError(err, 'Failed to reset password. Please try again.'));
    } finally {
      setForgotLoading(false);
    }
  };

  const openForgot = (e) => {
    e.preventDefault();
    setForgotStep(1); setResetEmail(''); setEnteredOtp(''); setOtpToken('');
    setResetToken(''); setNewPass(''); setConfirmPass(''); setForgotError('');
    setDevMode(false);
    setShowForgot(true);
  };

  const closeForgot = () => { setShowForgot(false); setDevMode(false); };

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  const inputStyle = {
    width: '100%', padding: '11px 14px', borderRadius: '8px',
    border: '1px solid #e2e8f0', fontSize: '0.95rem',
    outline: 'none', boxSizing: 'border-box'
  };

  return (
    <div className="login-page">
      <div className="login-container">

        {/* LEFT — Slideshow */}
        <div className="login-image-section">
          {slides.map((slide, i) => (
            <div key={slide.id} className={`slide-bg ${i === currentSlide ? 'active' : ''}`}
              style={{ backgroundImage: `url(${slide.image})` }} />
          ))}
          <div className="image-overlay" />
          <div className="login-brand">
            <div className="logo-icon">J</div>
            <div className="brand-text"><h1>JEMARIELL</h1><span>General Merchandising</span></div>
          </div>
          <div className="image-content-wrapper">
            {slides.map((slide, i) => (
              <div key={slide.id} className={`slide-text ${i === currentSlide ? 'active' : ''}`}>
                <h2>{slide.title}</h2><h2>{slide.subtitle}</h2>
              </div>
            ))}
            <div className="slide-indicators">
              {slides.map((_, i) => (
                <span key={i} className={`indicator ${i === currentSlide ? 'active' : ''}`}
                  onClick={() => setCurrentSlide(i)} />
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — Login Form */}
        <div className="login-form-section">
          <div className="form-wrapper">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <Shield size={22} color="#2563eb" />
              <h2 className="form-title" style={{ margin: 0 }}>Welcome Back</h2>
            </div>
            <p className="form-subtitle">Please enter your credentials to sign in.</p>

            <form onSubmit={handleLogin}>
              <div className="login-form-group">
                <label>Email</label>
                <input type="email" className="login-input" placeholder="name@example.com"
                  value={email} onChange={e => setEmail(e.target.value)} required />
              </div>

              <div className="login-form-group">
                <div className="label-row">
                  <label>Password</label>
                  <button onClick={openForgot} className="forgot-link" type="button"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', fontSize: '0.85rem' }}>
                    Forgot password?
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input type={showPassword ? 'text' : 'password'} className="login-input"
                    placeholder="••••••••" value={password}
                    onChange={e => setPassword(e.target.value)} required
                    style={{ paddingRight: 42 }} />
                  <button type="button" onClick={() => setShowPassword(p => !p)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {loginError && (
                <div style={{ color: '#ef4444', fontSize: '0.875rem', marginBottom: 15, fontWeight: 500,
                  background: '#fef2f2', padding: '10px 12px', borderRadius: 6, border: '1px solid #fecaca' }}>
                  ⚠️ {loginError}
                </div>
              )}

              <button type="submit" className="btn-login" disabled={isLoggingIn}
                style={{ opacity: isLoggingIn ? 0.7 : 1 }}>
                {isLoggingIn ? '⏳ Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* ── FORGOT PASSWORD MODAL ── */}
      {showForgot && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeForgot(); }}>
          <div className="modal-content forgot-modal" style={{ maxWidth: 460, width: '94%' }}>

            {/* Header */}
            <div className="modal-header" style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {forgotStep > 1 && forgotStep < 4 && (
                  <button onClick={() => { setForgotStep(s => s - 1); setForgotError(''); }}
                    style={{ border: 'none', background: '#f1f5f9', borderRadius: 6, cursor: 'pointer', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ArrowLeft size={18} color="#334155" />
                  </button>
                )}
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a' }}>
                    {forgotStep === 1 && 'Reset Password'}
                    {forgotStep === 2 && 'Enter Verification Code'}
                    {forgotStep === 3 && 'Set New Password'}
                    {forgotStep === 4 && 'Password Reset!'}
                  </h3>
                  {/* Step indicator */}
                  {forgotStep < 4 && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                      {[1,2,3].map(s => (
                        <div key={s} style={{ height: 3, width: 36, borderRadius: 2,
                          background: s <= forgotStep ? '#2563eb' : '#e2e8f0',
                          transition: 'background 0.3s' }} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <button onClick={closeForgot}
                style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} color="#475569" />
              </button>
            </div>

            <div style={{ padding: '24px' }}>

              {/* Error banner */}
              {forgotError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 18, color: '#b91c1c', fontSize: '0.875rem' }}>
                  ⚠️ {forgotError}
                </div>
              )}

              {/* STEP 1 — Enter email */}
              {forgotStep === 1 && (
                <form onSubmit={handleStep1Submit}>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: 20, marginTop: 0 }}>
                    Enter your registered email address and we'll send you a 6-digit verification code.
                  </p>
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Email Address</label>
                    <input type="email" style={inputStyle} value={resetEmail}
                      onChange={e => setResetEmail(e.target.value)} placeholder="name@example.com" required autoFocus />
                  </div>
                  <button type="submit" disabled={forgotLoading}
                    style={{ width: '100%', padding: '12px', background: '#ea580c', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.95rem', cursor: forgotLoading ? 'not-allowed' : 'pointer', opacity: forgotLoading ? 0.7 : 1 }}>
                    {forgotLoading ? '⏳ Sending code...' : '📧 Send Verification Code'}
                  </button>
                </form>
              )}

              {/* STEP 2 — Enter OTP */}
              {forgotStep === 2 && (
                <form onSubmit={handleStep2Submit}>
                  {/* Dev mode banner — shown when email is not yet configured */}
                  {devMode && (
                    <div style={{
                      background: '#fefce8', border: '1px solid #fde047', borderRadius: 8,
                      padding: '12px 14px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-start'
                    }}>
                      <span style={{ fontSize: '1.1rem' }}>🛠️</span>
                      <div>
                        <div style={{ fontWeight: 700, color: '#854d0e', fontSize: '0.85rem', marginBottom: 2 }}>
                          Dev Mode — Email Not Configured
                        </div>
                        <div style={{ color: '#713f12', fontSize: '0.8rem', lineHeight: 1.5 }}>
                          The OTP was <strong>not emailed</strong>. Check your{' '}
                          <strong>Flask terminal / console</strong> for a line that says:
                          <br />
                          <code style={{ background: '#fef9c3', padding: '1px 5px', borderRadius: 4, fontFamily: 'monospace' }}>
                            [DEV MODE] OTP for {resetEmail}: xxxxxx
                          </code>
                        </div>
                      </div>
                    </div>
                  )}
                  <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: 6, marginTop: 0 }}>
                    {devMode ? 'Enter the OTP from your Flask terminal:' : 'A 6-digit code was sent to:'}
                  </p>
                  <p style={{ fontWeight: 700, color: '#0f172a', marginBottom: 20, marginTop: 0 }}>{resetEmail}</p>
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Verification Code</label>
                    <input type="text" inputMode="numeric" maxLength={6} style={{ ...inputStyle, letterSpacing: '0.4em', fontSize: '1.4rem', textAlign: 'center', fontWeight: 700 }}
                      value={enteredOtp} onChange={e => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000" required autoFocus />
                  </div>
                  <button type="submit" disabled={forgotLoading}
                    style={{ width: '100%', padding: '12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.95rem', cursor: forgotLoading ? 'not-allowed' : 'pointer', opacity: forgotLoading ? 0.7 : 1 }}>
                    {forgotLoading ? '⏳ Verifying...' : 'Verify Code →'}
                  </button>
                  <button type="button" onClick={() => { setForgotStep(1); setForgotError(''); }}
                    style={{ width: '100%', marginTop: 10, padding: '10px', background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 8, fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
                    Resend Code
                  </button>
                </form>
              )}

              {/* STEP 3 — New password */}
              {forgotStep === 3 && (
                <form onSubmit={handleStep3Submit}>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: 20, marginTop: 0 }}>
                    Create a strong new password for your account.
                  </p>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>New Password</label>
                    <div style={{ position: 'relative' }}>
                      <input type={showNewPass ? 'text' : 'password'} style={{ ...inputStyle, paddingRight: 42 }}
                        value={newPass} onChange={e => setNewPass(e.target.value)}
                        placeholder="At least 6 characters" required autoFocus />
                      <button type="button" onClick={() => setShowNewPass(p => !p)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                        {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {/* Strength indicator */}
                    {newPass.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                        {[1,2,3,4].map(i => (
                          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2,
                            background: newPass.length >= i * 2 ? (newPass.length >= 8 ? '#10b981' : '#f59e0b') : '#e2e8f0' }} />
                        ))}
                        <span style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap', marginLeft: 6 }}>
                          {newPass.length < 6 ? 'Too short' : newPass.length < 8 ? 'Fair' : 'Strong'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Confirm Password</label>
                    <input type="password" style={{ ...inputStyle, borderColor: confirmPass && confirmPass !== newPass ? '#ef4444' : '#e2e8f0' }}
                      value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
                      placeholder="Re-enter password" required />
                    {confirmPass && confirmPass !== newPass && (
                      <p style={{ color: '#ef4444', fontSize: '0.8rem', margin: '4px 0 0 0' }}>Passwords do not match</p>
                    )}
                  </div>
                  <button type="submit" disabled={forgotLoading}
                    style={{ width: '100%', padding: '12px', background: '#10b981', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.95rem', cursor: forgotLoading ? 'not-allowed' : 'pointer', opacity: forgotLoading ? 0.7 : 1 }}>
                    {forgotLoading ? '⏳ Resetting...' : '🔒 Reset Password'}
                  </button>
                </form>
              )}

              {/* STEP 4 — Success */}
              {forgotStep === 4 && (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <CheckCircle size={56} color="#10b981" style={{ marginBottom: 16 }} />
                  <h3 style={{ color: '#0f172a', margin: '0 0 8px 0' }}>Password Reset Successfully!</h3>
                  <p style={{ color: '#64748b', marginBottom: 24, fontSize: '0.9rem' }}>
                    You can now sign in with your new password.
                  </p>
                  <button onClick={closeForgot}
                    style={{ padding: '12px 32px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>
                    Back to Sign In
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;