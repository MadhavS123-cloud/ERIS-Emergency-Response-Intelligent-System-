import { prisma } from '../../config/db.js';
import requestRepository from '../request/request.repository.js';

class AdminService {
  async getDashboardStats() {
    // KPI Data
    const totalRequests24h = await prisma.request.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    });
    
    const activeAmbulances = await prisma.ambulance.count({
      where: { isAvailable: false } // 'deployed' units
    });

    const activeNodes = await prisma.hospital.count();

    // Active Fleet
    const fleet = await prisma.ambulance.findMany({
      include: { driver: true, hospital: true }
    });

    // Node Stations
    const hospitals = await prisma.hospital.findMany();

    // Requests (For distress vector charts & System Logs)
    const recentRequests = await prisma.request.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        ambulance: true,
        patient: true
      }
    });

    // Compute average delay latency if available from ML
    let avgLatency = "0.0";
    const requestsWithLatency = recentRequests.filter(r => r.mlExpectedDelay);
    if (requestsWithLatency.length > 0) {
      const totalLatency = requestsWithLatency.reduce((acc, r) => acc + r.mlExpectedDelay, 0);
      avgLatency = (totalLatency / requestsWithLatency.length).toFixed(1);
    }

    return {
      kpis: {
        signals24h: totalRequests24h,
        unitsDeployed: activeAmbulances,
        avgLatencyMins: avgLatency,
        activeNodes: activeNodes
      },
      fleet: fleet.map(a => ({
        unitId: a.plateNumber || a.id.slice(0, 8),
        driverName: a.driver ? a.driver.name : 'Unassigned',
        status: a.isAvailable ? 'Available' : 'Active',
        hospitalName: a.hospital ? a.hospital.name : 'Unknown'
      })),
      nodes: hospitals.map(h => ({
        nodeId: h.id.slice(0, 8),
        name: h.name,
        icuBeds: h.icuBedsAvailable,
        totalBeds: h.bedCapacity,
        status: 'Online'
      })),
      recentRequests: recentRequests.map(r => ({
        id: r.id,
        status: r.status,
        emergencyType: r.emergencyType,
        mlRisk: r.mlDelayRisk,
        mlDelayMins: r.mlExpectedDelay,
        mlReasons: r.mlReasons ? JSON.parse(r.mlReasons) : [],
        mlActions: r.mlSuggestedActions ? JSON.parse(r.mlSuggestedActions) : [],
        createdAt: r.createdAt
      }))
    };
  }

  async getAllUsers() {
    return await prisma.user.findMany();
  }

  async getAllRequests() {
    return await requestRepository.findAllRequests();
  }
}

export default new AdminService();
