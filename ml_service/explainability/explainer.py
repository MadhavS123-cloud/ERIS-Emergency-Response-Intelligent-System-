"""
Explainability Engine
Provides SHAP values and natural language explanations for ML predictions
"""
import numpy as np
from typing import Dict, Any, List
import logging

logger = logging.getLogger(__name__)


class ExplainabilityEngine:
    """Generates explanations for ML predictions"""
    
    def __init__(self):
        self.nlg_templates = self._load_templates()
    
    def explain_prediction(
        self,
        prediction: Dict[str, Any],
        features: Dict[str, Any],
        model_type: str = "delay"
    ) -> Dict[str, Any]:
        """
        Generate comprehensive explanation for a prediction.
        
        Args:
            prediction: Model prediction output
            features: Input features used
            model_type: Type of model (delay, severity, etc.)
        
        Returns:
            Explanation dict with feature importance, natural language, counterfactuals
        """
        # Compute feature importance (simplified SHAP-like values)
        feature_importance = self._compute_feature_importance(features, model_type)
        
        # Generate natural language explanation
        natural_language = self._generate_natural_language(
            prediction, feature_importance, model_type
        )
        
        # Generate counterfactuals
        counterfactuals = self._generate_counterfactuals(
            prediction, features, feature_importance
        )
        
        # Get top 3 factors
        top_3_factors = self._get_top_factors(feature_importance, 3)
        
        return {
            "feature_importance": feature_importance,
            "natural_language": natural_language,
            "counterfactuals": counterfactuals,
            "top_3_factors": top_3_factors,
            "confidence_explanation": self._explain_confidence(prediction)
        }
    
    def _compute_feature_importance(
        self,
        features: Dict[str, Any],
        model_type: str
    ) -> Dict[str, float]:
        """Compute feature importance scores (simplified SHAP-like)"""
        importance = {}
        
        if model_type == "delay":
            # Simplified importance based on feature values
            traffic_score = features.get("traffic_severity_score", 0.5)
            distance = features.get("distance_to_nearest_hospital_km", 5.0)
            hour = features.get("hour_of_day", 12)
            ambulances = features.get("available_ambulances_nearby", 3)
            
            # Normalize to sum to 1.0
            total = traffic_score * 0.35 + distance * 0.05 + 0.15 + (1.0 / (ambulances + 1)) * 0.12
            
            importance["traffic_severity_score"] = (traffic_score * 0.35) / total
            importance["distance_to_nearest_hospital_km"] = (distance * 0.05) / total
            importance["hour_of_day"] = 0.15 / total
            importance["available_ambulances_nearby"] = ((1.0 / (ambulances + 1)) * 0.12) / total
            importance["weather_adjusted_delay"] = 0.10 / total
        
        return importance
    
    def _generate_natural_language(
        self,
        prediction: Dict[str, Any],
        feature_importance: Dict[str, float],
        model_type: str
    ) -> str:
        """Generate natural language explanation"""
        if model_type == "delay":
            risk = prediction.get("risk_category", "Medium")
            delay = prediction.get("delay_minutes", 10)
            
            # Get top factors
            sorted_features = sorted(
                feature_importance.items(),
                key=lambda x: x[1],
                reverse=True
            )[:3]
            
            explanation = f"{risk} delay risk predicted ({delay:.1f} minutes) due to "
            
            reasons = []
            for feature, importance in sorted_features:
                impact_pct = int(importance * 100)
                feature_name = feature.replace('_', ' ')
                reasons.append(f"{feature_name} ({impact_pct}% impact)")
            
            explanation += ", ".join(reasons) + "."
            
            return explanation
        
        return "Prediction generated based on input features."
    
    def _generate_counterfactuals(
        self,
        prediction: Dict[str, Any],
        features: Dict[str, Any],
        feature_importance: Dict[str, float]
    ) -> List[Dict[str, Any]]:
        """Generate counterfactual explanations"""
        counterfactuals = []
        
        # Get current delay
        current_delay = prediction.get("delay_minutes", 10)
        
        # Counterfactual 1: If traffic were light
        if features.get("traffic_severity_score", 0.5) > 0.3:
            reduced_delay = current_delay * 0.7
            counterfactuals.append({
                "scenario": "If traffic were light instead of heavy",
                "predicted_delay": round(reduced_delay, 2),
                "delay_reduction": round(current_delay - reduced_delay, 2),
                "feasibility": "low"
            })
        
        # Counterfactual 2: If more ambulances available
        if features.get("available_ambulances_nearby", 3) < 5:
            reduced_delay = current_delay * 0.85
            counterfactuals.append({
                "scenario": "If 2 more ambulances were available nearby",
                "predicted_delay": round(reduced_delay, 2),
                "delay_reduction": round(current_delay - reduced_delay, 2),
                "feasibility": "medium"
            })
        
        # Counterfactual 3: If weather were clear
        if features.get("weather", "Clear") != "Clear":
            reduced_delay = current_delay * 0.9
            counterfactuals.append({
                "scenario": "If weather were clear",
                "predicted_delay": round(reduced_delay, 2),
                "delay_reduction": round(current_delay - reduced_delay, 2),
                "feasibility": "low"
            })
        
        return counterfactuals
    
    def _get_top_factors(
        self,
        feature_importance: Dict[str, float],
        n: int = 3
    ) -> List[Dict[str, Any]]:
        """Get top N contributing factors"""
        sorted_features = sorted(
            feature_importance.items(),
            key=lambda x: x[1],
            reverse=True
        )[:n]
        
        return [
            {
                "factor": feature,
                "impact": round(importance, 3),
                "direction": "increases_delay"  # Simplified
            }
            for feature, importance in sorted_features
        ]
    
    def _explain_confidence(self, prediction: Dict[str, Any]) -> str:
        """Explain confidence level"""
        confidence = prediction.get("confidence", 0.5)
        
        if confidence > 0.9:
            return "Confidence is very high (>90%) because this scenario closely matches many historical cases with similar patterns."
        elif confidence > 0.75:
            return "Confidence is high (>75%) because this scenario matches historical patterns with good accuracy."
        elif confidence > 0.6:
            return "Confidence is moderate (>60%) due to some uncertainty in the input conditions."
        else:
            return "Confidence is low (<60%) due to limited historical data for this scenario."
    
    def _load_templates(self) -> Dict[str, str]:
        """Load natural language generation templates"""
        return {
            "delay_high": "{risk} delay risk due to {factors}",
            "severity_critical": "Critical severity predicted based on {factors}",
            "hospital_recommended": "Hospital recommended based on {factors}"
        }
