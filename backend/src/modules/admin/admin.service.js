import { prisma } from '../../config/db.js';
import requestRepository from '../request/request.repository.js';
import bcrypt from 'bcrypt';

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
        ambulance: {
          include: {
            driver: true,
            hospital: {
              include: {
                staff: true
              }
            }
          }
        },
        driver: true,
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
        ambulanceId: a.id,
        driverName: a.driver ? a.driver.name : 'Unassigned',
        driverId: a.driver?.id || null,
        status: a.isAvailable ? 'Available' : 'Active',
        hospitalName: a.hospital ? a.hospital.name : 'Unknown',
        hospitalId: a.hospitalId,
        locationLat: a.locationLat,
        locationLng: a.locationLng,
      })),
      hospitals: hospitals.map(h => ({
        id: h.id,
        name: h.name,
        locationLat: h.locationLat,
        locationLng: h.locationLng,
        icuBedsAvailable: h.icuBedsAvailable || 0,
        generalBedsAvailable: (h.bedCapacity || 0) - (h.icuBedsAvailable || 0),
        totalBeds: h.bedCapacity || 0,
        status: 'Operational'
      })),
      recentRequests: recentRequests.map(r => ({
        id: r.id,
        status: r.status,
        emergencyType: r.emergencyType,
        patientName: r.patientName || 'Unknown',
        patientPhone: r.patientPhone || null,
        patientEmail: r.patient?.email || null,
        pickupAddress: r.pickupAddress || null,
        locationLat: r.locationLat,
        locationLng: r.locationLng,
        isGuest: r.isGuest,
        isFake: r.isFake,
        isSuspicious: r.isSuspicious,
        suspiciousReason: r.suspiciousReason,
        trustScoreAtRequest: r.trustScoreAtRequest,
        mlRisk: r.mlDelayRisk,
        mlDelayMins: r.mlExpectedDelay,
        mlReasons: r.mlReasons ? JSON.parse(r.mlReasons) : [],
        mlActions: r.mlSuggestedActions ? JSON.parse(r.mlSuggestedActions) : [],
        ambulanceId: r.ambulance?.id || null,
        ambulancePlate: r.ambulance?.plateNumber || null,
        ambulanceLat: r.ambulance?.locationLat || null,
        ambulanceLng: r.ambulance?.locationLng || null,
        // Resolve driver from direct relation first, then via ambulance
        driverName: r.driver?.name || r.ambulance?.driver?.name || null,
        driverPhone: r.driver?.phone || r.ambulance?.driver?.phone || null,
        driverEmail: r.driver?.email || r.ambulance?.driver?.email || null,
        // Resolve hospital from ambulance relation, fallback to ML recommendation
        hospitalName: r.ambulance?.hospital?.name || r.mlRecommendedHospitalName || null,
        hospitalEmail: r.ambulance?.hospital?.staff?.[0]?.email || null,
        hospitalLat: r.ambulance?.hospital?.locationLat || null,
        hospitalLng: r.ambulance?.hospital?.locationLng || null,
        mlRecommendedHospitalName: r.mlRecommendedHospitalName || null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }))
    };
  }

  async getAllUsers() {
    return await prisma.user.findMany();
  }

  async getAllRequests() {
    return await requestRepository.findAllRequests();
  }

  async getDeviceTrustList() {
    return await prisma.deviceTrust.findMany({
      orderBy: { trustScore: 'asc' }
    });
  }

  async setDeviceBlacklist(deviceId, blacklisted) {
    return await prisma.deviceTrust.upsert({
      where: { deviceId },
      update: { isBlacklisted: blacklisted },
      create: { deviceId, isBlacklisted: blacklisted, trustScore: blacklisted ? -10 : 0 }
    });
  }

  async getSuspiciousRequests() {
    return await prisma.request.findMany({
      where: { OR: [{ isSuspicious: true }, { isFake: true }] },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        ambulance: { include: { hospital: true, driver: true } }
      }
    });
  }
  /**
   * Get all driver and hospital staff accounts (no password hashes).
   */
  async getStaffAccounts() {
    const drivers = await prisma.user.findMany({
      where: { role: 'DRIVER' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        ambulance: {
          select: {
            id: true,
            plateNumber: true,
            isAvailable: true,
            hospital: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const hospitals = await prisma.user.findMany({
      where: { role: 'HOSPITAL' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        hospitalId: true,
        createdAt: true,
        hospital: {
          select: {
            id: true,
            name: true,
            address: true,
            locationLat: true,
            locationLng: true,
            bedCapacity: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return { drivers, hospitals };
  }

  /**
   * Reset password for any staff account by user ID.
   */
  async resetStaffPassword(userId, newPassword) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
    return { success: true, message: `Password reset for ${user.name} (${user.email})` };
  }
}

export default new AdminService();
