import { useState, useEffect } from 'react';
import axios from 'axios';
import { FiCalendar, FiMessageCircle, FiMic, FiCheck, FiX, FiMenu, FiLogOut, FiArrowRight, FiGlobe, FiShield, FiUser, FiClock, FiMail, FiPhone, FiLock } from 'react-icons/fi';
import { FaWhatsapp, FaGoogle, FaShieldAlt, FaTwitter, FaLinkedin, FaGithub } from 'react-icons/fa';
import { Dialog, Transition } from '@headlessui/react';
import { Helmet } from 'react-helmet-async';

// API Base URL
const API_URL = import.meta.env.VITE_API_URL || 'https://preamble-sleet-protrude.ngrok-free.dev';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function App() {
  // State management
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [toast, setToast] = useState(null);
  const [calendarStatus, setCalendarStatus] = useState(null);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false); // 'connected', 'error', 'warning'
  const [showCalendarBanner, setShowCalendarBanner] = useState(false);

  // Form states
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    availability: [],
    sleepTime: { start: '', end: '' },
    calendarType: 'google_calendar',
    calendlyToken: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Karachi'
  });
  const [selectedDays, setSelectedDays] = useState([]);

  // Check login status and URL params on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsLoggedIn(true);
    }

    // Check URL params for calendar connection status
    const params = new URLSearchParams(window.location.search);
    const calendarParam = params.get('calendar');
    if (calendarParam) {
      if (calendarParam === 'connected') {
        setCalendarStatus('connected');
      } else if (calendarParam === 'error') {
        setCalendarStatus('error');
      } else if (calendarParam === 'warning') {
        setCalendarStatus('warning');
      }
      // Clean up URL params
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Show toast notification
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Handle login
  const handleLogin = async (e) => {
    e.preventDefault();
    
    // High-level Validation
    if (!loginForm.email || !loginForm.password) {
      return showToast('Please fill in all fields', 'error');
    }

    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(loginForm.email)) {
      return showToast('Please enter a valid email address', 'error');
    }

    try {
      const { data } = await api.post('/api/auth/login', loginForm);
      if (data.success) {
        localStorage.setItem('token', data.token);
        setIsLoggedIn(true);
        setLoginModalOpen(false);
        showToast('Login successful! Welcome back.');
        setLoginForm({ email: '', password: '' });
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Login failed', 'error');
    }
  };

  // Handle register
  const handleRegister = async (e) => {
    e.preventDefault();

    // High-level Validation
    const { name, email, phone, password } = registerForm;
    
    if (!name || !email || !phone || !password) {
      return showToast('Please fill in all required fields', 'error');
    }

    if (name.length < 2) {
      return showToast('Name must be at least 2 characters long', 'error');
    }

    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return showToast('Please enter a valid email address', 'error');
    }

    if (password.length < 6) {
      return showToast('Password must be at least 6 characters long', 'error');
    }

    if (phone.length < 10) {
      return showToast('Please enter a valid phone number', 'error');
    }

    if (selectedDays.length === 0) {
      return showToast('Please select at least one day of availability', 'error');
    }

    try {
      const payload = {
        name: registerForm.name,
        email: registerForm.email,
        phone: registerForm.phone,
        password: registerForm.password,
        sleepTime: registerForm.sleepTime,
        calendarType: registerForm.calendarType,
        calendlyToken: registerForm.calendlyToken,
        timezone: registerForm.timezone,
        availability: selectedDays.map(day => ({
          day,
          startTime: '09:00',
          endTime: '17:00'
        }))
      };
      const { data } = await api.post('/api/auth/register', payload);
      if (data.success) {
        localStorage.setItem('token', data.token);
        setIsLoggedIn(true);
        setRegisterModalOpen(false);
        showToast('Registration successful! Check your WhatsApp for next steps.');

        // Show calendar connect banner for Google Calendar users
        if (registerForm.calendarType === 'google_calendar') {
          setShowCalendarBanner(true);
        }

        setRegisterForm({
          name: '',
          email: '',
          phone: '',
          password: '',
          availability: [],
          sleepTime: { start: '', end: '' },
          calendarType: 'google_calendar',
          calendlyToken: '',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Karachi'
        });
        setSelectedDays([]);
      }    } catch (error) {
      showToast(error.response?.data?.message || 'Registration failed', 'error');
    }
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    showToast('Logged out successfully');
  };

  // Toggle day selection
  const toggleDay = (day) => {
    setSelectedDays(prev => {
      const newDays = prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day];

      setRegisterForm(prev => ({
        ...prev,
        availability: newDays
      }));
      return newDays;
    });
  };

  const handlePlanSelection = (planName, amount) => {
    if (!isLoggedIn) {
      setRegisterModalOpen(true);
    } else {
      setSelectedPlan({ name: planName, amount, number: '0312-3456789' });
      setPaymentModalOpen(true);
    }
  };

  // Handle Google Calendar connect
  const handleGoogleConnect = () => {
    const token = localStorage.getItem('token');
    if (!token) {
      showToast('Please login first to connect Google Calendar', 'error');
      setLoginModalOpen(true);
      return;
    }
    window.location.href = `${API_URL}/api/auth/google?token=${token}`;
  };

  return (
    <div className="min-h-screen bg-gray-50" >
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-lg shadow-lg transform transition-all duration-300 ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          } text-white`} style={{ padding: '0.75rem 1.5rem' }}>
          {toast.type === 'success' ?
            <FiCheck className="inline" style={{ marginRight: '0.5rem' }} /> :
            <FiX className="inline" style={{ marginRight: '0.5rem' }} />}
          {toast.message}
        </div>
      )}

      {/* Calendar Connect Banner (shown after registration for Google Calendar users) */}
      {showCalendarBanner && (
        <div className="fixed top-0 left-0 right-0 z-40 bg-green-600 text-white shadow-lg">
          <div className="max-w-7xl" style={{ margin: '0 auto', padding: '1rem' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <FaGoogle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Almost there!</h3>
                  <p className="text-green-100 text-sm">Connect your Google Calendar to start receiving scheduled events</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleGoogleConnect}
                  className="bg-white text-green-600 font-bold rounded-lg px-6 py-2 hover:bg-green-50 transition"
                >
                  Connect Google Calendar Now
                </button>
                <button
                  onClick={() => setShowCalendarBanner(false)}
                  className="text-green-200 hover:text-white"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navbar */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md shadow-sm z-40">
        <div className="max-w-7xl" style={{ margin: '0 auto', padding: '0 1rem' }}>
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <FiCalendar className="w-8 h-8 text-primary-600" />
              <span className="text-xl font-bold gradient-text">Scheduler</span>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#home" className="text-gray-700 hover:text-primary-600 transition">Home</a>
              <a href="#about" className="text-gray-700 hover:text-primary-600 transition">About</a>
              <a href="#services" className="text-gray-700 hover:text-primary-600 transition">Services</a>
              <a href="#pricing" className="text-gray-700 hover:text-primary-600 transition">Pricing</a>
            </div>

            {/* Auth Buttons */}
            <div className="hidden md:flex items-center space-x-4">
              {isLoggedIn ? (
                <>
                  <span className="text-gray-700">Welcome!</span>
                  <button
                    onClick={handleLogout}
                    className="text-red-700 cursor-pointer hover:text-primary-600 transition"
                    style={{ padding: '0.5rem 1rem' }}
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setLoginModalOpen(true)}
                    className="text-gray-700 cursor-pointer hover:text-primary-600 transition"
                    style={{ padding: '0.5rem 1rem' }}
                  >
                    Login
                  </button>
                  <button
                    onClick={() => setRegisterModalOpen(true)}
                    className="bg-primary-600 text-white cursor-pointer bg-black rounded-lg hover:bg-primary-700 transition"
                    style={{ padding: '0.5rem 1.5rem' }}
                  >
                    Get Started
                  </button>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-gray-700"
              style={{ padding: '0.5rem' }}
            >
              <FiMenu className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t">
            <div className="space-y-2" style={{ padding: '0.5rem 1rem' }}>
              <a href="#home" className="block text-gray-700" style={{ padding: '0.5rem 0' }}>Home</a>
              <a href="#about" className="block text-gray-700" style={{ padding: '0.5rem 0' }}>About</a>
              <a href="#services" className="block text-gray-700" style={{ padding: '0.5rem 0' }}>Services</a>
              <a href="#pricing" className="block text-gray-700" style={{ padding: '0.5rem 0' }}>Pricing</a>
              {isLoggedIn ? (
                <button
                  onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                  className="block cursor-pointer w-full text-left text-red-700"
                  style={{ padding: '0.5rem 0' }}
                >
                  Logout
                </button>
              ) : (
                <>
                  <button
                    onClick={() => { setLoginModalOpen(true); setMobileMenuOpen(false); }}
                    className="block w-full text-left cursor-pointer text-gray-700"
                    style={{ padding: '0.5rem 0' }}
                  >
                    Login
                  </button>
                  <button
                    onClick={() => { setRegisterModalOpen(true); setMobileMenuOpen(false); }}
                    className="block w-full bg-primary-600 text-white cursor-pointer rounded-lg"
                    style={{ padding: '0.5rem 0' }}
                  >
                    Get Started
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section id="home" className={`bg-linear-to-br from-primary-50 via-white to-primary-100 ${showCalendarBanner ? 'pt-32' : 'pt-24'}`} style={{ paddingBottom: '4rem' }}>
        <div className="max-w-7xl" style={{ margin: '0 auto', padding: '5rem 1rem' }}>
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold" style={{ marginBottom: '1.5rem' }}>
              <span className="gradient-text">Your Personal AI Scheduler</span>
              <br />
              <span className="text-gray-800">On WhatsApp</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl" style={{ marginBottom: '2rem', marginLeft: 'auto', marginRight: 'auto' }}>
              Just message your tasks and meetings. AI handles the rest.
              Automatically sync to your calendar.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {!isLoggedIn ? (
                <button
                  onClick={() => setRegisterModalOpen(true)}
                  className="bg-primary-600 text-white bg-black cursor-pointer rounded-xl text-lg font-semibold hover:bg-primary-700 transition shadow-lg hover:shadow-xl"
                  style={{ padding: '1rem 2rem' }}
                >
                  Get Started Free
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGoogleConnect}
                  className=" border-2 cursor-pointer border-red-500 text-red-500 rounded-xl font-semibold hover:bg-red-50 transition flex items-center justify-center space-x-2" style={{ padding: '0.75rem 0.75rem' }}
                >
                  <FaGoogle />
                  <span>Connect Google Calendar</span>
                </button>
              )}
              <a
                href="#about"
                className="bg-white text-primary-600 rounded-xl text-lg font-semibold border-2 border-primary-600 hover:bg-primary-50 transition" style={{ padding: '1rem 2rem' }}
              >
                Learn More
              </a>
            </div>
            <div className="flex items-center justify-center space-x-8 text-gray-500" style={{ marginTop: '3rem' }}>
              <div className="flex items-center space-x-2">
                <FaWhatsapp className="w-6 h-6 text-green-500" />
                <span>WhatsApp Integration</span>
              </div>
              <div className="flex items-center space-x-2">
                <FiMic className="w-6 h-6 text-blue-500" />
                <span>Voice Messages</span>
              </div>
              <div className="flex items-center space-x-2">
                <FaGoogle className="w-6 h-6 text-red-500" />
                <span>Google Calendar</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="bg-white" style={{ padding: '5rem 0' }}>
        <div className="max-w-7xl" style={{ margin: '0 auto', padding: '0 1rem' }}>
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold gradient-text" style={{ marginBottom: '1.5rem' }}>What is Scheduler?</h2>
              <p className="text-lg text-gray-600" style={{ marginBottom: '1rem' }}>
                Scheduler is your personal AI-powered scheduling assistant that works
                entirely through WhatsApp. No apps to download, no complex interfaces to learn.
              </p>
              <p className="text-lg text-gray-600" style={{ marginBottom: '1.5rem' }}>
                Simply send a message like <span className="font-semibold text-primary-600">
                  "Schedule meeting with Ali tomorrow at 3pm for 1 hour"</span> and our AI
                will parse it, create the event, and add it to your calendar automatically.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center space-x-3">
                  <FiCheck className="w-5 h-5 text-green-500" />
                  <span className="text-gray-700">Natural language processing</span>
                </li>
                <li className="flex items-center space-x-3">
                  <FiCheck className="w-5 h-5 text-green-500" />
                  <span className="text-gray-700">Voice message support</span>
                </li>
                <li className="flex items-center space-x-3">
                  <FiCheck className="w-5 h-5 text-green-500" />
                  <span className="text-gray-700">Google Calendar integration</span>
                </li>
                <li className="flex items-center space-x-3">
                  <FiCheck className="w-5 h-5 text-green-500" />
                  <span className="text-gray-700">Instant WhatsApp confirmations</span>
                </li>
              </ul>
            </div>
            <div className="bg-linear-to-br from-primary-100 to-primary-200 rounded-3xl flex items-center justify-center" style={{ padding: '2rem' }}>
              <div className="text-center">
                <FiMessageCircle className="w-32 h-32 text-primary-600" style={{ margin: '0 auto 1rem auto' }} />
                <p className="text-xl font-semibold text-primary-700">AI + WhatsApp = Productivity</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="bg-gray-50" style={{ padding: '5rem 0' }}>
        <div className="max-w-7xl" style={{ margin: '0 auto', padding: '0 1rem' }}>
          <div className="text-center" style={{ marginBottom: '4rem' }}>
            <h2 className="text-4xl font-bold gradient-text" style={{ marginBottom: '1rem' }}>Our Services</h2>
            <p className="text-xl text-gray-600">Everything you need to manage your schedule effortlessly</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {/* Service 1 */}
            <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition" style={{ padding: '2rem' }}>
              <div className="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center" style={{ marginBottom: '1.5rem' }}>
                <FaWhatsapp className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-2xl font-bold" style={{ marginBottom: '1rem' }}>WhatsApp Integration</h3>
              <p className="text-gray-600">
                Send tasks and meeting requests via text or voice messages on WhatsApp.
                Get instant confirmations and updates.
              </p>
            </div>
            {/* Service 2 */}
            <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition" style={{ padding: '2rem' }}>
              <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center" style={{ marginBottom: '1.5rem' }}>
                <FiMic className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="text-2xl font-bold" style={{ marginBottom: '1rem' }}>AI Parsing</h3>
              <p className="text-gray-600">
                Our AI understands natural language and extracts all the details from your
                messages to create structured calendar events.
              </p>
            </div>
            {/* Service 3 */}
            <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition" style={{ padding: '2rem' }}>
              <div className="w-16 h-16 bg-red-100 rounded-xl flex items-center justify-center" style={{ marginBottom: '1.5rem' }}>
                <FaGoogle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-2xl font-bold" style={{ marginBottom: '1rem' }}>Calendar Sync</h3>
              <p className="text-gray-600">
                Connect your Google Calendar account. Events are automatically
                created and synced in real-time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="bg-white" style={{ padding: '5rem 0' }}>
        <div className="max-w-7xl" style={{ margin: '0 auto', padding: '0 1rem' }}>
          <div className="text-center" style={{ marginBottom: '4rem' }}>
            <h2 className="text-4xl font-bold gradient-text" style={{ marginBottom: '1rem' }}>Simple Pricing</h2>
            <p className="text-xl text-gray-600">Choose the plan that works for you</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {/* Free Plan */}
            <div className="bg-gray-50 rounded-2xl border-2 border-gray-200" style={{ padding: '2rem' }}>
              <h3 className="text-2xl font-bold" style={{ marginBottom: '0.5rem' }}>Free</h3>
              <p className="text-gray-600" style={{ marginBottom: '1.5rem' }}>For getting started</p>
              <div className="text-4xl font-bold" style={{ marginBottom: '1.5rem' }}>$0<span className="text-lg text-gray-500 font-normal">/month</span></div>
              <ul className="space-y-3" style={{ marginBottom: '2rem' }}>
                <li className="flex items-center space-x-3">
                  <FiCheck className="w-5 h-5 text-green-500" />
                  <span>7 messages/day</span>
                </li>
                <li className="flex items-center space-x-3">
                  <FiCheck className="w-5 h-5 text-green-500" />
                  <span>Text messages only</span>
                </li>
                <li className="flex items-center space-x-3">
                  <FiCheck className="w-5 h-5 text-green-500" />
                  <span>10-min Correction Window</span>
                </li>
                <li className="flex items-center space-x-3 text-gray-400">
                  <FiX className="w-5 h-5" />
                  <span>Voice messages</span>
                </li>
              </ul>
              <button
                onClick={() => setRegisterModalOpen(true)}
                className="w-full border-2 cursor-pointer border-primary-600 text-primary-600 rounded-xl font-semibold hover:bg-primary-50 transition"
                style={{ padding: '0.75rem 0' }}
              >
                Get Started
              </button>
            </div>
            {/* Plus Plan */}
            <div className="bg-linear-to-br from-primary-600 to-primary-700 rounded-2xl text-white bg-black transform scale-105 shadow-2xl" style={{ padding: '2rem' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: '0.5rem' }}>
                <h3 className="text-2xl font-bold">Plus</h3>
                <span className="bg-white/20 rounded-full text-sm font-semibold" style={{ padding: '0.25rem 0.75rem' }}>Popular</span>
              </div>
              <p className="text-primary-100" style={{ marginBottom: '1.5rem' }}>For power users</p>
              <div className="text-4xl font-bold" style={{ marginBottom: '1.5rem' }}>$12<span className="text-lg text-primary-200 font-normal">/month</span></div>
              <ul className="space-y-3" style={{ marginBottom: '2rem' }}>
                <li className="flex items-center space-x-3">
                  <FiCheck className="w-5 h-5" />
                  <span>20 messages/day</span>
                </li>
                <li className="flex items-center space-x-3">
                  <FiCheck className="w-5 h-5" />
                  <span>Text + Voice messages</span>
                </li>
                <li className="flex items-center space-x-3">
                  <FiCheck className="w-5 h-5" />
                  <span>Tasks + Meetings</span>
                </li>
                <li className="flex items-center space-x-3">
                  <FiCheck className="w-5 h-5" />
                  <span>10-min Correction Window</span>
                </li>
              </ul>
              <button
                onClick={() => handlePlanSelection('Plus', '$12')}
                className="w-full cursor-pointer text-white bg-black border-2 border-primary-600 rounded-xl font-semibold hover:bg-primary-50 transition"
                style={{ padding: '0.75rem 0' }}
              >
                Get Started
              </button>
            </div>
            {/* Pro Plan */}
            <div className="bg-gray-50 rounded-2xl border-2 border-gray-200" style={{ padding: '2rem' }}>
              <h3 className="text-2xl font-bold" style={{ marginBottom: '0.5rem' }}>Pro</h3>
              <p className="text-gray-600" style={{ marginBottom: '1.5rem' }}>For elite users</p>
              <div className="text-4xl font-bold" style={{ marginBottom: '1.5rem' }}>$29<span className="text-lg text-gray-500 font-normal">/month</span></div>
              <ul className="space-y-3" style={{ marginBottom: '2rem' }}>
                <li className="flex items-center space-x-3">
                  <FiCheck className="w-5 h-5 text-green-500" />
                  <span>Unlimited messages</span>
                </li>
                <li className="flex items-center space-x-3">
                  <FiCheck className="w-5 h-5 text-green-500" />
                  <span>Full Operational Control</span>
                </li>
                <li className="flex items-center space-x-3">
                  <FiCheck className="w-5 h-5 text-green-500" />
                  <span>AI Memory & Multilingual</span>
                </li>
                <li className="flex items-center space-x-3">
                  <FiCheck className="w-5 h-5 text-green-500" />
                  <span>Proactive Reminders</span>
                </li>
              </ul>
              <button
                onClick={() => handlePlanSelection('Pro', '$29')}
                className="w-full border-2 border-primary-600 text-primary-600 rounded-xl font-semibold hover:bg-primary-50 transition"
                style={{ padding: '0.75rem 0' }}
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white" style={{ padding: '3rem 0' }}>
        <div className="max-w-7xl" style={{ margin: '0 auto', padding: '0 1rem' }}>
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2" style={{ marginBottom: '1rem' }}>
              <FiCalendar className="w-6 h-6 text-primary-400" />
              <span className="text-xl font-bold">Scheduler</span>
            </div>
            <div className="text-gray-400 text-sm">
              © 2026 Scheduler. All rights reserved.
            </div>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <button onClick={() => setPrivacyModalOpen(true)} className="text-gray-400 hover:text-white text-sm transition cursor-pointer">Privacy Policy</button>
              <button onClick={() => setTermsModalOpen(true)} className="text-gray-400 hover:text-white text-sm transition cursor-pointer">Terms of Service</button>
            </div>
          </div>
        </div>
      </footer>

      {/* Calendar Connection Status Modal */}
      <Transition appear show={calendarStatus !== null} as="div">
        <Dialog
          as="div"
          className="fixed inset-0 z-50 overflow-y-auto"
          onClose={() => setCalendarStatus(null)}
        >
          <div className="flex items-center justify-center min-h-screen px-4">
            <Transition.Child
              as="div"
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black/50 modal-backdrop" />
            </Transition.Child>

            <Transition.Child
              as="div"
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className={`bg-white rounded-2xl max-w-md w-full relative z-10 overflow-hidden shadow-2xl ${calendarStatus === 'connected' ? 'border-4 border-green-500' :
                  calendarStatus === 'error' ? 'border-4 border-red-500' :
                    'border-4 border-yellow-500'
                }`} style={{ padding: '2rem' }}>
                <div className="text-center">
                  {calendarStatus === 'connected' && (
                    <>
                      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FiCheck className="w-10 h-10 text-green-500" />
                      </div>
                      <Dialog.Title className="text-2xl font-bold text-green-600" style={{ marginBottom: '1rem' }}>
                        Google Calendar Connected!
                      </Dialog.Title>
                      <p className="text-gray-600">
                        You're all set. Start sending tasks on WhatsApp!
                      </p>
                    </>
                  )}
                  {calendarStatus === 'error' && (
                    <>
                      <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FiX className="w-10 h-10 text-red-500" />
                      </div>
                      <Dialog.Title className="text-2xl font-bold text-red-600" style={{ marginBottom: '1rem' }}>
                        Connection Failed
                      </Dialog.Title>
                      <p className="text-gray-600">
                        Please try connecting again.
                      </p>
                      <button
                        onClick={() => { handleGoogleConnect(); setCalendarStatus(null); }}
                        className="mt-4 bg-red-600 text-white rounded-lg px-6 py-2 hover:bg-red-700 transition cursor-pointer"
                      >
                        Try Again
                      </button>
                    </>
                  )}
                  {calendarStatus === 'warning' && (
                    <>
                      <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FiCheck className="w-10 h-10 text-yellow-500" />
                      </div>
                      <Dialog.Title className="text-2xl font-bold text-yellow-600" style={{ marginBottom: '1rem' }}>
                        Partial Connection
                      </Dialog.Title>
                      <p className="text-gray-600">
                        Some permissions were not granted. Please reconnect with all permissions.
                      </p>
                      <button
                        onClick={() => { handleGoogleConnect(); setCalendarStatus(null); }}
                        className="mt-4 bg-yellow-600 text-white rounded-lg px-6 py-2 hover:bg-yellow-700 transition cursor-pointer"
                      >
                        Reconnect
                      </button>
                    </>
                  )}
                </div>
                {calendarStatus === 'connected' && (
                  <button
                    onClick={() => setCalendarStatus(null)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                  >
                    <FiX className="w-6 h-6" />
                  </button>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      {/* Login Modal */}
      <Transition appear show={loginModalOpen} as="div">
        <Dialog
          as="div"
          className="fixed inset-0 z-50 overflow-y-auto"
          onClose={() => setLoginModalOpen(false)}
        >
          <div className="flex items-center justify-center min-h-screen px-4">
            <Transition.Child
              as="div"
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black/50 modal-backdrop" />
            </Transition.Child>

            <Transition.Child
              as="div"
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="bg-white rounded-2xl max-w-md w-full relative z-10" style={{ padding: '2rem' }}>
                <Dialog.Title className="text-2xl font-bold text-center gradient-text" style={{ marginBottom: '1.5rem' }}>
                  Welcome Back!
                </Dialog.Title>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700" style={{ marginBottom: '0.25rem' }}>Email</label>
                    <input
                      type="email"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      style={{ padding: '0.5rem 1rem' }}
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700" style={{ marginBottom: '0.25rem' }}>Password</label>
                    <input
                      type="password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      style={{ padding: '0.5rem 1rem' }}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-primary-600 bg-black cursor-pointer text-white rounded-xl font-semibold hover:bg-primary-700 transition"
                    style={{ padding: '0.75rem 0' }}
                  >
                    Login
                  </button>
                </form>
                <button
                  onClick={() => { setLoginModalOpen(false); setRegisterModalOpen(true); }}
                  className="w-full text-center text-primary-600 hover:underline"
                  style={{ marginTop: '1rem' }}
                >
                  Don't have an account? Register
                </button>
                <button
                  onClick={() => setLoginModalOpen(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      {/* Register Modal */}
      <Transition appear show={registerModalOpen} as="div">
        <Dialog
          as="div"
          className="fixed inset-0 z-50 overflow-y-auto"
          onClose={() => setRegisterModalOpen(false)}
        >
          <div className="flex items-center justify-center min-h-screen px-4">
            <Transition.Child
              as="div"
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black/50 modal-backdrop" />
            </Transition.Child>

            <Transition.Child
              as="div"
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="bg-white rounded-2xl max-w-lg w-full relative z-10 max-h-[90vh] overflow-y-auto" style={{ padding: '2rem' }}>
                <Dialog.Title className="text-2xl font-bold text-center gradient-text" style={{ marginBottom: '1.5rem' }}>
                  Create Account
                </Dialog.Title>
                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700" style={{ marginBottom: '0.25rem' }}>Name</label>
                    <input
                      type="text"
                      value={registerForm.name}
                      onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent" style={{ padding: '0.5rem 1rem' }}
                      placeholder="John Doe"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700" style={{ marginBottom: '0.25rem' }}>Email</label>
                    <input
                      type="email"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent" style={{ padding: '0.5rem 1rem' }}
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700" style={{ marginBottom: '0.25rem' }}>
                      Phone (WhatsApp)
                      <span className="text-xs text-gray-500" style={{ marginLeft: '0.5rem' }}>Used for notifications</span>
                    </label>
                    <input
                      type="tel"
                      value={registerForm.phone}
                      onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent" style={{ padding: '0.5rem 1rem' }}
                      placeholder="+1234567890"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700" style={{ marginBottom: '0.25rem' }}>Password</label>
                    <input
                      type="password"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent" style={{ padding: '0.5rem 1rem' }}
                      placeholder="••••••••"
                      required
                    />
                  </div>

                  {/* Availability */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700" style={{ marginBottom: '0.5rem' }}>Available Days (can be selected multiple)</label>
                    <div className="flex flex-wrap gap-2">
                      {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(day)}
                          className={`rounded-lg text-sm font-medium transition ${selectedDays.includes(day)
                            ? 'bg-gray-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`} style={{ padding: '0.25rem 0.75rem' }}
                        >
                          {day.slice(0, 3)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sleep Time */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700" style={{ marginBottom: '0.25rem' }}>Sleep Start</label>
                      <input
                        type="time"
                        value={registerForm.sleepTime.start}
                        onChange={(e) => setRegisterForm({ ...registerForm, sleepTime: { ...registerForm.sleepTime, start: e.target.value } })}
                        className="w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        style={{ padding: '0.5rem 1rem' }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700" style={{ marginBottom: '0.25rem' }}>Sleep End</label>
                      <input
                        type="time"
                        value={registerForm.sleepTime.end}
                        onChange={(e) => setRegisterForm({ ...registerForm, sleepTime: { ...registerForm.sleepTime, end: e.target.value } })}
                        className="w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        style={{ padding: '0.5rem 1rem' }}
                      />
                    </div>
                  </div>

                  {/* Calendar Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700" style={{ marginBottom: '0.5rem' }}>Calendar Type</label>
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="radio"
                        name="calendarType"
                        checked={registerForm.calendarType === 'google_calendar'}
                        onChange={() => setRegisterForm({ ...registerForm, calendarType: 'google_calendar' })}
                        className="text-primary-600 focus:ring-primary-500"
                      />
                      <span className="flex items-center space-x-2">
                        <FaGoogle className="text-red-500" />
                        <span>Google Calendar</span>
                      </span>
                    </label>
                  </div>

                  {/* Timezone */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700" style={{ marginBottom: '0.25rem' }}>Timezone</label>
                    <select
                      value={registerForm.timezone}
                      onChange={(e) => setRegisterForm({ ...registerForm, timezone: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent" style={{ padding: '0.5rem 1rem' }}
                    >
                      <option value="Asia/Karachi">Asia/Karachi (PKT)</option>
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">America/New_York (EST)</option>
                      <option value="Europe/London">Europe/London (GMT)</option>
                      <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                      {/* More timezones can be added or auto-detected */}
                      {!['Asia/Karachi', 'UTC', 'America/New_York', 'Europe/London', 'Asia/Dubai'].includes(registerForm.timezone) && (
                        <option value={registerForm.timezone}>{registerForm.timezone}</option>
                      )}
                    </select>
                  </div>

                  {/* Calendar-specific options */}
                  {registerForm.calendarType === 'google_calendar' ? (
                    false
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700" style={{ marginBottom: '0.25rem' }}>Calendly API Token</label>
                      <input
                        type="text"
                        value={registerForm.calendlyToken}
                        onChange={(e) => setRegisterForm({ ...registerForm, calendlyToken: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent" style={{ padding: '0.5rem 1rem' }}
                        placeholder="Enter your Calendly API token"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-primary-600 bg-black cursor-pointer text-white rounded-xl font-semibold hover:bg-primary-700 transition" style={{ padding: '0.75rem 0' }}
                  >
                    Create Account
                  </button>
                </form>
                <button
                  onClick={() => { setRegisterModalOpen(false); setLoginModalOpen(true); }}
                  className="w-full text-center text-primary-600 hover:underline" style={{ marginTop: '1rem' }}
                >
                  Already have an account? Login
                </button>
                <button
                  onClick={() => setRegisterModalOpen(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      {/* Payment Modal (Easypaisa Theme) */}
      <Transition appear show={paymentModalOpen} as="div">
        <Dialog
          as="div"
          className="fixed inset-0 z-50 overflow-y-auto"
          onClose={() => setPaymentModalOpen(false)}
        >
          <div className="flex items-center justify-center min-h-screen px-4">
            <Transition.Child
              as="div"
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black/50 modal-backdrop" />
            </Transition.Child>

            <Transition.Child
              as="div"
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="bg-white rounded-2xl max-w-md w-full relative z-10 overflow-hidden shadow-2xl">
                {/* Easypaisa Header */}
                <div className="bg-[#00a651] p-6 text-white text-center">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-md">
                    <span className="text-[#00a651] text-4xl font-bold">e</span>
                  </div>
                  <Dialog.Title className="text-2xl font-bold">
                    Easypaisa Payment
                  </Dialog.Title>
                  <p className="text-green-50 opacity-90">Secure Money Transfer</p>
                </div>

                <div className="p-8">
                  <div className="space-y-6">
                    <div className="text-center">
                      <p className="text-gray-500 text-sm uppercase tracking-wider font-semibold">Total Amount</p>
                      <p className="text-4xl font-bold text-gray-800 mt-1">{selectedPlan?.amount}</p>
                    </div>

                    <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-gray-600">Gateway</span>
                        <span className="font-bold text-[#00a651]">Easypaisa</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Account Number</span>
                        <span className="font-mono font-bold text-gray-800">{selectedPlan?.number}</span>
                      </div>
                    </div>

                    <div className="text-sm text-gray-600 text-center leading-relaxed">
                      Please transfer the amount to the number above via your Easypaisa App. Once completed, your <span className="font-bold">{selectedPlan?.name}</span> plan features will be activated.
                    </div>

                    <button
                      onClick={() => { setPaymentModalOpen(false); showToast('Payment received! Your plan will be updated shortly.'); }}
                      className="w-full bg-[#00a651] text-white rounded-xl font-bold py-3 hover:bg-[#008c42] transition-colors shadow-lg cursor-pointer"
                    >
                      I Have Paid
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => setPaymentModalOpen(false)}
                  className="absolute top-4 right-4 text-white/80 hover:text-white"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
      {/* Privacy Policy Modal */}
      <Transition appear show={privacyModalOpen} as="div">
        <Dialog as="div" className="fixed inset-0 z-50 overflow-y-auto" onClose={() => setPrivacyModalOpen(false)}>
          <div className="flex items-center justify-center min-h-screen px-4">
            <Transition.Child as="div" enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
              <div className="fixed inset-0 bg-black/50" />
            </Transition.Child>
            <Transition.Child as="div" enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="bg-white rounded-2xl max-w-2xl w-full relative z-10 overflow-hidden shadow-2xl p-8 max-h-[80vh] overflow-y-auto">
                <Dialog.Title className="text-3xl font-bold mb-6">Privacy Policy</Dialog.Title>
                <div className="space-y-4 text-gray-600 leading-relaxed">
                  <p><strong>Last Updated: May 25, 2026</strong></p>
                  <p>At Scheduler, we respect your privacy and are committed to protecting your personal data.</p>
                  <h4 className="font-bold text-gray-800">1. Data Collection</h4>
                  <p>We collect information you provide during registration, including your name, email, phone number, and Google Calendar tokens.</p>
                  <h4 className="font-bold text-gray-800">2. Usage</h4>
                  <p>Your data is used solely to provide the scheduling service. We use your Google tokens to create and manage tasks/events on your behalf.</p>
                  <h4 className="font-bold text-gray-800">3. AI Processing</h4>
                  <p>We use third-party AI services (OpenRouter) to process your messages. No personally identifiable information is stored by these AI providers.</p>
                  <h4 className="font-bold text-gray-800">4. Data Security</h4>
                  <p>We implement production-grade security measures (DDoS protection, encryption, sanitization) to keep your data safe.</p>
                </div>
                <button onClick={() => setPrivacyModalOpen(false)} className="mt-8 w-full bg-primary-600 text-white font-bold py-3 rounded-xl hover:bg-primary-700 transition cursor-pointer">Close</button>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      {/* Terms of Service Modal */}
      <Transition appear show={termsModalOpen} as="div">
        <Dialog as="div" className="fixed inset-0 z-50 overflow-y-auto" onClose={() => setTermsModalOpen(false)}>
          <div className="flex items-center justify-center min-h-screen px-4">
            <Transition.Child as="div" enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
              <div className="fixed inset-0 bg-black/50" />
            </Transition.Child>
            <Transition.Child as="div" enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="bg-white rounded-2xl max-w-2xl w-full relative z-10 overflow-hidden shadow-2xl p-8 max-h-[80vh] overflow-y-auto">
                <Dialog.Title className="text-3xl font-bold mb-6">Terms of Service</Dialog.Title>
                <div className="space-y-4 text-gray-600 leading-relaxed">
                  <p>By using Scheduler, you agree to the following terms:</p>
                  <h4 className="font-bold text-gray-800">1. Service Use</h4>
                  <p>You must provide accurate information. You are responsible for maintaining the confidentiality of your account.</p>
                  <h4 className="font-bold text-gray-800">2. Usage Limits</h4>
                  <p>Abuse of the service (DDoS, scraping, etc.) will result in immediate account termination.</p>
                  <h4 className="font-bold text-gray-800">3. Liability</h4>
                  <p>Scheduler is provided "as is." We are not liable for any missed appointments or data loss caused by AI parsing errors.</p>
                  <h4 className="font-bold text-gray-800">4. Payments</h4>
                  <p>Subscription fees are non-refundable. You can cancel at any time.</p>
                </div>
                <button onClick={() => setTermsModalOpen(false)} className="mt-8 w-full bg-primary-600 text-white font-bold py-3 rounded-xl hover:bg-primary-700 transition cursor-pointer">Close</button>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}

export default App;
