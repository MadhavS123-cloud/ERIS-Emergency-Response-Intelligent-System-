import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import API_BASE_URL from '../config/api';
import authService from '../services/authService';
import { socket } from '../socket';
import { toast } from 'react-hot-toast';

const ErisContext = createContext(null);

const mapBackendStatusToUi = (status) => {
  switch (status) {
    case 'PENDING':
      return 'incoming';
    case 'ACCEPTED':
      return 'assigned';
    case 'EN_ROUTE':
      return 'en_route';
    case 'ARRIVED':
      return 'arrived';
    case 'IN_TRANSIT':
      return 'in_transit';
    case 'COMPLETED':
    case 'CANCELLED':
      return 'completed';
    default:
      return 'incoming';
  }
};

const mapUiStatusToBackend = (status) => {
  switch (status) {
    case 'incoming':
    case 'PENDING':
      return 'PENDING';
    case 'assigned':
    case 'ACCEPTED':
      return 'ACCEPTED';
    case 'en_route':
    case 'EN_ROUTE':
      return 'EN_ROUTE';
    case 'arrived':
    case 'ARRIVED':
      return 'ARRIVED';
    case 'in_transit':
    case 'IN_TRANSIT':
      return 'IN_TRANSIT';
    case 'completed':
    case 'COMPLETED':
    case 'CANCELLED':
      return 'COMPLETED';
    default:
      return status;
  }
};

const getRequestsUrlForRole = (role) => {
  if (role === 'PATIENT') {
    return `${API_BASE_URL}/requests/me`;
  }

  if (role === 'DRIVER') {
    return `${API_BASE_URL}/requests/driver/me`;
  }

  if (role === 'ADMIN' || role === 'HOSPITAL') {
    return `${API_BASE_URL}/requests`;
  }

  return null;
};

const getPriority = (emergencyType = '') => (
  /cardiac|heart|stroke|panic|sos/i.test(emergencyType) ? 'CRITICAL' : 'HIGH'
);

const getLogMessage = (request) => {
  if (request.status === 'COMPLETED') {
    return 'Emergency request closed in the dispatch system.';
  }

  if (request.status === 'EN_ROUTE') {
    return 'Assigned ambulance is now heading to the pickup location.';
  }

  if (request.status === 'ACCEPTED') {
    return 'Hospital staff assigned an ambulance and driver to this case.';
  }

  return 'Emergency request received and waiting for hospital assignment.';
};

// Haversine distance in km (client-side, no import needed)
const haversineKm = (lat1, lng1, lat2, lng2) => {
  if (!lat1 || !lng1 || !lat2 || !lng2) return null;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Compute a realistic ETA string from ambulance → patient distance
const computeEta = (request) => {
  const status = request.status;
  if (status === 'COMPLETED' || status === 'CANCELLED') return 'Arrived';
  if (status === 'IN_TRANSIT') return 'Heading to hospital';
  if (status === 'ARRIVED') return 'Ambulance at pickup';

  // Use ML-predicted delay if available
  if (request.mlExpectedDelay && (status === 'EN_ROUTE' || status === 'ACCEPTED')) {
    const mins = Math.round(request.mlExpectedDelay);
    return `~${mins} min${mins !== 1 ? 's' : ''}`;
  }

  // Fall back to distance-based estimate (avg ambulance speed ~40 km/h in city)
  const ambLat = request.ambulance?.locationLat;
  const ambLng = request.ambulance?.locationLng;
  const dist = haversineKm(ambLat, ambLng, request.locationLat, request.locationLng);
  if (dist !== null) {
    const mins = Math.max(2, Math.round((dist / 40) * 60));
    return `~${mins} min${mins !== 1 ? 's' : ''}`;
  }

  if (status === 'EN_ROUTE') return 'En route';
  if (status === 'ACCEPTED') return 'Dispatched';
  return 'Awaiting dispatch';
};

const mapRequestToDispatch = (request) => ({
  ...request,
  requestId: request.id.slice(0, 8).toUpperCase(),
  status: mapBackendStatusToUi(request.status),
  patientName: request.patientName || request.patient?.name || 'Unknown Patient',
  contactNumber: request.patientPhone || request.patient?.phone || 'No Contact',
  hospitalName: request.ambulance?.hospital?.name || request.mlRecommendedHospitalName || 'Awaiting hospital assignment',
  hospitalId: request.ambulance?.hospital?.id || null,
  // Only use real hospital coordinates — no hardcoded fallback
  hospitalPosition: (request.ambulance?.hospital?.locationLat && request.ambulance?.hospital?.locationLng)
    ? [request.ambulance.hospital.locationLat, request.ambulance.hospital.locationLng]
    : null,
  patientPosition: (request.locationLat && request.locationLng)
    ? [request.locationLat, request.locationLng]
    : null,
  // Real ambulance GPS position from the database
  ambulancePosition: (request.ambulance?.locationLat && request.ambulance?.locationLng)
    ? [request.ambulance.locationLat, request.ambulance.locationLng]
    : null,
  priority: getPriority(request.emergencyType),
  ambulanceId: request.ambulance?.plateNumber || 'Awaiting assignment',
  vehicleNumber: request.ambulance?.plateNumber || 'Awaiting assignment',
  ambulanceInternalId: request.ambulance?.id || null,
  driverName: request.driver?.name || request.ambulance?.driver?.name || 'Awaiting assignment',
  driverId: request.driver?.id || request.ambulance?.driver?.id || null,
  driverEmail: request.driver?.email || request.ambulance?.driver?.email || null,
  driverPhone: request.driver?.phone || request.ambulance?.driver?.phone || null,
  eta: computeEta(request),
  estimatedCharge: 3000,
  logs: [
    {
      id: `log-${request.id}`,
      message: getLogMessage(request),
      type: 'system',
      timestamp: new Date(request.updatedAt || request.createdAt).toLocaleTimeString(),
    }
  ]
});

export function ErisProvider({ children }) {
  const [dispatches, setDispatches] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [selectedDispatchId, setSelectedDispatchId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const token = authService.getToken();
    const user = authService.getUser();

    if (!token || !user) {
      setDispatches([]);
      setHospitals([]);
      setSelectedDispatchId(null);
      setIsLoading(false);
      return;
    }

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const requestsUrl = getRequestsUrlForRole(user.role);

      let requestsData = { status: 'success', data: [] };
      if (requestsUrl) {
        const requestsResponse = await fetch(requestsUrl, { headers });
        requestsData = await requestsResponse.json();
      }

      const hospitalsResponse = await fetch(`${API_BASE_URL}/hospitals`, { headers });
      const hospitalsData = await hospitalsResponse.json();

      if (requestsData.status === 'success') {
        setDispatches(requestsData.data.map(mapRequestToDispatch));
      } else {
        console.warn('Unable to fetch requests:', requestsData.message);
        setDispatches([]);
      }

      if (hospitalsData.status === 'success') {
        setHospitals(hospitalsData.data);
      } else {
        setHospitals([]);
      }
    } catch (error) {
      console.error('Failed to fetch data from backend:', error);
      setDispatches([]);
      setHospitals([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const user = authService.getUser();
    const token = authService.getToken();

    if (!user || !token) {
      socket.disconnect();
      return undefined;
    }

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit('join_room', user.id);
    if (user.hospitalId) {
      socket.emit('join_room', user.hospitalId);
    }

    const handleRequestChange = (updatedData) => {
      if (updatedData && updatedData.status) {
        // Only toast if it's a patient and the status is moving forward
        const statusMap = {
          'ACCEPTED': 'Ambulance assigned',
          'EN_ROUTE': 'Ambulance headed to pickup',
          'ARRIVED': 'Ambulance arrived',
          'IN_TRANSIT': 'In transit to hospital',
          'COMPLETED': 'Arrived at hospital'
        };
        const message = statusMap[updatedData.status];
        if (message && user.role === 'PATIENT') {
           toast.success(`Update: ${message}`, { id: `status-${updatedData.status}` });
        }
      }
      fetchData();
    };

    // Real-time ambulance location updates — update dispatches AND hospitalFleet in sync
    const handleLocationUpdate = ({ ambulanceId, locationLat, locationLng }) => {
      // 1. Update the dispatch that has this ambulance assigned
      setDispatches(prev => prev.map(d => {
        if (d.ambulanceInternalId !== ambulanceId) return d;
        const dist = haversineKm(locationLat, locationLng, d.patientPosition?.[0], d.patientPosition?.[1]);
        const newEta = dist !== null
          ? `~${Math.max(2, Math.round((dist / 40) * 60))} mins`
          : d.eta;
        return { ...d, ambulancePosition: [locationLat, locationLng], eta: newEta };
      }));

      // 2. Update the ambulance inside hospitals state so hospitalFleet map stays in sync
      setHospitals(prev => prev.map(hospital => ({
        ...hospital,
        ambulances: (hospital.ambulances || []).map(amb =>
          amb.id === ambulanceId
            ? { ...amb, locationLat, locationLng }
            : amb
        )
      })));
    };

    socket.on('new_emergency', handleRequestChange);
    socket.on('request_updated', handleRequestChange);
    socket.on('driver_assigned', handleRequestChange);
    socket.on('location_update', handleLocationUpdate);

    return () => {
      socket.off('new_emergency', handleRequestChange);
      socket.off('request_updated', handleRequestChange);
      socket.off('driver_assigned', handleRequestChange);
      socket.off('location_update', handleLocationUpdate);
    };
  }, [fetchData]);

  const ensurePatientAccess = useCallback(async ({ patientName, patientPhone, patientEmail }) => {
    const currentUser = authService.getUser();
    const currentToken = authService.getToken();
    const normalizedPhone = patientPhone.replace(/\D/g, '');
    const normalizedEmail = patientEmail?.trim().toLowerCase();

    const samePatient =
      currentUser?.role === 'PATIENT' &&
      (currentUser.phone === normalizedPhone || (normalizedEmail && currentUser.email === normalizedEmail));

    if (currentToken && samePatient) {
      return currentToken;
    }

    const sessionResponse = await authService.createPatientSession({
      name: patientName,
      phone: normalizedPhone,
      email: normalizedEmail
    });

    if (sessionResponse.status === 'success') {
      return sessionResponse.data.token;
    }

    console.error('CRITICAL: Patient session creation failed.');
    return null;
  }, []);

  const selectDispatch = (dispatchId) => {
    setSelectedDispatchId(dispatchId);
  };

  const submitEmergencyRequest = async (formData) => {
    const token = await ensurePatientAccess({
      patientName: formData.patientName || 'Emergency Patient',
      patientPhone: formData.contactNumber,
      patientEmail: formData.patientEmail
    });

    if (!token) {
      return null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          emergencyType: formData.emergencyType,
          pickupAddress: formData.pickupAddress,
          medicalNotes: formData.medicalNotes,
          locationLat: formData.locationLat,
          locationLng: formData.locationLng,
          patientName: formData.patientName || 'Emergency Patient',
          patientPhone: formData.contactNumber || null
        })
      });

      const data = await response.json();
      if (data.status !== 'success') {
        console.error('SERVER ERROR:', data.message || 'Unknown error');
        return null;
      }

      const newDispatch = {
        ...mapRequestToDispatch(data.data),
        eta: 'Awaiting assignment',
        logs: [
          {
            id: `log-initial-${data.data.id}`,
            message: 'Emergency request submitted and stored in the database.',
            type: 'system',
            timestamp: new Date().toLocaleTimeString()
          }
        ]
      };

      setDispatches(prev => [newDispatch, ...prev]);
      setSelectedDispatchId(newDispatch.id);
      return newDispatch;
    } catch (error) {
      console.error('NETWORK/FETCH ERROR:', error.message);
      return null;
    }
  };

  const updateDispatchStatus = async (dispatchId, status, message = 'Status updated by system', options = {}) => {
    const token = authService.getToken();
    if (!token) {
      return { ok: false, message: 'You are not logged in.' };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/requests/${dispatchId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status: mapUiStatusToBackend(status),
          ambulanceId: options.ambulanceId || null
        })
      });

      const data = await response.json();
      console.log('Update Status Result:', { status, data });
      if (data.status !== 'success') {
        return { ok: false, message: data.message || 'Unable to update request status.' };
      }

      const updatedDispatch = mapRequestToDispatch(data.data);
      setDispatches(prev => prev.map(dispatch =>
        dispatch.id === dispatchId
          ? {
              ...dispatch,
              ...updatedDispatch,
              logs: [
                ...(dispatch.logs || []),
                {
                  id: `log-${dispatchId}-${Date.now()}`,
                  message,
                  type: 'system',
                  timestamp: new Date().toLocaleTimeString()
                }
              ]
            }
          : dispatch
      ));
      setSelectedDispatchId(dispatchId);

      return { ok: true, data: updatedDispatch };
    } catch (error) {
      console.error('Failed to update status:', error);
      return { ok: false, message: 'Network error while updating request status.' };
    }
  };

  const assignDispatch = async (dispatchId, ambulanceId = null) => (
    updateDispatchStatus(
      dispatchId,
      'assigned',
      'Hospital staff assigned an ambulance and driver.',
      { ambulanceId }
    )
  );

  const logout = () => {
    authService.logout();
    setDispatches([]);
    setHospitals([]);
    setSelectedDispatchId(null);
  };

  const activeDispatch = useMemo(() => {
    if (selectedDispatchId) {
      return dispatches.find(dispatch => dispatch.id === selectedDispatchId) || null;
    }

    return dispatches.find(dispatch => dispatch.status !== 'completed') || null;
  }, [dispatches, selectedDispatchId]);

  const currentHospital = useMemo(() => {
    const user = authService.getUser();
    if (!user?.hospitalId) {
      return null;
    }

    return hospitals.find(hospital => hospital.id === user.hospitalId) || null;
  }, [hospitals]);

  const hospitalCapacity = useMemo(() => ({
    icuAvailable: currentHospital?.icuBedsAvailable ?? 0,
    generalAvailable: currentHospital?.generalBedsAvailable ?? 0,
    ventilatorsAvailable: currentHospital?.ventilatorsAvailable ?? 0,
  }), [currentHospital]);

  const hospitalFleet = useMemo(
    () => currentHospital?.ambulances ?? [],
    [currentHospital]
  );

  const updateHospitalCapacity = useCallback(async (nextCapacity) => {
    const token = authService.getToken();

    if (!token || !currentHospital?.id) {
      return { ok: false, message: 'No hospital profile is linked to this account.' };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/hospitals/${currentHospital.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          icuBedsAvailable: Number(nextCapacity.icuAvailable),
          generalBedsAvailable: Number(nextCapacity.generalAvailable),
          ventilatorsAvailable: Number(nextCapacity.ventilatorsAvailable),
          bedCapacity: Number(nextCapacity.icuAvailable) + Number(nextCapacity.generalAvailable)
        })
      });

      const data = await response.json();
      if (data.status !== 'success') {
        return { ok: false, message: data.message || 'Unable to update hospital capacity.' };
      }

      setHospitals(prev => prev.map(hospital =>
        hospital.id === currentHospital.id
          ? { ...hospital, ...data.data }
          : hospital
      ));

      return { ok: true };
    } catch (error) {
      console.error('Failed to update hospital capacity:', error);
      return { ok: false, message: 'Network error while updating hospital capacity.' };
    }
  }, [currentHospital]);

  return (
    <ErisContext.Provider
      value={{
        dispatches,
        activeDispatch,
        currentHospital,
        hospitalFleet,
        hospitalCapacity,
        selectedDispatchId,
        isLoading,
        submitEmergencyRequest,
        updateDispatchStatus,
        assignDispatch,
        selectDispatch,
        updateHospitalCapacity,
        resetDemoState: logout,
        logout,
        refreshData: fetchData
      }}
    >
      {children}
    </ErisContext.Provider>
  );
}

export const useEris = () => useContext(ErisContext);
