"""
Views for alumni-related operations.
"""
from rest_framework import generics, permissions
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from django.db.models import Count
from django.db.models import Q

from common.permissions import RolePermission, ScopePermission, DepartmentPermission
from common.utils import success_response, error_response
from apps.accounts.models import AlumniProfile
from apps.accounts.serializers import AlumniProfileSerializer, UserWithProfileSerializer

User = get_user_model()


class AlumniListView(generics.ListAPIView):
    """
    List all verified alumni.
    - Students can see verified alumni
    - Counsellors can see all alumni
    - HODs can see alumni from their department
    - Admin can see all alumni
    """
    
    serializer_class = UserWithProfileSerializer
    permission_classes = [permissions.IsAuthenticated, ScopePermission]
    required_scopes = ['read:alumni', 'read:department_alumni', 'manage:alumni']
    filterset_fields = ['department', 'is_verified']
    search_fields = ['email', 'first_name', 'last_name']
    ordering_fields = ['created_at', 'first_name']
    
    def get_queryset(self):
        queryset = User.objects.filter(role='alumni', is_active=True)
        
        user_role = getattr(self.request, 'jwt_role', self.request.user.role)
        
        # Students can only see verified alumni
        if user_role == 'student':
            queryset = queryset.filter(is_verified=True)
        
        # HOD can only see their department
        if user_role == 'hod' and self.request.user.department:
            queryset = queryset.filter(department=self.request.user.department)
        
        # Filter by graduation year (accept both snake_case and camelCase)
        graduation_year = (
            self.request.query_params.get('graduation_year')
            or self.request.query_params.get('graduationYear')
        )
        if graduation_year:
            queryset = queryset.filter(
                alumni_profile__graduation_year=graduation_year
            )
        
        # Filter by company
        company = self.request.query_params.get('company')
        if company:
            queryset = queryset.filter(
                alumni_profile__current_company__icontains=company
            )

        # Filter by location
        location = self.request.query_params.get('location')
        if location:
            queryset = queryset.filter(
                Q(alumni_profile__location__icontains=location)
                | Q(alumni_profile__current_location__icontains=location)
            )
        
        # Filter by industry
        industry = self.request.query_params.get('industry')
        if industry:
            queryset = queryset.filter(
                alumni_profile__industry__icontains=industry
            )
        
        # Filter by mentoring availability
        available_for_mentoring = self.request.query_params.get('mentoring')
        if available_for_mentoring == 'true':
            queryset = queryset.filter(
                alumni_profile__available_for_mentoring=True
            )

        # Free-text search (name/email/company/designation/industry)
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(email__icontains=search)
                | Q(alumni_profile__current_company__icontains=search)
                | Q(alumni_profile__current_designation__icontains=search)
                | Q(alumni_profile__industry__icontains=search)
            )
        
        return queryset.select_related('alumni_profile')


class AlumniDetailView(generics.RetrieveAPIView):
    """Get alumni details."""
    
    queryset = User.objects.filter(role='alumni')
    serializer_class = UserWithProfileSerializer
    permission_classes = [permissions.IsAuthenticated, ScopePermission]
    required_scopes = ['read:alumni', 'read:department_alumni', 'manage:alumni']


class AlumniStatsView(APIView):
    """Get alumni statistics."""
    
    permission_classes = [permissions.IsAuthenticated, ScopePermission]
    required_scopes = ['read:alumni', 'read:analytics', 'read:institution_analytics']
    
    def get(self, request):
        queryset = User.objects.filter(role='alumni', is_active=True)
        
        # HOD can only see their department
        user_role = getattr(request, 'jwt_role', request.user.role)
        if user_role == 'hod' and request.user.department:
            queryset = queryset.filter(department=request.user.department)
        
        verified_count = queryset.filter(is_verified=True).count()
        pending_count = queryset.filter(is_verified=False).count()
        
        # Department-wise distribution
        department_stats = queryset.values('department').annotate(
            count=Count('id')
        )
        
        # Graduation year distribution
        graduation_stats = AlumniProfile.objects.filter(
            user__in=queryset
        ).values('graduation_year').annotate(
            count=Count('id')
        ).order_by('-graduation_year')[:10]
        
        # Industry distribution
        industry_stats = AlumniProfile.objects.filter(
            user__in=queryset
        ).exclude(
            industry__isnull=True
        ).values('industry').annotate(
            count=Count('id')
        ).order_by('-count')[:10]
        
        # Top companies
        company_stats = AlumniProfile.objects.filter(
            user__in=queryset
        ).exclude(
            current_company__isnull=True
        ).values('current_company').annotate(
            count=Count('id')
        ).order_by('-count')[:10]
        
        stats = {
            'total_alumni': queryset.count(),
            'verified': verified_count,
            'pending_verification': pending_count,
            'by_department': list(department_stats),
            'by_graduation_year': list(graduation_stats),
            'by_industry': list(industry_stats),
            'top_companies': list(company_stats),
        }
        
        return success_response(data=stats)


class PendingVerificationView(generics.ListAPIView):
    """List alumni pending verification - Admin only."""
    
    serializer_class = UserWithProfileSerializer
    permission_classes = [permissions.IsAuthenticated, ScopePermission]
    required_scopes = ['verify:alumni', 'manage:alumni']
    
    def get_queryset(self):
        return User.objects.filter(
            role='alumni',
            is_active=True,
            is_verified=False,
            alumni_profile__verification_status='pending'
        ).select_related('alumni_profile')
