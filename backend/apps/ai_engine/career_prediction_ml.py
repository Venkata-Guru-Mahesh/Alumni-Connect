"""
ML-Powered Career & Placement Prediction using trained models.
Includes job placement prediction and salary prediction.
"""
import os
import joblib
import numpy as np
import pandas as pd
from django.conf import settings
from apps.accounts.models import StudentProfile


class MLCareerPredictor:
    """
    Machine Learning based career prediction using trained XGBoost/LightGBM models.
    """
    
    def __init__(self):
        """Load trained models and preprocessing objects."""
        model_dir = os.path.join(
            settings.BASE_DIR, 
            'apps', 
            'ai_engine', 
            'models'
        )
        
        # Load models
        self.placement_model = joblib.load(
            os.path.join(model_dir, 'placement_prediction_model.pkl')
        )
        self.salary_model = joblib.load(
            os.path.join(model_dir, 'salary_prediction_model.pkl')
        )
        self.scaler = joblib.load(
            os.path.join(model_dir, 'feature_scaler.pkl')
        )
        self.dept_encoder = joblib.load(
            os.path.join(model_dir, 'department_encoder.pkl')
        )
        self.feature_columns = joblib.load(
            os.path.join(model_dir, 'feature_columns.pkl')
        )
        
        print("✅ Career prediction models loaded successfully!")
    
    def prepare_student_features(self, student):
        """
        Prepare features from student profile for model prediction.
        
        Expected features (15):
        - cgpa
        - num_skills
        - num_certifications
        - num_internships
        - has_linkedin
        - has_github
        - has_portfolio
        - avg_skill_proficiency
        - total_internship_months
        - department_encoded
        - experience_score
        - profile_completeness
        - skills_diversity
        - is_final_year
        - is_premium_dept
        """
        # Base features from student profile
        cgpa = getattr(student, 'cgpa', None) or 7.5  # Default CGPA
        num_skills = len(student.skills) if student.skills else 0
        num_certifications = getattr(student, 'certifications_count', None) or 0
        num_internships = getattr(student, 'internships_count', None) or 0
        has_linkedin = 1 if getattr(student, 'linkedin_url', None) else 0
        has_github = 1 if getattr(student, 'github_url', None) else 0
        has_portfolio = 1 if getattr(student, 'portfolio_url', None) else 0
        
        # Calculate average skill proficiency (default 75 if not available)
        avg_skill_proficiency = 75  # Can be enhanced with actual proficiency data
        
        # Total internship months (estimate from count if duration not available)
        total_internship_months = num_internships * 3  # Assume 3 months average
        
        # Encode department
        department = getattr(student.user, 'department', None) or 'CSE'
        try:
            department_encoded = self.dept_encoder.transform([department])[0]
        except:
            department_encoded = 0  # Default to first department if not found
        
        # Engineered features
        experience_score = (
            num_internships * 2 + 
            num_certifications + 
            total_internship_months * 0.5
        )
        
        profile_completeness = (
            (has_linkedin + has_github + has_portfolio) / 3 * 100
        )
        
        skills_diversity = num_skills * avg_skill_proficiency / 100
        
        # Determine if final year (adjust based on your logic)
        current_year = getattr(student, 'current_year', None) or 4
        is_final_year = 1 if current_year >= 4 else 0
        
        # Premium departments (CSE, IT, ECE)
        premium_depts = ['CSE', 'IT', 'ECE', 'CSM', 'CIC', 'CSO', 'AID', 'AIML']
        is_premium_dept = 1 if department in premium_depts else 0
        
        # Create feature dictionary with explicit type casting
        features_dict = {
            'cgpa': float(cgpa),
            'num_skills': int(num_skills),
            'num_certifications': int(num_certifications),
            'num_internships': int(num_internships),
            'has_linkedin': int(has_linkedin),
            'has_github': int(has_github),
            'has_portfolio': int(has_portfolio),
            'avg_skill_proficiency': float(avg_skill_proficiency),
            'total_internship_months': float(total_internship_months),
            'department_encoded': int(department_encoded),
            'experience_score': float(experience_score),
            'profile_completeness': float(profile_completeness),
            'skills_diversity': float(skills_diversity),
            'is_final_year': int(is_final_year),
            'is_premium_dept': int(is_premium_dept)
        }
        
        return features_dict
    
    def predict_placement(self, student):
        """
        Predict if student will get placed and with what probability.
        
        Returns:
            dict: {
                'will_be_placed': bool,
                'placement_probability': float (0-100),
                'confidence_level': str,
                'recommendation': str
            }
        """
        # Prepare features
        features_dict = self.prepare_student_features(student)
        
        # Create DataFrame with correct feature order
        features_df = pd.DataFrame([features_dict])[self.feature_columns]
        
        # Predict
        placement_prob = float(self.placement_model.predict_proba(features_df)[0][1])
        will_be_placed = bool(self.placement_model.predict(features_df)[0])
        
        # Determine confidence level
        if placement_prob >= 0.8 or placement_prob <= 0.2:
            confidence_level = "High"
        elif placement_prob >= 0.6 or placement_prob <= 0.4:
            confidence_level = "Medium"
        else:
            confidence_level = "Low"
        
        # Generate recommendation
        if placement_prob >= 0.7:
            recommendation = "Strong profile! Focus on interview preparation and company research."
        elif placement_prob >= 0.5:
            recommendation = "Good chances. Improve your technical skills and add more projects."
        else:
            recommendation = "Build your profile. Add skills, certifications, and internships."
        
        return {
            'will_be_placed': will_be_placed,
            'placement_probability': round(placement_prob * 100, 2),
            'confidence_level': confidence_level,
            'recommendation': recommendation,
            'features': features_dict  # Include for debugging
        }
    
    def predict_salary(self, student):
        """
        Predict expected salary package for student.
        Only predicts if placement probability is > 50%.
        
        Returns:
            dict: {
                'predicted_salary': float (INR),
                'salary_range_min': float (INR),
                'salary_range_max': float (INR),
                'confidence_level': str
            }
        """
        # First check placement probability
        placement_pred = self.predict_placement(student)
        
        if not placement_pred['will_be_placed']:
            return {
                'predicted_salary': None,
                'salary_range_min': None,
                'salary_range_max': None,
                'message': 'Salary prediction available only for likely placements',
                'placement_probability': placement_pred['placement_probability']
            }
        
        # Prepare features
        features_dict = self.prepare_student_features(student)
        features_df = pd.DataFrame([features_dict])[self.feature_columns]
        
        # Predict salary
        predicted_salary = float(self.salary_model.predict(features_df)[0])
        
        # Calculate range (±15% for uncertainty)
        salary_range_min = predicted_salary * 0.85
        salary_range_max = predicted_salary * 1.15
        
        return {
            'predicted_salary': round(predicted_salary, 2),
            'salary_range_min': round(salary_range_min, 2),
            'salary_range_max': round(salary_range_max, 2),
            'confidence_level': 'High' if placement_pred['placement_probability'] > 80 else 'Medium'
        }
    
    def get_career_analysis(self, student_id):
        """
        Comprehensive career analysis for a student.
        
        Returns:
            dict: Complete analysis with placement, salary, and recommendations
        """
        try:
            student = StudentProfile.objects.select_related('user').get(
                user_id=student_id
            )
        except StudentProfile.DoesNotExist:
            return None
        
        # Get predictions
        placement_pred = self.predict_placement(student)
        salary_pred = self.predict_salary(student)
        
        # Feature importance indicators
        features = placement_pred['features']
        
        # Identify strengths and weaknesses
        strengths = []
        improvements = []
        
        if features['cgpa'] >= 8.0:
            strengths.append(f"Strong CGPA ({features['cgpa']})")
        elif features['cgpa'] < 7.0:
            improvements.append("Improve CGPA")
        
        if features['num_skills'] >= 10:
            strengths.append(f"Good skill set ({features['num_skills']} skills)")
        elif features['num_skills'] < 5:
            improvements.append("Add more technical skills")
        
        if features['num_internships'] >= 2:
            strengths.append(f"Good experience ({features['num_internships']} internships)")
        elif features['num_internships'] == 0:
            improvements.append("Gain internship experience")
        
        if features['profile_completeness'] == 100:
            strengths.append("Complete online presence")
        elif features['profile_completeness'] < 67:
            improvements.append("Build professional online profiles")
        
        return {
            'student_id': student_id,
            'student_name': student.user.full_name,
            'department': student.user.department,
            'placement_prediction': placement_pred,
            'salary_prediction': salary_pred,
            'profile_analysis': {
                'strengths': strengths,
                'areas_for_improvement': improvements,
                'overall_score': round(features['experience_score'] + features['cgpa'] * 10, 2)
            },
            'next_steps': self._generate_next_steps(features, placement_pred)
        }
    
    def _generate_next_steps(self, features, placement_pred):
        """Generate personalized action items."""
        steps = []
        
        if not features['has_linkedin']:
            steps.append("Create LinkedIn profile")
        
        if not features['has_github']:
            steps.append("Create GitHub profile and upload projects")
        
        if features['num_internships'] == 0:
            steps.append("Apply for internships")
        
        if features['num_certifications'] < 3:
            steps.append("Complete relevant certifications")
        
        if features['num_skills'] < 8:
            steps.append("Learn in-demand technical skills")
        
        if placement_pred['placement_probability'] < 70:
            steps.append("Practice coding on platforms like LeetCode")
            steps.append("Build more projects for portfolio")
        
        return steps[:5]  # Return top 5 action items
    
    def batch_predict(self, student_ids):
        """
        Batch prediction for multiple students.
        Useful for counsellors and batch analysis.
        
        Args:
            student_ids: List of student IDs
        
        Returns:
            list: Predictions for all students
        """
        results = []
        
        for student_id in student_ids:
            analysis = self.get_career_analysis(student_id)
            if analysis:
                results.append(analysis)
        
        return results
