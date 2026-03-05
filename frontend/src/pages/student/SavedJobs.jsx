import { useState, useEffect } from 'react';
import studentApi from '../../api/student.api';
import { JobCard, BlogList } from '../../components/student';
import { SearchBar, Loader, ErrorAlert, EmptyState, BlogDetailModal } from '../../components/shared';
import { FiBookmark, FiFilter, FiBriefcase, FiFileText } from 'react-icons/fi';

const SavedJobs = () => {
  const [savedJobs, setSavedJobs] = useState([]);
  const [savedBlogs, setSavedBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('jobs');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [selectedBlog, setSelectedBlog] = useState(null);

  useEffect(() => {
    fetchSavedItems();
  }, []);

  const fetchSavedItems = async () => {
    try {
      setLoading(true);
      const [jobsRes, blogsRes] = await Promise.all([
        studentApi.getSavedJobs().catch(() => ({ data: { jobs: [] } })),
        studentApi.getSavedBlogs().catch(() => ({ data: [] })),
      ]);
      setSavedJobs(Array.isArray(jobsRes.data) ? jobsRes.data : (jobsRes.data?.jobs || []));
      const blogsData = Array.isArray(blogsRes.data) ? blogsRes.data : (blogsRes.data?.results || []);
      setSavedBlogs(blogsData);
    } catch (err) {
      console.error('Failed to load saved items:', err);
      setError('Failed to load saved items');
    } finally {
      setLoading(false);
    }
  };

  const handleUnsaveJob = async (jobId) => {
    try {
      await studentApi.unsaveJob(jobId);
      setSavedJobs(savedJobs.filter(job => job.id !== jobId));
    } catch (err) {
      console.error('Failed to remove bookmark:', err);
      const errorMsg = err.response?.data?.message || 'Failed to remove bookmark. Please try again.';
      alert(errorMsg);
    }
  };

  const filteredJobs = savedJobs.filter((job) => {
    const matchesSearch = !searchQuery || 
      job.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.skills_required?.some(skill => skill.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = !filterType || job.job_type === filterType;
    return matchesSearch && matchesType;
  });

  const filteredBlogs = savedBlogs.filter((b) =>
    !searchQuery ||
    b.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const jobTypes = ['All', 'full_time', 'part_time', 'internship', 'contract'];
  const jobTypeLabels = {
    'All': 'All', 'full_time': 'Full-time', 'part_time': 'Part-time',
    'internship': 'Internship', 'contract': 'Contract',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <FiBookmark className="w-6 h-6 text-primary-600" />
          <h1 className="text-2xl font-bold text-gray-900">Saved Items</h1>
        </div>
        <p className="text-gray-500">Jobs and posts you've bookmarked for later review</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card text-center">
          <FiBriefcase className="w-6 h-6 text-primary-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-primary-600">{savedJobs.length}</p>
          <p className="text-sm text-gray-500">Saved Jobs</p>
        </div>
        <div className="card text-center">
          <FiFileText className="w-6 h-6 text-purple-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-purple-600">{savedBlogs.length}</p>
          <p className="text-sm text-gray-500">Saved Posts</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('jobs')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'jobs'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Jobs ({savedJobs.length})
        </button>
        <button
          onClick={() => setActiveTab('posts')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'posts'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Posts ({savedBlogs.length})
        </button>
      </div>

      {/* Search & Filters (jobs tab only) */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 max-w-md">
          <SearchBar
            value={searchQuery}
            onChange={(v) => setSearchQuery(v)}
            placeholder={activeTab === 'jobs' ? 'Search saved jobs...' : 'Search saved posts...'}
          />
        </div>
        {activeTab === 'jobs' && (
          <div className="flex gap-2 flex-wrap">
            {jobTypes.map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type === 'All' ? '' : type)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  (filterType === '' && type === 'All') || filterType === type
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {jobTypeLabels[type]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && <ErrorAlert message={error} onClose={() => setError('')} />}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader size="lg" />
        </div>
      ) : activeTab === 'jobs' ? (
        savedJobs.length === 0 ? (
          <EmptyState
            icon={FiBookmark}
            title="No saved jobs yet"
            description="Bookmark jobs you're interested in to find them here later"
            actionText="Browse Jobs"
            actionLink="/student/jobs"
          />
        ) : filteredJobs.length === 0 ? (
          <EmptyState
            icon={FiFilter}
            title="No jobs match your filters"
            description="Try adjusting your search criteria"
          />
      ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onSave={handleUnsaveJob}
                isSaved={true}
              />
            ))}
          </div>
        )
      ) : /* Posts tab */ (
        savedBlogs.length === 0 ? (
          <EmptyState
            icon={FiBookmark}
            title="No saved posts yet"
            description="Bookmark blog posts from the Blogs page to find them here later"
            actionText="Browse Blogs"
            actionLink="/student/blogs"
          />
        ) : filteredBlogs.length === 0 ? (
          <EmptyState
            icon={FiFilter}
            title="No posts match your search"
            description="Try adjusting your search criteria"
          />
        ) : (
          <BlogList blogs={filteredBlogs} onViewDetail={setSelectedBlog} />
        )
      )}

      {/* Blog Detail Modal */}
      {selectedBlog && (
        <BlogDetailModal
          blog={selectedBlog}
          onClose={() => setSelectedBlog(null)}
        />
      )}
    </div>
  );
};

export default SavedJobs;
