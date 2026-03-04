import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { ROLE_SCOPES, ROLE_REDIRECT } from '../constants/roles';
import authApi from '../api/auth.api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileVersion, setProfileVersion] = useState(0);
  const navigate = useNavigate();

  // Initialize auth state from stored token
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        const storedProfile = localStorage.getItem('profile');
        const token = localStorage.getItem('accessToken');
        
        if (storedUser && token) {
          try {
            const decoded = jwtDecode(token);
            const currentTime = Date.now() / 1000;
            
            if (decoded.exp > currentTime) {
              const userData = JSON.parse(storedUser);
              setUser({
                ...userData,
                scopes: ROLE_SCOPES[userData.role] || [],
              });
              if (storedProfile) {
                const profileData = JSON.parse(storedProfile);
                setProfile(profileData);
              }
            } else {
              // Token expired - clear storage but don't navigate
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
              localStorage.removeItem('user');
              localStorage.removeItem('profile');
              setUser(null);
              setProfile(null);
            }
          } catch (decodeError) {
            console.error('Token decode error:', decodeError);
            // Invalid token - clear storage
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            localStorage.removeItem('profile');
            setUser(null);
            setProfile(null);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        // Don't logout on error, just clear state
        setUser(null);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = useCallback(async (credentials) => {
    try {
      const response = await authApi.login(credentials);
      console.log('Login response:', response.data);
      
      // Interceptor already unwraps response.data, so response.data contains {tokens, user, profile}
      const { tokens, user: userData, profile: profileData } = response.data;
      
      // Get access token
      const token = tokens.access;
      console.log('Access token:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');
      
      // Decode token to get user info
      const decoded = jwtDecode(token);
      
      const userWithScopes = {
        ...userData,
        ...decoded,
        scopes: ROLE_SCOPES[userData.role] || [],
      };

      // Store in localStorage (token should be HttpOnly cookie in production)
      localStorage.setItem('accessToken', token);
      localStorage.setItem('refreshToken', tokens.refresh);
      localStorage.setItem('user', JSON.stringify(userData));
      if (profileData) {
        localStorage.setItem('profile', JSON.stringify(profileData));
        setProfile(profileData);
      }
      
      console.log('Stored in localStorage - accessToken:', localStorage.getItem('accessToken') ? 'YES' : 'NO');
      
      setUser(userWithScopes);
      
      // Redirect to role-specific dashboard
      const redirectPath = ROLE_REDIRECT[userData.role] || '/';
      navigate(redirectPath);
      
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      
      // Extract detailed error message and error code
      let errorMessage = 'Login failed. Please try again.';
      let errorCode = null;
      
      if (error.response?.data) {
        const errorData = error.response.data;
        
        // Extract error code for special handling
        errorCode = errorData.error_code || null;
        
        // Check for specific error fields
        if (errorData.detail) {
          errorMessage = Array.isArray(errorData.detail) ? errorData.detail[0] : errorData.detail;
        } else if (errorData.email) {
          errorMessage = Array.isArray(errorData.email) ? errorData.email[0] : errorData.email;
        } else if (errorData.password) {
          errorMessage = Array.isArray(errorData.password) ? errorData.password[0] : errorData.password;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
      } else if (error.code === 'ERR_NETWORK') {
        errorMessage = 'Unable to connect to the server. Please check your internet connection and try again.';
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'The request timed out. Please try again.';
      }
      
      return {
        success: false,
        error: errorMessage,
        errorCode: errorCode,
      };
    }
  }, [navigate]);

  const register = useCallback(async (userData) => {
    try {
      const response = await authApi.register(userData);
      // Interceptor already unwraps response.data
      const data = response.data;
      
      // Auto-login after registration if tokens are provided
      if (data.tokens) {
        const { tokens, user: newUser } = data;
        const token = tokens.access;
        
        const decoded = jwtDecode(token);
        const userWithScopes = {
          ...newUser,
          ...decoded,
          scopes: ROLE_SCOPES[newUser.role] || [],
        };

        localStorage.setItem('accessToken', token);
        localStorage.setItem('refreshToken', tokens.refresh);
        localStorage.setItem('user', JSON.stringify(newUser));
        
        setUser(userWithScopes);
        
        const redirectPath = ROLE_REDIRECT[newUser.role] || '/';
        navigate(redirectPath);
      }
      
      return { success: true, data: data };
    } catch (error) {
      console.error('Registration error:', error);
      
      let errorMessage = 'Registration failed. Please try again.';
      
      if (error.response?.data) {
        const errorData = error.response.data;
        if (errorData.detail) {
          errorMessage = Array.isArray(errorData.detail) ? errorData.detail[0] : errorData.detail;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData.email) {
          errorMessage = Array.isArray(errorData.email) ? errorData.email[0] : errorData.email;
        } else if (errorData.roll_number) {
          errorMessage = Array.isArray(errorData.roll_number) ? errorData.roll_number[0] : errorData.roll_number;
        }
      } else if (error.code === 'ERR_NETWORK') {
        errorMessage = 'Unable to connect to the server. Please check your internet connection.';
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }, [navigate]);

  const logout = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('profile');
    setUser(null);
    setProfile(null);
    navigate('/login');
  }, [navigate]);

  const hasScope = useCallback((scope) => {
    if (!user || !user.scopes) return false;
    return user.scopes.includes(scope);
  }, [user]);

  const hasAnyScope = useCallback((scopes) => {
    if (!user || !user.scopes) return false;
    return scopes.some(scope => user.scopes.includes(scope));
  }, [user]);

  const hasAllScopes = useCallback((scopes) => {
    if (!user || !user.scopes) return false;
    return scopes.every(scope => user.scopes.includes(scope));
  }, [user]);

  const updateProfile = useCallback((updatedProfile) => {
    setProfile(updatedProfile);
    localStorage.setItem('profile', JSON.stringify(updatedProfile));
    setProfileVersion(v => v + 1);
    
    // Also update user avatar if profile picture changed
    if (updatedProfile?.profilePicture || updatedProfile?.profileImage) {
      setUser(prevUser => {
        if (!prevUser) return prevUser;
        const updatedUser = {
          ...prevUser,
          avatar: updatedProfile.profilePicture || updatedProfile.profileImage || prevUser.avatar,
          firstName: updatedProfile.firstName || prevUser.firstName,
          lastName: updatedProfile.lastName || prevUser.lastName,
          fullName: updatedProfile.firstName && updatedProfile.lastName 
            ? `${updatedProfile.firstName} ${updatedProfile.lastName}` 
            : prevUser.fullName,
          phone: updatedProfile.phone || prevUser.phone,
        };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        return updatedUser;
      });
    }
  }, []);

  const updateUser = useCallback((updatedData) => {
    setUser(prevUser => {
      if (!prevUser) return prevUser;
      const updatedUser = {
        ...prevUser,
        ...updatedData,
        fullName: updatedData.firstName && updatedData.lastName
          ? `${updatedData.firstName} ${updatedData.lastName}`
          : prevUser.fullName,
        scopes: prevUser.scopes, // preserve scopes
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      return updatedUser;
    });
  }, []);

  const value = {
    user,
    profile,
    loading,
    profileVersion,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    hasScope,
    hasAnyScope,
    hasAllScopes,
    updateProfile,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
