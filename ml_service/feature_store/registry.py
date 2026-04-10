"""
Feature Registry
Manages feature definitions and metadata
"""
from typing import Callable, List, Dict, Any, Optional
from dataclasses import dataclass, field
import logging

logger = logging.getLogger(__name__)


@dataclass
class FeatureDefinition:
    """Definition of a feature"""
    name: str
    computation_fn: Callable
    dependencies: List[str] = field(default_factory=list)
    data_type: str = "float"
    description: str = ""
    version: str = "v1"
    category: str = "general"  # temporal, geographic, contextual, historical, derived


class FeatureRegistry:
    """Registry for feature definitions and metadata"""
    
    def __init__(self):
        self._features: Dict[str, FeatureDefinition] = {}
        logger.info("Initialized FeatureRegistry")
    
    def register_feature(
        self,
        name: str,
        computation_fn: Callable,
        dependencies: List[str] = None,
        data_type: str = "float",
        description: str = "",
        version: str = "v1",
        category: str = "general"
    ) -> None:
        """
        Register a new feature definition.
        
        Args:
            name: Feature name (unique identifier)
            computation_fn: Function to compute the feature
            dependencies: List of required input fields
            data_type: Data type (int, float, string, bool)
            description: Human-readable description
            version: Feature version
            category: Feature category (temporal, geographic, etc.)
        """
        if name in self._features:
            logger.warning(f"Feature '{name}' already registered, overwriting")
        
        feature_def = FeatureDefinition(
            name=name,
            computation_fn=computation_fn,
            dependencies=dependencies or [],
            data_type=data_type,
            description=description,
            version=version,
            category=category
        )
        
        self._features[name] = feature_def
        logger.info(f"Registered feature: {name} (category: {category}, version: {version})")
    
    def get_feature(self, name: str) -> Optional[FeatureDefinition]:
        """Get feature definition by name"""
        return self._features.get(name)
    
    def list_features(self, category: Optional[str] = None) -> List[str]:
        """List all registered feature names, optionally filtered by category"""
        if category:
            return [
                name for name, feat in self._features.items()
                if feat.category == category
            ]
        return list(self._features.keys())
    
    def get_dependencies(self, feature_name: str) -> List[str]:
        """Get dependencies for a feature"""
        feature = self.get_feature(feature_name)
        return feature.dependencies if feature else []
    
    def get_metadata(self, feature_name: str) -> Dict[str, Any]:
        """Get metadata for a feature"""
        feature = self.get_feature(feature_name)
        if not feature:
            return {}
        
        return {
            "name": feature.name,
            "data_type": feature.data_type,
            "description": feature.description,
            "version": feature.version,
            "category": feature.category,
            "dependencies": feature.dependencies
        }
    
    def compute_feature(self, feature_name: str, **kwargs) -> Any:
        """Compute a feature value"""
        feature = self.get_feature(feature_name)
        if not feature:
            raise ValueError(f"Feature '{feature_name}' not registered")
        
        # Check dependencies
        missing_deps = [dep for dep in feature.dependencies if dep not in kwargs]
        if missing_deps:
            raise ValueError(f"Missing dependencies for '{feature_name}': {missing_deps}")
        
        # Compute feature
        try:
            return feature.computation_fn(**kwargs)
        except Exception as e:
            logger.error(f"Error computing feature '{feature_name}': {e}")
            raise
