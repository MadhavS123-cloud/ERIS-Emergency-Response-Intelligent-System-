import { prisma } from '../../config/db.js';
import requestRepository from '../request/request.repository.js';
import bcrypt from 'bcrypt';

const DASHBOARD_CACHE_TTL_MS = 5 * 60 * 1000;
const DASHBOARD_RECENT_REQUEST_LIMIT = 15;

const parseJsonArray = (value) => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const deriveFallbackMlSnapshot = (request) => {
  const hospitalLat = request.ambulance?.hospital?.locationLat;
  const hospitalLng = request.ambulance?.hospital?.locationLng;
  const requestLat = request.locationLat;
  const requestLng = request.locationLng;
  const type = String(request.emergencyType || '').toLowerCase();
  const createdAt = new Date(request.createdAt || Date.now());
  const hour = createdAt.getHours();
  const isPeakHour = (hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 21);

  let distanceKm = 6;
  if ([hospitalLat, hospitalLng, requestLat, requestLng].every(value => typeof value === 'number')) {
    distanceKm = Math.sqrt(Math.pow(hospitalLat - requestLat, 2) + Math.pow(hospitalLng - requestLng, 2)) * 111;
  }

  let delay = 5 + (distanceKm * 1.4);
  if (isPeakHour) delay += 4;
  if (/(cardiac|heart|stroke|trauma|accident|bleeding|respiratory|breathing)/i.test(type)) delay += 3;
  const roundedDelay = Number(Math.max(5, delay).toFixed(1));
  const risk = roundedDelay >= 18 ? 'High' : roundedDelay >= 11 ? 'Medium' : 'Low';

  return {
    mlRisk: risk,
    mlDelayMins: roundedDelay,
    mlReasons: [
      `${distanceKm.toFixed(1)} km estimated dispatch distance`,
      isPeakHour ? 'Peak-hour traffic conditions likely' : 'Standard traffic conditions likely',
      'Heuristic fallback used because stored ML output is missing'
    ],
    mlActions: [
      risk === 'High'
        ? 'Dispatch immediately and notify receiving hospital'
        : 'Proceed with standard dispatch while monitoring route'
    ],
    mlPredictionSource: 'fallback'
  };
};

class AdminService {
  constructor() {
    this.dashboardCache = {
      expiresAt: 0,
      payload: null
    };
  }

  async getDashboardStats({ forceRefresh = false } = {}) {
    if (!forceRefresh && this.dashboardCache.payload && this.dashboardCache.expiresAt > Date.now()) {
      return this.dashboardCache.payload;
    }

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      totalRequests24h,
      fleet,
      hospitals,
      recentRequests
    ] = await Promise.all([
      prisma.request.count({
        where: {
          createdAt: {
            gte: since24h
          }
        }
      }),
      prisma.ambulance.findMany({
        select: {
          id: true,
          plateNumber: true,
          hospitalId: true,
          locationLat: true,
          locationLng: true,
          isAvailable: true,
          driver: {
            select: {
              id: true,
              name: true
            }
          },
          hospital: {
            select: {
              name: true
            }
          }
        }
      }),
      prisma.hospital.findMany({
        select: {
          id: true,
          name: true,
          locationLat: true,
          locationLng: true,
          icuBedsAvailable: true,
          bedCapacity: true
        }
      }),
      prisma.request.findMany({
        take: DASHBOARD_RECENT_REQUEST_LIMIT,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          emergencyType: true,
          patientName: true,
          patientPhone: true,
          pickupAddress: true,
          locationLat: true,
          locationLng: true,
          isGuest: true,
          isFake: true,
          isSuspicious: true,
          suspiciousReason: true,
          trustScoreAtRequest: true,
          mlDelayRisk: true,
          mlExpectedDelay: true,
          mlReasons: true,
          mlSuggestedActions: true,
          mlRecommendedHospitalName: true,
          createdAt: true,
          updatedAt: true,
          patient: {
            select: {
              email: true
            }
          },
          driver: {
            select: {
              name: true,
              phone: true,
              email: true
            }
          },
          ambulance: {
            select: {
              id: true,
              plateNumber: true,
              locationLat: true,
              locationLng: true,
              driver: {
                select: {
                  name: true,
                  phone: true,
                  email: true
                }
              },
              hospital: {
                select: {
                  name: true,
                  locationLat: true,
                  locationLng: true,
                  staff: {
                    select: {
                      email: true
                    },
                    take: 1
                  }
                }
              }
            }
          }
        }
      })
    ]);

    const activeAmbulances = fleet.filter((ambulance) => !ambulance.isAvailable).length;
    const activeNodes = hospitals.length;

    // Compute average delay latency if available from ML
    let avgLatency = "0.0";
    const requestsWithLatency = recentRequests.filter(r => r.mlExpectedDelay);
    if (requestsWithLatency.length > 0) {
      const totalLatency = requestsWithLatency.reduce((acc, r) => acc + r.mlExpectedDelay, 0);
      avgLatency = (totalLatency / requestsWithLatency.length).toFixed(1);
    }

    const payload = {
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
        isAvailable: a.isAvailable,
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
      recentRequests: recentRequests.map(r => {
        const baseRequest = {
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
          mlReasons: parseJsonArray(r.mlReasons),
          mlActions: parseJsonArray(r.mlSuggestedActions),
          ambulanceId: r.ambulance?.id || null,
          ambulancePlate: r.ambulance?.plateNumber || null,
          ambulanceLat: r.ambulance?.locationLat || null,
          ambulanceLng: r.ambulance?.locationLng || null,
          driverName: r.driver?.name || r.ambulance?.driver?.name || null,
          driverPhone: r.driver?.phone || r.ambulance?.driver?.phone || null,
          driverEmail: r.driver?.email || r.ambulance?.driver?.email || null,
          hospitalName: r.ambulance?.hospital?.name || r.mlRecommendedHospitalName || null,
          hospitalEmail: r.ambulance?.hospital?.staff?.[0]?.email || null,
          hospitalLat: r.ambulance?.hospital?.locationLat || null,
          hospitalLng: r.ambulance?.hospital?.locationLng || null,
          mlRecommendedHospitalName: r.mlRecommendedHospitalName || null,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          mlPredictionSource: 'stored'
        };

        if (baseRequest.mlRisk && baseRequest.mlDelayMins !== null && baseRequest.mlDelayMins !== undefined) {
          return baseRequest;
        }

        return {
          ...baseRequest,
          ...deriveFallbackMlSnapshot(r)
        };
      })
    };

    this.dashboardCache = {
      expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS,
      payload
    };

    return payload;
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
