// client/components/OperatorRequestManager.tsx
import { useEffect, useState } from "react";
import { 
  onAssistCreated, 
  onAssistRemoved, 
  onAssistAccepted, 
  assistAccept, 
  joinOperators 
} from "@/socket/socketEvents";
import { logger } from "@/utils/logger";

export interface AssistRequestData {
  id: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  vehicle: {
    model: string;
    plate: string;
    notes?: string;
  };
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  createdAt: string;
}

interface OperatorRequestManagerProps {
  onRequestAccepted?: (requestId: string) => void;
  onRequestRemoved?: (requestId: string, takenBy: string) => void;
}

/**
 * Handles real-time operator request management
 * - Joins operators room on mount
 * - Listens for new requests
 * - Handles request removal when taken by others
 * - Manages request acceptance
 */
export default function OperatorRequestManager({ 
  onRequestAccepted, 
  onRequestRemoved 
}: OperatorRequestManagerProps) {
  const [availableRequests, setAvailableRequests] = useState<AssistRequestData[]>([]);
  const [isJoiningOperators, setIsJoiningOperators] = useState(false);

  useEffect(() => {
    // Join operators room on mount
    const joinOperatorsRoom = async () => {
      try {
        setIsJoiningOperators(true);
        joinOperators();
        logger.info("Joined operators room");
      } catch (error) {
        logger.error("Failed to join operators room", error);
      } finally {
        setIsJoiningOperators(false);
      }
    };

    joinOperatorsRoom();

    // Handle new requests
    const handleNewRequest = (event: { success?: boolean; data?: AssistRequestData }) => {
      if (!event?.success || !event?.data) return;
      
      const requestData: AssistRequestData = event.data;
      logger.info("New assistance request received", requestData);
      
      setAvailableRequests(prev => {
        // Check if request already exists (prevent duplicates)
        const exists = prev.some(req => req.id === requestData.id);
        if (exists) return prev;
        
        return [...prev, requestData];
      });
    };

    // Handle request removal (taken by another operator)
    const handleRequestRemoved = (event: { success?: boolean; data?: { id: string; takenBy: string; customerName?: string } }) => {
      if (!event?.success || !event?.data) return;
      
      const { id, takenBy, customerName } = event.data;
      logger.info(`Request ${id} taken by operator ${takenBy}`);
      
      setAvailableRequests(prev => prev.filter(req => req.id !== id));
      onRequestRemoved?.(id, takenBy);
    };

    // Handle successful acceptance
    const handleRequestAccepted = (event: { success?: boolean; data?: { id: string } }) => {
      if (!event?.success || !event?.data) return;
      
      const { id } = event.data;
      logger.info(`Successfully accepted request ${id}`);
      
      setAvailableRequests(prev => prev.filter(req => req.id !== id));
      onRequestAccepted?.(id);
    };

    // Register event listeners
    onAssistCreated(handleNewRequest);
    onAssistRemoved(handleRequestRemoved);
    onAssistAccepted(handleRequestAccepted);

    // Cleanup
    return () => {
      onAssistCreated(handleNewRequest, true);
      onAssistRemoved(handleRequestRemoved, true);
      onAssistAccepted(handleRequestAccepted, true);
    };
  }, [onRequestAccepted, onRequestRemoved]);

  /**
   * Accept a request (first-come-first-served)
   */
  const acceptRequest = async (requestId: string) => {
    try {
      logger.info(`Attempting to accept request ${requestId}`);
      
      assistAccept({ id: requestId }, (response) => {
        if (response?.success) {
          logger.info(`Request ${requestId} accepted successfully`);
        } else {
          logger.error(`Failed to accept request ${requestId}`, response?.msg);
          // Request might have been taken by another operator
          setAvailableRequests(prev => prev.filter(req => req.id !== requestId));
        }
      });
    } catch (error) {
      logger.error(`Error accepting request ${requestId}`, error);
    }
  };

  return {
    availableRequests,
    isJoiningOperators,
    acceptRequest,
    requestCount: availableRequests.length
  };
}
