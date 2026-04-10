"""
Dataset Exporter
Exports generated datasets in multiple formats with metadata
"""
import pandas as pd
import json
from pathlib import Path
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)


class DatasetExporter:
    """Exports datasets in multiple formats (CSV, JSON, Parquet)"""
    
    SUPPORTED_FORMATS = ["csv", "json", "parquet"]
    
    @staticmethod
    def export_dataset(
        df: pd.DataFrame,
        file_path: str,
        format: str,
        metadata: Dict[str, Any] = None
    ) -> str:
        """
        Export dataset to specified format.
        
        Args:
            df: DataFrame to export
            file_path: Output file path (without extension)
            format: Export format ("csv", "json", or "parquet")
            metadata: Optional metadata dict to include
        
        Returns:
            Path to exported file
        """
        if format not in DatasetExporter.SUPPORTED_FORMATS:
            raise ValueError(f"Unsupported format: {format}. Must be one of {DatasetExporter.SUPPORTED_FORMATS}")
        
        # Ensure directory exists
        output_path = Path(file_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Add extension if not present
        if not output_path.suffix:
            output_path = output_path.with_suffix(f".{format}")
        
        logger.info(f"Exporting dataset to {output_path}")
        
        # Export based on format
        if format == "csv":
            df.to_csv(output_path, index=False)
        elif format == "json":
            df.to_json(output_path, orient="records", date_format="iso")
        elif format == "parquet":
            df.to_parquet(output_path, index=False, engine="pyarrow")
        
        # Export metadata if provided
        if metadata:
            metadata_path = output_path.with_suffix(".metadata.json")
            with open(metadata_path, "w") as f:
                json.dump(metadata, f, indent=2, default=str)
            logger.info(f"Exported metadata to {metadata_path}")
        
        logger.info(f"Successfully exported {len(df)} records to {output_path}")
        return str(output_path)
    
    @staticmethod
    def import_dataset(file_path: str, format: str = None) -> pd.DataFrame:
        """
        Import dataset from file.
        
        Args:
            file_path: Path to file
            format: Format (auto-detected from extension if not provided)
        
        Returns:
            DataFrame
        """
        path = Path(file_path)
        
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        
        # Auto-detect format from extension
        if format is None:
            format = path.suffix.lstrip(".")
        
        logger.info(f"Importing dataset from {path}")
        
        if format == "csv":
            df = pd.read_csv(path)
        elif format == "json":
            df = pd.read_json(path, orient="records")
        elif format == "parquet":
            df = pd.read_parquet(path, engine="pyarrow")
        else:
            raise ValueError(f"Unsupported format: {format}")
        
        logger.info(f"Successfully imported {len(df)} records")
        return df
    
    @staticmethod
    def generate_metadata(
        df: pd.DataFrame,
        generation_params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate metadata for dataset"""
        return {
            "num_records": len(df),
            "columns": list(df.columns),
            "generation_params": generation_params,
            "statistics": {
                col: {
                    "dtype": str(df[col].dtype),
                    "null_count": int(df[col].isnull().sum()),
                    "unique_count": int(df[col].nunique())
                }
                for col in df.columns
            }
        }
