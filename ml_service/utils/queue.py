"""
Request Queue with Priority Handling
Manages ML prediction requests during high load scenarios
"""
import asyncio
import time
import logging
from typing import Any, Dict, Optional, Callable, Awaitable
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
import heapq

logger = logging.getLogger(__name__)


class Priority(Enum):
    """Request priority levels"""
    CRITICAL = 1  # Life-threatening emergencies
    HIGH = 2      # Urgent but not immediately life-threatening
    MEDIUM = 3    # Standard requests
    LOW = 4       # Background/batch requests


@dataclass(order=True)
class QueuedRequest:
    """
    Queued request with priority.
    Uses priority for ordering in heap queue.
    """
    priority: int = field(compare=True)
    timestamp: float = field(compare=True)
    request_id: str = field(compare=False)
    request_data: Dict[str, Any] = field(compare=False)
    future: asyncio.Future = field(compare=False)
    
    def __post_init__(self):
        """Ensure timestamp is set"""
        if self.timestamp is None:
            self.timestamp = time.time()


class RequestQueue:
    """
    Priority queue for ML prediction requests.
    Handles request queuing during high load with priority-based processing.
    """
    
    def __init__(
        self,
        max_queue_size: int = 1000,
        max_concurrent: int = 10,
        queue_timeout: float = 30.0
    ):
        """
        Initialize request queue.
        
        Args:
            max_queue_size: Maximum number of queued requests
            max_concurrent: Maximum concurrent request processing
            queue_timeout: Maximum time a request can wait in queue (seconds)
        """
        self._queue: list = []  # Heap queue
        self._max_queue_size = max_queue_size
        self._max_concurrent = max_concurrent
        self._queue_timeout = queue_timeout
        
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._processing_count = 0
        self._total_queued = 0
        self._total_processed = 0
        self._total_timeout = 0
        self._total_rejected = 0
        
        logger.info(
            f"RequestQueue initialized: max_queue_size={max_queue_size}, "
            f"max_concurrent={max_concurrent}, timeout={queue_timeout}s"
        )
    
    async def enqueue(
        self,
        request_id: str,
        request_data: Dict[str, Any],
        priority: Priority = Priority.MEDIUM,
        handler: Callable[[Dict[str, Any]], Awaitable[Any]] = None
    ) -> Any:
        """
        Enqueue a request for processing.
        
        Args:
            request_id: Unique request identifier
            request_data: Request data to process
            priority: Request priority level
            handler: Async function to process the request
        
        Returns:
            Processing result
        
        Raises:
            asyncio.TimeoutError: If request times out in queue
            RuntimeError: If queue is full
        """
        # Check queue size
        if len(self._queue) >= self._max_queue_size:
            self._total_rejected += 1
            logger.warning(f"Queue full, rejecting request {request_id}")
            raise RuntimeError(f"Queue full (size={self._max_queue_size})")
        
        # Create future for result
        loop = asyncio.get_event_loop()
        future = loop.create_future()
        
        # Create queued request
        queued_request = QueuedRequest(
            priority=priority.value,
            timestamp=time.time(),
            request_id=request_id,
            request_data=request_data,
            future=future
        )
        
        # Add to heap queue
        heapq.heappush(self._queue, queued_request)
        self._total_queued += 1
        
        logger.info(
            f"Request {request_id} queued with priority={priority.name} "
            f"(queue_size={len(self._queue)})"
        )
        
        # Start processing if handler provided
        if handler:
            asyncio.create_task(self._process_queue(handler))
        
        # Wait for result with timeout
        try:
            result = await asyncio.wait_for(future, timeout=self._queue_timeout)
            return result
        except asyncio.TimeoutError:
            self._total_timeout += 1
            logger.error(f"Request {request_id} timed out after {self._queue_timeout}s")
            raise
    
    async def _process_queue(self, handler: Callable[[Dict[str, Any]], Awaitable[Any]]):
        """
        Process queued requests with concurrency control.
        
        Args:
            handler: Async function to process requests
        """
        while self._queue:
            # Acquire semaphore for concurrency control
            async with self._semaphore:
                # Get highest priority request
                if not self._queue:
                    break
                
                queued_request = heapq.heappop(self._queue)
                self._processing_count += 1
                
                # Check if request timed out while waiting
                wait_time = time.time() - queued_request.timestamp
                if wait_time > self._queue_timeout:
                    self._total_timeout += 1
                    logger.warning(
                        f"Request {queued_request.request_id} timed out "
                        f"(waited {wait_time:.1f}s)"
                    )
                    queued_request.future.set_exception(
                        asyncio.TimeoutError(f"Request timed out after {wait_time:.1f}s")
                    )
                    self._processing_count -= 1
                    continue
                
                # Process request
                try:
                    logger.debug(
                        f"Processing request {queued_request.request_id} "
                        f"(waited {wait_time:.3f}s)"
                    )
                    
                    start_time = time.time()
                    result = await handler(queued_request.request_data)
                    process_time = time.time() - start_time
                    
                    logger.info(
                        f"Request {queued_request.request_id} processed in {process_time:.3f}s "
                        f"(total_time={wait_time + process_time:.3f}s)"
                    )
                    
                    queued_request.future.set_result(result)
                    self._total_processed += 1
                
                except Exception as e:
                    logger.error(
                        f"Error processing request {queued_request.request_id}: {e}",
                        exc_info=True
                    )
                    queued_request.future.set_exception(e)
                
                finally:
                    self._processing_count -= 1
    
    def get_stats(self) -> Dict[str, Any]:
        """Get queue statistics"""
        return {
            "queue_size": len(self._queue),
            "processing_count": self._processing_count,
            "max_queue_size": self._max_queue_size,
            "max_concurrent": self._max_concurrent,
            "total_queued": self._total_queued,
            "total_processed": self._total_processed,
            "total_timeout": self._total_timeout,
            "total_rejected": self._total_rejected,
            "timeout_rate_pct": round(
                (self._total_timeout / self._total_queued * 100) if self._total_queued > 0 else 0,
                2
            ),
            "rejection_rate_pct": round(
                (self._total_rejected / (self._total_queued + self._total_rejected) * 100)
                if (self._total_queued + self._total_rejected) > 0 else 0,
                2
            )
        }
    
    def clear(self):
        """Clear the queue"""
        count = len(self._queue)
        self._queue.clear()
        logger.info(f"Queue cleared ({count} requests removed)")


# Global queue instance
_request_queue = None


def get_request_queue() -> RequestQueue:
    """Get global request queue instance"""
    global _request_queue
    if _request_queue is None:
        _request_queue = RequestQueue(
            max_queue_size=1000,
            max_concurrent=10,
            queue_timeout=30.0
        )
    return _request_queue


def determine_priority(request_data: Dict[str, Any]) -> Priority:
    """
    Determine request priority based on request data.
    
    Args:
        request_data: Request data dictionary
    
    Returns:
        Priority level
    """
    # Check for explicit priority
    if "priority" in request_data:
        priority_str = request_data["priority"].upper()
        try:
            return Priority[priority_str]
        except KeyError:
            pass
    
    # Determine priority from emergency type
    emergency_type = request_data.get("emergency_type", "").lower()
    
    critical_types = ["cardiac arrest", "stroke", "severe trauma", "respiratory failure"]
    high_types = ["cardiac", "trauma", "respiratory distress", "seizure"]
    
    if any(ct in emergency_type for ct in critical_types):
        return Priority.CRITICAL
    elif any(ht in emergency_type for ht in high_types):
        return Priority.HIGH
    else:
        return Priority.MEDIUM


async def queue_request(
    request_id: str,
    request_data: Dict[str, Any],
    handler: Callable[[Dict[str, Any]], Awaitable[Any]],
    priority: Optional[Priority] = None
) -> Any:
    """
    Queue a request for processing with automatic priority determination.
    
    Args:
        request_id: Unique request identifier
        request_data: Request data to process
        handler: Async function to process the request
        priority: Optional explicit priority (auto-determined if None)
    
    Returns:
        Processing result
    """
    if priority is None:
        priority = determine_priority(request_data)
    
    queue = get_request_queue()
    return await queue.enqueue(request_id, request_data, priority, handler)
