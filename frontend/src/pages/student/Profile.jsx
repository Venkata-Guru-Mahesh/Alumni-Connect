import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import studentApi from '../../api/student.api';
import { Loader, ErrorAlert } from '../../components/shared';
import ProfileEditForm from '../../components/student/ProfileEditForm';
import { parseRollNumber } from '../../utils/rollNumberUtils';
import {
  FiMail,
  FiPhone,
  FiMapPin,
  FiLinkedin,
  FiGithub,
  FiGlobe,
  FiEdit2,
} from 'react-icons/fi';

const Profile = () => {
  const { user, updateProfile } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await studentApi.getProfile();
      setProfile(response.data);
    } catch (err) {
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (formData) => {
    try {
      setSaving(true);
      setError('');
      console.log('Saving profile with data:', formData);
      await studentApi.updateProfile(formData);
      const response = await studentApi.getProfile();
      const updatedProfile = response.data;
      console.log('Updated profile received:', updatedProfile);
      setProfile(updatedProfile);
      updateProfile(updatedProfile); // Update in AuthContext
      setEditMode(false);
      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditMode(false);
    setError('');
  };

  const getDepartmentDisplay = () => {
    // Try to parse roll number to get full department name
    if (profile?.rollNumber) {
      const parsed = parseRollNumber(profile.rollNumber);
      if (parsed && parsed.branchFull) {
        return parsed.branchFull;
      }
    }
    // Fallback to profile department
    return profile?.department || 'N/A';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
          <p className="text-gray-500">Manage your personal information</p>
        </div>
        {!editMode && (
          <button
            onClick={() => setEditMode(true)}
            className="btn-primary flex items-center gap-2"
          >
            <FiEdit2 className="w-4 h-4" />
            Edit Profile
          </button>
        )}
      </div>

      {/* Alerts */}
      {error && <ErrorAlert message={error} onClose={() => setError('')} />}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700">
          {success}
        </div>
      )}

      {/* Edit Mode */}
      {editMode ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <ProfileEditForm
            profile={profile}
            onSave={handleSave}
            onCancel={handleCancel}
            loading={saving}
          />
        </div>
      ) : (
        /* View Mode */
        <>
          {/* Profile Header Card */}
          <div className="card">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {profile?.profilePicture ? (
                <img 
                  src={profile.profilePicture} 
                  alt={`${profile?.firstName} ${profile?.lastName}`}
                  className="w-24 h-24 rounded-full object-cover border-4 border-primary-100"
                />
              ) : (
                <div className="w-24 h-24 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-3xl font-bold text-primary-600">
                    {profile?.firstName?.[0]}{profile?.lastName?.[0]}
                  </span>
                </div>
              )}
              <div className="text-center md:text-left flex-1">
                <h2 className="text-2xl font-bold text-gray-900">
                  {profile?.firstName} {profile?.lastName}
                </h2>
                <p className="text-gray-600 font-medium">{getDepartmentDisplay()}</p>
                <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500">
                  {profile?.rollNumber && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Roll:</span> {profile.rollNumber}
                    </div>
                  )}
                  {profile?.currentYear && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Year:</span> {profile.currentYear}
                    </div>
                  )}
                  {profile?.cgpa && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium">CGPA:</span> {profile.cgpa}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {profile?.email && (
                <div className="flex items-center gap-3">
                  <FiMail className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="text-gray-900">{profile.email}</p>
                  </div>
                </div>
              )}
              {profile?.phone && (
                <div className="flex items-center gap-3">
                  <FiPhone className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="text-gray-900">{profile.phone}</p>
                  </div>
                </div>
              )}
              {profile?.location && (
                <div className="flex items-center gap-3">
                  <FiMapPin className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Location</p>
                    <p className="text-gray-900">{profile.location}</p>
                  </div>
                </div>
              )}
            </div>
            {profile?.bio && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-500 mb-1">Bio</p>
                <p className="text-gray-700">{profile.bio}</p>
              </div>
            )}
          </div>

          {/* Social Profiles */}
          {profile?.socialProfiles && Object.values(profile.socialProfiles).some(v => v) && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Social Profiles</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {profile.socialProfiles.linkedin && (
                  <a href={profile.socialProfiles.linkedin} target="_blank" rel="noopener noreferrer" 
                     className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <FiLinkedin className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium">LinkedIn</span>
                  </a>
                )}
                {profile.socialProfiles.github && (
                  <a href={profile.socialProfiles.github} target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <FiGithub className="w-5 h-5 text-gray-900" />
                    <span className="text-sm font-medium">GitHub</span>
                  </a>
                )}
                {profile.socialProfiles.portfolio && (
                  <a href={profile.socialProfiles.portfolio} target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <FiGlobe className="w-5 h-5 text-primary-600" />
                    <span className="text-sm font-medium">Portfolio</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Skills */}
          {profile?.skills && profile.skills.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Skills</h3>
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill, index) => {
                  const name = typeof skill === 'object' ? skill.name : skill;
                  const proficiency = typeof skill === 'object' ? skill.proficiency : null;
                  const proficiencyColors = {
                    expert: 'bg-purple-100 text-purple-700',
                    advanced: 'bg-blue-100 text-blue-700',
                    intermediate: 'bg-yellow-100 text-yellow-700',
                    beginner: 'bg-gray-100 text-gray-600',
                  };
                  return (
                    <div key={index} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-full text-sm font-medium">
                      {name}
                      {proficiency && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${proficiencyColors[proficiency] || 'bg-gray-100 text-gray-600'}`}>
                          {proficiency}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Internships */}
          {profile?.internships && profile.internships.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Internships</h3>
              <div className="space-y-4">
                {profile.internships.map((internship, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-semibold text-gray-900">{internship.role}</h4>
                    <p className="text-gray-600">{internship.company}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {internship.startDate} - {internship.endDate}
                      {internship.isPaid && <span className="ml-2 text-green-600">• Paid</span>}
                    </p>
                    {internship.description && (
                      <p className="text-sm text-gray-700 mt-2">{internship.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Placements */}
          {profile?.placements && profile.placements.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Placement Offers</h3>
              <div className="space-y-4">
                {profile.placements.map((placement, index) => (
                  <div key={index} className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-900">{placement.role}</h4>
                        <p className="text-gray-600">{placement.company}</p>
                        {placement.package && (
                          <p className="text-sm text-gray-700 mt-1">Package: {placement.package}</p>
                        )}
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        placement.status === 'accepted' ? 'bg-green-100 text-green-700' :
                        placement.status === 'joined' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {placement.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Certifications */}
          {profile?.certifications && profile.certifications.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Certifications</h3>
              <div className="space-y-3">
                {profile.certifications.map((cert, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg">
                    <h4 className="font-semibold text-gray-900">{cert.name}</h4>
                    <p className="text-sm text-gray-600">{cert.issuer}</p>
                    {cert.issueDate && (
                      <p className="text-xs text-gray-500 mt-1">Issued: {cert.issueDate}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Profile;
