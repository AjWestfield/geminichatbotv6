#!/usr/bin/env python3
"""
HuggingFace Endpoint Cost Control Script
Automatically pauses/resumes endpoints based on schedule to control costs
"""

import os
import sys
import json
import logging
from datetime import datetime, time
from typing import List, Dict, Optional
import argparse

try:
    from huggingface_hub import HfApi
    from huggingface_hub.utils import RepositoryNotFoundError
except ImportError:
    print("Please install huggingface_hub: pip install -U huggingface_hub")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/hf-endpoint-scheduler.log'),
        logging.StreamHandler()
    ]
)

class EndpointScheduler:
    def __init__(self, token: str):
        self.api = HfApi(token=token)
        self.logger = logging.getLogger(__name__)
        
    def get_endpoint_status(self, name: str) -> Optional[str]:
        """Get current status of an endpoint"""
        try:
            endpoint = self.api.get_inference_endpoint(name)
            return endpoint.status
        except Exception as e:
            self.logger.error(f"Failed to get status for {name}: {e}")
            return None
    
    def pause_endpoint(self, name: str) -> bool:
        """Pause an endpoint"""
        try:
            current_status = self.get_endpoint_status(name)
            if current_status == 'paused':
                self.logger.info(f"Endpoint {name} is already paused")
                return True
                
            endpoint = self.api.get_inference_endpoint(name)
            endpoint.pause()
            self.logger.info(f"Successfully paused endpoint: {name}")
            return True
        except Exception as e:
            self.logger.error(f"Failed to pause {name}: {e}")
            return False
    
    def resume_endpoint(self, name: str) -> bool:
        """Resume an endpoint"""
        try:
            current_status = self.get_endpoint_status(name)
            if current_status == 'running':
                self.logger.info(f"Endpoint {name} is already running")
                return True
                
            endpoint = self.api.get_inference_endpoint(name)
            endpoint.resume()
            self.logger.info(f"Successfully resumed endpoint: {name}")
            return True
        except Exception as e:
            self.logger.error(f"Failed to resume {name}: {e}")
            return False
    
    def scale_endpoint(self, name: str, min_replicas: int, max_replicas: int) -> bool:
        """Scale endpoint replicas"""
        try:
            endpoint = self.api.get_inference_endpoint(name)
            endpoint.update(min_replica=min_replicas, max_replica=max_replicas)
            self.logger.info(f"Scaled {name} to {min_replicas}-{max_replicas} replicas")
            return True
        except Exception as e:
            self.logger.error(f"Failed to scale {name}: {e}")
            return False

class ScheduleConfig:
    """Configuration for endpoint schedules"""
    
    # Default schedule (can be overridden via config file)
    DEFAULT_SCHEDULE = {
        "hunyuan-fast": {
            "work_hours": {
                "start": "08:00",
                "end": "22:00",
                "timezone": "UTC",
                "days": ["monday", "tuesday", "wednesday", "thursday", "friday"]
            },
            "scale_down_after_hours": {
                "min_replicas": 0,
                "max_replicas": 1
            },
            "scale_up_work_hours": {
                "min_replicas": 1,
                "max_replicas": 2
            }
        },
        "hunyuan-quality": {
            "always_cold": True,  # Never keep warm
            "min_replicas": 0,
            "max_replicas": 1
        }
    }
    
    @classmethod
    def load_config(cls, config_path: Optional[str] = None) -> Dict:
        """Load configuration from file or use defaults"""
        if config_path and os.path.exists(config_path):
            with open(config_path, 'r') as f:
                return json.load(f)
        return cls.DEFAULT_SCHEDULE
    
    @classmethod
    def should_be_running(cls, endpoint_config: Dict) -> bool:
        """Check if endpoint should be running based on schedule"""
        if endpoint_config.get('always_cold'):
            return False
            
        if 'work_hours' not in endpoint_config:
            return True  # No schedule means always on
            
        work_hours = endpoint_config['work_hours']
        now = datetime.utcnow()
        
        # Check day of week
        current_day = now.strftime('%A').lower()
        if current_day not in work_hours.get('days', []):
            return False
            
        # Check time
        start_time = datetime.strptime(work_hours['start'], '%H:%M').time()
        end_time = datetime.strptime(work_hours['end'], '%H:%M').time()
        current_time = now.time()
        
        return start_time <= current_time <= end_time

def main():
    parser = argparse.ArgumentParser(description='HuggingFace Endpoint Scheduler')
    parser.add_argument('--action', choices=['check', 'apply'], default='apply',
                      help='Check schedule or apply changes')
    parser.add_argument('--config', help='Path to config JSON file')
    parser.add_argument('--dry-run', action='store_true',
                      help='Show what would be done without making changes')
    
    args = parser.parse_args()
    
    # Get token from environment
    token = os.environ.get('HF_TOKEN')
    if not token:
        logging.error("HF_TOKEN environment variable not set")
        sys.exit(1)
    
    scheduler = EndpointScheduler(token)
    config = ScheduleConfig.load_config(args.config)
    
    # Process each endpoint
    for endpoint_name, endpoint_config in config.items():
        logging.info(f"\nProcessing endpoint: {endpoint_name}")
        
        should_run = ScheduleConfig.should_be_running(endpoint_config)
        current_status = scheduler.get_endpoint_status(endpoint_name)
        
        if not current_status:
            logging.warning(f"Could not get status for {endpoint_name}, skipping")
            continue
            
        logging.info(f"Current status: {current_status}")
        logging.info(f"Should be running: {should_run}")
        
        if args.action == 'check':
            continue
            
        if args.dry_run:
            if should_run and current_status == 'paused':
                logging.info(f"[DRY RUN] Would resume {endpoint_name}")
            elif not should_run and current_status == 'running':
                logging.info(f"[DRY RUN] Would pause {endpoint_name}")
            continue
            
        # Apply changes
        if should_run and current_status == 'paused':
            scheduler.resume_endpoint(endpoint_name)
            
            # Apply work hours scaling if configured
            if 'scale_up_work_hours' in endpoint_config:
                scale = endpoint_config['scale_up_work_hours']
                scheduler.scale_endpoint(
                    endpoint_name,
                    scale['min_replicas'],
                    scale['max_replicas']
                )
                
        elif not should_run and current_status == 'running':
            # Scale down first if configured
            if 'scale_down_after_hours' in endpoint_config:
                scale = endpoint_config['scale_down_after_hours']
                scheduler.scale_endpoint(
                    endpoint_name,
                    scale['min_replicas'],
                    scale['max_replicas']
                )
            
            # Then pause if min_replicas is 0
            if endpoint_config.get('scale_down_after_hours', {}).get('min_replicas', 1) == 0:
                scheduler.pause_endpoint(endpoint_name)
    
    logging.info("\nScheduler run completed")

if __name__ == '__main__':
    main()
