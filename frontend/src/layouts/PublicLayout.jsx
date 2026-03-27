import { Outlet, Link } from 'react-router-dom';
import { FiUsers, FiCalendar, FiBriefcase, FiArrowRight, FiMail, FiPhone, FiMapPin } from 'react-icons/fi';

const PublicLayout = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3">
              <img
                src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXUjEM0r0I5UGvyH_3xy596muEJhbvBMVasg&s"
                alt="VVITU Logo"
                className="h-12"
              />
              <div className="flex flex-col">
                <span className="font-bold text-xs text-gray-900 leading-tight">Vasireddy Venkatadri International</span>
                <span className="font-bold text-xs text-gray-900 leading-tight">Technological University</span>
                <span className="text-[10px] font-medium" style={{ color: '#E77E69' }}>ALUMNI NETWORK</span>
              </div>
            </Link>

            <div className="flex items-center gap-4">
              <Link
                to="/login"
                className="text-gray-600 hover:text-gray-900 font-medium transition"
              >
                Sign In
              </Link>
              <Link 
                to="/register" 
                className="text-white px-5 py-2 rounded-lg font-medium transition"
                style={{ backgroundColor: '#E77E69' }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#CA6959'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#E77E69'}
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section 
        className="relative py-48 px-4 overflow-hidden"
      >
        {/* Animated Background */}
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: 'url(https://www.vvitguntur.com/images/slider3/vvit_drone_4k-min.jpeg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            animation: 'slowZoom 8s ease-in-out infinite alternate'
          }}
        ></div>
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/50"></div>
        
        <div className="relative z-10 max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Vasireddy Venkatadri International Technological University
          </h1>
          <p className="text-2xl text-white/90 max-w-3xl mx-auto mb-4 font-semibold">
            How Can Loving Parents Deny VVIT To Their Children
          </p>
          <p className="text-xl text-white/80 max-w-3xl mx-auto mb-8 italic">
            Service to Society is Service to God
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              to="/register" 
              className="text-white py-3 px-8 text-lg rounded-lg font-semibold transition inline-flex items-center justify-center"
              style={{ backgroundColor: '#E77E69' }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#CA6959'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#E77E69'}
            >
              Join Alumni Network <FiArrowRight className="inline ml-2" />
            </Link>
            <Link 
              to="/login" 
              className="bg-white hover:bg-gray-100 py-3 px-8 text-lg rounded-lg font-semibold transition"
              style={{ color: '#E77E69' }}
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Campus Gallery */}
      <section className="py-16 px-4" style={{
        background: 'linear-gradient(135deg, #FEF0EE 0%, #ffffff 50%, #FEF0EE 100%)'
      }}>
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-4" style={{
            background: 'linear-gradient(135deg, #E77E69 0%, #CA6959 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Our Campus
          </h2>
          <p className="text-center text-gray-700 mb-12 max-w-2xl mx-auto text-lg">
            Experience world-class infrastructure and state-of-the-art facilities at VVITU, 
            where innovation meets excellence in education.
          </p>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="overflow-hidden rounded-lg shadow-lg">
              <img 
                src="https://www.vvitguntur.com/images/slider3/vvit_drone_4k-min.jpeg" 
                alt="VVITU Campus Aerial View" 
                className="w-full h-80 object-cover hover:scale-105 transition-transform duration-300"
              />
              <div className="p-4 bg-white">
                <h3 className="font-semibold text-gray-900">Campus Aerial View</h3>
                <p className="text-gray-600 text-sm">Sprawling campus with modern infrastructure</p>
              </div>
            </div>
            <div className="overflow-hidden rounded-lg shadow-lg">
              <img 
                src="https://www.vvitu.ac.in/src/assets/images/compus-img3.jpg" 
                alt="VVITU Campus Building" 
                className="w-full h-80 object-cover hover:scale-105 transition-transform duration-300"
              />
              <div className="p-4 bg-white">
                <h3 className="font-semibold text-gray-900">Academic Buildings</h3>
                <p className="text-gray-600 text-sm">State-of-the-art classrooms and laboratories</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4" style={{
        background: 'linear-gradient(to bottom, #ffffff 0%, #F9F9F9 100%)'
      }}>
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12" style={{
            background: 'linear-gradient(135deg, #E77E69 0%, #CA6959 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Why Join VVITU Alumni Network?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-md text-center hover:shadow-xl transition">
              <div className="w-14 h-14 rounded-lg flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#FEF0EE' }}>
                <FiUsers className="w-7 h-7" style={{ color: '#E77E69' }} />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Connect with Alumni Network
              </h3>
              <p className="text-gray-600">
                Join 10,000+ VVITU alumni worldwide. Get mentorship from successful 
                professionals who walked the same path as you.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md text-center hover:shadow-xl transition">
              <div className="w-14 h-14 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <FiBriefcase className="w-7 h-7 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Career Opportunities
              </h3>
              <p className="text-gray-600">
                Access exclusive job postings and internships from alumni at top 
                companies like Google, Microsoft, TCS, and Infosys.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md text-center hover:shadow-xl transition">
              <div className="w-14 h-14 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <FiCalendar className="w-7 h-7 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Events & Workshops
              </h3>
              <p className="text-gray-600">
                Participate in alumni reunions, technical workshops, and networking 
                sessions organized throughout the year.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-4" style={{ backgroundColor: '#E77E69' }}>
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-12">
            VVITU at a Glance
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-4xl font-bold text-white">10,000+</p>
              <p className="mt-2" style={{ color: '#FEF0EE' }}>Proud Alumni</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-white">5,000+</p>
              <p className="mt-2" style={{ color: '#FEF0EE' }}>Current Students</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-white">8+</p>
              <p className="mt-2" style={{ color: '#FEF0EE' }}>Departments</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-white">95%</p>
              <p className="mt-2" style={{ color: '#FEF0EE' }}>Placement Rate</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img
                  src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXUjEM0r0I5UGvyH_3xy596muEJhbvBMVasg&s"
                  alt="VVITU Logo"
                  className="h-10"
                />
                <span className="font-bold text-xl">VVITU</span>
              </div>
              <p className="text-gray-400 mb-2">
                Vasireddy Venkatadri International Technological University
              </p>
              <p className="text-gray-400 text-sm italic">
                Service to Society is Service to God
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link to="/login" className="hover:text-white">Sign In</Link></li>
                <li><Link to="/register" className="hover:text-white">Register</Link></li>
                <li><a href="https://www.vvitu.ac.in" target="_blank" rel="noopener noreferrer" className="hover:text-white">Visit VVITU Website</a></li>
                <li><a href="#" className="hover:text-white">About Us</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">For Members</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white">Students</a></li>
                <li><a href="#" className="hover:text-white">Alumni</a></li>
                <li><a href="#" className="hover:text-white">Faculty</a></li>
                <li><a href="#" className="hover:text-white">Events Calendar</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <ul className="space-y-3 text-gray-400">
                <li className="flex items-center gap-2">
                  <FiMail style={{ color: '#CA6959', fontSize: '16px', flexShrink: 0 }} />
                  <span>alumni@vvitu.ac.in</span>
                </li>
                <li className="flex items-center gap-2">
                  <FiPhone style={{ color: '#CA6959', fontSize: '16px', flexShrink: 0 }} />
                  <span>+91 866-2555530</span>
                </li>
                <li className="flex items-center gap-2">
                  <FiMapPin style={{ color: '#CA6959', fontSize: '16px', flexShrink: 0 }} />
                  <span>Namburu, Guntur District</span>
                </li>
                <li className="flex items-center gap-2">
                  <FiMapPin style={{ color: '#CA6959', fontSize: '16px', flexShrink: 0 }} />
                  <span>Andhra Pradesh - 522508</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2026 Vasireddy Venkatadri International Technological University. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <Outlet />
      
      <style>{`
        @keyframes slowZoom {
          0% {
            transform: scale(1);
          }
          100% {
            transform: scale(1.1);
          }
        }
      `}</style>
    </div>
  );
};

export default PublicLayout;
