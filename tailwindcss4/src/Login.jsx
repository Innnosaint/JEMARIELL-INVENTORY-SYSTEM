import './App.css'; 
import React, { useState, useEffect } from 'react';
import { X, ArrowLeft } from 'lucide-react'; 
import { useNavigate } from 'react-router-dom';
import axios from 'axios'; // Pinalitan natin ang socket ng axios para sa login

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(''); // Bagong state para sa error message
  
  // --- FORGOT PASSWORD STATE ---
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [resetEmail, setResetEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');

  // --- SLIDESHOW LOGIC ---
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = [
    { id: 1, image: 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?q=80&w=2070&auto=format&fit=crop', title: 'Building Your Projects,', subtitle: 'Brick by Brick.' },
    { id: 2, image: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?q=80&w=2070&auto=format&fit=crop', title: 'Quality Tools For', subtitle: 'Quality Results.' },
    { id: 3, image: 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?q=80&w=2070&auto=format&fit=crop', title: 'Safety First,', subtitle: 'Always.' }
  ];

  useEffect(() => {
    // Slideshow Timer lang ang naiwan dito, tinanggal na natin ang socket listeners
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [slides.length]);

  // --- [NEW] SECURE LOGIN LOGIC ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError(''); // I-reset ang error bago mag-try ulit

    try {
      // Kinakausap na natin ang bagong Python API endpoint
      const res = await axios.post('http://localhost:5000/api/login', { 
        email: email, 
        password: password 
      });

 if (res.data.success) {
        // I-save ang user credentials sa browser storage
        sessionStorage.setItem('user', JSON.stringify(res.data.user));
        console.log("Login successful:", res.data.user);
        
        // Ito ang ipapalit natin para i-force refresh ang page papunta sa dashboard!
        window.location.href = '/'; 
      }
    } catch (err) {
      // Ipapakita sa screen ang error galing sa Python (hal. "Inactive account" o "Maling password")
      setLoginError(err.response?.data?.message || "Connection failed to server.");
    }
  };

  // --- FORGOT PASSWORD HANDLERS ---
  const handleForgotClick = (e) => {
    e.preventDefault();
    setForgotStep(1); 
    setResetEmail('');
    setOtp('');
    setNewPass('');
    setShowForgot(true);
  };

  const handleStep1Submit = async (e) => {
    e.preventDefault();
    if(!resetEmail) return alert("Please enter your email.");
    
    try {
      // Iche-check natin sa database kung totoo ang email
      const res = await axios.post('http://127.0.0.1:5000/api/verify-email', { email: resetEmail });
      
      if (res.data.success) {
        // KUNWARI NAG-SEND NG EMAIL (Simulation Alert)
        alert(`[SYSTEM MESSAGE - SIMULATION]\n\nEmail Sent to: ${resetEmail}\n\nSubject: Reset Your Password\nMessage: Your Jemariell Verification Code is: 1234`);
        setForgotStep(2);
      }
    } catch (err) {
       alert(err.response?.data?.message || "Server Error. Hindi mahanap ang email.");
    }
  };

  const handleStep2Submit = (e) => {
    e.preventDefault();
    if(otp !== '1234') return alert("Invalid code. (Hint: Use 1234)");
    setForgotStep(3);
  };

  const handleStep3Submit = async (e) => {
    e.preventDefault();
    if(newPass !== confirmPass) return alert("Passwords do not match.");
    if(!newPass) return alert("Enter a new password.");
    
    try {
      // I-uupdate na natin sa mismong database!
      const res = await axios.post('http://127.0.0.1:5000/api/reset-password', { 
        email: resetEmail, 
        password: newPass 
      });
      
      if (res.data.success) {
        alert("Success! Password has been changed. You can now log in.");
        setShowForgot(false);
      }
    } catch (err) {
       alert("Failed to reset password. Connection Error.");
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        
        {/* LEFT SIDE: SLIDESHOW */}
        <div className="login-image-section">
          {slides.map((slide, index) => (
            <div 
              key={slide.id} 
              className={`slide-bg ${index === currentSlide ? 'active' : ''}`} 
              style={{ backgroundImage: `url(${slide.image})` }} 
            />
          ))}
          <div className="image-overlay"></div>
          <div className="login-brand">
            <div className="logo-icon">J</div>
            <div className="brand-text"><h1>JEMARIELL</h1><span>General Merchandising</span></div>
          </div>
          <div className="image-content-wrapper">
             {slides.map((slide, index) => (
               <div key={slide.id} className={`slide-text ${index === currentSlide ? 'active' : ''}`}>
                 <h2>{slide.title}</h2><h2>{slide.subtitle}</h2>
               </div>
             ))}
             <div className="slide-indicators">
               {slides.map((_, index) => (
                 <span key={index} className={`indicator ${index === currentSlide ? 'active' : ''}`} onClick={() => setCurrentSlide(index)}/>
               ))}
             </div>
          </div>
        </div>

        {/* RIGHT SIDE: LOGIN FORM */}
        <div className="login-form-section">
          <div className="form-wrapper">
            <h2 className="form-title">Welcome Back</h2>
            <p className="form-subtitle">Please enter your details to sign in.</p>

            <form onSubmit={handleLogin}>
              <div className="login-form-group">
                <label htmlFor="email">Email</label>
                <input 
                  type="email" 
                  className="login-input" 
                  placeholder="name@example.com" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="login-form-group">
                <div className="label-row">
                  <label htmlFor="password">Password</label>
                  <button onClick={handleForgotClick} className="forgot-link" type="button" style={{background:'none', border:'none', cursor:'pointer'}}>Forgot password?</button>
                </div>
                <input 
                  type="password" 
                  className="login-input" 
                  placeholder="••••••••" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {/* Dito lalabas ang error message kung mali ang password o inactive ang account */}
              {loginError && (
                <div style={{color: '#ef4444', fontSize: '0.875rem', marginBottom: '15px', fontWeight: '500'}}>
                  {loginError}
                </div>
              )}

              <button type="submit" className="btn-login">Log In</button>
            </form>
          </div>
        </div>

      </div>

      {/* --- FORGOT PASSWORD MODAL --- */}
      {showForgot && (
        <div className="modal-overlay">
          <div className="modal-content forgot-modal">
            <div className="modal-header">
              <div style={{display:'flex', alignItems:'center', gap: 10}}>
                {forgotStep > 1 && (
                  <button onClick={() => setForgotStep(s => s - 1)} className="icon-btn" style={{border:'none', background:'none', cursor:'pointer'}}>
                    <ArrowLeft size={20} color="#334155"/>
                  </button>
                )}
                <h3 style={{margin:0, color:'#0f172a'}}>
                  {forgotStep === 1 && "Reset Password"}
                  {forgotStep === 2 && "Verification"}
                  {forgotStep === 3 && "New Password"}
                </h3>
              </div>
              <button onClick={() => setShowForgot(false)} className="close-btn"><X size={20}/></button>
            </div>

            <div style={{padding: '20px'}}>
                {forgotStep === 1 && (
                <form onSubmit={handleStep1Submit}>
                    <p style={{color:'#64748b', fontSize:'0.9rem', marginBottom:'20px'}}>Enter email for code.</p>
                    <div className="form-group">
                    <label>Email Address</label>
                    <input type="email" className="styled-input" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required />
                    </div>
                    <div className="modal-footer-custom">
                    <button type="submit" className="btn-save" style={{background: '#ea580c'}}>Send Code</button>
                    </div>
                </form>
                )}

                {forgotStep === 2 && (
                <form onSubmit={handleStep2Submit}>
                    <p style={{color:'#64748b', fontSize:'0.9rem', marginBottom:'20px'}}>Code sent to <strong>{resetEmail}</strong>.</p>
                    <div className="form-group">
                    <label>Verification Code</label>
                    <input type="text" className="styled-input" placeholder="1234" value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={4} required />
                    </div>
                    <button type="submit" className="btn-save" style={{width:'100%', background: '#ea580c'}}>Verify</button>
                </form>
                )}

                {forgotStep === 3 && (
                <form onSubmit={handleStep3Submit}>
                    <div className="form-group">
                    <label>New Password</label>
                    <input type="password" style={{marginBottom: '10px'}} className="styled-input" value={newPass} onChange={(e) => setNewPass(e.target.value)} required />
                    <label>Confirm Password</label>
                    <input type="password" className="styled-input" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} required />
                    </div>
                    <button type="submit" className="btn-save" style={{width:'100%', marginTop: '20px', background: '#ea580c'}}>Reset Password</button>
                </form>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;