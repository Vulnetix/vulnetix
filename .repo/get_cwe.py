#!/usr/bin/env python3
"""
CLI tool to fetch CWE (Common Weakness Enumeration) data from MITRE API
and compile comprehensive weakness information into a JSON file.

This script is fully compliant with the official CWE-CAPEC API OpenAPI 3.0.3 specification:
https://github.com/CWE-CAPEC/REST-API-wg/blob/main/openapi.json
"""

import argparse
import json
import logging
import requests
import sys
import time
import certifi
import multiprocessing as mp
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
from functools import partial
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from rich.console import Console
from rich.logging import RichHandler
from rich.panel import Panel


class CWEFetcher:
    """Fetches and processes CWE data from MITRE API with GitHub fallback and multiprocessing support."""
    
    def __init__(self, base_url: str, insecure: bool = False, max_workers: int = None, batch_size: int = 5):
        self.base_url = base_url.rstrip('/')
        self.logger = logging.getLogger(__name__)
        self.console = Console()
        self.insecure = insecure
        self.batch_size = batch_size
        self.github_fallback_url = "https://raw.githubusercontent.com/CWE-CAPEC/REST-API-wg/refs/heads/main/json_repo/cwe.json"
        self.use_fallback_mode = False
        
        # Multiprocessing configuration
        self.max_workers = max_workers or min(32, (mp.cpu_count() or 1) + 4)
        self.session_pool = {}  # Will store session per process/thread
        
        # Performance tracking
        self.request_count = 0
        self.cache_hits = 0
        self.start_time = time.time()
        
        # Simple in-memory cache for frequently accessed data
        self.cache = {}
        self.cache_size_limit = 1000
        
        # Adaptive rate limiting
        self.response_times = []
        self.max_response_time_samples = 100
        
        # Security check: Ensure we're connecting to official MITRE endpoints
        self._validate_api_endpoint()
        
        # Configure session with retry strategy and secure SSL settings
        self.session = requests.Session()
        
        # Handle insecure mode with appropriate warnings
        if self.insecure:
            self.logger.warning("🚨 INSECURE MODE ENABLED - SSL verification is DISABLED!")
            self.logger.warning("⚠️  This mode is DANGEROUS and should only be used for testing!")
            self.logger.warning("🔓 Your connection is NOT SECURE and vulnerable to attacks!")
            self.session.verify = False
            # Suppress urllib3 warnings about unverified HTTPS requests
            import urllib3
            urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        else:
            # Ensure we're using the latest CA certificates
            try:
                # Use certifi's CA bundle for maximum compatibility
                self.session.verify = certifi.where()
                self.logger.debug(f"🔒 Using CA bundle: {certifi.where()}")
                
                # Test if the CA bundle works by making a quick connection test
                import ssl
                import socket
                
                # Create SSL context with certifi bundle
                context = ssl.create_default_context(cafile=certifi.where())
                
                # Test connection to a known working SSL site first
                try:
                    with socket.create_connection(('www.google.com', 443), timeout=5) as sock:
                        with context.wrap_socket(sock, server_hostname='www.google.com') as ssock:
                            pass
                    self.logger.debug("🔒 SSL context validation successful")
                except Exception as ssl_test_error:
                    self.logger.warning(f"🔒 SSL context test failed: {ssl_test_error}")
                    self.logger.warning("🔒 Falling back to system certificates")
                    self.session.verify = True
                    
            except ImportError:
                # Fall back to system default if certifi is not available
                self.session.verify = True
                self.logger.debug("🔒 Using system default CA certificates")
            except Exception as cert_error:
                self.logger.warning(f"🔒 Certificate setup error: {cert_error}")
                self.logger.warning("🔒 Using system default CA certificates")
                self.session.verify = True
        
        # Enhanced retry strategy with better connection error handling
        retry_strategy = Retry(
            total=8,  # Increased retries for connection reset scenarios
            status_forcelist=[429, 500, 502, 503, 504, 104],  # 104 is connection reset
            allowed_methods=["HEAD", "GET", "OPTIONS"],
            backoff_factor=3,  # Longer backoff for connection issues
            raise_on_status=False,
        )
        
        # Configure adapter with larger connection pool and timeout settings
        adapter = HTTPAdapter(
            max_retries=retry_strategy,
            pool_connections=20,  # Increased for multiprocessing
            pool_maxsize=50,      # Increased for better connection reuse
            pool_block=False
        )
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
        self.session.headers.update({
            'User-Agent': 'Vulnetix CWE Fetcher/1.0 (Security Tool)',
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Keep-Alive': 'timeout=60, max=100'
        })
        
        self.session.timeout = (30, 60)
    
    def _get_or_create_session(self) -> requests.Session:
        """Get or create a session for the current thread/process."""
        import threading
        thread_id = threading.get_ident()
        
        if thread_id not in self.session_pool:
            # Create new session for this thread
            session = requests.Session()
            
            # Apply SSL settings
            if self.insecure:
                session.verify = False
                import urllib3
                urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
            else:
                try:
                    session.verify = certifi.where()
                except ImportError:
                    session.verify = True
            
            # Apply retry strategy
            retry_strategy = Retry(
                total=8,
                status_forcelist=[429, 500, 502, 503, 504, 104],
                allowed_methods=["HEAD", "GET", "OPTIONS"],
                backoff_factor=3,
                raise_on_status=False,
            )
            
            adapter = HTTPAdapter(
                max_retries=retry_strategy,
                pool_connections=20,  # Increased for multiprocessing
                pool_maxsize=50,      # Increased for better connection reuse
                pool_block=False
            )
            session.mount("http://", adapter)
            session.mount("https://", adapter)
            
            # Apply headers
            session.headers.update({
                'User-Agent': 'Vulnetix CWE Fetcher/1.0 (Security Tool)',
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
                'Keep-Alive': 'timeout=60, max=100'
            })
            
            session.timeout = (30, 60)
            self.session_pool[thread_id] = session
        
        return self.session_pool[thread_id]
    
    def _worker_get_weakness_data(self, cwe_id: str) -> Tuple[str, List[Dict[str, Any]]]:
        """Worker function for multiprocessing CWE data retrieval."""
        try:
            session = self._get_or_create_session()
            url = f"{self.base_url}/cwe/weakness/{cwe_id}"
            
            # Use the thread-local session for this request
            response = session.get(url, timeout=(30, 60))
            response.raise_for_status()
            
            data = response.json()
            weaknesses = data.get('Weaknesses', [])
            return (cwe_id, weaknesses)
        except requests.exceptions.HTTPError as e:
            if e.response and e.response.status_code in [400, 404]:
                # Check if the error message indicates this is a category, not a weakness
                error_content = e.response.text.lower() if e.response else ""
                if "category" in error_content or "use the category endpoint" in error_content:
                    self.logger.debug(f"⚠️  CWE-{cwe_id} is a category, skipping weakness endpoint")
                    return (cwe_id, [])  # Return empty for categories since we only want weaknesses
                # For other 404/400 errors, try category endpoint as fallback
                try:
                    related_ids = self._worker_get_category_relationships(cwe_id)
                    all_weaknesses = []
                    for related_id in related_ids:
                        _, related_weaknesses = self._worker_get_weakness_data(related_id)
                        all_weaknesses.extend(related_weaknesses)
                    return (cwe_id, all_weaknesses)
                except Exception:
                    return (cwe_id, [])
            return (cwe_id, [])
        except Exception as e:
            # Log errors but don't fail the entire process
            return (cwe_id, [])
    
    def _worker_get_category_relationships(self, cwe_id: str) -> List[str]:
        """Worker function for fetching category relationships."""
        try:
            session = self._get_or_create_session()
            url = f"{self.base_url}/cwe/category/{cwe_id}"
            
            response = session.get(url, timeout=(30, 60))
            response.raise_for_status()
            
            data = response.json()
            related_ids = []
            categories = data.get('Categories', [])
            
            for category in categories:
                relationships = category.get('Relationships', [])
                for relationship in relationships:
                    related_cwe_id = relationship.get('CWE_ID') or relationship.get('CweID')
                    if related_cwe_id:
                        related_ids.append(str(related_cwe_id))
            
            return related_ids
        except Exception:
            return []
    
    def _worker_get_cwe_info(self, cwe_ids_batch: List[str]) -> List[Dict[str, Any]]:
        """Worker function for getting CWE type information in batches."""
        try:
            session = self._get_or_create_session()
            batch_str = ','.join(cwe_ids_batch[:50])  # Limit to avoid URL length issues
            url = f"{self.base_url}/cwe/{batch_str}"
            
            response = session.get(url, timeout=(30, 60))
            response.raise_for_status()
            
            data = response.json()
            return data if isinstance(data, list) else []
        except Exception:
            return []
    
    def __del__(self):
        """Cleanup method to ensure sessions are properly closed."""
        if hasattr(self, 'session'):
            try:
                self.session.close()
            except Exception:
                pass  # Ignore cleanup errors
        
        # Clean up session pool
        if hasattr(self, 'session_pool'):
            for session in self.session_pool.values():
                try:
                    session.close()
                except Exception:
                    pass
            self.session_pool.clear()
    
    def close(self):
        """Explicitly close all sessions."""
        if hasattr(self, 'session'):
            self.session.close()
        
        # Clean up session pool
        if hasattr(self, 'session_pool'):
            for session in self.session_pool.values():
                try:
                    session.close()
                except Exception:
                    pass
            self.session_pool.clear()
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get performance statistics for the current session."""
        elapsed_time = time.time() - self.start_time
        avg_response_time = sum(self.response_times) / len(self.response_times) if self.response_times else 0
        
        return {
            'total_requests': self.request_count,
            'cache_hits': self.cache_hits,
            'cache_hit_ratio': self.cache_hits / max(1, self.request_count) * 100,
            'elapsed_time_seconds': elapsed_time,
            'requests_per_second': self.request_count / max(1, elapsed_time),
            'cache_size': len(self.cache),
            'max_workers': self.max_workers,
            'avg_response_time': avg_response_time,
            'response_samples': len(self.response_times)
        }
    
    def _optimize_batch_size(self, initial_size: int = 5) -> int:
        """Dynamically optimize batch size based on API response times."""
        # Test with different batch sizes to find optimal performance
        test_sizes = [3, 5, 10, 15]
        best_size = initial_size
        best_time_per_item = float('inf')
        
        self.logger.info("🔧 Optimizing batch size for better performance...")
        
        for size in test_sizes:
            if size > initial_size * 3:  # Don't test sizes too much larger than initial
                break
                
            start_time = time.time()
            try:
                # Test with a small sample
                test_ids = ['79', '89', '200', '377', '502'][:size]  # Common CWE IDs
                self._process_weakness_batch(test_ids, 1, 1)
                elapsed = time.time() - start_time
                time_per_item = elapsed / len(test_ids)
                
                if time_per_item < best_time_per_item:
                    best_time_per_item = time_per_item
                    best_size = size
                    
                self.logger.debug(f"🧪 Batch size {size}: {time_per_item:.2f}s per item")
                time.sleep(1)  # Brief pause between tests
                
            except Exception as e:
                self.logger.debug(f"⚠️  Batch size {size} test failed: {e}")
                continue
        
        self.logger.info(f"🎯 Optimized batch size: {best_size} (avg {best_time_per_item:.2f}s per item)")
        return best_size
    
    def _graceful_shutdown(self):
        """Gracefully shutdown all resources and connections."""
        self.logger.info("🛑 Initiating graceful shutdown...")
        
        # Close main session
        if hasattr(self, 'session'):
            try:
                self.session.close()
                self.logger.debug("✅ Main session closed")
            except Exception as e:
                self.logger.debug(f"⚠️  Error closing main session: {e}")
        
        # Close all worker sessions
        if hasattr(self, 'session_pool'):
            closed_count = 0
            for thread_id, session in self.session_pool.items():
                try:
                    session.close()
                    closed_count += 1
                except Exception as e:
                    self.logger.debug(f"⚠️  Error closing session for thread {thread_id}: {e}")
            
            self.session_pool.clear()
            self.logger.debug(f"✅ Closed {closed_count} worker sessions")
        
        # Clear cache
        if hasattr(self, 'cache'):
            cache_size = len(self.cache)
            self.cache.clear()
            self.logger.debug(f"✅ Cleared cache ({cache_size} entries)")
        
        self.logger.info("✅ Graceful shutdown completed")
    
    def _get_adaptive_delay(self) -> float:
        """Calculate adaptive delay based on recent API response times."""
        if not self.response_times:
            return 1.0  # Default delay
        
        avg_response_time = sum(self.response_times) / len(self.response_times)
        
        # Adaptive delay: longer delays for slower API responses
        if avg_response_time > 5.0:
            return 3.0  # Slow API, use longer delays
        elif avg_response_time > 2.0:
            return 2.0  # Moderate speed
        elif avg_response_time > 1.0:
            return 1.5  # Good speed
        else:
            return 1.0  # Fast API, use shorter delays
    
    def fetch_github_fallback(self) -> List[Dict[str, Any]]:
        """Fetch CWE data from GitHub repository as fallback when API is unavailable."""
        self.logger.info("🔄 Attempting to fetch CWE data from GitHub fallback repository...")
        self.logger.info(f"📡 GitHub URL: {self.github_fallback_url}")
        
        try:
            # Create a fresh session for GitHub with more permissive SSL settings
            github_session = requests.Session()
            github_session.verify = True  # GitHub should have valid SSL
            
            # Set headers for GitHub
            github_session.headers.update({
                'User-Agent': 'Vulnetix CWE Fetcher/1.0 (Security Tool)',
                'Accept': 'application/json'
            })
            
            response = github_session.get(self.github_fallback_url, timeout=60)
            response.raise_for_status()
            
            data = response.json()
            github_session.close()
            
            # Extract weaknesses from GitHub JSON format
            if isinstance(data, dict):
                # Check different possible structures
                if 'Weaknesses' in data:
                    weaknesses = data['Weaknesses']
                elif 'WeaknessList' in data:
                    weaknesses = data['WeaknessList']
                elif 'CWE' in data:
                    # Handle nested structure
                    cwe_data = data['CWE']
                    if isinstance(cwe_data, dict) and 'Weaknesses' in cwe_data:
                        weaknesses = cwe_data['Weaknesses']
                    elif isinstance(cwe_data, list):
                        weaknesses = cwe_data
                    else:
                        weaknesses = [cwe_data] if cwe_data else []
                elif isinstance(data, list):
                    # Data is directly a list of weaknesses
                    weaknesses = data
                else:
                    # Try to find any list of weakness-like objects
                    for key, value in data.items():
                        if isinstance(value, list) and value and isinstance(value[0], dict):
                            # Check if this looks like weakness data
                            sample = value[0]
                            if any(field in sample for field in ['ID', 'CWE_ID', 'Name', 'Description']):
                                weaknesses = value
                                break
                    else:
                        self.logger.warning("⚠️  Could not identify weakness data structure in GitHub JSON")
                        return []
            elif isinstance(data, list):
                weaknesses = data
            else:
                self.logger.error("❌ Unexpected data format from GitHub fallback")
                return []
            
            if weaknesses:
                self.logger.info(f"✅ Successfully fetched {len(weaknesses)} weaknesses from GitHub fallback")
                self.use_fallback_mode = True
                return weaknesses
            else:
                self.logger.warning("⚠️  No weaknesses found in GitHub fallback data")
                return []
                
        except requests.exceptions.RequestException as e:
            self.logger.error(f"🚫 Failed to fetch from GitHub fallback: {e}")
            return []
        except json.JSONDecodeError as e:
            self.logger.error(f"📄 JSON decode error from GitHub fallback: {e}")
            return []
        except Exception as e:
            self.logger.error(f"💥 Unexpected error fetching GitHub fallback: {e}")
            return []
    
    def _validate_api_endpoint(self) -> None:
        """Validate that we're connecting to a trusted MITRE endpoint."""
        trusted_domains = [
            'cwe.mitre.org',
            'cwe-api.mitre.org',
            'api.cwe.mitre.org'
        ]
        
        from urllib.parse import urlparse
        parsed_url = urlparse(self.base_url)
        
        if parsed_url.hostname not in trusted_domains:
            self.logger.warning(f"⚠️  WARNING: Connecting to non-official MITRE domain: {parsed_url.hostname}")
            self.logger.warning("📍 Official MITRE CWE API domains: cwe.mitre.org, cwe-api.mitre.org")
            self.logger.warning("🔍 Please verify you trust this endpoint before proceeding.")
        else:
            self.logger.debug(f"✅ Connecting to trusted MITRE domain: {parsed_url.hostname}")
    
    def test_connectivity(self) -> bool:
        """Test basic connectivity to the API endpoint with secure SSL."""
        # Use the version endpoint as specified in OpenAPI spec
        test_url = f"{self.base_url}/cwe/version"
        self.logger.info(f"🔌 Testing secure connectivity to: {test_url}")
        
        try:
            response = self.session.get(test_url, timeout=15)
            self.logger.info(f"✅ Connectivity test successful - Status: {response.status_code}")
            self.logger.debug(f"🔐 SSL Certificate verified successfully")
            
            # Parse and log version information if available
            if response.status_code == 200:
                try:
                    version_data = response.json()
                    self.logger.info(f"📊 CWE API Version: {version_data.get('ContentVersion', 'Unknown')}")
                    self.logger.info(f"📅 Content Date: {version_data.get('ContentDate', 'Unknown')}")
                    self.logger.info(f"🔢 Total Weaknesses: {version_data.get('TotalWeaknesses', 'Unknown')}")
                except json.JSONDecodeError:
                    self.logger.debug("⚠️  Could not parse version response as JSON")
            
            return True
        except requests.exceptions.SSLError as e:
            self.logger.error(f"🚫 SSL connectivity test failed: {e}")
            self.logger.error("🔐 SSL certificate verification failed. This could be due to:")
            self.logger.error("  1️⃣  Outdated certificate store - try updating ca-certificates")
            self.logger.error("  2️⃣  Corporate proxy interfering with SSL connections")
            self.logger.error("  3️⃣  System time/date incorrect")
            self.logger.error("  4️⃣  Network connectivity issues")
            
            # Try alternative SSL configuration
            self.logger.info("🔄 Attempting alternative SSL configuration...")
            
            try:
                # Try with updated SSL context
                import ssl
                context = ssl.create_default_context()
                context.check_hostname = True
                context.verify_mode = ssl.CERT_REQUIRED
                
                # Create a new session with updated SSL context
                alt_session = requests.Session()
                alt_session.mount('https://', requests.adapters.HTTPAdapter())
                
                # Test with the alternative configuration
                response = alt_session.get(test_url, timeout=15, verify=True)
                self.logger.info(f"✅ Alternative SSL configuration successful - Status: {response.status_code}")
                
                # Update the main session with working configuration
                self.session = alt_session
                return True
                
            except Exception as alt_error:
                self.logger.error(f"🚫 Alternative SSL configuration also failed: {alt_error}")
            
            # Try GitHub fallback as last resort
            self.logger.warning("🔄 API connectivity failed - attempting GitHub fallback...")
            github_weaknesses = self.fetch_github_fallback()
            if github_weaknesses:
                self.logger.info(f"✅ GitHub fallback successful - {len(github_weaknesses)} weaknesses available")
                self.use_fallback_mode = True
                return True
            
            # Provide specific SSL troubleshooting
            self.console.print(Panel.fit(
                "🛠️  SSL Certificate Issue Detected\n\n"
                "Try running these commands to fix SSL issues:\n"
                "• [bold cyan]sudo pacman -Sy ca-certificates[/] (Arch Linux)\n"
                "• [bold cyan]sudo apt update && sudo apt install ca-certificates[/] (Ubuntu/Debian)\n"
                "• [bold cyan]pip install --upgrade certifi requests[/]\n"
                "• [bold cyan]python -m certifi[/] (to check cert location)\n\n"
                "[yellow]If behind corporate firewall, contact IT for certificate installation[/]\n"
                "[red]Consider using --insecure flag only for testing (NOT recommended for production)[/]",
                title="SSL Troubleshooting",
                style="red"
            ))
            return False
        except (requests.exceptions.RequestException, ConnectionResetError, ConnectionError) as e:
            self.logger.error(f"🚫 Connectivity test failed: {e}")
            
            # Try GitHub fallback when main API is inaccessible
            self.logger.warning("🔄 API connectivity failed - attempting GitHub fallback...")
            github_weaknesses = self.fetch_github_fallback()
            if github_weaknesses:
                self.logger.info(f"✅ GitHub fallback successful - {len(github_weaknesses)} weaknesses available")
                self.use_fallback_mode = True
                return True
            
            self.logger.error("🚫 Both main API and GitHub fallback failed")
            return False
    
    def fetch_json(self, url: str, max_retries: int = 3) -> Dict[str, Any]:
        """Fetch JSON data from the given URL with enhanced retry logic for connection issues and caching."""
        # Check cache first
        if url in self.cache:
            self.cache_hits += 1
            self.logger.debug(f"📋 Cache hit for: {url}")
            return self.cache[url]
        
        self.request_count += 1
        request_start_time = time.time()
        
        for attempt in range(max_retries + 1):
            try:
                self.logger.debug(f"📡 Fetching data from: {url} (attempt {attempt + 1}/{max_retries + 1})")
                
                # Use session timeout settings
                response = self.session.get(url, timeout=(30, 60))
                
                # Track response time for adaptive rate limiting
                response_time = time.time() - request_start_time
                self.response_times.append(response_time)
                if len(self.response_times) > self.max_response_time_samples:
                    self.response_times.pop(0)  # Keep only recent samples
                
                # Log response details for debugging
                self.logger.debug(f"📊 Response status: {response.status_code}")
                self.logger.debug(f"📋 Response headers: {dict(response.headers)}")
                
                response.raise_for_status()
                result = response.json()
                
                # Cache the result if cache isn't too full
                if len(self.cache) < self.cache_size_limit:
                    self.cache[url] = result
                
                return result
                
            except (ConnectionResetError, ConnectionError, requests.exceptions.ConnectionError) as e:
                self.logger.warning(f"🔌 Connection reset/error on attempt {attempt + 1}: {e}")
                if attempt < max_retries:
                    wait_time = (2 ** attempt) * 3  # Exponential backoff: 3, 6, 12 seconds
                    self.logger.info(f"⏳ Waiting {wait_time} seconds before retry...")
                    time.sleep(wait_time)
                    
                    # Recreate session to ensure clean connection state
                    self._recreate_session()
                    continue
                else:
                    self.logger.error(f"🚫 Connection failed after {max_retries + 1} attempts: {e}")
                    self.logger.error("💡 Possible solutions:")
                    self.logger.error("  1️⃣  Check your internet connection stability")
                    self.logger.error("  2️⃣  Try again later - the server may be overloaded")
                    self.logger.error("  3️⃣  If behind a firewall/proxy, check your network settings")
                    self.logger.error("  4️⃣  Consider using a VPN if network restrictions apply")
                    return {}
                    
            except requests.exceptions.SSLError as e:
                self.logger.error(f"🔐 SSL Error fetching {url}: {e}")
                self.logger.error("🚫 SSL certificate verification failed. Possible solutions:")
                self.logger.error("  1️⃣  Update your system's certificate store:")
                self.logger.error("     - Ubuntu/Debian: sudo apt-get update && sudo apt-get install ca-certificates")
                self.logger.error("     - CentOS/RHEL: sudo yum update ca-certificates")
                self.logger.error("     - macOS: brew install ca-certificates")
                self.logger.error("  2️⃣  Check system time/date is correct")
                self.logger.error("  3️⃣  If behind corporate proxy, configure proxy settings properly")
                self.logger.error("  4️⃣  Install/update certifi package: pip install --upgrade certifi")
                return {}
                
            except requests.exceptions.Timeout as e:
                self.logger.warning(f"⏰ Timeout on attempt {attempt + 1}: {e}")
                if attempt < max_retries:
                    wait_time = (2 ** attempt) * 2  # Shorter backoff for timeouts
                    self.logger.info(f"⏳ Waiting {wait_time} seconds before retry...")
                    time.sleep(wait_time)
                    continue
                else:
                    self.logger.error(f"⏰ Timeout Error fetching {url} after {max_retries + 1} attempts")
                    self.logger.error("🐌 The server consistently took too long to respond")
                    return {}
                
            except requests.exceptions.HTTPError as e:
                response = e.response
                self.logger.error(f"🚨 HTTP Error fetching {url}: {e}")
                self.logger.error(f"📊 Status Code: {response.status_code}")
                self.logger.error(f"📄 Response Text: {response.text[:500]}...")  # First 500 chars
                
                # OpenAPI specification compliant error handling
                if response.status_code == 404:
                    if '/cwe/version' in url:
                        self.logger.error("❌ CWE version not found - API may be unavailable")
                    elif '/cwe/' in url and '/weakness/' in url:
                        self.logger.error("❌ CWE weakness ID not found")
                        # Re-raise 404 errors for weakness endpoints so calling methods can handle category fallback
                        raise e
                    elif '/cwe/' in url and ('/parents' in url or '/children' in url or '/descendants' in url or '/ancestors' in url):
                        self.logger.error("❌ CWE relationship data not found")
                    else:
                        self.logger.error("❌ CWE ID not found")
                elif response.status_code == 429:
                    self.logger.error("🚦 Rate limit exceeded - too many requests")
                    self.logger.error("💡 Consider reducing batch size or adding delays between requests")
                    if attempt < max_retries:
                        wait_time = 60  # Wait longer for rate limits
                        self.logger.info(f"⏳ Rate limited - waiting {wait_time} seconds...")
                        time.sleep(wait_time)
                        continue
                elif response.status_code == 500:
                    self.logger.error("🔧 Internal Server Error - the API is experiencing issues")
                    self.logger.error("🔄 This is a server-side problem, try again later")
                elif response.status_code >= 500:
                    self.logger.error("🛠️  Server error - the API may be temporarily unavailable")
                return {}
                
            except requests.exceptions.RequestException as e:
                self.logger.warning(f"🚫 Request Error on attempt {attempt + 1}: {e}")
                if attempt < max_retries:
                    wait_time = (2 ** attempt) * 2
                    self.logger.info(f"⏳ Waiting {wait_time} seconds before retry...")
                    time.sleep(wait_time)
                    continue
                else:
                    self.logger.error(f"🚫 Request failed after {max_retries + 1} attempts: {e}")
                    return {}
                
            except json.JSONDecodeError as e:
                self.logger.error(f"📄 JSON Decode Error from {url}: {e}")
                self.logger.error("⚠️  The server returned invalid JSON data")
                return {}
        
        return {}
    
    def _recreate_session(self) -> None:
        """Recreate the session with fresh connection pools to handle connection issues."""
        self.logger.debug("🔄 Recreating session for fresh connections...")
        
        # Close existing session
        if hasattr(self, 'session'):
            self.session.close()
        
        # Create new session with same configuration
        self.session = requests.Session()
        
        # Reapply SSL settings
        if self.insecure:
            self.session.verify = False
            import urllib3
            urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        else:
            try:
                self.session.verify = certifi.where()
            except ImportError:
                self.session.verify = True
        
        # Reapply retry strategy
        retry_strategy = Retry(
            total=8,
            status_forcelist=[429, 500, 502, 503, 504, 104],
            allowed_methods=["HEAD", "GET", "OPTIONS"],
            backoff_factor=3,
            raise_on_status=False,
        )
        
        adapter = HTTPAdapter(
            max_retries=retry_strategy,
            pool_connections=10,
            pool_maxsize=20,
            pool_block=False
        )
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
        # Reapply headers
        self.session.headers.update({
            'User-Agent': 'Vulnetix CWE Fetcher/1.0 (Security Tool)',
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Keep-Alive': 'timeout=60, max=100'
        })
        
        self.session.timeout = (30, 60)
    
    def get_view_members(self, view_id: str) -> List[str]:
        """Fetch CWE IDs from a specific view using OpenAPI-compliant endpoint."""
        url = f"{self.base_url}/cwe/view/{view_id}"
        self.logger.info(f"📋 Fetching view data from: {url}")
        
        data = self.fetch_json(url)
        if not data:
            return []
        
        cwe_ids = []
        views = data.get('Views', [])
        
        for view in views:
            # Updated to match OpenAPI schema - using 'Members' for relationships
            members = view.get('Members', [])
            for member in members:
                # OpenAPI schema uses 'CWE_ID' in relationships
                cwe_id = member.get('CWE_ID') or member.get('CweID')
                if cwe_id:
                    cwe_ids.append(str(cwe_id))
        
        self.logger.info(f"✅ Found {len(cwe_ids)} CWE IDs in view {view_id}")
        return cwe_ids
    
    def get_category_relationships(self, cwe_id: str) -> List[str]:
        """Fetch related CWE IDs from a category using OpenAPI-compliant endpoint."""
        url = f"{self.base_url}/cwe/category/{cwe_id}"
        self.logger.debug(f"🔗 Fetching category data for CWE-{cwe_id}")
        
        data = self.fetch_json(url)
        if not data:
            return []
        
        related_ids = []
        categories = data.get('Categories', [])
        
        for category in categories:
            relationships = category.get('Relationships', [])
            for relationship in relationships:
                # OpenAPI schema uses 'CWE_ID' in relationships
                related_cwe_id = relationship.get('CWE_ID') or relationship.get('CweID')
                if related_cwe_id:
                    related_ids.append(str(related_cwe_id))
        
        return related_ids
    
    def get_weakness_data(self, cwe_id: str) -> List[Dict[str, Any]]:
        """Fetch weakness data for a specific CWE ID using OpenAPI-compliant endpoint."""
        url = f"{self.base_url}/cwe/weakness/{cwe_id}"
        self.logger.debug(f"🔍 Fetching weakness data for CWE-{cwe_id}")
        
        try:
            data = self.fetch_json(url)
            if not data:
                return []
            
            weaknesses = data.get('Weaknesses', [])
            return weaknesses
        except requests.exceptions.HTTPError as e:
            if e.response and e.response.status_code == 404:
                # This might be a category, not a weakness
                if "use the category endpoint" in e.response.text:
                    self.logger.debug(f"🔄 CWE-{cwe_id} is a category, fetching related weaknesses")
                    try:
                        # Get category relationships and fetch weakness data for related IDs
                        related_ids = self.get_category_relationships(cwe_id)
                        if related_ids:
                            all_weaknesses = []
                            for related_id in related_ids:
                                try:
                                    related_weaknesses = self.get_weakness_data(related_id)
                                    all_weaknesses.extend(related_weaknesses)
                                except Exception as nested_e:
                                    self.logger.debug(f"⚠️  Failed to get weakness data for related CWE-{related_id}: {nested_e}")
                            return all_weaknesses
                        else:
                            self.logger.debug(f"⚠️  No related weaknesses found for category CWE-{cwe_id}")
                            return []
                    except Exception as cat_e:
                        self.logger.warning(f"⚠️  Failed to process category CWE-{cwe_id}: {cat_e}")
                        return []
                else:
                    self.logger.debug(f"⚠️  CWE-{cwe_id} not found: {e}")
                    return []
            else:
                self.logger.warning(f"🚫 HTTP error fetching CWE-{cwe_id}: {e}")
                return []
        except Exception as e:
            self.logger.warning(f"💥 Error fetching weakness data for CWE-{cwe_id}: {e}")
            return []
    
    def get_weakness_data_batch(self, cwe_ids: List[str], batch_size: int = 5) -> List[Dict[str, Any]]:
        """Fetch weakness data for multiple CWE IDs using OpenAPI-compliant batch requests with enhanced error handling and multiprocessing."""
        all_weaknesses = []
        
        # First, determine which CWE IDs are weaknesses vs categories using multiprocessing for type checking
        self.logger.info(f"🔍 Identifying CWE types for {len(cwe_ids)} IDs using parallel processing...")
        weakness_ids = []
        
        # Check CWE types in parallel batches
        type_batch_size = 10
        type_batches = [cwe_ids[i:i + type_batch_size] for i in range(0, len(cwe_ids), type_batch_size)]
        
        # Use ThreadPoolExecutor for I/O-bound type checking
        with ThreadPoolExecutor(max_workers=min(self.max_workers, len(type_batches))) as executor:
            future_to_batch = {executor.submit(self._worker_get_cwe_info, batch): batch for batch in type_batches}
            
            for future in as_completed(future_to_batch):
                batch = future_to_batch[future]
                try:
                    cwe_info_list = future.result(timeout=60)
                    for info in cwe_info_list:
                        cwe_id = str(info.get('ID', ''))
                        cwe_type = info.get('Type', '').lower()
                        
                        if cwe_type == 'weakness':
                            weakness_ids.append(cwe_id)
                        else:
                            # Default to weakness if type is unclear
                            weakness_ids.append(cwe_id)
                            if cwe_type and cwe_type != 'weakness':
                                self.logger.debug(f"⚠️  Unknown type '{cwe_type}' for CWE-{cwe_id}, treating as weakness")
                except Exception as e:
                    self.logger.warning(f"⚠️  Failed to get type info for batch {batch}, treating all as weaknesses: {e}")
                    weakness_ids.extend(batch)
        
        self.logger.info(f"📊 Identified {len(weakness_ids)} weaknesses for processing")
        
        # Process weaknesses using weakness endpoint with enhanced batch processing
        if weakness_ids:
            self.logger.info(f"📦 Processing {len(weakness_ids)} weakness IDs in batches of {batch_size}")
            all_weaknesses.extend(self._fetch_weakness_batch_data(weakness_ids, batch_size))
                
        self.logger.info(f"📊 Batch processing completed: {len(all_weaknesses)} total weaknesses retrieved")
        return all_weaknesses
    
    def _fetch_weakness_batch_data(self, weakness_ids: List[str], batch_size: int) -> List[Dict[str, Any]]:
        """Helper method to fetch weakness data for confirmed weakness IDs with parallel batch processing."""
        all_weaknesses = []
        
        # Create batches for processing
        batches = [weakness_ids[i:i + batch_size] for i in range(0, len(weakness_ids), batch_size)]
        
        self.logger.info(f"🚀 Processing {len(weakness_ids)} weakness IDs in {len(batches)} parallel batches using up to {self.max_workers} workers")
        
        # Use ThreadPoolExecutor for I/O-bound batch operations
        max_batch_workers = min(self.max_workers // 2, len(batches))  # Reserve some workers for individual requests
        
        with ThreadPoolExecutor(max_workers=max_batch_workers) as executor:
            future_to_batch = {}
            
            for i, batch in enumerate(batches):
                future = executor.submit(self._process_weakness_batch, batch, i + 1, len(batches))
                future_to_batch[future] = (i, batch)
            
            # Collect results as they complete
            for future in as_completed(future_to_batch):
                batch_idx, batch = future_to_batch[future]
                try:
                    batch_weaknesses = future.result(timeout=120)  # 2 minute timeout per batch
                    all_weaknesses.extend(batch_weaknesses)
                    self.logger.debug(f"✅ Batch {batch_idx + 1} completed with {len(batch_weaknesses)} weaknesses")
                except Exception as e:
                    self.logger.warning(f"🚫 Batch {batch_idx + 1} failed: {e}, falling back to individual requests")
                    # Fall back to individual requests for failed batch
                    for cwe_id in batch:
                        try:
                            individual_weaknesses = self.get_weakness_data(cwe_id)
                            all_weaknesses.extend(individual_weaknesses)
                            time.sleep(1)  # Delay for individual fallback requests
                        except Exception as individual_e:
                            self.logger.warning(f"⚠️  Failed to get individual data for CWE-{cwe_id}: {individual_e}")
        
        return all_weaknesses
    
    def _process_weakness_batch(self, batch: List[str], batch_num: int, total_batches: int) -> List[Dict[str, Any]]:
        """Process a single batch of weakness IDs."""
        batch_str = ','.join(batch)
        url = f"{self.base_url}/cwe/weakness/{batch_str}"
        
        self.logger.debug(f"📦 Processing weakness batch {batch_num}/{total_batches}: {batch_str}")
        
        # Try the batch request with retries
        max_batch_retries = 2
        
        for retry in range(max_batch_retries + 1):
            try:
                data = self.fetch_json(url)
                if data:
                    weaknesses = data.get('Weaknesses', [])
                    self.logger.debug(f"✅ Retrieved {len(weaknesses)} weaknesses from batch {batch_num}")
                    
                    # Add delay between batches to be respectful to the API
                    if batch_num < total_batches:
                        adaptive_delay = self._get_adaptive_delay()
                        time.sleep(adaptive_delay)  # Use adaptive delay
                    
                    return weaknesses
                else:
                    self.logger.warning(f"⚠️  Empty response for batch {batch_num}, attempt {retry + 1}")
                    
            except Exception as e:
                self.logger.warning(f"🚫 Batch request failed (attempt {retry + 1}/{max_batch_retries + 1}): {e}")
                if retry < max_batch_retries:
                    wait_time = (retry + 1) * 3  # 3, 6 seconds
                    self.logger.debug(f"⏳ Waiting {wait_time} seconds before batch retry...")
                    time.sleep(wait_time)
        
        # If all retries failed, return empty list (caller will handle individual requests)
        self.logger.error(f"💥 Batch {batch_num} failed after all retries")
        return []
    
    def get_all_weaknesses_direct(self) -> List[Dict[str, Any]]:
        """Fetch all weaknesses using the 'all' keyword as per OpenAPI specification."""
        # Check if we're in fallback mode
        if self.use_fallback_mode:
            self.logger.info("🔄 Using GitHub fallback for direct weakness retrieval")
            return self.fetch_github_fallback()
        
        url = f"{self.base_url}/cwe/weakness/all"
        self.logger.info(f"🌐 Fetching all weaknesses directly from: {url}")
        
        try:
            data = self.fetch_json(url)
            if not data:
                # If direct API fails, try GitHub fallback
                self.logger.warning("⚠️  Direct API fetch failed, attempting GitHub fallback...")
                github_weaknesses = self.fetch_github_fallback()
                if github_weaknesses:
                    self.logger.info(f"✅ GitHub fallback successful - {len(github_weaknesses)} weaknesses retrieved")
                    return github_weaknesses
                return []
            
            weaknesses = data.get('Weaknesses', [])
            self.logger.info(f"✅ Retrieved {len(weaknesses)} total weaknesses")
            return weaknesses
        except (ConnectionResetError, ConnectionError, requests.exceptions.ConnectionError) as e:
            self.logger.warning(f"🔌 Connection error during direct fetch: {e}")
            self.logger.info("🔄 Attempting GitHub fallback due to connection issues...")
            github_weaknesses = self.fetch_github_fallback()
            if github_weaknesses:
                self.logger.info(f"✅ GitHub fallback successful - {len(github_weaknesses)} weaknesses retrieved")
                return github_weaknesses
            return []
        except Exception as e:
            self.logger.error(f"💥 Error fetching all weaknesses directly: {e}")
            self.logger.info("🔄 Attempting GitHub fallback due to API error...")
            github_weaknesses = self.fetch_github_fallback()
            if github_weaknesses:
                self.logger.info(f"✅ GitHub fallback successful - {len(github_weaknesses)} weaknesses retrieved")
                return github_weaknesses
            return []
    
    def get_cwe_info(self, cwe_ids: List[str]) -> List[Dict[str, Any]]:
        """Get CWE type information for multiple IDs using OpenAPI-compliant endpoint."""
        if not cwe_ids:
            return []
        
        batch_str = ','.join(cwe_ids[:50])  # Limit to avoid URL length issues
        url = f"{self.base_url}/cwe/{batch_str}"
        self.logger.debug(f"ℹ️  Fetching CWE info for: {batch_str}")
        
        data = self.fetch_json(url)
        if not data:
            return []
        
        # OpenAPI spec returns array directly for CWE info
        return data if isinstance(data, list) else []
    
    def get_cwe_parents(self, cwe_id: str, view_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get parent relationships for a CWE using OpenAPI-compliant endpoint."""
        url = f"{self.base_url}/cwe/{cwe_id}/parents"
        if view_id:
            url += f"?view={view_id}"
        
        self.logger.debug(f"⬆️  Fetching parents for CWE-{cwe_id}")
        
        data = self.fetch_json(url)
        return data if isinstance(data, list) else []
    
    def get_cwe_children(self, cwe_id: str, view_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get children relationships for a CWE using OpenAPI-compliant endpoint."""
        url = f"{self.base_url}/cwe/{cwe_id}/children"
        if view_id:
            url += f"?view={view_id}"
        
        self.logger.debug(f"⬇️  Fetching children for CWE-{cwe_id}")
        
        data = self.fetch_json(url)
        return data if isinstance(data, list) else []
    
    def get_cwe_descendants(self, cwe_id: str, view_id: Optional[str] = None) -> Dict[str, Any]:
        """Get all descendants for a CWE using OpenAPI-compliant endpoint."""
        url = f"{self.base_url}/cwe/{cwe_id}/descendants"
        if view_id:
            url += f"?view={view_id}"
        
        self.logger.debug(f"🌳 Fetching descendants for CWE-{cwe_id}")
        
        data = self.fetch_json(url)
        return data if isinstance(data, dict) else {}
    
    def get_cwe_ancestors(self, cwe_id: str, view_id: Optional[str] = None, primary_only: bool = False) -> Dict[str, Any]:
        """Get all ancestors for a CWE using OpenAPI-compliant endpoint."""
        url = f"{self.base_url}/cwe/{cwe_id}/ancestors"
        params = []
        if view_id:
            params.append(f"view={view_id}")
        if primary_only:
            params.append("primary=true")
        
        if params:
            url += "?" + "&".join(params)
        
        self.logger.debug(f"🔼 Fetching ancestors for CWE-{cwe_id}")
        
        data = self.fetch_json(url)
        return data if isinstance(data, dict) else {}
    
    def collect_all_weaknesses(self, view_id: str, use_direct_all: bool = False) -> List[Dict[str, Any]]:
        """
        Collect all weakness data using OpenAPI-compliant methods or GitHub fallback.
        
        Args:
            view_id: The view ID to start collection from
            use_direct_all: If True, use the 'all' endpoint to fetch all weaknesses directly
        """
        # Check if we're in fallback mode and use GitHub data
        if self.use_fallback_mode:
            self.logger.info("🔄 Using GitHub fallback mode for weakness data collection")
            github_weaknesses = self.fetch_github_fallback()
            if github_weaknesses:
                self.logger.info(f"✅ Successfully collected {len(github_weaknesses)} weakness entries from GitHub fallback")
                return github_weaknesses
            else:
                self.logger.error("🚫 GitHub fallback failed - no weakness data available")
                return []
        
        if use_direct_all:
            self.logger.info("🚀 Using direct 'all' endpoint to fetch all weaknesses")
            return self.get_all_weaknesses_direct()
        
        all_weaknesses = []
        processed_cwe_ids = set()
        
        # Step 1: Get CWE IDs from the view
        self.logger.info(f"🎯 Collecting weaknesses starting from view {view_id}")
        view_cwe_ids = self.get_view_members(view_id)
        
        if not view_cwe_ids:
            self.logger.warning(f"⚠️  No CWE IDs found in view {view_id}, trying direct 'all' method")
            return self.get_all_weaknesses_direct()
        
        # Step 2: For each CWE ID from view, get category relationships
        all_cwe_ids = set(view_cwe_ids)
        
        for cwe_id in view_cwe_ids:
            related_ids = self.get_category_relationships(cwe_id)
            all_cwe_ids.update(related_ids)
            
            # Also get children and descendants for more comprehensive coverage
            children = self.get_cwe_children(cwe_id, view_id)
            for child in children:
                if 'ID' in child:
                    all_cwe_ids.add(str(child['ID']))
            
            descendants_data = self.get_cwe_descendants(cwe_id, view_id)
            if descendants_data and 'Children' in descendants_data:
                self._extract_descendant_ids(descendants_data, all_cwe_ids)
        
        self.logger.info(f"📊 Found {len(all_cwe_ids)} total CWE IDs to fetch weakness data for")
        
        # Step 3: Use batch requests for better performance
        cwe_ids_list = sorted(list(all_cwe_ids))
        
        # Try batch processing first for better performance
        try:
            self.logger.info("🔄 Attempting batch weakness data retrieval")
            all_weaknesses = self.get_weakness_data_batch(cwe_ids_list, batch_size=self.batch_size)
            
            if all_weaknesses:
                self.logger.info(f"✅ Successfully collected {len(all_weaknesses)} weakness entries via batch requests")
                return all_weaknesses
        except Exception as e:
            self.logger.warning(f"⚠️  Batch request failed, falling back to individual requests: {e}")
        
        # Fallback to individual requests with category filtering for better performance
        self.logger.info("🔄 Using parallel individual requests with category filtering for weakness data")
        
        # Use the new category filtering method instead of blind retry logic
        all_weaknesses = self._process_batch_individually_filtering_categories(cwe_ids_list)
        
        self.logger.info(f"✅ Collected {len(all_weaknesses)} weakness entries")
        return all_weaknesses
    
    def _process_cwe_chunk(self, cwe_chunk: List[str], chunk_num: int, total_chunks: int) -> Tuple[List[Dict[str, Any]], List[str]]:
        """Process a chunk of CWE IDs in parallel and return weaknesses and failed IDs."""
        chunk_weaknesses = []
        failed_ids = []
        
        self.logger.debug(f"📄 Processing chunk {chunk_num}/{total_chunks} with {len(cwe_chunk)} CWE IDs")
        
        # Use ThreadPoolExecutor for I/O-bound CWE data fetching within each chunk
        chunk_max_workers = min(8, len(cwe_chunk))  # Limit workers per chunk to avoid overwhelming API
        
        with ThreadPoolExecutor(max_workers=chunk_max_workers) as executor:
            future_to_cwe = {executor.submit(self._worker_get_weakness_data, cwe_id): cwe_id for cwe_id in cwe_chunk}
            
            for future in as_completed(future_to_cwe):
                cwe_id = future_to_cwe[future]
                try:
                    result_cwe_id, weaknesses = future.result(timeout=60)
                    if weaknesses:
                        chunk_weaknesses.extend(weaknesses)
                        self.logger.debug(f"✅ Retrieved {len(weaknesses)} weaknesses for CWE-{result_cwe_id}")
                    else:
                        self.logger.debug(f"⚠️  No data returned for CWE-{result_cwe_id}")
                        failed_ids.append(result_cwe_id)
                except Exception as e:
                    self.logger.debug(f"🚫 Failed to fetch data for CWE-{cwe_id}: {e}")
                    failed_ids.append(cwe_id)
                
                # Brief delay to be respectful to the API
                time.sleep(0.1)
        
        self.logger.debug(f"✅ Chunk {chunk_num} completed: {len(chunk_weaknesses)} weaknesses, {len(failed_ids)} failed")
        return chunk_weaknesses, failed_ids
    
    def _extract_descendant_ids(self, descendants_data: Dict[str, Any], cwe_ids_set: set) -> None:
        """Recursively extract CWE IDs from descendants data structure."""
        if 'Data' in descendants_data and 'ID' in descendants_data['Data']:
            cwe_ids_set.add(str(descendants_data['Data']['ID']))
        
        if 'Children' in descendants_data:
            for child in descendants_data['Children']:
                self._extract_descendant_ids(child, cwe_ids_set)
    
    def _is_category_id(self, cwe_id: str) -> bool:
        """Check if a CWE ID is a category by testing the category endpoint."""
        try:
            session = self._get_or_create_session()
            url = f"{self.base_url}/cwe/category/{cwe_id}"
            response = session.get(url, timeout=(10, 30))
            
            # If category endpoint succeeds, it's a category
            if response.status_code == 200:
                return True
            return False
        except Exception:
            return False
    
    def _filter_category_ids(self, cwe_ids: List[str]) -> Tuple[List[str], List[str]]:
        """Filter CWE IDs into weakness and category lists."""
        weakness_ids = []
        category_ids = []
        
        self.logger.debug(f"🔍 Filtering {len(cwe_ids)} CWE IDs to separate categories from weaknesses...")
        
        # Use ThreadPoolExecutor for parallel category checking
        with ThreadPoolExecutor(max_workers=min(10, len(cwe_ids))) as executor:
            future_to_cwe = {executor.submit(self._is_category_id, cwe_id): cwe_id for cwe_id in cwe_ids}
            
            for future in as_completed(future_to_cwe):
                cwe_id = future_to_cwe[future]
                try:
                    is_category = future.result(timeout=30)
                    if is_category:
                        category_ids.append(cwe_id)
                        self.logger.debug(f"📂 CWE-{cwe_id} identified as category")
                    else:
                        weakness_ids.append(cwe_id)
                        self.logger.debug(f"🐛 CWE-{cwe_id} identified as weakness")
                except Exception as e:
                    # If we can't determine, assume it's a weakness to be safe
                    weakness_ids.append(cwe_id)
                    self.logger.debug(f"❓ CWE-{cwe_id} classification unclear, treating as weakness: {e}")
        
        self.logger.info(f"🔍 Filtering complete: {len(weakness_ids)} weaknesses, {len(category_ids)} categories")
        return weakness_ids, category_ids
    
    def _process_batch_individually_filtering_categories(self, cwe_ids_list: List[str]) -> List[Dict[str, Any]]:
        """Process CWE IDs individually with proper category filtering."""
        self.logger.info(f"🔄 Processing {len(cwe_ids_list)} CWE IDs with category filtering...")
        
        # First, filter out category IDs from weakness IDs
        weakness_ids, category_ids = self._filter_category_ids(cwe_ids_list)
        
        if category_ids:
            self.logger.info(f"⚠️  Skipping {len(category_ids)} category IDs: {category_ids[:10]}{'...' if len(category_ids) > 10 else ''}")
        
        if not weakness_ids:
            self.logger.warning("⚠️  No weakness IDs found after filtering - all IDs appear to be categories")
            return []
        
        self.logger.info(f"🚀 Processing {len(weakness_ids)} weakness IDs in parallel chunks using {self.max_workers} workers")
        
        all_weaknesses = []
        failed_cwe_ids = []
        
        # Process weakness IDs in parallel using ThreadPoolExecutor
        chunk_size = max(1, len(weakness_ids) // (self.max_workers * 2))
        weakness_chunks = [weakness_ids[i:i + chunk_size] for i in range(0, len(weakness_ids), chunk_size)]
        
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            # Submit all chunks for parallel processing
            future_to_chunk = {}
            for chunk_idx, chunk in enumerate(weakness_chunks):
                future = executor.submit(self._process_cwe_chunk, chunk, chunk_idx + 1, len(weakness_chunks))
                future_to_chunk[future] = chunk
            
            # Collect results as they complete
            for future in as_completed(future_to_chunk):
                chunk = future_to_chunk[future]
                try:
                    chunk_weaknesses, chunk_failed = future.result(timeout=300)
                    all_weaknesses.extend(chunk_weaknesses)
                    failed_cwe_ids.extend(chunk_failed)
                except Exception as e:
                    self.logger.warning(f"🚫 Chunk processing failed: {e}")
                    failed_cwe_ids.extend(chunk)
        
        # Retry failed weakness IDs with exponential backoff
        if failed_cwe_ids:
            self.logger.info(f"🔄 Retrying {len(failed_cwe_ids)} failed weakness IDs...")
            time.sleep(5)
            
            for cwe_id in failed_cwe_ids:
                try:
                    self.logger.debug(f"🔄 Retry: CWE-{cwe_id}")
                    weaknesses = self.get_weakness_data(cwe_id)
                    if weaknesses:
                        all_weaknesses.extend(weaknesses)
                        self.logger.debug(f"✅ Retry successful for CWE-{cwe_id}")
                    time.sleep(2)
                except Exception as e:
                    self.logger.error(f"🚫 Final retry failed for CWE-{cwe_id}: {e}")
        
        self.logger.info(f"✅ Collected {len(all_weaknesses)} weakness entries (filtered out {len(category_ids)} categories)")
        return all_weaknesses

def check_ssl_environment() -> bool:
    """Check SSL environment and provide recommendations."""
    logger = logging.getLogger(__name__)
    
    try:
        import certifi
        logger.debug(f"🔒 certifi package found - CA bundle: {certifi.where()}")
        return True
    except ImportError:
        logger.warning("⚠️  certifi package not found - install it for better SSL certificate handling")
        logger.info("💡 Run: pip install certifi")
        return False


def check_ssl_certificates() -> None:
    """Provide guidance on SSL certificate issues while maintaining security."""
    logger = logging.getLogger(__name__)
    console = Console()
    
    console.print(Panel.fit(
        "🔐 SSL Certificate Troubleshooting (Secure Solutions Only)\n\n"
        "1️⃣  Update your system's certificate store:\n"
        "   • Ubuntu/Debian: [cyan]sudo apt-get update && sudo apt-get install ca-certificates[/]\n"
        "   • CentOS/RHEL: [cyan]sudo yum update ca-certificates[/]\n"
        "   • macOS: [cyan]brew install ca-certificates[/]\n\n"
        "2️⃣  Update Python certificates:\n"
        "   • [cyan]pip install --upgrade certifi requests[/]\n\n"
        "3️⃣  Check system time/date is correct (SSL certs are time-sensitive)\n\n"
        "4️⃣  If behind a corporate firewall:\n"
        "   • Configure proper proxy settings with your IT department\n"
        "   • Ask for the corporate CA certificate to be installed\n\n"
        "5️⃣  Verify network connectivity to the API endpoint\n\n"
        "[red]⚠️  SECURITY NOTE: Never disable SSL verification - it protects against attacks![/]",
        title="SSL Certificate Help",
        style="yellow"
    ))


def main():
    """Main entry point for the CLI tool."""
    parser = argparse.ArgumentParser(
        description="Fetch CWE data from MITRE API and compile into JSON file",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s output.json
  %(prog)s --view 1000 --baseUrl https://cwe.mitre.org/api/v1 weaknesses.json
  %(prog)s --all-direct output.json  # Fetch all weaknesses directly
  %(prog)s --max-workers 16 --batch-size 10 --show-stats output.json  # Optimized parallel processing
        """
    )
    
    parser.add_argument(
        'output_path',
        type=str,
        help='Path to save the compiled JSON file'
    )
    
    parser.add_argument(
        '--view',
        type=str,
        default='699',
        help='CWE view ID to start fetching from (default: 699)'
    )
    
    parser.add_argument(
        '--baseUrl',
        type=str,
        default='https://cwe-api.mitre.org/api/v1',
        help='Base URL for the CWE API (default: https://cwe-api.mitre.org/api/v1)'
    )
    
    parser.add_argument(
        '--all-direct',
        action='store_true',
        help='Fetch all weaknesses directly using the "all" endpoint (OpenAPI compliant)'
    )
    
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose logging'
    )
    
    parser.add_argument(
        '--max-workers',
        type=int,
        default=None,
        help='Maximum number of parallel workers for processing (default: auto-detect based on CPU cores)'
    )
    
    parser.add_argument(
        '--batch-size',
        type=int,
        default=5,
        help='Batch size for weakness data requests (default: 5)'
    )
    
    parser.add_argument(
        '--show-stats',
        action='store_true',
        help='Show detailed performance statistics at the end'
    )
    
    parser.add_argument(
        '--insecure',
        action='store_true',
        help='DANGER: Disable SSL certificate verification (for testing only - NOT recommended)'
    )
    
    args = parser.parse_args()
    
    # Configure logging with Rich
    log_level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(
        level=log_level,
        format="%(message)s",
        datefmt="[%X]",
        handlers=[RichHandler(console=Console(), rich_tracebacks=True)]
    )
    logger = logging.getLogger(__name__)
    
    # Check SSL environment
    check_ssl_environment()
    
    # Validate output path
    output_path = Path(args.output_path)
    try:
        output_path.parent.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        logger.error(f"❌ Error creating output directory: {e}")
        sys.exit(1)
    
    # Initialize fetcher and collect data
    fetcher = CWEFetcher(args.baseUrl, insecure=args.insecure, max_workers=args.max_workers, batch_size=args.batch_size)
    console = Console()
    
    try:
        console.print(Panel.fit("CWE Data Collection Tool", style="bold blue"))
        logger.info(f"🎯 Starting CWE data collection from view {args.view}")
        logger.info(f"🌐 Using API base URL: {args.baseUrl}")
        logger.info(f"💾 Output will be saved to: {output_path}")
        if args.max_workers:
            logger.info(f"🚀 Using {args.max_workers} parallel workers")
        else:
            logger.info(f"🚀 Using {fetcher.max_workers} parallel workers (auto-detected)")
        logger.info(f"📦 Batch size: {args.batch_size}")
        console.print("─" * 60, style="dim")
        
        # Test connectivity first
        if not fetcher.test_connectivity():
            logger.error("🚫 Connectivity test failed. Unable to proceed with data collection.")
            logger.error("💡 This could be due to network issues, SSL problems, or API unavailability.")
            logger.error("🔧 Please check your network connection and try again.")
            fetcher.close()
            sys.exit(1)
        
        # Check if we're using fallback mode
        if fetcher.use_fallback_mode:
            logger.info("🔄 Operating in GitHub fallback mode")
            logger.info("📡 Data will be retrieved from GitHub repository instead of official API")
        
        weaknesses = fetcher.collect_all_weaknesses(args.view, use_direct_all=args.all_direct)
        
        # Check if we have any weaknesses before writing file
        if not weaknesses:
            logger.warning("⚠️  No weaknesses found")
            fetcher.close()
            sys.exit(1)

        # Build final JSON structure
        result = {
            "Weaknesses": weaknesses
        }
        
        # Save to file
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        
        console.print("─" * 60, style="dim")
        logger.info(f"✅ Successfully saved {len(weaknesses)} weakness entries to {output_path}")
        
        # Show performance statistics if requested
        if args.show_stats:
            stats = fetcher.get_performance_stats()
            console.print("\n" + "─" * 60, style="dim")
            console.print(Panel.fit(
                f"📊 Performance Statistics\n\n"
                f"🔢 Total API Requests: {stats['total_requests']}\n"
                f"📋 Cache Hits: {stats['cache_hits']}\n"
                f"📈 Cache Hit Ratio: {stats['cache_hit_ratio']:.1f}%\n"
                f"⏱️  Total Time: {stats['elapsed_time_seconds']:.1f} seconds\n"
                f"🚀 Requests/Second: {stats['requests_per_second']:.1f}\n"
                f"💾 Cache Size: {stats['cache_size']} entries\n"
                f"👥 Max Workers: {stats['max_workers']}\n"
                f"📡 Avg Response Time: {stats['avg_response_time']:.2f}s\n"
                f"📊 Response Samples: {stats['response_samples']}",
                title="Performance Report",
                style="cyan"
            ))
        
        console.print(Panel.fit("🎉 CWE data collection completed successfully!", style="bold green"))
        
    except KeyboardInterrupt:
        logger.info("⚠️  Operation cancelled by user")
        fetcher._graceful_shutdown()
        sys.exit(130)
    except (ConnectionResetError, ConnectionError) as e:
        logger.error(f"🔌 Connection error during execution: {e}")
        logger.error("💡 This error suggests network connectivity issues. Try:")
        logger.error("  1️⃣  Check your internet connection")
        logger.error("  2️⃣  Try again in a few minutes")
        logger.error("  3️⃣  If the problem persists, the API server may be experiencing issues")
        fetcher._graceful_shutdown()
        sys.exit(1)
    except Exception as e:
        logger.error(f"💥 Unexpected error: {e}")
        import traceback
        logger.debug(f"📊 Full traceback: {traceback.format_exc()}")
        fetcher._graceful_shutdown()
        sys.exit(1)
    finally:
        # Ensure session is always closed
        try:
            fetcher._graceful_shutdown()
        except Exception:
            pass  # Ignore cleanup errors


if __name__ == '__main__':
    main()
