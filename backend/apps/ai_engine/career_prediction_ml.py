"""
ML-Powered Career & Placement Prediction.
Uses a transparent, formula-based scoring approach calibrated for realistic
placement probabilities and salary estimates derived from student profile data.
"""
import numpy as np
from django.conf import settings
from apps.accounts.models import StudentProfile


class MLCareerPredictor:
    """
    Career prediction engine using weighted feature scoring.
    Produces realistic, per-student varied placement probabilities and
    salary estimates based on actual profile data.
    """

    def __init__(self):
        """No model files needed — pure formula-based prediction."""
        pass

    def prepare_student_features(self, student):
        """
        Extract and compute features from student profile.
        """
        cgpa = float(getattr(student, 'cgpa', None) or 7.0)
        num_skills = len(student.skills) if student.skills else 0
        num_certifications = len(student.certifications) if student.certifications else 0
        num_internships = len(student.internships) if student.internships else 0

        # Check both social_profiles JSONField and legacy URL fields
        social = student.social_profiles or {}
        has_linkedin = 1 if (social.get('linkedin') or student.linkedin_url) else 0
        has_github = 1 if (social.get('github') or student.github_url) else 0
        has_portfolio = 1 if (social.get('portfolio') or student.portfolio_url) else 0

        # Compute average skill proficiency from real proficiency levels
        proficiency_map = {'beginner': 25, 'intermediate': 50, 'advanced': 75, 'expert': 100}
        proficiency_values = [
            proficiency_map.get(s['proficiency'].lower(), 50)
            if isinstance(s, dict) and s.get('proficiency') else 50
            for s in (student.skills or [])
        ]
        avg_skill_proficiency = (
            sum(proficiency_values) / len(proficiency_values)
            if proficiency_values else 50
        )

        department = getattr(student.user, 'department', None) or ''
        premium_depts = ['CSE', 'IT', 'ECE', 'CSM', 'CIC', 'CSO', 'AID', 'AIML']
        is_premium_dept = 1 if department in premium_depts else 0

        current_year = getattr(student, 'current_year', None) or 1
        is_final_year = 1 if current_year >= 4 else 0

        total_internship_months = num_internships * 3
        experience_score = num_internships * 2 + num_certifications + total_internship_months * 0.5
        profile_completeness = (has_linkedin + has_github + has_portfolio) / 3 * 100
        skills_diversity = num_skills * avg_skill_proficiency / 100

        return {
            'cgpa': float(cgpa),
            'num_skills': int(num_skills),
            'num_certifications': int(num_certifications),
            'num_internships': int(num_internships),
            'has_linkedin': int(has_linkedin),
            'has_github': int(has_github),
            'has_portfolio': int(has_portfolio),
            'avg_skill_proficiency': float(avg_skill_proficiency),
            'total_internship_months': float(total_internship_months),
            'experience_score': float(experience_score),
            'profile_completeness': float(profile_completeness),
            'skills_diversity': float(skills_diversity),
            'is_final_year': int(is_final_year),
            'is_premium_dept': int(is_premium_dept),
        }

    def _compute_placement_score(self, f):
        """
        Weighted formula producing a realistic placement probability.

        Max breakdown (100 pts total before capping):
          CGPA          25 pts
          Skills qty    15 pts
          Proficiency   10 pts
          Internships   16 pts
          Certifications 4 pts
          LinkedIn       6 pts
          GitHub         6 pts
          Portfolio      3 pts
          Premium dept   5 pts
          Final year     5 pts
        ─────────────────────
        Total          95 pts  → capped at 92% max to preserve realism
        """
        # CGPA: 25 pts
        cgpa = f['cgpa']
        if cgpa >= 9.0:
            cgpa_pts = 25
        elif cgpa >= 8.5:
            cgpa_pts = 22
        elif cgpa >= 8.0:
            cgpa_pts = 18
        elif cgpa >= 7.5:
            cgpa_pts = 14
        elif cgpa >= 7.0:
            cgpa_pts = 10
        elif cgpa >= 6.5:
            cgpa_pts = 6
        elif cgpa >= 6.0:
            cgpa_pts = 3
        else:
            cgpa_pts = 0

        # Skills: 15 pts for quantity
        skills_pts = min(f['num_skills'] / 10 * 15, 15)
        # Proficiency: 10 pts
        prof_pts = f['avg_skill_proficiency'] / 100 * 10

        # Internships: 16 pts max (2 internships = full marks)
        internship_pts = min(f['num_internships'] * 8, 16)
        # Certifications: 4 pts max
        cert_pts = min(f['num_certifications'] * 2, 4)

        # Online presence: 6+6+3 = 15 pts
        presence_pts = f['has_linkedin'] * 6 + f['has_github'] * 6 + f['has_portfolio'] * 3

        # Department + year
        dept_pts = f['is_premium_dept'] * 5
        year_pts = f['is_final_year'] * 5

        raw = cgpa_pts + skills_pts + prof_pts + internship_pts + cert_pts + presence_pts + dept_pts + year_pts

        # Base 8% offset so even weak profiles show something
        probability = 8 + raw
        return round(min(max(probability, 10), 92), 1)

    def _compute_salary(self, f, placement_prob):
        """
        Estimate salary package (INR) based on student features.
        Returns a realistic package for Indian placement context.
        """
        # Starting base: 3.5 LPA
        salary = 350_000

        # CGPA bonus: up to 2L
        salary += max(0, (f['cgpa'] - 6.0) * 80_000)

        # Skills: 25k per skill (max +3.75L for 15 skills)
        salary += min(f['num_skills'] * 25_000, 375_000)

        # Proficiency bonus: up to 1.5L
        salary += f['avg_skill_proficiency'] / 100 * 150_000

        # Internship experience: 1.5L per internship (max 3L)
        salary += min(f['num_internships'] * 150_000, 300_000)

        # Certifications: 30k each (max 1.5L)
        salary += min(f['num_certifications'] * 30_000, 150_000)

        # Online presence signals employability
        salary += (f['has_linkedin'] + f['has_github'] + f['has_portfolio']) * 30_000

        # Premium department premium
        salary += f['is_premium_dept'] * 200_000

        return round(salary, -3)  # round to nearest thousand
        
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
        Predict placement probability using weighted feature scoring.
        """
        features_dict = self.prepare_student_features(student)
        placement_prob = self._compute_placement_score(features_dict)

        will_be_placed = placement_prob >= 60

        if placement_prob >= 80:
            confidence_level = "High"
        elif placement_prob >= 60:
            confidence_level = "Medium"
        else:
            confidence_level = "Low"

        if placement_prob >= 75:
            recommendation = "Strong profile! Focus on interview preparation and company research."
        elif placement_prob >= 55:
            recommendation = "Good chances. Strengthen technical skills and add more projects."
        elif placement_prob >= 35:
            recommendation = "Build your profile — gain internship experience and earn certifications."
        else:
            recommendation = "Start with the basics: add skills, create LinkedIn & GitHub, and aim to improve your CGPA."

        return {
            'will_be_placed': will_be_placed,
            'placement_probability': placement_prob,
            'confidence_level': confidence_level,
            'recommendation': recommendation,
            'features': features_dict,
        }

    def predict_salary(self, student):
        """
        Estimate salary package based on student profile.
        """
        placement_pred = self.predict_placement(student)

        if not placement_pred['will_be_placed']:
            return {
                'predicted_salary': None,
                'salary_range_min': None,
                'salary_range_max': None,
                'message': 'Salary prediction available only for likely placements',
                'placement_probability': placement_pred['placement_probability'],
            }

        predicted_salary = self._compute_salary(
            placement_pred['features'],
            placement_pred['placement_probability']
        )
        confidence = placement_pred['confidence_level']
        uncertainty = 0.12 if confidence == 'High' else 0.18

        return {
            'predicted_salary': round(predicted_salary, 2),
            'salary_range_min': round(predicted_salary * (1 - uncertainty), 2),
            'salary_range_max': round(predicted_salary * (1 + uncertainty), 2),
            'confidence_level': confidence,
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
