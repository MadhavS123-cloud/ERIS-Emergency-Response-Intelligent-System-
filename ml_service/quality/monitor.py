"""
Data Quality Monitoring Module

Monitors data completeness, distribution shifts, consistency validation,
outlier detection, and data freshness.
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
import pandas as pd
import numpy as np
from scipy import stats
from sqlalchemy import create_engine, text
from ml_service.config import Config

logger = logging.getLogger(__name__)


class DataQualityMonitor:
    """
    Monitors data quality across multiple dimensions:
    - Data completeness (missing values, null fields)
    - Distribution shifts (feature drift, target drift)
    - Consistency validation (referential integrity, value ranges)
    - Outlier detection (anomalous values)
    - Data freshness (time since last update)
    """
    
    def __init__(self, database_url: Optional[str] = None):
        """
        Initialize DataQualityMonitor
        
        Args:
            database_url: PostgreSQL connection string (defaults to Config.DATABASE_URL)
        """
        self.database_url = database_url or Config.DATABASE_URL
        self.engine = create_engine(self.database_url)
        
        # Thresholds for quality checks
        self.thresholds = {
            'completeness_min': 0.95,  # 95% completeness required
            'drift_max_pvalue': 0.05,  # p-value threshold for distribution shift
            'outlier_zscore': 3.0,  # Z-score threshold for outliers
            'freshness_max_hours': 24,  # Maximum data age in hours
            'consistency_min': 0.99,  # 99% consistency required
        }
        
        # Baseline statistics for drift detection
        self.baseline_stats = {}
    
    def check_data_completeness(self, table_name: str, columns: List[str]) -> Dict[str, Any]:
        """
        Monitor data completeness (missing values, null fields)
        
        Args:
            table_name: Name of the table to check
            columns: List of column names to check
        
        Returns:
            Dictionary with completeness metrics and status
        """
        try:
            query = f"SELECT {', '.join(columns)} FROM {table_name}"
            df = pd.read_sql(query, self.engine)
            
            total_rows = len(df)
            if total_rows == 0:
                return {
                    'metric_name': f'{table_name}_completeness',
                    'status': 'warning',
                    'message': 'No data found in table',
                    'details': {'total_rows': 0}
                }
            
            completeness_by_column = {}
            overall_completeness = 0.0
            
            for col in columns:
                non_null_count = df[col].notna().sum()
                completeness = non_null_count / total_rows
                completeness_by_column[col] = {
                    'completeness': completeness,
                    'missing_count': total_rows - non_null_count,
                    'missing_percentage': (1 - completeness) * 100
                }
                overall_completeness += completeness
            
            overall_completeness /= len(columns)
            
            # Determine status
            if overall_completeness >= self.thresholds['completeness_min']:
                status = 'pass'
            elif overall_completeness >= 0.90:
                status = 'warning'
            else:
                status = 'fail'
            
            return {
                'metric_name': f'{table_name}_completeness',
                'metric_value': overall_completeness,
                'threshold_value': self.thresholds['completeness_min'],
                'status': status,
                'details': {
                    'total_rows': total_rows,
                    'overall_completeness': overall_completeness,
                    'by_column': completeness_by_column
                },
                'measured_at': datetime.now()
            }
            
        except Exception as e:
            logger.error(f"Error checking completeness for {table_name}: {e}")
            return {
                'metric_name': f'{table_name}_completeness',
                'status': 'error',
                'message': str(e),
                'measured_at': datetime.now()
            }
    
    def detect_distribution_shift(
        self,
        table_name: str,
        column: str,
        baseline_period_days: int = 30,
        recent_period_days: int = 7
    ) -> Dict[str, Any]:
        """
        Detect data distribution shifts using Kolmogorov-Smirnov test
        
        Args:
            table_name: Name of the table to check
            column: Column name to check for drift
            baseline_period_days: Days to use for baseline distribution
            recent_period_days: Days to use for recent distribution
        
        Returns:
            Dictionary with drift detection results
        """
        try:
            # Get baseline data
            baseline_end = datetime.now() - timedelta(days=recent_period_days)
            baseline_start = baseline_end - timedelta(days=baseline_period_days)
            
            baseline_query = text(f"""
                SELECT {column}
                FROM {table_name}
                WHERE created_at >= :start_date AND created_at < :end_date
                AND {column} IS NOT NULL
            """)
            
            baseline_df = pd.read_sql(
                baseline_query,
                self.engine,
                params={'start_date': baseline_start, 'end_date': baseline_end}
            )
            
            # Get recent data
            recent_start = datetime.now() - timedelta(days=recent_period_days)
            recent_query = text(f"""
                SELECT {column}
                FROM {table_name}
                WHERE created_at >= :start_date
                AND {column} IS NOT NULL
            """)
            
            recent_df = pd.read_sql(
                recent_query,
                self.engine,
                params={'start_date': recent_start}
            )
            
            if len(baseline_df) < 30 or len(recent_df) < 30:
                return {
                    'metric_name': f'{table_name}_{column}_drift',
                    'status': 'warning',
                    'message': 'Insufficient data for drift detection',
                    'details': {
                        'baseline_samples': len(baseline_df),
                        'recent_samples': len(recent_df)
                    },
                    'measured_at': datetime.now()
                }
            
            # Perform Kolmogorov-Smirnov test
            ks_statistic, p_value = stats.ks_2samp(
                baseline_df[column].values,
                recent_df[column].values
            )
            
            # Calculate distribution statistics
            baseline_stats = {
                'mean': float(baseline_df[column].mean()),
                'std': float(baseline_df[column].std()),
                'median': float(baseline_df[column].median())
            }
            
            recent_stats = {
                'mean': float(recent_df[column].mean()),
                'std': float(recent_df[column].std()),
                'median': float(recent_df[column].median())
            }
            
            # Determine status
            if p_value >= self.thresholds['drift_max_pvalue']:
                status = 'pass'
                message = 'No significant distribution shift detected'
            elif p_value >= 0.01:
                status = 'warning'
                message = 'Moderate distribution shift detected'
            else:
                status = 'fail'
                message = 'Significant distribution shift detected'
            
            return {
                'metric_name': f'{table_name}_{column}_drift',
                'metric_value': float(ks_statistic),
                'threshold_value': self.thresholds['drift_max_pvalue'],
                'status': status,
                'details': {
                    'ks_statistic': float(ks_statistic),
                    'p_value': float(p_value),
                    'baseline_stats': baseline_stats,
                    'recent_stats': recent_stats,
                    'baseline_samples': len(baseline_df),
                    'recent_samples': len(recent_df),
                    'message': message
                },
                'measured_at': datetime.now()
            }
            
        except Exception as e:
            logger.error(f"Error detecting drift for {table_name}.{column}: {e}")
            return {
                'metric_name': f'{table_name}_{column}_drift',
                'status': 'error',
                'message': str(e),
                'measured_at': datetime.now()
            }
    
    def validate_data_consistency(
        self,
        table_name: str,
        validations: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Validate data consistency (referential integrity, value ranges)
        
        Args:
            table_name: Name of the table to check
            validations: List of validation rules, each with:
                - type: 'range', 'enum', 'foreign_key', 'format'
                - column: Column name to validate
                - rule: Validation rule (e.g., {'min': 0, 'max': 100})
        
        Returns:
            Dictionary with consistency validation results
        """
        try:
            validation_results = []
            total_violations = 0
            total_checks = 0
            
            for validation in validations:
                val_type = validation['type']
                column = validation['column']
                rule = validation.get('rule', {})
                
                if val_type == 'range':
                    # Check value range
                    query = text(f"""
                        SELECT COUNT(*) as total,
                               SUM(CASE WHEN {column} < :min_val OR {column} > :max_val THEN 1 ELSE 0 END) as violations
                        FROM {table_name}
                        WHERE {column} IS NOT NULL
                    """)
                    result = pd.read_sql(
                        query,
                        self.engine,
                        params={'min_val': rule['min'], 'max_val': rule['max']}
                    )
                    
                elif val_type == 'enum':
                    # Check enum values
                    allowed_values = rule['values']
                    placeholders = ', '.join([f':val{i}' for i in range(len(allowed_values))])
                    query = text(f"""
                        SELECT COUNT(*) as total,
                               SUM(CASE WHEN {column} NOT IN ({placeholders}) THEN 1 ELSE 0 END) as violations
                        FROM {table_name}
                        WHERE {column} IS NOT NULL
                    """)
                    params = {f'val{i}': val for i, val in enumerate(allowed_values)}
                    result = pd.read_sql(query, self.engine, params=params)
                    
                elif val_type == 'non_negative':
                    # Check non-negative values
                    query = text(f"""
                        SELECT COUNT(*) as total,
                               SUM(CASE WHEN {column} < 0 THEN 1 ELSE 0 END) as violations
                        FROM {table_name}
                        WHERE {column} IS NOT NULL
                    """)
                    result = pd.read_sql(query, self.engine)
                
                else:
                    continue
                
                total = int(result['total'].iloc[0])
                violations = int(result['violations'].iloc[0])
                consistency = 1.0 - (violations / total if total > 0 else 0)
                
                validation_results.append({
                    'column': column,
                    'type': val_type,
                    'total_records': total,
                    'violations': violations,
                    'consistency': consistency
                })
                
                total_violations += violations
                total_checks += total
            
            overall_consistency = 1.0 - (total_violations / total_checks if total_checks > 0 else 0)
            
            # Determine status
            if overall_consistency >= self.thresholds['consistency_min']:
                status = 'pass'
            elif overall_consistency >= 0.95:
                status = 'warning'
            else:
                status = 'fail'
            
            return {
                'metric_name': f'{table_name}_consistency',
                'metric_value': overall_consistency,
                'threshold_value': self.thresholds['consistency_min'],
                'status': status,
                'details': {
                    'overall_consistency': overall_consistency,
                    'total_checks': total_checks,
                    'total_violations': total_violations,
                    'by_validation': validation_results
                },
                'measured_at': datetime.now()
            }
            
        except Exception as e:
            logger.error(f"Error validating consistency for {table_name}: {e}")
            return {
                'metric_name': f'{table_name}_consistency',
                'status': 'error',
                'message': str(e),
                'measured_at': datetime.now()
            }
    
    def detect_outliers(
        self,
        table_name: str,
        column: str,
        method: str = 'zscore'
    ) -> Dict[str, Any]:
        """
        Detect outliers and anomalous values
        
        Args:
            table_name: Name of the table to check
            column: Column name to check for outliers
            method: Detection method ('zscore' or 'iqr')
        
        Returns:
            Dictionary with outlier detection results
        """
        try:
            query = f"SELECT {column} FROM {table_name} WHERE {column} IS NOT NULL"
            df = pd.read_sql(query, self.engine)
            
            if len(df) < 10:
                return {
                    'metric_name': f'{table_name}_{column}_outliers',
                    'status': 'warning',
                    'message': 'Insufficient data for outlier detection',
                    'measured_at': datetime.now()
                }
            
            values = df[column].values
            
            if method == 'zscore':
                # Z-score method
                mean = np.mean(values)
                std = np.std(values)
                z_scores = np.abs((values - mean) / std) if std > 0 else np.zeros_like(values)
                outliers = z_scores > self.thresholds['outlier_zscore']
                outlier_count = np.sum(outliers)
                
            elif method == 'iqr':
                # IQR method
                q1 = np.percentile(values, 25)
                q3 = np.percentile(values, 75)
                iqr = q3 - q1
                lower_bound = q1 - 1.5 * iqr
                upper_bound = q3 + 1.5 * iqr
                outliers = (values < lower_bound) | (values > upper_bound)
                outlier_count = np.sum(outliers)
            
            else:
                raise ValueError(f"Unknown outlier detection method: {method}")
            
            outlier_percentage = (outlier_count / len(values)) * 100
            
            # Determine status
            if outlier_percentage <= 1.0:
                status = 'pass'
            elif outlier_percentage <= 5.0:
                status = 'warning'
            else:
                status = 'fail'
            
            return {
                'metric_name': f'{table_name}_{column}_outliers',
                'metric_value': float(outlier_percentage),
                'threshold_value': 5.0,  # 5% outlier threshold
                'status': status,
                'details': {
                    'method': method,
                    'total_records': len(values),
                    'outlier_count': int(outlier_count),
                    'outlier_percentage': float(outlier_percentage),
                    'statistics': {
                        'mean': float(np.mean(values)),
                        'std': float(np.std(values)),
                        'min': float(np.min(values)),
                        'max': float(np.max(values)),
                        'q1': float(np.percentile(values, 25)),
                        'median': float(np.percentile(values, 50)),
                        'q3': float(np.percentile(values, 75))
                    }
                },
                'measured_at': datetime.now()
            }
            
        except Exception as e:
            logger.error(f"Error detecting outliers for {table_name}.{column}: {e}")
            return {
                'metric_name': f'{table_name}_{column}_outliers',
                'status': 'error',
                'message': str(e),
                'measured_at': datetime.now()
            }
    
    def check_data_freshness(
        self,
        table_name: str,
        timestamp_column: str = 'created_at'
    ) -> Dict[str, Any]:
        """
        Monitor data freshness (time since last update)
        
        Args:
            table_name: Name of the table to check
            timestamp_column: Column name containing timestamps
        
        Returns:
            Dictionary with freshness metrics
        """
        try:
            query = text(f"""
                SELECT MAX({timestamp_column}) as latest_timestamp,
                       COUNT(*) as total_records
                FROM {table_name}
            """)
            result = pd.read_sql(query, self.engine)
            
            latest_timestamp = result['latest_timestamp'].iloc[0]
            total_records = int(result['total_records'].iloc[0])
            
            if pd.isna(latest_timestamp):
                return {
                    'metric_name': f'{table_name}_freshness',
                    'status': 'fail',
                    'message': 'No data found in table',
                    'measured_at': datetime.now()
                }
            
            # Convert to datetime if needed
            if isinstance(latest_timestamp, str):
                latest_timestamp = pd.to_datetime(latest_timestamp)
            
            # Calculate age in hours
            now = datetime.now()
            if latest_timestamp.tzinfo is not None:
                # Make now timezone-aware if latest_timestamp is
                from datetime import timezone
                now = now.replace(tzinfo=timezone.utc)
            
            age_hours = (now - latest_timestamp).total_seconds() / 3600
            
            # Determine status
            if age_hours <= self.thresholds['freshness_max_hours']:
                status = 'pass'
            elif age_hours <= 48:
                status = 'warning'
            else:
                status = 'fail'
            
            return {
                'metric_name': f'{table_name}_freshness',
                'metric_value': float(age_hours),
                'threshold_value': float(self.thresholds['freshness_max_hours']),
                'status': status,
                'details': {
                    'latest_timestamp': latest_timestamp.isoformat(),
                    'age_hours': float(age_hours),
                    'age_days': float(age_hours / 24),
                    'total_records': total_records
                },
                'measured_at': datetime.now()
            }
            
        except Exception as e:
            logger.error(f"Error checking freshness for {table_name}: {e}")
            return {
                'metric_name': f'{table_name}_freshness',
                'status': 'error',
                'message': str(e),
                'measured_at': datetime.now()
            }
    
    def generate_quality_alert(
        self,
        metric_result: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Generate quality alert with severity levels and recommended actions
        
        Args:
            metric_result: Result from a quality check
        
        Returns:
            Alert dictionary or None if no alert needed
        """
        status = metric_result.get('status')
        
        if status in ['pass', 'error']:
            return None
        
        # Map status to severity
        severity_map = {
            'warning': 'medium',
            'fail': 'high'
        }
        severity = severity_map.get(status, 'low')
        
        # Generate recommended actions based on metric type
        metric_name = metric_result.get('metric_name', '')
        recommended_actions = []
        
        if 'completeness' in metric_name:
            recommended_actions = [
                'Investigate data ingestion pipeline for missing data',
                'Check upstream data sources for completeness',
                'Review ETL processes for data loss'
            ]
        elif 'drift' in metric_name:
            recommended_actions = [
                'Investigate changes in data collection process',
                'Review recent system changes or updates',
                'Consider retraining ML models with recent data',
                'Validate data source consistency'
            ]
        elif 'consistency' in metric_name:
            recommended_actions = [
                'Review data validation rules',
                'Check for data entry errors',
                'Validate referential integrity constraints',
                'Investigate data transformation logic'
            ]
        elif 'outliers' in metric_name:
            recommended_actions = [
                'Investigate outlier records for data quality issues',
                'Review data collection process for anomalies',
                'Consider updating outlier detection thresholds',
                'Validate data entry processes'
            ]
        elif 'freshness' in metric_name:
            recommended_actions = [
                'Check data ingestion pipeline status',
                'Verify upstream data source availability',
                'Review scheduled data update jobs',
                'Investigate potential system failures'
            ]
        
        alert = {
            'metric_name': metric_name,
            'severity': severity,
            'status': status,
            'metric_value': metric_result.get('metric_value'),
            'threshold_value': metric_result.get('threshold_value'),
            'message': metric_result.get('details', {}).get('message', f'Quality check {status}'),
            'details': metric_result.get('details', {}),
            'recommended_actions': recommended_actions,
            'detected_at': metric_result.get('measured_at', datetime.now())
        }
        
        return alert
    
    def store_quality_metrics(
        self,
        metrics: List[Dict[str, Any]]
    ) -> int:
        """
        Store quality metrics in data_quality_metrics database table
        
        Args:
            metrics: List of metric results to store
        
        Returns:
            Number of metrics stored
        """
        try:
            stored_count = 0
            
            with self.engine.connect() as conn:
                for metric in metrics:
                    # Skip error status metrics
                    if metric.get('status') == 'error':
                        continue
                    
                    insert_query = text("""
                        INSERT INTO data_quality_metrics
                        (metric_name, metric_value, threshold_value, status, details, measured_at)
                        VALUES
                        (:metric_name, :metric_value, :threshold_value, :status, :details, :measured_at)
                    """)
                    
                    conn.execute(insert_query, {
                        'metric_name': metric.get('metric_name'),
                        'metric_value': metric.get('metric_value'),
                        'threshold_value': metric.get('threshold_value'),
                        'status': metric.get('status'),
                        'details': str(metric.get('details', {})),  # Convert to JSON string
                        'measured_at': metric.get('measured_at', datetime.now())
                    })
                    
                    stored_count += 1
                
                conn.commit()
            
            logger.info(f"Stored {stored_count} quality metrics")
            return stored_count
            
        except Exception as e:
            logger.error(f"Error storing quality metrics: {e}")
            return 0
    
    def run_quality_checks(
        self,
        checks_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Run comprehensive quality checks based on configuration
        
        Args:
            checks_config: Configuration for quality checks
        
        Returns:
            Dictionary with all check results and alerts
        """
        results = {
            'metrics': [],
            'alerts': [],
            'summary': {
                'total_checks': 0,
                'passed': 0,
                'warnings': 0,
                'failed': 0,
                'errors': 0
            }
        }
        
        # Run completeness checks
        for check in checks_config.get('completeness', []):
            metric = self.check_data_completeness(
                check['table'],
                check['columns']
            )
            results['metrics'].append(metric)
            
            alert = self.generate_quality_alert(metric)
            if alert:
                results['alerts'].append(alert)
        
        # Run drift detection checks
        for check in checks_config.get('drift', []):
            metric = self.detect_distribution_shift(
                check['table'],
                check['column'],
                check.get('baseline_days', 30),
                check.get('recent_days', 7)
            )
            results['metrics'].append(metric)
            
            alert = self.generate_quality_alert(metric)
            if alert:
                results['alerts'].append(alert)
        
        # Run consistency checks
        for check in checks_config.get('consistency', []):
            metric = self.validate_data_consistency(
                check['table'],
                check['validations']
            )
            results['metrics'].append(metric)
            
            alert = self.generate_quality_alert(metric)
            if alert:
                results['alerts'].append(alert)
        
        # Run outlier detection checks
        for check in checks_config.get('outliers', []):
            metric = self.detect_outliers(
                check['table'],
                check['column'],
                check.get('method', 'zscore')
            )
            results['metrics'].append(metric)
            
            alert = self.generate_quality_alert(metric)
            if alert:
                results['alerts'].append(alert)
        
        # Run freshness checks
        for check in checks_config.get('freshness', []):
            metric = self.check_data_freshness(
                check['table'],
                check.get('timestamp_column', 'created_at')
            )
            results['metrics'].append(metric)
            
            alert = self.generate_quality_alert(metric)
            if alert:
                results['alerts'].append(alert)
        
        # Calculate summary
        for metric in results['metrics']:
            status = metric.get('status')
            results['summary']['total_checks'] += 1
            
            if status == 'pass':
                results['summary']['passed'] += 1
            elif status == 'warning':
                results['summary']['warnings'] += 1
            elif status == 'fail':
                results['summary']['failed'] += 1
            elif status == 'error':
                results['summary']['errors'] += 1
        
        # Store metrics in database
        stored_count = self.store_quality_metrics(results['metrics'])
        results['summary']['stored_metrics'] = stored_count
        
        return results
