"""
AI-powered recommendation engine using TF-IDF and cosine similarity.
"""
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from django.contrib.auth import get_user_model
from apps.accounts.models import StudentProfile, AlumniProfile
from apps.jobs.models import Job

User = get_user_model()


class CareerRecommendationEngine:
    """
    AI engine for career recommendations using TF-IDF and cosine similarity.
    """
    
    def __init__(self):
        self.vectorizer = TfidfVectorizer(
            stop_words='english',
            max_features=1000,
            ngram_range=(1, 2)
        )
    
    def _extract_skill_names(self, skills_list):
        """Extract skill names handling both string and dict formats."""
        if not skills_list:
            return []
        return [
            s['name'] if isinstance(s, dict) else str(s)
            for s in skills_list
        ]

    def get_student_profile_text(self, student_profile):
        """Convert student profile to text for vectorization."""
        skills = ' '.join(self._extract_skill_names(student_profile.skills))
        interests = ' '.join(student_profile.interests) if student_profile.interests else ''
        bio = student_profile.bio or ''
        department = student_profile.user.department or ''
        
        return f"{skills} {interests} {bio} {department}"
    
    def get_alumni_profile_text(self, alumni_profile):
        """Convert alumni profile to text for vectorization."""
        skills = ' '.join(self._extract_skill_names(alumni_profile.skills))
        expertise = ' '.join(alumni_profile.expertise_areas) if alumni_profile.expertise_areas else ''
        bio = alumni_profile.bio or ''
        company = alumni_profile.current_company or ''
        designation = alumni_profile.current_designation or ''
        industry = alumni_profile.industry or ''
        department = alumni_profile.user.department or ''
        
        return f"{skills} {expertise} {bio} {company} {designation} {industry} {department}"
    
    def get_job_text(self, job):
        """Convert job posting to text for vectorization."""
        skills = ' '.join(job.skills_required) if job.skills_required else ''
        qualifications = ' '.join(job.qualifications) if job.qualifications else ''
        
        return f"{job.title} {job.company} {job.description} {skills} {qualifications} {job.location}"
    
    def recommend_alumni_mentors(self, student_id, limit=5):
        """
        Recommend alumni mentors for a student based on profile similarity.
        """
        try:
            student = StudentProfile.objects.get(user_id=student_id)
        except StudentProfile.DoesNotExist:
            return []
        
        # Get verified alumni who are available for mentoring
        alumni_profiles = AlumniProfile.objects.filter(
            user__is_verified=True,
            available_for_mentoring=True
        ).select_related('user')
        
        if not alumni_profiles.exists():
            return []
        
        # Prepare texts
        student_text = self.get_student_profile_text(student)
        alumni_texts = [self.get_alumni_profile_text(ap) for ap in alumni_profiles]
        
        all_texts = [student_text] + alumni_texts
        
        # Vectorize
        try:
            tfidf_matrix = self.vectorizer.fit_transform(all_texts)
        except ValueError:
            return []
        
        # Calculate similarity
        student_vector = tfidf_matrix[0:1]
        alumni_vectors = tfidf_matrix[1:]
        
        similarities = cosine_similarity(student_vector, alumni_vectors).flatten()
        
        # Get top matches
        top_indices = np.argsort(similarities)[::-1][:limit]
        
        recommendations = []
        alumni_list = list(alumni_profiles)
        student_skills_lower = set(s.lower() for s in self._extract_skill_names(student.skills or []))
        
        for idx in top_indices:
            if similarities[idx] > 0:  # Only include if there's some similarity
                alumni = alumni_list[idx]

                # Skill-overlap based score (more meaningful than raw TF-IDF cosine %)
                # 60% weight: % of mentor's skills the student already has
                # 40% weight: % of student's skills the mentor can guide on
                alumni_skills_lower = set(s.lower() for s in self._extract_skill_names(alumni.skills or []))
                if alumni_skills_lower and student_skills_lower:
                    overlap = len(student_skills_lower & alumni_skills_lower)
                    pct_mentor = overlap / len(alumni_skills_lower)
                    pct_student = overlap / len(student_skills_lower)
                    similarity_score = round((pct_mentor * 0.6 + pct_student * 0.4) * 100, 1)
                else:
                    similarity_score = round(float(similarities[idx]) * 100, 1)

                recommendations.append({
                    'alumni_id': alumni.user.id,
                    'name': alumni.user.full_name,
                    'email': alumni.user.email,
                    'company': alumni.current_company,
                    'designation': alumni.current_designation,
                    'industry': alumni.industry,
                    'skills': alumni.skills,
                    'expertise_areas': alumni.expertise_areas,
                    'similarity_score': similarity_score
                })
        
        return recommendations
    
    def recommend_jobs(self, student_id, limit=10):
        """
        Recommend jobs for a student based on profile matching.
        """
        try:
            student = StudentProfile.objects.get(user_id=student_id)
        except StudentProfile.DoesNotExist:
            return []
        
        # Get open jobs
        jobs = Job.objects.filter(status='open').select_related('posted_by')
        
        if not jobs.exists():
            return []
        
        # Prepare texts
        student_text = self.get_student_profile_text(student)
        job_texts = [self.get_job_text(job) for job in jobs]
        
        all_texts = [student_text] + job_texts
        
        # Vectorize
        try:
            tfidf_matrix = self.vectorizer.fit_transform(all_texts)
        except ValueError:
            return []
        
        # Calculate similarity
        student_vector = tfidf_matrix[0:1]
        job_vectors = tfidf_matrix[1:]
        
        similarities = cosine_similarity(student_vector, job_vectors).flatten()
        
        # Get top matches
        top_indices = np.argsort(similarities)[::-1][:limit]
        
        recommendations = []
        job_list = list(jobs)
        student_skills_lower = set(s.lower() for s in self._extract_skill_names(student.skills or []))

        for idx in top_indices:
            if similarities[idx] > 0:
                job = job_list[idx]

                # Skill overlap %: how many of the job's required skills the student has
                required_lower = set(s.lower() for s in (job.skills_required or []))
                if required_lower:
                    matched = len(student_skills_lower & required_lower)
                    match_score = round(matched / len(required_lower) * 100, 1)
                else:
                    match_score = round(float(similarities[idx]) * 100, 1)

                recommendations.append({
                    'job_id': job.id,
                    'title': job.title,
                    'company': job.company,
                    'location': job.location,
                    'job_type': job.job_type,
                    'skills_required': job.skills_required,
                    'salary_min': str(job.salary_min) if job.salary_min else None,
                    'salary_max': str(job.salary_max) if job.salary_max else None,
                    'match_score': match_score
                })
        
        return recommendations
    
    def recommend_career_paths(self, student_id):
        """
        Recommend career paths based on successful alumni in similar profiles.
        """
        try:
            student = StudentProfile.objects.get(user_id=student_id)
        except StudentProfile.DoesNotExist:
            return []
        
        # Get verified alumni
        alumni_profiles = AlumniProfile.objects.filter(
            user__is_verified=True
        ).select_related('user')
        
        # Filter by department for more relevant recommendations
        if student.user.department:
            same_dept = alumni_profiles.filter(
                user__department=student.user.department
            )
            if same_dept.exists():
                alumni_profiles = same_dept
        
        if not alumni_profiles.exists():
            return []
        
        # Analyze career paths
        career_paths = {}
        
        for alumni in alumni_profiles:
            industry = alumni.industry or 'Other'
            designation = alumni.current_designation or 'Professional'
            
            key = f"{industry} - {designation}"
            if key not in career_paths:
                career_paths[key] = {
                    'industry': industry,
                    'common_designation': designation,
                    'count': 0,
                    'companies': set(),
                    'skills': set(),
                    'avg_experience': 0,
                    'total_experience': 0,
                }
            
            career_paths[key]['count'] += 1
            if alumni.current_company:
                career_paths[key]['companies'].add(alumni.current_company)
            if alumni.skills:
                career_paths[key]['skills'].update(self._extract_skill_names(alumni.skills)[:5])
            career_paths[key]['total_experience'] += alumni.experience_years
        
        # Calculate averages and convert sets to lists
        for key in career_paths:
            path = career_paths[key]
            if path['count'] > 0:
                path['avg_experience'] = round(
                    path['total_experience'] / path['count'], 1
                )
            path['companies'] = list(path['companies'])[:5]
            path['skills'] = list(path['skills'])[:10]
            del path['total_experience']
        
        # Sort by count
        sorted_paths = sorted(
            career_paths.values(),
            key=lambda x: x['count'],
            reverse=True
        )
        
        return sorted_paths[:5]
    
    def get_skill_gap_analysis(self, student_id):
        """
        Analyze skill gaps based on job market demand.
        """
        try:
            student = StudentProfile.objects.get(user_id=student_id)
        except StudentProfile.DoesNotExist:
            return {}
        
        student_skill_names = self._extract_skill_names(student.skills)
        student_skills_lower = set(s.lower() for s in student_skill_names)
        
        # Build a lookup: lowercase name -> {display_name, count}
        # to preserve original capitalization from job postings
        job_skills = {}  # lowercase -> {'name': original_case, 'count': int}
        jobs = Job.objects.filter(status='open')
        for job in jobs:
            for skill in (job.skills_required or []):
                key = skill.lower()
                if key not in job_skills:
                    job_skills[key] = {'name': skill, 'count': 0}
                job_skills[key]['count'] += 1
        
        # Sort by demand
        sorted_skills = sorted(
            job_skills.items(),
            key=lambda x: x[1]['count'],
            reverse=True
        )
        
        # Skills student already has (in-demand, original case)
        matching_skills = [
            job_skills[s]['name']
            for s, _ in sorted_skills if s in student_skills_lower
        ][:10]
        
        # Skills student is missing (in-demand, original case)
        missing_skills = [
            {'skill': job_skills[s]['name'], 'demand_count': job_skills[s]['count']}
            for s, _ in sorted_skills
            if s not in student_skills_lower
        ][:10]
        
        # Current skills as plain name strings for display
        current_skill_names = student_skill_names
        
        return {
            'current_skills': current_skill_names,
            'matching_in_demand_skills': matching_skills,
            'recommended_skills_to_learn': missing_skills,
            'skill_coverage': (
                len(matching_skills) / len(sorted_skills) * 100
                if sorted_skills else 0
            )
        }
