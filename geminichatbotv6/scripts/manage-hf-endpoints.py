#!/usr/bin/env python3
"""
HuggingFace Endpoint Management Script
Provides utilities for managing HuggingFace Inference Endpoints
"""

import os
import sys
import json
import requests
from datetime import datetime
from typing import Optional, Dict, Any

try:
    from huggingface_hub import HfApi, InferenceEndpoint
except ImportError:
    print("Please install huggingface_hub: pip install -U huggingface_hub")
    sys.exit(1)


class HFEndpointManager:
    def __init__(self, token: Optional[str] = None):
        self.token = token or os.environ.get('HF_TOKEN')
        if not self.token:
            raise ValueError("HF_TOKEN not found. Set it as environment variable or pass it explicitly.")
        self.api = HfApi(token=self.token)
    
    def list_endpoints(self) -> list:
        """List all inference endpoints"""
        endpoints = self.api.list_inference_endpoints()
        return endpoints
    
    def get_endpoint_info(self, name: str) -> Dict[str, Any]:
        """Get detailed info about an endpoint"""
        endpoint = self.api.get_inference_endpoint(name)
        return {
            'name': endpoint.name,
            'status': endpoint.status,
            'url': endpoint.url,
            'model': endpoint.repository,
            'instance_type': endpoint.type,
            'min_replicas': endpoint.min_replica,
            'max_replicas': endpoint.max_replica,
            'current_replicas': endpoint.current_replica,
        }
    
    def check_health(self, endpoint_url: str) -> bool:
        """Check if endpoint is healthy"""
        try:
            response = requests.get(
                f"{endpoint_url}/health",
                headers={'Authorization': f'Bearer {self.token}'},
                timeout=5
            )
            return response.status_code == 200
        except:
            return False
    
    def pause_endpoint(self, name: str):
        """Pause an endpoint to save costs"""
        endpoint = self.api.get_inference_endpoint(name)
        endpoint.pause()
        print(f"✅ Endpoint '{name}' paused")
    
    def resume_endpoint(self, name: str):
        """Resume a paused endpoint"""
        endpoint = self.api.get_inference_endpoint(name)
        endpoint.resume()
        print(f"✅ Endpoint '{name}' resumed")
    
    def scale_endpoint(self, name: str, min_replicas: int, max_replicas: int):
        """Scale endpoint replicas"""
        endpoint = self.api.get_inference_endpoint(name)
        endpoint.update(min_replica=min_replicas, max_replica=max_replicas)
        print(f"✅ Endpoint '{name}' scaled to {min_replicas}-{max_replicas} replicas")
    
    def test_video_generation(self, endpoint_url: str, prompt: str = "A serene sunset over mountains") -> Dict[str, Any]:
        """Test video generation on an endpoint"""
        payload = {
            "inputs": {
                "prompt": prompt,
                "num_frames": 40,  # 5 seconds at 8fps
                "guidance_scale": 7.5,
                "width": 1280,
                "height": 720
            }
        }
        
        response = requests.post(
            endpoint_url,
            headers={
                'Authorization': f'Bearer {self.token}',
                'Content-Type': 'application/json'
            },
            json=payload,
            timeout=300  # 5 minute timeout
        )
        
        if response.status_code == 200:
            return {'success': True, 'data': response.json()}
        else:
            return {'success': False, 'error': response.text, 'status': response.status_code}


def main():
    """CLI interface for endpoint management"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Manage HuggingFace Inference Endpoints')
    parser.add_argument('command', choices=['list', 'info', 'health', 'pause', 'resume', 'scale', 'test'])
    parser.add_argument('--name', help='Endpoint name')
    parser.add_argument('--url', help='Endpoint URL')
    parser.add_argument('--min-replicas', type=int, help='Minimum replicas')
    parser.add_argument('--max-replicas', type=int, help='Maximum replicas')
    parser.add_argument('--prompt', help='Test prompt for video generation')
    
    args = parser.parse_args()
    
    manager = HFEndpointManager()
    
    if args.command == 'list':
        endpoints = manager.list_endpoints()
        print("\n=== Your Inference Endpoints ===")
        for ep in endpoints:
            print(f"\n📦 {ep.name}")
            print(f"   Status: {ep.status}")
            print(f"   Model: {ep.repository}")
            print(f"   URL: {ep.url if ep.url else 'Not ready'}")
    
    elif args.command == 'info':
        if not args.name:
            print("❌ --name required")
            return
        info = manager.get_endpoint_info(args.name)
        print(f"\n=== Endpoint: {info['name']} ===")
        for k, v in info.items():
            print(f"{k}: {v}")
    
    elif args.command == 'health':
        if not args.url:
            print("❌ --url required")
            return
        is_healthy = manager.check_health(args.url)
        print(f"Endpoint health: {'✅ Healthy' if is_healthy else '❌ Unhealthy'}")
    
    elif args.command == 'pause':
        if not args.name:
            print("❌ --name required")
            return
        manager.pause_endpoint(args.name)
    
    elif args.command == 'resume':
        if not args.name:
            print("❌ --name required")
            return
        manager.resume_endpoint(args.name)
    
    elif args.command == 'scale':
        if not all([args.name, args.min_replicas is not None, args.max_replicas is not None]):
            print("❌ --name, --min-replicas, and --max-replicas required")
            return
        manager.scale_endpoint(args.name, args.min_replicas, args.max_replicas)
    
    elif args.command == 'test':
        if not args.url:
            print("❌ --url required")
            return
        prompt = args.prompt or "A serene sunset over mountains"
        print(f"Testing video generation with prompt: '{prompt}'")
        result = manager.test_video_generation(args.url, prompt)
        if result['success']:
            print("✅ Video generation successful!")
            print(json.dumps(result['data'], indent=2))
        else:
            print(f"❌ Video generation failed: {result['error']}")


if __name__ == '__main__':
    main()
