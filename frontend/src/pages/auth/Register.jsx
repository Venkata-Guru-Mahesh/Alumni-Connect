import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiUser, FiMail, FiLock, FiEye, FiEyeOff, FiPhone, FiCalendar, FiBookOpen, FiBriefcase } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../constants/roles';
import Loader from '../../components/shared/Loader';
import ErrorAlert from '../../components/shared/ErrorAlert';
import RollNumberInput from '../../components/shared/RollNumberInput';
import { getBranchOptions, parseRollNumber, validateRollNumber } from '../../utils/rollNumberUtils';
import authApi from '../../api/auth.api';

const Register = () => {
  const [step, setStep] = useState(1);
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: ROLES.STUDENT,
    graduationYear: '',
    department: '',
    rollNumber: '',
    assignedCounsellor: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rollNumberValid, setRollNumberValid] = useState(false);
  const [counsellors, setCounsellors] = useState([]);
  const [loadingCounsellors, setLoadingCounsellors] = useState(false);
  const [autoDetected, setAutoDetected] = useState({
    department: false,
    graduationYear: false,
    role: false,
  });
  
  const { register } = useAuth();
  const navigate = useNavigate();

  const branchOptions = getBranchOptions();

  // Resend OTP timer effect
  useEffect(() => {
    let timer;
    if (resendTimer > 0) {
      timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendTimer]);

  // Auto-detect from roll number when it changes
  useEffect(() => {
    if (formData.rollNumber && formData.rollNumber.length === 10) {
      const { isValid } = validateRollNumber(formData.rollNumber);
      
      if (isValid) {
        const parsed = parseRollNumber(formData.rollNumber);
        
        if (parsed) {
          const currentYear = new Date().getFullYear();
          const isAlumni = parsed.passoutYear < currentYear;
          
          setFormData(prev => ({
            ...prev,
            department: parsed.branchShort,
            graduationYear: parsed.passoutYear,
            role: isAlumni ? ROLES.ALUMNI : ROLES.STUDENT,
          }));
          
          setAutoDetected({
            department: true,
            graduationYear: true,
            role: true,
          });
          
          // Fetch counsellors for this department
          fetchCounsellors(parsed.branchShort);
        }
      }
    }
  }, [formData.rollNumber]);

  // Fetch counsellors when department changes
  const fetchCounsellors = async (department) => {
    if (!department) return;
    
    setLoadingCounsellors(true);
    try {
      const response = await authApi.getCounsellors(department);
      if (response.data?.success && response.data?.data) {
        setCounsellors(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch counsellors:', err);
      setCounsellors([]);
    } finally {
      setLoadingCounsellors(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
    
    // If manually changing auto-detected field, mark as manual
    if (name === 'department' && autoDetected.department) {
      setAutoDetected(prev => ({ ...prev, department: false }));
      // Fetch counsellors for manually selected department
      fetchCounsellors(value);
    } else if (name === 'graduationYear' && autoDetected.graduationYear) {
      setAutoDetected(prev => ({ ...prev, graduationYear: false }));
    } else if (name === 'role' && autoDetected.role) {
      setAutoDetected(prev => ({ ...prev, role: false }));
    }
  };

  const validateStep1 = () => {
    if (!formData.firstName || !formData.lastName) {
      setError('Please enter your full name');
      return false;
    }
    if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    if (!formData.phone || formData.phone.length < 10) {
      setError('Please enter a valid phone number');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!formData.rollNumber || !rollNumberValid) {
      setError('Please enter a valid roll number');
      return false;
    }
    if (!formData.department) {
      setError('Please select a department');
      return false;
    }
    if (!formData.graduationYear) {
      setError('Please enter graduation year');
      return false;
    }
    // Counsellor is required only if the student role is selected AND counsellors are available
    if (formData.role === ROLES.STUDENT && counsellors.length > 0 && !formData.assignedCounsellor) {
      setError('Please select a counsellor');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

  const handleBack = () => {
    setStep(prev => prev - 1);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate step 3 before submitting
    if (!validateStep3()) {
      return;
    }
    
    setLoading(true);
    setError('');

    // Parse roll number to get batch year
    let batchYear = null;
    if (formData.rollNumber) {
      const parsed = parseRollNumber(formData.rollNumber);
      if (parsed) {
        batchYear = parseInt(parsed.year); // Convert "2022" to 2022
      }
    }

    // Transform field names from camelCase to snake_case for backend
    const registrationData = {
      first_name: formData.firstName,
      last_name: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      password: formData.password,
      password_confirm: formData.confirmPassword,
      role: formData.role,
      department: formData.department,
      roll_number: formData.rollNumber,
      graduation_year: formData.graduationYear,
    };
    
    // Add batch_year for students
    if (formData.role === ROLES.STUDENT && batchYear) {
      registrationData.batch_year = batchYear;
    }
    
    // Add assigned_counsellor only for students
    if (formData.role === ROLES.STUDENT && formData.assignedCounsellor) {
      registrationData.assigned_counsellor = parseInt(formData.assignedCounsellor);
    }

    try {
      const response = await authApi.register(registrationData);
      
      // Response is unwrapped by axios interceptor - check for email field
      if (response.data && response.data.email) {
        // Registration successful, show OTP step
        setRegisteredEmail(formData.email);
        setOtpStep(true);
        setResendTimer(60); // 60 seconds cooldown for resend
        setError('');
      } else {
        setError('Registration failed. Please try again.');
      }
    } catch (err) {
      console.error('Registration error:', err);
      
      // Extract error message from response
      let errorMessage = 'Registration failed. Please try again.';
      
      if (err.response?.data) {
        const errorData = err.response.data;
        
        // Check for field-specific errors (validation errors)
        if (errorData.email) {
          errorMessage = Array.isArray(errorData.email) ? errorData.email[0] : errorData.email;
        } else if (errorData.roll_number) {
          errorMessage = Array.isArray(errorData.roll_number) ? errorData.roll_number[0] : errorData.roll_number;
        } else if (errorData.password) {
          errorMessage = Array.isArray(errorData.password) ? errorData.password[0] : errorData.password;
        } else if (errorData.password_confirm) {
          errorMessage = Array.isArray(errorData.password_confirm) ? errorData.password_confirm[0] : errorData.password_confirm;
        } else if (errorData.batch_year) {
          errorMessage = Array.isArray(errorData.batch_year) ? errorData.batch_year[0] : errorData.batch_year;
        } else if (errorData.graduation_year) {
          errorMessage = Array.isArray(errorData.graduation_year) ? errorData.graduation_year[0] : errorData.graduation_year;
        } else if (errorData.phone) {
          errorMessage = Array.isArray(errorData.phone) ? errorData.phone[0] : errorData.phone;
        } else if (errorData.department) {
          errorMessage = Array.isArray(errorData.department) ? errorData.department[0] : errorData.department;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData.detail) {
          errorMessage = errorData.detail;
        }
      }
      
      setError(errorMessage);
    }
    
    setLoading(false);
  };

  const handleOtpChange = (index, value) => {
    // Only allow numeric input
    if (!/^\d*$/.test(value)) return;
    
    const newOtp = [...otpCode];
    newOtp[index] = value.slice(-1); // Take only the last digit
    setOtpCode(newOtp);
    
    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    
    const otpString = otpCode.join('');
    
    if (otpString.length !== 6) {
      setError('Please enter the complete 6-digit OTP');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const response = await authApi.verifyOtp({
        email: registeredEmail,
        otp_code: otpString,
      });
      
      // Check if response has user data (verification succeeded)
      if (response.data && response.data.user) {
        // OTP verified, user is now logged in
        const userData = response.data;
        
        // Store tokens and user data
        if (userData.tokens) {
          localStorage.setItem('accessToken', userData.tokens.access);
          localStorage.setItem('refreshToken', userData.tokens.refresh);
          localStorage.setItem('user', JSON.stringify(userData.user));
          if (userData.profile) {
            localStorage.setItem('profile', JSON.stringify(userData.profile));
          }
        }
        
        // Show success message
        setSuccess('Email verified successfully! Redirecting to dashboard...');
        setError('');
        
        // Wait 1.5 seconds to show success message, then redirect
        setTimeout(() => {
          // Redirect based on role
          if (userData.user?.role === ROLES.STUDENT) {
            navigate('/student/home');
          } else if (userData.user?.role === ROLES.ALUMNI) {
            navigate('/alumni/home');
          } else {
            navigate('/');
          }
        }, 1500);
      } else {
        setError('Invalid OTP. Please try again.');
      }
    } catch (err) {
      console.error('OTP verification error:', err);
      
      // Extract error message from response
      let errorMessage = 'Verification failed. Please try again.';
      
      if (err.response?.data) {
        const errorData = err.response.data;
        
        // Check for field-specific errors
        if (errorData.otp_code) {
          errorMessage = Array.isArray(errorData.otp_code) ? errorData.otp_code[0] : errorData.otp_code;
        } else if (errorData.email) {
          errorMessage = Array.isArray(errorData.email) ? errorData.email[0] : errorData.email;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData.detail) {
          errorMessage = errorData.detail;
        }
      }
      
      setError(errorMessage);
    }
    
    setLoading(false);
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const response = await authApi.resendOtp({ email: registeredEmail });
      
      // Response is unwrapped, check for otp_expires_in_minutes field
      if (response.data && response.data.otp_expires_in_minutes) {
        setOtpCode(['', '', '', '', '', '']);
        setResendTimer(60);
        setSuccess('A new OTP has been sent to your email.');
        setError('');
      } else {
        setError('Failed to resend OTP. Please try again.');
      }
    } catch (err) {
      // Extract error message from response
      let errorMessage = 'Failed to resend OTP. Please try again.';
      
      if (err.response?.data) {
        const errorData = err.response.data;
        
        // Check for field-specific errors
        if (errorData.email) {
          errorMessage = Array.isArray(errorData.email) ? errorData.email[0] : errorData.email;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData.detail) {
          errorMessage = errorData.detail;
        }
      }
      
      setError(errorMessage);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 px-4 py-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-4">
              <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXUjEM0r0I5UGvyH_3xy596muEJhbvBMVasg&s" alt="VVITU Logo" className="h-16" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {otpStep ? 'Verify Your Email' : 'Create Account'}
            </h1>
            <p className="text-gray-500 mt-2">
              {otpStep ? `We've sent a 6-digit code to ${registeredEmail}` : 'Join VVITU Alumni Network'}
            </p>
          </div>

          {/* Show OTP Step or Regular Registration */}
          {otpStep ? (
            <>
              {/* Success Alert */}
              {success && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-green-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <div className="ml-3 flex-1">
                      <p className="text-sm font-medium text-green-800">{success}</p>
                    </div>
                    <button onClick={() => setSuccess('')} className="ml-auto text-green-500 hover:text-green-700">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
              
              {/* Error Alert */}
              {error && <ErrorAlert message={error} onClose={() => setError('')} />}

              {/* OTP Input Form */}
              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-4 text-center">
                    Enter the 6-digit code
                  </label>
                  <div className="flex justify-center gap-2">
                    {otpCode.map((digit, index) => (
                      <input
                        key={index}
                        id={`otp-${index}`}
                        type="text"
                        maxLength="1"
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all"
                        required
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || otpCode.join('').length !== 6}
                  className="w-full btn-primary py-3 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader size="sm" color="white" /> : 'Verify & Continue'}
                </button>

                {/* Resend OTP */}
                <div className="text-center">
                  <p className="text-sm text-gray-600">
                    Didn't receive the code?{' '}
                    {resendTimer > 0 ? (
                      <span className="text-gray-400">
                        Resend in {resendTimer}s
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={loading}
                        className="text-primary-600 hover:text-primary-700 font-medium"
                      >
                        Resend OTP
                      </button>
                    )}
                  </p>
                </div>

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>TIP:</strong> Check your spam folder if you don't see the email. The code expires in 5 minutes.
                  </p>
                </div>
              </form>
            </>
          ) : (
            <>
              {/* Progress Steps */}
              <div className="flex items-center justify-center mb-8">
                {[1, 2, 3].map((s) => (
                  <div key={s} className="flex items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        step >= s
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {s}
                    </div>
                    {s < 3 && (
                      <div
                        className={`w-12 h-1 ${
                          step > s ? 'bg-primary-600' : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Error Alert */}
              {error && <ErrorAlert message={error} onClose={() => setError('')} />}

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Step 1: Basic Info */}
            {step === 1 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name
                    </label>
                    <div className="relative">
                      <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleChange}
                        className="input pl-10"
                        placeholder="John"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      className="input"
                      placeholder="Doe"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="input pl-10"
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="input pl-10"
                      placeholder="+91 9876543210"
                      required
                    />
                  </div>
                </div>
              </>
            )}

            {/* Step 2: Password */}
            {step === 2 && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="input pl-10 pr-10"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Must be at least 8 characters
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="input pl-10"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>
              </>
            )}

            {/* Step 3: Role & Academic Info */}
            {step === 3 && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Roll Number <span className="text-red-500">*</span>
                  </label>
                  <RollNumberInput
                    value={formData.rollNumber}
                    onChange={(value) => setFormData(prev => ({ ...prev, rollNumber: value }))}
                    onValidationChange={setRollNumberValid}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter your roll number to auto-fill details below
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    I am a {autoDetected.role && <span className="text-green-600 text-xs">(auto-detected)</span>}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, role: ROLES.STUDENT }))}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        formData.role === ROLES.STUDENT
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <FiBookOpen className="text-2xl mb-1 mx-auto" />
                      <span className="font-medium">Student</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, role: ROLES.ALUMNI }))}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        formData.role === ROLES.ALUMNI
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <FiBriefcase className="text-2xl mb-1 mx-auto" />
                      <span className="font-medium">Alumni</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Branch / Department {autoDetected.department && <span className="text-green-600 text-xs">(auto-detected)</span>}
                  </label>
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    className="input"
                    required
                  >
                    <option value="">Select Branch</option>
                    {branchOptions.map(branch => (
                      <option key={branch.value} value={branch.value}>
                        {branch.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {formData.role === ROLES.ALUMNI ? 'Graduation Year' : 'Expected Graduation'} {autoDetected.graduationYear && <span className="text-green-600 text-xs">(auto-detected)</span>}
                  </label>
                  <div className="relative">
                    <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="number"
                      name="graduationYear"
                      value={formData.graduationYear}
                      onChange={handleChange}
                      className="input pl-10"
                      placeholder="2024"
                      min="1990"
                      max="2030"
                      required
                    />
                  </div>
                </div>

                {/* Counsellor selection for students */}
                {formData.role === ROLES.STUDENT && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Your Counsellor
                      {counsellors.length > 0 && <span className="text-red-500"> *</span>}
                      {counsellors.length === 0 && <span className="text-gray-400 text-xs ml-1">(optional)</span>}
                    </label>
                    {loadingCounsellors ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader size="sm" />
                        <span className="ml-2 text-gray-600">Loading counsellors...</span>
                      </div>
                    ) : counsellors.length === 0 ? (
                      <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded-lg">
                        {formData.department 
                          ? 'No counsellors available for this department yet. You can proceed without selecting one.'
                          : 'Select a department to see available counsellors.'
                        }
                      </div>
                    ) : (
                      <select
                        name="assignedCounsellor"
                        value={formData.assignedCounsellor}
                        onChange={handleChange}
                        className="input"
                        required
                      >
                        <option value="">Select a counsellor</option>
                        {counsellors.map(counsellor => (
                          <option key={counsellor.id} value={counsellor.id}>
                            {counsellor.name} - {counsellor.department}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-3">
              {step > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex-1 btn-secondary py-3"
                >
                  Back
                </button>
              )}
              {step < 3 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 btn-primary py-3"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={
                    loading || (counsellors.length > 0 && !formData.assignedCounsellor)
                  }
                  className="flex-1 btn-primary py-3 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  title={
                    !rollNumberValid 
                      ? 'Please enter a valid roll number' 
                      : (formData.role === ROLES.STUDENT && counsellors.length > 0 && !formData.assignedCounsellor)
                      ? 'Please select a counsellor'
                      : ''
                  }
                >
                  {loading ? <Loader size="sm" color="white" /> : 'Create Account'}
                </button>
              )}
            </div>
          </form>

            {/* Login Link */}
            <div className="mt-6 text-center">
              <p className="text-gray-600">
                {otpStep ? (
                  <>
                    Want to use a different email?{' '}
                    <button
                      onClick={() => {
                        setOtpStep(false);
                        setOtpCode(['', '', '', '', '', '']);
                        setError('');
                      }}
                      className="text-primary-600 hover:text-primary-700 font-medium"
                    >
                      Go back
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
                      Sign in
                    </Link>
                  </>
                )}
              </p>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
};

export default Register;
