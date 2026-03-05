import { useState, useEffect } from 'react';
import adminApi from '../../api/admin.api';
import { Loader, ErrorAlert, Pagination, ConfirmModal, Modal } from '../../components/shared';
import { FiUsers, FiUserCheck, FiGrid, FiCalendar, FiSearch, FiEye, FiTrash2, FiChevronDown } from 'react-icons/fi';
import { DEPARTMENTS_LIST, BRANCH_FULL_NAMES } from '../../utils/rollNumberUtils';

const DEPT_LABEL = (code) => {
  if (!code) return '\u2013';
  const upper = code.toUpperCase();
  if (BRANCH_FULL_NAMES[upper]) return BRANCH_FULL_NAMES[upper];
  const found = DEPARTMENTS_LIST.find((d) => d.value === code.toLowerCase() || d.short === upper);
  return found ? found.label : code.toUpperCase();
};

const DEPT_BADGE = {
  cse: 'bg-blue-100 text-blue-700',
  csm: 'bg-indigo-100 text-indigo-700',
  cso: 'bg-cyan-100 text-cyan-700',
  cic: 'bg-teal-100 text-teal-700',
  ece: 'bg-purple-100 text-purple-700',
  eee: 'bg-yellow-100 text-yellow-700',
  mec: 'bg-orange-100 text-orange-700',
  civ: 'bg-stone-100 text-stone-700',
  it:  'bg-pink-100 text-pink-700',
  aid: 'bg-rose-100 text-rose-700',
  aiml:'bg-primary-100 text-primary-700',
};

const StatCard = ({ icon: Icon, label, value, colorClass, bgClass, borderClass }) => (
  <div className={`rounded-xl border ${borderClass} ${bgClass} p-5 flex items-center gap-4 shadow-sm`}>
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-white/60 shadow-sm flex-shrink-0 ${colorClass}`}>
      <Icon className="w-6 h-6" />
    </div>
    <div>
      <p className={`text-xs font-semibold uppercase tracking-wide opacity-80 ${colorClass}`}>{label}</p>
      <p className={`text-3xl font-bold ${colorClass}`}>{value}</p>
    </div>
  </div>
);

const StudentAvatar = ({ student }) => {
  const name = student.name || 'Student';
  const initials = name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  const deptKey = (student.department || '').toLowerCase();
  const gradient = {
    cse: 'from-blue-400 to-blue-600', csm: 'from-indigo-400 to-indigo-600',
    ece: 'from-purple-400 to-purple-600', eee: 'from-yellow-400 to-yellow-600',
    mec: 'from-orange-400 to-orange-600', civ: 'from-stone-400 to-stone-600',
    it: 'from-pink-400 to-pink-600', aid: 'from-rose-400 to-rose-600',
    aiml: 'from-violet-400 to-violet-600', cso: 'from-cyan-400 to-cyan-600',
    cic: 'from-teal-400 to-teal-600',
  }[deptKey] || 'from-gray-400 to-gray-600';

  if (student.avatar) {
    return <img src={student.avatar} alt={name} className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm" />;
  }
  return (
    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-sm font-bold ring-2 ring-white shadow-sm flex-shrink-0`}>
      {initials}
    </div>
  );
};

const ManageStudents = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [deleteStudent, setDeleteStudent] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => { fetchStudents(); }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getStudents();
      const raw = Array.isArray(response.data)
        ? response.data
        : response.data?.results || [];

      // API returns UserWithProfileSerializer → flat user + nested profile
      const transformed = raw.map((s) => ({
        id: s.id,
        name: s.full_name || `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Unknown',
        email: s.email,
        avatar: s.avatar || s.profile?.profile_picture,
        department: s.department || s.profile?.department || '',
        year: s.profile?.current_year || 1,
        roll_number: s.profile?.roll_number || s.profile?.roll_no || '',
        cgpa: s.profile?.cgpa || null,
        batch_year: s.profile?.batch_year || null,
        graduation_year: s.profile?.graduation_year || null,
        active: s.is_active !== false,
        skills: s.profile?.skills || [],
      }));

      setStudents(transformed);
    } catch (err) {
      setError('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async () => {
    try {
      setProcessing(true);
      await adminApi.deactivateStudent(deleteStudent.id);
      setDeleteStudent(null);
      fetchStudents();
    } catch (err) {
      setError('Failed to deactivate student');
    } finally {
      setProcessing(false);
    }
  };

  const filteredStudents = students.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.roll_number?.toLowerCase().includes(q) ||
      s.department?.toLowerCase().includes(q);
    const matchDept = !deptFilter || s.department?.toLowerCase() === deptFilter;
    const matchYear = !yearFilter || String(s.year) === yearFilter;
    return matchSearch && matchDept && matchYear;
  });

  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const activeCount = students.filter((s) => s.active !== false).length;
  const deptCount = new Set(students.map((s) => s.department).filter(Boolean)).size;
  const currentYear = new Date().getFullYear();
  const thisYearCount = students.filter(
    (s) => s.batch_year === currentYear || s.batch_year === currentYear - 1
  ).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-[#A8422F] via-[#C4503A] to-[#E77E69] rounded-2xl p-6 text-white shadow-lg">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manage Students</h1>
          <p className="text-rose-100 mt-1 text-sm">
            View and manage all student accounts across departments
          </p>
        </div>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={FiUsers}     label="Total Students" value={students.length} colorClass="text-primary-700" bgClass="bg-primary-50"  borderClass="border-primary-200" />
        <StatCard icon={FiUserCheck} label="Active"         value={activeCount}     colorClass="text-emerald-700" bgClass="bg-emerald-50" borderClass="border-emerald-200" />
        <StatCard icon={FiGrid}      label="Departments"    value={deptCount}       colorClass="text-indigo-700" bgClass="bg-indigo-50"  borderClass="border-indigo-200" />
        <StatCard icon={FiCalendar}  label="Recent Batch"   value={thisYearCount}   colorClass="text-orange-700" bgClass="bg-orange-50"  borderClass="border-orange-200" />
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Filters Bar */}
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-gray-100">
          <div className="relative flex-1 max-w-sm">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Search by name, email, roll no..."
              className="w-full pl-10 pr-4 py-2.5 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition-all placeholder-gray-400"
            />
          </div>
          <div className="relative">
            <select
              value={deptFilter}
              onChange={(e) => { setDeptFilter(e.target.value); setCurrentPage(1); }}
              className="appearance-none pl-3 pr-9 py-2.5 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition-all"
            >
              <option value="">All Departments</option>
              {DEPARTMENTS_LIST.map((d) => (
                <option key={d.value} value={d.value}>{d.short} — {d.label}</option>
              ))}
            </select>
            <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={yearFilter}
              onChange={(e) => { setYearFilter(e.target.value); setCurrentPage(1); }}
              className="appearance-none pl-3 pr-9 py-2.5 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition-all"
            >
              <option value="">All Years</option>
              <option value="1">1st Year</option>
              <option value="2">2nd Year</option>
              <option value="3">3rd Year</option>
              <option value="4">4th Year</option>
            </select>
            <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          {(searchQuery || deptFilter || yearFilter) && (
            <button
              onClick={() => { setSearchQuery(''); setDeptFilter(''); setYearFilter(''); setCurrentPage(1); }}
              className="text-sm text-primary-600 hover:text-primary-800 font-medium px-3 py-2.5 rounded-xl hover:bg-primary-50 transition-colors whitespace-nowrap"
            >
              Clear filters
            </button>
          )}
          <div className="sm:ml-auto flex items-center text-sm text-gray-500 px-1 whitespace-nowrap">
            <span className="font-semibold text-gray-700">{filteredStudents.length}</span>&nbsp;student{filteredStudents.length !== 1 ? 's' : ''}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader size="lg" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Year</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">CGPA</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedStudents.map((student) => {
                  const deptKey = (student.department || '').toLowerCase();
                  const badgeCls = DEPT_BADGE[deptKey] || 'bg-gray-100 text-gray-700';
                  const isActive = student.active !== false;
                  return (
                    <tr key={student.id} className="hover:bg-primary-50/30 transition-colors group">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <StudentAvatar student={student} />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{student.name}</p>
                            <p className="text-xs text-gray-500 truncate">{student.roll_number || student.email}</p>
                            {student.roll_number && <p className="text-xs text-gray-400 truncate">{student.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full border ${badgeCls} border-current/20`}>
                          {student.department ? (student.department.toUpperCase()) : '—'}
                        </span>
                        {student.department && (
                          <p className="text-xs text-gray-400 mt-0.5 max-w-[160px] truncate" title={DEPT_LABEL(student.department)}>
                            {DEPT_LABEL(student.department)}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600">
                        {student.year ? `Year ${student.year}` : '—'}
                        {student.batch_year && <p className="text-xs text-gray-400">Batch {student.batch_year}</p>}
                      </td>
                      <td className="px-5 py-4">
                        {student.cgpa ? (
                          <span className={`text-sm font-semibold ${parseFloat(student.cgpa) >= 8 ? 'text-emerald-600' : parseFloat(student.cgpa) >= 6 ? 'text-amber-600' : 'text-rose-600'}`}>
                            {parseFloat(student.cgpa).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setSelectedStudent(student)}
                            title="View details"
                            className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          >
                            <FiEye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteStudent(student)}
                            title="Deactivate"
                            className="p-2 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {paginatedStudents.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <FiSearch className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">No students found</p>
                {(searchQuery || deptFilter || yearFilter) && (
                  <p className="text-xs mt-1">Try adjusting your search or filters</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && filteredStudents.length > itemsPerPage && (
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(filteredStudents.length / itemsPerPage)}
          onPageChange={setCurrentPage}
        />
      )}

      {/* Deactivate Confirmation */}
      <ConfirmModal
        isOpen={!!deleteStudent}
        onClose={() => setDeleteStudent(null)}
        onConfirm={handleDeactivate}
        title="Deactivate Student"
        message={`Are you sure you want to deactivate ${deleteStudent?.name}'s account?`}
        confirmText={processing ? 'Deactivating...' : 'Deactivate'}
        variant="danger"
      />

      {/* Student Detail Modal */}
      {selectedStudent && (
        <Modal
          isOpen={!!selectedStudent}
          onClose={() => setSelectedStudent(null)}
          title="Student Details"
          size="md"
        >
          <div className="space-y-5">
            <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
              <StudentAvatar student={selectedStudent} />
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-gray-900">{selectedStudent.name}</h3>
                <p className="text-sm text-gray-500 truncate">{selectedStudent.email}</p>
                {selectedStudent.roll_number && (
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{selectedStudent.roll_number}</p>
                )}
              </div>
              <span className={`ml-auto shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${selectedStudent.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${selectedStudent.active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                {selectedStudent.active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">Department</p>
                <p className="text-sm font-bold text-gray-900">{selectedStudent.department?.toUpperCase() || '\u2013'}</p>
                <p className="text-xs text-gray-500 mt-0.5">{DEPT_LABEL(selectedStudent.department)}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">Year</p>
                <p className="text-sm font-bold text-gray-900">{selectedStudent.year ? `Year ${selectedStudent.year}` : '\u2013'}</p>
                {selectedStudent.batch_year && <p className="text-xs text-gray-500 mt-0.5">Batch {selectedStudent.batch_year}</p>}
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">CGPA</p>
                <p className={`text-sm font-bold ${!selectedStudent.cgpa ? 'text-gray-400' : parseFloat(selectedStudent.cgpa) >= 8 ? 'text-emerald-600' : parseFloat(selectedStudent.cgpa) >= 6 ? 'text-amber-600' : 'text-rose-600'}`}>
                  {selectedStudent.cgpa ? parseFloat(selectedStudent.cgpa).toFixed(2) : 'N/A'}
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">Graduation</p>
                <p className="text-sm font-bold text-gray-900">{selectedStudent.graduation_year || '\u2013'}</p>
              </div>
            </div>

            {selectedStudent.skills?.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedStudent.skills.map((skill, i) => (
                    <span key={i} className="px-2.5 py-1 bg-primary-50 text-primary-700 text-xs font-medium rounded-full border border-primary-200">
                      {typeof skill === 'object' ? (skill.name || JSON.stringify(skill)) : skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => { setDeleteStudent(selectedStudent); setSelectedStudent(null); }}
                className="flex-1 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-rose-200"
              >
                {selectedStudent.active ? 'Deactivate Account' : 'Reactivate Account'}
              </button>
              <button
                onClick={() => setSelectedStudent(null)}
                className="flex-1 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-xl transition-colors border border-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ManageStudents;
