"""
API Views for Alumni Connect backend.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from django.conf import settings
from datetime import datetime
from mongoengine import Q

from common.models import (
    User, StudentProfile, AlumniProfile, Blog, Job, Event,
    BlogComment, BlogLike, JobApplication, EventRegistration
)
from common.jwt_auth import generate_tokens, refresh_access_token, decode_token
from common.permissions import (
    IsAuthenticated, IsAdmin, IsAlumni, IsStudent,
    CanReadBlogs, CanCreateBlogs, CanReadJobs, CanCreateJobs,
    CanReadEvents, CanCreateEvents, CanReadStudents, CanReadAlumni,
    CanVerifyAlumni, ScopePermission
)
from common.utils import success_response, error_response, paginate_results
from common.cloudinary_utils import upload_image


# ============== FILE UPLOAD VIEWS ==============

class ImageUploadView(APIView):
    """Image upload endpoint using Cloudinary."""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """Upload an image or video to Cloudinary."""
        if 'file' not in request.FILES:
            return error_response('No file provided', status.HTTP_400_BAD_REQUEST)
        
        file = request.FILES['file']
        folder = request.data.get('folder', 'alumni-connect/profiles')
        public_id = request.data.get('public_id', None)
        
        # Validate file type - allow images, videos, and documents
        document_types = {
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }
        allowed_types = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
            'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
            *document_types,
        ]
        if file.content_type not in allowed_types:
            return error_response(
                'Invalid file type. Only images, videos, and documents (PDF, Word) are allowed.',
                status.HTTP_400_BAD_REQUEST
            )
        
        # Validate file size (50MB for videos, 20MB for documents, 5MB for images)
        is_video = file.content_type.startswith('video/')
        is_document = file.content_type in document_types
        if is_video:
            max_size, size_limit = 50 * 1024 * 1024, '50MB'
        elif is_document:
            max_size, size_limit = 20 * 1024 * 1024, '20MB'
        else:
            max_size, size_limit = 5 * 1024 * 1024, '5MB'
        if file.size > max_size:
            return error_response(f'File size must be less than {size_limit}', status.HTTP_400_BAD_REQUEST)
        
        # Upload to Cloudinary
        result = upload_image(file, folder=folder, public_id=public_id)
        
        if result.get('success'):
            return success_response({
                'url': result['url'],
                'public_id': result['public_id'],
                'width': result.get('width'),
                'height': result.get('height'),
                'format': result.get('format'),
            })
        else:
            return error_response(result.get('error', 'Failed to upload image'), status.HTTP_500_INTERNAL_SERVER_ERROR)


class DocumentProxyView(APIView):
    """
    Proxy a Cloudinary document through the backend.
    Fetches the file server-side (bypassing browser ACL / referrer restrictions)
    and streams it directly to the authenticated user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        import os, re, time
        import requests as http_requests
        from django.http import HttpResponse

        url = request.GET.get('url', '').strip()
        if not url:
            return error_response('url parameter is required', status.HTTP_400_BAD_REQUEST)

        cloud_name = os.getenv('CLOUDINARY_CLOUD_NAME', '')
        if not cloud_name or f'cloudinary.com/{cloud_name}/' not in url:
            return error_response('Invalid document URL', status.HTTP_400_BAD_REQUEST)

        # Parse resource_type, optional version, and public_id from the stored URL
        m = re.search(r'cloudinary\.com/[^/]+/(raw|image|video)/upload/(?:v(\d+)/)?(.+)$', url)
        if not m:
            return error_response('Cannot parse Cloudinary URL', status.HTTP_400_BAD_REQUEST)

        resource_type, version_str, public_id = m.group(1), m.group(2), m.group(3)

        # Use private_download_url which routes through api.cloudinary.com (not CDN).
        # This bypasses account-level ACL restrictions that block CDN delivery.
        import cloudinary.utils as cld_utils
        filename_part = public_id.split('/')[-1]
        if '.' in filename_part:
            fmt = filename_part.rsplit('.', 1)[1].lower()
            pid_no_ext = public_id.rsplit('.', 1)[0]
        else:
            fmt = ''
            pid_no_ext = public_id

        try:
            download_url = cld_utils.private_download_url(
                pid_no_ext, fmt,
                resource_type=resource_type,
                expires_at=int(time.time()) + 300,
            )
        except Exception:
            download_url = url  # fall back to original

        # Fetch from Cloudinary server-side (bypasses browser ACL restrictions)
        try:
            resp = http_requests.get(download_url, timeout=30)
        except Exception as exc:
            return error_response(f'Failed to fetch document: {exc}', status.HTTP_502_BAD_GATEWAY)

        if not resp.ok:
            return error_response(
                f'Document not accessible (Cloudinary {resp.status_code})',
                status.HTTP_502_BAD_GATEWAY,
            )

        filename = public_id.split('/')[-1].split('?')[0]
        content_type = resp.headers.get('Content-Type', 'application/pdf')
        http_response = HttpResponse(resp.content, content_type=content_type)
        http_response['Content-Disposition'] = f'inline; filename="{filename}"'
        return http_response


# ============== AUTH VIEWS ==============

class RegisterView(APIView):
    """User registration endpoint."""
    permission_classes = [AllowAny]
    
    def post(self, request):
        data = request.data
        
        # Validate required fields
        required_fields = ['email', 'password', 'first_name', 'last_name', 'role']
        for field in required_fields:
            if not data.get(field):
                return error_response(f'{field} is required')
        
        email = data['email'].lower().strip()
        role = data['role'].lower()
        
        # Validate role
        valid_roles = ['student', 'alumni']
        if role not in valid_roles:
            return error_response(f'Invalid role. Must be one of: {valid_roles}')
        
        # Check if user exists
        if User.objects(email=email).first():
            return error_response('User with this email already exists')
        
        # Create user
        user = User(
            email=email,
            first_name=data['first_name'],
            last_name=data['last_name'],
            role=role
        )
        user.set_password(data['password'])
        user.save()
        
        # Create profile based on role
        if role == 'student':
            roll_no = data.get('roll_no', '')
            student_profile = StudentProfile(
                user=user,
                department=data.get('department', ''),
                year=data.get('year'),
                roll_no=roll_no
            )
            
            # Auto-calculate completion year and joining year from roll number
            if roll_no:
                from common.roll_number_utils import calculate_passout_year, parse_roll_number
                completion_year = calculate_passout_year(roll_no)
                info = parse_roll_number(roll_no)
                if completion_year:
                    student_profile.completion_year = completion_year
                if info:
                    student_profile.joined_year = int(info['year'])
            
            student_profile.save()
            
        elif role == 'alumni':
            roll_no = data.get('roll_no', '')
            graduation_year = data.get('graduation_year')
            
            # Auto-calculate graduation year from roll number if not provided
            if not graduation_year and roll_no:
                from common.roll_number_utils import calculate_passout_year
                graduation_year = calculate_passout_year(roll_no)
            
            AlumniProfile(
                user=user,
                department=data.get('department', ''),
                graduation_year=graduation_year,
                roll_no=roll_no
            ).save()
        
        # Generate tokens
        tokens = generate_tokens(user)
        
        return success_response(
            data={
                'user': user.to_dict(),
                'tokens': tokens
            },
            message='Registration successful',
            status_code=status.HTTP_201_CREATED
        )


class LoginView(APIView):
    """User login endpoint."""
    permission_classes = [AllowAny]
    
    def post(self, request):
        email = request.data.get('email', '').lower().strip()
        password = request.data.get('password', '')
        
        if not email or not password:
            return error_response('Email and password are required')
        
        # Find user
        user = User.objects(email=email).first()
        
        if not user:
            return error_response('Invalid credentials', status_code=status.HTTP_401_UNAUTHORIZED)
        
        if not user.check_password(password):
            return error_response('Invalid credentials', status_code=status.HTTP_401_UNAUTHORIZED)
        
        if not user.is_active:
            return error_response('Account is deactivated', status_code=status.HTTP_401_UNAUTHORIZED)
        
        # Generate tokens
        tokens = generate_tokens(user)
        
        # Get user profile and format it for frontend (camelCase)
        profile = None
        if user.role == 'student':
            student_profile = StudentProfile.objects(user=user).first()
            if student_profile:
                profile = {
                    'id': str(student_profile.id),
                    'firstName': user.first_name,
                    'lastName': user.last_name,
                    'email': user.email,
                    'phone': student_profile.phone or '',
                    'rollNumber': student_profile.roll_no,
                    'rollNo': student_profile.roll_no,
                    'department': student_profile.department or '',
                    'profilePicture': user.avatar or None,
                    'currentYear': student_profile.current_year or student_profile.year or 1,
                    'currentSemester': student_profile.current_semester or 1,
                    'cgpa': str(student_profile.cgpa) if student_profile.cgpa else '',
                    'bio': student_profile.bio or '',
                }
        elif user.role == 'alumni':
            alumni_profile = AlumniProfile.objects(user=user).first()
            if alumni_profile:
                profile = {
                    'id': str(alumni_profile.id),
                    'firstName': user.first_name,
                    'lastName': user.last_name,
                    'email': user.email,
                    'phone': alumni_profile.phone or '',
                    'rollNumber': alumni_profile.roll_no,
                    'rollNo': alumni_profile.roll_no,
                    'department': alumni_profile.department or '',
                    'profilePicture': user.avatar or None,
                    'graduationYear': alumni_profile.graduation_year,
                    'currentCompany': alumni_profile.current_company or '',
                    'currentPosition': alumni_profile.current_position or '',
                    'currentDesignation': alumni_profile.current_position or '',
                    'bio': alumni_profile.bio or '',
                }
        
        return success_response(
            data={
                'user': {
                    'id': str(user.uid),
                    'email': user.email,
                    'firstName': user.first_name,
                    'lastName': user.last_name,
                    'role': user.role,
                    'isActive': user.is_active,
                    'isVerified': user.is_verified,
                },
                'profile': profile,
                'tokens': tokens
            },
            message='Login successful'
        )


class RefreshTokenView(APIView):
    """Refresh access token endpoint."""
    permission_classes = [AllowAny]
    
    def post(self, request):
        refresh_token = request.data.get('refresh')
        
        if not refresh_token:
            return error_response('Refresh token is required')
        
        try:
            tokens = refresh_access_token(refresh_token)
            return success_response(data={'tokens': tokens})
        except Exception as e:
            return error_response(str(e), status_code=status.HTTP_401_UNAUTHORIZED)


class MeView(APIView):
    """Get current user profile."""
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        """Update basic profile info (name, phone, avatar) for any role."""
        from django.contrib.auth import get_user_model
        DjangoUser = get_user_model()
        try:
            user = DjangoUser.objects.get(id=request.user.id)
            if 'firstName' in request.data:
                user.first_name = request.data['firstName']
            if 'lastName' in request.data:
                user.last_name = request.data['lastName']
            if 'phone' in request.data:
                user.phone = request.data['phone']
            if 'avatar' in request.data:
                user.avatar = request.data['avatar']
            user.save()
            # Sync to MongoDB
            try:
                from common.models import User as MongoUser
                mongo_user = MongoUser.objects(email=user.email).first()
                if mongo_user:
                    if 'firstName' in request.data:
                        mongo_user.first_name = request.data['firstName']
                    if 'lastName' in request.data:
                        mongo_user.last_name = request.data['lastName']
                    if 'avatar' in request.data:
                        mongo_user.avatar = request.data['avatar']
                    mongo_user.save()
            except Exception:
                pass
            return success_response(data={
                'id': user.id,
                'email': user.email,
                'firstName': user.first_name,
                'lastName': user.last_name,
                'phone': user.phone or '',
                'role': user.role,
                'department': user.department or '',
                'avatar': user.avatar or '',
            }, message='Profile updated successfully')
        except DjangoUser.DoesNotExist:
            return error_response('User not found', status_code=status.HTTP_404_NOT_FOUND)

    def get(self, request):
        from django.contrib.auth import get_user_model
        from apps.accounts.models import StudentProfile as DjangoStudentProfile
        from apps.accounts.models import AlumniProfile as DjangoAlumniProfile
        
        User = get_user_model()
        user = request.user
        
        # Build base user data
        user_data = {
            'id': user.id,
            'email': user.email,
            'firstName': user.first_name,
            'lastName': user.last_name,
            'fullName': user.full_name,
            'phone': user.phone or '',
            'role': user.role,
            'department': user.department or '',
            'avatar': user.avatar or '',
            'isVerified': user.is_verified,
        }
        
        # Get profile based on role from Django ORM
        profile = None
        if user.role == 'student':
            try:
                sp = user.student_profile
                profile = {
                    'rollNumber': sp.roll_number,
                    'batchYear': sp.batch_year,
                    'graduationYear': sp.graduation_year,
                    'currentYear': sp.current_year,
                    'currentSemester': sp.current_semester,
                    'cgpa': str(sp.cgpa) if sp.cgpa else '',
                    'location': sp.location or '',
                    'bio': sp.bio or '',
                    'skills': sp.skills or [],
                    'socialProfiles': sp.social_profiles or {},
                }
            except DjangoStudentProfile.DoesNotExist:
                pass
        elif user.role == 'alumni':
            try:
                ap = user.alumni_profile
                profile = {
                    'rollNumber': ap.roll_number or '',
                    'graduationYear': ap.graduation_year,
                    'currentCompany': ap.current_company or '',
                    'currentDesignation': ap.current_designation or '',
                    'location': ap.location or '',
                    'bio': ap.bio or '',
                    'skills': ap.skills or [],
                    'socialProfiles': ap.social_profiles or {},
                    'verificationStatus': ap.verification_status,
                }
            except DjangoAlumniProfile.DoesNotExist:
                pass
        
        return success_response(
            data={
                'user': user_data,
                'profile': profile,
                'scopes': getattr(request, 'user_scopes', [])
            }
        )


class RollNumberUtilsView(APIView):
    """
    Utility endpoint for roll number operations.
    
    Endpoints:
    - POST /validate: Validate roll number format
    - POST /parse: Parse and get info from roll number
    - POST /status: Get academic status (alumni or student)
    """
    permission_classes = [AllowAny]  # Can be accessed without authentication
    
    def post(self, request):
        from common.roll_number_utils import (
            validate_roll_number, parse_roll_number, 
            calculate_passout_year, get_passout_date,
            is_alumni, get_academic_status
        )
        
        action = request.data.get('action', 'status')  # validate, parse, or status
        roll_number = request.data.get('roll_number', '').strip().upper()
        
        if not roll_number:
            return error_response('Roll number is required', status.HTTP_400_BAD_REQUEST)
        
        # Validate action
        if action == 'validate':
            is_valid, error_msg = validate_roll_number(roll_number)
            return success_response(data={
                'valid': is_valid,
                'error': error_msg,
                'roll_number': roll_number
            })
        
        elif action == 'parse':
            info = parse_roll_number(roll_number)
            if not info:
                return error_response('Invalid roll number format', status.HTTP_400_BAD_REQUEST)
            return success_response(data=info)
        
        elif action == 'status':
            # Get full academic status
            status_info = get_academic_status(roll_number)
            if not status_info:
                return error_response('Invalid roll number format', status.HTTP_400_BAD_REQUEST)
            return success_response(data=status_info)
        
        else:
            return error_response(
                f'Invalid action. Must be one of: validate, parse, status',
                status.HTTP_400_BAD_REQUEST
            )


# ============== STUDENT VIEWS ==============

class StudentProfileView(APIView):
    """Student profile endpoint using Django ORM (SQLite)."""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Import Django ORM models
        from apps.accounts.models import StudentProfile as DjangoStudentProfile
        from django.contrib.auth import get_user_model
        
        User = get_user_model()
        
        try:
            # Get user and profile from Django ORM (SQLite)
            user = User.objects.select_related('student_profile').get(id=request.user.id)
            
            if user.role != 'student':
                return error_response('Not a student', status_code=status.HTTP_403_FORBIDDEN)
            
            # Check if student profile exists
            if not hasattr(user, 'student_profile'):
                return error_response('Profile not found', status_code=status.HTTP_404_NOT_FOUND)
            
            profile = user.student_profile
            
            # Build response with proper camelCase keys for frontend
            data = {
                'id': str(user.id),
                'firstName': user.first_name,
                'lastName': user.last_name,
                'email': user.email,
                'phone': user.phone or '',
                'rollNumber': profile.roll_number,
                'department': user.department or '',
                'profilePicture': profile.profile_picture or user.avatar or None,
                'currentYear': profile.current_year or 1,
                'currentSemester': profile.current_semester or 1,
                'cgpa': str(profile.cgpa) if profile.cgpa else '',
                'location': profile.location or '',
                'bio': profile.bio or '',
                'socialProfiles': profile.social_profiles or {
                    'linkedin': profile.linkedin_url or '',
                    'github': profile.github_url or '',
                    'twitter': '',
                    'portfolio': '',
                    'leetcode': '',
                    'codechef': '',
                },
                'skills': profile.skills or [],
                'certifications': profile.certifications or [],
                'internships': profile.internships or [],
                'placements': profile.placements or [],
                'batchYear': profile.batch_year,
                'graduationYear': profile.graduation_year,
                'resume': profile.resume or profile.resume_url or '',
            }
            
            # Merge social profiles if exists (Django JSONField)
            if profile.social_profiles:
                data['socialProfiles'].update(profile.social_profiles)
            
            return success_response(data=data)
            
        except User.DoesNotExist:
            return error_response('User not found', status_code=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"Error in StudentProfileView: {str(e)}")
            return error_response(f'Error loading profile: {str(e)}', status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def patch(self, request):
        """Update student profile - Django ORM version."""
        return self.put(request)
    
    def put(self, request):
        """Update student profile - Django ORM version."""
        from apps.accounts.models import StudentProfile as DjangoStudentProfile
        from django.contrib.auth import get_user_model
        
        User = get_user_model()
        
        try:
            user = User.objects.select_related('student_profile').get(id=request.user.id)
            
            if user.role != 'student':
                return error_response('Not a student', status_code=status.HTTP_403_FORBIDDEN)
            
            profile = user.student_profile
            
            # Update User model fields
            if 'firstName' in request.data:
                user.first_name = request.data['firstName']
            if 'lastName' in request.data:
                user.last_name = request.data['lastName']
            if 'phone' in request.data:
                user.phone = request.data['phone']
            if 'profilePicture' in request.data:
                profile.profile_picture = request.data['profilePicture']
                # Also update user.avatar so it syncs everywhere
                user.avatar = request.data['profilePicture']
            
            # Update StudentProfile fields
            if 'location' in request.data:
                profile.location = request.data['location']
            if 'bio' in request.data:
                profile.bio = request.data['bio']
            if 'currentYear' in request.data:
                try:
                    profile.current_year = int(request.data['currentYear'])
                except (ValueError, TypeError):
                    pass
            if 'currentSemester' in request.data:
                try:
                    profile.current_semester = int(request.data['currentSemester'])
                except (ValueError, TypeError):
                    pass
            if 'cgpa' in request.data:
                try:
                    profile.cgpa = float(request.data['cgpa']) if request.data['cgpa'] else None
                except (ValueError, TypeError):
                    pass
            
            # Update social profiles (JSON field)
            if 'socialProfiles' in request.data:
                social = request.data['socialProfiles']
                profile.social_profiles = {
                    'linkedin': social.get('linkedin', ''),
                    'github': social.get('github', ''),
                    'twitter': social.get('twitter', ''),
                    'instagram': social.get('instagram', ''),
                    'facebook': social.get('facebook', ''),
                    'portfolio': social.get('portfolio', ''),
                    'leetcode': social.get('leetcode', ''),
                    'codechef': social.get('codechef', ''),
                }
                # Update legacy fields
                profile.linkedin_url = social.get('linkedin', '')
                profile.github_url = social.get('github', '')
                profile.portfolio_url = social.get('portfolio', '')
            
            # Update skills (JSON field - array)
            if 'skills' in request.data:
                skills_data = request.data['skills']
                if isinstance(skills_data, list):
                    # Store skills as-is (supports both [{name, proficiency}] and [name1, name2])
                    profile.skills = skills_data
            
            # Update certifications (JSON field - array)
            if 'certifications' in request.data:
                profile.certifications = request.data['certifications']
            
            # Update internships (JSON field - array)
            if 'internships' in request.data:
                profile.internships = request.data['internships']
            
            # Update placements (JSON field - array)
            if 'placements' in request.data:
                profile.placements = request.data['placements']
            
            # Update resume URL
            if 'resume' in request.data:
                profile.resume = request.data['resume']
            
            # Save both models
            user.save()
            profile.save()
            
            return success_response(
                data={
                    'id': str(user.id),
                    'firstName': user.first_name,
                    'lastName': user.last_name,
                    'email': user.email,
                    'phone': user.phone or '',
                    'rollNumber': profile.roll_number,
                    'department': user.department or '',
                    'profilePicture': profile.profile_picture or user.avatar or None,
                    'currentYear': profile.current_year or 1,
                    'currentSemester': profile.current_semester or 1,
                    'cgpa': str(profile.cgpa) if profile.cgpa else '',
                    'location': profile.location or '',
                    'bio': profile.bio or '',
                    'socialProfiles': profile.social_profiles or {},
                    'skills': profile.skills or [],
                    'certifications': profile.certifications or [],
                    'internships': profile.internships or [],
                    'placements': profile.placements or [],
                    'batchYear': profile.batch_year,
                    'graduationYear': profile.graduation_year,
                    'resume': profile.resume or '',
                },
                message='Profile updated successfully'
            )
            
        except User.DoesNotExist:
            return error_response('User not found', status_code=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"Error updating profile: {str(e)}")
            import traceback
            traceback.print_exc()
            return error_response(f'Failed to update profile: {str(e)}', status_code=status.HTTP_400_BAD_REQUEST)


class StudentListView(APIView):
    """List students - for staff."""
    permission_classes = [IsAuthenticated, CanReadStudents]
    
    def get(self, request):
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 20))
        department = request.GET.get('department')
        year = request.GET.get('year')
        
        queryset = StudentProfile.objects.all()
        
        if department:
            queryset = queryset.filter(department__icontains=department)
        if year:
            queryset = queryset.filter(year=int(year))
        
        result = paginate_results(queryset, page, page_size)
        result['results'] = [p.to_dict() for p in result['results']]
        
        return success_response(data=result)


# ============== ALUMNI VIEWS ==============

class AlumniListView(APIView):
    """List alumni."""
    permission_classes = [IsAuthenticated, CanReadAlumni]
    
    def get(self, request):
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 20))
        department = request.GET.get('department')
        graduation_year = request.GET.get('graduation_year')
        verified = request.GET.get('verified')
        
        queryset = AlumniProfile.objects.all()
        
        if department:
            queryset = queryset.filter(department__icontains=department)
        if graduation_year:
            queryset = queryset.filter(graduation_year=int(graduation_year))
        if verified:
            queryset = queryset.filter(is_verified=(verified.lower() == 'true'))
        
        result = paginate_results(queryset, page, page_size)
        result['results'] = [p.to_dict() for p in result['results']]
        
        return success_response(data=result)


class AlumniDetailView(APIView):
    """Get alumni details."""
    permission_classes = [IsAuthenticated, CanReadAlumni]
    
    def get(self, request, alumni_id):
        profile = AlumniProfile.objects(id=alumni_id).first()
        if not profile:
            return error_response('Alumni not found', status_code=status.HTTP_404_NOT_FOUND)
        
        return success_response(data=profile.to_dict())


class AlumniProfileView(APIView):
    """Alumni own profile endpoint using Django ORM (SQLite)."""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        from apps.accounts.models import AlumniProfile as DjangoAlumniProfile
        from django.contrib.auth import get_user_model
        
        User = get_user_model()
        
        try:
            user = User.objects.select_related('alumni_profile').get(id=request.user.id)
            
            if user.role != 'alumni':
                return error_response('Not an alumni', status_code=status.HTTP_403_FORBIDDEN)
            
            if not hasattr(user, 'alumni_profile'):
                return error_response('Profile not found', status_code=status.HTTP_404_NOT_FOUND)
            
            profile = user.alumni_profile
            
            # Build response with proper camelCase keys for frontend
            social = profile.social_profiles or {}
            data = {
                'id': str(user.id),
                'firstName': user.first_name,
                'lastName': user.last_name,
                'email': user.email,
                'phone': user.phone or '',
                'rollNumber': profile.roll_number or '',
                'department': user.department or '',
                'profilePicture': profile.profile_picture or user.avatar or None,
                'graduationYear': profile.graduation_year,
                'currentCompany': profile.current_company or '',
                'currentDesignation': profile.current_designation or '',
                'currentPosition': profile.current_designation or '',
                'currentLocation': profile.current_location or '',
                'location': profile.location or '',
                'industry': profile.industry or '',
                'experienceYears': profile.experience_years or 0,
                'yearsOfExperience': profile.experience_years or 0,
                'bio': profile.bio or '',
                'socialProfiles': {
                    'linkedin': social.get('linkedin', profile.linkedin_url or ''),
                    'github': social.get('github', profile.github_url or ''),
                    'twitter': social.get('twitter', profile.twitter_url or ''),
                    'instagram': social.get('instagram', ''),
                    'facebook': social.get('facebook', ''),
                    'portfolio': social.get('portfolio', profile.portfolio_url or ''),
                    'leetcode': social.get('leetcode', ''),
                    'codechef': social.get('codechef', ''),
                },
                'skills': profile.skills or [],
                'expertiseAreas': profile.expertise_areas or [],
                'workExperience': profile.work_experience or [],
                'achievements': profile.achievements or [],
                'availableForMentoring': profile.available_for_mentoring,
                'availableForReferrals': profile.available_for_referrals,
                'verificationStatus': profile.verification_status,
                'resume': profile.resume or '',
            }
            
            return success_response(data=data)
            
        except User.DoesNotExist:
            return error_response('User not found', status_code=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"Error in AlumniProfileView: {str(e)}")
            return error_response(f'Error loading profile: {str(e)}', status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def patch(self, request):
        return self.put(request)
    
    def put(self, request):
        from apps.accounts.models import AlumniProfile as DjangoAlumniProfile
        from django.contrib.auth import get_user_model
        
        User = get_user_model()
        
        try:
            user = User.objects.select_related('alumni_profile').get(id=request.user.id)
            
            if user.role != 'alumni':
                return error_response('Not an alumni', status_code=status.HTTP_403_FORBIDDEN)
            
            profile = user.alumni_profile
            
            # Update User model fields
            if 'firstName' in request.data:
                user.first_name = request.data['firstName']
            if 'lastName' in request.data:
                user.last_name = request.data['lastName']
            if 'phone' in request.data:
                user.phone = request.data['phone']
            if 'profilePicture' in request.data:
                profile.profile_picture = request.data['profilePicture']
                user.avatar = request.data['profilePicture']
            
            # Update AlumniProfile simple fields
            simple_field_mapping = {
                'location': 'location',
                'bio': 'bio',
                'currentCompany': 'current_company',
                'currentDesignation': 'current_designation',
                'currentPosition': 'current_designation',
                'currentLocation': 'current_location',
                'industry': 'industry',
                'rollNumber': 'roll_number',
            }
            
            for frontend_field, backend_field in simple_field_mapping.items():
                if frontend_field in request.data:
                    setattr(profile, backend_field, request.data[frontend_field])
            
            # Handle numeric fields
            if 'graduationYear' in request.data:
                try:
                    profile.graduation_year = int(request.data['graduationYear']) if request.data['graduationYear'] else profile.graduation_year
                except (ValueError, TypeError):
                    pass
            exp_val = request.data.get('experienceYears') or request.data.get('yearsOfExperience')
            if exp_val is not None:
                try:
                    profile.experience_years = int(float(exp_val)) if exp_val else 0
                except (ValueError, TypeError):
                    pass
            
            # Auto-calculate graduation year from roll number if provided
            if 'rollNumber' in request.data and request.data['rollNumber']:
                from common.roll_number_utils import calculate_passout_year
                calculated_year = calculate_passout_year(request.data['rollNumber'])
                if calculated_year:
                    profile.graduation_year = calculated_year
            
            # Handle boolean fields
            if 'availableForMentoring' in request.data:
                profile.available_for_mentoring = bool(request.data['availableForMentoring'])
            if 'availableForReferrals' in request.data:
                profile.available_for_referrals = bool(request.data['availableForReferrals'])
            
            # Handle social profiles (JSON field)
            if 'socialProfiles' in request.data:
                social = request.data['socialProfiles']
                profile.social_profiles = {
                    'linkedin': social.get('linkedin', ''),
                    'github': social.get('github', ''),
                    'twitter': social.get('twitter', ''),
                    'instagram': social.get('instagram', ''),
                    'facebook': social.get('facebook', ''),
                    'portfolio': social.get('portfolio', ''),
                    'leetcode': social.get('leetcode', ''),
                    'codechef': social.get('codechef', ''),
                }
                # Update legacy fields
                profile.linkedin_url = social.get('linkedin', '')
                profile.github_url = social.get('github', '')
                profile.portfolio_url = social.get('portfolio', '')
                profile.twitter_url = social.get('twitter', '')
            
            # Handle skills (JSON field - array)
            if 'skills' in request.data:
                skills_data = request.data['skills']
                if isinstance(skills_data, list):
                    if skills_data and isinstance(skills_data[0], dict):
                        profile.skills = [s.get('name', '') for s in skills_data if s.get('name')]
                    else:
                        profile.skills = skills_data
            
            # Handle expertise areas (JSON field - array)
            if 'expertiseAreas' in request.data:
                profile.expertise_areas = request.data['expertiseAreas']
            
            # Handle work experience (JSON field - array of dicts)
            if 'workExperience' in request.data:
                profile.work_experience = request.data['workExperience']
            
            # Handle achievements (JSON field - array of dicts)
            if 'achievements' in request.data:
                profile.achievements = request.data['achievements']
            
            # Update resume URL
            if 'resume' in request.data:
                profile.resume = request.data['resume'] or None
            
            # Save both models
            user.save()
            profile.save()
            
            # Return updated data in same format as GET
            social = profile.social_profiles or {}
            data = {
                'id': str(user.id),
                'firstName': user.first_name,
                'lastName': user.last_name,
                'email': user.email,
                'phone': user.phone or '',
                'rollNumber': profile.roll_number or '',
                'department': user.department or '',
                'profilePicture': profile.profile_picture or user.avatar or None,
                'graduationYear': profile.graduation_year,
                'currentCompany': profile.current_company or '',
                'currentDesignation': profile.current_designation or '',
                'currentPosition': profile.current_designation or '',
                'currentLocation': profile.current_location or '',
                'location': profile.location or '',
                'industry': profile.industry or '',
                'experienceYears': profile.experience_years or 0,
                'yearsOfExperience': profile.experience_years or 0,
                'bio': profile.bio or '',
                'socialProfiles': {
                    'linkedin': social.get('linkedin', ''),
                    'github': social.get('github', ''),
                    'twitter': social.get('twitter', ''),
                    'instagram': social.get('instagram', ''),
                    'facebook': social.get('facebook', ''),
                    'portfolio': social.get('portfolio', ''),
                    'leetcode': social.get('leetcode', ''),
                    'codechef': social.get('codechef', ''),
                },
                'skills': profile.skills or [],
                'expertiseAreas': profile.expertise_areas or [],
                'workExperience': profile.work_experience or [],
                'achievements': profile.achievements or [],
                'availableForMentoring': profile.available_for_mentoring,
                'availableForReferrals': profile.available_for_referrals,
                'verificationStatus': profile.verification_status,
                'resume': profile.resume or '',
            }
            
            return success_response(data=data, message='Profile updated successfully')
            
        except User.DoesNotExist:
            return error_response('User not found', status_code=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"Error updating alumni profile: {str(e)}")
            import traceback
            traceback.print_exc()
            return error_response(f'Failed to update profile: {str(e)}', status_code=status.HTTP_400_BAD_REQUEST)


class VerifyAlumniView(APIView):
    """Admin verify alumni."""
    permission_classes = [IsAuthenticated, CanVerifyAlumni]
    
    def post(self, request, alumni_id):
        profile = AlumniProfile.objects(id=alumni_id).first()
        if not profile:
            return error_response('Alumni not found', status_code=status.HTTP_404_NOT_FOUND)
        
        action = request.data.get('action', 'verify')  # verify or reject
        
        if action == 'verify':
            profile.is_verified = True
            profile.verified_at = datetime.utcnow()
            profile.verified_by = request.user
            profile.save()
            
            # Update user
            profile.user.is_verified = True
            profile.user.save()
            
            return success_response(message='Alumni verified successfully')
        else:
            profile.is_verified = False
            profile.save()
            return success_response(message='Alumni verification rejected')


# ============== BLOG VIEWS ==============

class BlogListView(APIView):
    """List and create blogs."""
    
    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated(), CanReadBlogs()]
        return [IsAuthenticated(), CanCreateBlogs()]
    
    def get(self, request):
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 20))
        category = request.GET.get('category')
        
        queryset = Blog.objects(is_published=True)
        
        if category:
            queryset = queryset.filter(category=category)
        
        result = paginate_results(queryset, page, page_size)
        result['results'] = [b.to_dict() for b in result['results']]
        
        return success_response(data=result)
    
    def post(self, request):
        if request.user.role != 'alumni':
            return error_response('Only alumni can create blogs', status_code=status.HTTP_403_FORBIDDEN)
        
        data = request.data
        
        if not data.get('title') or not data.get('content'):
            return error_response('Title and content are required')
        
        blog = Blog(
            author=request.user,
            title=data['title'],
            content=data['content'],
            excerpt=data.get('excerpt', data['content'][:200]),
            category=data.get('category', ''),
            tags=data.get('tags', []),
            cover_image=data.get('coverImage', '')
        )
        blog.save()
        
        return success_response(
            data=blog.to_dict(),
            message='Blog created successfully',
            status_code=status.HTTP_201_CREATED
        )


class BlogDetailView(APIView):
    """Get, update, delete blog."""
    permission_classes = [IsAuthenticated]
    
    def get(self, request, blog_id):
        blog = Blog.objects(id=blog_id).first()
        if not blog:
            return error_response('Blog not found', status_code=status.HTTP_404_NOT_FOUND)
        
        # Increment views
        blog.views_count += 1
        blog.save()
        
        # Check if current user has liked this blog
        is_liked = BlogLike.objects(blog=blog, user=request.user).first() is not None
        
        blog_dict = blog.to_dict()
        blog_dict['is_liked'] = is_liked
        
        return success_response(data=blog_dict)
    
    def put(self, request, blog_id):
        blog = Blog.objects(id=blog_id).first()
        if not blog:
            return error_response('Blog not found', status_code=status.HTTP_404_NOT_FOUND)
        
        # Check ownership - compare MongoEngine document IDs
        if str(blog.author.id) != str(request.user.id):
            return error_response('Not authorized', status_code=status.HTTP_403_FORBIDDEN)
        
        # Update fields
        for field in ['title', 'content', 'excerpt', 'category', 'tags', 'is_published']:
            if field in request.data:
                setattr(blog, field, request.data[field])
        
        # Handle coverImage separately (camelCase to snake_case)
        if 'coverImage' in request.data:
            blog.cover_image = request.data['coverImage']
        
        blog.updated_at = datetime.utcnow()
        blog.save()
        
        return success_response(data=blog.to_dict(), message='Blog updated')
    
    def delete(self, request, blog_id):
        blog = Blog.objects(id=blog_id).first()
        if not blog:
            return error_response('Blog not found', status_code=status.HTTP_404_NOT_FOUND)
        
        # Check ownership or admin - use MongoEngine document ID
        if str(blog.author.id) != str(request.user.id) and request.user.role != 'admin':
            return error_response('Not authorized', status_code=status.HTTP_403_FORBIDDEN)
        
        blog.delete()
        return success_response(message='Blog deleted')


class BlogShareView(APIView):
    """Share blog endpoint."""
    permission_classes = [IsAuthenticated]
    
    def post(self, request, blog_id):
        blog = Blog.objects(id=blog_id).first()
        if not blog:
            return error_response('Blog not found', status_code=status.HTTP_404_NOT_FOUND)
        
        # Increment shares count
        blog.shares_count += 1
        blog.save()
        
        return success_response(
            data={'shares_count': blog.shares_count},
            message='Blog shared successfully'
        )


class BlogLikeView(APIView):
    """Like/Unlike blog."""
    permission_classes = [IsAuthenticated]
    
    def post(self, request, blog_id):
        blog = Blog.objects(id=blog_id).first()
        if not blog:
            return error_response('Blog not found', status_code=status.HTTP_404_NOT_FOUND)
        
        # Check if already liked
        existing_like = BlogLike.objects(blog=blog, user=request.user).first()
        
        if existing_like:
            # Unlike
            existing_like.delete()
            blog.likes_count = max(0, blog.likes_count - 1)
            blog.save()
            return success_response(data={'liked': False, 'likes_count': blog.likes_count}, message='Blog unliked')
        else:
            # Like
            BlogLike(blog=blog, user=request.user).save()
            blog.likes_count += 1
            blog.save()
            return success_response(data={'liked': True, 'likes_count': blog.likes_count}, message='Blog liked')


class BlogCommentView(APIView):
    """Get comments or add comment to blog."""
    permission_classes = [IsAuthenticated]
    
    def get(self, request, blog_id):
        blog = Blog.objects(id=blog_id).first()
        if not blog:
            return error_response('Blog not found', status_code=status.HTTP_404_NOT_FOUND)
        
        comments = BlogComment.objects(blog=blog).order_by('-created_at')
        comments_data = []
        for comment in comments:
            comments_data.append({
                'id': str(comment.id),
                'author': comment.author.to_dict() if comment.author else None,
                'content': comment.content,
                'created_at': comment.created_at.isoformat() if comment.created_at else None,
            })
        
        return success_response(data=comments_data)
    
    def post(self, request, blog_id):
        blog = Blog.objects(id=blog_id).first()
        if not blog:
            return error_response('Blog not found', status_code=status.HTTP_404_NOT_FOUND)
        
        content = request.data.get('content', '').strip()
        if not content:
            return error_response('Comment content is required')
        
        comment = BlogComment(
            blog=blog,
            author=request.user,
            content=content
        )
        comment.save()
        
        # Update comment count
        blog.comments_count += 1
        blog.save()
        
        return success_response(
            data={
                'id': str(comment.id),
                'author': request.user.to_dict(),
                'content': content,
                'created_at': comment.created_at.isoformat(),
            },
            message='Comment added',
            status_code=status.HTTP_201_CREATED
        )


# ============== JOB VIEWS ==============

class JobListView(APIView):
    """List and create jobs."""
    
    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated(), CanReadJobs()]
        return [IsAuthenticated(), CanCreateJobs()]
    
    def get(self, request):
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 20))
        job_type = request.GET.get('type')
        my = request.GET.get('my')
        
        if my == 'true':
            mongo_user = User.objects(email=request.user.email).first()
            if not mongo_user:
                result = {'results': [], 'count': 0, 'next': None, 'previous': None}
                return success_response(data=result)
            queryset = Job.objects(posted_by=mongo_user)
        else:
            queryset = Job.objects(is_active=True)
        
        if job_type:
            queryset = queryset.filter(job_type=job_type)
        
        result = paginate_results(queryset, page, page_size)
        
        # Batch-fetch saved job IDs for the current user to annotate isSaved
        from apps.jobs.models import SavedJob
        job_ids = [str(j.id) for j in result['results']]
        saved_ids = set(
            SavedJob.objects.filter(user=request.user, job_id__in=job_ids).values_list('job_id', flat=True)
        )
        result['results'] = [
            {**j.to_dict(), 'isSaved': str(j.id) in saved_ids}
            for j in result['results']
        ]
        
        return success_response(data=result)
    
    def post(self, request):
        if request.user.role != 'alumni':
            return error_response('Only alumni can post jobs', status_code=status.HTTP_403_FORBIDDEN)
        
        # Resolve MongoEngine User from Django ORM user (create mirror if missing for seeded users)
        mongo_user = User.objects(email=request.user.email).first()
        if not mongo_user:
            import secrets
            mongo_user = User(
                email=request.user.email,
                first_name=request.user.first_name or 'Alumni',
                last_name=request.user.last_name or 'User',
                role='alumni',
                is_verified=True,
            )
            mongo_user.set_password(secrets.token_hex(32))
            mongo_user.save()
        
        data = request.data
        
        if not data.get('title') or not data.get('company') or not data.get('description'):
            return error_response('Title, company and description are required')
        
        # Handle requirements field (string or array)
        requirements = data.get('requirements', [])
        if isinstance(requirements, str):
            requirements = [req.strip() for req in requirements.split('\n') if req.strip()]
        
        # Handle skills field (string or array)
        skills = data.get('skills', [])
        if isinstance(skills, str):
            skills = [s.strip() for s in skills.split(',') if s.strip()]
        elif not isinstance(skills, list):
            skills = []
        
        job = Job(
            posted_by=mongo_user,
            title=data['title'],
            company=data['company'],
            location=data.get('location', ''),
            job_type=data.get('type', data.get('job_type', 'full-time')).lower(),
            cover_image=data.get('coverImage', data.get('cover_image', '')),
            description=data['description'],
            requirements=requirements,
            skills=skills,
            salary_min=data.get('salary_min'),
            salary_max=data.get('salary_max'),
            application_link=data.get('applicationLink', data.get('application_link', ''))
        )
        
        if data.get('deadline'):
            job.deadline = datetime.fromisoformat(data['deadline'].replace('Z', '+00:00'))
        
        job.save()
        
        return success_response(
            data=job.to_dict(),
            message='Job posted successfully',
            status_code=status.HTTP_201_CREATED
        )


class JobDetailView(APIView):
    """Get, update, and delete job details."""
    permission_classes = [IsAuthenticated, CanReadJobs]
    
    def get(self, request, job_id):
        job = Job.objects(id=job_id).first()
        if not job:
            return error_response('Job not found', status_code=status.HTTP_404_NOT_FOUND)
        
        job.views_count += 1
        job.save()
        
        # Check if user has saved this job (using job_id string)
        from apps.jobs.models import SavedJob
        is_saved = False
        if request.user.is_authenticated:
            is_saved = SavedJob.objects.filter(job_id=str(job.id), user=request.user).exists()
        
        job_data = job.to_dict()
        job_data['isSaved'] = is_saved
        
        return success_response(data=job_data)
    
    def put(self, request, job_id):
        """Update job posting."""
        job = Job.objects(id=job_id).first()
        if not job:
            return error_response('Job not found', status_code=status.HTTP_404_NOT_FOUND)
        
        # Check if user is the owner or admin
        if request.user.role != 'admin' and job.posted_by.email != request.user.email:
            return error_response('Permission denied', status_code=status.HTTP_403_FORBIDDEN)
        
        data = request.data
        
        # Update fields
        if data.get('title'):
            job.title = data['title']
        if data.get('company'):
            job.company = data['company']
        if 'location' in data:
            job.location = data['location']
        if data.get('type') or data.get('job_type'):
            job.job_type = (data.get('type') or data.get('job_type')).lower()
        if 'coverImage' in data or 'cover_image' in data:
            job.cover_image = data.get('coverImage', data.get('cover_image', ''))
        if 'description' in data:
            job.description = data['description']
        
        # Handle requirements (string or array)
        if 'requirements' in data:
            requirements = data['requirements']
            if isinstance(requirements, str):
                job.requirements = [req.strip() for req in requirements.split(',') if req.strip()]
            else:
                job.requirements = requirements
        
        # Handle skills (string or array)
        if 'skills' in data:
            skills = data['skills']
            if isinstance(skills, str):
                job.skills = [s.strip() for s in skills.split(',') if s.strip()]
            else:
                job.skills = skills
        
        # Handle salary
        if 'salary' in data:
            # Parse salary string like "20 LPA" or "10-20 LPA"
            salary_str = data['salary'].strip()
            # Extract numbers from salary string
            import re
            numbers = re.findall(r'\d+', salary_str)
            if len(numbers) >= 2:
                job.salary_min = int(numbers[0]) * 100000
                job.salary_max = int(numbers[1]) * 100000
            elif len(numbers) == 1:
                job.salary_min = int(numbers[0]) * 100000
                job.salary_max = int(numbers[0]) * 100000
        
        if 'salary_min' in data:
            job.salary_min = data['salary_min']
        if 'salary_max' in data:
            job.salary_max = data['salary_max']
        
        if 'experience' in data:
            # Store experience as a requirement or in description
            if data['experience'] and data['experience'] not in str(job.requirements):
                if not job.requirements:
                    job.requirements = []
                job.requirements.append(f"Experience: {data['experience']}")
        
        if 'applicationLink' in data or 'application_link' in data:
            job.application_link = data.get('applicationLink', data.get('application_link', ''))
        
        if data.get('deadline'):
            job.deadline = datetime.fromisoformat(data['deadline'].replace('Z', '+00:00'))
        
        job.updated_at = datetime.utcnow()
        job.save()
        
        return success_response(
            data=job.to_dict(),
            message='Job updated successfully'
        )


class JobSaveView(APIView):
    """Save or unsave a job (bookmark)."""
    permission_classes = [IsAuthenticated]
    
    def post(self, request, job_id):
        from apps.jobs.models import SavedJob
        
        # Verify job exists in MongoDB
        job = Job.objects(id=job_id).first()
        if not job:
            return error_response('Job not found', status_code=status.HTTP_404_NOT_FOUND)
        
        # Check if already saved (using job_id string)
        existing_save = SavedJob.objects.filter(job_id=job_id, user=request.user).first()
        
        if existing_save:
            # Unsave/Unbookmark
            existing_save.delete()
            return success_response(message='Job removed from bookmarks', data={'isSaved': False})
        else:
            # Save/Bookmark
            SavedJob.objects.create(job_id=job_id, user=request.user)
            return success_response(message='Job saved to bookmarks', data={'isSaved': True})
    
    def get(self, request, job_id):
        """Check if job is saved."""
        from apps.jobs.models import SavedJob
        
        # Verify job exists in MongoDB
        job = Job.objects(id=job_id).first()
        if not job:
            return error_response('Job not found', status_code=status.HTTP_404_NOT_FOUND)
        
        is_saved = SavedJob.objects.filter(job_id=job_id, user=request.user).exists()
        return success_response(data={'isSaved': is_saved})


class SavedJobsListView(APIView):
    """List all saved/bookmarked jobs for current user."""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        from apps.jobs.models import SavedJob
        
        # Get all saved job IDs for current user
        saved_jobs = SavedJob.objects.filter(user=request.user).order_by('-saved_at')
        
        # Fetch actual jobs from MongoDB
        jobs_data = []
        for saved_job in saved_jobs:
            job = Job.objects(id=saved_job.job_id).first()
            if job:  # Job might have been deleted
                job_dict = job.to_dict()
                job_dict['saved_at'] = saved_job.saved_at.isoformat()
                job_dict['isSaved'] = True
                jobs_data.append(job_dict)
        
        return success_response(data={
            'jobs': jobs_data,
            'count': len(jobs_data)
        })


# ============== EVENT VIEWS ==============

class EventListView(APIView):
    """List and create events."""
    
    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated(), CanReadEvents()]
        return [IsAuthenticated(), CanCreateEvents()]
    
    def get(self, request):
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 20))
        event_type = request.GET.get('type')
        upcoming = request.GET.get('upcoming')
        
        queryset = Event.objects(is_active=True)
        
        if event_type:
            queryset = queryset.filter(event_type=event_type)
        if upcoming and upcoming.lower() == 'true':
            queryset = queryset.filter(event_date__gte=datetime.utcnow())
        
        result = paginate_results(queryset, page, page_size)
        result['results'] = [e.to_dict() for e in result['results']]
        
        return success_response(data=result)
    
    def post(self, request):
        if request.user.role != 'admin':
            return error_response('Only admin can create events', status_code=status.HTTP_403_FORBIDDEN)
        
        data = request.data
        
        if not data.get('title') or not data.get('description') or not data.get('event_date'):
            return error_response('Title, description and event_date are required')
        
        event = Event(
            created_by=request.user,
            title=data['title'],
            description=data['description'],
            event_date=datetime.fromisoformat(data['event_date'].replace('Z', '+00:00')),
            location=data.get('location', ''),
            event_type=data.get('type', 'other'),
            event_image=data.get('event_image', ''),
            registration_link=data.get('registration_link', ''),
            max_participants=data.get('max_participants')
        )
        
        if data.get('end_date'):
            event.end_date = datetime.fromisoformat(data['end_date'].replace('Z', '+00:00'))
        
        event.save()
        
        return success_response(
            data=event.to_dict(),
            message='Event created successfully',
            status_code=status.HTTP_201_CREATED
        )


class EventDetailView(APIView):
    """Get, update, delete event details."""
    permission_classes = [IsAuthenticated, CanReadEvents]
    
    def get(self, request, event_id):
        event = Event.objects(id=event_id).first()
        if not event:
            return error_response('Event not found', status_code=status.HTTP_404_NOT_FOUND)
        
        return success_response(data=event.to_dict())
    
    def put(self, request, event_id):
        if request.user.role != 'admin':
            return error_response('Only admin can update events', status_code=status.HTTP_403_FORBIDDEN)
        
        event = Event.objects(id=event_id).first()
        if not event:
            return error_response('Event not found', status_code=status.HTTP_404_NOT_FOUND)
        
        data = request.data
        
        # Update fields
        if 'title' in data:
            event.title = data['title']
        if 'description' in data:
            event.description = data['description']
        if 'event_date' in data:
            event.event_date = datetime.fromisoformat(data['event_date'].replace('Z', '+00:00'))
        if 'end_date' in data:
            event.end_date = datetime.fromisoformat(data['end_date'].replace('Z', '+00:00')) if data['end_date'] else None
        if 'location' in data:
            event.location = data['location']
        if 'event_type' in data or 'type' in data:
            event.event_type = data.get('event_type') or data.get('type')
        if 'event_image' in data:
            event.event_image = data['event_image']
        if 'registration_link' in data:
            event.registration_link = data['registration_link']
        if 'max_participants' in data:
            event.max_participants = data['max_participants']
        
        event.updated_at = datetime.utcnow()
        event.save()
        
        return success_response(data=event.to_dict(), message='Event updated successfully')


# ============== AI ENGINE VIEWS ==============

class CareerRecommendationView(APIView):
    """AI Career Recommendation endpoint."""
    permission_classes = [IsAuthenticated]
    required_scope = 'ai:recommendation'
    
    def get(self, request, student_id=None):
        # If student_id not provided, use current user
        if student_id:
            student_profile = StudentProfile.objects(id=student_id).first()
        else:
            if request.user.role != 'student':
                return error_response('Not a student', status_code=status.HTTP_403_FORBIDDEN)
            student_profile = StudentProfile.objects(user=request.user).first()
        
        if not student_profile:
            return error_response('Student profile not found', status_code=status.HTTP_404_NOT_FOUND)
        
        # Get student skills
        student_skills = set(s.lower() for s in (student_profile.skills or []))
        student_certifications = set(c.lower() for c in (student_profile.certifications or []))
        
        # Get all verified alumni
        alumni_profiles = AlumniProfile.objects(is_verified=True)
        
        recommendations = []
        
        for alumni in alumni_profiles:
            alumni_skills = set(s.lower() for s in (alumni.skills or []))
            
            if not alumni_skills:
                continue
            
            # Calculate skill match
            common_skills = student_skills.intersection(alumni_skills)
            if student_skills:
                match_score = len(common_skills) / len(student_skills) * 100
            else:
                match_score = 0
            
            if match_score > 30:  # Only include if >30% match
                recommendations.append({
                    'alumni': alumni.to_dict(),
                    'match_score': round(match_score, 1),
                    'common_skills': list(common_skills),
                    'career_domain': alumni.current_position or 'Unknown',
                    'company': alumni.current_company or 'Unknown'
                })
        
        # Sort by match score
        recommendations.sort(key=lambda x: x['match_score'], reverse=True)
        
        # Get top 5
        top_recommendations = recommendations[:5]
        
        # Career domains analysis
        career_domains = {}
        for rec in recommendations:
            domain = rec['career_domain']
            if domain not in career_domains:
                career_domains[domain] = {'count': 0, 'total_score': 0}
            career_domains[domain]['count'] += 1
            career_domains[domain]['total_score'] += rec['match_score']
        
        suggested_domains = sorted(
            [{'domain': k, 'avg_score': v['total_score']/v['count'], 'alumni_count': v['count']}
             for k, v in career_domains.items()],
            key=lambda x: x['avg_score'],
            reverse=True
        )[:3]
        
        return success_response(data={
            'student': student_profile.to_dict(),
            'recommended_mentors': top_recommendations,
            'suggested_career_domains': suggested_domains,
            'skill_analysis': {
                'current_skills': list(student_skills),
                'certifications': list(student_certifications),
                'skill_count': len(student_skills)
            }
        })


class MentorRecommendationView(APIView):
    """Get alumni mentor recommendations for students."""
    permission_classes = [IsAuthenticated]
    required_scope = 'ai:recommendation'
    
    def get(self, request):
        # Only students can get mentor recommendations
        if request.user.role != 'student':
            return error_response('Only students can access mentor recommendations', status_code=status.HTTP_403_FORBIDDEN)
        
        # Get student profile
        student_profile = StudentProfile.objects(user=request.user).first()
        if not student_profile:
            return error_response('Student profile not found', status_code=status.HTTP_404_NOT_FOUND)
        
        # Get limit from query params
        limit = int(request.GET.get('limit', 3))
        
        # Get student skills and interests
        student_skills = set(s.lower() for s in (student_profile.skills or []))
        student_interests = set(i.lower() for i in (getattr(student_profile, 'interests', []) or []))
        student_dept = (request.user.department or '').lower()
        
        # Get all verified alumni available for mentoring
        all_alumni = AlumniProfile.objects(is_verified=True)
        
        recommendations = []
        
        for alumni in all_alumni:
            alumni_skills = set(s.lower() for s in (alumni.skills or []))
            alumni_dept = (alumni.user.department or '').lower() if alumni.user else ''
            
            # Calculate match score
            score = 0
            match_reasons = []
            
            # Department match (30 points)
            if student_dept and alumni_dept and student_dept == alumni_dept:
                score += 30
                match_reasons.append('Same department')
            
            # Skills match (40 points)
            if student_skills and alumni_skills:
                common_skills = student_skills.intersection(alumni_skills)
                if common_skills:
                    skill_match = len(common_skills) / len(student_skills) * 40
                    score += skill_match
                    match_reasons.append(f'{len(common_skills)} shared skills')
            
            # Interests match (20 points)
            if student_interests:
                alumni_interests = set(i.lower() for i in (getattr(alumni, 'interests', []) or []))
                common_interests = student_interests.intersection(alumni_interests)
                if common_interests:
                    interest_match = len(common_interests) / len(student_interests) * 20
                    score += interest_match
                    match_reasons.append(f'{len(common_interests)} shared interests')
            
            # Experience bonus (10 points)
            experience_years = getattr(alumni, 'experience_years', None)
            if not experience_years and alumni.graduation_year:
                # Calculate years since graduation as proxy for experience
                from datetime import datetime as dt
                experience_years = dt.now().year - alumni.graduation_year
            
            if experience_years and experience_years >= 3:
                score += 10
                match_reasons.append(f'{experience_years}+ years experience')
            
            if score > 0:
                recommendations.append({
                    'alumni_id': str(alumni.user.id) if alumni.user else None,
                    'name': alumni.user.full_name if alumni.user else 'Alumni',
                    'email': alumni.user.email if alumni.user else '',
                    'department': alumni.user.department if alumni.user else '',
                    'designation': alumni.current_position,
                    'company': alumni.current_company,
                    'location': alumni.location,
                    'graduation_year': alumni.graduation_year,
                    'skills': alumni.skills or [],
                    'expertise_areas': getattr(alumni, 'expertise_areas', []) or [],
                    'bio': alumni.bio or '',
                    'avatar': alumni.avatar_url if hasattr(alumni, 'avatar_url') else None,
                    'similarity_score': round(score, 2),
                    'match_reasons': match_reasons
                })
        
        # Sort by similarity score
        recommendations.sort(key=lambda x: x['similarity_score'], reverse=True)
        
        # Get top recommendations or random if no good matches
        if recommendations:
            top_recommendations = recommendations[:limit]
        else:
            # Fallback to random alumni if no matches
            import random
            random_alumni = list(all_alumni)
            random.shuffle(random_alumni)
            top_recommendations = []
            for alumni in random_alumni[:limit]:
                top_recommendations.append({
                    'alumni_id': str(alumni.user.id) if alumni.user else None,
                    'name': alumni.user.full_name if alumni.user else 'Alumni',
                    'email': alumni.user.email if alumni.user else '',
                    'department': alumni.user.department if alumni.user else '',
                    'designation': alumni.current_position,
                    'company': alumni.current_company,
                    'location': alumni.location,
                    'graduation_year': alumni.graduation_year,
                    'skills': alumni.skills or [],
                    'expertise_areas': getattr(alumni, 'expertise_areas', []) or [],
                    'bio': alumni.bio or '',
                    'avatar': alumni.avatar_url if hasattr(alumni, 'avatar_url') else None,
                    'similarity_score': 0,
                    'match_reasons': ['Discover this alumni mentor']
                })
        
        return success_response(data={
            'recommendations': top_recommendations,
            'total_recommendations': len(recommendations),
            'is_random': len(recommendations) == 0
        })


# ============== ANALYTICS VIEWS ==============

class DashboardStatsView(APIView):
    """Dashboard statistics."""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        role = request.user.role
        
        stats = {
            'total_alumni': AlumniProfile.objects.count(),
            'verified_alumni': AlumniProfile.objects(is_verified=True).count(),
            'total_students': StudentProfile.objects.count(),
            'total_blogs': Blog.objects(is_published=True).count(),
            'total_jobs': Job.objects(is_active=True).count(),
            'total_events': Event.objects(is_active=True).count(),
        }
        
        if role == 'admin':
            stats['pending_verifications'] = AlumniProfile.objects(is_verified=False).count()
            stats['total_users'] = User.objects.count()
            stats['reportedIssues'] = 0  # TODO: Implement when we add reports model
            stats['activeEvents'] = Event.objects(is_active=True).count()
            stats['jobPostings'] = Job.objects(is_active=True).count()
            # Role-based user counts
            stats['studentCount'] = User.objects(role='student').count()
            stats['alumniCount'] = User.objects(role='alumni').count()
            stats['hodCount'] = User.objects(role='hod').count()
            stats['counsellorCount'] = User.objects(role='counsellor').count()
            stats['principalCount'] = User.objects(role='principal').count()
            # Rename keys to match frontend expectations
            stats['totalUsers'] = stats.pop('total_users')
            stats['verifiedAlumni'] = stats.pop('verified_alumni')
            stats['pendingVerifications'] = stats.pop('pending_verifications')
        
        return success_response(data=stats)


# ============== ADMIN VIEWS ==============

class AdminRecentUsersView(APIView):
    """Get recent user registrations for admin dashboard."""
    permission_classes = [IsAuthenticated, IsAdmin]
    
    def get(self, request):
        limit = int(request.GET.get('limit', 10))
        
        # Get recently registered users, sorted by created_at
        recent_users = User.objects().order_by('-created_at').limit(limit)
        
        users_data = []
        for user in recent_users:
            users_data.append({
                'id': str(user.id),
                'name': user.full_name,
                'email': user.email,
                'role': user.role,
                'created_at': user.created_at.isoformat() if user.created_at else None,
                'is_verified': user.is_verified,
            })
        
        return success_response(data=users_data)


class AdminUsersListView(APIView):
    """List all users for admin management."""
    permission_classes = [IsAuthenticated, IsAdmin]
    
    def get(self, request):
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 20))
        role_filter = request.GET.get('role')
        search = request.GET.get('search', '')
        
        queryset = User.objects()
        
        if role_filter:
            queryset = queryset.filter(role=role_filter)
        
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search) | 
                Q(last_name__icontains=search) | 
                Q(email__icontains=search)
            )
        
        result = paginate_results(queryset, page, page_size)
        
        def normalize_user(u):
            d = u.to_dict()
            d['name'] = d.get('full_name') or f"{d.get('first_name', '')} {d.get('last_name', '')}".strip()
            d['active'] = d.get('is_active', True)
            d['createdAt'] = d.get('created_at')
            return d
        
        result['results'] = [normalize_user(u) for u in result['results']]
        
        return success_response(data=result)


class AdminUserDetailView(APIView):
    """Get, update, delete a single user."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def _get_user(self, user_id):
        return User.objects(uid=user_id).first() or User.objects(id=user_id).first()

    def get(self, request, user_id):
        user = self._get_user(user_id)
        if not user:
            return error_response('User not found', status_code=status.HTTP_404_NOT_FOUND)
        d = user.to_dict()
        d['name'] = d.get('full_name') or f"{d.get('first_name', '')} {d.get('last_name', '')}".strip()
        d['active'] = d.get('is_active', True)
        d['createdAt'] = d.get('created_at')
        return success_response(data=d)

    def put(self, request, user_id):
        user = self._get_user(user_id)
        if not user:
            return error_response('User not found', status_code=status.HTTP_404_NOT_FOUND)
        data = request.data
        first_name = data.get('firstName') or data.get('first_name')
        last_name = data.get('lastName') or data.get('last_name')
        if first_name:
            user.first_name = first_name
        if last_name:
            user.last_name = last_name
        if data.get('role'):
            user.role = data['role']
        if 'is_active' in data:
            user.is_active = data['is_active']
        elif 'active' in data:
            user.is_active = data['active']
        user.save()
        # Sync to Django user
        try:
            from apps.accounts.models import User as DjangoUser
            django_user = DjangoUser.objects.get(email=user.email)
            if first_name:
                django_user.first_name = first_name
            if last_name:
                django_user.last_name = last_name
            django_user.save()
        except Exception:
            pass
        d = user.to_dict()
        d['name'] = d.get('full_name') or f"{d.get('first_name', '')} {d.get('last_name', '')}".strip()
        d['active'] = d.get('is_active', True)
        d['createdAt'] = d.get('created_at')
        return success_response(data=d, message='User updated successfully')

    def delete(self, request, user_id):
        user = self._get_user(user_id)
        if not user:
            return error_response('User not found', status_code=status.HTTP_404_NOT_FOUND)
        email = user.email
        user.delete()
        # Also delete from Django
        try:
            from apps.accounts.models import User as DjangoUser
            DjangoUser.objects.filter(email=email).delete()
        except Exception:
            pass
        return success_response(message='User deleted successfully')


class AdminUserToggleStatusView(APIView):
    """Toggle a user's active/disabled status."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, user_id):
        user = User.objects(uid=user_id).first() or User.objects(id=user_id).first()
        if not user:
            return error_response('User not found', status_code=status.HTTP_404_NOT_FOUND)
        user.is_active = not user.is_active
        user.save()
        # Sync to Django
        try:
            from apps.accounts.models import User as DjangoUser
            django_user = DjangoUser.objects.get(email=user.email)
            django_user.is_active = user.is_active
            django_user.save(update_fields=['is_active'])
        except Exception:
            pass
        return success_response(
            data={'active': user.is_active},
            message=f"User {'enabled' if user.is_active else 'disabled'} successfully"
        )


class AdminSettingsView(APIView):
    """Get and update platform-wide admin settings."""
    permission_classes = [IsAuthenticated, IsAdmin]

    # In-memory defaults (persisted per-process; a proper implementation would use a DB model)
    _settings = {
        'allowRegistration': True,
        'requireEmailVerification': True,
        'alumniVerificationRequired': True,
        'maxUploadSize': 10,
        'maintenanceMode': False,
    }

    def get(self, request):
        return success_response(data=dict(self._settings))

    def put(self, request):
        allowed = {'allowRegistration', 'requireEmailVerification', 'alumniVerificationRequired',
                   'maxUploadSize', 'maintenanceMode'}
        for key, value in request.data.items():
            if key in allowed:
                AdminSettingsView._settings[key] = value
        return success_response(data=dict(self._settings), message='Settings saved successfully')


class AdminPendingAlumniView(APIView):
    """Get list of pending alumni verifications."""
    permission_classes = [IsAuthenticated, IsAdmin]
    
    def get(self, request):
        # Get alumni profiles that are not verified
        pending_alumni = AlumniProfile.objects(is_verified=False)
        
        alumni_data = []
        for profile in pending_alumni:
            user = profile.user
            full_name = f"{user.first_name} {user.last_name}".strip() if user else ''
            alumni_data.append({
                'id': str(profile.id),
                'name': full_name or (user.email if user else 'Unknown'),
                'email': user.email if user else '',
                'roll_no': profile.roll_no,
                'department': profile.department,
                'graduationYear': profile.graduation_year,
                'graduation_year': profile.graduation_year,
                'current_company': profile.current_company,
                'current_position': profile.current_position,
                'phone': profile.phone,
                'appliedOn': profile.created_at.isoformat() if profile.created_at else None,
                'created_at': profile.created_at.isoformat() if profile.created_at else None,
                'user': user.to_dict() if user else None,
            })
        
        return success_response(data=alumni_data)


class AlumniVerificationActionView(APIView):
    """Approve or reject a pending alumni verification."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, alumni_id, action):
        if action not in ('approve', 'reject'):
            return error_response('Invalid action', status_code=status.HTTP_400_BAD_REQUEST)

        profile = AlumniProfile.objects(id=alumni_id).first()
        if not profile:
            return error_response('Alumni profile not found', status_code=status.HTTP_404_NOT_FOUND)

        user = profile.user
        if not user:
            return error_response('Associated user not found', status_code=status.HTTP_404_NOT_FOUND)

        remarks = request.data.get('remarks', '')

        if action == 'approve':
            profile.is_verified = True
            profile.save()
            # Also mark the Django user and Django AlumniProfile as verified
            try:
                from apps.accounts.models import User as DjangoUser, AlumniProfile as DjangoAlumniProfile
                django_user = DjangoUser.objects.get(email=user.email)
                django_user.is_verified = True
                django_user.save(update_fields=['is_verified'])
                # Update Django ORM AlumniProfile verification_status
                django_alumni = DjangoAlumniProfile.objects.filter(user=django_user).first()
                if django_alumni:
                    from django.utils import timezone
                    django_alumni.verification_status = 'verified'
                    django_alumni.verified_at = timezone.now()
                    django_alumni.save(update_fields=['verification_status', 'verified_at'])
            except Exception:
                pass
            return success_response(message='Alumni approved successfully', data={'id': alumni_id, 'status': 'verified'})
        else:
            # Reject: delete the profile and optionally the user
            profile.delete()
            return success_response(message='Alumni rejected successfully', data={'id': alumni_id, 'status': 'rejected'})


# ============== COUNSELLOR VIEWS ==============

class CounsellorStatsView(APIView):
    """Dashboard statistics for counsellors."""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Verify user is a counsellor
        if request.user.role != 'counsellor':
            return error_response('Access denied. Counsellors only.', status_code=status.HTTP_403_FORBIDDEN)
        
        # Resolve MongoEngine user by email (request.user is Django ORM User)
        mongo_counsellor = User.objects(email=request.user.email).first()
        if not mongo_counsellor:
            return error_response('Counsellor profile not found', status_code=status.HTTP_404_NOT_FOUND)
        
        # Count students assigned to this counsellor
        assigned_student_users = User.objects(assigned_counsellor=mongo_counsellor, role='student')
        total_students = assigned_student_users.count()
        
        # Count alumni assigned to this counsellor
        assigned_alumni_users = User.objects(assigned_counsellor=mongo_counsellor, role='alumni')
        total_alumni = assigned_alumni_users.count()
        
        # Count placed students
        placed_count = 0
        for user in assigned_student_users:
            profile = StudentProfile.objects(user=user).first()
            if profile and profile.is_placed:
                placed_count += 1
        
        # Calculate placement rate
        placement_rate = (placed_count / total_students * 100) if total_students > 0 else 0
        
        # Count verified alumni
        verified_alumni = 0
        for user in assigned_alumni_users:
            profile = AlumniProfile.objects(user=user).first()
            if profile and profile.is_verified:
                verified_alumni += 1
        
        # Recent placements (placed students with offers)
        recent_placements = []
        for user in assigned_student_users:
            if len(recent_placements) >= 4:
                break
            profile = StudentProfile.objects(user=user, is_placed=True).first()
            if profile and profile.placement_offers:
                offer = profile.placement_offers[0]
                full_name = f"{user.first_name} {user.last_name}".strip() or user.email.split('@')[0]
                recent_placements.append({
                    'name': full_name,
                    'company': offer.company_name or '',
                    'package': offer.package or '',
                    'role': offer.role or '',
                })

        # Upcoming events from Django ORM Event model
        from django.utils import timezone
        from apps.events.models import Event
        upcoming_qs = Event.objects.filter(
            start_datetime__gte=timezone.now(),
            status__in=['upcoming', 'ongoing'],
        ).order_by('start_datetime')[:4]
        upcoming_events = [
            {
                'title': ev.title,
                'date': ev.start_datetime.strftime('%b %d'),
                'type': ev.event_type,
            }
            for ev in upcoming_qs
        ]

        stats = {
            'totalStudents': total_students,
            'totalAlumni': total_alumni,
            'placements': placed_count,
            'placementRate': round(placement_rate, 1),
            'verifiedAlumni': verified_alumni,
            'recentPlacements': recent_placements,
            'upcomingEvents': upcoming_events,
        }
        
        return success_response(data=stats)


class CounsellorInsightsView(APIView):
    """Counselling insights and analytics."""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Verify user is a counsellor
        if request.user.role != 'counsellor':
            return error_response('Access denied. Counsellors only.', status_code=status.HTTP_403_FORBIDDEN)
        
        # Resolve MongoEngine user by email (request.user is Django ORM User)
        mongo_counsellor = User.objects(email=request.user.email).first()
        if not mongo_counsellor:
            return error_response('Counsellor profile not found', status_code=status.HTTP_404_NOT_FOUND)
        
        # Get students assigned to this counsellor
        assigned_student_users = User.objects(assigned_counsellor=mongo_counsellor, role='student')
        total_students = assigned_student_users.count()

        # Get alumni assigned to this counsellor
        assigned_alumni_users = User.objects(assigned_counsellor=mongo_counsellor, role='alumni')
        total_alumni = assigned_alumni_users.count()

        # Aggregate data from student profiles
        department_stats = {}
        year_stats = {}
        career_interests = {}
        skills_count = {}
        placed_count = 0
        cgpa_sum = 0.0
        cgpa_count = 0

        for u in assigned_student_users:
            profile = StudentProfile.objects(user=u).first()
            if not profile:
                continue

            # Department
            dept = profile.department
            if dept:
                department_stats[dept] = department_stats.get(dept, 0) + 1

            # Year of study
            year = profile.current_year or profile.year
            if year:
                year_key = f'Year {year}'
                year_stats[year_key] = year_stats.get(year_key, 0) + 1

            # Career interests
            if profile.career_interest:
                career_interests[profile.career_interest] = career_interests.get(profile.career_interest, 0) + 1

            # Skills (stored as list of strings)
            for skill in (profile.skills or []):
                skill_name = skill if isinstance(skill, str) else getattr(skill, 'name', str(skill))
                if skill_name:
                    skills_count[skill_name] = skills_count.get(skill_name, 0) + 1

            # Placement
            if profile.is_placed:
                placed_count += 1

            # CGPA
            if profile.cgpa:
                try:
                    cgpa_sum += float(profile.cgpa)
                    cgpa_count += 1
                except (TypeError, ValueError):
                    pass

        placement_rate = round((placed_count / total_students * 100), 1) if total_students > 0 else 0.0
        avg_cgpa = round(cgpa_sum / cgpa_count, 2) if cgpa_count > 0 else 0.0

        # Sort into arrays for frontend
        career_interests_list = sorted(
            [{'interest': k, 'count': v} for k, v in career_interests.items()],
            key=lambda x: x['count'], reverse=True
        )[:5]

        top_skills_list = sorted(
            [{'skill': k, 'students': v} for k, v in skills_count.items()],
            key=lambda x: x['students'], reverse=True
        )[:5]

        year_dist_list = sorted(
            [{'year': k, 'count': v} for k, v in year_stats.items()],
            key=lambda x: x['year']
        )

        dept_dist_list = sorted(
            [{'department': k, 'count': v} for k, v in department_stats.items()],
            key=lambda x: x['count'], reverse=True
        )

        insights = {
            'totalStudents': total_students,
            'totalAlumni': total_alumni,
            'activeMentorships': total_students,
            'upcomingSessions': 0,
            'placementRate': placement_rate,
            'avgCgpa': avg_cgpa,
            'careerInterests': career_interests_list,
            'topSkills': top_skills_list,
            'yearDistribution': year_dist_list,
            'departmentDistribution': dept_dist_list,
            # legacy dict keys kept for backwards compat
            'topCareerInterests': career_interests,
        }

        return success_response(data=insights)


class CounsellorStudentsView(APIView):
    """List students assigned to the logged-in counsellor."""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Verify user is a counsellor
        if request.user.role != 'counsellor':
            return error_response('Access denied. Counsellors only.', status_code=status.HTTP_403_FORBIDDEN)
        
        # Get filter parameters
        department = request.GET.get('department')
        year = request.GET.get('year')
        cgpa_min = request.GET.get('cgpa_min')
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 20))
        
        # Resolve MongoEngine user by email (request.user is Django ORM User)
        mongo_counsellor = User.objects(email=request.user.email).first()
        if not mongo_counsellor:
            return success_response(data={'results': [], 'count': 0, 'page': page, 'page_size': page_size, 'total_pages': 0})
        
        # Find all students assigned to this counsellor
        assigned_student_users = User.objects(assigned_counsellor=mongo_counsellor, role='student')
        
        # Get their student profiles
        students = []
        for user in assigned_student_users:
            profile = StudentProfile.objects(user=user).first()
            if profile:
                # Apply filters
                if department and profile.department != department:
                    continue
                if year and profile.current_year != int(year):
                    continue
                if cgpa_min and (not profile.cgpa or profile.cgpa < float(cgpa_min)):
                    continue
                
                # Build student data
                students.append({
                    'id': str(user.uid),
                    'name': user.full_name,
                    'firstName': user.first_name,
                    'lastName': user.last_name,
                    'email': user.email,
                    'rollNo': profile.roll_no,
                    'department': profile.department,
                    'year': profile.current_year or profile.year,
                    'cgpa': float(profile.cgpa) if profile.cgpa else None,
                    'phone': profile.phone,
                    'avatar': user.avatar,
                    'skills': profile.skills or [],
                    'careerInterest': profile.career_interest,
                    'bio': profile.bio,
                })
        
        # Manual pagination
        total = len(students)
        start = (page - 1) * page_size
        end = start + page_size
        paginated_students = students[start:end]
        
        result = {
            'results': paginated_students,
            'count': total,
            'page': page,
            'page_size': page_size,
            'total_pages': (total + page_size - 1) // page_size
        }
        
        return success_response(data=result)


class CounsellorStudentDetailView(APIView):
    """Get detailed information about a student assigned to the counsellor."""
    permission_classes = [IsAuthenticated]
    
    def get(self, request, student_id):
        # Verify user is a counsellor
        if request.user.role != 'counsellor':
            return error_response('Access denied. Counsellors only.', status_code=status.HTTP_403_FORBIDDEN)
        
        # Resolve MongoEngine user by email (request.user is Django ORM User)
        mongo_counsellor = User.objects(email=request.user.email).first()
        if not mongo_counsellor:
            return error_response('Counsellor profile not found', status_code=status.HTTP_404_NOT_FOUND)
        
        # Find student by ID
        student_user = User.objects(uid=student_id, role='student').first()
        if not student_user:
            return error_response('Student not found', status_code=status.HTTP_404_NOT_FOUND)
        
        # Verify student is assigned to this counsellor
        if student_user.assigned_counsellor != mongo_counsellor:
            return error_response('You are not assigned to this student', status_code=status.HTTP_403_FORBIDDEN)
        
        # Get student profile
        profile = StudentProfile.objects(user=student_user).first()
        if not profile:
            return error_response('Student profile not found', status_code=status.HTTP_404_NOT_FOUND)
        
        # Build detailed student data
        student_data = {
            'id': str(student_user.uid),
            'name': student_user.full_name,
            'firstName': student_user.first_name,
            'lastName': student_user.last_name,
            'email': student_user.email,
            'phone': profile.phone,
            'avatar': student_user.avatar,
            'rollNo': profile.roll_no,
            'department': profile.department,
            'year': profile.current_year or profile.year,
            'semester': profile.current_semester,
            'cgpa': float(profile.cgpa) if profile.cgpa else None,
            'joinedYear': profile.joined_year,
            'completionYear': profile.completion_year,
            'careerInterest': profile.career_interest,
            'bio': profile.bio,
            'skills': profile.skills or [],
            'certifications': profile.certifications or [],
            'internships': [
                {
                    'company': i.company,
                    'role': i.role,
                    'startDate': i.start_date.isoformat() if i.start_date else None,
                    'endDate': i.end_date.isoformat() if i.end_date else None,
                    'isPaid': i.is_paid,
                    'description': i.description,
                }
                for i in (profile.internships or [])
            ],
            'isPlaced': profile.is_placed,
            'placementOffers': [
                {
                    'companyName': p.company_name,
                    'role': p.role,
                    'package': p.package,
                }
                for p in (profile.placement_offers or [])
            ],
            'socialProfiles': {
                'linkedin': profile.linkedin,
                'github': profile.github,
                'portfolio': profile.portfolio,
            },
        }
        
        return success_response(data=student_data)


class CounsellorAlumniView(APIView):
    """List alumni assigned to the logged-in counsellor."""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Verify user is a counsellor
        if request.user.role != 'counsellor':
            return error_response('Access denied. Counsellors only.', status_code=status.HTTP_403_FORBIDDEN)
        
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 20))
        
        # Resolve MongoEngine user by email (request.user is Django ORM User)
        mongo_counsellor = User.objects(email=request.user.email).first()
        if not mongo_counsellor:
            return success_response(data={'results': [], 'count': 0, 'page': page, 'page_size': page_size, 'total_pages': 0})
        
        # Find all alumni assigned to this counsellor
        assigned_alumni_users = User.objects(assigned_counsellor=mongo_counsellor, role='alumni')
        
        # Get their alumni profiles
        alumni_list = []
        for user in assigned_alumni_users:
            profile = AlumniProfile.objects(user=user).first()
            if profile:
                alumni_list.append({
                    'id': str(user.uid),
                    'name': user.full_name,
                    'email': user.email,
                    'graduationYear': profile.graduation_year,
                    'department': profile.department,
                    'currentCompany': profile.current_company,
                    'currentPosition': profile.current_position,
                    'location': profile.location,
                    'avatar': user.avatar,
                })
        
        # Manual pagination
        total = len(alumni_list)
        start = (page - 1) * page_size
        end = start + page_size
        paginated_alumni = alumni_list[start:end]
        
        result = {
            'results': paginated_alumni,
            'count': total,
            'page': page,
            'page_size': page_size,
            'total_pages': (total + page_size - 1) // page_size
        }
        
        return success_response(data=result)


# ============================================================
# HOD (Head of Department) Views
# ============================================================

class HODStatsView(APIView):
    """Dashboard statistics for HOD — department-wide."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'hod':
            return error_response('Access denied. HODs only.', status_code=status.HTTP_403_FORBIDDEN)

        dept = (request.user.department or '').upper()
        if not dept:
            return error_response('HOD has no department set.', status_code=status.HTTP_400_BAD_REQUEST)

        # All students in the department (MongoDB)
        dept_students = User.objects(role='student', department__iexact=dept)
        total_students = dept_students.count()

        # All alumni in the department
        dept_alumni = User.objects(role='alumni', department__iexact=dept)
        total_alumni = dept_alumni.count()

        # All counsellors in the department
        from apps.accounts.models import User as DjangoUser
        total_counsellors = DjangoUser.objects.filter(
            role='counsellor', department__iexact=dept, is_active=True
        ).count()

        # Placement stats & recent placements
        placed_count = 0
        recent_placements = []
        for u in dept_students:
            profile = StudentProfile.objects(user=u).first()
            if profile and profile.is_placed:
                placed_count += 1
                if len(recent_placements) < 5 and profile.placement_offers:
                    offer = profile.placement_offers[0]
                    recent_placements.append({
                        'name': u.full_name,
                        'company': offer.company_name or '',
                        'package': offer.package or '',
                        'role': offer.role or '',
                    })

        placement_rate = round((placed_count / total_students * 100), 1) if total_students > 0 else 0

        # Verified alumni
        verified_alumni = sum(
            1 for u in dept_alumni
            if AlumniProfile.objects(user=u).first() and AlumniProfile.objects(user=u).first().is_verified
        )

        # Upcoming events
        from django.utils import timezone
        from apps.events.models import Event
        upcoming_events = [
            {
                'title': ev.title,
                'date': ev.start_datetime.strftime('%b %d'),
                'type': ev.event_type,
            }
            for ev in Event.objects.filter(
                start_datetime__gte=timezone.now(),
                status__in=['upcoming', 'ongoing'],
            ).order_by('start_datetime')[:4]
        ]

        return success_response(data={
            'totalStudents': total_students,
            'totalAlumni': total_alumni,
            'totalCounsellors': total_counsellors,
            'placements': placed_count,
            'placementRate': placement_rate,
            'verifiedAlumni': verified_alumni,
            'department': dept,
            'recentPlacements': recent_placements,
            'upcomingEvents': upcoming_events,
        })


class HODCounsellorsView(APIView):
    """List all counsellors under this HOD's department."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'hod':
            return error_response('Access denied. HODs only.', status_code=status.HTTP_403_FORBIDDEN)

        dept = (request.user.department or '').upper()
        from apps.accounts.models import User as DjangoUser
        counsellors = DjangoUser.objects.filter(role='counsellor', department__iexact=dept, is_active=True)

        result = []
        for c in counsellors:
            mongo_c = User.objects(email=c.email).first()
            student_count = User.objects(
                role='student', assigned_counsellor=mongo_c
            ).count() if mongo_c else 0

            result.append({
                'id': c.pk,
                'name': c.full_name,
                'email': c.email,
                'phone': c.phone or '',
                'department': c.department,
                'studentCount': student_count,
                'avatar': c.avatar,
            })

        return success_response(data={'results': result, 'count': len(result)})


class HODStudentsView(APIView):
    """List all students in the HOD's department."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'hod':
            return error_response('Access denied. HODs only.', status_code=status.HTTP_403_FORBIDDEN)

        dept = (request.user.department or '').upper()
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))
        search = request.query_params.get('search', '').strip().lower()

        students = []
        for u in User.objects(role='student', department__iexact=dept):
            if search and search not in u.full_name.lower() and search not in u.email.lower():
                continue
            profile = StudentProfile.objects(user=u).first()
            students.append({
                'id': str(u.uid),
                'name': u.full_name,
                'email': u.email,
                'rollNo': profile.roll_no if profile else '',
                'year': profile.current_year or profile.year if profile else None,
                'cgpa': float(profile.cgpa) if profile and profile.cgpa else None,
                'isPlaced': profile.is_placed if profile else False,
                'skills': (profile.skills or [])[:5] if profile else [],
                'avatar': u.avatar,
                'department': dept,
            })

        total = len(students)
        start = (page - 1) * page_size
        paginated = students[start:start + page_size]

        return success_response(data={
            'results': paginated,
            'count': total,
            'page': page,
            'page_size': page_size,
            'total_pages': (total + page_size - 1) // page_size,
        })


class HODAlumniView(APIView):
    """List all alumni in the HOD's department."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'hod':
            return error_response('Access denied. HODs only.', status_code=status.HTTP_403_FORBIDDEN)

        dept = (request.user.department or '').upper()
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))
        search = request.query_params.get('search', '').strip().lower()

        alumni_list = []
        for u in User.objects(role='alumni', department__iexact=dept):
            if search and search not in u.full_name.lower() and search not in u.email.lower():
                continue
            profile = AlumniProfile.objects(user=u).first()
            alumni_list.append({
                'id': str(u.uid),
                'name': u.full_name,
                'email': u.email,
                'graduationYear': profile.graduation_year if profile else None,
                'currentCompany': profile.current_company if profile else '',
                'currentPosition': profile.current_position if profile else '',
                'isVerified': profile.is_verified if profile else False,
                'avatar': u.avatar,
                'department': dept,
            })

        total = len(alumni_list)
        start = (page - 1) * page_size
        paginated = alumni_list[start:start + page_size]

        return success_response(data={
            'results': paginated,
            'count': total,
            'page': page,
            'page_size': page_size,
            'total_pages': (total + page_size - 1) // page_size,
        })


class HODInsightsView(APIView):
    """Analytics and insights for HOD — department-wide aggregation."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'hod':
            return error_response('Access denied. HODs only.', status_code=status.HTTP_403_FORBIDDEN)

        dept = (request.user.department or '').upper()
        dept_students = User.objects(role='student', department__iexact=dept)
        total_students = dept_students.count()

        dept_alumni = User.objects(role='alumni', department__iexact=dept)
        total_alumni = dept_alumni.count()

        year_stats = {}
        career_interests = {}
        skills_count = {}
        placed_count = 0
        cgpa_sum = 0.0
        cgpa_count = 0
        top_recruiters = {}

        for u in dept_students:
            profile = StudentProfile.objects(user=u).first()
            if not profile:
                continue
            year = profile.current_year or profile.year
            if year:
                key = f'Year {year}'
                year_stats[key] = year_stats.get(key, 0) + 1
            if profile.career_interest:
                career_interests[profile.career_interest] = career_interests.get(profile.career_interest, 0) + 1
            for sk in (profile.skills or []):
                name = sk if isinstance(sk, str) else sk.get('name', '')
                if name:
                    skills_count[name] = skills_count.get(name, 0) + 1
            if profile.cgpa:
                try:
                    cgpa_sum += float(profile.cgpa)
                    cgpa_count += 1
                except (TypeError, ValueError):
                    pass
            if profile.is_placed:
                placed_count += 1
                for offer in (profile.placement_offers or []):
                    company = offer.company_name or ''
                    if company:
                        top_recruiters[company] = top_recruiters.get(company, 0) + 1

        placement_rate = round((placed_count / total_students * 100), 1) if total_students > 0 else 0
        avg_cgpa = round(cgpa_sum / cgpa_count, 2) if cgpa_count > 0 else 0

        batch_stats = {}
        for u in dept_alumni:
            profile = AlumniProfile.objects(user=u).first()
            if profile and profile.graduation_year:
                key = str(profile.graduation_year)
                batch_stats[key] = batch_stats.get(key, 0) + 1

        return success_response(data={
            'totalStudents': total_students,
            'totalAlumni': total_alumni,
            'placements': placed_count,
            'placementRate': placement_rate,
            'avgCgpa': avg_cgpa,
            'department': dept,
            'yearDistribution': [{'year': k, 'count': v} for k, v in sorted(year_stats.items())],
            'careerInterests': [
                {'label': k, 'value': v}
                for k, v in sorted(career_interests.items(), key=lambda x: -x[1])[:6]
            ],
            'topSkills': [
                {'skill': k, 'count': v}
                for k, v in sorted(skills_count.items(), key=lambda x: -x[1])[:10]
            ],
            'topRecruiters': [
                {'company': k, 'hires': v}
                for k, v in sorted(top_recruiters.items(), key=lambda x: -x[1])[:8]
            ],
            'batchDistribution': [
                {'batch': k, 'count': v} for k, v in sorted(batch_stats.items())
            ],
        })


# ============== PRINCIPAL VIEWS ==============

class PrincipalStatsView(APIView):
    """Institution-wide stats for Principal home dashboard."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'principal':
            return error_response('Access denied. Principal only.', status_code=status.HTTP_403_FORBIDDEN)

        from apps.accounts.models import User as DjangoUser

        total_students = User.objects(role='student').count()
        total_alumni = User.objects(role='alumni').count()
        total_counsellors = DjangoUser.objects.filter(role='counsellor', is_active=True).count()
        total_hods = DjangoUser.objects.filter(role='hod', is_active=True).count()

        placed_count = 0
        top_recruiters = {}

        for u in User.objects(role='student'):
            profile = StudentProfile.objects(user=u).first()
            if not profile:
                continue
            if profile.is_placed:
                placed_count += 1
                for offer in (profile.placement_offers or []):
                    company = offer.company_name or ''
                    if company:
                        top_recruiters[company] = top_recruiters.get(company, 0) + 1

        placement_rate = round(placed_count / total_students * 100, 1) if total_students > 0 else 0

        # Notable alumni (employed)
        notable_alumni = []
        for u in User.objects(role='alumni'):
            profile = AlumniProfile.objects(user=u).first()
            if profile and profile.current_company:
                notable_alumni.append({
                    'name': u.full_name,
                    'currentCompany': profile.current_company,
                    'currentPosition': profile.current_position or '',
                    'graduationYear': profile.graduation_year,
                    'isVerified': profile.is_verified,
                    'avatar': u.avatar,
                })
            if len(notable_alumni) >= 5:
                break

        # Upcoming events
        upcoming_events = []
        for e in Event.objects(event_date__gte=datetime.now()).order_by('event_date')[:4]:
            upcoming_events.append({
                'id': str(e.id),
                'title': e.title,
                'date': e.event_date.strftime('%b %d, %Y') if e.event_date else '',
                'event_type': e.event_type or 'General',
                'location': e.location or '',
            })

        # Per-department breakdown
        dept_students = {}
        dept_alumni = {}
        for u in User.objects(role='student'):
            d = (u.department or 'UNKNOWN').upper()
            dept_students[d] = dept_students.get(d, 0) + 1
        for u in User.objects(role='alumni'):
            d = (u.department or 'UNKNOWN').upper()
            dept_alumni[d] = dept_alumni.get(d, 0) + 1

        all_depts = set(list(dept_students.keys()) + list(dept_alumni.keys())) - {'UNKNOWN'}
        dept_breakdown = [
            {'dept': d, 'students': dept_students.get(d, 0), 'alumni': dept_alumni.get(d, 0)}
            for d in sorted(all_depts)
        ]

        return success_response(data={
            'totalStudents': total_students,
            'totalAlumni': total_alumni,
            'totalCounsellors': total_counsellors,
            'totalHODs': total_hods,
            'placedCount': placed_count,
            'placementRate': placement_rate,
            'avgPackage': 0,
            'countries': 0,
            'partners': len(top_recruiters),
            'topRecruiters': [
                {'name': k, 'hires': v}
                for k, v in sorted(top_recruiters.items(), key=lambda x: -x[1])[:8]
            ],
            'notableAlumni': notable_alumni,
            'upcomingEvents': upcoming_events,
            'departmentBreakdown': dept_breakdown,
        })


class PrincipalStudentsView(APIView):
    """List all students across all departments for Principal."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'principal':
            return error_response('Access denied. Principal only.', status_code=status.HTTP_403_FORBIDDEN)

        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))
        search = request.query_params.get('search', '').strip().lower()
        dept_filter = request.query_params.get('department', '').strip().upper()

        students = []
        query = User.objects(role='student')
        if dept_filter:
            query = User.objects(role='student', department__iexact=dept_filter)

        for u in query:
            if search and search not in u.full_name.lower() and search not in u.email.lower():
                continue
            profile = StudentProfile.objects(user=u).first()
            students.append({
                'id': str(u.uid),
                'name': u.full_name,
                'email': u.email,
                'rollNo': profile.roll_no if profile else '',
                'department': (u.department or '').upper(),
                'year': profile.current_year or profile.year if profile else None,
                'cgpa': float(profile.cgpa) if profile and profile.cgpa else None,
                'isPlaced': profile.is_placed if profile else False,
                'skills': (profile.skills or [])[:5] if profile else [],
                'avatar': u.avatar,
            })

        total = len(students)
        start = (page - 1) * page_size
        paginated = students[start:start + page_size]

        return success_response(data={
            'results': paginated,
            'count': total,
            'page': page,
            'page_size': page_size,
            'total_pages': (total + page_size - 1) // page_size,
        })


class PrincipalAlumniView(APIView):
    """List all alumni across all departments for Principal."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'principal':
            return error_response('Access denied. Principal only.', status_code=status.HTTP_403_FORBIDDEN)

        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))
        search = request.query_params.get('search', '').strip().lower()
        dept_filter = request.query_params.get('department', '').strip().upper()

        alumni_list = []
        query = User.objects(role='alumni')
        if dept_filter:
            query = User.objects(role='alumni', department__iexact=dept_filter)

        for u in query:
            if search and search not in u.full_name.lower() and search not in u.email.lower():
                continue
            profile = AlumniProfile.objects(user=u).first()
            alumni_list.append({
                'id': str(u.uid),
                'name': u.full_name,
                'email': u.email,
                'department': (u.department or '').upper(),
                'graduationYear': profile.graduation_year if profile else None,
                'currentCompany': profile.current_company if profile else '',
                'currentPosition': profile.current_position if profile else '',
                'isVerified': profile.is_verified if profile else False,
                'avatar': u.avatar,
            })

        total = len(alumni_list)
        start = (page - 1) * page_size
        paginated = alumni_list[start:start + page_size]

        return success_response(data={
            'results': paginated,
            'count': total,
            'page': page,
            'page_size': page_size,
            'total_pages': (total + page_size - 1) // page_size,
        })


class PrincipalInsightsView(APIView):
    """Institution-wide analytics for Principal — InstitutionAnalytics page."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'principal':
            return error_response('Access denied. Principal only.', status_code=status.HTTP_403_FORBIDDEN)

        # Aggregate across ALL departments
        placed_count = 0
        total_students = 0
        skills_count = {}
        career_interests = {}
        top_recruiters = {}
        dept_placed = {}
        dept_total = {}

        for u in User.objects(role='student'):
            d = (u.department or 'UNKNOWN').upper()
            dept_total[d] = dept_total.get(d, 0) + 1
            total_students += 1
            profile = StudentProfile.objects(user=u).first()
            if not profile:
                continue
            for sk in (profile.skills or []):
                name = sk if isinstance(sk, str) else sk.get('name', '')
                if name:
                    skills_count[name] = skills_count.get(name, 0) + 1
            if profile.career_interest:
                career_interests[profile.career_interest] = career_interests.get(profile.career_interest, 0) + 1
            if profile.is_placed:
                placed_count += 1
                dept_placed[d] = dept_placed.get(d, 0) + 1
                for offer in (profile.placement_offers or []):
                    company = offer.company_name or ''
                    if company:
                        top_recruiters[company] = top_recruiters.get(company, 0) + 1

        total_alumni = 0
        dept_alumni = {}
        batch_stats = {}

        for u in User.objects(role='alumni'):
            d = (u.department or 'UNKNOWN').upper()
            dept_alumni[d] = dept_alumni.get(d, 0) + 1
            total_alumni += 1
            profile = AlumniProfile.objects(user=u).first()
            if profile and profile.graduation_year:
                key = str(profile.graduation_year)
                batch_stats[key] = batch_stats.get(key, 0) + 1
            # Count alumni with companies as placement proxy
            if profile and profile.current_company:
                top_recruiters[profile.current_company] = top_recruiters.get(profile.current_company, 0) + 1

        overall_placement_rate = round(placed_count / total_students * 100, 1) if total_students > 0 else 0

        # Per-department stats table
        all_depts = set(list(dept_total.keys()) + list(dept_alumni.keys())) - {'UNKNOWN'}
        department_stats = []
        for d in sorted(all_depts):
            students = dept_total.get(d, 0)
            placed = dept_placed.get(d, 0)
            alumni = dept_alumni.get(d, 0)
            rate = round(placed / students * 100, 1) if students > 0 else 0
            department_stats.append({
                'dept': d,
                'students': students,
                'placed': placed,
                'rate': rate,
                'alumni': alumni,
            })

        return success_response(data={
            'totalStudents': total_students,
            'totalAlumni': total_alumni,
            'overallPlacementRate': overall_placement_rate,
            'avgPackage': 0,
            'departmentStats': department_stats,
            'topRecruiters': [
                {'company': k, 'hires': v}
                for k, v in sorted(top_recruiters.items(), key=lambda x: -x[1])[:10]
            ],
            'topSkills': [
                {'skill': k, 'count': v}
                for k, v in sorted(skills_count.items(), key=lambda x: -x[1])[:10]
            ],
            'careerInterests': [
                {'label': k, 'value': v}
                for k, v in sorted(career_interests.items(), key=lambda x: -x[1])[:6]
            ],
            'batchDistribution': [
                {'batch': k, 'count': v} for k, v in sorted(batch_stats.items())
            ],
        })
