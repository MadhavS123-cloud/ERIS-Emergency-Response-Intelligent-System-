import React, { createContext, useContext, useEffect, useState } from 'react';

const ERIS_STORAGE_KEY = 'eris-demo-state-v1';

const formatTimestamp = (date = new Date()) =>
  new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);

const createLogEntry = (message, type = 'system', timestamp = formatTimestamp()) => ({
  id: `${timestamp}-${message}`,
  message,
  type,
  timestamp,
});

const createSeedDispatches = () => [
  {
    id: 'dispatch-seed-1',
    requestId: 'REQ-8754-ALPHA',
    patientName: 'Sarah Johnson',
    contactNumber: '+91 98765 12345',
    emergencyType: 'Cardiac Arrest',
    pickupAddress: '456 Oak Street, Downtown',
    medicalNotes: 'Patient experiencing chest pain and shortness of breath.',
    hospitalName: 'City General Emergency Dept',
    hospitalPosition: [12.9635, 77.6032],
    patientPosition: [12.9716, 77.5946],
    ambulanceId: 'AMB-2451',
    priority: 'CRITICAL',
    eta: '4 min',
    estimatedCharge: 3500,
    status: 'incoming',
    createdAt: formatTimestamp(),
    updatedAt: formatTimestamp(),
    logs: [
      createLogEntry('Incident received by central dispatch.', 'system'),
      createLogEntry('Awaiting EMS driver acceptance.', 'system'),
    ],
  },
  {
    id: 'dispatch-seed-2',
    requestId: 'REQ-8812-BRAVO',
    patientName: 'Priya Raman',
    contactNumber: '+91 99881 11442',
    emergencyType: 'Trauma/Accident',
    pickupAddress: 'Old Airport Road Junction',
    medicalNotes: 'Multiple vehicle collision reported by caller.',
    hospitalName: 'City General Emergency Dept',
    hospitalPosition: [12.9635, 77.6032],
    patientPosition: [12.9498, 77.6681],
    ambulanceId: 'AMB-1893',
    priority: 'HIGH',
    eta: '8 min',
    estimatedCharge: 3000,
    status: 'assigned',
    createdAt: formatTimestamp(),
    updatedAt: formatTimestamp(),
    logs: [
      createLogEntry('Hospital acknowledged incoming trauma case.', 'hospital'),
      createLogEntry('EMS unit assigned and briefed.', 'driver'),
    ],
  },
  {
    id: 'dispatch-seed-3',
    requestId: 'REQ-8840-CHARLIE',
    patientName: 'Amaan Khan',
    contactNumber: '+91 97000 78121',
    emergencyType: 'Stroke',
    pickupAddress: 'Metro Station Exit B, East District',
    medicalNotes: 'Possible facial droop reported by bystander.',
    hospitalName: 'City General Emergency Dept',
    hospitalPosition: [12.9635, 77.6032],
    patientPosition: [12.9861, 77.7112],
    ambulanceId: 'AMB-3127',
    priority: 'CRITICAL',
    eta: '12 min',
    estimatedCharge: 3200,
    status: 'incoming',
    createdAt: formatTimestamp(),
    updatedAt: formatTimestamp(),
    logs: [
      createLogEntry('New stroke alert created from hotline intake.', 'system'),
    ],
  },
];

const createInitialState = () => ({
  hospitalCapacity: {
    icuAvailable: 12,
    generalAvailable: 48,
    ventilatorsAvailable: 5,
  },
  dispatches: createSeedDispatches(),
  selectedDispatchId: 'dispatch-seed-1',
});

const loadStoredState = () => {
  if (typeof window === 'undefined') {
    return createInitialState();
  }

  try {
    const stored = window.localStorage.getItem(ERIS_STORAGE_KEY);
    if (!stored) {
      return createInitialState();
    }

    const parsed = JSON.parse(stored);
    if (!parsed?.dispatches?.length) {
      return createInitialState();
    }

    return {
      ...parsed,
      dispatches: parsed.dispatches.map((dispatch) => ({
        ...dispatch,
        estimatedCharge: dispatch.estimatedCharge ?? getEstimatedCharge(dispatch.emergencyType),
      })),
    };
  } catch (error) {
    console.error('Failed to load ERIS demo state, resetting store.', error);
    return createInitialState();
  }
};

const getPriorityFromEmergency = (emergencyType) => {
  if (['Cardiac Arrest', 'Stroke', 'Respiratory'].includes(emergencyType)) {
    return 'CRITICAL';
  }

  if (emergencyType === 'Trauma/Accident') {
    return 'HIGH';
  }

  return 'MODERATE';
};

const getEtaFromEmergency = (emergencyType) => {
  const etaMap = {
    'Cardiac Arrest': '4 min',
    Stroke: '6 min',
    Respiratory: '7 min',
    'Trauma/Accident': '8 min',
    Other: '10 min',
  };

  return etaMap[emergencyType] || '9 min';
};

const getEstimatedCharge = (emergencyType) => {
  const fareMap = {
    'Cardiac Arrest': 3500,
    Stroke: 3200,
    Respiratory: 2800,
    'Trauma/Accident': 3000,
    Other: 2200,
  };

  return fareMap[emergencyType] || 2500;
};

const getRandomOffset = () => (Math.random() - 0.5) * 0.06;

const createDispatchFromForm = (formData) => {
  const timestamp = formatTimestamp();
  const id = `dispatch-${Date.now()}`;
  const requestNumber = String(Date.now()).slice(-4);

  return {
    id,
    requestId: `REQ-${requestNumber}-LIVE`,
    patientName: formData.patientName,
    contactNumber: formData.contactNumber,
    emergencyType: formData.emergencyType,
    pickupAddress: formData.pickupAddress,
    medicalNotes: formData.medicalNotes,
    hospitalName: 'City General Emergency Dept',
    hospitalPosition: [12.9635, 77.6032],
    patientPosition: [12.9716 + getRandomOffset(), 77.5946 + getRandomOffset()],
    ambulanceId: `AMB-${Math.floor(1000 + Math.random() * 8000)}`,
    priority: getPriorityFromEmergency(formData.emergencyType),
    eta: getEtaFromEmergency(formData.emergencyType),
    estimatedCharge: getEstimatedCharge(formData.emergencyType),
    status: 'incoming',
    createdAt: timestamp,
    updatedAt: timestamp,
    logs: [
      createLogEntry('Emergency request submitted from patient portal.', 'patient', timestamp),
      createLogEntry('Dispatch broadcast sent to the nearest available EMS unit.', 'system', timestamp),
    ],
  };
};

const createUpdatedDispatch = (dispatch, updates, message, type = 'system') => {
  const timestamp = formatTimestamp();

  return {
    ...dispatch,
    ...updates,
    updatedAt: timestamp,
    logs: message ? [...dispatch.logs, createLogEntry(message, type, timestamp)] : dispatch.logs,
  };
};

const ErisContext = createContext(null);

export function ErisProvider({ children }) {
  const [state, setState] = useState(() => loadStoredState());

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ERIS_STORAGE_KEY, JSON.stringify(state));
    }
  }, [state]);

  const selectDispatch = (dispatchId) => {
    setState((current) => ({
      ...current,
      selectedDispatchId: dispatchId,
    }));
  };

  const submitEmergencyRequest = (formData) => {
    const newDispatch = createDispatchFromForm(formData);

    setState((current) => ({
      ...current,
      dispatches: [newDispatch, ...current.dispatches],
      selectedDispatchId: newDispatch.id,
    }));

    return newDispatch;
  };

  const updateDispatchStatus = (dispatchId, status, message, type = 'system') => {
    setState((current) => ({
      ...current,
      dispatches: current.dispatches.map((dispatch) =>
        dispatch.id === dispatchId
          ? createUpdatedDispatch(dispatch, { status }, message, type)
          : dispatch
      ),
    }));
  };

  const assignDispatch = (dispatchId) => {
    updateDispatchStatus(dispatchId, 'assigned', 'Hospital command has assigned an EMS unit.', 'hospital');
    setState((current) => ({
      ...current,
      selectedDispatchId: dispatchId,
    }));
  };

  const updateHospitalCapacity = (nextCapacity) => {
    const timestamp = formatTimestamp();

    setState((current) => ({
      ...current,
      hospitalCapacity: {
        ...current.hospitalCapacity,
        ...nextCapacity,
      },
      dispatches: current.dispatches.map((dispatch, index) =>
        dispatch.id === current.selectedDispatchId || (!current.selectedDispatchId && index === 0)
          ? createUpdatedDispatch(
              dispatch,
              {},
              `Hospital capacity was synced at ${timestamp}.`,
              'hospital'
            )
          : dispatch
      ),
    }));
  };

  const resetDemoState = () => {
    setState(createInitialState());
  };

  const activeDispatch = React.useMemo(() => {
    // First try to find the selected dispatch by ID
    if (state.selectedDispatchId) {
      const selected = state.dispatches.find((dispatch) => dispatch.id === state.selectedDispatchId);
      if (selected) return selected;
    }
    
    // If no selected dispatch, find the first non-completed dispatch
    const activeDispatch = state.dispatches.find((dispatch) => dispatch.status !== 'completed');
    if (activeDispatch) return activeDispatch;
    
    // Finally, return the first dispatch if available
    return state.dispatches[0] || null;
  }, [state.dispatches, state.selectedDispatchId]);

  return (
    <ErisContext.Provider
      value={{
        dispatches: state.dispatches,
        activeDispatch,
        hospitalCapacity: state.hospitalCapacity,
        selectedDispatchId: state.selectedDispatchId,
        submitEmergencyRequest,
        updateDispatchStatus,
        assignDispatch,
        selectDispatch,
        updateHospitalCapacity,
        resetDemoState,
      }}
    >
      {children}
    </ErisContext.Provider>
  );
}

export const useEris = () => useContext(ErisContext);
