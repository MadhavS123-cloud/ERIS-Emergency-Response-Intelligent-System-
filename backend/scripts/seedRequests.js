import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const ambulances = await prisma.ambulance.findMany({
    include: { driver: true, hospital: true },
    take: 5
  });

  if (ambulances.length === 0) {
    console.log('No ambulances found. Run seedDrivers first.');
    return;
  }

  const patient = await prisma.user.findFirst({ where: { role: 'PATIENT' } });
  if (!patient) {
     console.log('No patient found. Run seedUser first.');
     return;
  }

  const emergencies = [
    { type: 'Cardiac Arrest', status: 'EN_ROUTE', lat: 12.9279, lng: 77.6271, address: 'Koramangala 4th Block' },
    { type: 'Road Accident', status: 'ACCEPTED', lat: 12.9716, lng: 77.5946, address: 'MG Road Metro Station' },
    { type: 'Respiratory Distress', status: 'ARRIVED', lat: 12.9352, lng: 77.6245, address: 'St Johns Hospital Cross' },
    { type: 'Severe Trauma', status: 'IN_TRANSIT', lat: 12.9562, lng: 77.7011, address: 'Brookefield Mall' },
    { type: 'Stroke', status: 'PENDING', lat: 13.0285, lng: 77.5895, address: 'Hebbal Flyover' }
  ];

  for (let i = 0; i < emergencies.length; i++) {
    const data = emergencies[i];
    const amb = ambulances[i % ambulances.length];
    
    const request = await prisma.request.create({
      data: {
        patientId: patient.id,
        patientName: 'Emergency Patient ' + (i + 1),
        patientPhone: '987654321' + i,
        emergencyType: data.type,
        status: data.status,
        locationLat: data.lat,
        locationLng: data.lng,
        pickupAddress: data.address,
        ambulanceId: data.status !== 'PENDING' ? amb.id : null,
        driverId: data.status !== 'PENDING' ? amb.driverId : null,
        mlDelayRisk: i === 0 ? 'High' : 'Low',
        mlExpectedDelay: i === 0 ? 18.5 : 5.2,
        mlReasons: JSON.stringify(['Traffic', 'Weather']),
        mlSuggestedActions: JSON.stringify(['Route Alpha', 'Dispatch Support'])
      }
    });

    if (data.status !== 'PENDING') {
      await prisma.ambulance.update({
        where: { id: amb.id },
        data: { isAvailable: false }
      });
    }
  }

  console.log('Successfully seeded 5 active emergencies.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
