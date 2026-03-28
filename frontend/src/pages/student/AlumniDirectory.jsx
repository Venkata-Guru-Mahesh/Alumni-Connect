import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import studentApi from '../../api/student.api';
import alumniApi from '../../api/alumni.api';
import {
  AlumniList,
  AlumniFilters,
  AlumniProfileModal,
} from '../../components/student';
import { SearchBar, Pagination, Loader, ErrorAlert, EmptyState } from '../../components/shared';
import { FiUsers } from 'react-icons/fi';

const AlumniDirectory = () => {
  const { user } = useAuth();
  const [alumni, setAlumni] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAlumni, setSelectedAlumni] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    department: '',
    graduationYear: '',
    company: '',
    location: '',
    search: '',
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 20,
  });

  useEffect(() => {
    fetchAlumni();
  }, [filters, pagination.currentPage]);

  useEffect(() => {
    setPagination((prev) =>
      prev.currentPage === 1 ? prev : { ...prev, currentPage: 1 }
    );
  }, [filters]);

  const fetchAlumni = async () => {
    try {
      setLoading(true);
      // Use appropriate API based on user role
      const api = user?.role === 'alumni' ? alumniApi : studentApi;
      const response = await api.getAlumniDirectory({
        department: filters.department,
        graduation_year: filters.graduationYear,
        company: filters.company,
        location: filters.location,
        search: filters.search,
        page: pagination.currentPage,
      });
      // Backend returns paginated data: {results: [], count: X, page: Y}
      const alumniData = Array.isArray(response.data) ? response.data : response.data.results || [];
      setAlumni(alumniData);
      // In real API, pagination info would come from response
      const totalCount = response.data.count || alumniData.length;
      setPagination((prev) => ({
        ...prev,
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / prev.itemsPerPage),
      }));
    } catch (err) {
      setError('Failed to load alumni directory');
    } finally {
      setLoading(false);
    }
  };

  const handleAlumniClick = (alumniData) => {
    setSelectedAlumni(alumniData);
    setModalOpen(true);
  };

  const handleClearFilters = () => {
    setFilters({
      department: '',
      graduationYear: '',
      company: '',
      location: '',
      search: '',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Alumni Directory</h1>
        <p className="text-gray-500">
          Connect with alumni from your institution
        </p>
      </div>

      {/* Search */}
      <div className="max-w-md">
        <SearchBar
          value={filters.search}
          onChange={(value) => setFilters({ ...filters, search: value })}
          placeholder="Search by name, company, or skills..."
        />
      </div>

      {/* Filters */}
      <AlumniFilters
        filters={filters}
        onChange={setFilters}
        onClear={handleClearFilters}
      />

      {/* Error Alert */}
      {error && <ErrorAlert message={error} onClose={() => setError('')} />}

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader size="lg" />
        </div>
      ) : alumni.length === 0 ? (
        <EmptyState
          icon={FiUsers}
          title="No alumni found"
          description="Try adjusting your filters or search terms"
          action={handleClearFilters}
          actionLabel="Clear Filters"
        />
      ) : (
        <>
          <div className="text-sm text-gray-500">
            Showing {alumni.length} alumni
          </div>

          {/* List View */}
          <AlumniList alumni={alumni} onClick={handleAlumniClick} />

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <Pagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              itemsPerPage={pagination.itemsPerPage}
              onPageChange={(page) =>
                setPagination({ ...pagination, currentPage: page })
              }
            />
          )}
        </>
      )}

      {/* Alumni Profile Modal */}
      <AlumniProfileModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        alumni={selectedAlumni}
      />
    </div>
  );
};

export default AlumniDirectory;
