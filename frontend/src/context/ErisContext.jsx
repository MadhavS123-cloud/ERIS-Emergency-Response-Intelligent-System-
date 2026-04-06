import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import API_BASE_URL from '../config/api';
import authService from '../services/authService';
import { socket } from '../socket';

const ErisContext = createContext(null);

const mapBackendStatusToUi = (status) => {
  switch (status) {
    case 'PENDING':
      return 'incoming';
    case 'ACCEPTED':
      return 'assigned';
    case 'EN_ROUTE':
      return 'en_route';
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
  /cardiac|heart|stroke/i.test(emergencyType) ? 'CRITICAL' : 'HIGH'
);

const getLogMessage = (request) => {
  if (request.status === 'COMPLETED') {
    return 'Emergency request closed in the dispatch system.';
  }

  if (request.status === 'IN_ROUTE') {
    return 'Assigned ambulance is now heading to the pickup location.';
  }

  if (request.status === 'ACCEPTED') {
    return 'Hospital staff assigned an ambulance and driver to this case.';
  }

  return 'Emergency request received and waiting for hospital assignment.';
};

const mapRequestToDispatch = (request) => ({
  ...request,
  requestId: request.id.slice(0, 8).toUpperCase(),
  status: mapBackendStatusToUi(request.status),
  patientName: request.patientName || request.patient?.name || 'Unknown Patient',
  contactNumber: request.patientPhone || request.patient?.phone || 'No Contact',
  hospitalName: request.ambulance?.hospital?.name || 'Awaiting hospital assignment',
  hospitalId: request.ambulance?.hospital?.id || null,
  hospitalPosition: [
    request.ambulance?.hospital?.locationLat ?? 12.9635,
    request.ambulance?.hospital?.locationLng ?? 77.6032
  ],
  patientPosition: [request.locationLat, request.locationLng],
  priority: getPriority(request.emergencyType),
  ambulanceId: request.ambulance?.plateNumber || 'Awaiting assignment',
  ambulanceInternalId: request.ambulance?.id || null,
  driverName: request.driver?.name || request.ambulance?.driver?.name || 'Awaiting assignment',
  driverId: request.driver?.id || request.ambulance?.driver?.id || null,
  driverEmail: request.driver?.email || request.ambulance?.driver?.email || null,
  driverPhone: request.driver?.phone || request.ambulance?.driver?.phone || null,
  eta: request.status === 'COMPLETED'
    ? 'Arrived'
    : request.status === 'EN_ROUTE'
      ? '8 mins'
      : request.status === 'ACCEPTED'
        ? '12 mins'
        : 'Awaiting assignment',
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

    const handleRequestChange = () => {
      fetchData();
    };

    socket.on('new_emergency', handleRequestChange);
    socket.on('request_updated', handleRequestChange);
    socket.on('driver_assigned', handleRequestChange);

    return () => {
      socket.off('new_emergency', handleRequestChange);
      socket.off('request_updated', handleRequestChange);
      socket.off('driver_assigned', handleRequestChange);
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
      patientPhone: formData.contactNumber || '0000000000',
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
          locationLat: formData.locationLat || 12.9716,
          locationLng: formData.locationLng || 77.5946,
          patientName: formData.patientName || 'Emergency Patient',
          patientPhone: formData.contactNumber || 'Not Provided'
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
      return dispatches.find(dispatch => dispatch.id === selectedDispatchId) || dispatches[0] || null;
    }

    return dispatches.find(dispatch => dispatch.status !== 'completed') || dispatches[0] || null;
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
