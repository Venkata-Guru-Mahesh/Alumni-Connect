import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import aiApi from '../../api/ai.api';
import { Loader, ErrorAlert } from '../../components/shared';
import { FiTarget, FiTrendingUp, FiUsers, FiAward, FiBriefcase, FiBarChart2, FiCpu, FiAlertCircle, FiRefreshCw } from 'react-icons/fi';

const AICareer = () => {
  const { user, profileVersion } = useAuth();
  const [tfidfData, setTfidfData] = useState(null);
  const [mlData, setMlData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('tfidf'); // 'tfidf' or 'ml'
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      fetchAIData(false);
    } else {
      // Profile was updated — silently re-fetch without full-page loader
      fetchAIData(true);
    }
  }, [profileVersion]);

  const fetchAIData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');

      // Fetch both models in parallel
      const results = await Promise.allSettled([
        aiApi.getCareerRecommendations(),
        aiApi.getMLCareerAnalysis(),
      ]);

      // TF-IDF results
      if (results[0].status === 'fulfilled') {
        setTfidfData(results[0].value.data);
      }

      // ML results
      if (results[1].status === 'fulfilled') {
        setMlData(results[1].value.data);
      }

      // If both fail, show error
      if (results[0].status === 'rejected' && results[1].status === 'rejected') {
        setError('Failed to load AI recommendations. Please complete your profile for personalized results.');
      }
    } catch (err) {
      setError('Failed to load AI recommendations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader size="lg" />
      </div>
    );
  }

  const tfidf = tfidfData || {};
  const ml = mlData || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#A8422F] via-[#C4503A] to-[#E77E69] rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 mb-2">
            <FiTarget className="w-6 h-6" />
            <h1 className="text-2xl font-bold">AI Career Recommendations</h1>
          </div>
          <button
            onClick={() => fetchAIData(true)}
            disabled={refreshing}
            title="Refresh recommendations"
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-sm px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
          >
            <FiRefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        <p className="text-rose-100">
          Personalized career paths powered by TF-IDF similarity and ML prediction models
        </p>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}

      {/* Model Toggle Tabs */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('tfidf')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'tfidf'
              ? 'bg-white text-[#E77E69] shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <FiBarChart2 className="inline mr-1.5" />
          TF-IDF Model
        </button>
        <button
          onClick={() => setActiveTab('ml')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'ml'
              ? 'bg-white text-[#E77E69] shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <FiCpu className="inline mr-1.5" />
          ML Model (Profile Score)
        </button>
      </div>

      {/* =========== TF-IDF TAB =========== */}
      {activeTab === 'tfidf' && (
        <div className="space-y-6">
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              title="Mentor Matches"
              value={tfidf.recommended_mentors?.length || 0}
              icon={FiUsers}
              color="purple"
            />
            <StatCard
              title="Job Matches"
              value={tfidf.recommended_jobs?.length || 0}
              icon={FiBriefcase}
              color="blue"
            />
            <StatCard
              title="Career Paths"
              value={tfidf.career_paths?.length || 0}
              icon={FiTrendingUp}
              color="green"
            />
            <StatCard
              title="Skill Coverage"
              value={`${Math.round(tfidf.skill_analysis?.skill_coverage || 0)}%`}
              icon={FiAward}
              color="orange"
            />
          </div>

          {/* Skill Gap Analysis */}
          {tfidf.skill_analysis && (
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Skill Gap Analysis</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Based on your profile skills vs. open job market demand</p>
                </div>
                {(tfidf.skill_analysis.current_skills || []).length > 0 && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
                    {tfidf.skill_analysis.current_skills.length} skills in profile
                  </span>
                )}
              </div>

              {/* Current skills row */}
              {(tfidf.skill_analysis.current_skills || []).length > 0 && (
                <div className="mb-5">
                  <h3 className="text-sm font-medium text-gray-600 mb-1">Your Profile Skills</h3>
                  <p className="text-xs text-gray-400 mb-2">All skills from your profile — used as input to both AI models</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(tfidf.skill_analysis.current_skills || []).map((skill, i) => (
                      <span key={i} className="px-2.5 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-1">Matched In-Demand Skills</h3>
                  <p className="text-xs text-gray-400 mb-2">Your skills that are actively required by open job postings</p>
                  <div className="flex flex-wrap gap-2">
                    {(tfidf.skill_analysis.matching_in_demand_skills || []).map((skill, i) => (
                      <span key={i} className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                        {skill}
                      </span>
                    ))}
                    {(tfidf.skill_analysis.matching_in_demand_skills || []).length === 0 && (
                      <span className="text-gray-400 text-sm">No overlap with current job postings</span>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-1">Recommended to Learn</h3>
                  <p className="text-xs text-gray-400 mb-2">High-demand skills missing from your profile</p>
                  <div className="space-y-2">
                    {(tfidf.skill_analysis.recommended_skills_to_learn || []).slice(0, 6).map((item, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-sm text-gray-800">{item.skill}</span>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {item.demand_count} job{item.demand_count !== 1 ? 's' : ''} require this
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recommended Mentors */}
          {tfidf.recommended_mentors?.length > 0 && (
            <div>
              <div className="flex items-baseline gap-2 mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Recommended Alumni Mentors</h2>
                <span className="text-xs text-gray-400">% = skill overlap with your profile</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tfidf.recommended_mentors.map((mentor, i) => (
                  <div key={i} className="bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#C4503A] to-[#E77E69] rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {(mentor.name || '?')[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{mentor.name}</h3>
                        <p className="text-sm text-gray-500 truncate">{mentor.designation} at {mentor.company}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-[#E77E69] h-2 rounded-full"
                          style={{ width: `${Math.min(mentor.similarity_score, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-[#E77E69]">{mentor.similarity_score}%</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(mentor.skills || []).slice(0, 3).map((skill, j) => (
                        <span key={j} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {typeof skill === 'object' ? skill.name : skill}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Career Paths */}
          {tfidf.career_paths?.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Career Paths from Alumni Data</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {tfidf.career_paths.map((path, i) => (
                  <div key={i} className="bg-white rounded-xl shadow-sm border p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-900">{path.industry}</h3>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                        {path.count} alumni
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">Common role: {path.common_designation}</p>
                    <p className="text-sm text-gray-500 mb-3">Avg. experience: {path.avg_experience} years</p>
                    {path.companies?.length > 0 && (
                      <div className="mb-2">
                        <span className="text-xs text-gray-500">Companies: </span>
                        <span className="text-xs text-gray-700">{path.companies.join(', ')}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {(path.skills || []).slice(0, 5).map((skill, j) => (
                        <span key={j} className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded">
                          {typeof skill === 'object' ? skill.name : skill}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Job Recommendations */}
          {tfidf.recommended_jobs?.length > 0 && (
            <div>
              <div className="flex items-baseline gap-2 mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Job Recommendations</h2>
                <span className="text-xs text-gray-400">% = matching required skills you have</span>
              </div>
              <div className="space-y-3">
                {tfidf.recommended_jobs.slice(0, 5).map((job, i) => {
                  const reqCount = (job.skills_required || []).length;
                  return (
                    <div key={i} className="bg-white rounded-xl shadow-sm border p-4 flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">{job.title}</h3>
                        <p className="text-sm text-gray-500">{job.company} - {job.location}</p>
                        <div className="flex gap-1 mt-1">
                          {(job.skills_required || []).slice(0, 4).map((s, j) => (
                            <span key={j} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{s}</span>
                          ))}
                          {reqCount > 4 && (
                            <span className="text-xs text-gray-400">+{reqCount - 4} more</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <span className={`text-lg font-bold ${
                          job.match_score >= 70 ? 'text-green-600' : job.match_score >= 40 ? 'text-[#E77E69]' : 'text-gray-500'
                        }`}>{job.match_score}%</span>
                        <p className="text-xs text-gray-500">skills match</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!tfidf.recommended_mentors?.length && !tfidf.career_paths?.length && !tfidf.recommended_jobs?.length && (
            <EmptyState message="Complete your profile with skills and interests to get TF-IDF based recommendations." />
          )}
        </div>
      )}

      {/* =========== ML TAB =========== */}
      {activeTab === 'ml' && (
        <div className="space-y-6">
          {ml.placement_prediction ? (
            <>
              {/* ML Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                  title="Placement Probability"
                  value={`${parseFloat(ml.placement_prediction?.placement_probability || 0).toFixed(2)}%`}
                  icon={FiTarget}
                  color="green"
                />
                <StatCard
                  title="Expected Salary"
                  value={
                    ml.salary_prediction?.predicted_salary
                      ? `${(ml.salary_prediction.predicted_salary / 100000).toFixed(1)} LPA`
                      : 'N/A'
                  }
                  icon={FiTrendingUp}
                  color="blue"
                />
                <StatCard
                  title="Confidence"
                  value={ml.placement_prediction?.confidence_level || 'N/A'}
                  icon={FiAward}
                  color="purple"
                />
              </div>

              {/* Placement Prediction Details */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Placement Prediction</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-600">Placement Probability</span>
                        <span className="font-bold text-[#E77E69]">
                          {parseFloat(ml.placement_prediction?.placement_probability || 0).toFixed(2)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full ${
                            (ml.placement_prediction?.placement_probability || 0) >= 70
                              ? 'bg-green-500'
                              : (ml.placement_prediction?.placement_probability || 0) >= 50
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(ml.placement_prediction?.placement_probability || 0, 100)}%` }}
                        />
                      </div>
                    </div>
                    {ml.placement_prediction?.key_factors?.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-600 mb-2">Key Factors</h3>
                        <ul className="space-y-1">
                          {ml.placement_prediction.key_factors.map((factor, i) => (
                            <li key={i} className="text-sm text-gray-700 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 bg-[#E77E69] rounded-full" />
                              {factor}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div>
                    {ml.salary_prediction && (
                      <div className="mb-4">
                        <h3 className="text-sm font-medium text-gray-600 mb-2">Salary Prediction</h3>
                        <p className="text-2xl font-bold text-gray-900">
                          {ml.salary_prediction?.predicted_salary
                            ? `${(ml.salary_prediction.predicted_salary / 100000).toFixed(1)} LPA`
                            : ml.salary_prediction?.message || 'N/A'}
                        </p>
                        {ml.salary_prediction?.salary_range_min && ml.salary_prediction?.salary_range_max && (
                          <p className="text-sm text-gray-500">
                            Range: {(ml.salary_prediction.salary_range_min / 100000).toFixed(1)} - {(ml.salary_prediction.salary_range_max / 100000).toFixed(1)} LPA
                          </p>
                        )}
                      </div>
                    )}
                    {ml.placement_prediction?.recommendation && (
                      <div className="bg-blue-50 rounded-lg p-3 mb-3">
                        <p className="text-sm text-blue-800">{ml.placement_prediction.recommendation}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Profile Analysis */}
              {ml.profile_analysis && (
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile Analysis</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {ml.profile_analysis.strengths?.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-green-700 mb-2">Strengths</h3>
                        <ul className="space-y-1">
                          {ml.profile_analysis.strengths.map((s, i) => (
                            <li key={i} className="text-sm text-gray-700 flex items-center gap-2">
                              <span className="text-green-500">+</span> {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {ml.profile_analysis.areas_for_improvement?.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-orange-700 mb-2">Areas to Improve</h3>
                        <ul className="space-y-1">
                          {ml.profile_analysis.areas_for_improvement.map((s, i) => (
                            <li key={i} className="text-sm text-gray-700 flex items-center gap-2">
                              <span className="text-orange-500">-</span> {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Next Steps */}
              {ml.next_steps?.length > 0 && (
                <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Recommended Next Steps</h2>
                  <div className="space-y-3">
                    {ml.next_steps.map((step, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-[#E77E69] rounded-full flex items-center justify-center text-white text-sm font-bold">
                          {i + 1}
                        </div>
                        <span className="text-sm text-gray-700">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Model Info */}
              {ml.models_used && (
                <div className="bg-gray-50 rounded-xl border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FiCpu className="text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Models Used</span>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>Placement: {ml.models_used.placement}</span>
                    <span>Salary: {ml.models_used.salary}</span>
                  </div>
                  {ml.disclaimer && (
                    <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                      <FiAlertCircle className="w-3 h-3" />
                      {ml.disclaimer}
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <EmptyState message="ML career analysis is not available yet. Make sure your profile is complete with skills, CGPA, and department information." />
          )}
        </div>
      )}
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color }) => {
  const colorMap = {
    purple: 'bg-purple-50 text-purple-600',
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color] || colorMap.blue}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
};

const EmptyState = ({ message }) => (
  <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
    <FiAlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
    <p className="text-gray-500">{message}</p>
  </div>
);

export default AICareer;
