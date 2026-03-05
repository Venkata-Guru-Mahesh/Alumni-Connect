"""
URL Configuration for Alumni Connect API.
"""
from django.urls import path, include
from api import views
from apps.accounts import views as auth_views
from apps.students import views as student_views
from apps.blogs import views as blog_views
from apps.ai_engine import views as ai_views
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    # Auth (using OTP-based authentication from apps.accounts)
    path('auth/register/', auth_views.RegisterView.as_view(), name='register'),
    path('auth/verify-otp/', auth_views.VerifyOTPView.as_view(), name='verify_otp'),
    path('auth/resend-otp/', auth_views.ResendOTPView.as_view(), name='resend_otp'),
    path('auth/login/', auth_views.LoginView.as_view(), name='login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='refresh'),
    path('auth/me/', auth_views.MeView.as_view(), name='me'),
    path('auth/counsellors/', auth_views.CounsellorListView.as_view(), name='counsellor-list'),
    
    # File Upload
    path('upload/image/', views.ImageUploadView.as_view(), name='image-upload'),
    path('upload/document-proxy/', views.DocumentProxyView.as_view(), name='document-proxy'),
    
    # Utilities
    path('utils/roll-number/', views.RollNumberUtilsView.as_view(), name='roll-number-utils'),
    
    # Students (Django ORM)
    path('students/', student_views.StudentListView.as_view(), name='student-list'),
    path('students/profile/', views.StudentProfileView.as_view(), name='student-profile'),  # Keep old for now
    path('students/<int:pk>/', student_views.StudentDetailView.as_view(), name='student-detail'),
    path('students/stats/', student_views.StudentStatsView.as_view(), name='student-stats'),
    path('admin/students/<int:pk>/toggle-status/', student_views.AdminStudentToggleView.as_view(), name='admin-student-toggle'),
    
    # Alumni (MongoDB)
    path('alumni/', views.AlumniListView.as_view(), name='alumni-list'),
    path('alumni/profile/', views.AlumniProfileView.as_view(), name='alumni-profile'),
    path('alumni/<str:alumni_id>/', views.AlumniDetailView.as_view(), name='alumni-detail'),
    
    # Blogs (Django ORM)
    path('blogs/', blog_views.BlogListCreateView.as_view(), name='blog-list'),
    path('blogs/my/', blog_views.MyBlogsView.as_view(), name='my-blogs'),
    path('blogs/saved/', blog_views.SavedBlogsView.as_view(), name='saved-blogs'),
    path('blogs/comments/<int:pk>/', blog_views.BlogCommentDetailView.as_view(), name='blog-comment-detail'),
    # PK-based endpoints (must be before slug catch-all)
    path('blogs/<int:pk>/', blog_views.BlogDetailByPkView.as_view(), name='blog-detail-pk'),
    path('blogs/<int:pk>/like/', blog_views.BlogLikeByPkView.as_view(), name='blog-like-pk'),
    path('blogs/<int:pk>/comments/', blog_views.BlogCommentsByPkView.as_view(), name='blog-comments-pk'),
    path('blogs/<int:pk>/save/', blog_views.BlogSaveView.as_view(), name='blog-save-pk'),
    # Slug-based endpoints
    path('blogs/<slug:slug>/', blog_views.BlogDetailView.as_view(), name='blog-detail'),
    path('blogs/<slug:slug>/like/', blog_views.BlogLikeView.as_view(), name='blog-like'),
    path('blogs/<slug:slug>/comments/', blog_views.BlogCommentListCreateView.as_view(), name='blog-comments'),
    
    # Jobs
    path('jobs/', views.JobListView.as_view(), name='job-list'),
    path('jobs/saved/', views.SavedJobsListView.as_view(), name='saved-jobs-list'),
    path('jobs/<str:job_id>/', views.JobDetailView.as_view(), name='job-detail'),
    path('jobs/<str:job_id>/save/', views.JobSaveView.as_view(), name='job-save'),
    
    # Events
    path('events/', views.EventListView.as_view(), name='event-list'),
    path('events/<str:event_id>/', views.EventDetailView.as_view(), name='event-detail'),
    
    # AI Engine - TF-IDF based
    path('ai/mentors/', ai_views.MentorRecommendationView.as_view(), name='mentor-recommendations'),
    path('ai/career-recommendation/', ai_views.CareerRecommendationView.as_view(), name='career-recommendation'),
    path('ai/career-recommendation/<int:student_id>/', ai_views.CareerRecommendationView.as_view(), name='career-recommendation-student'),
    path('ai/jobs/', ai_views.JobRecommendationView.as_view(), name='job-recommendations'),
    path('ai/skill-gap/', ai_views.SkillGapAnalysisView.as_view(), name='skill-gap-analysis'),
    path('ai/career-paths/', ai_views.CareerPathsView.as_view(), name='career-paths'),
    path('ai/batch-report/', ai_views.BatchCareerReportView.as_view(), name='batch-report'),
    
    # AI Engine - ML-powered (XGBoost/LightGBM)
    path('ai/ml/mentors/', ai_views.MLMentorRecommendationView.as_view(), name='ml-mentor-recommendations'),
    path('ai/ml/prediction/', ai_views.MLMentorshipPredictionView.as_view(), name='ml-mentorship-prediction'),
    path('ai/ml/batch-analysis/', ai_views.MLBatchMentorAnalysisView.as_view(), name='ml-batch-analysis'),
    path('ai/ml/placement/', ai_views.MLPlacementPredictionView.as_view(), name='ml-placement-prediction'),
    path('ai/ml/salary/', ai_views.MLSalaryPredictionView.as_view(), name='ml-salary-prediction'),
    path('ai/ml/career-analysis/', ai_views.MLCareerAnalysisView.as_view(), name='ml-career-analysis'),
    path('ai/ml/batch-career-analysis/', ai_views.MLBatchCareerAnalysisView.as_view(), name='ml-batch-career-analysis'),
    
    # Counsellor
    path('counsellor/stats/', views.CounsellorStatsView.as_view(), name='counsellor-stats'),
    path('counsellor/insights/', views.CounsellorInsightsView.as_view(), name='counsellor-insights'),
    path('counsellor/students/', views.CounsellorStudentsView.as_view(), name='counsellor-students'),
    path('counsellor/students/<str:student_id>/', views.CounsellorStudentDetailView.as_view(), name='counsellor-student-detail'),
    path('counsellor/alumni/', views.CounsellorAlumniView.as_view(), name='counsellor-alumni'),

    # Principal
    path('principal/stats/', views.PrincipalStatsView.as_view(), name='principal-stats'),
    path('principal/students/', views.PrincipalStudentsView.as_view(), name='principal-students'),
    path('principal/alumni/', views.PrincipalAlumniView.as_view(), name='principal-alumni'),
    path('principal/insights/', views.PrincipalInsightsView.as_view(), name='principal-insights'),

    # HOD
    path('hod/stats/', views.HODStatsView.as_view(), name='hod-stats'),
    path('hod/counsellors/', views.HODCounsellorsView.as_view(), name='hod-counsellors'),
    path('hod/students/', views.HODStudentsView.as_view(), name='hod-students'),
    path('hod/alumni/', views.HODAlumniView.as_view(), name='hod-alumni'),
    path('hod/insights/', views.HODInsightsView.as_view(), name='hod-insights'),
    
    # Dashboard
    path('dashboard/stats/', views.DashboardStatsView.as_view(), name='dashboard-stats'),
    
    # Admin
    path('admin/recent-users/', views.AdminRecentUsersView.as_view(), name='admin-recent-users'),
    path('admin/settings/', views.AdminSettingsView.as_view(), name='admin-settings'),
    path('admin/users/', views.AdminUsersListView.as_view(), name='admin-users-list'),
    path('admin/users/<str:user_id>/', views.AdminUserDetailView.as_view(), name='admin-user-detail'),
    path('admin/users/<str:user_id>/toggle-status/', views.AdminUserToggleStatusView.as_view(), name='admin-user-toggle-status'),
    path('admin/alumni/pending/', views.AdminPendingAlumniView.as_view(), name='admin-pending-alumni'),
    path('admin/alumni/<str:alumni_id>/verify/', views.AlumniVerificationActionView.as_view(), {'action': 'approve'}, name='admin-approve-alumni'),
    path('admin/alumni/<str:alumni_id>/reject/', views.AlumniVerificationActionView.as_view(), {'action': 'reject'}, name='admin-reject-alumni'),
]
