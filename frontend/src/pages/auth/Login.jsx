import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import ErrorAlert from '../../components/shared/ErrorAlert';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState(null);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuth();

  const svgRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const inputGroup1Ref = useRef(null);

  const eyeSpring = { stiffness: 150, damping: 15 };
  const eyeLX = useSpring(useMotionValue(0), eyeSpring);
  const eyeLY = useSpring(useMotionValue(0), eyeSpring);
  const eyeRX = useSpring(useMotionValue(0), eyeSpring);
  const eyeRY = useSpring(useMotionValue(0), eyeSpring);

  const noseX = useSpring(useMotionValue(0), eyeSpring);
  const noseY = useSpring(useMotionValue(0), eyeSpring);
  const noseRotate = useSpring(useMotionValue(0), eyeSpring);

  const mouthX = useSpring(useMotionValue(0), eyeSpring);
  const mouthY = useSpring(useMotionValue(0), eyeSpring);
  const mouthRotate = useSpring(useMotionValue(0), eyeSpring);
  const mouthScaleY = useSpring(useMotionValue(1), { stiffness: 80, damping: 22 });
  const mouthSmile = useSpring(useMotionValue(0), { stiffness: 80, damping: 22 });
  const toothY = useSpring(useMotionValue(0), { stiffness: 80, damping: 22 });
  const tongueY = useSpring(useMotionValue(0), { stiffness: 80, damping: 22 });
  const mouthOpenY = useSpring(useMotionValue(0), { stiffness: 80, damping: 22 });
  const mouthYCombined = useTransform([mouthY, mouthOpenY], ([base, open]) => base + open);

  const chinX = useSpring(useMotionValue(0), eyeSpring);
  const chinY = useSpring(useMotionValue(0), eyeSpring);
  const chinScaleY = useSpring(useMotionValue(1), eyeSpring);

  const faceX = useSpring(useMotionValue(0), eyeSpring);
  const faceY = useSpring(useMotionValue(0), eyeSpring);
  const faceSkew = useSpring(useMotionValue(0), eyeSpring);

  const eyebrowX = useSpring(useMotionValue(0), eyeSpring);
  const eyebrowY = useSpring(useMotionValue(0), eyeSpring);
  const eyebrowSkew = useSpring(useMotionValue(0), eyeSpring);

  const outerEarLX = useSpring(useMotionValue(0), eyeSpring);
  const outerEarLY = useSpring(useMotionValue(0), eyeSpring);
  const outerEarRX = useSpring(useMotionValue(0), eyeSpring);
  const outerEarRY = useSpring(useMotionValue(0), eyeSpring);

  const earHairLX = useSpring(useMotionValue(0), eyeSpring);
  const earHairLY = useSpring(useMotionValue(0), eyeSpring);
  const earHairRX = useSpring(useMotionValue(0), eyeSpring);
  const earHairRY = useSpring(useMotionValue(0), eyeSpring);

  const hairX = useSpring(useMotionValue(0), eyeSpring);
  const hairScaleY = useSpring(useMotionValue(1), eyeSpring);

  const armLX = useSpring(useMotionValue(-93), { stiffness: 80, damping: 20 });
  const armLY = useSpring(useMotionValue(220), { stiffness: 80, damping: 20 });
  const armLRotate = useSpring(useMotionValue(105), { stiffness: 80, damping: 20 });

  const armRX = useSpring(useMotionValue(-93), { stiffness: 80, damping: 20 });
  const armRY = useSpring(useMotionValue(220), { stiffness: 80, damping: 20 });
  const armRRotate = useSpring(useMotionValue(-105), { stiffness: 80, damping: 20 });

  const fingerSpring = { stiffness: 220, damping: 20 };
  const fingersX = useSpring(useMotionValue(0), fingerSpring);
  const fingersY = useSpring(useMotionValue(0), fingerSpring);
  const fingersRotate = useSpring(useMotionValue(0), fingerSpring);

  const eyeScale = useSpring(useMotionValue(1), { stiffness: 100, damping: 20 });

  const getPosition = (el) => {
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
    };
  };

  const getAngle = (x1, y1, x2, y2) => {
    return Math.atan2(y1 - y2, x1 - x2);
  };

  const mouthDefaultPath = "M100.2,101c-0.4,0-1.4,0-1.8,0c-2.7-0.3-5.3-1.1-8-2.5c-0.7-0.3-0.9-1.2-0.6-1.8 c0.2-0.5,0.7-0.7,1.2-0.7c0.2,0,0.5,0.1,0.6,0.2c3,1.5,5.8,2.3,8.6,2.3s5.7-0.7,8.6-2.3c0.2-0.1,0.4-0.2,0.6-0.2 c0.5,0,1,0.3,1.2,0.7c0.4,0.7,0.1,1.5-0.6,1.9c-2.6,1.4-5.3,2.2-7.9,2.5C101.7,101,100.5,101,100.2,101z";
  const mouthOpenPath = "M95 104.2 C90.5 104.2 86.8 100.5 86.8 96 86.8 95.33 86.8 94.66 86.8 94 86.8 92.8 87.8 91.8 89 91.8 96.33 91.8 103.66 91.8 111 91.8 112.2 91.8 113.2 92.8 113.2 94 113.2 94.66 113.2 95.33 113.2 96 113.2 100.5 109.5 104.2 105 104.2 101.66 104.2 98.33 104.2 95 104.2";
  const mouthFullOpenPath = "M100 110.2 C91 110.2 83.8 102.9 83.8 94 83.8 91.7 85.7 89.8 88 89.8 96 89.8 104 89.8 112 89.8 114.3 89.8 116.2 91.7 116.2 94 116.2 103 109 110.2 100 110.2";

  const lookAtPoint = (targetX, targetY) => {
    if (!svgRef.current) return;

    const svgCoords = getPosition(svgRef.current);
    const svgRect = svgRef.current.getBoundingClientRect();

    const eyeLCoords = { x: svgCoords.x + 84, y: svgCoords.y + 76 };
    const eyeRCoords = { x: svgCoords.x + 113, y: svgCoords.y + 76 };
    const noseCoords = { x: svgCoords.x + 97, y: svgCoords.y + 81 };
    const mouthCoords = { x: svgCoords.x + 100, y: svgCoords.y + 100 };
    const screenCenter = svgCoords.x + (svgRect.width / 2);
    const dFromC = screenCenter - targetX;

    const eyeMaxHorizD = 20;
    const eyeMaxVertD = 10;
    const noseMaxHorizD = 23;
    const noseMaxVertD = 10;

    const eyeLAngle = getAngle(eyeLCoords.x, eyeLCoords.y, targetX, targetY);
    const calcEyeLX = Math.cos(eyeLAngle) * eyeMaxHorizD;
    const calcEyeLY = Math.sin(eyeLAngle) * eyeMaxVertD;

    const eyeRAngle = getAngle(eyeRCoords.x, eyeRCoords.y, targetX, targetY);
    const calcEyeRX = Math.cos(eyeRAngle) * eyeMaxHorizD;
    const calcEyeRY = Math.sin(eyeRAngle) * eyeMaxVertD;

    const noseAngle = getAngle(noseCoords.x, noseCoords.y, targetX, targetY);
    const calcNoseX = Math.cos(noseAngle) * noseMaxHorizD;
    const calcNoseY = Math.sin(noseAngle) * noseMaxVertD;

    const mouthAngle = getAngle(mouthCoords.x, mouthCoords.y, targetX, targetY);
    const calcMouthX = Math.cos(mouthAngle) * noseMaxHorizD;
    const calcMouthY = Math.sin(mouthAngle) * noseMaxVertD;
    const calcMouthR = Math.cos(mouthAngle) * 6;

    const calcChinX = calcMouthX * 0.8;
    const calcChinY = calcMouthY * 0.5;
    let calcChinS = 1 - ((dFromC * 0.15) / 100);
    if (calcChinS > 1) calcChinS = 1 - (calcChinS - 1);

    const calcFaceX = calcMouthX * 0.3;
    const calcFaceY = calcMouthY * 0.4;
    const calcFaceSkew = Math.cos(mouthAngle) * 5;
    const calcEyebrowSkew = Math.cos(mouthAngle) * 25;

    const calcOuterEarX = Math.cos(mouthAngle) * 4;
    const calcOuterEarY = Math.cos(mouthAngle) * 5;

    const calcHairX = Math.cos(mouthAngle) * 6;
    const calcHairS = 1.2;

    eyeLX.set(-calcEyeLX);
    eyeLY.set(-calcEyeLY);
    eyeRX.set(-calcEyeRX);
    eyeRY.set(-calcEyeRY);

    noseX.set(-calcNoseX);
    noseY.set(-calcNoseY);
    noseRotate.set(calcMouthR);

    mouthX.set(-calcMouthX);
    mouthY.set(-calcMouthY);
    mouthRotate.set(calcMouthR);

    chinX.set(-calcChinX);
    chinY.set(-calcChinY);
    chinScaleY.set(calcChinS);

    faceX.set(-calcFaceX);
    faceY.set(-calcFaceY);
    faceSkew.set(-calcFaceSkew);

    eyebrowX.set(-calcFaceX);
    eyebrowY.set(-calcFaceY);
    eyebrowSkew.set(-calcEyebrowSkew);

    outerEarLX.set(calcOuterEarX);
    outerEarLY.set(-calcOuterEarY);
    outerEarRX.set(calcOuterEarX);
    outerEarRY.set(calcOuterEarY);

    earHairLX.set(-calcOuterEarX);
    earHairLY.set(-calcOuterEarY);
    earHairRX.set(-calcOuterEarX);
    earHairRY.set(calcOuterEarY);

    hairX.set(calcHairX);
    hairScaleY.set(calcHairS);
  };

  const getCoord = (inputEl) => {
    if (!inputEl) return;

    const carPos = inputEl.selectionEnd || 0;
    const div = document.createElement('div');
    const span = document.createElement('span');
    const copyStyle = getComputedStyle(inputEl);

    [].forEach.call(copyStyle, (prop) => {
      div.style[prop] = copyStyle[prop];
    });

    div.style.position = 'absolute';
    div.style.top = '0';
    div.style.left = '0';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';

    document.body.appendChild(div);
    div.textContent = inputEl.value.substr(0, carPos);
    span.textContent = inputEl.value.substr(carPos) || '.';
    div.appendChild(span);

    const emailCoords = getPosition(inputEl);
    const caretX = span.offsetLeft;
    const targetX = emailCoords.x + caretX;
    const targetY = emailCoords.y + 25;

    document.body.removeChild(div);
    lookAtPoint(targetX, targetY);
  };

  const resetFace = () => {
    eyeLX.set(0);
    eyeLY.set(0);
    eyeRX.set(0);
    eyeRY.set(0);
    noseX.set(0);
    noseY.set(0);
    noseRotate.set(0);
    mouthX.set(0);
    mouthY.set(0);
    mouthRotate.set(0);
    mouthScaleY.set(1);
    mouthSmile.set(0);
    toothY.set(0);
    tongueY.set(0);
    mouthOpenY.set(0);
    chinX.set(0);
    chinY.set(0);
    chinScaleY.set(1);
    faceX.set(0);
    faceY.set(0);
    faceSkew.set(0);
    eyebrowX.set(0);
    eyebrowY.set(0);
    eyebrowSkew.set(0);
    outerEarLX.set(0);
    outerEarLY.set(0);
    outerEarRX.set(0);
    outerEarRY.set(0);
    earHairLX.set(0);
    earHairLY.set(0);
    earHairRX.set(0);
    earHairRY.set(0);
    hairX.set(0);
    hairScaleY.set(1);
    eyeScale.set(1);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (document.activeElement === emailRef.current || isPasswordFocused) return;
      lookAtPoint(e.clientX, e.clientY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isPasswordFocused]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
    if (name === 'email') {
      const group = inputGroup1Ref.current;
      if (value.length > 0) {
        group.classList.add("focusWithText", "hasValue");
      } else {
        group.classList.remove("focusWithText", "hasValue");
      }

      if (value.length > 0) {
        const openProgress = Math.min(value.length / 10, 1);
        const atIndex = value.indexOf("@");
        const hasAt = atIndex > -1;
        const hasDotAfterAt = hasAt && value.indexOf(".", atIndex) > -1;
        eyeScale.set(hasAt ? 0.65 : 0.85);
        if (hasDotAfterAt) {
          mouthScaleY.set(1.25);
          mouthSmile.set(0);
          toothY.set(-2);
          tongueY.set(2);
          mouthOpenY.set(1);
        } else if (hasAt) {
          mouthScaleY.set(1.1);
          mouthSmile.set(0);
          toothY.set(-1);
          tongueY.set(1.5);
          mouthOpenY.set(0.5);
        } else {
          mouthScaleY.set(1 + (0.4 * openProgress));
          mouthSmile.set(-1 - (3 * openProgress));
          toothY.set(-1.5 * openProgress);
          tongueY.set(1 + (2 * openProgress));
          mouthOpenY.set(0.5 * openProgress);
        }
      } else {
        eyeScale.set(1);
        mouthScaleY.set(1);
        mouthSmile.set(0);
        toothY.set(0);
        tongueY.set(0);
        mouthOpenY.set(0);
      }

      getCoord(e.target);
    }
  };

  const handleEmailFocus = (e) => {
    const group = inputGroup1Ref.current;
    group.classList.add("focusWithText");
    if (e.target.value.length > 0) group.classList.add("hasValue");
    getCoord(e.target);
  };

  const handleEmailBlur = (e) => {
    if (e.target.value === "") {
      inputGroup1Ref.current.classList.remove("focusWithText");
    }
    resetFace();
  };

  const handlePasswordFocus = () => {
    setIsPasswordFocused(true);
    armLX.set(-93);
    armLY.set(16);
    armLRotate.set(0);
    armRX.set(-93);
    armRY.set(14);
    armRRotate.set(0);
  };

  const handlePasswordBlur = () => {
    setIsPasswordFocused(false);
    if (showPassword) return;
    armLY.set(220);
    armLRotate.set(105);
    armRY.set(220);
    armRRotate.set(-105);
  };

  const handleShowPasswordChange = (e) => {
    const checked = e.target.checked;
    setShowPassword(checked);
    if (checked) {
      setIsPasswordFocused(true);
      fingersRotate.set(34);
      fingersX.set(-9);
      fingersY.set(7);
    } else if (!document.activeElement || document.activeElement !== passwordRef.current) {
      setIsPasswordFocused(false);
      fingersRotate.set(0);
      fingersX.set(0);
      fingersY.set(0);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setErrorCode(null);

    const result = await login(formData);
    
    if (!result.success) {
      // Handle both string and object errors
      const errorMessage = typeof result.error === 'string' 
        ? result.error 
        : result.error?.message || result.error?.detail || 'Invalid credentials. Please try again.';
      setError(errorMessage);
      setErrorCode(result.errorCode || null);
    }
    
    setLoading(false);
  };

  const atIndex = formData.email.indexOf('@');
  const mouthIsFull = atIndex > -1 && formData.email.indexOf('.', atIndex) > -1;
  const mouthIsLarge = atIndex > -1;

  return (
    <div 
      style={{
        width: '100%',
        height: '100vh',
        position: 'relative',
        backgroundImage: 'url(https://www.vvitguntur.com/images/slider3/vvit_drone_4k-min.jpeg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        overflow: 'hidden'
      }}
    >
      {/* Overlay */}
      <div style={{ 
        position: 'absolute', 
        inset: 0, 
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(2px)'
      }}></div>

      {/* Content Container */}
      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '1280px', margin: '0 auto', padding: '32px 16px', height: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px', alignItems: 'center', height: '100%', width: '100%' }}>
          
          {/* Left Side - Branding */}
          <div style={{ textAlign: 'left', color: 'white' }}>
            <div style={{ marginBottom: '32px' }}>
              <img 
                src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXUjEM0r0I5UGvyH_3xy596muEJhbvBMVasg&s" 
                alt="VVITU Logo" 
                style={{ width: '600px', height: '350px', opacity: 0.85, filter: 'drop-shadow(0 20px 25px rgba(0, 0, 0,0.5))' }}
              />
            </div>
            <div>
              <h1 style={{ fontSize: '60px', fontWeight: 'bold', marginBottom: '16px', textShadow: '0 10px 15px rgba(0, 0, 0, 0.3)' }}>
                Welcome Back
              </h1>
              <p style={{ fontSize: '20px', color: '#e5e7eb', textShadow: '0 4px 6px rgba(0, 0, 0, 0.3)' }}>
                Vasireddy Venkatadri International Technological University
              </p>
              <p style={{ fontSize: '22px', color: '#f3f4f6', textShadow: '0 4px 6px rgba(0, 0, 0, 0.3)', marginTop: '16px', marginBottom: '8px' }}>
                How Can Loving Parents Deny VVIT To Their Children
              </p>
              <p style={{ fontSize: '20px', color: '#e5e7eb', textShadow: '0 4px 6px rgba(0, 0, 0, 0.3)' }}>
                Service to Society is Service to God
              </p>
            </div>
          </div>

          {/* Right Side - Form */}
          <div>
            <form onSubmit={handleSubmit} style={{
              position: 'relative',
              width: '100%',
              maxWidth: '400px',
              backgroundColor: '#ffffff',
              padding: '2.25em',
              boxSizing: 'border-box',
              border: '1px solid #ddd',
              borderRadius: '0.5em',
              margin: '0 auto',
              maxHeight: 'calc(100vh - 96px)',
              overflow: 'auto'
            }}>
              <h2 style={{
                textAlign: 'center',
                fontSize: '1.3em',
                fontWeight: '700',
                color: '#E77E69',
                marginBottom: '16px'
              }}>
                Sign in to VVITU Alumni Portal
              </h2>
              {/* SVG Container */}
              <div className="svgContainer" style={{
                position: 'relative',
                width: '200px',
                height: '200px',
                margin: '0 auto 1em',
                borderRadius: '50%',
                border: '2.5px solid #3a5e77',
                overflow: 'hidden',
                pointerEvents: 'none'
              }}>
                <div style={{ position: 'relative', width: '100%', height: '0', paddingBottom: '100%', overflow: 'hidden' }}>
                  <svg ref={svgRef} className="mySVG" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" viewBox="0 0 200 200">
                    <defs>
                      <circle id="armMaskPath" cx="100" cy="100" r="100" />
                    </defs>
                    <clipPath id="armMask">
                      <use xlinkHref="#armMaskPath" overflow="visible" />
                    </clipPath>
                    <circle cx="100" cy="100" r="100" fill="#a9ddf3" />
                    <g className="body">
                      <path fill="#FFFFFF" d="M193.3,135.9c-5.8-8.4-15.5-13.9-26.5-13.9H151V72c0-27.6-22.4-50-50-50S51,44.4,51,72v50H32.1 c-10.6,0-20,5.1-25.8,13l0,78h187L193.3,135.9z" />
                      <path fill="none" stroke="#3A5E77" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M193.3,135.9 c-5.8-8.4-15.5-13.9-26.5-13.9H151V72c0-27.6-22.4-50-50-50S51,44.4,51,72v50H32.1c-10.6,0-20,5.1-25.8,13" />
                      <path fill="#DDF1FA" d="M100,156.4c-22.9,0-43,11.1-54.1,27.7c15.6,10,34.2,15.9,54.1,15.9s38.5-5.8,54.1-15.9 C143,167.5,122.9,156.4,100,156.4z" />
                    </g>
                    <g className="earL">
                      <motion.g style={{ x: outerEarLX, y: outerEarLY }}>
                        <circle cx="47" cy="83" r="11.5" fill="#ddf1fa" stroke="#3a5e77" strokeWidth="2.5" />
                        <path d="M46.3 78.9c-2.3 0-4.1 1.9-4.1 4.1 0 2.3 1.9 4.1 4.1 4.1" stroke="#3a5e77" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </motion.g>
                      <motion.g style={{ x: earHairLX, y: earHairLY }}>
                        <rect x="51" y="64" fill="#FFFFFF" width="15" height="35" />
                        <path d="M53.4 62.8C48.5 67.4 45 72.2 42.8 77c3.4-.1 6.8-.1 10.1.1-4 3.7-6.8 7.6-8.2 11.6 2.1 0 4.2 0 6.3.2-2.6 4.1-3.8 8.3-3.7 12.5 1.2-.7 3.4-1.4 5.2-1.9" fill="#fff" stroke="#3a5e77" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </motion.g>
                    </g>
                    <g className="earR">
                      <motion.g style={{ x: outerEarRX, y: outerEarRY }}>
                        <circle cx="155" cy="83" r="11.5" fill="#ddf1fa" stroke="#3a5e77" strokeWidth="2.5" />
                        <path d="M155.7 78.9c2.3 0 4.1 1.9 4.1 4.1 0 2.3-1.9 4.1-4.1 4.1" stroke="#3a5e77" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </motion.g>
                      <motion.g style={{ x: earHairRX, y: earHairRY }}>
                        <rect x="131" y="64" fill="#FFFFFF" width="20" height="35" />
                        <path d="M148.6 62.8c4.9 4.6 8.4 9.4 10.6 14.2-3.4-.1-6.8-.1-10.1.1 4 3.7 6.8 7.6 8.2 11.6-2.1 0-4.2 0-6.3.2 2.6 4.1 3.8 8.3 3.7 12.5-1.2-.7-3.4-1.4-5.2-1.9" fill="#fff" stroke="#3a5e77" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </motion.g>
                    </g>
                    <motion.path style={{ x: chinX, y: chinY, scaleY: chinScaleY, transformOrigin: 'center center', transformBox: 'fill-box' }} className="chin" d="M84.1 121.6c2.7 2.9 6.1 5.4 9.8 7.5l.9-4.5c2.9 2.5 6.3 4.8 10.2 6.5 0-1.9-.1-3.9-.2-5.8 3 1.2 6.2 2 9.7 2.5-.3-2.1-.7-4.1-1.2-6.1" fill="none" stroke="#3a5e77" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    <motion.path style={{ x: faceX, y: faceY, skewX: faceSkew, transformOrigin: 'center top', transformBox: 'fill-box' }} className="face" fill="#DDF1FA" d="M134.5,46v35.5c0,21.815-15.446,39.5-34.5,39.5s-34.5-17.685-34.5-39.5V46" />
                    <motion.path style={{ x: hairX, scaleY: hairScaleY, transformOrigin: 'center bottom', transformBox: 'fill-box' }} className="hair" fill="#FFFFFF" stroke="#3A5E77" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M81.457,27.929 c1.755-4.084,5.51-8.262,11.253-11.77c0.979,2.565,1.883,5.14,2.712,7.723c3.162-4.265,8.626-8.27,16.272-11.235 c-0.737,3.293-1.588,6.573-2.554,9.837c4.857-2.116,11.049-3.64,18.428-4.156c-2.403,3.23-5.021,6.391-7.852,9.474" />
                    <motion.g style={{ x: eyebrowX, y: eyebrowY, skewX: eyebrowSkew, transformOrigin: 'center top', transformBox: 'fill-box' }} className="eyebrow">
                      <path fill="#FFFFFF" d="M138.142,55.064c-4.93,1.259-9.874,2.118-14.787,2.599c-0.336,3.341-0.776,6.689-1.322,10.037 c-4.569-1.465-8.909-3.222-12.996-5.226c-0.98,3.075-2.07,6.137-3.267,9.179c-5.514-3.067-10.559-6.545-15.097-10.329 c-1.806,2.889-3.745,5.73-5.816,8.515c-7.916-4.124-15.053-9.114-21.296-14.738l1.107-11.768h73.475V55.064z" />
                      <path fill="#FFFFFF" stroke="#3A5E77" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M63.56,55.102 c6.243,5.624,13.38,10.614,21.296,14.738c2.071-2.785,4.01-5.626,5.816-8.515c4.537,3.785,9.583,7.263,15.097,10.329 c1.197-3.043,2.287-6.104,3.267-9.179c4.087,2.004,8.427,3.761,12.996,5.226c0.545-3.348,0.986-6.696,1.322-10.037 c4.913-0.481,9.857-1.34,14.787-2.599" />
                    </motion.g>
                    <motion.g style={{ x: eyeLX, y: eyeLY, scale: eyeScale, transformOrigin: 'center', transformBox: 'fill-box' }} className="eyeL">
                      <circle cx="85.5" cy="78.5" r="3.5" fill="#3a5e77" />
                      <circle cx="84" cy="76" r="1" fill="#fff" />
                    </motion.g>
                    <motion.g style={{ x: eyeRX, y: eyeRY, scale: eyeScale, transformOrigin: 'center', transformBox: 'fill-box' }} className="eyeR">
                      <circle cx="114.5" cy="78.5" r="3.5" fill="#3a5e77" />
                      <circle cx="113" cy="76" r="1" fill="#fff" />
                    </motion.g>
                    <motion.g style={{ x: mouthX, y: mouthYCombined, rotate: mouthRotate, scaleY: mouthScaleY, skewX: mouthSmile, transformOrigin: 'center', transformBox: 'fill-box' }} className="mouth">
                      <path className="mouthBG" fill="#617E92" d={mouthIsFull ? mouthFullOpenPath : (mouthIsLarge ? mouthOpenPath : mouthDefaultPath)} />
                      <defs>
                        <path id="mouthMaskPath" d={mouthIsFull ? mouthFullOpenPath : (mouthIsLarge ? mouthOpenPath : mouthDefaultPath)} />
                      </defs>
                      <clipPath id="mouthMask">
                        <use xlinkHref="#mouthMaskPath" overflow="visible" />
                      </clipPath>
                      <g clipPath="url(#mouthMask)">
                        <motion.g style={{ y: tongueY }} className="tongue">
                          <circle cx="100" cy="107" r="8" fill="#cc4a6c" />
                          <ellipse className="tongueHighlight" cx="100" cy="100.5" rx="3" ry="1.5" opacity=".1" fill="#fff" />
                        </motion.g>
                      </g>
                      <motion.path style={{ y: toothY }} clipPath="url(#mouthMask)" className="tooth" fill="#FFFFFF" d="M106,97h-4c-1.1,0-2-0.9-2-2v-2h8v2C108,96.1,107.1,97,106,97z" />
                      <path className="mouthOutline" fill="none" stroke="#3A5E77" strokeWidth="2.5" strokeLinejoin="round" d={mouthIsFull ? mouthFullOpenPath : (mouthIsLarge ? mouthOpenPath : mouthDefaultPath)} />
                    </motion.g>
                    <motion.path style={{ x: noseX, y: noseY, rotate: noseRotate, transformOrigin: 'center', transformBox: 'fill-box' }} className="nose" d="M97.7 79.9h4.7c1.9 0 3 2.2 1.9 3.7l-2.3 3.3c-.9 1.3-2.9 1.3-3.8 0l-2.3-3.3c-1.3-1.6-.2-3.7 1.8-3.7z" fill="#3a5e77" />
                    <g className="arms" clipPath="url(#armMask)">
                      <motion.g style={{ x: armLX, y: armLY, rotate: armLRotate, transformOrigin: 'top left', transformBox: 'fill-box' }} className="armL">
                        <path fill="#ddf1fa" stroke="#3a5e77" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth="2.5" d="M121.3 97.4L111 58.7l38.8-10.4 20 36.1z" />
                        <path fill="#ddf1fa" stroke="#3a5e77" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth="2.5" d="M134.4 52.5l19.3-5.2c2.7-.7 5.4.9 6.1 3.5.7 2.7-.9 5.4-3.5 6.1L146 59.7" />
                        <path fill="#ddf1fa" stroke="#3a5e77" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth="2.5" d="M150.9 58.4l26-7c2.7-.7 5.4.9 6.1 3.5.7 2.7-.9 5.4-3.5 6.1l-21.3 5.7" />
                        <path fill="#a9ddf3" d="M175.5 54.9l2.2-.6c1.1-.3 2.2.3 2.4 1.4.3 1.1-.3 2.2-1.4 2.4l-2.2.6-1-3.8zM152.1 49.4l2.2-.6c1.1-.3 2.2.3 2.4 1.4.3 1.1-.3 2.2-1.4 2.4l-2.2.6-1-3.8z" />
                        <motion.g style={{ x: fingersX, y: fingersY, rotate: fingersRotate, transformOrigin: '158.3px 86.8px', transformBox: 'fill-box' }} className="twoFingers">
                          <path fill="#ddf1fa" stroke="#3a5e77" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth="2.5" d="M158.3 66.8l23.1-6.2c2.7-.7 5.4.9 6.1 3.5.7 2.7-.9 5.4-3.5 6.1l-23.1 6.2" />
                          <path fill="#a9ddf3" d="M180.1 64l2.2-.6c1.1-.3 2.2.3 2.4 1.4.3 1.1-.3 2.2-1.4 2.4l-2.2.6-1-3.8z" />
                          <path fill="#ddf1fa" stroke="#3a5e77" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth="2.5" d="M160.8 76.5l19.4-5.2c2.7-.7 5.4.9 6.1 3.5.7 2.7-.9 5.4-3.5 6.1l-18.3 4.9" />
                          <path fill="#a9ddf3" d="M178.8 74.7l2.2-.6c1.1-.3 2.2.3 2.4 1.4.3 1.1-.3 2.2-1.4 2.4l-2.2.6-1-3.8z" />
                        </motion.g>
                        <path fill="#fff" stroke="#3a5e77" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M123.5 96.8c-41.4 14.9-84.1 30.7-108.2 35.5L1.2 80c33.5-9.9 71.9-16.5 111.9-21.8" />
                        <path fill="#fff" stroke="#3a5e77" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M108.5 59.4c7.7-5.3 14.3-8.4 22.8-13.2-2.4 5.3-4.7 10.3-6.7 15.1 4.3.3 8.4.7 12.3 1.3-4.2 5-8.1 9.6-11.5 13.9 3.1 1.1 6 2.4 8.7 3.8-1.4 2.9-2.7 5.8-3.9 8.5 2.5 3.5 4.6 7.2 6.3 11-4.9-.8-9-.7-16.2-2.7M94.5 102.8c-.6 4-3.8 8.9-9.4 14.7-2.6-1.8-5-3.7-7.2-5.7-2.5 4.1-6.6 8.8-12.2 14-1.9-2.2-3.4-4.5-4.5-6.9-4.4 3.3-9.5 6.9-15.4 10.8-.2-3.4.1-7.1 1.1-10.9M97.5 62.9c-1.7-2.4-5.9-4.1-12.4-5.2-.9 2.2-1.8 4.3-2.5 6.5-3.8-1.8-9.4-3.1-17-3.8.5 2.3 1.2 4.5 1.9 6.8-5-.6-11.2-.9-18.4-1 2 2.9.9 3.5 3.9 6.2" />
                      </motion.g>
                      <motion.g style={{ x: armRX, y: armRY, rotate: armRRotate, transformOrigin: 'top right', transformBox: 'fill-box' }} className="armR">
                        <path fill="#ddf1fa" stroke="#3a5e77" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth="2.5" d="M265.4 97.3l10.4-38.6-38.9-10.5-20 36.1z" />
                        <path fill="#ddf1fa" stroke="#3a5e77" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth="2.5" d="M252.4 52.4L233 47.2c-2.7-.7-5.4.9-6.1 3.5-.7 2.7.9 5.4 3.5 6.1l10.3 2.8M226 76.4l-19.4-5.2c-2.7-.7-5.4.9-6.1 3.5-.7 2.7.9 5.4 3.5 6.1l18.3 4.9M228.4 66.7l-23.1-6.2c-2.7-.7-5.4.9-6.1 3.5-.7 2.7.9 5.4 3.5 6.1l23.1 6.2M235.8 58.3l-26-7c-2.7-.7-5.4.9-6.1 3.5-.7 2.7.9 5.4 3.5 6.1l21.3 5.7" />
                        <path fill="#a9ddf3" d="M207.9 74.7l-2.2-.6c-1.1-.3-2.2.3-2.4 1.4-.3 1.1.3 2.2 1.4 2.4l2.2.6 1-3.8zM206.7 64l-2.2-.6c-1.1-.3-2.2.3-2.4 1.4-.3 1.1.3 2.2 1.4 2.4l2.2.6 1-3.8zM211.2 54.8l-2.2-.6c-1.1-.3-2.2.3-2.4 1.4-.3 1.1.3 2.2 1.4 2.4l2.2.6 1-3.8zM234.6 49.4l-2.2-.6c-1.1-.3-2.2.3-2.4 1.4-.3 1.1.3 2.2 1.4 2.4l2.2.6 1-3.8z" />
                        <path fill="#fff" stroke="#3a5e77" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M263.3 96.7c41.4 14.9 84.1 30.7 108.2 35.5l14-52.3C352 70 313.6 63.5 273.6 58.1" />
                        <path fill="#fff" stroke="#3a5e77" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M278.2 59.3l-18.6-10 2.5 11.9-10.7 6.5 9.9 8.7-13.9 6.4 9.1 5.9-13.2 9.2 23.1-.9M284.5 100.1c-.4 4 1.8 8.9 6.7 14.8 3.5-1.8 6.7-3.6 9.7-5.5 1.8 4.2 5.1 8.9 10.1 14.1 2.7-2.1 5.1-4.4 7.1-6.8 4.1 3.4 9 7 14.7 11 1.2-3.4 1.8-7 1.7-10.9M314 66.7s5.4-5.7 12.6-7.4c1.7 2.9 3.3 5.7 4.9 8.6 3.8-2.5 9.8-4.4 18.2-5.7.1 3.1.1 6.1 0 9.2 5.5-1 12.5-1.6 20.8-1.9-1.4 3.9-2.5 8.4-2.5 8.4" />
                      </motion.g>
                    </g>
                  </svg>
                </div>
              </div>

              {/* Error Alert */}
              {error && errorCode === 'alumni_pending_verification' ? (
                <div style={{
                  backgroundColor: '#FEF3C7',
                  border: '1px solid #F59E0B',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '16px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>&#9203;</div>
                  <p style={{ fontWeight: '600', color: '#92400E', fontSize: '0.95em', marginBottom: '4px' }}>
                    Verification In Progress
                  </p>
                  <p style={{ color: '#92400E', fontSize: '0.85em' }}>
                    {error}
                  </p>
                </div>
              ) : error && (
                <ErrorAlert message={error} onClose={() => { setError(''); setErrorCode(null); }} />
              )}

              {/* Email Input */}
              <div ref={inputGroup1Ref} className="inputGroup inputGroup1" style={{ position: 'relative', marginBottom: '2em' }}>
                <label htmlFor="email" style={{ display: 'block', marginBottom: '8px', fontSize: '1em', fontWeight: '700', color: '#E77E69' }}>College Email</label>
                <input 
                  ref={emailRef}
                  type="text" 
                  id="email" 
                  name="email"
                  className="email" 
                  maxLength="256" 
                  value={formData.email}
                  onChange={handleChange}
                  onFocus={handleEmailFocus}
                  onBlur={handleEmailBlur}
                  style={{
                    width: '100%',
                    height: '50px',
                    padding: '10px 1em 0',
                    boxSizing: 'border-box',
                    backgroundColor: '#FEF0EE',
                    border: '2px solid #E77E69',
                    borderRadius: '4px',
                    fontSize: '1em',
                    fontWeight: '500',
                    fontFamily: 'inherit',
                    color: '#353538',
                    transition: 'box-shadow 0.2s linear, border-color 0.25s ease-out'
                  }}
                />
                <p className="helper helper1" style={{
                  position: 'absolute',
                  zIndex: 1,
                  fontFamily: 'inherit',
                  top: 0,
                  left: 0,
                  transform: 'translate(1.4em, 2em) scale(1)',
                  transformOrigin: '0 0',
                  fontSize: '0.95em',
                  fontWeight: '400',
                  color: '#E77E69',
                  opacity: '0.65',
                  pointerEvents: 'none',
                  transition: 'transform 0.2s ease-out, opacity 0.2s linear'
                }}>roll_no@vvit.net</p>
              </div>

              {/* Password Input */}
              <div className="inputGroup inputGroup2" style={{ position: 'relative', marginBottom: '2em' }}>
                <label htmlFor="password" style={{ display: 'block', marginBottom: '8px', fontSize: '1em', fontWeight: '700', color: '#E77E69' }}>Password</label>
                <input 
                  ref={passwordRef}
                  type={showPassword ? 'text' : 'password'}
                  id="password" 
                  name="password"
                  className="password" 
                  value={formData.password}
                  onChange={handleChange}
                  onFocus={handlePasswordFocus}
                  onBlur={handlePasswordBlur}
                  style={{
                    width: '100%',
                    height: '50px',
                    padding: '0 1em',
                    boxSizing: 'border-box',
                    backgroundColor: '#FEF0EE',
                    border: '2px solid #E77E69',
                    borderRadius: '4px',
                    fontSize: '1em',
                    fontWeight: '500',
                    fontFamily: 'inherit',
                    color: '#353538',
                    transition: 'box-shadow 0.2s linear, border-color 0.25s ease-out'
                  }}
                />
                <label htmlFor="showPasswordCheck" id="showPasswordToggle" style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  position: 'absolute',
                  top: '.25em',
                  right: 0,
                  fontSize: '1em',
                  color: '#E77E69',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}>
                  <span>Show</span>
                  <input
                    id="showPasswordCheck"
                    type="checkbox"
                    checked={showPassword}
                    onChange={handleShowPasswordChange}
                    style={{ position: 'absolute', zIndex: -1, opacity: 0 }}
                  />
                  <span className="indicator" style={{
                    position: 'relative',
                    height: '.85em',
                    width: '.85em',
                    backgroundColor: '#FEF0EE',
                    border: '2px solid #E77E69',
                    borderRadius: '3px'
                  }}>
                    <span style={{
                      position: 'absolute',
                      left: '.25em',
                      top: '.025em',
                      width: '.2em',
                      height: '.5em',
                      border: 'solid #E77E69',
                      borderWidth: '0 3px 3px 0',
                      transform: showPassword ? 'rotate(45deg)' : 'rotate(45deg)',
                      visibility: showPassword ? 'visible' : 'hidden'
                    }}></span>
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <div className="inputGroup inputGroup3" style={{ position: 'relative', marginBottom: 0 }}>
                <button 
                  type="submit"
                  id="login" 
                  disabled={loading}
                  style={{
                    width: '100%',
                    height: '50px',
                    backgroundColor: '#E77E69',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '1.1em',
                    fontWeight: '600',
                    color: '#ffffff',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease-out',
                    opacity: loading ? 0.5 : 1
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#CA6959'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#E77E69'}
                >
                  {loading ? 'Logging in...' : 'Log in'}
                </button>
              </div>

              {/* Register Link */}
              <div style={{ marginTop: '1.5em', textAlign: 'center' }}>
                <p style={{ color: '#6b7280' }}>
                  Don't have an account?{' '}
                  <Link to="/register" style={{ color: '#E77E69', fontWeight: '600', textDecoration: 'none' }}>
                    Sign up
                  </Link>
                </p>
              </div>
            </form>
          </div>

        </div>
      </div>

      <style>{`
        .inputGroup1.focusWithText .helper {
          transform: translate(1.4em, 1.5em) scale(0.65) !important;
          opacity: 1 !important;
        }
        .inputGroup1.hasValue .helper {
          opacity: 0 !important;
          visibility: hidden !important;
        }
        input:focus {
          outline: none !important;
          border-color: #E77E69 !important;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1) !important;
        }
      `}</style>
    </div>
  );
};

export default Login;