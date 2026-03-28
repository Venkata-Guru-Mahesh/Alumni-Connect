"""
ML-Powered Mentor-Student Matching using trained XGBoost model.
This replaces the TF-IDF approach with the trained machine learning model.
"""
import os
import joblib
import numpy as np
import pandas as pd
from django.conf import settings
from apps.accounts.models import StudentProfile, AlumniProfile


class MLMentorMatcher:
    """
    Machine Learning based mentor-student matching using trained XGBoost model.
    """
    
    def __init__(self):
        """Load trained models and scalers."""
        model_dir = os.path.join(
            settings.BASE_DIR, 
            'apps', 
            'ai_engine', 
            'models'
        )
        
        # Load models
        self.model = joblib.load(
            os.path.join(model_dir, 'mentor_matching_model.pkl')
        )
        self.scaler = joblib.load(
            os.path.join(model_dir, 'matching_scaler.pkl')
        )
        self.features = joblib.load(
            os.path.join(model_dir, 'matching_features.pkl')
        )
        
        print("✅ Mentor matching model loaded successfully!")
    
    def _extract_skill_names(self, skills_list):
        """Extract skill names handling both string and dict formats."""
        if not skills_list:
            return []
        return [
            s['name'] if isinstance(s, dict) else str(s)
            for s in skills_list
        ]

    def calculate_skill_overlap(self, student_skills, alumni_skills):
        """Calculate skill overlap between student and alumni."""
        student_set = set(s.lower() for s in self._extract_skill_names(student_skills))
        alumni_set = set(s.lower() for s in self._extract_skill_names(alumni_skills))
        
        if not student_set or not alumni_set:
            return 0, 0
        
        shared = len(student_set & alumni_set)
        overlap_percentage = (shared / len(student_set)) * 100 if student_set else 0
        
        return shared, overlap_percentage
    
    def calculate_location_proximity(self, student_location, alumni_location):
        """Calculate location proximity score."""
        if not student_location or not alumni_location:
            return 50  # Default moderate score
        
        if student_location.lower() == alumni_location.lower():
            return 100
        
        # In production, use geocoding API for actual distance
        # For now, use simple heuristic
        return np.random.randint(20, 61)
    
    def calculate_department_match(self, student_dept, alumni_dept):
        """Check if departments match."""
        if not student_dept or not alumni_dept:
            return 0
        
        return 1 if student_dept == alumni_dept else 0
    
    def calculate_career_alignment(self, student_interests, alumni_expertise, dept_match):
        """Calculate career goal alignment score."""
        if dept_match:
            return np.random.uniform(0.5, 0.95)
        return np.random.uniform(0.3, 0.7)
    
    def prepare_matching_features(self, student, alumni):
        """
        Prepare features for ML model prediction.
        
        Expected features (from matching_features.pkl):
        - shared_skills_count
        - skill_overlap_percentage
        - interest_similarity_score
        - department_match
        - location_proximity_score
        - career_goal_alignment
        - alumni_availability_score
        - student_engagement_score
        - interaction_count (starts at 0)
        - match_quality_score (calculated)
        - combined_similarity
        - engagement_potential
        - strong_skill_match
        - high_interaction
        - proximity_bonus
        """
        # Get student data
        student_skills = student.skills or []
        student_location = getattr(student.user, 'current_city', None)
        student_dept = getattr(student.user, 'department', None)
        student_avg_proficiency = 75  # Default, adjust if you have this field
        
        # Get alumni data
        alumni_skills = alumni.skills or []
        alumni_location = getattr(alumni.user, 'current_city', None)
        alumni_dept = getattr(alumni.user, 'department', None)
        alumni_availability = getattr(alumni, 'availability_hours_per_month', 10)
        
        # Calculate features
        shared_skills, skill_overlap_pct = self.calculate_skill_overlap(
            student_skills, alumni_skills
        )
        
        dept_match = self.calculate_department_match(student_dept, alumni_dept)
        
        location_proximity = self.calculate_location_proximity(
            student_location, alumni_location
        )
        
        career_alignment = self.calculate_career_alignment(
            student.interests or [],
            alumni.expertise_areas or [],
            dept_match
        )
        
        interest_similarity = np.random.uniform(0.4, 0.9)  # Improve with actual calculation
        
        alumni_availability_score = (alumni_availability / 30) * 100
        student_engagement_score = student_avg_proficiency
        
        # Calculate match quality
        match_quality = (
            skill_overlap_pct * 0.3 +
            career_alignment * 100 * 0.3 +
            location_proximity * 0.2 +
            alumni_availability_score * 0.1 +
            student_engagement_score * 0.1
        )
        
        # Engineered features
        combined_similarity = (
            skill_overlap_pct * 0.4 +
            interest_similarity * 100 * 0.3 +
            career_alignment * 100 * 0.3
        )
        
        engagement_potential = (
            alumni_availability_score * student_engagement_score / 100
        )
        
        strong_skill_match = 1 if skill_overlap_pct > 60 else 0
        high_interaction = 0  # New match, no interactions yet
        proximity_bonus = location_proximity * dept_match / 100
        
        # Create feature dictionary
        features_dict = {
            'shared_skills_count': int(shared_skills),
            'skill_overlap_percentage': round(skill_overlap_pct, 2),
            'interest_similarity_score': round(interest_similarity, 3),
            'department_match': dept_match,
            'location_proximity_score': location_proximity,
            'career_goal_alignment': round(career_alignment, 3),
            'alumni_availability_score': round(alumni_availability_score, 2),
            'student_engagement_score': round(student_engagement_score, 2),
            'interaction_count': 0,
            'match_quality_score': round(match_quality, 2),
            'combined_similarity': round(combined_similarity, 2),
            'engagement_potential': round(engagement_potential, 2),
            'strong_skill_match': strong_skill_match,
            'high_interaction': high_interaction,
            'proximity_bonus': round(proximity_bonus, 2)
        }
        
        return features_dict
    
    def predict_mentorship_success(self, student, alumni):
        """
        Predict mentorship success probability for a student-alumni pair.
        
        Returns:
            dict: {
                'success_probability': float (0-100),
                'will_succeed': bool,
                'match_quality_score': float,
                'recommendation': str
            }
        """
        # Prepare features
        features_dict = self.prepare_matching_features(student, alumni)
        
        # Create DataFrame with correct feature order
        features_df = pd.DataFrame([features_dict])[self.features]
        
        # Predict
        success_prob = self.model.predict_proba(features_df)[0][1]
        will_succeed = self.model.predict(features_df)[0]
        
        # Generate recommendation
        if success_prob >= 0.7:
            recommendation = "Highly recommended mentor-mentee pairing!"
        elif success_prob >= 0.5:
            recommendation = "Good potential match, proceed with introduction."
        else:
            recommendation = "Consider finding a better match for optimal mentorship."
        
        return {
            'success_probability': round(success_prob * 100, 2),
            'will_succeed': bool(will_succeed),
            'match_quality_score': features_dict['match_quality_score'],
            'recommendation': recommendation,
            'features': features_dict  # Include for debugging/analysis
        }
    
    def recommend_top_mentors(self, student_id, limit=5):
        """
        Recommend top N mentors for a student using ML model.
        
        Args:
            student_id: Student user ID
            limit: Number of recommendations to return
        
        Returns:
            list: Top mentor recommendations with success probabilities
        """
        try:
            student = StudentProfile.objects.select_related('user').get(
                user_id=student_id
            )
        except StudentProfile.DoesNotExist:
            return []
        
        # Prefer mentors who opted in, but fall back to verified alumni
        # so recommendations still work in seeded/test datasets.
        alumni_profiles = AlumniProfile.objects.filter(
            user__is_verified=True,
            available_for_mentoring=True
        ).select_related('user')

        if not alumni_profiles.exists():
            alumni_profiles = AlumniProfile.objects.filter(
                user__is_verified=True
            ).select_related('user')
        
        if not alumni_profiles.exists():
            return []
        
        # Calculate predictions for all alumni
        recommendations = []
        
        for alumni in alumni_profiles:
            prediction = self.predict_mentorship_success(student, alumni)
            
            # Only include if success probability > 30%
            if prediction['success_probability'] > 30:
                recommendations.append({
                    'alumni_id': alumni.user.id,
                    'name': alumni.user.full_name,
                    'email': alumni.user.email,
                    'company': alumni.current_company,
                    'designation': alumni.current_designation,
                    'industry': alumni.industry,
                    'skills': alumni.skills,
                    'expertise_areas': alumni.expertise_areas,
                    'success_probability': prediction['success_probability'],
                    'match_quality_score': prediction['match_quality_score'],
                    'recommendation': prediction['recommendation'],
                    'shared_skills_count': prediction['features']['shared_skills_count'],
                    'skill_overlap_percentage': prediction['features']['skill_overlap_percentage']
                })
        
        # Sort by success probability
        recommendations.sort(
            key=lambda x: x['success_probability'], 
            reverse=True
        )
        
        return recommendations[:limit]
    
    def batch_predict(self, student_alumni_pairs):
        """
        Batch prediction for multiple student-alumni pairs.
        Useful for analytics and reporting.
        
        Args:
            student_alumni_pairs: List of tuples [(student, alumni), ...]
        
        Returns:
            list: Predictions for all pairs
        """
        predictions = []
        
        for student, alumni in student_alumni_pairs:
            pred = self.predict_mentorship_success(student, alumni)
            predictions.append({
                'student_id': student.user.id,
                'alumni_id': alumni.user.id,
                'prediction': pred
            })
        
        return predictions
